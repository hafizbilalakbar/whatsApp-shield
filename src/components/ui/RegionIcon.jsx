import React from 'react';
import { MapPin } from 'lucide-react';

/**
 * Region/state "verified vs label-only" glyph used in the region picker and
 * report rows. Truthfulness is encoded in colour:
 *  - verified  -> emerald pin (its prefix intersects the country mobile plan)
 *  - label-only -> amber pin (targeting label; no verified prefixes)
 *  - otherwise -> muted grey pin (e.g. the "__all__" pseudo-region)
 */
export const RegionIcon = ({ verified, labelOnly, className = '', size = 15 }) => {
  const tone = labelOnly
    ? 'text-amber-500'
    : verified
      ? 'text-emerald-500'
      : 'text-text-muted';
  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${tone} ${className}`} aria-hidden="true">
      <MapPin size={size} strokeWidth={2.25} />
    </span>
  );
};

export default RegionIcon;