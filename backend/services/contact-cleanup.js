'use strict';

// Removes CRM rows that can never be real people.
//
// Scopes strictly to identifiers that are NOT a 1-to-1 user:
//   - group / channel / broadcast / call / unknown-domain JIDs
//   - unresolved `@lid` ids
//   - placeholder values such as "+", "", "-" (the historic digit-strip bug
//     turned a stray "+" into a contact literally named "+")
//   - digit strings too long (>15, the group-id shape) or too short
//
// It never touches a valid E.164 contact, history, campaign results or the
// Shield session. Dry-run by default: nothing is written unless `apply` is true.

const fs = require('fs');
const path = require('path');
const { isNonUserIdentifier, classifyIdentifier, toContactIdentity } = require('./contact-identity');

const CONTACTS_FILE = path.join(__dirname, '..', 'contacts.json');

const readContacts = () => {
  if (!fs.existsSync(CONTACTS_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const writeContacts = (list) => {
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(list, null, 2), 'utf8');
};

/**
 * @param {object} [opts]
 * @param {boolean} [opts.apply] Actually write the cleaned list (default false).
 * @param {(msg:string)=>void} [opts.log]
 */
const purgeNonUserContacts = (opts = {}) => {
  const apply = opts.apply === true;
  const log = opts.log || ((m) => console.log(m));

  const contacts = readContacts();
  const kept = [];
  const removed = [];

  for (const contact of contacts) {
    const rawId = contact.phone || contact.id || '';
    const identity = toContactIdentity(rawId);

    if (identity) {
      // Valid person — normalise the stored phone to E.164 so the chat list
      // always renders a properly formatted number.
      if (contact.phone !== identity.e164) contact.phone = identity.e164;
      kept.push(contact);
      continue;
    }

    const verdict = classifyIdentifier(rawId);
    removed.push({
      id: contact.id,
      phone: contact.phone,
      name: contact.name,
      reason: isNonUserIdentifier(rawId)
        ? (verdict.reason || verdict.kind)
        : (verdict.reason || 'not a 1-to-1 contact'),
    });
  }

  if (apply && removed.length > 0) {
    writeContacts(kept);
    log(`[CLEANUP] Removed ${removed.length} non-user contact(s) from contacts.json.`);
  }

  return {
    total: contacts.length,
    kept: kept.length,
    removed,
    applied: apply && removed.length > 0,
  };
};

module.exports = { purgeNonUserContacts, CONTACTS_FILE };