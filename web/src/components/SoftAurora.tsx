import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';
import './SoftAurora.css';

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragmentShader = `
precision highp float;
uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uNoiseFreq;
uniform float uNoiseAmp;
uniform float uBandHeight;
uniform float uBandSpread;
uniform float uOctaveDecay;
uniform float uLayerOffset;
uniform float uColorSpeed;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;

#define TAU 6.28318

vec3 gradientHash(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 234.6)), dot(p, vec3(269.5, 183.3, 198.3)), dot(p, vec3(169.5, 283.3, 156.9)));
  vec3 h = fract(sin(p) * 43758.5453123);
  float phi = acos(2.0 * h.x - 1.0);
  float theta = TAU * h.y;
  return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
}

float quinticSmooth(float t) {
  float t2 = t * t;
  float t3 = t * t2;
  return 6.0 * t3 * t2 - 15.0 * t2 * t2 + 10.0 * t3;
}

float perlin3D(float amplitude, float frequency, vec3 point) {
  vec3 cell = floor(point * frequency);
  vec3 local = point * frequency - cell;
  vec3 s = vec3(quinticSmooth(local.x), quinticSmooth(local.y), quinticSmooth(local.z));
  float n000 = dot(gradientHash(cell), local);
  float n100 = dot(gradientHash(cell + vec3(1.0, 0.0, 0.0)), local - vec3(1.0, 0.0, 0.0));
  float n010 = dot(gradientHash(cell + vec3(0.0, 1.0, 0.0)), local - vec3(0.0, 1.0, 0.0));
  float n110 = dot(gradientHash(cell + vec3(1.0, 1.0, 0.0)), local - vec3(1.0, 1.0, 0.0));
  float n001 = dot(gradientHash(cell + vec3(0.0, 0.0, 1.0)), local - vec3(0.0, 0.0, 1.0));
  float n101 = dot(gradientHash(cell + vec3(1.0, 0.0, 1.0)), local - vec3(1.0, 0.0, 1.0));
  float n011 = dot(gradientHash(cell + vec3(0.0, 1.0, 1.0)), local - vec3(0.0, 1.0, 1.0));
  float n111 = dot(gradientHash(cell + vec3(1.0, 1.0, 1.0)), local - vec3(1.0, 1.0, 1.0));
  float x00 = mix(n000, n100, s.x);
  float x10 = mix(n010, n110, s.x);
  float x01 = mix(n001, n101, s.x);
  float x11 = mix(n011, n111, s.x);
  return amplitude * mix(mix(x00, x10, s.y), mix(x01, x11, s.y), s.z);
}

float auroraGlow(float time, vec2 shift) {
  vec2 uv = gl_FragCoord.xy / uResolution.y + shift;
  vec3 point = vec3(uv * uScale, time * 0.08);
  float noise = 0.0;
  float frequency = uNoiseFreq;
  float amplitude = uNoiseAmp;
  for (float i = 0.0; i < 3.0; i += 1.0) {
    noise += perlin3D(amplitude, frequency, point);
    amplitude *= uOctaveDecay;
    frequency *= 2.0;
  }
  float band = uv.y * 10.0 - uBandHeight * 10.0;
  return 0.3 * exp(uBandSpread * (1.0 - 1.1 * abs(noise + band)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float time = uSpeed * 0.4 * uTime;
  vec2 shift = uEnableMouse ? (uMouse - 0.5) * uMouseInfluence : vec2(0.0);
  float first = auroraGlow(time, shift);
  float second = auroraGlow(time + uLayerOffset, shift + vec2(0.11, -0.04));
  vec3 color = first * uColor1 * (0.72 + 0.28 * sin((uv.x + uTime * 0.08 * uColorSpeed) * TAU));
  color += second * uColor2 * (0.52 + 0.24 * cos((uv.x - uTime * 0.05 * uColorSpeed) * TAU));
  color *= uBrightness;
  float alpha = clamp(length(color), 0.0, 0.52);
  gl_FragColor = vec4(color, alpha);
}
`;

interface SoftAuroraProps {
  speed?: number;
  scale?: number;
  brightness?: number;
  color1?: string;
  color2?: string;
  noiseFrequency?: number;
  noiseAmplitude?: number;
  bandHeight?: number;
  bandSpread?: number;
  octaveDecay?: number;
  layerOffset?: number;
  colorSpeed?: number;
  enableMouseInteraction?: boolean;
  mouseInfluence?: number;
}

export function SoftAurora({
  speed = 0.6,
  scale = 1.5,
  brightness = 1,
  color1 = '#a8d0b7',
  color2 = '#315f50',
  noiseFrequency = 2.5,
  noiseAmplitude = 1,
  bandHeight = 0.54,
  bandSpread = 1,
  octaveDecay = 0.1,
  layerOffset = 0.8,
  colorSpeed = 1,
  enableMouseInteraction = true,
  mouseInfluence = 0.25,
}: SoftAuroraProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    let frame = 0;
    const mouse = new Float32Array([0.5, 0.5]);
    const targetMouse = new Float32Array([0.5, 0.5]);
    const resize = () => renderer.setSize(container.offsetWidth, container.offsetHeight);
    const handleMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetMouse[0] = (event.clientX - rect.left) / rect.width;
      targetMouse[1] = 1 - (event.clientY - rect.top) / rect.height;
    };
    const handleLeave = () => { targetMouse[0] = 0.5; targetMouse[1] = 0.5; };
    resize();
    const program = new Program(gl, { vertex: vertexShader, fragment: fragmentShader, uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height] },
      uSpeed: { value: speed }, uScale: { value: scale }, uBrightness: { value: brightness },
      uColor1: { value: hexToRgb(color1) }, uColor2: { value: hexToRgb(color2) },
      uNoiseFreq: { value: noiseFrequency }, uNoiseAmp: { value: noiseAmplitude },
      uBandHeight: { value: bandHeight }, uBandSpread: { value: bandSpread },
      uOctaveDecay: { value: octaveDecay }, uLayerOffset: { value: layerOffset },
      uColorSpeed: { value: colorSpeed }, uMouse: { value: mouse },
      uMouseInfluence: { value: mouseInfluence }, uEnableMouse: { value: enableMouseInteraction },
    } });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    const update = (time: number) => {
      frame = requestAnimationFrame(update);
      program.uniforms.uTime.value = time * 0.001;
      mouse[0] += (targetMouse[0] - mouse[0]) * 0.04;
      mouse[1] += (targetMouse[1] - mouse[1]) * 0.04;
      renderer.render({ scene: mesh });
    };
    window.addEventListener('resize', resize);
    if (enableMouseInteraction) {
      container.addEventListener('mousemove', handleMove);
      container.addEventListener('mouseleave', handleLeave);
    }
    container.appendChild(gl.canvas);
    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      if (enableMouseInteraction) {
        container.removeEventListener('mousemove', handleMove);
        container.removeEventListener('mouseleave', handleLeave);
      }
      if (gl.canvas.parentNode === container) container.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [bandHeight, bandSpread, brightness, color1, color2, colorSpeed, enableMouseInteraction, layerOffset, mouseInfluence, noiseAmplitude, noiseFrequency, octaveDecay, scale, speed]);

  return <div ref={containerRef} className="soft-aurora-container" aria-hidden="true" />;
}
