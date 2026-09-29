import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number up to its target value.
 *
 * Honors `prefers-reduced-motion` by snapping straight to the final value, and
 * always lands exactly on `target` so totals never display a rounded-off value.
 */
export function useCountUp(target, { duration = 650, enabled = true } = {}) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const fromRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const numericTarget = Number(target) || 0;

    if (!enabled) {
      setValue(numericTarget);
      return undefined;
    }

    let cancelled = false;
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || numericTarget === value) {
      fromRef.current = numericTarget;
      setValue(numericTarget);
      return undefined;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now) => {
      if (cancelled) return;
      const progress = Math.min(1, (now - start) / duration);
      // easeOutCubic keeps the ramp fast at the start and settles gently.
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (numericTarget - from) * eased);
      setValue(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = numericTarget;
        setValue(numericTarget);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
    };
    // `value` is intentionally excluded: it is the animated output, not an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, enabled]);

  return value;
}

export default useCountUp;
