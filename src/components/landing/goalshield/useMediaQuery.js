import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport is at least `min` px wide.
 * Uses matchMedia and re-evaluates on resize so the desktop (pinned)
 * and mobile/tablet (cards) branches never fight for hooks.
 */
export function useMinWidth(min) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return window.matchMedia(`(min-width: ${min}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = `(min-width: ${min}px)`;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [min]);

  return matches;
}
