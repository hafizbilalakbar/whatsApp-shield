import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SvgFlag, getCountryMetadata } from '../../ui/SvgFlag';
import { IosSignalIcon, IosWifiIcon, IosBatteryIcon, IosSpinner } from './IosIcons';
import { IosProgressRing } from './IosProgressRing';
import { IosLeadRow } from './IosLeadRow';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import {
  detectLeadLocation,
  subscribeGeocodesLoaded,
  preloadCallingCodeGeocodes
} from '../../../utils/geoLookup';

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
  photoFilter = 'all',
  loadedPhotosSet = new Set(),
  onPhotoLoaded,
  screenRef
}) {
  const isDark = theme !== 'light';

  // Live clock for status bar and date line
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

  // Format header date line (e.g. "Thursday, 1 October") - TASK 1
  const dateLineString = useMemo(() => {
    const d = new Date(now);
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }, [now]);

  // Re-render subscription when lazy geocode chunks finish loading
  const [, setGeoRevision] = useState(0);
  useEffect(() => {
    return subscribeGeocodesLoaded(() => {
      setGeoRevision((r) => r + 1);
    });
  }, []);

  // Preload calling code geocodes for active leads in background
  useEffect(() => {
    const callingCodes = new Set();
    leads.forEach((l) => {
      const raw = String(l.number || l.phone || l.cleanNumber || '');
      const parsed = parsePhoneNumberFromString(raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`);
      if (parsed && parsed.countryCallingCode) {
        callingCodes.add(parsed.countryCallingCode);
      }
    });
    preloadCallingCodeGeocodes(Array.from(callingCodes));
  }, [leads]);

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

  // Dynamic Header Subtitle Computation
  const headerLocation = useMemo(() => {
    // 1. Check explicit campaign config
    const cfgCountryIso = campaignConfig?.country || campaignConfig?.countryIso || (typeof window !== 'undefined' ? window.whatsappShieldCountryIso : null);
    const cfgCountryName = campaignConfig?.countryName || (typeof window !== 'undefined' ? window.whatsappShieldCountryName : null);
    const isExplicitRegion = typeof window !== 'undefined' && window.whatsappShieldAudienceType === 'region' && window.whatsappShieldRegion?.name;
    const cfgRegionName = campaignConfig?.regionName || campaignConfig?.region?.name || (isExplicitRegion ? window.whatsappShieldRegion.name : null);
    const cfgCityName = campaignConfig?.city || campaignConfig?.cityName;

    if (cfgRegionName || cfgCityName) {
      const meta = getCountryMetadata(cfgCountryIso || 'US');
      const finalCountryName = cfgCountryName || meta.name;
      const locParts = [];
      if (cfgCityName) locParts.push(cfgCityName);
      if (cfgRegionName && cfgRegionName !== cfgCityName) locParts.push(cfgRegionName);
      const locSuffix = locParts.length > 0 ? ` - ${locParts.join(', ')}` : '';
      return {
        iso: meta.iso,
        subtitle: `${finalCountryName} (${meta.dialCode})${locSuffix}`
      };
    }

    // 2. If no leads in the list
    if (!leads || leads.length === 0) {
      const meta = getCountryMetadata(cfgCountryIso || 'US');
      return {
        iso: meta.iso,
        subtitle: `${cfgCountryName || meta.name} (${meta.dialCode})`
      };
    }

    // 3. Inspect all leads in the list
    const distinctCountries = new Set();
    const distinctLocations = new Set();

    for (const lead of leads) {
      const raw = String(lead.number || lead.phone || lead.cleanNumber || '').trim();
      const full = raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
      const parsed = parsePhoneNumberFromString(full, lead.detectedCountry || lead.countryCode || undefined);
      
      if (parsed && parsed.country) {
        distinctCountries.add(parsed.country);
      } else if (lead.detectedCountry) {
        distinctCountries.add(lead.detectedCountry);
      }

      const loc = detectLeadLocation(lead);
      if (loc) {
        distinctLocations.add(loc);
      }
    }

    // Multiple distinct countries -> "Multiple countries" (no flag)
    if (distinctCountries.size > 1) {
      return {
        iso: null,
        subtitle: 'Multiple countries'
      };
    }

    // Single country
    const singleIso = Array.from(distinctCountries)[0] || cfgCountryIso || 'US';
    const meta = getCountryMetadata(singleIso);
    const countryName = cfgCountryName || meta.name;
    const dialCode = meta.dialCode;
    const locList = Array.from(distinctLocations);

    // No location data
    if (locList.length === 0) {
      return {
        iso: meta.iso,
        subtitle: `${countryName} (${dialCode})`
      };
    }

    // One state / region
    if (locList.length === 1) {
      return {
        iso: meta.iso,
        subtitle: `${countryName} (${dialCode}) - ${locList[0]}`
      };
    }

    // Two states
    if (locList.length === 2) {
      const clean1 = locList[0].includes(',') ? locList[0].split(',')[1].trim() : locList[0];
      const clean2 = locList[1].includes(',') ? locList[1].split(',')[1].trim() : locList[1];
      const stateSubtitle = clean1 === clean2 ? clean1 : `${clean1}, ${clean2}`;
      return {
        iso: meta.iso,
        subtitle: `${countryName} (${dialCode}) - ${stateSubtitle}`
      };
    }

    // Three or more states
    const stateNames = new Set(locList.map((loc) => (loc.includes(',') ? loc.split(',')[1].trim() : loc)));
    const count = stateNames.size;
    return {
      iso: meta.iso,
      subtitle: `${countryName} (${dialCode}) - ${count} states`
    };
  }, [campaignConfig, leads]);

  // Derived real campaign stats
  const registeredLeads = useMemo(() => leads.filter((l) => l.exists === true), [leads]);
  const discoveredCount = registeredLeads.length;
  const businessCount = useMemo(() => leads.filter((l) => l.isBusiness === true).length, [leads]);
  const remainingCount = totalToCheck > 0 ? Math.max(0, totalToCheck - checkedCount) : null;

  // Step 4: Robust Progress % calculation - scanned / total; if scanned > 0 show at least 1% (Math.ceil for < 1)
  const effectiveProgressPercent = useMemo(() => {
    if (progressPercent > 0) return progressPercent;
    if (totalToCheck > 0 && checkedCount > 0) {
      const raw = (checkedCount / totalToCheck) * 100;
      return raw > 0 && raw < 1 ? Math.ceil(raw) : Math.min(100, Math.round(raw));
    }
    if (totalToCheck > 0 && leads.length > 0) {
      const raw = (leads.length / totalToCheck) * 100;
      return raw > 0 && raw < 1 ? Math.ceil(raw) : Math.min(100, Math.round(raw));
    }
    return 0;
  }, [progressPercent, totalToCheck, checkedCount, leads.length]);

  // Task 2: Filter leads by loaded photos if "photos" filter is active
  const displayedLeads = useMemo(() => {
    if (photoFilter === 'photos') {
      return leads.filter((lead) => {
        const id = lead.cleanNumber || lead.number;
        return loadedPhotosSet.has(id);
      });
    }
    return leads;
  }, [leads, photoFilter, loadedPhotosSet]);

  // Theme color tokens
  const colors = {
    bg: isDark ? '#000000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    separator: isDark ? 'rgba(84, 84, 88, 0.45)' : 'rgba(60, 60, 67, 0.18)',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.65)',
    textMuted: isDark ? 'rgba(235, 235, 245, 0.35)' : 'rgba(60, 60, 67, 0.4)',
    accent: accentColor,
    success: '#34C759',
    warning: '#FF9F0A',
    danger: '#FF453A'
  };

  return (
    <div
      ref={screenRef}
      className="ios-phone-screen"
      style={{
        width: '440px',
        height: '956px',
        backgroundColor: colors.bg,
        color: colors.textPrimary,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      {/* ── 1. iOS Status Bar (44px) ── */}
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

      {/* ── 2. Header (Date Line + Large Title + Dynamic Subtitle) ── */}
      <div
        style={{
          padding: '12px 20px 10px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          flexShrink: 0
        }}
      >
        {/* Task 1: Date above large title */}
        <span
          style={{
            fontSize: '13px',
            lineHeight: '18px',
            fontWeight: 500,
            color: colors.textSecondary,
            textTransform: 'capitalize',
            letterSpacing: '-0.1px'
          }}
        >
          {dateLineString}
        </span>

        {/* 34px Main Title */}
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
            color: colors.textSecondary,
            minWidth: 0
          }}
        >
          {headerLocation.iso && <SvgFlag code={headerLocation.iso} width={20} className="shrink-0" />}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1
            }}
          >
            {headerLocation.subtitle}
          </span>
        </div>
      </div>

      {/* ── 3. Scan Summary Card (Approved iOS Design - Fixed 440x956 Dimensions) ──
          Class structure documentation to prevent style regressions:
          - .ios-summary-card: container #1C1C1E, radius 20px, padding 16px, gap 16px
          - .ios-summary-progress-ring: 76px diameter, 6px stroke, 20px 700 %, 10px 600 SCANNED
          - .ios-summary-right: flex 1, min-w-0
          - .ios-summary-row-top: flex between, status pill (24px h, radius 12px) + ELAPSED timer
          - .ios-summary-divider: 1px rgba(84,84,88,.6), margin 10px 0
          - .ios-summary-stats-grid: grid 3 x 1fr, label top (12px 500), number bottom (22px 700)
      */}
      <div
        className="ios-summary-card"
        style={{
          margin: '0 16px 14px 16px',
          padding: '16px',
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          borderRadius: '20px',
          boxShadow: isDark
            ? '0 4px 20px rgba(0, 0, 0, 0.5), inset 0 0 0 0.5px rgba(255, 255, 255, 0.1)'
            : '0 2px 10px rgba(0, 0, 0, 0.04), 0 0 0 0.5px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexShrink: 0,
          boxSizing: 'border-box'
        }}
      >
        {/* LEFT: 76px Progress Ring with 6px stroke, 20px 700 %, 10px 600 SCANNED */}
        <IosProgressRing
          percent={effectiveProgressPercent}
          size={76}
          strokeWidth={6}
          accentColor={accentColor}
          isDark={isDark}
        />

        {/* RIGHT: flex: 1, min-width: 0, two rows separated by 1px divider */}
        <div
          className="ios-summary-right"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          {/* Row 1: Status Pill (Left) + ELAPSED Timer (Right) */}
          <div
            className="ios-summary-row-top"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              minWidth: 0
            }}
          >
            {/* Status Pill (height 24px, padding 0 10px, radius 12px, 13px 600) */}
            <div
              className="ios-status-pill"
              style={{
                height: '24px',
                padding: '0 10px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                lineHeight: '16px',
                fontWeight: 600,
                backgroundColor: isScanning
                  ? 'rgba(52, 199, 89, 0.15)'
                  : isPaused
                  ? 'rgba(255, 159, 10, 0.15)'
                  : isCompleted
                  ? 'rgba(10, 132, 255, 0.15)'
                  : isError
                  ? 'rgba(255, 69, 58, 0.15)'
                  : 'rgba(142, 142, 147, 0.15)',
                color: isScanning
                  ? '#34C759'
                  : isPaused
                  ? '#FF9F0A'
                  : isCompleted
                  ? '#0A84FF'
                  : isError
                  ? '#FF453A'
                  : colors.textSecondary,
                flexShrink: 0
              }}
            >
              {/* Small live dot for Scanning state */}
              {isScanning && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#34C759',
                    display: 'inline-block',
                    boxShadow: '0 0 6px rgba(52, 199, 89, 0.8)'
                  }}
                />
              )}
              <span>
                {isScanning ? 'Scanning' : isPaused ? 'Paused' : isCompleted ? 'Completed' : isError ? 'Error' : 'Ready'}
              </span>
            </div>

            {/* Elapsed Timer on the right: "ELAPSED 00:00" */}
            <div
              className="ios-elapsed-timer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  lineHeight: '14px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  color: colors.textSecondary
                }}
              >
                ELAPSED
              </span>
              <span
                style={{
                  fontSize: '15px',
                  lineHeight: '18px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: colors.textPrimary,
                  letterSpacing: '-0.2px'
                }}
              >
                {formatElapsed(elapsedMs)}
              </span>
            </div>
          </div>

          {/* Divider: 1px line, color rgba(84,84,88,.6), 10px margin above and below */}
          <div
            className="ios-summary-divider"
            style={{
              height: '1px',
              backgroundColor: isDark ? 'rgba(84, 84, 88, 0.6)' : 'rgba(60, 60, 67, 0.2)',
              margin: '10px 0',
              width: '100%'
            }}
          />

          {/* Row 2: 3 Equal Columns (grid 3 x 1fr) */}
          <div
            className="ios-summary-stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              alignItems: 'start'
            }}
          >
            {/* Column 1: Discovered (white) */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  fontWeight: 500,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                Discovered
              </span>
              <span
                style={{
                  fontSize: '22px',
                  lineHeight: '26px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: colors.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '-0.3px'
                }}
              >
                {discoveredCount.toLocaleString()}
              </span>
            </div>

            {/* Column 2: Business (green) */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  fontWeight: 500,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                Business
              </span>
              <span
                style={{
                  fontSize: '22px',
                  lineHeight: '26px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: '#34C759',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '-0.3px'
                }}
              >
                {businessCount.toLocaleString()}
              </span>
            </div>

            {/* Column 3: Remaining (secondary gray) */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  fontWeight: 500,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                Remaining
              </span>
              <span
                style={{
                  fontSize: '22px',
                  lineHeight: '26px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '-0.3px'
                }}
              >
                {remainingCount !== null ? remainingCount.toLocaleString() : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Live Scanned Leads List (Grouped iOS List) ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          margin: '0 16px',
          backgroundColor: colors.card,
          borderRadius: '16px',
          boxShadow: isDark
            ? '0 4px 20px rgba(0, 0, 0, 0.5), inset 0 0 0 0.5px rgba(255, 255, 255, 0.1)'
            : '0 2px 10px rgba(0, 0, 0, 0.04), 0 0 0 0.5px rgba(0, 0, 0, 0.04)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {displayedLeads.length === 0 ? (
          photoFilter === 'photos' ? (
            <div
              style={{
                height: '100%',
                minHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '24px',
                textAlign: 'center'
              }}
            >
              <IosSpinner size={22} color={colors.accent} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textSecondary }}>
                Waiting for leads with profile photos...
              </span>
            </div>
          ) : (
            <div
              style={{
                height: '100%',
                minHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '24px',
                textAlign: 'center'
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 600, color: colors.textSecondary }}>
                No Verified Leads Yet
              </span>
              <span style={{ fontSize: '13px', color: colors.textMuted, maxWidth: '240px' }}>
                Valid WhatsApp contacts will appear here in real time as they are discovered.
              </span>
            </div>
          )
        ) : (
          displayedLeads.map((lead, index) => {
            const key = lead.cleanNumber || lead.number || String(index);
            const isNewest = isScanning && index === 0;
            const showSeparator = index < displayedLeads.length - 1;

            return (
              <React.Fragment key={key}>
                <IosLeadRow
                  lead={lead}
                  isNewest={isNewest}
                  isDark={isDark}
                  accentColor={accentColor}
                  intensity={intensity}
                  currentTime={now}
                  onPhotoDecoded={(success) => onPhotoLoaded?.(key, success)}
                />
                {showSeparator && (
                  <div
                    style={{
                      height: '0.5px',
                      marginLeft: '76px',
                      backgroundColor: colors.separator
                    }}
                  />
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* ── 5. iOS Home Indicator Area (28px) ── */}
      <div
        style={{
          height: '28px',
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
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.3)'
          }}
        />
      </div>
    </div>
  );
}

export default IosPhoneScreen;
