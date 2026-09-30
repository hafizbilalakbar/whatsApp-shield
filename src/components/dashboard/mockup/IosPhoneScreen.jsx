import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SvgFlag, getCountryMetadata } from '../../ui/SvgFlag';
import { IosSignalIcon, IosWifiIcon, IosBatteryIcon, IosSpinner } from './IosIcons';
import { IosProgressRing } from './IosProgressRing';
import { IosLeadRow } from './IosLeadRow';

/**
 * Format elapsed milliseconds into HH:MM:SS or MM:SS
 */
function formatElapsed(ms) {
  if (!ms || ms < 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function IosPhoneScreen({
  leads = [],
  scanState = 'IDLE',
  progressPercent = 0,
  totalToCheck = 0,
  checkedCount = 0,
  campaignTitle = 'Lead Finder',
  campaignConfig = {},
  theme = 'dark',
  accentColor = '#0A84FF',
  intensity = 'balanced',
  screenRef
}) {
  const isDark = theme !== 'light';

  // Live real clock for status bar and relative time updates
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format status bar clock (e.g. 9:41 or 1:45)
  const timeString = useMemo(() => {
    const d = new Date(now);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }, [now]);

  // Scan state flags
  const isScanning = scanState === 'SCANNING' || scanState === 'STARTING' || scanState === 'RESUMING';
  const isPaused = scanState === 'PAUSED' || scanState === 'CONNECTIVITY_PAUSED';
  const isCompleted = scanState === 'COMPLETED';
  const isError = scanState === 'ERROR' || scanState === 'ANOMALY_STOP';

  // Elapsed scan timer (tracks live when scanning)
  const [elapsedMs, setElapsedMs] = useState(0);
  const scanStartRef = useRef(null);
  const pauseAccRef = useRef(0);
  const pauseStartRef = useRef(null);

  useEffect(() => {
    if (isScanning) {
      if (!scanStartRef.current) {
        scanStartRef.current = Date.now();
        pauseAccRef.current = 0;
      }
      if (pauseStartRef.current) {
        pauseAccRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
    } else if (isPaused) {
      if (!pauseStartRef.current) {
        pauseStartRef.current = Date.now();
      }
    } else if (scanState === 'IDLE') {
      scanStartRef.current = null;
      pauseAccRef.current = 0;
      pauseStartRef.current = null;
      setElapsedMs(0);
    }
  }, [isScanning, isPaused, scanState]);

  useEffect(() => {
    if (!isScanning || !scanStartRef.current) return;
    const interval = setInterval(() => {
      const pausedExtra = pauseStartRef.current ? Date.now() - pauseStartRef.current : 0;
      setElapsedMs(Math.max(0, Date.now() - scanStartRef.current - pauseAccRef.current - pausedExtra));
    }, 1000);
    return () => clearInterval(interval);
  }, [isScanning]);

  // Derive country, state, city (shown ONCE in header subtitle)
  const headerLocation = useMemo(() => {
    // 1. Check campaign config first
    let countryHint = campaignConfig?.country || campaignConfig?.countryIso || window.whatsappShieldCountryIso;
    let countryName = campaignConfig?.countryName || window.whatsappShieldCountryName;
    let regionName = campaignConfig?.regionName || campaignConfig?.region?.name || window.whatsappShieldRegion?.name;
    let cityName = campaignConfig?.city || campaignConfig?.cityName;

    // 2. Fallback to most common country code, city, and state in leads if not in campaign
    if (leads.length > 0) {
      if (!countryHint) {
        const counts = {};
        leads.forEach(l => {
          const c = l.detectedCountry || l.countryIso;
          if (c) counts[c] = (counts[c] || 0) + 1;
        });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (top) countryHint = top[0];
      }
      if (!cityName) {
        const cityCounts = {};
        leads.forEach(l => {
          if (l.city) cityCounts[l.city] = (cityCounts[l.city] || 0) + 1;
        });
        const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0];
        if (topCity) cityName = topCity[0];
      }
      if (!regionName) {
        const regionCounts = {};
        leads.forEach(l => {
          const r = l.state || l.region;
          if (r) regionCounts[r] = (regionCounts[r] || 0) + 1;
        });
        const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0];
        if (topRegion) regionName = topRegion[0];
      }
    }

    if (!countryHint) countryHint = 'US';

    const meta = getCountryMetadata(countryHint);
    const finalCountryName = countryName || meta.name;
    const finalDialCode = meta.dialCode;

    // Build subtitle location string
    const locParts = [];
    if (cityName) locParts.push(cityName);
    if (regionName && regionName !== cityName) locParts.push(regionName);

    const locSuffix = locParts.length > 0 ? ` - ${locParts.join(', ')}` : '';
    const fullSubtitle = `${finalCountryName} (${finalDialCode})${locSuffix}`;

    return {
      iso: meta.iso,
      subtitle: fullSubtitle
    };
  }, [campaignConfig, leads]);

  // Derived real campaign stats
  const registeredLeads = useMemo(() => leads.filter(l => l.exists === true), [leads]);
  const discoveredCount = registeredLeads.length;
  const businessCount = useMemo(() => leads.filter(l => l.isBusiness === true).length, [leads]);
  const remainingCount = totalToCheck > 0 ? Math.max(0, totalToCheck - checkedCount) : null;

  // Newest lead tracking for entrance animations
  const newestKey = leads.length > 0 ? (leads[0]?.cleanNumber || leads[0]?.number || '0') : null;

  // Theme color tokens
  const colors = {
    bg: isDark ? '#000000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    separator: isDark ? 'rgba(84, 84, 88, 0.45)' : 'rgba(60, 60, 67, 0.18)',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    textTertiary: isDark ? 'rgba(235, 235, 245, 0.38)' : 'rgba(60, 60, 67, 0.38)',
    cardBorder: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.05)',
    cardShadow: isDark
      ? '0 4px 16px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 4px 16px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
  };

  // Status pill config
  const statusPill = useMemo(() => {
    if (isScanning) {
      return {
        label: 'Scanning',
        bg: isDark ? 'rgba(52, 199, 89, 0.18)' : 'rgba(52, 199, 89, 0.14)',
        color: isDark ? '#34C759' : '#248A3D',
        dot: '#34C759',
        pulse: true
      };
    }
    if (isPaused) {
      return {
        label: 'Paused',
        bg: isDark ? 'rgba(255, 149, 0, 0.18)' : 'rgba(255, 149, 0, 0.14)',
        color: isDark ? '#FF9500' : '#C96E00',
        dot: '#FF9500',
        pulse: false
      };
    }
    if (isCompleted) {
      return {
        label: 'Completed',
        bg: isDark ? 'rgba(10, 132, 255, 0.18)' : 'rgba(10, 132, 255, 0.14)',
        color: isDark ? '#0A84FF' : '#0062D2',
        dot: '#0A84FF',
        pulse: false
      };
    }
    if (isError) {
      return {
        label: 'Error',
        bg: isDark ? 'rgba(255, 69, 58, 0.18)' : 'rgba(255, 69, 58, 0.14)',
        color: isDark ? '#FF453A' : '#D70015',
        dot: '#FF453A',
        pulse: false
      };
    }
    return {
      label: 'Ready',
      bg: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
      color: colors.textSecondary,
      dot: colors.textTertiary,
      pulse: false
    };
  }, [isScanning, isPaused, isCompleted, isError, isDark, colors]);

  return (
    <div
      ref={screenRef}
      className="ios-phone-screen select-none"
      style={{
        width: '440px',
        height: '956px',
        backgroundColor: colors.bg,
        color: colors.textPrimary,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: 'Inter, -apple-system, system-ui, sans-serif'
      }}
    >
      {/* ── 1. Status Bar (54px height) ── */}
      <div
        style={{
          height: '54px',
          padding: '14px 28px 0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 30
        }}
      >
        {/* Live Clock Time */}
        <span
          style={{
            fontSize: '17px',
            lineHeight: '22px',
            fontWeight: 600,
            letterSpacing: '-0.4px',
            fontVariantNumeric: 'tabular-nums',
            color: colors.textPrimary
          }}
        >
          {timeString}
        </span>

        {/* Signal, WiFi, Battery SVGs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <IosSignalIcon color={colors.textPrimary} size={17} />
          <IosWifiIcon color={colors.textPrimary} size={16} />
          <IosBatteryIcon color={colors.textPrimary} size={25} level={0.94} />
        </div>
      </div>

      {/* ── 2. Header (Large Title + Subtitle) ── */}
      <div
        style={{
          padding: '16px 20px 12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          flexShrink: 0
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '34px',
            lineHeight: '41px',
            fontWeight: 700,
            letterSpacing: '-0.4px',
            color: colors.textPrimary
          }}
        >
          {campaignTitle}
        </h1>

        {/* Subtitle line: Flag + Country (+Code) - City, State */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '15px',
            lineHeight: '20px',
            fontWeight: 400,
            letterSpacing: '-0.2px',
            color: colors.textSecondary
          }}
        >
          <SvgFlag code={headerLocation.iso} width={20} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {headerLocation.subtitle}
          </span>
        </div>
      </div>

      {/* ── 3. Scan Summary Card ── */}
      <div
        style={{
          margin: '0 16px 14px 16px',
          padding: '16px',
          backgroundColor: colors.card,
          borderRadius: '20px',
          border: colors.cardBorder,
          boxShadow: colors.cardShadow,
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          flexShrink: 0
        }}
      >
        {/* Animated Progress Ring */}
        <IosProgressRing
          percent={progressPercent}
          size={88}
          strokeWidth={8}
          accentColor={accentColor}
          isDark={isDark}
        />

        {/* Stats Column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Top Row: Status Pill + Live Elapsed Timer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            {/* Status Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                borderRadius: '12px',
                backgroundColor: statusPill.bg,
                color: statusPill.color,
                fontSize: '12px',
                lineHeight: '15px',
                fontWeight: 600,
                letterSpacing: '-0.1px'
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: statusPill.dot,
                  animation: statusPill.pulse ? 'iosPillPulse 1.5s ease-in-out infinite' : 'none'
                }}
              />
              {statusPill.label}
            </div>

            {/* Elapsed Timer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '4px',
                fontSize: '13px',
                fontVariantNumeric: 'tabular-nums',
                color: colors.textSecondary
              }}
            >
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Elapsed</span>
              <span style={{ fontWeight: 600, color: colors.textPrimary }}>{formatElapsed(elapsedMs)}</span>
            </div>
          </div>

          {/* 3 Real Stats: Discovered, Business, Remaining */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: remainingCount !== null ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
              gap: '6px',
              paddingTop: '4px',
              borderTop: `1px solid ${colors.separator}`
            }}
          >
            {/* Discovered */}
            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  lineHeight: '14px',
                  fontWeight: 500,
                  color: colors.textSecondary,
                  letterSpacing: '-0.1px'
                }}
              >
                Discovered
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '18px',
                  lineHeight: '22px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: isDark ? '#FFFFFF' : '#000000',
                  marginTop: '1px'
                }}
              >
                {discoveredCount}
              </span>
            </div>

            {/* Business */}
            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  lineHeight: '14px',
                  fontWeight: 500,
                  color: colors.textSecondary,
                  letterSpacing: '-0.1px'
                }}
              >
                Business
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '18px',
                  lineHeight: '22px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: accentColor,
                  marginTop: '1px'
                }}
              >
                {businessCount}
              </span>
            </div>

            {/* Remaining (if available) */}
            {remainingCount !== null && (
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    lineHeight: '14px',
                    fontWeight: 500,
                    color: colors.textSecondary,
                    letterSpacing: '-0.1px'
                  }}
                >
                  Remaining
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '18px',
                    lineHeight: '22px',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: colors.textSecondary,
                    marginTop: '1px'
                  }}
                >
                  {remainingCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Scanning State Calm Loader Banner (while scanning) ── */}
      {isScanning && (
        <div
          style={{
            margin: '0 16px 10px 16px',
            padding: '8px 14px',
            borderRadius: '12px',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
            border: colors.cardBorder,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IosSpinner size={14} color={accentColor} />
            <span
              style={{
                fontSize: '13px',
                lineHeight: '17px',
                fontWeight: 500,
                color: colors.textSecondary
              }}
            >
              Scanning numbers...
            </span>
          </div>
          {checkedCount > 0 && (
            <span
              style={{
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: colors.textPrimary
              }}
            >
              Checked {checkedCount.toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* ── 5. Section Header "Recent discoveries" ── */}
      <div
        style={{
          padding: '0 20px 6px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '13px',
              lineHeight: '18px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              color: colors.textSecondary
            }}
          >
            Recent discoveries
          </span>
          {isScanning && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#34C759',
                animation: 'iosPillPulse 1.2s ease-in-out infinite'
              }}
            />
          )}
        </div>
        {leads.length > 0 && (
          <span
            style={{
              fontSize: '13px',
              lineHeight: '18px',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              color: colors.textTertiary
            }}
          >
            {leads.length} found
          </span>
        )}
      </div>

      {/* ── 6. Inset Grouped Lead List (Fills screen down to home indicator) ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          margin: '0 16px 24px 16px',
          backgroundColor: colors.card,
          borderRadius: '20px',
          border: colors.cardBorder,
          boxShadow: colors.cardShadow,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {leads.length === 0 ? (
          /* Empty State */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '36px 20px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}
            >
              {isScanning ? (
                <IosSpinner size={22} color={accentColor} />
              ) : (
                <span style={{ fontSize: '20px', opacity: 0.5 }}>📱</span>
              )}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '16px',
                lineHeight: '21px',
                fontWeight: 600,
                color: colors.textPrimary
              }}
            >
              {isScanning ? 'Discovering leads...' : isCompleted ? 'Scan completed' : 'Ready to scan'}
            </p>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '13px',
                lineHeight: '18px',
                color: colors.textSecondary,
                maxWidth: '220px'
              }}
            >
              {isScanning
                ? 'Active WhatsApp numbers will appear here live as found.'
                : 'Start a scan in the dashboard to discover verified leads.'}
            </p>
          </div>
        ) : (
          /* Lead Rows with Inset Separators */
          leads.map((lead, idx) => {
            const key = lead.cleanNumber || lead.number || lead.jid || idx;
            const isFirst = idx === 0;
            return (
              <React.Fragment key={key}>
                <IosLeadRow
                  lead={lead}
                  isNewest={key === newestKey && isScanning}
                  isDark={isDark}
                  accentColor={accentColor}
                  intensity={intensity}
                  currentTime={now}
                />
                {idx < leads.length - 1 && (
                  <div
                    style={{
                      height: '1px',
                      marginLeft: '74px', // Inset separator aligned with text
                      backgroundColor: colors.separator
                    }}
                  />
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Bottom fade-out overlay for seamless list scrolling */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '16px',
          right: '16px',
          height: '28px',
          pointerEvents: 'none',
          borderRadius: '0 0 20px 20px',
          background: isDark
            ? 'linear-gradient(to top, rgba(28, 28, 30, 0.9) 0%, rgba(28, 28, 30, 0) 100%)'
            : 'linear-gradient(to top, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0) 100%)'
        }}
      />
    </div>
  );
}

export default IosPhoneScreen;
