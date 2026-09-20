import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, UserX, PhoneOff } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from './ui/Dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';

// Outcome cache for the same-origin, authorized profile-picture endpoint.
// Short TTL to allow re-checking after transient failures (e.g. the scan's
// Baileys avatar lookup timed out but the public picture later becomes
// available via the authorized proxy). Only caches the outcome (picture
// exists or not), never any private content.
const PROXY_CACHE_TTL_MS = 60 * 1000; // 1 minute — allow re-checking quickly
const proxyOutcomeCache = new Map(); // phone -> { outcome: 'ok' | 'missing', at }

export const clearProxyOutcomeCache = () => proxyOutcomeCache.clear();

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

const ResultAvatar = ({ result, size = 32, loading = false }) => {
  const digits = getDigits(result);
  const proxyUrl = getProxyUrl(result);
  const directUrl = result?.avatar || null;

  // Only query the app's authorized endpoint when a picture was legitimately
  // recorded for this number (stored URL or explicit availability flag) OR the
  // number was confirmed registered on WhatsApp. The registered-numbers case is
  // important: a transient w:profile:picture timeout at scan time could have
  // prevented the avatar from being recorded, but the endpoint can still resolve
  // the public photo on-demand. The endpoint is gated to numbers this server has
  // actually worked with (campaigns/contacts), caches negative results, and has
  // its own rate limiter, so this never probes strangers and never hammers
  // WhatsApp.
  const shouldUseProxy = !!digits && (
    !!directUrl ||
    result?.profilePhotoAvailable === true ||
    result?.profilePhotoAvailable === null ||
    result?.exists === true
  );

  // Proxy-first: the endpoint serves cached bytes fast and refreshes from the
  // authorized session, avoiding expired/refused pps.whatsapp.net media URLs.
  const [stage, setStage] = useState(() => {
    if (!shouldUseProxy) return 'direct';
    return getCachedOutcome(digits) === 'missing' ? 'direct' : 'proxy';
  });
  const [imgState, setImgState] = useState('loading'); // 'loading' | 'ok' | 'broken'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastKeyRef = useRef('');

  // Reset per result row so stale state never leaks across rows.
  useEffect(() => {
    const key = `${digits}|${result?.avatar || ''}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    setStage(!shouldUseProxy ? 'direct' : (getCachedOutcome(digits) === 'missing' ? 'direct' : 'proxy'));
    setImgState('loading');
  }, [digits, shouldUseProxy, result?.avatar]);

  // Show subtle shimmer loading when external loading prop is true (filters/pagination changed)
  useEffect(() => {
    if (loading) {
      setIsRefreshing(true);
      const timer = setTimeout(() => setIsRefreshing(false), 800);
      return () => clearTimeout(timer);
    }
  }, [loading]);

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

  const showLoading = isRefreshing || imgState === 'loading';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="rounded-full overflow-hidden bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary hover:opacity-80 transition-opacity shrink-0 relative"
          style={{ width: size, height: size }}
          title="View profile picture"
          aria-label="View profile picture"
        >
          {showLoading && (
            <span className="absolute inset-0 bg-surface/70 animate-pulse" aria-hidden="true" />
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