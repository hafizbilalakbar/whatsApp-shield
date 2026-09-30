import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Parses and formats a phone number using libphonenumber-js in national/international format,
 * with middle digits masked with tabular dots for privacy.
 * 
 * Never slices digits arbitrarily by hand.
 * Supports US, UK, Canada, Australia, Pakistan, and all international E.164 numbers.
 * 
 * @param {string|number} raw - The raw number, cleanNumber, or formatted string
 * @param {string} [countryHint] - 2-letter ISO code (e.g. 'US', 'GB', 'PK')
 * @returns {string} Formatted masked string (e.g. "+1 (305) 558-••49")
 */
export function formatMaskedPhone(raw, countryHint) {
  const str = String(raw || '').trim();
  if (!str) return '—';

  let clean = str;
  if (!clean.startsWith('+') && !clean.startsWith('00')) {
    clean = '+' + clean.replace(/\D/g, '');
  }

  let parsed = parsePhoneNumberFromString(clean);
  if (!parsed && countryHint) {
    parsed = parsePhoneNumberFromString(str, String(countryHint).toUpperCase());
  }
  if (!parsed && !str.startsWith('+')) {
    parsed = parsePhoneNumberFromString('+' + str.replace(/\D/g, ''));
  }

  // Fallback if libphonenumber could not parse
  if (!parsed) {
    const digits = str.replace(/\D/g, '');
    if (digits.length <= 4) return str;
    const prefix = digits.slice(0, Math.min(3, digits.length - 2));
    const suffix = digits.slice(-2);
    return `+${prefix} •••• ${suffix}`;
  }

  const cc = `+${parsed.countryCallingCode}`;
  const callingCode = String(parsed.countryCallingCode);
  const country = parsed.country;

  // 1. US and Canada (+1): (NXX) NXX-XXXX -> e.g. +1 (305) 558-••49
  if (callingCode === '1') {
    const nat = parsed.nationalNumber;
    if (nat.length === 10) {
      const area = nat.slice(0, 3);
      const prefix = nat.slice(3, 6);
      const suffix = nat.slice(8, 10);
      return `${cc} (${area}) ${prefix}-••${suffix}`;
    }
  }

  // 2. UK & Crown Dependencies (+44): 07XXX XXXXXX -> +44 7911 ••••56
  if (callingCode === '44') {
    const nat = parsed.nationalNumber;
    if (nat.length >= 10) {
      const p1 = nat.slice(0, 4);
      const p2End = nat.slice(-2);
      return `${cc} ${p1} ••••${p2End}`;
    }
  }

  // 3. Australia (+61): 04XX XXX XXX -> +61 412 ••• •78
  if (callingCode === '61') {
    const nat = parsed.nationalNumber;
    if (nat.length === 9) {
      const p1 = nat.slice(0, 3);
      const p3End = nat.slice(-2);
      return `${cc} ${p1} ••• •${p3End}`;
    }
  }

  // 4. Pakistan (+92): 03XX XXXXXXX -> +92 300 ••••567
  if (callingCode === '92') {
    const nat = parsed.nationalNumber;
    if (nat.length === 10) {
      const p1 = nat.slice(0, 3);
      const suffix = nat.slice(-3);
      return `${cc} ${p1} ••••${suffix}`;
    }
  }

  // 5. Generic international format
  const intl = parsed.formatInternational();
  const parts = intl.split(' ');
  if (parts.length >= 3) {
    const lastIdx = parts.length - 1;
    const last = parts[lastIdx];
    if (last.length >= 4) {
      parts[lastIdx] = '••' + last.slice(-2);
      return parts.join(' ');
    }
  }

  // Fallback digit index masking on standard international representation
  const digitIndices = [];
  for (let i = 0; i < intl.length; i++) {
    if (/\d/.test(intl[i])) digitIndices.push(i);
  }
  if (digitIndices.length <= 4) return intl;

  const keepStart = Math.min(5, Math.floor(digitIndices.length / 2.5));
  const keepEnd = 2;
  const maskIndices = new Set(digitIndices.slice(keepStart, digitIndices.length - keepEnd));

  let out = '';
  for (let i = 0; i < intl.length; i++) {
    out += maskIndices.has(i) ? '•' : intl[i];
  }
  return out;
}

/**
 * Extracts raw phone number string from a lead result object
 */
export function getRawLeadPhone(lead) {
  return (
    lead?.number ||
    (lead?.cleanNumber ? `+${lead.cleanNumber}` : '') ||
    lead?.formatted ||
    lead?.jid?.replace('@s.whatsapp.net', '') ||
    ''
  );
}
