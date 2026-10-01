import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { IosSignalIcon, IosWifiIcon, IosBatteryIcon } from './IosIcons';

// Custom Wallpaper Presets (100% SVG/CSS Mesh Gradients - No copyrighted Apple assets)
export const WALLPAPER_PRESETS = {
  'aurora': {
    name: 'Aurora Neon',
    dark: 'radial-gradient(circle at 20% 20%, rgba(52, 199, 89, 0.4) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(10, 132, 255, 0.4) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(175, 82, 222, 0.35) 0%, transparent 60%), #060913',
    light: 'radial-gradient(circle at 20% 20%, rgba(52, 199, 89, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(10, 132, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(175, 82, 222, 0.25) 0%, transparent 60%), #E5E9F0'
  },
  'midnight': {
    name: 'Midnight Pro',
    dark: 'radial-gradient(circle at 50% 0%, rgba(88, 86, 214, 0.3) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(10, 132, 255, 0.2) 0%, transparent 50%), #040508',
    light: 'radial-gradient(circle at 50% 0%, rgba(88, 86, 214, 0.2) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(10, 132, 255, 0.15) 0%, transparent 50%), #EDEBF2'
  },
  'sunset': {
    name: 'Sunset Ember',
    dark: 'radial-gradient(circle at 80% 10%, rgba(255, 45, 85, 0.4) 0%, transparent 55%), radial-gradient(circle at 10% 90%, rgba(255, 149, 0, 0.35) 0%, transparent 55%), radial-gradient(circle at 50% 50%, rgba(175, 82, 222, 0.25) 0%, transparent 50%), #0D060D',
    light: 'radial-gradient(circle at 80% 10%, rgba(255, 45, 85, 0.25) 0%, transparent 55%), radial-gradient(circle at 10% 90%, rgba(255, 149, 0, 0.25) 0%, transparent 55%), #F5EAE8'
  },
  'deep-ocean': {
    name: 'Deep Ocean',
    dark: 'radial-gradient(circle at 10% 20%, rgba(48, 176, 199, 0.35) 0%, transparent 50%), radial-gradient(circle at 90% 70%, rgba(10, 132, 255, 0.4) 0%, transparent 60%), #020914',
    light: 'radial-gradient(circle at 10% 20%, rgba(48, 176, 199, 0.25) 0%, transparent 50%), radial-gradient(circle at 90% 70%, rgba(10, 132, 255, 0.25) 0%, transparent 60%), #E0F0F8'
  }
};

/**
 * Generic iOS-style app icon tile
 */
function AppIcon({ name, icon, bg, onClick, isTarget = false, badge = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        userSelect: 'none',
        outline: 'none',
        position: 'relative'
      }}
    >
      <div
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '14px',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25), inset 0 0 0 0.5px rgba(255, 255, 255, 0.25)',
          position: 'relative',
          transition: 'transform 0.15s ease',
          transform: isTarget ? 'scale(1.04)' : 'none'
        }}
      >
        {icon}
        {badge !== null && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '9px',
              backgroundColor: '#FF3B30',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              border: '1.5px solid #FFFFFF'
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: '11.5px',
          lineHeight: '14px',
          fontWeight: 500,
          letterSpacing: '-0.1px',
          color: '#FFFFFF',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          textAlign: 'center',
          maxWidth: '68px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {name}
      </span>
    </button>
  );
}

export const IosHomeScreen = memo(function IosHomeScreen({
  onLaunchApp,
  theme = 'dark',
  wallpaper = 'aurora',
  accentColor = '#0A84FF',
  campaignTitle = 'Lead Finder',
  discoveredCount = 0
}) {
  const isDark = theme !== 'light';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const d = useMemo(() => new Date(now), [now]);
  const timeString = useMemo(() => {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }, [d]);

  const dateString = useMemo(() => {
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }, [d]);

  const wpStyle = useMemo(() => {
    const preset = WALLPAPER_PRESETS[wallpaper] || WALLPAPER_PRESETS['aurora'];
    return isDark ? preset.dark : preset.light;
  }, [wallpaper, isDark]);

  const [activePage, setActivePage] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
  };

  const handlePointerMove = (e) => {
    if (!isDragging || dragStartRef.current === null) return;
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const diff = clientX - dragStartRef.current;
    setDragOffset(diff);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset < -50 && activePage < 2) {
      setActivePage((p) => Math.min(2, p + 1));
    } else if (dragOffset > 50 && activePage > 0) {
      setActivePage((p) => Math.max(0, p - 1));
    }
    setDragOffset(0);
    dragStartRef.current = null;
  };

  return (
    <div
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      style={{
        width: '440px',
        height: '956px',
        background: wpStyle,
        color: '#FFFFFF',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      {/* Status Bar (44px) */}
      <div
        style={{
          height: '44px',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 10
        }}
      >
        <span
          style={{
            fontSize: '17px',
            lineHeight: '22px',
            fontWeight: 600,
            letterSpacing: '-0.4px',
            fontVariantNumeric: 'tabular-nums',
            color: '#FFFFFF'
          }}
        >
          {timeString}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <IosSignalIcon color="#FFFFFF" size={17} />
          <IosWifiIcon color="#FFFFFF" size={16} />
          <IosBatteryIcon color="#FFFFFF" size={25} level={0.94} />
        </div>
      </div>

      {/* Big Date & Clock Widget (iOS 18 Header) */}
      <div
        style={{
          padding: '24px 28px 12px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          textShadow: '0 2px 10px rgba(0,0,0,0.5)'
        }}
      >
        <span
          style={{
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '-0.2px',
            textTransform: 'capitalize',
            opacity: 0.9
          }}
        >
          {dateString}
        </span>
        <span
          style={{
            fontSize: '64px',
            lineHeight: '70px',
            fontWeight: 700,
            letterSpacing: '-1.5px',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {timeString}
        </span>
      </div>

      {/* Pages Container with Horizontal Sliding */}
      <div
        style={{
          flex: 1,
          width: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '300%',
            height: '100%',
            transform: `translateX(calc(-${activePage * 33.3333}% + ${dragOffset}px))`,
            transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* ── Page 1: Main Apps ── */}
          <div
            style={{
              width: '440px',
              height: '100%',
              padding: '16px 28px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(4, auto)',
              gap: '20px 18px',
              alignContent: 'start',
              justifyItems: 'center',
              boxSizing: 'border-box'
            }}
          >
            {/* Row 1 */}
            <AppIcon
              name="Calendar"
              bg="linear-gradient(180deg, #FFFFFF 0%, #E5E5EA 100%)"
              icon={
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#FF3B30', textTransform: 'uppercase' }}>
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: '#000000', lineHeight: '20px' }}>
                    {d.getDate()}
                  </span>
                </div>
              }
            />

            <AppIcon
              name="Photos"
              bg="linear-gradient(180deg, #FFFFFF 0%, #F2F2F7 100%)"
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" fill="#FF9500" opacity="0.8" />
                  <circle cx="9" cy="10" r="5" fill="#FF2D55" opacity="0.8" />
                  <circle cx="15" cy="10" r="5" fill="#AF52DE" opacity="0.8" />
                  <circle cx="12" cy="15" r="5" fill="#34C759" opacity="0.8" />
                </svg>
              }
            />

            <AppIcon
              name="Camera"
              bg="linear-gradient(180deg, #8E8E93 0%, #636366 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M4 7H7L9 4H15L17 7H20C21.1 7 22 7.9 22 9V19C22 20.1 21.1 21 20 21H4C2.9 21 2 20.1 2 19V9C2 7.9 2.9 7 4 7Z" />
                  <circle cx="12" cy="14" r="4" fill="#636366" />
                </svg>
              }
            />

            <AppIcon
              name="Weather"
              bg="linear-gradient(180deg, #30B0C7 0%, #0A84FF 100%)"
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#FFFFFF">
                  <circle cx="12" cy="12" r="5" fill="#FFCC00" />
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" opacity="0.85" />
                </svg>
              }
            />

            {/* Row 2 */}
            <AppIcon
              name="Clock"
              bg="linear-gradient(180deg, #1C1C1E 0%, #000000 100%)"
              icon={
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid #FFFFFF', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '4px', left: '12px', width: '2px', height: '10px', backgroundColor: '#FFFFFF', borderRadius: '1px' }} />
                  <div style={{ position: 'absolute', top: '12px', left: '12px', width: '8px', height: '2px', backgroundColor: '#FF9500', borderRadius: '1px' }} />
                </div>
              }
            />

            <AppIcon
              name="Maps"
              bg="linear-gradient(180deg, #34C759 0%, #30B0C7 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              }
            />

            <AppIcon
              name="Notes"
              bg="linear-gradient(180deg, #FFD60A 0%, #FF9F0A 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              }
            />

            <AppIcon
              name="Reminders"
              bg="linear-gradient(180deg, #FFFFFF 0%, #F2F2F7 100%)"
              icon={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ width: '18px', height: '4px', borderRadius: '2px', backgroundColor: '#0A84FF' }} />
                  <div style={{ width: '18px', height: '4px', borderRadius: '2px', backgroundColor: '#34C759' }} />
                  <div style={{ width: '18px', height: '4px', borderRadius: '2px', backgroundColor: '#FF9F0A' }} />
                </div>
              }
            />

            {/* Row 3 */}
            <AppIcon
              name="Health"
              bg="linear-gradient(180deg, #FFFFFF 0%, #F2F2F7 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FF2D55">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              }
            />

            <AppIcon
              name="Files"
              bg="linear-gradient(180deg, #0A84FF 0%, #0062D2 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
              }
            />

            <AppIcon
              name="Settings"
              bg="linear-gradient(180deg, #8E8E93 0%, #48484A 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
              }
            />

            <AppIcon
              name="App Store"
              bg="linear-gradient(180deg, #0A84FF 0%, #0040DD 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M12 2L2 22h20L12 2zm0 6l5.5 11h-11L12 8z" />
                </svg>
              }
            />

            {/* Row 4 - Our Dedicated Lead Finder App Icon */}
            <AppIcon
              name={campaignTitle || 'Lead Finder'}
              bg={`linear-gradient(135deg, #10B981 0%, #059669 50%, #047857 100%)`}
              isTarget={true}
              badge={discoveredCount > 0 ? discoveredCount : null}
              onClick={onLaunchApp}
              icon={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" fill="none" opacity="0.4" />
                    <path d="M12 6v6l4 2" />
                    <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
                  </svg>
                </div>
              }
            />
          </div>

          {/* ── Page 2: Productivity & CRM ── */}
          <div
            style={{
              width: '440px',
              height: '100%',
              padding: '16px 28px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(4, auto)',
              gap: '20px 18px',
              alignContent: 'start',
              justifyItems: 'center',
              boxSizing: 'border-box'
            }}
          >
            <AppIcon
              name="Campaigns"
              bg="linear-gradient(180deg, #5856D6 0%, #3634A3 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              }
            />
            <AppIcon
              name="Audience"
              bg="linear-gradient(180deg, #FF9500 0%, #C93400 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              }
            />
            <AppIcon
              name="Analytics"
              bg="linear-gradient(180deg, #30B0C7 0%, #007A8D 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                </svg>
              }
            />
            <AppIcon
              name="Shield Pro"
              bg="linear-gradient(180deg, #10B981 0%, #065F46 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
              }
            />
          </div>

          {/* ── Page 3: Tools ── */}
          <div
            style={{
              width: '440px',
              height: '100%',
              padding: '16px 28px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(4, auto)',
              gap: '20px 18px',
              alignContent: 'start',
              justifyItems: 'center',
              boxSizing: 'border-box'
            }}
          >
            <AppIcon
              name="Calculator"
              bg="linear-gradient(180deg, #FF9500 0%, #E05300 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 3h4v2h-4V6zm0 4h4v2h-4v-2zm-6-4h4v2H7V6zm0 4h4v2H7v-2zm0 4h4v2H7v-2zm6 4h4v2h-4v-2zm-6 0h4v2H7v-2zm6-4h4v2h-4v-2z" />
                </svg>
              }
            />
            <AppIcon
              name="Podcasts"
              bg="linear-gradient(180deg, #AF52DE 0%, #702694 100%)"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2C6.48 2 2 6.48 2 12c0 2.85 1.2 5.41 3.12 7.23l1.43-1.43C4.94 16.32 4 14.28 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8c0 2.28-.94 4.32-2.55 5.8l1.43 1.43C20.8 17.41 22 14.85 22 12c0-5.52-4.48-10-10-10z" />
                </svg>
              }
            />
          </div>
        </div>
      </div>

      {/* Interactive Page Indicator Dots */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          padding: '8px 0',
          flexShrink: 0
        }}
      >
        {[0, 1, 2].map((idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActivePage(idx)}
            style={{
              width: activePage === idx ? '8px' : '6px',
              height: activePage === idx ? '8px' : '6px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              opacity: activePage === idx ? 1 : 0.35,
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            aria-label={`Go to page ${idx + 1}`}
          />
        ))}
      </div>

      {/* Glassmorphic Dock (4 Icons) */}
      <div
        style={{
          margin: '0 20px 20px 20px',
          padding: '12px 18px',
          borderRadius: '34px',
          background: 'rgba(255, 255, 255, 0.22)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '0.5px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          flexShrink: 0
        }}
      >
        {/* Dock 1: Phone */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '13px',
            background: 'linear-gradient(180deg, #34C759 0%, #248A3D 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </div>

        {/* Dock 2: Safari */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '13px',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #E5E5EA 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#0A84FF">
            <circle cx="12" cy="12" r="10" stroke="#0A84FF" strokeWidth="2" fill="none" />
            <polygon points="12,4 15,12 12,20 9,12" fill="#FF3B30" />
            <polygon points="12,4 12,20 9,12" fill="#0A84FF" />
          </svg>
        </div>

        {/* Dock 3: Messages */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '13px',
            background: 'linear-gradient(180deg, #34C759 0%, #28CD41 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </div>

        {/* Dock 4: Music */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '13px',
            background: 'linear-gradient(180deg, #FF2D55 0%, #D81B60 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
      </div>

      {/* Home Indicator */}
      <div
        style={{
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <div
          style={{
            width: '134px',
            height: '5px',
            borderRadius: '100px',
            backgroundColor: 'rgba(255, 255, 255, 0.65)'
          }}
        />
      </div>
    </div>
  );
});

export default IosHomeScreen;
