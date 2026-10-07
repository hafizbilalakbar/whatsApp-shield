/* Single authority for "is this a real, dialable phone number?" on the backend.
 *
 * The scan loop (server.js) and the WhatsApp lookup (whatsapp.js) MUST agree,
 * because the scan loop uses this to decide what may be dispatched and
 * whatsapp.js re-checks immediately before it would call onWhatsApp. Two
 * different rules meant a number the scan believed was fine could still be
 * handed to WhatsApp (the old bug: anything >= 8 digits was accepted).
 *
 * Metadata is `libphonenumber-js/max`, the same build the frontend generator
 * validates against (src/data/numberingPlans.js), so a generated number and a
 * scanned number are judged identically.
 */
const { parsePhoneNumberFromString } = require('libphonenumber-js/max');

// Types that can never be a WhatsApp 1:1 user JID. Looking them up wastes a
// rate-limit slot and pollutes reports with guaranteed "not registered" noise.
const UNREACHABLE_TYPES = new Set([
  'VOIP',
  'PREMIUM_RATE',
  'SHARED_COST',
  'TOLL_FREE',
  'NON_FIXED_LINE_OR_MOBILE',
]);

/**
 * Normalise any user-entered number to bare international digits.
 *
 * Accepts the formats people actually paste: spaces, dashes, dots, brackets, a
 * leading "00" instead of "+", and a national trunk "0" before the country code
 * (e.g. "0300 1234567" with a +92 hint becomes "923001234567").
 *
 * @param {*} raw
 * @param {string|number} [countryCallingCode] hint used only to re-attach a
 *   calling code to a purely national number that starts with a trunk 0.
 * @returns {string} digits only, or '' when there is nothing number-like.
 */
function normalizeToInternationalDigits(raw, countryCallingCode) {
  if (raw === null || raw === undefined) return '';
  let text = String(raw).trim();
  if (!text) return '';

  // Keep digits plus a leading '+', then fold an international "00" into '+'.
  text = text.replace(/[^\d+]/g, '');
  if (text.startsWith('00')) text = '+' + text.slice(2);
  if (text.includes('+')) text = '+' + text.replace(/\+/g, '').replace(/^\D*/, '');
  text = text.replace(/\D/g, '');
  if (!text) return '';

  const cc = String(countryCallingCode == null ? '' : countryCallingCode).replace(/\D/g, '');
  if (cc && !text.startsWith(cc) && /^0/.test(text)) {
    text = cc + text.replace(/^0+/, '');
  }
  return text;
}

/**
 * Validate one number, fail CLOSED.
 *
 * @param {*} raw
 * @param {object} [opts]
 * @param {string|number} [opts.countryCallingCode] hint for national input.
 * @param {string} [opts.expectedCountry] ISO2 the caller believes this is; when
 *   set, a number that parses as a DIFFERENT country is rejected. This is what
 *   stops a Pakistani campaign from quietly absorbing a UAE number.
 * @param {boolean} [opts.allowFixedLine] accept FIXED_LINE as well as mobile.
 * @returns {{valid:boolean, e164:string, digits:string, country:?string,
 *            type:?string, reason:?string}}
 */
function validatePhoneNumber(raw, opts = {}) {
  const digits = normalizeToInternationalDigits(raw, opts.countryCallingCode);
  if (!digits) {
    return { valid: false, e164: '', digits: '', country: null, type: null, reason: 'No digits found' };
  }

  let parsed = null;
  try {
    parsed = parsePhoneNumberFromString('+' + digits);
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return { valid: false, e164: '', digits, country: null, type: null, reason: 'Unparseable number' };
  }

  const type = parsed.getType() || null;
  const country = parsed.country || null;

  if (!parsed.isValid()) {
    return {
      valid: false, e164: '', digits, country, type,
      reason: parsed.isPossible()
        ? 'Invalid length or prefix for this country'
        : 'Not a possible phone number',
    };
  }

  if (type && UNREACHABLE_TYPES.has(type)) {
    return { valid: false, e164: '', digits, country, type, reason: `Unsupported number type (${type})` };
  }

  if (!opts.allowFixedLine && type && type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE') {
    return { valid: false, e164: '', digits, country, type, reason: `Not a mobile number (${type})` };
  }

  if (opts.expectedCountry) {
    const want = String(opts.expectedCountry).toUpperCase();
    if (country && country !== want) {
      return {
        valid: false, e164: '', digits, country, type,
        reason: `Number belongs to ${country}, not ${want}`,
      };
    }
  }

  return { valid: true, e164: parsed.format('E.164'), digits, country, type, reason: null };
}

module.exports = {
  normalizeToInternationalDigits,
  validatePhoneNumber,
  UNREACHABLE_TYPES,
};
