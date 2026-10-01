'use strict';

// Single source of truth for "is this a real 1-to-1 person?".
//
// Why this exists
// ---------------
// WhatsApp JIDs are not all people. A group is `120363...@g.us`, a channel is
// `...@newsletter`, a broadcast/status is `status@broadcast`. Historically the
// app stripped every non-digit character, so `120363012345678901@g.us` collapsed
// to the perfectly plausible digits `120363012345678901` and was happily saved
// as a CRM contact — showing up in the chat list as a fake person that can
// never be messaged. The same stripping also turned a stray `+` into an empty
// "phone" and produced rows named just `+`.
//
// Every path that creates, imports or matches a CRM contact MUST go through
// `toContactIdentity()` first. Non-user JIDs are rejected outright rather than
// silently converted into bogus numbers.

const USER_SUFFIX = 's.whatsapp.net';
const LID_SUFFIX = 'lid';

// JIDs that are never a person.
const NON_USER_SUFFIXES = [
  'g.us',       // group
  'newsletter',// channel / broadcast channel
  'broadcast',  // status broadcast
  'call',       // call logs
  'mms',        // media
  'bot',        // Meta business platform bot (not a human inbox here)
  'server',     // server notices
];

// Bare handles that show up in WhatsApp JIDs but are not phone numbers.
const RESERVED_HANDLES = new Set([
  'status', 'broadcast', 'calls', 'emergency', 'lifecycle',
  'messaging', 'md', 'fb', '0', 'null', 'undefined',
]);

// E.164 allows a maximum of 15 digits; anything longer is a group/bot id.
const MAX_E164_DIGITS = 15;
// Shortest realistic subscriber number. 4 keeps very short placeholders out
// while never rejecting a legitimate short national number.
const MIN_E164_DIGITS = 4;

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

/**
 * Classify a raw identifier (JID, LID or plain phone number).
 *
 * @param {string} raw
 * @returns {{
 *   valid: boolean,
 *   kind: 'user'|'lid'|'group'|'channel'|'broadcast'|'reserved'|'invalid',
 *   digits: string,
 *   e164: string,
 *   reason?: string
 * }}
 */
const classifyIdentifier = (raw) => {
  const fail = (kind, reason) => ({ valid: false, kind, digits: '', e164: '', reason });

  if (raw === null || raw === undefined) return fail('invalid', 'missing identifier');

  let value = String(raw).trim();
  if (!value) return fail('invalid', 'empty identifier');

  // Lowercase only the domain part; never the digits.
  value = value.replace(/\s+/g, '');

  const atIndex = value.indexOf('@');
  if (atIndex === -1) {
    // Plain number (possibly with +, -, (), spaces already removed).
    const digits = digitsOnly(value);
    // A leading '+' with nothing else, or a value that has no digits at all.
    if (!digits) return fail('invalid', 'not a phone number');
    if (digits.length < MIN_E164_DIGITS) return fail('invalid', 'too short to be a phone number');
    if (digits.length > MAX_E164_DIGITS) return fail('invalid', 'too long to be a phone number (group or bot id?)');
    return { valid: true, kind: 'user', digits, e164: `+${digits}` };
  }

  const handle = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1).toLowerCase();

  // Strip the agent suffix (`...:12@...`) used in some JIDs.
  const bareHandle = handle.includes(':') ? handle.slice(0, handle.indexOf(':')) : handle;

  if (domain === USER_SUFFIX) {
    const digits = digitsOnly(bareHandle);
    if (!digits) return fail('invalid', 'user jid without digits');
    if (digits.length < MIN_E164_DIGITS) return fail('invalid', 'user jid too short');
    if (digits.length > MAX_E164_DIGITS) return fail('invalid', 'user jid too long');
    return { valid: true, kind: 'user', digits, e164: `+${digits}` };
  }

  if (domain === LID_SUFFIX) {
    // A LID is a real person, but it is an opaque id — NOT a phone number.
    // It may only become a contact once resolved to a phone number.
    return {
      valid: false,
      kind: 'lid',
      digits: '',
      e164: '',
      reason: 'LID identifier must be resolved to a phone number first',
    };
  }

  if (domain === 'newsletter') return fail('channel', 'WhatsApp channel — not a person');
  if (domain === 'broadcast') return fail('broadcast', 'status/broadcast — not a person');
  if (domain === 'g.us') return fail('group', 'group chat — not a person');

  for (const bad of NON_USER_SUFFIXES) {
    if (domain === bad) return fail('invalid', `"${domain}" JID — not a person`);
  }

  if (RESERVED_HANDLES.has(bareHandle.toLowerCase())) {
    return fail('reserved', `"${bareHandle}" is a reserved handle, not a person`);
  }

  return fail('invalid', `unrecognised JID domain "${domain}"`);
};

/**
 * Convert any inbound identifier into a canonical CRM identity.
 * Returns `null` for anything that is not a 1-to-1 person.
 *
 * @param {string} raw
 * @returns {{digits:string, e164:string, kind:'user'}|null}
 */
const toContactIdentity = (raw) => {
  const result = classifyIdentifier(raw);
  if (!result.valid) return null;
  return { digits: result.digits, e164: result.e164, kind: 'user' };
};

/**
 * True when a stored/legacy identifier is one of the non-person JID forms.
 * Used to clean up rows created before this validator existed.
 */
const isNonUserIdentifier = (raw) => {
  if (raw === null || raw === undefined) return true;
  const value = String(raw).trim();
  if (!value) return true;

  // Anything that is not digits / +digits is suspicious.
  const stripped = value.replace(/\s+/g, '');
  if (!/^\+?\d+$/.test(stripped)) {
    const at = stripped.indexOf('@');
    const domain = at === -1 ? '' : stripped.slice(at + 1).toLowerCase();
    if (!domain) return true; // e.g. "+", "abc", "-"
    if (domain === USER_SUFFIX) return false; // a real person jid
    return true; // group / channel / broadcast / unknown
  }

  // Plain digits: only valid when it could be a phone number.
  const digits = digitsOnly(stripped);
  if (!digits) return true;
  if (digits.length < MIN_E164_DIGITS) return true;
  if (digits.length > MAX_E164_DIGITS) return true; // classic group id shape
  if (RESERVED_HANDLES.has(digits)) return true;
  return false;
};

module.exports = {
  toContactIdentity,
  classifyIdentifier,
  isNonUserIdentifier,
  USER_SUFFIX,
  LID_SUFFIX,
  MAX_E164_DIGITS,
  MIN_E164_DIGITS,
};