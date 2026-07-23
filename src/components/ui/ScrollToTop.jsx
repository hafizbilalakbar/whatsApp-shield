import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ScrollToTop = () => {
  const { pathname } = useLocation();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, [pathname]);

  return null;
};
