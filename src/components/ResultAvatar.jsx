import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, UserX, PhoneOff } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from './ui/Dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';

// Outcome cache for the same-origin, authorized profile-picture endpoint. Stops
// the same number from being re-requested dozens of times while paging or
// switching campaigns in one session. Only caches the outcome (picture exists or
// not), never any private content.
const PROXY_CACHE_TTL_MS = 10 * 60 * 1000;
const proxyOutcomeCache = new Map(); // phone -> { outcome: 'ok' | 'missing', at }

const getDigits = (result) =>
  String(result?.cleanNumber || result?.number || '').replace(/\D/g, '');

const getProxyUrl = (result) => {
  const digits = getDigits(result);
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

// Builds a stable key (empty string when no digits) for useEffect dependencies.
const proxyKey = (result) => getDigits(result) || '';

const ResultAvatar = ({ result, size = 32 }) => {
  const digits = getDigits(result);
  const proxyUrl = getProxyUrl(result);
  const directUrl = result?.avatar || null;

  // Only query the app's authorized endpoint when a picture was legitimately
  // recorded for this number (stored URL or explicit availability flag). This
  // respects the recorded state instead of issuing redundant lookups per row.
  const shouldUseProxy = !!digits && (!!directUrl || result?.profilePhotoAvailable === true);

  // Proxy-first: the endpoint serves cached bytes fast and refreshes from the
  // authorized session, avoiding expired/refused pps.whatsapp.net media URLs.
  const [stage, setStage] = useState(() => {
    if (!shouldUseProxy) return 'direct';
    return getCachedOutcome(digits) === 'missing' ? 'direct' : 'proxy';
  });
  const [imgState, setImgState] = useState('loading'); // 'loading' | 'ok' | 'broken'
  const lastKeyRef = useRef('');

  // Reset per result row so stale state never leaks across rows.
  useEffect(() => {
    const key = `${digits}|${result?.avatar || ''}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    setStage(!shouldUseProxy ? 'direct' : (getCachedOutcome(digits) === 'missing' ? 'direct' : 'proxy'));
    setImgState('loading');
  }, [digits, shouldUseProxy, result?.avatar]);

  const src = stage === 'proxy' ? proxyUrl : directUrl;
  const showImg = !!src && imgState !== 'broken';

  const handleError = useCallback(() => {
    if (stage === 'proxy') {
      if (digits) setCachedOutcome(digits, 'missing');
      // The recorded direct URL may still be inside its validity window — try it
      // once as a graceful fallback before giving up entirely.
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

  const fallback = () => {
    if (result?.exists) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="rounded-full bg-background border border-dashed border-border flex items-center justify-center text-text-muted cursor-default shrink-0"
              style={{ width: size, height: size }}
              aria-label="No profile photo"
            >
              <User size={size / 2.4} />
            </button>
          </TooltipTrigger>
          <TooltipContent>No Profile Photo</TooltipContent>
        </Tooltip>
      );
    }

    if (result?.isValidFormat) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="rounded-full bg-error/10 border border-error/30 flex items-center justify-center text-error cursor-default shrink-0"
              style={{ width: size, height: size }}
              aria-label="Not registered on WhatsApp"
            >
              <UserX size={size / 2.4} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Not Registered on WhatsApp</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center text-warning cursor-default shrink-0"
            style={{ width: size, height: size }}
            aria-label="Invalid number"
          >
            <PhoneOff size={size / 2.4} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Invalid Number</TooltipContent>
      </Tooltip>
    );
  };

  if (!showImg) return fallback();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="rounded-full overflow-hidden bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary hover:opacity-80 transition-opacity shrink-0 relative"
          style={{ width: size, height: size }}
          title="View profile picture"
          aria-label="View profile picture"
        >
          {imgState === 'loading' && (
            <span className="absolute inset-0 bg-surface animate-pulse" aria-hidden="true" />
          )}
          <img
            src={src}
            alt="Profile picture"
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
          />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm flex items-center justify-center bg-transparent border-none shadow-none">
        <img
          src={src}
          alt="Full profile picture"
          className="w-full h-auto rounded-xl shadow-2xl max-w-[300px]"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ResultAvatar;