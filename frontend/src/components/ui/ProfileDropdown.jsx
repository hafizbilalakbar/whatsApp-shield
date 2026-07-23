import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Sun, Moon, LogOut, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeProvider';
import { cn } from './cn';

const Avatar = ({ sessionUser, isLoggingOut }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const avatarSrc = sessionUser?.avatar;
  const showImage = avatarSrc && !imgError && !isLoggingOut;

  const initials = sessionUser?.name
    ? sessionUser.name.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border overflow-hidden shrink-0">
      {isLoggingOut ? (
        <div className="w-full h-full bg-primary/20 flex items-center justify-center">
          <Loader2 size={12} className="animate-spin text-primary" />
        </div>
      ) : showImage ? (
        <>
          {!imgLoaded && (
            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
              <span className="font-bold text-[10px] sm:text-xs text-primary">{initials}</span>
            </div>
          )}
          <img
            src={avatarSrc}
            alt="Avatar"
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-200",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        </>
      ) : (
        <div className="w-full h-full bg-primary/20 flex items-center justify-center">
          <span className="font-bold text-[10px] sm:text-xs text-primary">{initials}</span>
        </div>
      )}
    </div>
  );
};

export const ProfileDropdown = ({ sessionUser, dotState, logout, isLoggingOut }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const dotStyles = {
    'green-pulse': 'bg-success animate-pulse',
    'green': 'bg-success',
    'green-dim': 'bg-success opacity-50',
    'amber': 'bg-warning',
    'red': 'bg-error',
    'gray': 'bg-gray-400',
  };

  const connectionLabel = isLoggingOut ? 'Logging out...' : sessionUser?.name || 'Profile';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !isLoggingOut && setOpen(!open)}
        className="relative p-0.5 rounded-full transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary z-50 disabled:opacity-50 disabled:cursor-not-allowed"
        title={connectionLabel}
        disabled={isLoggingOut}
      >
        <div className="relative">
          <Avatar sessionUser={sessionUser} isLoggingOut={isLoggingOut} />
          {!isLoggingOut && (
            <span className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-surface",
              dotStyles[dotState] || 'bg-gray-400'
            )} />
          )}
        </div>
      </button>
      {open && !isLoggingOut && (
        <div className="absolute right-0 top-full mt-2 w-52 sm:w-56 bg-surface border border-border rounded-xl shadow-2xl z-[100] py-2 overflow-hidden animate-dropdown-in">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-text-primary truncate">{sessionUser?.name || 'User'}</p>
            <p className="text-xs text-text-muted truncate">{sessionUser?.number ? `+${sessionUser.number.replace(/\D/g, '')}` : ''}</p>
          </div>
          <button
            onClick={() => { navigate('/profile'); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-background transition-colors"
          >
            <User size={14} className="shrink-0 opacity-70" />
            My Profile
          </button>
          <button
            onClick={() => { toggleTheme(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-background transition-colors"
          >
            {theme === 'dark' ? <Sun size={14} className="shrink-0 opacity-70" /> : <Moon size={14} className="shrink-0 opacity-70" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <div className="border-t border-border my-1" />
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-error hover:bg-error/10 transition-colors"
          >
            <LogOut size={14} className="shrink-0" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
};
