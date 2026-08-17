import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from './cn';

// Minimum time the bar is visible so fast navigations still read as a smooth
// "complete" instead of a flash. Finished via scaleX transition (GPU friendly).
const MIN_ACTIVE_MS = 300;
const FINISH_MS = 220;

export const NavigationProgress = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'loading' | 'finishing'
  const prevPath = useRef(location.pathname);
  const mounted = useRef(false);
  const activeTimer = useRef(null);
  const finishTimer = useRef(null);
  const visibleRef = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    // Restart cleanly on every navigation — never leave a stale "finishing"
    // timer that could hide the bar mid-load or duplicate the animation.
    clearTimeout(activeTimer.current);
    clearTimeout(finishTimer.current);

    visibleRef.current = true;
    setVisible(true);
    setPhase('loading');

    activeTimer.current = setTimeout(() => {
      if (!visibleRef.current) return;
      setPhase('finishing');
      finishTimer.current = setTimeout(() => {
        if (!visibleRef.current) return;
        visibleRef.current = false;
        setVisible(false);
        setPhase('idle');
      }, FINISH_MS);
    }, MIN_ACTIVE_MS);

    return () => {
      clearTimeout(activeTimer.current);
      clearTimeout(finishTimer.current);
    };
  }, [location.pathname]);

  // If the component unmounts (app-level), drop any pending timers.
  useEffect(() => {
    return () => {
      clearTimeout(activeTimer.current);
      clearTimeout(finishTimer.current);
      visibleRef.current = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[110] h-[3px] pointer-events-none" aria-hidden="true">
      <div
        className={cn(
          "h-full w-full origin-left bg-gradient-to-r from-primary via-[#25D366] to-secondary shadow-[0_0_8px_rgba(0,217,126,0.5)]",
          phase === 'finishing' ? 'nav-progress-finish' : 'nav-progress-bar'
        )}
      />
    </div>
  );
};