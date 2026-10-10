'use strict';

/**
 * Centralized Session Manager
 *
 * Owns ALL session filesystem operations: paths, loading, saving, locking, cleanup.
 * No other module should touch session folders directly.
 *
 * Structure: backend/sessions/<sessionId>/
 * - creds.json, pre-key-*.json, session-*.json, app-state-sync-*.json
 * - .session.lock (single-instance lock per session)
 * - contact_names.json (display name cache)
 *
 * Logs go to backend/logs/ (never inside session folders)
 * Configurable via SESSION_BASE_DIR env var (defaults to backend/sessions)
 */

const fs = require('fs');
const path = require('path');
const { sanitizeForLog, sanitizeMessage } = require('./log-sanitizer');

class SessionManager {
  constructor(options = {}) {
    this.backendDir = options.backendDir || path.join(__dirname, '..');
    this.baseDir = options.baseDir || path.join(this.backendDir, 'sessions');
    this.logsDir = options.logsDir || path.join(this.backendDir, 'logs');
    this.scanStateDir = options.scanStateDir || path.join(this.backendDir, 'scan-state');
    this.profilePicDir = options.profilePicDir || path.join(this.backendDir, 'cache', 'profile-pictures');
    this.pdfExportDir = options.pdfExportDir || path.join(this.backendDir, 'pdf_export');
    this.campaignHistoryFile = options.campaignHistoryFile || path.join(this.backendDir, 'campaign_history.json');
    this.contactsFile = options.contactsFile || path.join(this.backendDir, 'contacts.json');
    // Compliance-sensitive data — NEVER removed unless explicitly opted in.
    this.complianceFiles = options.complianceFiles || [
      path.join(this.backendDir, 'opt_out_log.json'),
      path.join(this.backendDir, 'suppression_list.json'),
      path.join(this.backendDir, 'blocked_contacts.json'),
      path.join(this.backendDir, 'transfer_rules.json'),
    ];
    this.currentSessionId = null;
    this.currentSessionPath = null;
    this.lockFile = '.session.lock';
    this.lockHandle = null;
    this._lockReleased = false;

    // Ensure base directories exist
    this._ensureBaseDirs();
  }

  _ensureBaseDirs() {
    fs.mkdirSync(this.baseDir, { recursive: true });
    fs.mkdirSync(this.logsDir, { recursive: true });
  }

  /**
   * Generate a stable session ID from phone number or use a default
   * For single-session mode, we use 'default' as the session ID
   */
  generateSessionId(phoneNumber = null) {
    if (phoneNumber) {
      return `session_${phoneNumber.replace(/\D/g, '')}`;
    }
    return 'default';
  }

  /**
   * Get the session directory path for a session ID
   */
  getSessionPath(sessionId) {
    return path.join(this.baseDir, sessionId);
  }

  /**
   * Acquire exclusive lock for a session
   * Returns { acquired: boolean, lockPath: string, release: function, holder?: object }
   * Stale locks (dead PID) are automatically reclaimed
   */
  acquireLock(sessionId) {
    const sessionPath = this.getSessionPath(sessionId);
    const lockPath = path.join(sessionPath, this.lockFile);

    fs.mkdirSync(sessionPath, { recursive: true });

    const readLock = () => {
      try {
        if (!fs.existsSync(lockPath)) return null;
        const raw = fs.readFileSync(lockPath, 'utf8').trim();
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return { pid: Number(parsed.pid), startedAt: parsed.startedAt || null };
      } catch (_) {
        return null;
      }
    };

    const isProcessAlive = (pid) => {
      if (!Number.isInteger(pid) || pid <= 0) return false;
      try {
        process.kill(pid, 0);
        return true;
      } catch (err) {
        if (err && err.code === 'EPERM') return true;
        return false;
      }
    };

    const existing = readLock();

    // Another live process holds the lock
    if (existing && existing.pid !== process.pid && isProcessAlive(existing.pid)) {
      return { acquired: false, lockPath, release: () => {}, holder: existing };
    }

    // We already hold the lock (re-entrant)
    if (existing && existing.pid === process.pid) {
      return { acquired: true, lockPath, release: () => {} };
    }

    // Stale lock - reclaim it
    if (existing) {
      console.warn(`[SessionManager] Reclaiming stale session lock from PID ${existing.pid} for session ${sessionId}`);
    }

    const payload = JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), sessionId });

    try {
      // 'wx' flag fails if file exists - atomic claim
      fs.writeFileSync(lockPath, payload, { encoding: 'utf8', flag: 'wx' });
    } catch (err) {
      // Lost race - re-read
      const nowHolder = readLock();
      if (nowHolder && nowHolder.pid !== process.pid && isProcessAlive(nowHolder.pid)) {
        return { acquired: false, lockPath, release: () => {}, holder: nowHolder };
      }
      // Race resolved in our favor or stale, force write
      try { fs.writeFileSync(lockPath, payload, 'utf8'); } catch (_) {}
    }

    this._lockReleased = false;
    const release = () => {
      if (this._lockReleased) return;
      this._lockReleased = true;
      try {
        const current = readLock();
        // Only remove if we still own it
        if (!current || current.pid === process.pid) {
          fs.unlinkSync(lockPath);
        }
      } catch (_) {}
    };

    // Auto-release on exit
    process.once('exit', release);
    process.once('SIGINT', () => { release(); process.exit(0); });
    process.once('SIGTERM', () => { release(); process.exit(0); });

    this.lockHandle = { release, lockPath };
    return { acquired: true, lockPath, release };
  }

  /**
   * Release the current session lock
   */
  releaseLock() {
    if (this.lockHandle) {
      this.lockHandle.release();
      this.lockHandle = null;
    }
    this._lockReleased = true;
  }

  /**
   * Check if a session exists and has valid credentials
   */
  sessionExists(sessionId) {
    const sessionPath = this.getSessionPath(sessionId);
    const credsPath = path.join(sessionPath, 'creds.json');
    return fs.existsSync(credsPath);
  }

  /**
   * True when parsed creds represent a genuinely linked WhatsApp session.
   * Baileys' `registered` flag is normally true after pairing, but some
   * versions/writes persist a paired session (with a linked `me` identity and
   * full key material) while leaving `registered` false. Both cases are valid;
   * a freshly-initialised, unpaired creds file (no `me`) is not.
   */
  _isRegistered(creds) {
    if (!creds || typeof creds !== 'object') return false;
    if (creds.registered === true) return true;
    const hasIdentity = !!(creds.me && creds.me.id);
    const hasKeys = !!(creds.noiseKey && creds.signedIdentityKey && creds.signedPreKey);
    return hasIdentity && hasKeys;
  }

  /**
   * Validate that a session is a usable, linked session
   */
  isSessionValid(sessionId) {
    const sessionPath = this.getSessionPath(sessionId);
    const credsPath = path.join(sessionPath, 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    try {
      return this._isRegistered(JSON.parse(fs.readFileSync(credsPath, 'utf8')));
    } catch (_) {
      return false;
    }
  }

  /**
   * Get session info (for status endpoint)
   */
  getSessionInfo(sessionId) {
    const sessionPath = this.getSessionPath(sessionId);
    const credsPath = path.join(sessionPath, 'creds.json');

    if (!fs.existsSync(credsPath)) {
      return { exists: false, valid: false, sessionId, path: sessionPath };
    }

    try {
      const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      const stats = fs.statSync(credsPath);
      return {
        exists: true,
        valid: this._isRegistered(creds),
        registered: this._isRegistered(creds),
        sessionId,
        path: sessionPath,
        creds: {
          noiseKey: creds.noiseKey ? 'present' : 'missing',
          pairingEphemeralKeyPair: creds.pairingEphemeralKeyPair ? 'present' : 'missing',
          signedIdentityKey: creds.signedIdentityKey ? 'present' : 'missing',
          signedPreKey: creds.signedPreKey ? 'present' : 'missing',
          registrationId: creds.registrationId,
          advSecretKey: creds.advSecretKey ? 'present' : 'missing',
        },
        modifiedAt: stats.mtime.toISOString(),
        size: stats.size,
      };
    } catch (err) {
      return { exists: true, valid: false, sessionId, path: sessionPath, error: err.message };
    }
  }

  /**
   * List all session directories
   */
  listSessions() {
    try {
      const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory())
        .map(e => this.getSessionInfo(e.name))
        .filter(s => s.exists);
    } catch (_) {
      return [];
    }
  }

  /**
   * Clean up orphaned/backup/stale session folders
   * NEVER deletes the currently active valid session
   * @param {string} activeSessionId - The session ID to protect
   * @returns {object} { deleted: [], kept: [], errors: [], legacy: object }
   */
  cleanupOrphanedSessions(activeSessionId = null) {
    const result = { deleted: [], kept: [], errors: [] };
    const sessions = this.listSessions();

    for (const session of sessions) {
      const sessionPath = session.path;
      const sessionId = session.sessionId;

      // Never delete the active valid session
      if (sessionId === activeSessionId && session.valid) {
        result.kept.push({ sessionId, reason: 'active_valid_session' });
        continue;
      }

      // Delete backup folders (session_*_backup, session_*_backup2, etc.)
      if (/_backup\d*$/.test(sessionId)) {
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          result.deleted.push({ sessionId, reason: 'backup_folder' });
        } catch (err) {
          result.errors.push({ sessionId, error: err.message });
        }
        continue;
      }

      // Delete empty session folders (no creds.json)
      if (!session.valid && !session.exists) {
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          result.deleted.push({ sessionId, reason: 'empty_or_invalid' });
        } catch (err) {
          result.errors.push({ sessionId, error: err.message });
        }
        continue;
      }

      // Delete stale lock files (handled by acquireLock, but clean any orphaned)
      const lockPath = path.join(sessionPath, this.lockFile);
      if (fs.existsSync(lockPath)) {
        try {
          const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
          const pid = Number(lockData.pid);
          if (pid && pid !== process.pid) {
            // Check if process is dead
            try {
              process.kill(pid, 0);
              // Process alive - keep lock
              result.kept.push({ sessionId, reason: 'lock_held_by_live_process', pid });
            } catch (_) {
              // Process dead - remove stale lock
              fs.unlinkSync(lockPath);
              result.deleted.push({ sessionId, reason: 'stale_lock_file' });
            }
          }
        } catch (_) {
          // Corrupt lock - remove
          try { fs.unlinkSync(lockPath); } catch (_) {}
          result.deleted.push({ sessionId, reason: 'corrupt_lock_file' });
        }
      }

      // Keep valid sessions that aren't the active one (could be other users)
      if (session.valid) {
        result.kept.push({ sessionId, reason: 'valid_session' });
      }
    }

    // Remove legacy session folders/backups/logs that live directly in the
    // backend root instead of under backend/sessions/.
    result.legacy = this.removeLegacyFolders(activeSessionId || 'default');

    return result;
  }

  _dirHasAuthMaterial(dir) {
    try {
      return fs.readdirSync(dir).some(f =>
        f === 'creds.json' ||
        /^pre-key-\d+\.json$/.test(f) ||
        /^session-\d+\.json$/.test(f) ||
        /^app-state-sync.*\.json$/.test(f)
      );
    } catch (_) {
      return false;
    }
  }

  /**
   * Remove legacy WhatsApp session folders that were left in the backend root
   * by older versions (session_auth_info*, *_backup*, *_empty, or any stray
   * directory containing raw auth material).
   *
   * SAFETY: this is a destructive sweep, so it refuses to delete anything at all
   * unless the live `sessions/default` credentials are valid & registered.
   * It never touches backend/sessions or known application directories.
   */
  removeLegacyFolders(activeSessionId = 'default') {
    const result = { guard: false, deleted: [], skipped: [] };
    const root = this.backendDir;

    if (!this.isSessionValid(activeSessionId)) {
      result.skipped.push({ reason: 'active_session_invalid', activeSessionId });
      return result;
    }
    result.guard = true;

    const LEGACY_NAME_RE = /^session_auth_info/i;
    const BACKUP_NAME_RE = /(^|[_-])backup\d*$/i;
    const EMPTY_NAME_RE = /(^|[_-])empty$/i;
    const KNOWN_DIRS = new Set([
      'sessions', 'logs', 'node_modules', 'scripts', 'services', 'cache',
      'pdf_export', 'scan-state', 'workspaces', '.git', '.opencode',
    ]);

    let entries = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (_) { return result; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (KNOWN_DIRS.has(name)) continue;
      const full = path.join(root, name);
      // Never touch the live session base (defensive; also covered by KNOWN_DIRS).
      if (path.resolve(full) === path.resolve(this.baseDir)) continue;

      const isLegacyName = LEGACY_NAME_RE.test(name) || BACKUP_NAME_RE.test(name) || EMPTY_NAME_RE.test(name);
      const looksLikeAuth = this._dirHasAuthMaterial(full);
      if (!isLegacyName && !looksLikeAuth) continue;

      try {
        fs.rmSync(full, { recursive: true, force: true });
        result.deleted.push({ name, reason: isLegacyName ? 'legacy_name' : 'auth_material' });
      } catch (err) {
        result.skipped.push({ name, error: err.message });
      }
    }

    // Stray legacy lock files and shield-gateway logs at the backend root.
    // Current logs live in backend/logs/, so any root-level shield-gateway.log
    // (often many MB) is stale and safe to remove.
    try {
      for (const f of fs.readdirSync(root)) {
        if (f === '.whatsapp-session.lock' || /^session.*\.lock$/i.test(f)) {
          try { fs.unlinkSync(path.join(root, f)); result.deleted.push({ name: f, reason: 'stray_lock' }); } catch (_) {}
        } else if (/^shield-gateway\.log(\.\d+)?$/i.test(f)) {
          try { fs.rmSync(path.join(root, f), { force: true }); result.deleted.push({ name: f, reason: 'stray_log' }); } catch (_) {}
        }
      }
    } catch (_) {}

    return result;
  }

  /**
   * Fully delete a session (on logout or explicit removal)
   */
  deleteSession(sessionId) {
    const sessionPath = this.getSessionPath(sessionId);
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      // Also clean any backup folders that might exist
      const backupPattern = `${sessionId}_backup`;
      try {
        const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith(backupPattern)) {
            fs.rmSync(path.join(this.baseDir, entry.name), { recursive: true, force: true });
          }
        }
      } catch (_) {}
      return true;
    } catch (err) {
      console.error(`[SessionManager] Failed to delete session ${sessionId}:`, err.message);
      return false;
    }
  }

  /**
   * Prepare a clean session directory for a new QR login
   * Removes any existing session data for this session ID first
   */
  prepareFreshSession(sessionId) {
    // Delete existing session completely
    this.deleteSession(sessionId);

    // Create fresh directory
    const sessionPath = this.getSessionPath(sessionId);
    fs.mkdirSync(sessionPath, { recursive: true });

    return sessionPath;
  }

  /**
   * Move the current session folder to a TIMESTAMPED BACKUP (non-destructive).
   *
   * Used by an explicit Connect/Relink: a dead (e.g. 403-denied) session must
   * not be resumed, but it also must never be hard-deleted — it is preserved so
   * the operator can inspect it. Backups live OUTSIDE baseDir
   * (backend/session_backups/) so they are never listed as sessions and never
   * reclaimed by cleanupOrphanedSessions / deleteSession.
   *
   * @returns {{ moved: boolean, backupPath: string|null, reason?: string, copied?: boolean }}
   */
  backupSession(sessionId) {
    const sessionPath = this.getSessionPath(sessionId);
    if (!fs.existsSync(sessionPath)) {
      return { moved: false, backupPath: null, reason: 'no_session_dir' };
    }
    const backupRoot = path.join(this.backendDir, 'session_backups');
    fs.mkdirSync(backupRoot, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupRoot, `${sessionId}_${stamp}`);

    // Preferred path: an atomic rename (no data copy, survives a crash).
    try {
      fs.renameSync(sessionPath, backupPath);
      return { moved: true, backupPath };
    } catch (err) {
      // Windows can refuse a directory rename when a handle is still open.
      // Fall back to a copy; the original is only removed AFTER the copy is
      // verified to exist, so the session is never lost.
      try {
        fs.cpSync(sessionPath, backupPath, { recursive: true });
        if (fs.existsSync(path.join(backupPath, 'creds.json')) ||
            fs.readdirSync(backupPath).length > 0) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          return { moved: true, backupPath, copied: true };
        }
        return { moved: false, backupPath, reason: 'copy_incomplete' };
      } catch (err2) {
        return { moved: false, backupPath, reason: err2.message };
      }
    }
  }

  // ---- Atomic writes -------------------------------------------------------

  /**
   * Write a file atomically: write to a temp sibling then rename into place.
   * A crash mid-write therefore can never leave a truncated/corrupt file.
   */
  writeFileAtomic(filePath, data) {
    const tmp = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, data, 'utf8');
    try {
      fs.renameSync(tmp, filePath);
    } catch (err) {
      try { fs.rmSync(tmp, { force: true }); } catch (_) {}
      throw err;
    }
  }

  /**
   * Atomically persist WhatsApp creds.json. `serializedCreds` is the already
   * JSON.stringify'd creds (encode Buffers with BufferJSON.replacer first).
   */
  saveCredsAtomic(sessionPath, serializedCreds) {
    fs.mkdirSync(sessionPath, { recursive: true });
    const target = path.join(sessionPath, 'creds.json');
    this.writeFileAtomic(target, serializedCreds);
    return target;
  }

  // ---- Logging -------------------------------------------------------------

  /**
   * Get the path for the shield-gateway log (outside session folders)
   */
  getShieldLogPath() {
    return path.join(this.logsDir, 'shield-gateway.log');
  }

  _shieldLogFiles() {
    try {
      return fs.readdirSync(this.logsDir)
        .filter(f => f === 'shield-gateway.log' || /^shield-gateway\.log\.\d+$/.test(f))
        .map(f => path.join(this.logsDir, f));
    } catch (_) {
      return [];
    }
  }

  /**
   * Rotate any log file when it exceeds maxBytes, keeping at most maxFiles
   * rotated generations and pruning any older than maxAgeDays.
   */
  rotateLogFile(filePath, { maxBytes = 8 * 1024 * 1024, maxFiles = 5, maxAgeDays = 7 } = {}) {
    const result = { rotated: false, pruned: [] };
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > maxBytes) {
        for (let i = maxFiles - 1; i >= 1; i--) {
          const src = `${filePath}.${i}`;
          const dst = `${filePath}.${i + 1}`;
          if (fs.existsSync(src)) {
            try { fs.rmSync(dst, { force: true }); } catch (_) {}
            try { fs.renameSync(src, dst); } catch (_) {}
          }
        }
        try { fs.rmSync(`${filePath}.1`, { force: true }); } catch (_) {}
        fs.renameSync(filePath, `${filePath}.1`);
        result.rotated = true;
      }

      const dir = path.dirname(filePath);
      const base = path.basename(filePath);
      const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
      for (const f of fs.readdirSync(dir)) {
        if (!f.startsWith(`${base}.`)) continue;
        const idxMatch = f.match(/\.(\d+)$/);
        const full = path.join(dir, f);
        let remove = false;
        try {
          if (idxMatch && Number(idxMatch[1]) > maxFiles) remove = true;
          else if (fs.statSync(full).mtimeMs < cutoff) remove = true;
        } catch (_) {}
        if (remove) {
          try { fs.rmSync(full, { force: true }); result.pruned.push(f); } catch (_) {}
        }
      }
    } catch (err) {
      console.error('Failed to rotate log:', err.message);
    }
    return result;
  }

  /**
   * Rotate shield-gateway.log if it exceeds max size (back-compat wrapper)
   */
  rotateShieldLog(maxBytes = 8 * 1024 * 1024, opts = {}) {
    const res = this.rotateLogFile(this.getShieldLogPath(), { maxBytes, maxFiles: opts.maxFiles || 5, maxAgeDays: opts.maxAgeDays || 7 });
    if (res.rotated) console.log(`[LOG_ROTATE] ${this.getShieldLogPath()} rotated`);
    return res;
  }

  /**
   * Append to shield-gateway.log (non-blocking). Message and data are sanitized
   * so QR payloads, secrets and phone numbers never reach disk.
   */
  appendShieldLog(level, message, data = null) {
    const entry = { timestamp: new Date().toISOString(), level, message: sanitizeMessage(message) };
    if (data !== undefined && data !== null) entry.data = sanitizeForLog(data);
    const line = JSON.stringify(entry) + '\n';
    const logPath = this.getShieldLogPath();

    // Fire-and-forget async write
    fs.promises.appendFile(logPath, line, 'utf8').catch(err => {
      console.error('Failed to write to shield-gateway.log:', err);
    });
  }

  // ---- clearSessionData ----------------------------------------------------

  _writeJsonAtomic(file, obj) {
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  _clearScanState() {
    let n = 0;
    if (!fs.existsSync(this.scanStateDir)) return n;
    for (const f of fs.readdirSync(this.scanStateDir)) {
      try { fs.rmSync(path.join(this.scanStateDir, f), { recursive: true, force: true }); n++; } catch (_) {}
    }
    return n;
  }

  _clearProfilePictureCache(onlyNumbers = null) {
    let n = 0;
    if (!fs.existsSync(this.profilePicDir)) return n;
    const filter = Array.isArray(onlyNumbers) && onlyNumbers.length
      ? new Set(onlyNumbers.map(x => String(x).replace(/\D/g, '')))
      : null;
    for (const f of fs.readdirSync(this.profilePicDir)) {
      if (filter) {
        const base = f.replace(/\.[a-z0-9]+$/i, '');
        if (!filter.has(base)) continue;
      }
      try { fs.rmSync(path.join(this.profilePicDir, f), { recursive: true, force: true }); n++; } catch (_) {}
    }
    return n;
  }

  _clearPdfExports() {
    let n = 0;
    if (!fs.existsSync(this.pdfExportDir)) return n;
    for (const f of fs.readdirSync(this.pdfExportDir)) {
      try { fs.rmSync(path.join(this.pdfExportDir, f), { recursive: true, force: true }); n++; } catch (_) {}
    }
    return n;
  }

  _clearShieldLogs(note = null) {
    for (const f of this._shieldLogFiles()) {
      try { fs.rmSync(f, { force: true }); } catch (_) {}
    }
    if (note) {
      try {
        fs.appendFileSync(this.getShieldLogPath(), JSON.stringify({
          timestamp: new Date().toISOString(), level: 'INFO', message: sanitizeMessage(note),
        }) + '\n', 'utf8');
      } catch (_) {}
    }
    return true;
  }

  _removeShieldLogEntries(jobIds = []) {
    const set = new Set((jobIds || []).map(String).filter(Boolean));
    if (!set.size) return 0;
    let removed = 0;
    for (const f of this._shieldLogFiles()) {
      let lines;
      try { lines = fs.readFileSync(f, 'utf8').split('\n'); } catch (_) { continue; }
      const kept = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        let drop = false;
        try {
          const parsed = JSON.parse(line);
          const d = parsed && parsed.data ? parsed.data : {};
          const id = String(d.jobId ?? d.campaignId ?? d.id ?? '');
          if (id && set.has(id)) drop = true;
        } catch (_) {}
        if (!drop) {
          for (const id of set) { if (line.includes(id)) { drop = true; break; } }
        }
        if (drop) removed++; else kept.push(line);
      }
      try { fs.writeFileSync(f, kept.join('\n') + (kept.length ? '\n' : ''), 'utf8'); } catch (_) {}
    }
    return removed;
  }

  _removeCampaignHistoryEntries(jobIds = []) {
    const set = new Set((jobIds || []).map(String).filter(Boolean));
    if (!set.size || !fs.existsSync(this.campaignHistoryFile)) return 0;
    let arr;
    try { arr = JSON.parse(fs.readFileSync(this.campaignHistoryFile, 'utf8')); } catch (_) { return 0; }
    if (!Array.isArray(arr)) return 0;
    const before = arr.length;
    const kept = arr.filter(c => !(set.has(String(c?.id)) || set.has(String(c?.jobId))));
    if (kept.length !== before) this._writeJsonAtomic(this.campaignHistoryFile, kept);
    return before - kept.length;
  }

  _removeContacts(numbers = []) {
    const set = new Set((numbers || []).map(n => String(n).replace(/\D/g, '')).filter(Boolean));
    if (!set.size || !fs.existsSync(this.contactsFile)) return 0;
    let arr;
    try { arr = JSON.parse(fs.readFileSync(this.contactsFile, 'utf8')); } catch (_) { return 0; }
    if (!Array.isArray(arr)) return 0;
    const before = arr.length;
    const kept = arr.filter(c => {
      const num = String(c?.phone ?? c?.number ?? c?.phoneNumber ?? '').replace(/\D/g, '');
      return !(num && set.has(num));
    });
    if (kept.length !== before) this._writeJsonAtomic(this.contactsFile, kept);
    return before - kept.length;
  }

  _clearComplianceData() {
    const cleared = [];
    for (const f of this.complianceFiles) {
      try {
        if (fs.existsSync(f)) { fs.rmSync(f, { force: true }); cleared.push(path.basename(f)); }
      } catch (_) {}
    }
    return cleared;
  }

  /**
   * Central data-clearing entry point used by both Logout and Delete History.
   * Idempotent and disk-based, so it works correctly after a server restart.
   *
   * @param {string} sessionId
   * @param {object} options
   *   mode: 'logout' (default) | 'history'
   *   deleteComplianceData: opt-in compliance wipe (default false)
   *   jobIds: campaign/job ids whose history + log entries should be removed (history mode)
   *   contactNumbers: numbers to consider removing from contacts.json (history mode)
   *   clearInMemory: optional hook to reset in-memory caches in the caller
   *   logNote: optional single line left in the log after a full clear
   * @returns {object} summary of what was removed
   */
  async clearSessionData(sessionId = 'default', options = {}) {
    const {
      mode = 'logout',
      deleteComplianceData = false,
      jobIds = [],
      contactNumbers = [],
      clearInMemory = null,
      logNote = null,
    } = options;

    const summary = {
      ok: true, mode, sessionDeleted: false, logsCleared: false, logEntriesRemoved: 0,
      scanStateCleared: 0, profilePicsCleared: 0, pdfExportsCleared: 0,
      historyRemoved: 0, contactsRemoved: 0, complianceCleared: [], errors: [],
      auditCleared: false, auditEntriesRemoved: 0,
    };

    if (mode === 'history') {
      try { summary.historyRemoved = this._removeCampaignHistoryEntries(jobIds); } catch (e) { summary.errors.push(`history: ${e.message}`); }
      try { summary.contactsRemoved = this._removeContacts(contactNumbers); } catch (e) { summary.errors.push(`contacts: ${e.message}`); }
      try { summary.profilePicsCleared = this._clearProfilePictureCache(contactNumbers.length ? contactNumbers : null); } catch (e) { summary.errors.push(`pics: ${e.message}`); }
      try { summary.logEntriesRemoved = this._removeShieldLogEntries(jobIds); summary.logsCleared = true; } catch (e) { summary.errors.push(`logs: ${e.message}`); }
      try { require('./audit').clear(); summary.auditCleared = true; } catch (e) { summary.errors.push(`audit: ${e.message}`); }
      try { summary.scanStateCleared = this._clearScanState(); } catch (e) { summary.errors.push(`scanstate: ${e.message}`); }
      if (typeof clearInMemory === 'function') { try { clearInMemory(); } catch (_) {} }
      return summary;
    }

    // Full logout cleanup
    try { this.deleteSession(sessionId); summary.sessionDeleted = true; } catch (e) { summary.errors.push(`session: ${e.message}`); }
    try { summary.scanStateCleared = this._clearScanState(); } catch (e) { summary.errors.push(`scanstate: ${e.message}`); }
    try { summary.profilePicsCleared = this._clearProfilePictureCache(); } catch (e) { summary.errors.push(`pics: ${e.message}`); }
    try { summary.pdfExportsCleared = this._clearPdfExports(); } catch (e) { summary.errors.push(`pdf: ${e.message}`); }
    try { summary.logEntriesRemoved = this._clearShieldLogs(logNote); summary.logsCleared = true; } catch (e) { summary.errors.push(`logs: ${e.message}`); }
    try { summary.auditEntriesRemoved = require('./audit').removeSessionEntries(); } catch (e) { summary.errors.push(`audit: ${e.message}`); }
    if (typeof clearInMemory === 'function') { try { clearInMemory(); } catch (_) {} }
    if (deleteComplianceData) {
      summary.complianceCleared = this._clearComplianceData();
    }
    return summary;
  }
}

// Singleton instance
let instance = null;

function getSessionManager(options) {
  if (!instance) {
    instance = new SessionManager(options);
  }
  return instance;
}

function resetSessionManager() {
  if (instance) {
    instance.releaseLock();
    instance = null;
  }
}

module.exports = { SessionManager, getSessionManager, resetSessionManager };
