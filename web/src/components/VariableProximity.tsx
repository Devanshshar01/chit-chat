import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import './VariableProximity.css';

type Falloff = 'linear' | 'exponential' | 'gaussian';
type Settings = Array<{ axis: string; fromValue: number; toValue: number }>;

interface VariableProximityProps {
  label?: string;
  fromFontVariationSettings?: string;
  toFontVariationSettings?: string;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  radius?: number;
  falloff?: Falloff;
  className?: string;
  onClick?: () => void;
}

function parseSettings(value: string): Settings {
  return value.split(',').map((setting) => {
    const [axis, rawValue] = setting.trim().split(/\s+/);
    const parsed = Number.parseFloat(rawValue);
    return { axis: axis.replace(/["']/g, ''), fromValue: parsed, toValue: parsed };
  });
}

function usePointerPosition(containerRef?: React.RefObject<HTMLDivElement | null>) {
  const position = useRef({ x: -1000, y: -1000 });
  useEffect(() => {
    const update = (clientX: number, clientY: number) => {
      const rect = containerRef?.current?.getBoundingClientRect();
      position.current = rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY };
    };
    const onMouseMove = (event: MouseEvent) => update(event.clientX, event.clientY);
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) update(touch.clientX, touch.clientY);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [containerRef]);
  return position;
}

export const VariableProximity = forwardRef<HTMLSpanElement, VariableProximityProps>(function VariableProximity({
  label = '',
  fromFontVariationSettings = "'wght' 400, 'opsz' 12",
  toFontVariationSettings = "'wght' 650, 'opsz' 48",
  containerRef,
  radius = 110,
  falloff = 'gaussian',
  className = '',
  onClick,
}, ref) {
  const letterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const pointer = usePointerPosition(containerRef);
  const settings = useMemo(() => {
    const from = parseSettings(fromFontVariationSettings);
    const to = parseSettings(toFontVariationSettings);
    return from.map((item) => ({ ...item, toValue: to.find((candidate) => candidate.axis === item.axis)?.fromValue ?? item.fromValue }));
  }, [fromFontVariationSettings, toFontVariationSettings]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const container = containerRef?.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const { x, y } = pointer.current;
        letterRefs.current.forEach((letter) => {
          if (!letter) return;
          const rect = letter.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2 - containerRect.left;
          const centerY = rect.top + rect.height / 2 - containerRect.top;
          const distance = Math.hypot(x - centerX, y - centerY);
          const normalized = Math.min(Math.max(1 - distance / radius, 0), 1);
          const influence = falloff === 'exponential' ? normalized ** 2 : falloff === 'gaussian' ? Math.exp(-((distance / (radius / 2)) ** 2) / 2) : normalized;
          const variation = settings.map(({ axis, fromValue, toValue }) => `'${axis}' ${fromValue + (toValue - fromValue) * influence}`).join(', ');
          letter.style.fontVariationSettings = variation;
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [containerRef, falloff, pointer, radius, settings]);

  let letterIndex = 0;
  return <span ref={ref} className={`variable-proximity ${className}`} onClick={onClick}>
    {label.split(' ').map((word, wordIndex) => <span key={`${word}-${wordIndex}`} className="variable-proximity__word">
      {word.split('').map((letter) => { const index = letterIndex++; return <motion.span key={index} ref={(element) => { letterRefs.current[index] = element; }} className="variable-proximity__letter" aria-hidden="true">{letter}</motion.span>; })}
      {wordIndex < label.split(' ').length - 1 && <span aria-hidden="true">&nbsp;</span>}
    </span>)}
    <span className="variable-proximity__sr-only">{label}</span>
  </span>;
});
