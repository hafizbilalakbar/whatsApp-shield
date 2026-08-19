import { useState, useEffect, useCallback, useRef } from 'react';

// Loads the connected session user's own avatar. Prefers the same-origin,
// authorized profile-picture endpoint (server-side cache + authorized session
// refresh) over the raw pps.whatsapp.net URL, whose signed media reference
// expires. Falls back to the recorded direct URL, then to initials via the
// caller's `showImage === false` branch. Never fetches private/restricted media.
//
// The mode ladder (proxy -> direct -> broken) is what makes the avatar appear
// automatically right after QR login, without a page refresh:
//   - The proxy request can legitimately race the freshly-paired WhatsApp
//     session on first login. When the proxy fails or is still pending while a
//     direct signed URL has arrived, we fall back to the direct URL instead of
//     waiting forever (this used to leave the header showing initials until a
//     manual refresh remounted the page).
//   - When the direct URL later expires/offlines, we fall back to the cached
//     proxy again.
//   - Fallback switches are bounded so two failing sources can never ping-pong.
export const useUserAvatar = (sessionUser) => {
  const digits = String(sessionUser?.number || '').replace(/\D/g, '');
  const proxyUrl = digits ? `/api/profile-picture?phone=${digits}` : null;
  const directUrl = sessionUser?.avatar || null;

  const [mode, setMode] = useState(() => (proxyUrl ? 'proxy' : directUrl ? 'direct' : 'none'));
  const [imgState, setImgState] = useState('loading'); // 'loading' | 'ok' | 'broken'
  const fallbackCountRef = useRef(0);

  // Reset whenever the session user changes (login / logout / switch sessions).
  // This is the single point that guarantees a previous session's avatar never
  // leaks into the new session's header/profile.
  useEffect(() => {
    fallbackCountRef.current = 0;
    setMode(proxyUrl ? 'proxy' : directUrl ? 'direct' : 'none');
    setImgState('loading');
  }, [proxyUrl, directUrl]);

  const src = mode === 'proxy' ? proxyUrl : mode === 'direct' ? directUrl : null;
  const showImage = !!src && imgState !== 'broken';

  const onLoad = useCallback(() => setImgState('ok'), []);

  const onError = useCallback(() => {
    if (fallbackCountRef.current >= 3) {
      setImgState('broken');
      return;
    }
    if (mode === 'proxy' && directUrl) {
      // Proxy failed (e.g. first request right after QR login raced the
      // backend). Fall back to the freshly-fetched signed URL immediately.
      fallbackCountRef.current += 1;
      setMode('direct');
      setImgState('loading');
    } else if (mode === 'direct' && proxyUrl) {
      // Signed URL expired / session offline — try the cached proxy endpoint.
      fallbackCountRef.current += 1;
      setMode('proxy');
      setImgState('loading');
    } else {
      setImgState('broken');
    }
  }, [mode, directUrl, proxyUrl]);

  // Bounded fallback: if the proxy request is still pending after a few seconds
  // and a direct URL is available (e.g. right after QR login), switch to the
  // direct URL instead of leaving the avatar stuck on initials indefinitely.
  useEffect(() => {
    if (mode !== 'proxy' || imgState !== 'loading' || !directUrl) return;
    const t = setTimeout(() => {
      fallbackCountRef.current += 1;
      setMode('direct');
      setImgState('loading');
    }, 6000);
    return () => clearTimeout(t);
  }, [mode, imgState, directUrl]);

  return { src, showImage, imgState, onLoad, onError };
};