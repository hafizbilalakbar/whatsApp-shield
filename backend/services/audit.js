// Privacy-conscious audit logging for compliance-relevant actions.
// Records WHAT happened (action, outcome, phone, origin, code) — never message
// bodies, credentials, or API keys. The log is rotated to keep disk bounded.

const fs = require('fs');
const path = require('path');
const { redact } = require('./stability');

const AUDIT_FILE = path.join(__dirname, '..', 'audit.log');
const AUDIT_MAX_BYTES = 8 * 1024 * 1024;

function rotate() {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return;
    const size = fs.statSync(AUDIT_FILE).size;
    if (size >= AUDIT_MAX_BYTES) {
      const rotated = AUDIT_FILE + '.1';
      if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
      fs.renameSync(AUDIT_FILE, rotated);
    }
  } catch (_) {}
}

function audit({ action, outcome = 'ok', phone = null, ip = null, origin = null, code = null, detail = null }) {
  const entry = {
    ts: new Date().toISOString(),
    action,
    outcome,
  };
  if (phone) entry.phone = String(phone).replace(/\D/g, '');
  if (ip) entry.ip = redact(String(ip));
  if (origin) entry.origin = redact(String(origin));
  if (code) entry.code = String(code);
  if (detail !== null && detail !== undefined) entry.detail = redact(String(detail));
  try {
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (_) {}
}

module.exports = { audit, rotate }; // rotate exported for the periodic rotator