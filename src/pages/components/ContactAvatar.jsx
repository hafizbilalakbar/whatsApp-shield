import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../../components/ui/cn';

// Outcome cache for the same-origin, authorized profile-picture endpoint. Only
// caches whether a picture exists for a number — never any private content.
const PROXY_CACHE_TTL_MS = 10 * 60 * 1000;
const proxyOutcomeCache = new Map(); // phone -> { outcome: 'ok' | 'missing', at }

const getDigits = (contact) =>
  String(contact?.phone || contact?.number || '').replace(/\D/g, '');

const getProxyUrl = (contact) => {
  const digits = getDigits(contact);
  return digits ? `/api/profile-picture?phone=${digits}` : null;
};

const getCachedOutcome = (digits) => {
  const entry = proxyOutcomeCache.get(digits);
  if (entry && Date.now() - entry.at < PROXY_CACHE_TTL_MS) return entry.outcome;
  if (entry) proxyOutcomeCache.delete(digits);
  return null;
};

const setCachedOutcome = (digits, outcome) => {
  proxyOutcomeCache.set(digits, { outcome, at: Date.now() });
};

const ContactAvatar = ({ contact, status, size = 'sm' }) => {
  const sizeClasses = {
    'sm': 'w-10 h-10',
    'md': 'w-12 h-12',
    'lg': 'w-20 h-20',
  };

  const statusSizeClasses = {
    'sm': 'w-3 h-3 -bottom-0.5 -right-0.5',
    'md': 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
    'lg': 'w-4 h-4 -bottom-0.5 -right-0.5',
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-success';
      case 'ai_typing': return 'bg-success animate-pulse';
      case 'typing': return 'bg-warning animate-pulse';
      case 'away': return 'bg-warning';
      case 'busy': return 'bg-error';
      default: return 'bg-text-muted';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.replace(/[+]/g, '').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(-2).toUpperCase();
  };

  const digits = getDigits(contact);
  const proxyUrl = getProxyUrl(contact);
  const directUrl = contact?.avatar || null;

  // Only query the app's authorized endpoint when a picture was legitimately
  // recorded for this contact (stored URL or explicit availability flag). New
  // contacts with no recorded photo keep the initials avatar.
  const shouldUseProxy = !!digits && (!!directUrl || contact?.profilePhotoAvailable === true);

  const [stage, setStage] = useState(() => {
    if (!shouldUseProxy) return 'direct';
    return getCachedOutcome(digits) === 'missing' ? 'direct' : 'proxy';
  });
  const [imgState, setImgState] = useState('loading'); // 'loading' | 'ok' | 'broken'
  const lastKeyRef = useRef('');

  // Reset per contact so stale state never leaks across rows.
  useEffect(() => {
    const key = `${digits}|${contact?.avatar || ''}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    setStage(!shouldUseProxy ? 'direct' : (getCachedOutcome(digits) === 'missing' ? 'direct' : 'proxy'));
    setImgState('loading');
  }, [digits, shouldUseProxy, contact?.avatar]);

  const src = stage === 'proxy' ? proxyUrl : directUrl;
  const showImg = !!src && imgState !== 'broken';

  const handleError = useCallback(() => {
    if (stage === 'proxy') {
      if (digits) setCachedOutcome(digits, 'missing');
      if (directUrl) {
        setStage('direct');
        setImgState('loading');
      } else {
        setStage('broken');
        setImgState('broken');
      }
    } else {
      setImgState('broken');
    }
  }, [stage, digits, directUrl]);

  const handleLoad = useCallback(() => {
    if (stage === 'proxy' && digits) setCachedOutcome(digits, 'ok');
    setImgState('ok');
  }, [stage, digits]);

  return (
    <div className={cn("relative shrink-0", sizeClasses[size])}>
      {showImg ? (
        <div className="w-full h-full relative rounded-full overflow-hidden">
          {imgState === 'loading' && (
            <div className="absolute inset-0 bg-primary/10 animate-pulse rounded-full" aria-hidden="true" />
          )}
          <img
            src={src}
            alt={contact?.name}
            className="w-full h-full rounded-full object-cover border border-border"
            loading="lazy"
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
          />
        </div>
      ) : (
        <div className="w-full h-full rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
          {getInitials(contact?.name)}
        </div>
      )}
      {status && (
        <div className={cn("absolute rounded-full border-2 border-surface", statusSizeClasses[size], getStatusColor(status))} />
      )}
    </div>
  );
};

export { ContactAvatar };