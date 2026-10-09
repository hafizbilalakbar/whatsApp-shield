// Privacy-conscious audit logging for compliance-relevant actions.
// Records WHAT happened (action, outcome, masked phone, origin, code) — never
// message bodies, credentials, API keys, full phone numbers, or the QR payload.
//
// The log lives in backend/logs/ (never the backend root), is retention-pruned,
// size-rotated, and can be truncated / partially purged by clearSessionData.

const fs = require('fs');
const path = require('path');
const { sanitizeForLog, maskPhone } = require('./log-sanitizer');

const AUDIT_DIR = path.join(__dirname, '..', 'logs');
const AUDIT_FILE = path.join(AUDIT_DIR, 'audit.log');

// Rotate the active file once it exceeds this size, keeping at most
// AUDIT_MAX_FILES rotated copies (audit.log.1 .. audit.log.N); older ones are
// deleted. Entries older than AUDIT_RETENTION_DAYS are pruned on maintenance.
const AUDIT_MAX_BYTES = Number(process.env.AUDIT_MAX_BYTES) || 2 * 1024 * 1024;
const AUDIT_MAX_FILES = Number(process.env.AUDIT_MAX_FILES) || 2;
const AUDIT_RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS) || 30;
const AUDIT_DEDUPE_MS = Number(process.env.AUDIT_DEDUPE_MS) || 5000;

let ensuredDir = false;
function ensureDir() {
  if (ensuredDir) return;
  try { fs.mkdirSync(AUDIT_DIR, { recursive: true }); } catch (_) {}
  ensuredDir = true;
}
ensureDir();

// action|outcome -> ms timestamp of the last write, for short-window duplicate
// suppression (a single logout arrives over BOTH the WebSocket and the REST
// route; the pair must collapse to one entry).
const lastWriteAt = new Map();

function rotatedPath(i) {
  return `${AUDIT_FILE}.${i}`;
}

/**
 * Size-rotate the active log. Safe/no-op when the file is missing or locked.
 * @returns {boolean} whether a rotation happened
 */
function rotate() {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return false;
    if (fs.statSync(AUDIT_FILE).size < AUDIT_MAX_BYTES) return false;
    // Drop the oldest rotated file beyond the cap, then shift .n -> .(n+1).
    const oldest = rotatedPath(AUDIT_MAX_FILES);
    if (fs.existsSync(oldest)) fs.rmSync(oldest, { force: true });
    for (let i = AUDIT_MAX_FILES - 1; i >= 1; i--) {
      const src = rotatedPath(i);
      if (fs.existsSync(src)) {
        try { fs.renameSync(src, rotatedPath(i + 1)); } catch (_) {}
      }
    }
    fs.renameSync(AUDIT_FILE, rotatedPath(1));
    return true;
  } catch (_) {
    return false;
  }
}

function isOlderThan(line, cutoffMs) {
  try {
    const t = Date.parse(JSON.parse(line).ts);
    return Number.isFinite(t) && t < cutoffMs;
  } catch (_) {
    // Keep unparseable lines rather than silently discarding unknown data.
    return false;
  }
}

/**
 * Delete entries older than the retention window. Safe when the file is
 * missing or locked.
 * @returns {number} number of lines removed
 */
function pruneOld(retentionDays = AUDIT_RETENTION_DAYS) {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return 0;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n');
    const kept = lines.filter((l) => l.trim() === '' || !isOlderThan(l, cutoff));
    const removed = lines.length - kept.length;
    if (removed > 0) fs.writeFileSync(AUDIT_FILE, kept.join('\n'), 'utf8');
    return removed;
  } catch (_) {
    return 0;
  }
}

/** Startup + daily retention/rotation pass. Never throws. */
function maintenance() {
  let rotated = false;
  let pruned = 0;
  try { rotated = rotate(); } catch (_) {}
  try { pruned = pruneOld(); } catch (_) {}
  return { rotated, pruned };
}

/** Truncate the active audit log (used by "clear all history"). Never throws. */
function clear() {
  try { fs.writeFileSync(AUDIT_FILE, '', 'utf8'); return true; } catch (_) { return false; }
}

/**
 * Remove session-lifecycle entries (action starting with "session."), EXCEPT the
 * terminating "session.logout" record itself. Used on a full logout so the ended
 * session's connected/qr entries do not linger while the logout record remains
 * (later, Delete History truncates the whole file). Never throws.
 * @returns {number} number of lines removed
 */
function removeSessionEntries() {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return 0;
    const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n');
    const kept = lines.filter((l) => {
      if (l.trim() === '') return true;
      try {
        const action = String(JSON.parse(l).action || '');
        return action === 'session.logout' || !/^session\./.test(action);
      } catch (_) { return true; }
    });
    const removed = lines.length - kept.length;
    if (removed > 0) fs.writeFileSync(AUDIT_FILE, kept.join('\n'), 'utf8');
    return removed;
  } catch (_) {
    return 0;
  }
}

function audit({ action, outcome = 'ok', phone = null, ip = null, origin = null, code = null, detail = null, dedupeMs = 0 }) {
  const entry = {
    ts: new Date().toISOString(),
    action,
    outcome,
  };
  if (phone) entry.phone = maskPhone(phone) || undefined;
  if (ip) entry.ip = sanitizeForLog(String(ip));
  if (origin) entry.origin = sanitizeForLog(String(origin));
  if (code) entry.code = String(code);
  if (detail !== null && detail !== undefined) entry.detail = sanitizeForLog(String(detail));

  // Short-window duplicate suppression: identical action+outcome writes within
  // `dedupeMs` collapse to a single entry. A differing outcome (e.g. a failed
  // REST call after a successful WS call) is still recorded.
  if (dedupeMs > 0) {
    const key = `${action}|${outcome}`;
    const now = Date.now();
    if (now - (lastWriteAt.get(key) || 0) < dedupeMs) return;
    lastWriteAt.set(key, now);
  }

  try {
    ensureDir();
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (_) {
    // Never let audit persistence break a request path.
  }
}

module.exports = {
  audit,
  rotate,
  pruneOld,
  maintenance,
  clear,
  removeSessionEntries,
  AUDIT_FILE,
  AUDIT_RETENTION_DAYS,
};
