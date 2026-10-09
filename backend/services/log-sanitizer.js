// Shared redaction helpers for anything persisted to disk or printed to the
// console. Guarantees that QR payloads, auth keys/tokens, and a linked
// account's personal data (name / full phone number) never reach the logs.
//
// Phone numbers are masked to first-5 + last-3 (e.g. 92310****385) and any
// raw data:image/data-uri blob is replaced entirely.

const { redact } = require('./stability');

// Keys whose values must never be logged verbatim.
const SENSITIVE_KEY_RE = /(qr|qrCode|qrCodeDataUrl|token|secret|password|passwd|authorization|api[-_]?key|apikey|creds|credential|advsecret|noisekey|signedidentitykey|signedprekey|prekey|privatekey|pairing|base64|dataurl|totp|otp)/i;
// The linked account's own identity — never written to disk.
const IDENTITY_KEY_RE = /(^|_)(name|displayname|pushname|verifiedname|profilepic|avatar|userinfo|accountdetail)($|_)/i;
const DATA_URI_RE = /data:[a-z0-9.+/-]+;base64,[a-z0-9+/=]+/i;
const LONG_DIGITS_RE = /\d{8,}/g;

// maskPhone('923101234385') -> '92310****385'
function maskPhone(value) {
  const digits = String(value == null ? '' : value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 6) return '*'.repeat(digits.length);
  return `${digits.slice(0, 5)}****${digits.slice(-3)}`;
}

function isSensitiveKey(key) {
  const k = String(key);
  return SENSITIVE_KEY_RE.test(k) || IDENTITY_KEY_RE.test(k);
}

// Deep-clone a value for logging, redacting sensitive keys, data-uris, secrets
// and masking any 8+ digit run (phone numbers) inside strings.
function sanitizeForLog(value, depth = 0) {
  if (depth > 8) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (DATA_URI_RE.test(value)) return '[redacted-data-uri]';
    let out = redact(value);
    out = out.replace(LONG_DIGITS_RE, (m) => maskPhone(m));
    if (out.length > 600) out = out.slice(0, 600) + '…[truncated]';
    return out;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return String(value);
  if (value instanceof Error) return { name: value.name, message: sanitizeForLog(value.message, depth + 1) };
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitizeForLog(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (isSensitiveKey(k)) { out[k] = '[redacted]'; continue; }
    out[k] = sanitizeForLog(v, depth + 1);
  }
  return out;
}

// Sanitize a free-form message string (masks digits, strips data-uris/secrets).
function sanitizeMessage(message) {
  const s = sanitizeForLog(message == null ? '' : String(message));
  return typeof s === 'string' ? s : String(s);
}

module.exports = { maskPhone, sanitizeForLog, sanitizeMessage, isSensitiveKey };
