import React from 'react';

/**
 * Animated iOS Circular Progress Ring for Campaign Summary
 */
export function IosProgressRing({
  percent,
  progress,
  size = 76,
  strokeWidth = 6,
  accentColor = '#0A84FF',
  isDark = true
}) {
  const rawPercent = percent !== undefined ? percent : (progress !== undefined ? progress : 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(100, Math.max(0, Math.round(rawPercent)));
  const offset = circumference - (clampedPercent / 100) * circumference;

  const trackColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <div
      className="ios-summary-progress-ring"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        flexShrink: 0
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)', overflow: 'visible', display: 'block' }}
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
            transition: 'stroke-dashoffset 0.5s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease'
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
          pointerEvents: 'none',
          inset: 0
        }}
      >
        <span
          style={{
            fontSize: '20px',
            lineHeight: '22px',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.5px',
            color: isDark ? '#FFFFFF' : '#000000'
          }}
        >
          {clampedPercent}%
        </span>
        <span
          style={{
            fontSize: '10px',
            lineHeight: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            color: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.65)',
            marginTop: '1px'
          }}
        >
          SCANNED
        </span>
      </div>
    </div>
  );
}

export default IosProgressRing;
