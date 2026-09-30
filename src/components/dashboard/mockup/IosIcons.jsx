import React from 'react';

/**
 * Pixel-perfect iOS Cellular Signal SVG Icon
 */
export function IosSignalIcon({ color = 'currentColor', size = 17 }) {
  return (
    <svg width={size} height={Math.round(size * 0.7)} viewBox="0 0 18 12" fill="none" aria-hidden="true">
      <rect x="0.5" y="8" width="3" height="4" rx="1" fill={color} />
      <rect x="4.5" y="5.5" width="3" height="6.5" rx="1" fill={color} />
      <rect x="8.5" y="3" width="3" height="9" rx="1" fill={color} />
      <rect x="12.5" y="0.5" width="3" height="11.5" rx="1" fill={color} />
    </svg>
  );
}

/**
 * Pixel-perfect iOS WiFi SVG Icon
 */
export function IosWifiIcon({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={Math.round(size * 0.75)} viewBox="0 0 16 12" fill="none" aria-hidden="true">
      <path
        d="M8 9.5C8.82843 9.5 9.5 8.82843 9.5 8C9.5 7.17157 8.82843 6.5 8 6.5C7.17157 6.5 6.5 7.17157 6.5 8C6.5 8.82843 7.17157 9.5 8 9.5Z"
        fill={color}
      />
      <path
        d="M4.3 5.4C5.3 4.4 6.6 3.9 8 3.9C9.4 3.9 10.7 4.4 11.7 5.4"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M1.5 2.6C3.3 0.9 5.6 0 8 0C10.4 0 12.7 0.9 14.5 2.6"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Pixel-perfect iOS Battery Indicator SVG Icon
 */
export function IosBatteryIcon({ color = 'currentColor', size = 25, level = 0.92 }) {
  const width = size;
  const height = Math.round(size * 0.48);
  const fillWidth = Math.max(2, Math.round((width - 6) * Math.min(1, Math.max(0.1, level))));

  return (
    <svg width={width} height={height} viewBox="0 0 25 12" fill="none" aria-hidden="true">
      {/* Battery shell */}
      <rect x="0.75" y="0.75" width="20.5" height="10.5" rx="3.25" stroke={color} strokeWidth="1.5" />
      {/* Battery terminal cap */}
      <path d="M23 4C23.5523 4 24 4.44772 24 5V7C24 7.55228 23.5523 8 23 8V4Z" fill={color} />
      {/* Battery inner fill */}
      <rect x="2.5" y="2.5" width={fillWidth} height="7" rx="1.75" fill={color} />
    </svg>
  );
}

/**
 * Calm iOS-style activity spinner
 */
export function IosSpinner({ size = 16, color = 'currentColor', className = '' }) {
  const bars = Array.from({ length: 8 });
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {bars.map((_, i) => {
        const deg = i * 45;
        const opacity = 0.25 + (i / 7) * 0.75;
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.max(2, Math.round(size * 0.12)),
              height: Math.max(4, Math.round(size * 0.3)),
              backgroundColor: color,
              opacity,
              top: '12%',
              left: '50%',
              marginLeft: -Math.max(1, Math.round(size * 0.06)),
              transformOrigin: `center ${size * 0.38}px`,
              transform: `rotate(${deg}deg)`,
              animation: `iosSpinnerFade 0.8s linear infinite`,
              animationDelay: `${(i * 0.1).toFixed(2)}s`
            }}
          />
        );
      })}
    </div>
  );
}
