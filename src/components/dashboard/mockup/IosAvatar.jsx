import React, { useState, useEffect, memo } from 'react';

/**
 * Standard Apple iOS Contacts Silhouette SVG
 */
export function IosSilhouetteIcon({ isDark = true, size = 48 }) {
  const iconSize = Math.round(size * 0.58);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: isDark
          ? 'linear-gradient(180deg, #3A3A3C 0%, #242426 100%)'
          : 'linear-gradient(180deg, #D1D1D6 0%, #AEAEB2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: isDark
          ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.3)'
          : 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 3px rgba(0,0,0,0.1)',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
      }}
      aria-hidden="true"
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        style={{
          color: isDark ? 'rgba(235, 235, 245, 0.65)' : 'rgba(60, 60, 67, 0.65)'
        }}
      >
        {/* Head */}
        <circle cx="12" cy="7.5" r="4" fill="currentColor" />
        {/* Torso */}
        <path
          d="M4.5 19.5C4.5 15.634 7.858 12.5 12 12.5C16.142 12.5 19.5 15.634 19.5 19.5C19.5 19.8 19.3 20 19 20H5C4.7 20 4.5 19.8 4.5 19.5Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

/**
 * Robust iOS Avatar with 1.5s decode timeout, crossOrigin="anonymous" canvas safety,
 * and standard iOS Contact Silhouette fallback.
 */
export const IosAvatar = memo(function IosAvatar({
  src,
  alt = '',
  size = 48,
  isDark = true,
  onLoaded
}) {
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'loaded' | 'error'

  useEffect(() => {
    if (!src) {
      setLoadState('error');
      if (onLoaded) onLoaded(false);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    // 1.5s timeout for fast decoding without stalling animation
    const timer = setTimeout(() => {
      if (isMounted && loadState !== 'loaded') {
        setLoadState('error');
        if (onLoaded) onLoaded(false);
      }
    }, 1500);

    const handleSuccess = () => {
      if (!isMounted) return;
      clearTimeout(timer);
      setLoadState('loaded');
      if (onLoaded) onLoaded(true);
    };

    const handleError = () => {
      if (!isMounted) return;
      clearTimeout(timer);
      setLoadState('error');
      if (onLoaded) onLoaded(false);
    };

    if (img.decode) {
      img
        .decode()
        .then(handleSuccess)
        .catch(() => {
          // If decode fails, fallback to standard onload/onerror
          img.onload = handleSuccess;
          img.onerror = handleError;
        });
    } else {
      img.onload = handleSuccess;
      img.onerror = handleError;
    }

    return () => {
      isMounted = false;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  if (loadState !== 'loaded' || !src) {
    return <IosSilhouetteIcon isDark={isDark} size={size} />;
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: isDark
          ? '0 2px 6px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.12)'
          : '0 2px 6px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.08)',
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)'
      }}
    >
      <img
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block'
        }}
      />
    </div>
  );
});

export default IosAvatar;
