// Client-side mirror of backend/services/contact-identity.js.
//
// Only a real 1-to-1 WhatsApp user may be imported or created as a CRM chat.
// Groups (`@g.us`), channels (`@newsletter`), broadcasts/status
// (`@broadcast`) and unresolved `@lid` ids are rejected.
//
// The backend remains the authority — this exists so the UI never offers an
// invalid row for import, and so the chat list never renders a group id as if
// it were a person's phone number.

const USER_SUFFIX = 's.whatsapp.net';
const LID_SUFFIX = 'lid';

const NON_USER_SUFFIXES = [
  'g.us',
  'newsletter',
  'broadcast',
  'call',
  'mms',
  'bot',
  'server',
];

const RESERVED_HANDLES = new Set([
  'status', 'broadcast', 'calls', 'emergency', 'lifecycle',
  'messaging', 'md', 'fb', '0', 'null', 'undefined',
]);

const MAX_E164_DIGITS = 15;
const MIN_E164_DIGITS = 4;

export const normalizeE164 = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
};

/**
 * @param {string} raw JID, LID or plain phone number.
 * @returns {{ valid: boolean, kind: string, digits: string, e164: string, reason?: string }}
 */
export const classifyIdentifier = (raw) => {
  const fail = (kind, reason) => ({ valid: false, kind, digits: '', e164: '', reason });
  if (raw === null || raw === undefined) return fail('invalid', 'missing identifier');

  let value = String(raw).trim().replace(/\s+/g, '');
  if (!value) return fail('invalid', 'empty identifier');

  const atIndex = value.indexOf('@');
  if (atIndex === -1) {
    const digits = value.replace(/\D/g, '');
    if (!digits) return fail('invalid', 'not a phone number');
    if (digits.length < MIN_E164_DIGITS) return fail('invalid', 'too short to be a phone number');
    if (digits.length > MAX_E164_DIGITS) return fail('invalid', 'too long to be a phone number');
    return { valid: true, kind: 'user', digits, e164: `+${digits}` };
  }

  const handle = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1).toLowerCase();
  const bare = handle.includes(':') ? handle.slice(0, handle.indexOf(':')) : handle;

  if (domain === USER_SUFFIX) {
    const digits = bare.replace(/\D/g, '');
    if (!digits) return fail('invalid', 'user jid without digits');
    if (digits.length < MIN_E164_DIGITS) return fail('invalid', 'user jid too short');
    if (digits.length > MAX_E164_DIGITS) return fail('invalid', 'user jid too long');
    return { valid: true, kind: 'user', digits, e164: `+${digits}` };
  }

  if (domain === LID_SUFFIX) {
    return fail('lid', 'LID identifier must be resolved to a phone number first');
  }
  if (domain === 'newsletter') return fail('channel', 'WhatsApp channel — not a person');
  if (domain === 'broadcast') return fail('broadcast', 'status/broadcast — not a person');
  if (domain === 'g.us') return fail('group', 'group chat — not a person');
  for (const bad of NON_USER_SUFFIXES) {
    if (domain === bad) return fail('invalid', `"${bad}" JID — not a person`);
  }
  if (RESERVED_HANDLES.has(bare.toLowerCase())) {
    return fail('reserved', `"${bare}" is a reserved handle, not a person`);
  }
  return fail('invalid', `unrecognised JID domain "${domain}"`);
};

/** Convenience: true only for a real 1-to-1 WhatsApp user. */
export const isRealPersonIdentifier = (raw) => classifyIdentifier(raw).valid;

/**
 * Format a stored identifier for display. Returns '' for non-persons so a group
 * id is never rendered as if it were a phone number.
 */
export const formatContactPhone = (raw) => {
  const result = classifyIdentifier(raw);
  return result.valid ? result.e164 : '';
};