import React from 'react';
import { Signal } from 'lucide-react';

/**
 * Deterministic hue from a string so the same operator name always gets the
 * same badge colour (stable across renders, no random flashing).
 */
function hueFor(name) {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/**
 * Compact cellular "operator" badge used in the operator picker / report rows.
 * Visual language: a white Signal glyph on a saturated, name-derived colour,
 * like a carrier chip in a stock dialer.
 */
export const OperatorIcon = ({ name, className = '', size = 16 }) => {
  const hue = hueFor(name);
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-md text-white select-none ${className}`}
      style={{
        width: size + 4,
        height: size + 4,
        background: `linear-gradient(135deg, hsl(${hue} 72% 46%), hsl(${(hue + 38) % 360} 70% 36%))`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
      }}
      aria-hidden="true"
    >
      <Signal size={size - 4 < 8 ? 8 : size - 4} strokeWidth={2.5} />
    </span>
  );
};

export default OperatorIcon;