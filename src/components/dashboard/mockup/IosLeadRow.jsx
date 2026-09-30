import React, { useState, useEffect, useMemo, memo } from 'react';
import { IosAvatar } from './IosAvatar';
import { formatMaskedPhone, getRawLeadPhone } from '../../../utils/phoneFormatter';

/**
 * Formats discovery time string: "Found at 10:42:18 AM" + relative time ("Just now", "12s ago", "2m ago")
 */
function formatDiscoveryTime(timestamp, now) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null;

  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  let relative = 'Just now';
  if (diffSeconds >= 60 * 60) {
    const hours = Math.floor(diffSeconds / 3600);
    relative = `${hours}h ago`;
  } else if (diffSeconds >= 60) {
    const mins = Math.floor(diffSeconds / 60);
    relative = `${mins}m ago`;
  } else if (diffSeconds >= 5) {
    relative = `${diffSeconds}s ago`;
  }

  const timeStr = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const isToday = new Date().toDateString() === date.toDateString();
  const datePrefix = isToday ? '' : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} `;

  return {
    exact: `Found at ${datePrefix}${timeStr}`,
    relative
  };
}

export const IosLeadRow = memo(function IosLeadRow({
  lead,
  isNewest = false,
  isDark = true,
  accentColor = '#0A84FF',
  intensity = 'balanced',
  currentTime
}) {
  const rawPhone = getRawLeadPhone(lead);
  const countryHint = lead.detectedCountry || '';
  const maskedPhone = useMemo(() => formatMaskedPhone(rawPhone, countryHint), [rawPhone, countryHint]);

  const name = lead.displayName || lead.verifiedName || null;
  const isBiz = lead.isBusiness === true;
  const isVerified = lead.isVerified === true;
  const isExists = lead.exists === true;

  // Real photo URL (proxied or direct)
  const avatarUrl = useMemo(() => {
    if (lead.profilePhotoAvailable === false || lead.avatar === null) return null;
    if (lead.avatar) return lead.avatar;
    const digits = String(lead.cleanNumber || rawPhone || '').replace(/\D/g, '');
    if (digits && digits.length >= 6) {
      return `/api/profile-picture?phone=${digits}`;
    }
    return null;
  }, [lead.avatar, lead.profilePhotoAvailable, lead.cleanNumber, rawPhone]);

  // Location string (city, state) - shown when no name is present
  const locationParts = [lead.city, lead.state || lead.region].filter(Boolean);
  const locationText = locationParts.join(', ');

  // Discovery timestamp
  const discoveryTime = useMemo(() => {
    const ts = lead.discoveredAt || lead.timestamp;
    return formatDiscoveryTime(ts, currentTime);
  }, [lead.discoveredAt, lead.timestamp, currentTime]);

  // Real chips (max 2)
  const chips = useMemo(() => {
    const list = [];
    if (isVerified) {
      list.push({ label: 'Verified', type: 'verified' });
    }
    if (isBiz) {
      list.push({ label: 'Business', type: 'business' });
    }
    if (list.length < 2 && isExists) {
      list.push({ label: 'WhatsApp', type: 'whatsapp' });
    }
    return list.slice(0, 2);
  }, [isVerified, isBiz, isExists]);

  // Animation duration and easing based on intensity
  const animDuration = intensity === 'subtle' ? '240ms' : intensity === 'vivid' ? '420ms' : '340ms';
  const animEasing = intensity === 'vivid' ? 'cubic-bezier(0.34, 1.25, 0.64, 1)' : 'cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <div
      style={{
        minHeight: '76px',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        position: 'relative',
        boxSizing: 'border-box',
        transition: `background 0.2s ease, opacity ${animDuration} ${animEasing}, transform ${animDuration} ${animEasing}`,
        animation: isNewest ? `iosRowSlideIn ${animDuration} ${animEasing} both` : 'none'
      }}
    >
      {/* 48px Circular Avatar */}
      <IosAvatar
        src={avatarUrl}
        alt={name || maskedPhone}
        size={48}
        isDark={isDark}
      />

      {/* Main Content Column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {/* Line 1: Name (if present) or Formatted Masked Phone */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span
            style={{
              fontSize: '17px',
              lineHeight: '22px',
              fontWeight: 600,
              letterSpacing: '-0.4px',
              color: isDark ? '#FFFFFF' : '#000000',
              fontVariantNumeric: name ? 'normal' : 'tabular-nums',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {name || maskedPhone}
          </span>

          {/* Right: Relative Timestamp */}
          {discoveryTime && (
            <span
              style={{
                fontSize: '13px',
                lineHeight: '18px',
                fontWeight: 400,
                color: isDark ? 'rgba(235, 235, 245, 0.45)' : 'rgba(60, 60, 67, 0.5)',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title={discoveryTime.exact}
            >
              {discoveryTime.relative}
            </span>
          )}
        </div>

        {/* Line 2: Masked Phone (if name present) OR City/State (if no name) + Chips at right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span
            style={{
              fontSize: '15px',
              lineHeight: '20px',
              fontWeight: 400,
              letterSpacing: '-0.2px',
              fontVariantNumeric: name ? 'tabular-nums' : 'normal',
              color: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.65)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {name ? maskedPhone : (locationText || 'Active contact')}
          </span>

          {/* Chips (Real data only) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {chips.map((chip, i) => {
              let bg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
              let color = isDark ? 'rgba(235, 235, 245, 0.8)' : 'rgba(60, 60, 67, 0.85)';
              let border = isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)';

              if (chip.type === 'verified') {
                bg = isDark ? 'rgba(48, 176, 199, 0.16)' : 'rgba(48, 176, 199, 0.12)';
                color = isDark ? '#5AC8FA' : '#007AFF';
                border = isDark ? '1px solid rgba(90, 200, 250, 0.25)' : '1px solid rgba(0, 122, 255, 0.2)';
              } else if (chip.type === 'business') {
                bg = isDark ? 'rgba(10, 132, 255, 0.16)' : 'rgba(10, 132, 255, 0.1)';
                color = isDark ? '#409CFF' : '#0062D2';
                border = isDark ? '1px solid rgba(10, 132, 255, 0.25)' : '1px solid rgba(10, 132, 255, 0.18)';
              } else if (chip.type === 'whatsapp') {
                bg = isDark ? 'rgba(52, 199, 89, 0.16)' : 'rgba(52, 199, 89, 0.12)';
                color = isDark ? '#34C759' : '#248A3D';
                border = isDark ? '1px solid rgba(52, 199, 89, 0.25)' : '1px solid rgba(52, 199, 89, 0.2)';
              }

              return (
                <span
                  key={i}
                  style={{
                    fontSize: '11px',
                    lineHeight: '14px',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '10px',
                    background: bg,
                    color: color,
                    border: border,
                    letterSpacing: '-0.1px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {chip.label}
                </span>
              );
            })}

            {/* Optional Score Ring (ONLY if real lead.score exists) */}
            {typeof lead.score === 'number' && (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  color: accentColor,
                  border: `2px solid ${accentColor}`
                }}
              >
                {Math.round(lead.score)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default IosLeadRow;
