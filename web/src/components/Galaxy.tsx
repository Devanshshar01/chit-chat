import { Color, Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';
import './Galaxy.css';

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
uniform vec2 uFocal;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uGlowIntensity;
uniform float uSaturation;
uniform bool uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;

varying vec2 vUv;
#define NUM_LAYER 4.0
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tri(float x) { return abs(fract(x) * 2.0 - 1.0); }
float tris(float x) { float t = fract(x); return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0)); }
float trisn(float x) { return 2.0 * tris(x) - 1.0; }
vec3 hsv2rgb(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }

float star(vec2 uv, float flare) {
  float d = length(uv);
  float glow = (0.05 * uGlowIntensity) / max(d, 0.001);
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  glow += rays * flare * uGlowIntensity;
  uv *= MAT45;
  glow += smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0)) * 0.3 * flare * uGlowIntensity;
  return glow * smoothstep(1.0, 0.2, d);
}

vec3 starLayer(vec2 uv) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 cell = id + vec2(float(x), float(y));
    float seed = hash21(cell);
    float size = fract(seed * 345.32);
    float gloss = tri(uStarSpeed / (3.0 * seed + 1.0));
    float flare = smoothstep(0.9, 1.0, size) * gloss;
    float red = smoothstep(0.2, 1.0, hash21(cell + 1.0)) + 0.2;
    float blue = smoothstep(0.2, 1.0, hash21(cell + 3.0)) + 0.2;
    float green = min(red, blue) * seed;
    vec3 base = vec3(red, green, blue);
    float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
    float value = max(max(base.r, base.g), base.b);
    base = hsv2rgb(vec3(fract(hue + uHueShift / 360.0), uSaturation * 0.35, value));
    vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;
    float light = star(gv - vec2(float(x), float(y)) - pad, flare);
    float twinkle = mix(1.0, trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0, uTwinkleIntensity);
    col += light * size * twinkle * base;
  }
  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution.xy;
  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;
  vec2 mouseUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
  if (uMouseRepulsion) { vec2 delta = uv - mouseUV; uv += normalize(delta + 0.001) * (uRepulsionStrength / (length(delta) + 0.1)) * 0.05 * uMouseActiveFactor; }
  else { uv += (uMouse - vec2(0.5)) * 0.1 * uMouseActiveFactor; }
  float angle = uTime * uRotationSpeed;
  uv = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * uv;
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) { float depth = fract(i + uStarSpeed * uSpeed); float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth); col += starLayer(uv * scale + i * 453.32) * depth * smoothstep(1.0, 0.9, depth); }
  float alpha = smoothstep(0.0, 0.3, length(col));
  gl_FragColor = vec4(col, min(alpha, 0.82));
}
`;

interface GalaxyProps {
  focal?: [number, number];
  starSpeed?: number;
  density?: number;
  hueShift?: number;
  disableAnimation?: boolean;
  speed?: number;
  mouseInteraction?: boolean;
  glowIntensity?: number;
  saturation?: number;
  mouseRepulsion?: boolean;
  twinkleIntensity?: number;
  rotationSpeed?: number;
  repulsionStrength?: number;
}

export function Galaxy({ focal = [0.5, 0.5], starSpeed = 0.5, density = 1, hueShift = 140, disableAnimation = false, speed = 1, mouseInteraction = true, glowIntensity = 0.3, saturation = 0, mouseRepulsion = true, twinkleIntensity = 0.3, rotationSpeed = 0.1, repulsionStrength = 2 }: GalaxyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetMouse = useRef({ x: 0.5, y: 0.5 });
  const smoothMouse = useRef({ x: 0.5, y: 0.5 });
  const active = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
    const gl = renderer.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    let frame = 0;
    const resize = () => renderer.setSize(container.offsetWidth, container.offsetHeight);
    resize();
    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex: vertexShader, fragment: fragmentShader, uniforms: {
      uTime: { value: 0 }, uResolution: { value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height) }, uFocal: { value: new Float32Array(focal) }, uStarSpeed: { value: starSpeed }, uDensity: { value: density }, uHueShift: { value: hueShift }, uSpeed: { value: speed }, uMouse: { value: new Float32Array([0.5, 0.5]) }, uGlowIntensity: { value: glowIntensity }, uSaturation: { value: saturation }, uMouseRepulsion: { value: mouseRepulsion }, uTwinkleIntensity: { value: twinkleIntensity }, uRotationSpeed: { value: rotationSpeed }, uRepulsionStrength: { value: repulsionStrength }, uMouseActiveFactor: { value: 0 }, uAutoCenterRepulsion: { value: 0 },
    } });
    const mesh = new Mesh(gl, { geometry, program });
    const update = (time: number) => {
      frame = requestAnimationFrame(update);
      if (!disableAnimation) program.uniforms.uTime.value = time * 0.001;
      smoothMouse.current.x += (targetMouse.current.x - smoothMouse.current.x) * 0.05;
      smoothMouse.current.y += (targetMouse.current.y - smoothMouse.current.y) * 0.05;
      program.uniforms.uMouse.value[0] = smoothMouse.current.x;
      program.uniforms.uMouse.value[1] = smoothMouse.current.y;
      program.uniforms.uMouseActiveFactor.value += (active.current - program.uniforms.uMouseActiveFactor.value) * 0.05;
      renderer.render({ scene: mesh });
    };
    const handleMove = (event: MouseEvent) => { const rect = container.getBoundingClientRect(); targetMouse.current = { x: (event.clientX - rect.left) / rect.width, y: 1 - (event.clientY - rect.top) / rect.height }; active.current = 1; };
    const handleLeave = () => { active.current = 0; };
    window.addEventListener('resize', resize);
    if (mouseInteraction) { container.addEventListener('mousemove', handleMove); container.addEventListener('mouseleave', handleLeave); }
    container.appendChild(gl.canvas);
    frame = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); if (mouseInteraction) { container.removeEventListener('mousemove', handleMove); container.removeEventListener('mouseleave', handleLeave); } if (gl.canvas.parentNode === container) container.removeChild(gl.canvas); gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, [density, disableAnimation, focal, glowIntensity, hueShift, mouseInteraction, mouseRepulsion, repulsionStrength, rotationSpeed, saturation, speed, starSpeed, twinkleIntensity]);

  return <div ref={containerRef} className="galaxy-container" aria-hidden="true" />;
}
