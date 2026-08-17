import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings as SettingsIcon, LogOut, Loader2, ChevronRight } from 'lucide-react';
import { useUserAvatar } from '../../hooks/useUserAvatar';
import { cn } from './cn';

const Avatar = ({ sessionUser, isLoggingOut, size = 'sm' }) => {
  const { src, showImage: avatarOk, imgState, onLoad, onError } = useUserAvatar(sessionUser);
  const showImage = avatarOk && !isLoggingOut;
  const imgLoaded = imgState === 'ok';

  const initials = sessionUser?.name
    ? sessionUser.name.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className={cn(
      "relative rounded-full border border-border overflow-hidden shrink-0 bg-primary/15",
      size === 'lg' ? "w-12 h-12" : "w-7 h-7 sm:w-8 sm:h-8"
    )}>
      {isLoggingOut ? (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
          <Loader2 size={14} className="animate-spin text-primary" />
        </div>
      ) : showImage ? (
        <>
          {!imgLoaded && (
            <div className="absolute inset-0 bg-primary/15 flex items-center justify-center">
              <span className={cn("font-bold text-primary", size === 'lg' ? "text-sm" : "text-[10px] sm:text-xs")}>{initials}</span>
            </div>
          )}
          <img
            src={src}
            alt="Avatar"
            loading="lazy"
            decoding="async"
            onLoad={onLoad}
            onError={onError}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-200",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold text-primary", size === 'lg' ? "text-sm" : "text-[10px] sm:text-xs")}>{initials}</span>
        </div>
      )}
    </div>
  );
};

const menuItems = [
  { id: 'profile', label: 'Profile', description: 'Session, identity & stats', to: '/profile', icon: User },
  { id: 'settings', label: 'Settings', description: 'Appearance & platform settings', to: '/settings', icon: SettingsIcon },
];

export const ProfileDropdown = ({ sessionUser, dotState, logout, isLoggingOut }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const dotStyles = {
    'green-pulse': 'bg-success animate-pulse',
    'green': 'bg-success',
    'green-dim': 'bg-success opacity-50',
    'amber': 'bg-warning',
    'red': 'bg-error',
    'gray': 'bg-gray-400',
  };

  const connectionLabel = isLoggingOut ? 'Logging out...' : sessionUser?.name || 'Profile';
  const initials = sessionUser?.name
    ? sessionUser.name.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !isLoggingOut && setOpen(!open)}
        className="relative p-0.5 rounded-full transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
        title={connectionLabel}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isLoggingOut}
      >
        <Avatar sessionUser={sessionUser} isLoggingOut={isLoggingOut} />
        {!isLoggingOut && (
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-surface",
            dotStyles[dotState] || 'bg-gray-400'
          )} />
        )}
      </button>

      {open && !isLoggingOut && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 sm:w-64 bg-surface/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 z-[100] overflow-hidden animate-dropdown-in"
        >
          {/* Emerald top accent */}
          <div className="h-[3px] bg-gradient-to-r from-[#25D366] via-[#34D399] to-primary" aria-hidden="true" />

          {/* User card header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/60">
            <Avatar sessionUser={sessionUser} isLoggingOut={isLoggingOut} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary truncate">{sessionUser?.name || 'User'}</p>
              <p className="text-xs text-text-muted truncate font-mono">
                {sessionUser?.number ? `+${sessionUser.number.replace(/\D/g, '')}` : ''}
              </p>
            </div>
            <span className="relative flex h-2 w-2 shrink-0" title="Connected">
              <span className={cn("absolute inline-flex h-full w-full rounded-full", (dotStyles[dotState] || 'bg-gray-400').includes('animate-pulse') ? 'bg-success animate-ping opacity-75' : 'hidden')} />
              <span className={cn("relative inline-flex rounded-full h-2 w-2", dotStyles[dotState] || 'bg-gray-400')} />
            </span>
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            {menuItems.map((item, i) => (
              <button
                key={item.id}
                role="menuitem"
                onClick={() => { navigate(item.to); close(); }}
                className="dropdown-item-in w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-primary/[0.06] group transition-colors duration-150"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <span className="w-8 h-8 rounded-lg bg-background/70 border border-border/60 flex items-center justify-center shrink-0 text-text-secondary group-hover:text-primary group-hover:border-primary/30 transition-colors duration-150">
                  <item.icon size={15} />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block font-medium text-text-primary truncate">{item.label}</span>
                  <span className="block text-[11px] text-text-muted truncate">{item.description}</span>
                </span>
                <ChevronRight size={13} className="ml-auto shrink-0 text-text-muted opacity-40 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-150" />
              </button>
            ))}
          </div>

          <div className="border-t border-border/60 mx-3" />

          {/* Logout */}
          <div className="py-1.5">
            <button
              role="menuitem"
              onClick={() => { logout(); close(); }}
              className="dropdown-item-in w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error/10 group transition-colors duration-150"
              style={{ animationDelay: '110ms' }}
            >
              <span className="w-8 h-8 rounded-lg bg-error/10 border border-error/20 flex items-center justify-center shrink-0 text-error group-hover:bg-error/15 transition-colors duration-150">
                <LogOut size={15} />
              </span>
              <span className="min-w-0 text-left">
                <span className="block font-medium truncate">Logout</span>
                <span className="block text-[11px] text-text-muted truncate">Disconnect this session</span>
              </span>
            </button>
          </div>

          <div className="px-4 py-2 border-t border-border/60 bg-background/40">
            <p className="text-[10px] text-text-muted font-medium truncate" title={initials}>
              {sessionUser?.name ? `Signed in as ${sessionUser.name}` : 'Signed in'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
