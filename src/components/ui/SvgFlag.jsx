import React from 'react';
import * as FlagIcons from 'country-flag-icons/react/3x2';
import { countries } from '../../data/countries';

/**
 * Resolves 2-letter uppercase ISO code from an ISO string, country name, or dial code.
 */
export function resolveCountryIso(countryOrCode) {
  if (!countryOrCode) return 'US';
  const str = String(countryOrCode).trim();
  if (str.length === 2) return str.toUpperCase();
  
  // Try matching by dial code (e.g. "1", "+1", "44", "+44")
  const cleanCode = str.replace(/\D/g, '');
  if (cleanCode) {
    const byCode = countries.find(c => c.code === cleanCode);
    if (byCode && byCode.iso) return byCode.iso.toUpperCase();
  }

  // Try matching by country name
  const lower = str.toLowerCase();
  const byName = countries.find(c => c.name.toLowerCase() === lower || c.name.toLowerCase().includes(lower));
  if (byName && byName.iso) return byName.iso.toUpperCase();

  return 'US';
}

/**
 * Gets the full country display name and calling code for a given ISO code or hint.
 */
export function getCountryMetadata(countryOrIso) {
  const iso = resolveCountryIso(countryOrIso);
  const found = countries.find(c => c.iso.toUpperCase() === iso);
  if (found) {
    return {
      name: found.name,
      dialCode: found.code.startsWith('+') ? found.code : `+${found.code}`,
      iso: found.iso.toUpperCase()
    };
  }
  return {
    name: countryOrIso || 'United States',
    dialCode: '+1',
    iso: 'US'
  };
}

/**
 * Inline vector SVG flag component powered by local country-flag-icons (MIT).
 * Never relies on emoji or external CDN requests.
 */
export function SvgFlag({ code = 'US', className = '', style = {}, width = 20, height }) {
  const iso = resolveCountryIso(code);
  const FlagComponent = FlagIcons[iso] || FlagIcons.US;
  const calcHeight = height || Math.round(width * (2 / 3));

  if (!FlagComponent) {
    return (
      <span
        className={className}
        style={{
          width,
          height: calcHeight,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#374151',
          borderRadius: 3,
          fontSize: 9,
          color: '#fff',
          fontWeight: 700,
          ...style
        }}
      >
        {iso}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center shrink-0 overflow-hidden ${className}`}
      style={{
        width,
        height: calcHeight,
        borderRadius: 3,
        boxShadow: '0 0 0 1px rgba(0,0,0,0.12)',
        ...style
      }}
    >
      <FlagComponent
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover'
        }}
      />
    </span>
  );
}

export default SvgFlag;
