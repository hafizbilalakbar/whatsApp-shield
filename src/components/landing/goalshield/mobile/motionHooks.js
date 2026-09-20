import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);

/** One-shot IntersectionObserver trigger (disconnects itself). */
export function useInView(amount = 0.3) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { threshold: amount },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount]);

  return [ref, inView];
}

/** Advances 0 -> count once `start` flips true; jumps to final when reduced. */
export function useSequence(count, { start, stepMs = 260, reduce = false } = {}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!start) return undefined;
    if (reduce) {
      setI(count);
      return undefined;
    }
    let n = 0;
    setI(0);
    const id = window.setInterval(() => {
      n += 1;
      setI(n);
      if (n >= count) window.clearInterval(id);
    }, stepMs);
    return () => window.clearInterval(id);
  }, [start, count, stepMs, reduce]);

  return i;
}

/** requestAnimationFrame count-up (avoids motion-value-as-child pitfalls). */
export function useCountUp(target, { start, duration = 1200, delay = 0, reduce = false } = {}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return undefined;
    if (reduce) {
      setValue(target);
      return undefined;
    }
    let raf = 0;
    let timer = 0;
    let t0 = 0;
    const tick = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / duration);
      setValue(Math.round(target * easeOutCubic(k)));
      if (k < 1) raf = window.requestAnimationFrame(tick);
    };
    timer = window.setTimeout(() => {
      raf = window.requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
    };
  }, [start, target, duration, delay, reduce]);

  return value;
}

/** Flips true once the one-shot demo has finished so idle loops can start. */
export function useSettled(inView, delayMs, reduce = false) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) {
      setSettled(true);
      return undefined;
    }
    const id = window.setTimeout(() => setSettled(true), delayMs);
    return () => window.clearTimeout(id);
  }, [inView, delayMs, reduce]);
  return settled;
}
