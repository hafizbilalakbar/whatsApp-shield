import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'whatsapp-shield-theme';
const VALID = ['light', 'dark', 'system'];

const getSystemDark = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && VALID.includes(saved)) return saved;
    } catch { /* ignore */ }
    return 'system';
  });

  const [systemDark, setSystemDark] = useState(getSystemDark);
  const appliedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch { /* ignore */ }

    if (appliedRef.current) {
      const el = document.documentElement;
      el.classList.add('theme-transition');
      const t = setTimeout(() => el.classList.remove('theme-transition'), 450);
      return () => clearTimeout(t);
    }
    appliedRef.current = true;
  }, [theme, resolvedTheme]);

  const setTheme = useCallback((next) => {
    if (!VALID.includes(next)) return;
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme, toggleTheme }), [theme, resolvedTheme, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
