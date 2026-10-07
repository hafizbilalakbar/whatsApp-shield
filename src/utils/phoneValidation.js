import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

/**
 * Single source of truth for phone-number format validation in the UI.
 *
 * The backend enforces the same rules in `backend/services/number-validation.js`.
 * Both sides use `libphonenumber-js/max` (full metadata) so a number accepted
 * here is a number the scanner will accept, and vice versa.
 *
 * The rule this replaces: "try parsing, and if that fails, delete digits until
 * something parses". That heuristic turned malformed input into a *different*
 * valid number - the exact class of bug where a pasted list silently turned into
 * the wrong contacts. Nothing here ever invents, drops, or reinterprets digits.
 */

/** Types WhatsApp can actually be registered on. */
const ALLOWED_TYPES = new Set(['MOBILE', 'FIXED_LINE_OR_MOBILE']);

/**
 * Reduce any of the formats people actually paste to bare international digits.
 *
 * Accepts: `+92 300 1234567`, `+92-300-1234567`, `+92 (300) 1234567`,
 * `00923001234567`, `923001234567`, and national `0300-1234567` when
 * `defaultCallingCode` is supplied.
 *
 * @param {string} raw
 * @param {string|number} [defaultCallingCode] digits only, e.g. '92'
 * @returns {string} international digits without '+', or '' if none
 */
export function normalizeToInternationalDigits(raw, defaultCallingCode) {
  if (raw === null || raw === undefined) return '';

  let value = String(raw).trim();
  if (!value) return '';

  // Reject group / channel / broadcast / newsletter identifiers outright: they
  // are not phone numbers and must never be "recovered" by stripping characters.
  if (value.includes('@')) return '';

  // International access prefix -> '+'.
  if (/^00\s*\d/.test(value)) value = `+${value.replace(/^00\s*/, '')}`;

  const hasPlus = value.trimStart().startsWith('+');
  // Keep digits only (a leading '+' is not a digit).
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (!hasPlus) {
    const cc = String(defaultCallingCode || '').replace(/\D/g, '');
    if (!cc) {
      // No country context and no '+': we cannot know the calling code, and
      // guessing is exactly what produced wrong numbers before. Let
      // libphonenumber try its own extraction, then fail honestly.
      return digits;
    }
    // National format: drop the trunk '0' before the country code.
    digits = digits.replace(/^0+/, '');
    digits = cc + digits;
  }

  return digits;
}

/**
 * Validate and normalize one number.
 *
 * @param {string} raw
 * @param {object} [options]
 * @param {string|number} [options.defaultCallingCode] for national-format input
 * @param {boolean} [options.allowFixedLine] accept FIXED_LINE too
 * @returns {{valid: boolean, e164: string, national: string, country: string|null,
 *            countryCallingCode: string|null, type: string|null, reason: string|null}}
 */
export function validatePhoneNumber(raw, options = {}) {
  const { defaultCallingCode, allowFixedLine = false } = options;
  const empty = {
    valid: false,
    e164: '',
    national: '',
    country: null,
    countryCallingCode: null,
    type: null,
    reason: null,
  };

  const original = String(raw ?? '').trim();
  if (!original) return { ...empty, reason: 'Empty entry' };
  if (original.includes('@')) {
    return { ...empty, reason: 'Not a phone number (group/channel/broadcast ID)' };
  }

  const digits = normalizeToInternationalDigits(original, defaultCallingCode);
  if (!digits) return { ...empty, reason: 'No digits found' };
  if (digits.length < 7) return { ...empty, reason: 'Too short to be a phone number' };
  if (digits.length > 15) return { ...empty, reason: 'Too long to be a phone number' };

  let parsed = null;
  try {
    parsed = parsePhoneNumberFromString(`+${digits}`);
  } catch {
    parsed = null;
  }

  if (!parsed) return { ...empty, reason: 'Not a recognisable phone number' };
  if (!parsed.isValid()) {
    return { ...empty, reason: 'Invalid length or prefix for this country' };
  }

  const type = parsed.getType() || null;
  if (type && !ALLOWED_TYPES.has(type) && !(allowFixedLine && type === 'FIXED_LINE')) {
    const labels = {
      FIXED_LINE: 'landline, not a mobile number',
      TOLL_FREE: 'toll-free number',
      PREMIUM_RATE: 'premium-rate number',
      SHARED_COST: 'shared-cost number',
      VOIP: 'VoIP number',
      PERSONAL_NUMBER: 'personal number',
      PAGER: 'pager number',
      UAN: 'universal access number',
      VOICEMAIL: 'voicemail number',
      NON_FIXED_LINE_OR_MOBILE: 'not a mobile number',
    };
    return { ...empty, reason: `Not a mobile number (${labels[type] || type})` };
  }

  const national = String(parsed.nationalNumber || '');
  return {
    valid: true,
    // `parsed.number` is already E.164 and already carries the '+'.
    e164: parsed.number,
    national,
    country: parsed.country || null,
    countryCallingCode: String(parsed.countryCallingCode || ''),
    type,
    reason: null,
  };
}

/**
 * Grouped display form, e.g. '+92 300 1234567'.
 *
 * Falls back to the ORIGINAL string (not a fabricated '+<digits>') when the
 * input cannot be resolved, so an unparseable entry is never displayed as if it
 * were a valid international number.
 *
 * @param {string} raw
 * @param {string|number} [defaultCallingCode] for national-format input
 */
export function formatForDisplay(raw, defaultCallingCode) {
  const digits = normalizeToInternationalDigits(raw, defaultCallingCode);
  if (digits) {
    try {
      const parsed = parsePhoneNumberFromString(`+${digits}`);
      if (parsed && parsed.isValid()) return parsed.formatInternational();
    } catch {
      /* fall through to the original text */
    }
  }
  return String(raw ?? '').trim();
}

/**
 * Stable dedupe key: international digits only, so every equivalent paste
 * format collapses to a single entry.
 *
 * @param {string} raw
 * @param {string|number} [defaultCallingCode] for national-format input
 */
export function dedupeKey(raw, defaultCallingCode) {
  return normalizeToInternationalDigits(raw, defaultCallingCode);
}

export default { validatePhoneNumber, normalizeToInternationalDigits, formatForDisplay, dedupeKey };
