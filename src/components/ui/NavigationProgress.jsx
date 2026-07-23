import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const MIN_DISPLAY_MS = 400;

export const NavigationProgress = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('idle');
  const prevPath = useRef(location.pathname);
  const mounted = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    if (timerRef.current) clearTimeout(timerRef.current);

    setPhase('loading');
    setVisible(true);

    timerRef.current = setTimeout(() => {
      setPhase('finishing');
      setTimeout(() => setVisible(false), 200);
    }, MIN_DISPLAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[110] h-[3px] pointer-events-none">
      <div
        className={`h-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_8px_rgba(0,217,126,0.5)] ${
          phase === 'finishing'
            ? 'w-full transition-all duration-200 ease-out'
            : 'nav-progress-bar'
        }`}
      />
    </div>
  );
};
