import { useState, useRef, useCallback } from 'react';

export const useLoadingState = (minDuration = 300) => {
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const startLoading = useCallback(() => {
    setLoading(true);
    return true;
  }, []);

  const stopLoading = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLoading(false);
    }, minDuration);
  }, [minDuration]);

  const withLoading = useCallback(async (fn) => {
    setLoading(true);
    try {
      const result = await fn();
      return result;
    } finally {
      setTimeout(() => setLoading(false), minDuration);
    }
  }, [minDuration]);

  return { loading, startLoading, stopLoading, withLoading };
};
