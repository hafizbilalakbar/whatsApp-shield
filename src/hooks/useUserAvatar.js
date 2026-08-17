import { useState, useEffect, useCallback } from 'react';

// Loads the connected session user's own avatar. Prefers the same-origin,
// authorized profile-picture endpoint (server-side cache + authorized session
// refresh) over the raw pps.whatsapp.net URL, whose signed media reference
// expires. Falls back to the recorded direct URL, then to initials via the
// caller's `showImage === false` branch. Never fetches private/restricted media.
export const useUserAvatar = (sessionUser) => {
  const digits = String(sessionUser?.number || '').replace(/\D/g, '');
  const proxyUrl = digits ? `/api/profile-picture?phone=${digits}` : null;
  const directUrl = sessionUser?.avatar || null;

  const [stage, setStage] = useState(proxyUrl ? 'proxy' : 'direct');
  const [imgState, setImgState] = useState('loading'); // 'loading' | 'ok' | 'broken'

  useEffect(() => {
    setStage(proxyUrl ? 'proxy' : 'direct');
    setImgState('loading');
  }, [proxyUrl, directUrl]);

  const src = stage === 'proxy' ? proxyUrl : directUrl;
  const showImage = !!src && imgState !== 'broken';

  const onLoad = useCallback(() => setImgState('ok'), []);

  const onError = useCallback(() => {
    if (stage === 'proxy' && directUrl) {
      setStage('direct');
      setImgState('loading');
    } else {
      setImgState('broken');
    }
  }, [stage, directUrl]);

  return { src, showImage, imgState, onLoad, onError };
};