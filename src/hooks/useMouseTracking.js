import { useState, useEffect, useCallback, useRef } from 'react';

export function useMouseTracking(containerRef) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const rafRef = useRef(null);
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const handleMouseMove = useCallback((e) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    });
  }, [containerRef]);

  useEffect(() => {
    if (isTouchDevice || !containerRef.current) return;
    const el = containerRef.current;
    el.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove, containerRef, isTouchDevice]);

  return { mousePos, isTouchDevice };
}
