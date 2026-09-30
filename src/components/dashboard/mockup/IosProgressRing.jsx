import React from 'react';

/**
 * Animated iOS Circular Progress Ring for Campaign Summary
 */
export function IosProgressRing({
  percent = 0,
  size = 92,
  strokeWidth = 8,
  accentColor = '#0A84FF',
  isDark = true
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));
  const offset = circumference - (clampedPercent / 100) * circumference;

  const trackColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Animated Progress Indicator */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease'
          }}
        />
      </svg>

      {/* Center Percentage & Label */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pointerEvents: 'none'
        }}
      >
        <span
          style={{
            fontSize: '20px',
            lineHeight: '22px',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.4px',
            color: isDark ? '#FFFFFF' : '#000000'
          }}
        >
          {clampedPercent}%
        </span>
        <span
          style={{
            fontSize: '11px',
            lineHeight: '13px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            color: isDark ? 'rgba(235, 235, 245, 0.55)' : 'rgba(60, 60, 67, 0.55)',
            marginTop: '2px'
          }}
        >
          Scanned
        </span>
      </div>
    </div>
  );
}

export default IosProgressRing;
