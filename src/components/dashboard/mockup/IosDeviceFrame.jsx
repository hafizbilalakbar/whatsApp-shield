import React, { useState, useLayoutEffect, useRef, useMemo, memo } from 'react';
import { IosPhoneScreen } from './IosPhoneScreen';
import { IosHomeScreen } from './IosHomeScreen';

/**
 * Finish color profiles for Titanium Pro chassis
 */
export const FINISH_PROFILES = {
  'graphite': {
    name: 'Graphite',
    outerEdge: 'linear-gradient(145deg, #48494E 0%, #2A2B2E 35%, #18191B 100%)',
    innerBezel: '#0C0D0E',
    buttonColor: '#3A3B40',
    reflection: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 40%)'
  },
  'titanium-silver': {
    name: 'Titanium Silver',
    outerEdge: 'linear-gradient(145deg, #D6D6DC 0%, #8E8E93 40%, #5E5E62 100%)',
    innerBezel: '#0F1012',
    buttonColor: '#9A9AA0',
    reflection: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%)'
  },
  'deep-blue': {
    name: 'Deep Blue',
    outerEdge: 'linear-gradient(145deg, #3A4A6E 0%, #1E273A 40%, #101522 100%)',
    innerBezel: '#080B12',
    buttonColor: '#2D3B58',
    reflection: 'linear-gradient(135deg, rgba(160,195,255,0.25) 0%, rgba(255,255,255,0) 40%)'
  },
  'midnight-black': {
    name: 'Midnight Black',
    outerEdge: 'linear-gradient(145deg, #2A2B30 0%, #151619 40%, #08080A 100%)',
    innerBezel: '#000000',
    buttonColor: '#202126',
    reflection: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 35%)'
  },
  'arctic-white': {
    name: 'Arctic White',
    outerEdge: 'linear-gradient(145deg, #FFFFFF 0%, #E5E5EA 45%, #C7C7CC 100%)',
    innerBezel: '#18191B',
    buttonColor: '#D1D1D6',
    reflection: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 50%)'
  }
};

export const IosDeviceFrame = memo(function IosDeviceFrame({
  leads = [],
  scanState = 'IDLE',
  progressPercent = 0,
  totalToCheck = 0,
  checkedCount = 0,
  campaignTitle = 'Lead Finder',
  campaignConfig = {},
  theme = 'dark',
  finish = 'graphite',
  wallpaper = 'aurora',
  accentColor = '#0A84FF',
  intensity = 'balanced',
  viewMode = 'app', // 'app' | 'home'
  onLaunchApp,
  photoFilter = 'all',
  loadedPhotosSet = new Set(),
  onPhotoLoaded,
  scaleOverride = null,
  frameRef
}) {
  const safeLeads = useMemo(() => (Array.isArray(leads) ? leads.filter(Boolean) : []), [leads]);
  const safeLoadedPhotosSet = useMemo(
    () => (loadedPhotosSet instanceof Set ? loadedPhotosSet : new Set()),
    [loadedPhotosSet]
  );
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);

  // Exact fixed outer phone geometry
  const PHONE_W = 464;
  const PHONE_H = 980;

  // Auto-fit responsive scaling
  // The panel's open animation animates its size via a framer-motion transform
  // (scale spring), and getBoundingClientRect includes ancestor transforms.
  // Reading the layout box (offsetWidth/offsetHeight) keeps the measurement
  // stable during that animation. Degenerate sizes (not laid out / closed) are
  // ignored, preserving the last valid scale until the container is really sized.
  useLayoutEffect(() => {
    if (scaleOverride) {
      scaleRef.current = scaleOverride;
      setScale(scaleOverride);
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const recompute = () => {
      if (disposed) return;
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      if (!w || !h || w < 150 || h < 150) return;

      const padding = 16;
      const availW = w - padding;
      const availH = h - padding;
      if (availW < 50 || availH < 50) return;

      const fitted = Math.min(availW / PHONE_W, availH / PHONE_H);
      const next = Math.max(0.2, fitted);
      if (next !== scaleRef.current) {
        scaleRef.current = next;
        setScale(next);
      }
    };

    recompute();

    // Re-check after the open animation settles / layout finishes.
    const raf = requestAnimationFrame(() => requestAnimationFrame(recompute));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(recompute).catch(() => {});
    }

    const onAnimEnd = () => recompute();
    const panel = container.closest('#live-mobile-mockup-panel');
    panel?.addEventListener('transitionend', onAnimEnd);
    container.addEventListener('transitionend', onAnimEnd);
    container.addEventListener('animationend', onAnimEnd);
    const onLoad = () => recompute();
    window.addEventListener('load', onLoad);

    const observer = new ResizeObserver(recompute);
    observer.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      panel?.removeEventListener('transitionend', onAnimEnd);
      container.removeEventListener('transitionend', onAnimEnd);
      container.removeEventListener('animationend', onAnimEnd);
      window.removeEventListener('load', onLoad);
    };
  }, [scaleOverride]);

  const profile = FINISH_PROFILES[finish] || FINISH_PROFILES['graphite'];
  const isDark = theme !== 'light';

  // Animation intensity timings
  const animDuration = intensity === 'subtle' ? '250ms' : intensity === 'vivid' ? '450ms' : '350ms';
  const animEasing = intensity === 'vivid' ? 'cubic-bezier(0.34, 1.3, 0.64, 1)' : 'cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <div
      ref={containerRef}
      className="ios-device-container flex-1 w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{
        userSelect: 'none',
        minHeight: '320px'
      }}
    >
      {/* Scaled Wrapper: Scaled smoothly without reflowing contents */}
      <div
        style={{
          width: `${PHONE_W}px`,
          height: `${PHONE_H}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          flexShrink: 0
        }}
      >
        {/* Device Outer Frame */}
        <div
          ref={frameRef}
          className="ios-phone-chassis relative"
          style={{
            width: `${PHONE_W}px`,
            height: `${PHONE_H}px`,
            borderRadius: '62px',
            background: profile.outerEdge,
            padding: '3px',
            boxShadow: isDark
              ? [
                  '0 0 0 1px rgba(255,255,255,0.12)',
                  '0 0 0 2px rgba(0,0,0,0.6)',
                  '0 30px 90px rgba(0,0,0,0.85)',
                  '0 10px 30px rgba(0,0,0,0.5)'
                ].join(', ')
              : [
                  '0 0 0 1px rgba(0,0,0,0.15)',
                  '0 0 0 2px rgba(0,0,0,0.08)',
                  '0 30px 80px rgba(0,0,0,0.22)',
                  '0 10px 25px rgba(0,0,0,0.12)'
                ].join(', '),
            boxSizing: 'border-box'
          }}
        >
          {/* Side Buttons (Action, Volume Up, Volume Down, Power) */}
          {/* Left: Action button */}
          <div
            style={{
              position: 'absolute',
              left: '-4px',
              top: '140px',
              width: '4px',
              height: '32px',
              borderRadius: '2px 0 0 2px',
              background: profile.buttonColor,
              boxShadow: 'inset 1px 0 1px rgba(255,255,255,0.2)'
            }}
          />
          {/* Left: Volume Up */}
          <div
            style={{
              position: 'absolute',
              left: '-4px',
              top: '190px',
              width: '4px',
              height: '56px',
              borderRadius: '2px 0 0 2px',
              background: profile.buttonColor,
              boxShadow: 'inset 1px 0 1px rgba(255,255,255,0.2)'
            }}
          />
          {/* Left: Volume Down */}
          <div
            style={{
              position: 'absolute',
              left: '-4px',
              top: '260px',
              width: '4px',
              height: '56px',
              borderRadius: '2px 0 0 2px',
              background: profile.buttonColor,
              boxShadow: 'inset 1px 0 1px rgba(255,255,255,0.2)'
            }}
          />
          {/* Right: Power Button */}
          <div
            style={{
              position: 'absolute',
              right: '-4px',
              top: '210px',
              width: '4px',
              height: '84px',
              borderRadius: '0 2px 2px 0',
              background: profile.buttonColor,
              boxShadow: 'inset -1px 0 1px rgba(255,255,255,0.2)'
            }}
          />

          {/* Inner Black Bezel (~12px) with 55px Screen Radius */}
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '59px',
              backgroundColor: profile.innerBezel,
              padding: '9px',
              boxSizing: 'border-box',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Screen Viewport (Fixed 440 x 956 px) */}
            <div
              style={{
                width: '440px',
                height: '956px',
                borderRadius: '50px',
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: '#000000'
              }}
            >
              {/* Dynamic Island (Plain black pill 126x37, top 11px, NO text inside) */}
              <div
                className="dynamic-island"
                style={{
                  position: 'absolute',
                  top: '11px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '126px',
                  height: '37px',
                  borderRadius: '20px',
                  backgroundColor: '#000000',
                  zIndex: 40,
                  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  pointerEvents: 'none'
                }}
              >
                {/* Camera lens reflection dot */}
                <span
                  style={{
                    width: '11px',
                    height: '11px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #18223c 0%, #060911 80%)',
                    boxShadow: 'inset 0 0 2px rgba(255,255,255,0.3)',
                    marginLeft: 'auto'
                  }}
                />
              </div>

              {/* View 1: iOS Home Screen — static backdrop; the app zooms above it */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 20,
                  pointerEvents: viewMode === 'home' ? 'auto' : 'none'
                }}
              >
                <IosHomeScreen
                  onLaunchApp={onLaunchApp}
                  theme={theme}
                  wallpaper={wallpaper}
                  accentColor={accentColor}
                  campaignTitle={campaignTitle}
                  discoveredCount={safeLeads.length}
                />
              </div>

              {/* View 2: Lead Finder App Screen — opens/closes like an iOS app,
                  zooming in from / out to its home-screen icon. */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 30,
                  transformOrigin: '16% 55%',
                  transition: `opacity ${animDuration} ${animEasing}, transform ${animDuration} ${animEasing}`,
                  opacity: viewMode === 'app' ? 1 : 0,
                  transform: viewMode === 'app' ? 'scale(1)' : 'scale(0.15)',
                  pointerEvents: viewMode === 'app' ? 'auto' : 'none'
                }}
              >
                <IosPhoneScreen
                  leads={safeLeads}
                  scanState={scanState}
                  progressPercent={progressPercent}
                  totalToCheck={totalToCheck}
                  checkedCount={checkedCount}
                  campaignTitle={campaignTitle}
                  campaignConfig={campaignConfig}
                  theme={theme}
                  accentColor={accentColor}
                  intensity={intensity}
                  photoFilter={photoFilter}
                  loadedPhotosSet={safeLoadedPhotosSet}
                  onPhotoLoaded={onPhotoLoaded}
                />
              </div>

              {/* Home Indicator (134x5 rounded bar, 8px from bottom) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '134px',
                  height: '5px',
                  borderRadius: '100px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.4)',
                  zIndex: 35,
                  pointerEvents: 'none'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default IosDeviceFrame;
