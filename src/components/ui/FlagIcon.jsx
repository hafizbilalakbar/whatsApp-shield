import React from 'react';
import { rawFlagSvg } from '../../utils/flagAssets';
import { countries } from '../../data/countries';

const CDN_BASE = 'https://flagcdn.com/w580';

function resolveIso(code) {
  if (!code) return '';
  const upper = String(code).toUpperCase().slice(0, 2);
  const match = countries.find(c => c.iso.toUpperCase() === upper);
  if (match) return match.iso.toUpperCase();
  const byDial = countries.find(c => c.code === String(code));
  if (byDial) return byDial.iso.toUpperCase();
  return upper;
}

export function getFlagUrl(code) {
  if (!code || code === 'N/A' || code === 'Unknown') return '';
  const iso = resolveIso(code);
  return `${CDN_BASE}/${iso}.svg`;
}

export function getFlagSvg(code) {
  if (!code || code === 'N/A' || code === 'Unknown') return null;
  const svg = rawFlagSvg(code);
  if (svg) return svg;
  return null;
}

export function FlagIcon({ code, size = 16, className = '', fallback = null }) {
  if (!code || code === 'N/A' || code === 'Unknown') return fallback;
  const svg = getFlagSvg(code);
  const url = getFlagUrl(code);

  if (svg) {
    try {
      const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const svgEl = parsed.documentElement;
      const w = parseFloat(svgEl.getAttribute('width') || '640');
      const h = parseFloat(svgEl.getAttribute('height') || '480');
      const viewBox = svgEl.getAttribute('viewBox') || `0 0 ${w} ${h}`;
      const innerSVG = svgEl.innerHTML || '';
      return (
        <svg
          width={size}
          height={Math.round(size * (h / w))}
          viewBox={viewBox}
          className={className}
          style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: '2px' }}
          dangerouslySetInnerHTML={{ __html: innerSVG }}
        />
      );
    } catch (e) {
      return fallback;
    }
  }

  if (url) {
    return (
      <img
        src={url}
        alt={code}
        width={size}
        height={Math.round(size * 0.66)}
        className={className}
        style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: '2px', objectFit: 'cover' }}
        onError={(e) => { e.target.style.display = 'none'; if (fallback) fallback.style.display = 'inline'; }}
      />
    );
  }

  return fallback;
}

export default FlagIcon;
