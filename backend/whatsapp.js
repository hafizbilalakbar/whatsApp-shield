const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, jidNormalizedUser, isJidGroup, getBinaryNodeChild, DisconnectReason, BufferJSON } = require('@whiskeysockets/baileys');
// `/max` metadata, deliberately identical to the metadata the frontend generator
// validates against (src/data/numberingPlans.js). The backend used to parse with
// the default "min" build while the generator used "max", so the two halves of
// the app could disagree about the same number. There is now exactly ONE
// validation authority (libphonenumber-js/max) on both sides.
const { normalizeToInternationalDigits, validatePhoneNumber } = require('./services/number-validation');
const { classifyIdentifier } = require('./services/contact-identity');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { getSessionManager } = require('./services/sessionManager');
const { sanitizeForLog, sanitizeMessage } = require('./services/log-sanitizer');

// Guards against stalled Baileys socket queries (half-open connection, degraded
// network, etc.) so a single hung lookup can never freeze the whole bulk-check
// loop forever. On timeout the promise rejects and the loop's catch path
// produces an error result for that number and moves on.
const CHECK_TIMEOUT_MS = Number(process.env.WA_CHECK_TIMEOUT_MS) || 15000;
const WA_AVATAR_TIMEOUT_MS = Number(process.env.WA_AVATAR_TIMEOUT_MS) || 20000;

// Display-name cache bounds. Names come ONLY from data WhatsApp already pushes
// to the linked device (contact sync actions, rename/picture notifications, and
// inbound pushName fields) — never from any on-demand query, so resolving a
// Display Name costs zero extra network traffic. Bounds keep a long-lived
// session from ballooning memory or disk.
const CONTACT_NAMES_FILE = 'contact_names.json';
const CONTACT_NAME_CACHE_MAX = 50000;   // oldest entry evicted past this
const CONTACT_NAME_WATCH_MAX = 20000;   // max rows watched for a late name
const CONTACT_NAME_MAX_LEN = 48;        // display-name length cap

function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    if (timer && typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// Close reasons that mean the persisted session is no longer usable. These
// NEVER auto-reconnect — the device was logged out / forbidden / taken over or
// the stored credentials are corrupt, so a fresh QR scan is required. Every
// other close (network blip, connectionClosed, restartRequired, timeout) is
// transient: the credentials on disk are still valid and the session can be
// restored automatically.
const SESSION_INVALID_CODES = new Set([
  DisconnectReason.loggedOut,           // 401 — WhatsApp logged the device out
  DisconnectReason.forbidden,           // 403 — access forbidden
  405,                                  // 405 — browser/version rejected by WA servers
  DisconnectReason.badSession,          // 500 — corrupt/expired session data
  DisconnectReason.multideviceMismatch, // 411 — session mode mismatch
  DisconnectReason.connectionReplaced   // 440 — another device took over
]);

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.state = null;
    this.saveCreds = null;
    this.status = 'DISCONNECTED';
    this.qrCodeDataUrl = null;
    this.userInfo = null;
    this.onStatusChangeCallback = null;
    this.onUserUpdateCallback = null;
    this.onOwnProfilePictureCallback = null;
    this.onScannedProfilePictureCallback = null;
    this.onMessageCallback = null;
    this.onMessageStatusCallback = null;
    this.onScannedDisplayNameCallback = null;
    this._connecting = false;
    this._intentionalDisconnect = false;
    this._pendingPairing = false;
    this._connectTimeout = null;
    this._presenceInterval = null;
    this._sendHistory = new Map(); // jid -> [{text, ts}]
    this._sendCooldown = new Map(); // jid -> last send ts
    this._lastCheckAt = 0;
    // Global outbound budgets (across ALL contacts, not just per-contact) so a
    // burst of first-contact messages or lookups can never spike the account.
    this._globalSendTimes = [];      // ts of every successful send
    this._globalLookupTimes = [];    // ts of every checkNumber lookup
    this._consecutiveSendFailures = 0;
    this._sendBackoffUntil = 0;
    this._sendInFlight = false;
    this._autoRestoreAttempts = 0; // one-shot session restore after a transient drop
    this._avatarLoading = false;   // guards concurrent own-avatar loads per session
    this._qrGenerating = false;    // guards concurrent generateQRCode() calls
    // Display-name cache: cleanNumber -> { notify, name, updatedAt, source }.
    // Loaded lazily, persisted atomically, and fed exclusively by pushed
    // contact data (contacts.upsert / contacts.update / inbound pushName).
    this._contactNames = null;
    this._contactNamesLoaded = false;
    this._contactNamesDirty = false;
    this._contactNamesSaveTimer = null;
    this._nameWatchList = new Set(); // cleanNumbers awaiting a late display name
    
    // Session management - initialized in init()
    this.sessionManager = null;
    this.sessionId = null;
    this.sessionPath = null;
    this.sessionLock = null;
  }

  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  onMessageStatus(callback) {
    this.onMessageStatusCallback = callback;
  }

  logToShieldGateway(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const safeMessage = sanitizeMessage(message);
    const safeData = data === undefined || data === null ? data : sanitizeForLog(data);
    const logEntry = {
      timestamp,
      level,
      message: safeMessage,
      data: safeData
    };
    console.log(`[SHIELD_GATEWAY] ${level}: ${safeMessage}`);
    // Non-blocking: never appendFileSync here since this is called from
    // Baileys event callbacks and the scan loop - sync I/O blocks the
    // event loop and can cause WebSocket ping timeouts / reconnects.
    if (this.sessionManager) {
      this.sessionManager.appendShieldLog(level, safeMessage, safeData);
    }
  }

  // ---------------------------------------------------------------------------
  // Display-name cache
  // ---------------------------------------------------------------------------
  // Names are resolved ONLY from data the linked session is already receiving
  // (contact sync upserts, rename/picture notifications, inbound notify-message
  // pushNames). Resolving never issues a network request, so the bulk-check loop
  // is never slowed or rate-limited by name discovery. See _resolveContactName.
  _contactNameKeyFromJid(jid) {
    if (!jid) return null;
    try {
      const norm = jidNormalizedUser(String(jid).split(':')[0]);
      const digits = String(norm || '').split('@')[0].replace(/[^\d+]/g, '');
      return digits || null;
    } catch (err) {
      return null;
    }
  }

  // Clean a candidate name: collapse whitespace, kill control chars, cap length,
  // and treat a pure digits/punctuation string as "not a name" so a phone number
  // is never shown in the Display Name column (requirement: never substitute the
  // number for a name).
  _cleanNameValue(v) {
    if (v == null) return null;
    let s = String(v).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    if (s.length > CONTACT_NAME_MAX_LEN) s = s.slice(0, CONTACT_NAME_MAX_LEN).trim();
    if (/^[+\d\s\-().]{4,}$/.test(s) && s.replace(/\D/g, '').length >= 6) return null;
    return s;
  }

  _loadContactNames() {
    if (this._contactNamesLoaded) return;
    this._contactNamesLoaded = true;
    this._contactNames = new Map();
    if (!this.sessionManager || !this.sessionPath) return;
    try {
      const file = path.join(this.sessionPath, CONTACT_NAMES_FILE);
      if (!fs.existsSync(file)) return;
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && Array.isArray(data.contacts)) {
        for (const c of data.contacts) {
          if (!c || !c.digits) continue;
          this._contactNames.set(String(c.digits), {
            notify: c.notify || null,
            name: c.name || null,
            updatedAt: Number(c.updatedAt) || 0,
            source: c.source || 'restored'
          });
        }
      }
    } catch (err) {
      console.warn('[CONTACT_NAMES] Failed to load cached display names:', err.message);
    }
  }

  _flushContactNames() {
    this._contactNamesDirty = false;
    if (this._contactNamesSaveTimer) {
      clearTimeout(this._contactNamesSaveTimer);
      this._contactNamesSaveTimer = null;
    }
    if (!this._contactNamesLoaded) return;
    if (!this.sessionManager || !this.sessionPath) return;
    const entries = [];
    for (const [digits, v] of this._contactNames) {
      entries.push({ digits, notify: v.notify, name: v.name, updatedAt: v.updatedAt, source: v.source });
    }
    const file = path.join(this.sessionPath, CONTACT_NAMES_FILE);
    const tmp = `${file}.tmp`;
    fs.promises.mkdir(this.sessionPath, { recursive: true })
      .then(() => fs.promises.writeFile(tmp, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), contacts: entries }), 'utf8'))
      .then(() => fs.promises.rename(tmp, file))
      .catch((err) => {
        if (err && err.code !== 'ENOENT') console.warn('[CONTACT_NAMES] Failed to persist cached display names:', err.message);
      });
  }

  _scheduleContactNamesSave() {
    if (this._contactNamesSaveTimer) return;
    this._contactNamesSaveTimer = setTimeout(() => {
      this._contactNamesSaveTimer = null;
      this._flushContactNames();
    }, 2000);
    if (this._contactNamesSaveTimer && typeof this._contactNamesSaveTimer.unref === 'function') {
      this._contactNamesSaveTimer.unref();
    }
  }

  // Feed names arriving from pushed contact events / inbound messages into the
  // cache. Single-flight by key; fires the follow-up callback for numbers that
  // were already scanned without a name so live rows can be patched in place.
  _ingestContactContacts(records, source) {
    if (!Array.isArray(records) || records.length === 0) return;
    this._loadContactNames();
    let changed = false;
    for (const rec of records) {
      if (!rec || typeof rec !== 'object') continue;
      const key = this._contactNameKeyFromJid(rec.id) || this._contactNameKeyFromJid(rec.jid) || this._contactNameKeyFromJid(rec.lid);
      if (!key) continue;
      const notify = this._cleanNameValue(rec.notify);
      const name = this._cleanNameValue(rec.name);
      if (!notify && !name) continue;
      const prev = this._contactNames.get(key);
      if (prev && prev.notify === notify && prev.name === name) continue;
      this._contactNames.set(key, {
        notify: notify || (prev ? prev.notify : null),
        name: name || (prev ? prev.name : null),
        updatedAt: Date.now(),
        source
      });
      changed = true;
      if (this._contactNames.size > CONTACT_NAME_CACHE_MAX) {
        let oldestKey = null;
        let oldestTs = Infinity;
        for (const [k, v] of this._contactNames) {
          if (v.updatedAt < oldestTs) {
            oldestTs = v.updatedAt;
            oldestKey = k;
          }
        }
        if (oldestKey) this._contactNames.delete(oldestKey);
      }
      const resolved = this._cleanNameValue(notify || name);
      if (resolved && this._nameWatchList.delete(key) && this.onScannedDisplayNameCallback) {
        try {
          this.onScannedDisplayNameCallback(key, resolved);
        } catch (err) {
          console.warn('[CONTACT_NAMES] Display-name follow-up callback failed:', err.message);
        }
      }
    }
    if (changed) this._scheduleContactNamesSave();
  }

  // Best push/personal name for a clean number: the contact's own push name
  // (notify) first, then the address-book saved name. Never issues a request.
  _resolveContactName(cleanNumber) {
    if (!cleanNumber) return null;
    this._loadContactNames();
    const entry = this._contactNames.get(String(cleanNumber));
    if (!entry) return null;
    return this._cleanNameValue(entry.notify) || this._cleanNameValue(entry.name) || null;
  }

  // Register a number (already scanned, no name found) so an arriving push name
  // can patch its live row. Bounded FIFO so a huge scan can never grow it.
  _watchDisplayName(cleanNumber) {
    if (!cleanNumber) return;
    if (this._nameWatchList.size >= CONTACT_NAME_WATCH_MAX) {
      const first = this._nameWatchList.keys().next();
      if (!first.done) this._nameWatchList.delete(first.value);
    }
    this._nameWatchList.add(String(cleanNumber));
  }

  init(onStatusChange) {
    this.onStatusChangeCallback = onStatusChange;
    
    // Initialize SessionManager
    this.sessionManager = getSessionManager();
    this.sessionId = this.sessionManager.generateSessionId(); // 'default' for single-session mode
    this.sessionPath = this.sessionManager.getSessionPath(this.sessionId);
    
    // Acquire single-instance lock for this session
    this.sessionLock = this.sessionManager.acquireLock(this.sessionId);
    if (!this.sessionLock.acquired) {
      const holder = this.sessionLock.holder || {};
      console.error(
        '\n' +
        '='.repeat(72) +
        '\n' +
        'REFUSING TO START — ANOTHER BACKEND IS ALREADY USING THIS WHATSAPP SESSION.\n' +
        '='.repeat(72) +
        `\nAnother backend process (PID ${holder.pid}) is already\n` +
        `using the session folder:\n  ${this.sessionPath}\n\n` +
        'Running two backends against one WhatsApp account corrupts the Signal key\n' +
        'store and produces endless "Bad MAC" decrypt errors.\n\n' +
        'Fix: close the other terminal / stop the duplicate process, then start again.\n' +
        '='.repeat(72) + '\n'
      );
      process.exit(1);
    }
    console.log(`[INSTANCE] Session lock acquired (PID ${process.pid}) for ${this.sessionPath}`);
    
    // Run cleanup of orphaned/backup folders on startup (protects active session)
    const cleanupResult = this.sessionManager.cleanupOrphanedSessions(this.sessionId);
    if (cleanupResult.deleted.length > 0) {
      console.log('[INIT] Cleaned up orphaned session folders:', cleanupResult.deleted.map(d => d.sessionId).join(', '));
    }
    
    const credsPath = path.join(this.sessionPath, 'creds.json');
    const hasSession = fs.existsSync(credsPath);
    console.log(`[INIT] Session directory: ${this.sessionPath}`);
    console.log(`[INIT] creds.json exists: ${hasSession}`);
    if (hasSession) {
      const stats = fs.statSync(credsPath);
      console.log(`[INIT] creds.json size: ${stats.size} bytes, modified: ${stats.mtime.toISOString()}`);
    }
    this._connecting = false;
    // Restore a previously persisted session automatically (no QR needed) so a
    // backend restart or transient drop never forces the user to re-link. If
    // the stored credentials were invalidated by WhatsApp, the restore fails
    // cleanly and the app falls back to the QR flow.
    if (hasSession) {
      console.log('[INIT] Persisted session found — restoring automatically.');
      this.connect().catch((err) => {
        console.warn('[INIT] Session restore failed:', err.message);
        this.updateStatus('DISCONNECTED', { error: err.message });
      });
    } else {
      this.updateStatus('DISCONNECTED');
    }
  }

  updateStatus(newStatus, additionalData = {}) {
    this.status = newStatus;
    if (newStatus !== 'QR_CODE') {
      this.qrCodeDataUrl = null;
    }
    if (newStatus !== 'CONNECTED') {
      this.userInfo = null;
    }
    
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback({
        status: this.status,
        qr: this.qrCodeDataUrl,
        user: this.userInfo,
        ...additionalData
      });
    }
  }

  // Fetch the connected user's own profile picture without blocking the
  // CONNECTED transition. Bounded by timeouts; failures are non-fatal and the
  // UI already falls back to initials.
  //
  // Two things are done here so the header avatar appears immediately after QR
  // login (no page refresh):
  //   1. Resolve the own-picture URL and broadcast a lightweight USER_UPDATE so
  //      the frontend has the direct signed URL as soon as possible.
  //   2. Fetch the picture BYTES and hand them to server.js's cache callback so
  //      the /api/profile-picture proxy endpoint serves the avatar instantly on
  //      the very first browser request (instead of triggering a slow WhatsApp
  //      lookup that used to leave the avatar stuck until a manual refresh).
  async _loadOwnAvatar(jid) {
    if (this._avatarLoading) return;
    this._avatarLoading = true;
    try {
      const number = String(jid || '').split(':')[0].split('@')[0].replace(/\D/g, '');
      if (!number || !this.sock) return;
      const jidToQuery = `${number}@s.whatsapp.net`;

      const avatarUrl = await withTimeout(
        this.sock.profilePictureUrl(jidToQuery, 'image', 8000),
        8000,
        '_loadOwnAvatar.profilePictureUrl'
      );
      if (avatarUrl && this.sock && this.status === 'CONNECTED') {
        this.userInfo.avatar = avatarUrl;
        if (this.onUserUpdateCallback) {
          this.onUserUpdateCallback(this.userInfo);
        }
      }

      const pic = await this.getProfilePicture(number);
      if (pic && pic.data && this.onOwnProfilePictureCallback && this.sock && this.status === 'CONNECTED') {
        this.onOwnProfilePictureCallback(number, { data: pic.data, contentType: pic.contentType });
      }
    } catch (e) {
      // Non-fatal: the avatar is decorative and the UI shows initials instead.
    } finally {
      this._avatarLoading = false;
    }
  }

  // Fetch the bytes of a pps.whatsapp.net picture URL produced by the app's own
  // authorized session (never an arbitrary URL). Bounded by a timeout; returns
  // { data, contentType } or null when unavailable/not-an-image.
  async fetchPictureBytes(url) {
    if (!url) return null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const data = Buffer.from(await res.arrayBuffer());
      if (!data.length) return null;
      return { data, contentType: res.headers.get('content-type') || 'image/jpeg' };
    } catch (e) {
      // Non-fatal: the caller serves a cached copy or a fallback avatar.
      return null;
    }
  }

  // Retrieve the bytes of a number's PUBLIC profile picture through the app's
  // own authorized WhatsApp session. This is the same official API used by
  // checkNumber (Baileys profilePictureUrl); it returns a URL only when the
  // account has a publicly available picture, and the jid is built server-side
  // so no arbitrary URLs are ever requested. Returns { data, contentType } or
  // null when unavailable/disconnected/not-a-picture.
  async getProfilePicture(phoneNumber) {
    if (!phoneNumber || this.status !== 'CONNECTED' || !this.sock) return null;
    try {
      const clean = String(phoneNumber).replace(/\D/g, '');
      if (!clean) return null;
      const jid = `${clean}@s.whatsapp.net`;
      const url = await withTimeout(this.sock.profilePictureUrl(jid, 'image'), WA_AVATAR_TIMEOUT_MS, 'getProfilePicture');
      if (!url) return null;
      return await this.fetchPictureBytes(url);
    } catch (e) {
      // Non-fatal: the caller serves a cached copy or a fallback avatar.
      return null;
    }
  }

  // Resolve a scanned contact's PUBLIC profile-picture URL through the app's own
  // authorized session, with a bounded retry for transient WhatsApp hiccups so a
  // single flaky w:profile:picture request can't mark a legitimately-public photo
  // as unavailable for the life of the campaign. Only soft failures are retried
  // (short exponential backoff, capped attempts); hard session/auth failures are
  // rethrown so scan-loop safety logic can act on them.
  async _resolveScannedAvatar(jid) {
    if (!this.sock) return null;
    const WA_AVATAR_ATTEMPTS = Number(process.env.WA_AVATAR_ATTEMPTS) || 5;
    const WA_AVATAR_RETRY_BASE_MS = Number(process.env.WA_AVATAR_RETRY_BASE_MS) || 500;
    let lastErr = null;
    for (let attempt = 1; attempt <= WA_AVATAR_ATTEMPTS; attempt++) {
      try {
        return await withTimeout(this.sock.profilePictureUrl(jid, 'image'), WA_AVATAR_TIMEOUT_MS, 'checkNumber.profilePictureUrl');
      } catch (err) {
        lastErr = err;
        const msg = String(err?.message || '');
        const isSessionFailure = /logged\s*out|forbidden|bad\s*session|multidevice|connection\s*(replaced|closed)|unauthori[sz]ed|\b401\b|\b403\b|\b440\b/i.test(msg);
        if (isSessionFailure) throw err;
        const isTransient = /timed\s*out|timeout|network|fetch\s*failed|ECONN|ENOTFOUND|EAI_AGAIN|socket|closed|refused|reset|stream\s*error/i.test(msg) || msg.length === 0;
        if (!isTransient || attempt >= WA_AVATAR_ATTEMPTS) throw err;
        const backoff = Math.min(3000, WA_AVATAR_RETRY_BASE_MS * Math.pow(2, attempt - 1));
        this.logToShieldGateway('WARN', `checkNumber: transient avatar lookup failure (${msg || 'unknown'}) — retrying ${jid} (attempt ${attempt + 1}/${WA_AVATAR_ATTEMPTS}) in ${Math.ceil(backoff / 1000)}s`, { jid, attempt, backoff });
        await interruptibleWait(backoff);
      }
    }
    throw lastErr;
  }

  async generateQRCode() {
    // Guard: only one QR generation at a time to prevent concurrent session wipes
    // and overlapping connect attempts that cause the "WebSocket client limit reached"
    // spam and endless QR regeneration cycles.
    if (this._qrGenerating) {
      console.log('[QR] QR generation already in progress; skipping duplicate request.');
      return;
    }
    this._qrGenerating = true;
    try {
      this._intentionalDisconnect = true;
      this._pendingPairing = false;
      this._autoRestoreAttempts = 0;
      this._cleanupInternalState();
      this._connecting = false;
      
      // Prepare a fresh session directory (removes any existing session data for this session ID)
      // No backup folders are created - we simply start clean.
      if (this.sessionManager) {
        this.sessionManager.prepareFreshSession(this.sessionId);
        console.log('[QR] Prepared fresh session directory for new QR login');
      }
      
      await this.connect();
    } finally {
      this._qrGenerating = false;
    }
  }

  isConnecting() {
    return this.status === 'CONNECTING' || this._connecting;
  }

  async connect() {
    if (this._connecting) {
      console.log('Connection request ignored. Already connecting.');
      return;
    }
    if (this.status === 'CONNECTED' && this.sock) {
      console.log('Connection request already established. No action needed.');
      return;
    }

    this._connecting = true;
    this._intentionalDisconnect = false;

    // Safety timeout: reset _connecting flag if Baileys never fires connection.update.
    // Also tears down the stalled socket so an expired QR can't keep broadcasting.
    if (this._connectTimeout) clearTimeout(this._connectTimeout);
    this._connectTimeout = setTimeout(() => {
      if (this._connecting) {
        console.warn('[CONNECT] Connection timeout — tearing down stalled socket after 45s');
        this._connecting = false;
        this._pendingPairing = false;
        if (this._presenceInterval) {
          clearInterval(this._presenceInterval);
          this._presenceInterval = null;
        }
        if (this.sock) {
          try {
            this.sock.ev.removeAllListeners();
            this.sock.end().catch(() => {});
          } catch (e) {}
          this.sock = null;
        }
        this.updateStatus('DISCONNECTED', { error: 'Connection timed out' });
      }
    }, 45000);

    try {
      this.updateStatus('CONNECTING');

      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners('connection.update');
          this.sock.ev.removeAllListeners('creds.update');
          this.sock.ev.removeAllListeners('messages.upsert');
          this.sock.ev.removeAllListeners('message-receipt.update');
          await this.sock.end().catch(() => {});
        } catch (sockErr) {
          console.warn('Error terminating redundant Baileys socket:', sockErr.message);
        }
        this.sock = null;
      }

      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }

      const { state } = await useMultiFileAuthState(this.sessionPath);
      this.state = state;
      this.saveCreds = async () => {
        try {
          // Atomic persistence: serialize the in-memory creds and write via
          // temp+rename. Baileys' own saveCreds uses a plain non-atomic
          // writeFile, so a crash mid-write could corrupt creds.json. We keep
          // the reference (for key-file writes) but persist creds ourselves.
          const serialized = JSON.stringify(this.state.creds, BufferJSON.replacer);
          if (this.sessionManager) {
            this.sessionManager.saveCredsAtomic(this.sessionPath, serialized);
          } else {
            fs.writeFileSync(path.join(this.sessionPath, 'creds.json'), serialized, 'utf8');
          }
          this._credsSaveCount = (this._credsSaveCount || 0) + 1;
          if (this._credsSaveCount === 1) {
            console.log('[SAVE_CREDS] Credentials saved (atomic temp+rename).');
          }
        } catch (err) {
          console.error('[SAVE_CREDS] FAILED to save credentials:', err.message);
        }
      };

      const preFiles = fs.existsSync(this.sessionPath) ? fs.readdirSync(this.sessionPath) : [];
      console.log(`[CONNECT] Session dir files BEFORE connect: ${preFiles.length > 0 ? preFiles.join(', ') : '(empty)'}`);

      // Known-good fallback: kept in sync with the version returned by
      // fetchLatestBaileysVersion(). Using a stale value here causes WhatsApp
      // to close the connection immediately with status 405 (version rejected)
      // before any QR is emitted.
      let version = [2, 3000, 1043857760];
      try {
        // Bound the version probe so a hung upstream (version;whatsapp.net) can
        // never stall the connect path indefinitely. 15 s gives slow/metered
        // connections enough time while still preventing an infinite stall.
        const { version: latestVersion, isLatest } = await Promise.race([
          fetchLatestBaileysVersion(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('version fetch timed out')), 15000))
        ]);
        version = latestVersion;
        console.log(`Using WhatsApp Web version v${version.join('.')}, isLatest: ${isLatest}`);
      } catch (err) {
        console.warn('Failed to fetch latest Baileys version dynamically. Using fallback.', err.message);
      }

      this.sock = makeWASocket({
        version,
        auth: this.state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        // Natural-looking browser metadata (configurable via env) to avoid
        // fingerprinting triggers. Defaults to a recent Chrome profile.
        // Keep the version reasonably current — WhatsApp rejects very old
        // browser strings alongside a stale WA version (produces 405).
        browser: (() => {
          const raw = process.env.WA_BROWSER_META;
          if (raw) {
            const parts = raw.split(',').map(s => s.trim());
            if (parts.length === 3) return parts;
          }
          return ['Chrome', 'Chrome', '128.0.0.0'];
        })(),
        // Do not announce "online" on connect. This tool is a number validator:
        // it only needs onWhatsApp presence lookups, never inbound chat. Marking
        // the session online makes WhatsApp push pending message history and
        // app-state-sync notifications to this device, and those notifications
        // are encrypted with Signal sessions this device may never have held
        // (e.g. queued while offline, or sent to a previously linked device).
        // libsignal then fails to decrypt them -> "Bad MAC" / "Failed to decrypt
        // message with any known session". Staying offline avoids the flood and
        // removes the retry-request traffic it generated.
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 25000,
        // Never request full history sync (default is false; set explicitly so
        // it cannot regress if Baileys defaults change).
        syncFullHistory: false,
        // Drop history-sync notifications outright. They carry chat we do not
        // consume, and decrypting them is what produces the Bad MAC noise.
        shouldSyncHistoryMessage: () => false,
        // Retry receipts ask WhatsApp to RESEND an undecryptable message
        // (placeholder resend). That is real outbound traffic to WhatsApp
        // generated purely by a decrypt failure — undesirable for a validator.
        // maxMsgRetryCount: 0 disables it entirely; retries are pointless for
        // history/notification payloads we deliberately ignore.
        maxMsgRetryCount: 0,
        retryRequestDelayMs: 0,
        // appStateMacVerification must stay off: with snapshot/patch enabled,
        // Baileys attempts to decrypt and rewrite app-state payloads, which is
        // another common source of MAC verification failures.
        appStateMacVerification: { patch: false, snapshot: false },
        // Never re-request a message we already failed to decrypt.
        getMessage: async () => undefined
      });

      this.sock.ev.on('creds.update', this.saveCreds);

      // Inbound chat is OPTIONAL for this app (number validation does not need it).
      // Any failure here is contained locally: it is swallowed and counted, so a
      // malformed or undecryptable payload can never reject the event handler,
      // crash the process, trigger a reconnect, log the user out, or re-pair.
      this._decryptNoiseCount = 0;
      this.sock.ev.on('messages.upsert', async (messageUpdate) => {
        try {
          const { messages, type } = messageUpdate;
          if (type !== 'notify') return;

          for (const msg of messages) {
            if (msg.key && msg.key.fromMe) continue;
            if (!msg || !msg.message) continue;

            // Ciphertext stubs are messages libsignal could NOT decrypt. There is
            // nothing to process and nothing to retry — drop them silently and
            // count them so the condition stays observable.
            if (msg.messageStubType === 16 /* CIPHERTEXT */) {
              this._decryptNoiseCount = (this._decryptNoiseCount || 0) + 1;
              continue;
            }

            const fromJid = msg.key && msg.key.remoteJid;
            if (!fromJid || isJidGroup(fromJid)) continue;

            const phone = fromJid.split('@')[0];

            // Inbound notify messages carry the sender's self-set push name.
            // Capturing it costs zero requests and is the only supported way a
            // non-address-book user's own name can be known; feed it into the
            // display-name cache (single-flight, may patch an already-scanned row).
            if (msg.pushName) {
              try {
                this._ingestContactContacts([{ id: fromJid, notify: msg.pushName }], 'inbound');
              } catch (err) {
                // non-fatal — never let name capture destabilize inbound handling
              }
            }

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

            if (this.onMessageCallback) {
              this.onMessageCallback({
                id: msg.key.id,
                phone,
                from: 'them',
                text,
                timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
                status: 'delivered'
              });
            }
          }
        } catch (err) {
          // Swallow: inbound chat is non-critical and must never destabilize the
          // scanning session.
          this._decryptNoiseCount = (this._decryptNoiseCount || 0) + 1;
          console.warn('[INBOUND] Ignored an undecryptable/unhandled inbound payload:', err && err.message);
        }
      });

      // Display-name sources pushed by WhatsApp on this linked device.
      // contacts.upsert carries address-book names during app-state sync;
      // contacts.update carries rename / picture-change notifications. Both are
      // pure events — no request is made — so they cannot affect lookup pacing.
      this.sock.ev.on('contacts.upsert', (contacts) => this._ingestContactContacts(contacts, 'contact_sync'));
      this.sock.ev.on('contacts.update', (updates) => this._ingestContactContacts(updates, 'contact_update'));

      this.sock.ev.on('message-receipt.update', async (receiptUpdates) => {
        for (const update of receiptUpdates) {
          const { key, receipt } = update;
          if (!key || !receipt) continue;

          let status = 'sent';
          if (receipt.receiptType === 'READ' || receipt.receiptType === 'PLAYED') {
            status = 'read';
          } else if (receipt.receiptType === 'DELIVERY') {
            status = 'delivered';
          }

          if (this.onMessageStatusCallback) {
            this.onMessageStatusCallback({
              messageId: key.id,
              jid: key.remoteJid,
              status,
              fromMe: key.fromMe
            });
          }
        }
      });

      // Presence keep-alive is intentionally DISABLED.
      //
      // It used to send `available` every 5 minutes to prevent idle
      // disconnects. That is what keeps the account visible/online, which in
      // turn makes WhatsApp keep pushing inbound message + app-state payloads
      // to this device. Those payloads are the ones libsignal cannot decrypt
      // (Bad MAC), because they were encrypted for Signal sessions this
      // validator device never established — they were queued while offline.
      //
      // Socket liveness is already handled by Baileys' own keepAliveIntervalMs
      // ping above, so idle disconnects are still prevented without forcing
      // inbound delivery. Set WA_PRESENCE_KEEPALIVE=1 only if a specific
      // deployment genuinely needs presence published.
      if (process.env.WA_PRESENCE_KEEPALIVE === '1') {
        const presenceInterval = setInterval(() => {
          if (this.sock && this.status === 'CONNECTED') {
            try {
              this.sock.sendPresenceUpdate('available');
            } catch (e) {
              // silently ignore — connection may be closing
            }
          }
        }, 5 * 60 * 1000);
        this._presenceInterval = presenceInterval;
      }

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Baileys emits isNewLogin:true on pair-success, just before the server
        // intentionally closes the connection so the freshly-paired session can be
        // re-established. Remember this so the post-pairing close can be completed
        // with a single reconnect (required to finish the user-initiated login).
        if (update.isNewLogin) {
          this._pendingPairing = true;
        }

        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
            this.updateStatus('QR_CODE');
          } catch (qrErr) {
            console.error('Failed to generate QR Code:', qrErr);
          }
        }

        if (connection === 'close') {
          if (this._connectTimeout) {
            clearTimeout(this._connectTimeout);
            this._connectTimeout = null;
          }
          if (this._presenceInterval) {
            clearInterval(this._presenceInterval);
            this._presenceInterval = null;
          }
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const wasIntentional = this._intentionalDisconnect;
          const shouldCompletePairing = this._pendingPairing;
          this._intentionalDisconnect = false;
          this._pendingPairing = false;
          this._connecting = false;

          console.log(`Connection closed. Status code: ${statusCode}. Intentional: ${wasIntentional}. Completing pairing: ${shouldCompletePairing}.`);

          if (this.sock) {
            try {
              this.sock.ev.removeAllListeners();
              await this.sock.end().catch(() => {});
            } catch (e) {}
          }
          this.sock = null;

          // Session persistence: a transient drop is restored automatically so a
          // network blip, backend restart, or WhatsApp-side socket teardown never
          // forces the user to re-link. Two cases are deliberately NOT restored:
          // (1) a pairing that just succeeded reconnects once to finish login,
          // and (2) an intentional disconnect (logout / QR cancel) stops here.
          // For everything else, reuse the persisted session exactly once; if
          // that restore also fails, the user is returned to the QR flow instead
          // of looping forever.
          if (wasIntentional) {
            console.log('Intentional disconnect — not reconnecting.');
            this.updateStatus('DISCONNECTED');
          } else if (shouldCompletePairing) {
            console.log('Pairing complete — reconnecting once to finish login.');
            this.connect().catch((err) => {
              console.error('[CONNECT] Pairing completion reconnect failed:', err);
              this.updateStatus('DISCONNECTED', { error: err.message });
            });
          } else if (!SESSION_INVALID_CODES.has(statusCode)
              && this._autoRestoreAttempts < 1
              && fs.existsSync(path.join(this.sessionPath, 'creds.json'))) {
            // Transient close (network, connectionClosed, restartRequired, etc.)
            // — the persisted credentials are still valid, restore the session.
            this._autoRestoreAttempts += 1;
            console.log('Transient disconnect — restoring persisted WhatsApp session automatically.');
            this.logToShieldGateway('INFO', 'Transient disconnect — restoring persisted session', { statusCode });
            this.connect().catch((err) => {
              console.error('[CONNECT] Session restore failed:', err.message);
              this.updateStatus('DISCONNECTED', { error: err.message });
            });
          } else {
            console.log('Connection closed. Waiting for user to generate a fresh QR code.');
            this.updateStatus('DISCONNECTED');
          }
        } else if (connection === 'open') {
          if (this._connectTimeout) {
            clearTimeout(this._connectTimeout);
            this._connectTimeout = null;
          }
          this._pendingPairing = false;
          this._autoRestoreAttempts = 0;
          console.log('WhatsApp connection successfully opened!');

          const me = this.sock.user;
          this.userInfo = {
            id: me.id,
            name: me.name || 'WhatsApp Session',
            number: me.id.split(':')[0]
          };
          this._connecting = false;

          // Broadcast CONNECTED immediately. The own-profile picture query can
          // hang for many seconds on a fresh pairing (Baileys issues a
          // request/response iq to s.whatsapp.net right after open), so it must
          // never block the login transition.
          this.updateStatus('CONNECTED');

          // Persist creds in the background (non-blocking) and fetch the own
          // avatar asynchronously, pushing a lightweight USER_UPDATE when ready.
          this.saveCreds().catch(() => {});
          this._avatarLoading = false;
          this._loadOwnAvatar(me.id);
        }
      });

    } catch (err) {
      if (this._connectTimeout) {
        clearTimeout(this._connectTimeout);
        this._connectTimeout = null;
      }
      console.error('Error during WhatsApp connection initialization:', err);
      this._connecting = false;
      this.updateStatus('DISCONNECTED', { error: err.message });
    }
  }

  _cleanupInternalState() {
    // Tears down socket, timers, and flags but does NOT touch session files on disk
    this._pendingPairing = false;
    if (this._connectTimeout) {
      clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }
    if (this._presenceInterval) {
      clearInterval(this._presenceInterval);
      this._presenceInterval = null;
    }
    if (this.sock) {
      try {
        this._intentionalDisconnect = true;
        this.sock.ev.removeAllListeners();
        this.sock.end().catch(() => {});
      } catch (e) {}
      this.sock = null;
    }
    this.state = null;
    this.saveCreds = null;
    // Persist any names learned this session before the socket tears down, so a
    // restart keeps them without re-receiving the same pushed events.
    this._flushContactNames();
  }

  cleanupSession(reason = 'unknown') {
    try {
      const stack = new Error().stack.split('\n').slice(1, 4).join(' <- ');
      console.log(`[CLEANUP] Session cleanup triggered by: ${reason}`);
      console.log(`[CLEANUP] Call stack: ${stack}`);
      if (this.sessionManager) {
        this.sessionManager.deleteSession(this.sessionId);
        console.log('[CLEANUP] Session authentication directory cleaned up via SessionManager.');
      }
    } catch (err) {
      console.error('Error cleaning up session folder:', err);
    }
  }

  cancelQR() {
    // cancel_qr is only meant to clear stale QR-generation state. Never tear
    // down a live, connected session — that would silently invalidate a link
    // the user just established. Ending an active session requires an explicit
    // logout (preserves the user-initiated connection flow).
    if (this.status === 'CONNECTED' && this.sock) {
      console.log('[CANCEL_QR] Ignored — an active WhatsApp session is connected.');
      return;
    }
    if (this.status === 'CONNECTING') {
      console.log('[CANCEL_QR] Ignored — connection/session restore in progress.');
      return;
    }
    console.log('[CANCEL_QR] Cancelling active QR generation / session');
    this._intentionalDisconnect = true;
    this._pendingPairing = false;
    this._autoRestoreAttempts = 0;
    this._cleanupInternalState();
    this._connecting = false;
    this.qrCodeDataUrl = null;
    this.userInfo = null;
    this.updateStatus('DISCONNECTED');
  }

  // Full session cleanup — destroys session folder via SessionManager.
  cleanupAuthSession(reason = 'unknown') {
    console.log(`[CLEANUP_AUTH] Full auth session cleanup triggered by: ${reason}`);
    this._cleanupInternalState();
    this._connecting = false;
    this.userInfo = null;
    this.cleanupSession(reason);
  }

  async logout() {
    if (this._connectTimeout) {
      clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }
    if (this._presenceInterval) {
      clearInterval(this._presenceInterval);
      this._presenceInterval = null;
    }
    this._connecting = false;
    this._intentionalDisconnect = true;
    this._autoRestoreAttempts = 0;

    if (this.sock) {
      try {
        // Properly unlink the device from WhatsApp so the session is invalidated.
        await this.sock.logout();
      } catch (err) {
        console.error('Error during WhatsApp logout:', err);
        try {
          await this.sock.end();
        } catch (e) {}
      }
      try {
        this.sock.ev.removeAllListeners();
      } catch (e) {}
      this.sock = null;
    }

    // Remove all persisted authentication material so no session can be restored.
    // Use SessionManager to delete the session folder completely.
    if (this.sessionManager) {
      this.sessionManager.deleteSession(this.sessionId);
    }
    this.state = null;
    this.saveCreds = null;
    this.resetOutboundBudgets();

    console.log('[LOGOUT] Session invalidated and authentication material removed.');
    this.updateStatus('DISCONNECTED');
  }

  async sendMessage(to, text) {
    if (this.status !== 'CONNECTED' || !this.sock) {
      const errorMsg = 'WhatsApp is not connected.';
      console.error(`[SEND_MESSAGE] ${errorMsg} (Status: ${this.status})`);
      this.logToShieldGateway('ERROR', `sendMessage failed: ${errorMsg}`, { to, status: this.status });
      throw new Error(errorMsg);
    }

    // Concurrency single-flight: only one WhatsApp send at a time. A second
    // concurrent send is rejected outright (fail closed) instead of queued, so a
    // UI double-tap or parallel client can never fan out multiple sends.
    if (this._sendInFlight) {
      const err = new Error('Another message is being sent right now. Please wait a moment.');
      this.logToShieldGateway('WARN', 'sendMessage concurrency guard hit', { to, err: err.message });
      throw err;
    }

    // Exponential backoff: after repeated failures the send channel is throttled
    // harder and harder (2^failures seconds, capped), so a failing account can
    // never be hammered further.
    if (Date.now() < this._sendBackoffUntil) {
      const waitMs = this._sendBackoffUntil - Date.now();
      const err = new Error(`Send channel cooling down. Try again in ${Math.ceil(waitMs / 1000)}s.`);
      this.logToShieldGateway('WARN', `sendMessage backoff active: ${to}`, { to, err: err.message, waitMs });
      throw err;
    }

    // Normalize: strip non-digits, remove leading zeros for proper JID format
    let cleanNumber = to.replace(/\D/g, '');
    while (cleanNumber.startsWith('0')) {
      cleanNumber = cleanNumber.substring(1);
    }
    if (!cleanNumber) {
      throw new Error('Invalid phone number after normalization');
    }
    const jid = `${cleanNumber}@s.whatsapp.net`;

    // --- Safety guards: rate limiting, dedup, daily caps ---
    const now = Date.now();
    const config = {
      minIntervalMs: Number(process.env.WA_SEND_MIN_INTERVAL_MS) || 2500,  // min gap between messages to same contact
      dedupWindowMs: Number(process.env.WA_SEND_DEDUP_WINDOW_MS) || 10000, // skip identical duplicate within window
      maxPerHour: Number(process.env.WA_SEND_MAX_PER_HOUR) || 60,
      maxPerDay: Number(process.env.WA_SEND_MAX_PER_DAY) || 400,
      // Global caps across ALL recipients — bound total outbound volume even
      // when messaging many distinct first-time contacts.
      globalMaxPerHour: Number(process.env.WA_SEND_GLOBAL_MAX_PER_HOUR) || 30,
      globalMaxPerDay: Number(process.env.WA_SEND_GLOBAL_MAX_PER_DAY) || 200
    };

    const lastSend = this._sendCooldown.get(jid);
    if (lastSend && now - lastSend < config.minIntervalMs) {
      const waitMs = config.minIntervalMs - (now - lastSend);
      const err = new Error(`Sending too fast. Please wait ${Math.ceil(waitMs / 1000)}s before messaging this contact again.`);
      this.logToShieldGateway('WARN', `sendMessage throttled: ${jid}`, { err: err.message, waitMs });
      throw err;
    }

    const history = this._sendHistory.get(jid) || [];
    const recent = history.filter(h => now - h.ts < 3600000);
    if (recent.length >= config.maxPerHour) {
      const err = new Error(`Hourly message limit reached for this contact (${config.maxPerHour}/hour).`);
      this.logToShieldGateway('WARN', `sendMessage hourly cap reached: ${jid}`, { err: err.message });
      throw err;
    }

    const dayHistory = history.filter(h => now - h.ts < 86400000);
    if (dayHistory.length >= config.maxPerDay) {
      const err = new Error(`Daily message limit reached for this contact (${config.maxPerDay}/day).`);
      this.logToShieldGateway('WARN', `sendMessage daily cap reached: ${jid}`, { err: err.message });
      throw err;
    }

    // Global budget checks (all recipients combined).
    const lastHour = this._globalSendTimes.filter(t => now - t < 3600000);
    if (lastHour.length >= config.globalMaxPerHour) {
      const err = new Error(`Global hourly send limit reached (${config.globalMaxPerHour}/hour across all contacts).`);
      this.logToShieldGateway('WARN', 'sendMessage global hourly cap reached', { err: err.message, count: lastHour.length });
      throw err;
    }
    const lastDay = this._globalSendTimes.filter(t => now - t < 86400000);
    if (lastDay.length >= config.globalMaxPerDay) {
      const err = new Error(`Global daily send limit reached (${config.globalMaxPerDay}/day across all contacts).`);
      this.logToShieldGateway('WARN', 'sendMessage global daily cap reached', { err: err.message, count: lastDay.length });
      throw err;
    }

    const lastText = recent.length > 0 ? recent[recent.length - 1] : null;
    if (lastText && lastText.text === text && now - lastText.ts < config.dedupWindowMs) {
      const err = new Error('Duplicate message blocked (identical message sent recently).');
      this.logToShieldGateway('WARN', `sendMessage dedup blocked: ${jid}`, { err: err.message });
      throw err;
    }

    this.logToShieldGateway('INFO', `sendMessage: Sending to ${to} -> jid:${jid}`, { to, cleanNumber, jid });

    this._sendInFlight = true;
    try {
      const result = await withTimeout(this.sock.sendMessage(jid, { text }), 30000, 'sendMessage.sock');
      this.logToShieldGateway('INFO', `sendMessage: Success to ${jid}`, { result });

      // Record successful send for rate/cap accounting
      this._consecutiveSendFailures = 0;
      this._sendBackoffUntil = 0;
      this._globalSendTimes.push(now);
      const entry = { text, ts: now };
      const hist = this._sendHistory.get(jid) || [];
      hist.push(entry);
      // Keep a bounded rolling window (~2 days worth)
      const pruned = hist.filter(h => now - h.ts < 2 * 86400000);
      this._sendHistory.set(jid, pruned);
      this._sendCooldown.set(jid, now);

      // Bounded Maps: occasionally evict stale jids so a long-lived Message Agent
      // doesn't leak memory as it talks to many distinct contacts.
      if (this._sendHistory.size > 2000 || this._sendCooldown.size > 2000 || this._globalSendTimes.length > 5000) {
        const cutoff = now - 2 * 86400000;
        for (const [jid2, ts] of this._sendCooldown) {
          if (ts < cutoff) this._sendCooldown.delete(jid2);
        }
        for (const [jid2, jhist] of this._sendHistory) {
          const last = jhist.length ? jhist[jhist.length - 1] : null;
          if (!last || last.ts < cutoff) this._sendHistory.delete(jid2);
        }
        this._globalSendTimes = this._globalSendTimes.filter(t => now - t < 2 * 86400000);
      }

      return {
        id: result.key.id,
        jid: result.key.remoteJid,
        timestamp: new Date().toISOString(),
        status: 'sent'
      };
    } catch (err) {
      // Exponential backoff on failure: 2s, 4s, 8s, ... capped at 10 minutes.
      this._consecutiveSendFailures += 1;
      const backoffMs = Math.min(1000 * Math.pow(2, this._consecutiveSendFailures), 10 * 60 * 1000);
      this._sendBackoffUntil = Date.now() + backoffMs;
      console.error('Failed to send WhatsApp message:', err.message);
      this.logToShieldGateway('ERROR', `sendMessage: Failed to ${jid}: ${err.message}`, { to, jid, err: err.message, backoffMs });
      throw err;
    } finally {
      this._sendInFlight = false;
    }
  }

  async fetchBusinessProfile(jid) {
    if (!this.sock || typeof this.sock.query !== 'function') return null;
    const result = await this.sock.query({
      tag: 'iq',
      attrs: { to: 's.whatsapp.net', xmlns: 'w:biz', type: 'get' },
      content: [
        {
          tag: 'business_profile',
          attrs: { v: '244' },
          content: [{ tag: 'profile', attrs: { jid } }]
        }
      ]
    });
    const profileNode = getBinaryNodeChild(result, 'business_profile');
    const profiles = getBinaryNodeChild(profileNode, 'profile');
    if (!profiles) return null;
    const address = getBinaryNodeChild(profiles, 'address');
    const description = getBinaryNodeChild(profiles, 'description');
    const website = getBinaryNodeChild(profiles, 'website');
    const email = getBinaryNodeChild(profiles, 'email');
    const category = getBinaryNodeChild(getBinaryNodeChild(profiles, 'categories'), 'category');
    const verifiedNameNode = getBinaryNodeChild(profiles, 'verified_name');
    const vname = (verifiedNameNode?.content?.toString() || verifiedNameNode?.attrs?.vname || verifiedNameNode?.attrs?.name || '').trim();
    // Some business accounts expose their verified display name ONLY in the
    // biz_identity_info block (attrs.display_name) instead of a <verified_name>
    // node — observed live on a real business profile. Missing it made a
    // genuinely-named account resolve to "Name Not Found".
    const bizIdentity = getBinaryNodeChild(profiles, 'biz_identity_info');
    const dname = bizIdentity && bizIdentity.attrs && bizIdentity.attrs.display_name
      ? String(bizIdentity.attrs.display_name).trim()
      : '';
    return {
      wid: profiles.attrs?.jid,
      verifiedName: (vname || dname) || null,
      hasData: !!(vname || dname || address || description || website?.content || email || category)
    };
  }

  async checkNumber(phoneNumber, opts = {}) {
    if (this.status !== 'CONNECTED' || !this.sock) {
      const errorMsg = 'WhatsApp is not connected. Please link your device first.';
      console.error(`[CHECK_NUMBER] ${errorMsg} (Status: ${this.status})`);
      this.logToShieldGateway('ERROR', `checkNumber failed: ${errorMsg}`, { phoneNumber, status: this.status });
      throw new Error(errorMsg);
    }

    // Shield is a 1-to-1 lookup tool. Groups, channels, broadcast and status
    // identifiers are never valid scan targets, so they are rejected before any
    // WhatsApp request is made rather than being normalised into a number.
    const verdict = classifyIdentifier(phoneNumber);
    if (!verdict.valid) {
      const errorMsg = `"${phoneNumber}" is not a 1-to-1 WhatsApp contact (${verdict.reason || verdict.kind}).`;
      this.logToShieldGateway('WARN', `checkNumber rejected non-person identifier: ${errorMsg}`, {
        phoneNumber,
        kind: verdict.kind
      });
      const err = new Error(errorMsg);
      err.code = 'NOT_A_PERSON';
      throw err;
    }

    // Cooperative cancellation: the caller can hand us a predicate (e.g. "user
    // pressed Stop") so the pacing waits below cede control promptly instead of
    // sleeping out a fixed interval. Throws a marked error so the scan loop can
    // exit cleanly without recording a fake failure.
    const shouldStop = typeof opts.shouldStop === 'function' ? opts.shouldStop : () => false;
    const interruptibleWait = async (ms) => {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline) {
        if (shouldStop()) {
          const e = new Error('Scan stopped by user.');
          e.code = 'SCAN_STOPPED';
          throw e;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    };

    // Global lookup throttle — caps lookup RATE across all live scans so a
    // sustained campaign can never generate a rapid-fire query spike. This is a
    // pacing backstop ONLY: when the per-minute budget is reached the lookup
    // waits for the window to roll over instead of failing, so a scan is never
    // aborted mid-run. The former per-hour/per-day hard quotas were removed —
    // the min-check interval floor + shield delay already pace lookups, and the
    // hard caps were an arbitrary app-level quota that silently blocked users
    // from running multiple campaigns in a day.
    const nowLookup = Date.now();
    const maxPerMinute = Number(process.env.WA_LOOKUP_MAX_PER_MINUTE) || 60;
    this._globalLookupTimes = this._globalLookupTimes.filter(t => nowLookup - t < 60000);
    const perMin = this._globalLookupTimes.length;
    if (perMin >= maxPerMinute) {
      const oldest = this._globalLookupTimes[0];
      const waitMs = Math.max(0, Math.min(30000, oldest - nowLookup + 60000));
      this.logToShieldGateway('WARN', `checkNumber per-minute rate reached (${perMin}/min) — throttling ${Math.ceil(waitMs / 1000)}s`, { phoneNumber, perMin, waitMs });
      await interruptibleWait(waitMs);
      this._globalLookupTimes = this._globalLookupTimes.filter(t => Date.now() - t < 60000);
    }

    // Accept the formats people actually paste (spaces / dashes / brackets /
    // "00" prefix / national trunk 0) before anything else looks at the digits.
    const cleanNumber = normalizeToInternationalDigits(phoneNumber, opts.countryCallingCode);
    if (!cleanNumber) {
      return {
        number: phoneNumber,
        cleanNumber: '',
        formatted: String(phoneNumber || ''),
        detectedCountry: null,
        detectedType: null,
        isValidFormat: false,
        invalidReason: 'No digits found',
        exists: false, avatar: null, profilePhotoAvailable: false,
        isBusiness: false, isVerified: false, displayName: null, verifiedName: null,
        nameChecked: false, nameFound: false, nameSource: null,
        error: null,
      };
    }
    const jid = `${cleanNumber}@s.whatsapp.net`;

    // Safety: enforce a minimum spacing between checkNumber calls to avoid
    // rapid-fire lookups that look automated. Client loops add their own delay
    // on top of this floor.
    const MIN_CHECK_INTERVAL_MS = Number(process.env.WA_CHECK_MIN_INTERVAL_MS) || 600;
    const nowMs = Date.now();
    if (this._lastCheckAt && nowMs - this._lastCheckAt < MIN_CHECK_INTERVAL_MS) {
      const waitMs = MIN_CHECK_INTERVAL_MS - (nowMs - this._lastCheckAt);
      await interruptibleWait(waitMs);
    }
    this._lastCheckAt = Date.now();

    // Fail CLOSED, via the one shared validator. Previously this only flagged a
    // number as invalid when it was shorter than 8 digits, so any >=8 digit
    // number libphonenumber rejects (e.g. +92310000023 - only 9 national digits
    // for a country that requires 10) was still handed to WhatsApp and reported
    // as "Not registered". Now a number must genuinely parse AND validate
    // before we are allowed to look it up.
    //
    // `opts.expectedIso` lets a campaign that knows its target country reject a
    // number belonging to a different country outright.
    const numberVerdict = validatePhoneNumber(cleanNumber, {
      countryCallingCode: opts.countryCallingCode,
      expectedCountry: opts.expectedIso,
      allowFixedLine: opts.allowFixedLine,
    });
    const isValidFormat = numberVerdict.valid;
    const invalidReason = numberVerdict.reason;
    const detectedType = numberVerdict.type;
    const formatted = numberVerdict.valid ? numberVerdict.e164 : `+${cleanNumber}`;
    const detectedCountry = numberVerdict.country;

    const result = {
      number: phoneNumber,
      cleanNumber: cleanNumber,
      formatted: formatted,
      detectedCountry: detectedCountry,
      detectedType: detectedType,
      isValidFormat: isValidFormat,
      invalidReason: invalidReason,
      exists: false,
      avatar: null,
      profilePhotoAvailable: false,
      isBusiness: false,
      isVerified: false,
      displayName: null,
      verifiedName: null,
      // Display-name resolution bookkeeping. nameChecked flips true only once a
      // completed lookup/report is in (so the UI can show "Name Not Found"
      // versus "Unavailable"); nameFound records whether a name was actually
      // resolved; nameSource says where it came from ('business'|'contact').
      nameChecked: false,
      nameFound: false,
      nameSource: null,
      error: null
    };

    // Hard gate: an invalid number is reported as Invalid and is NEVER sent to
    // WhatsApp. No onWhatsApp call, no budget charge, no rate-limit slot spent.
    if (!isValidFormat) {
      result.error = null;
      this.logToShieldGateway('WARN', `checkNumber: SKIPPED invalid number ${formatted} (${invalidReason}) - not sent to WhatsApp`, {
        phoneNumber, cleanNumber, formatted, invalidReason, detectedCountry,
      });
      return result;
    }

    this.logToShieldGateway('INFO', `checkNumber: Checking number ${phoneNumber} (${cleanNumber})`, { phoneNumber, cleanNumber, jid, formatted, detectedCountry, detectedType, isValidFormat });

    try {
      // The per-attempt budget charge happens inside the retry loop below (every
      // actual onWhatsApp attempt, including the successful one, is recorded so
      // the per-minute throttle/daily-cap reflect real lookups).

      // onWhatsApp is the single most failure-prone call: temporary network
      // instability (a lost internet link on the same machine, a WiFi blip, an
      // upstream timeout) makes it reject or time out. Rather than surrendering
      // immediately — which would (a) inflate the loop's consecutive-failure
      // counter and risk the anomaly hard-stop, and (b) wrongly mark a healthy
      // number as failed — we retry transient failures a bounded number of times
      // with exponential backoff. Hard session/auth failures (logged out,
      // forbidden, bad session, connection replaced) are NOT retried; they're
      // rethrown so the scan loop can stop and the session-recovery flow can
      // take over. Each retry still respects the global per-minute budget.
      const WA_ONWA_ATTEMPTS = Number(process.env.WA_ONWA_ATTEMPTS) || 3;
      const WA_ONWA_RETRY_BASE_MS = Number(process.env.WA_ONWA_RETRY_BASE_MS) || 1200;
      let res = null;
      let lastLookupErr = null;
      for (let attempt = 1; attempt <= WA_ONWA_ATTEMPTS; attempt++) {
        if (shouldStop()) {
          const e = new Error('Scan stopped by user.');
          e.code = 'SCAN_STOPPED';
          throw e;
        }
        try {
          this._globalLookupTimes.push(Date.now());
          const [r] = await withTimeout(this.sock.onWhatsApp(jid), CHECK_TIMEOUT_MS, 'checkNumber.onWhatsApp');
          res = r;
          break;
        } catch (lookupErr) {
          lastLookupErr = lookupErr;
          const msg = String(lookupErr?.message || '');
          const isSessionFailure = /logged\s*out|forbidden|bad\s*session|multidevice|connection\s*(replaced|closed)|unauthori[sz]ed|\b401\b|\b403\b|\b440\b/i.test(msg);
          if (isSessionFailure) throw lookupErr;
          const isTransient = /timed\s*out|timeout|network|fetch\s*failed|ECONN|ENOTFOUND|EAI_AGAIN|socket|closed|refused/i.test(msg) || msg.length === 0;
          if (!isTransient || attempt >= WA_ONWA_ATTEMPTS) throw lookupErr;
          // Transient — back off (exponentially, bounded) then retry. Do not
          // count as a hard failure; the attempt counter bounds the retry so
          // this can never become an unbounded request that freezes the scan.
          const backoff = Math.min(8000, WA_ONWA_RETRY_BASE_MS * Math.pow(2, attempt - 1));
          this.logToShieldGateway('WARN', `[Validation] Temporary gateway/network failure (${msg || 'unknown'}) — retrying ${phoneNumber} (attempt ${attempt + 1}/${WA_ONWA_ATTEMPTS}) in ${Math.ceil(backoff / 1000)}s`, { phoneNumber, attempt, backoff });
          await interruptibleWait(backoff);
        }
      }
      res = res !== null ? res : (() => { const e = new Error(lastLookupErr?.message || 'checkNumber.onWhatsApp failed'); e.code = lastLookupErr?.code; throw e; })();

      this.logToShieldGateway('INFO', `checkNumber: API response for ${phoneNumber}`, { result: res });
      
      if (res && res.exists) {
        result.exists = true;
        result.whatsappId = res.jid;

        try {
          // Public profile-picture lookup with a bounded retry for transient
          // failures. A single flaky/timing-out w:profile:picture request during
          // a long scan must not permanently record "no photo" for a number that
          // actually has a publicly visible picture — that would leave the avatar
          // missing from History/Reports even though /api/profile-picture could
          // serve it. Only soft failures are retried (short backoff, capped);
          // session/auth failures are rethrown so the caller can react.
          const avatarUrl = await this._resolveScannedAvatar(res.jid);
          result.avatar = avatarUrl || null;
          result.profilePhotoAvailable = !!result.avatar;
          this.logToShieldGateway('INFO', `checkNumber: Retrieved avatar for ${phoneNumber}`, { avatar: result.avatar });
          if (avatarUrl) {
            // Preserve the legitimately-public picture BYTES now (fire-and-forget,
            // never slows the scan) so History / Reports / PDF can still show the
            // photo after the signed pps URL expires or the session goes offline.
            // This is the same authorized, public-only source used elsewhere.
            this.fetchPictureBytes(avatarUrl)
              .then((pic) => {
                if (pic && pic.data && this.onScannedProfilePictureCallback) {
                  this.onScannedProfilePictureCallback(cleanNumber, avatarUrl, pic);
                }
              })
              .catch(() => {});
          }
        } catch (avatarErr) {
          // A transient failure doesn't mean the picture is unavailable.
          // Try the dedicated getProfilePicture fallback (different timeout,
          // separate retry path) before marking the result as no-photo.
          let fallbackAvatar = null;
          let fallbackAvatarUrl = null;
          try {
            fallbackAvatarUrl = await withTimeout(this.sock.profilePictureUrl(res.jid, 'image'), 8000, 'checkNumber.fallbackProfilePictureUrl');
            fallbackAvatar = await this.getProfilePicture(phoneNumber);
          } catch (_) { /* non-fatal */ }
          if (fallbackAvatar && fallbackAvatar.data) {
            result.avatar = fallbackAvatarUrl || result.avatar || '';
            result.profilePhotoAvailable = true;
            if (this.onScannedProfilePictureCallback) {
              try { this.onScannedProfilePictureCallback(cleanNumber, fallbackAvatarUrl || '', fallbackAvatar); } catch (_) {}
            }
          } else {
            result.profilePhotoAvailable = null;
          }
          this.logToShieldGateway('WARN', `checkNumber: Avatar fetch failed for ${phoneNumber}: ${avatarErr.message}`, { avatarErr });
        }

        try {
          // Display-name resolution. Business accounts expose a verified name via
          // the existing supported business-profile query; everyone else can only
          // be named from pushed contact/session data (never an on-demand scrape).
          // Any known name is set immediately so the row streams in fully named.
          const contactName = this._resolveContactName(cleanNumber);
          const biz = await withTimeout(this.fetchBusinessProfile(res.jid), CHECK_TIMEOUT_MS, 'checkNumber.fetchBusinessProfile');
          const bizVerified = biz && biz.hasData ? this._cleanNameValue(biz.verifiedName) : null;
          result.isBusiness = !!(biz && biz.hasData);
          result.verifiedName = bizVerified;
          result.isVerified = !!bizVerified;
          result.displayName = bizVerified || contactName || null;
          result.nameFound = !!result.displayName;
          result.nameSource = bizVerified ? 'business' : (contactName ? 'contact' : null);
          result.nameChecked = true;
          // No name right now — subscribe for a pushed rename/inbound pushName so
          // the row can be patched live if WhatsApp later shares one.
          if (!result.displayName) this._watchDisplayName(cleanNumber);
          this.logToShieldGateway('INFO', `checkNumber: Resolved display name for ${phoneNumber}`, { displayName: result.displayName, verifiedName: bizVerified, nameSource: result.nameSource });
        } catch (bizErr) {
          // Business-profile failures are non-fatal. Fall back to the pushed
          // contact name (zero network) so a flaky biz query never blanks a name
          // that was already known.
          const contactName = this._resolveContactName(cleanNumber);
          if (contactName) {
            result.displayName = contactName;
            result.nameFound = true;
            result.nameSource = result.nameSource || 'contact';
            result.nameChecked = true;
          } else {
            // The name query threw (timeout / network / session hiccup), so the
            // lookup did NOT complete. That is "Unavailable", NOT "Name Not
            // Found": keep nameChecked false so the UI shows Unavailable and a
            // future scan retries. Still watch for a pushed name to arrive.
            result.nameChecked = false;
            this._watchDisplayName(cleanNumber);
          }
          this.logToShieldGateway('WARN', `checkNumber: Business profile fetch failed for ${phoneNumber}: ${bizErr.message}`, { bizErr });
        }
      } else {
        this.logToShieldGateway('INFO', `checkNumber: Number ${phoneNumber} not found on WhatsApp`, { exists: false });
      }
    } catch (err) {
      // Session/auth failures (logged out, forbidden, bad session, connection
      // replaced) are NOT per-number errors — they mean the session itself is
      // gone. Rethrow so the scan loop stops and the session-recovery flow takes
      // over, instead of silently burning through the rest of the list with fake
      // failures. All other (transient, already-retried) failures become a normal
      // per-number error result and the scan continues.
      const msg = String(err?.message || '');
      const isSessionFailure = /logged\s*out|forbidden|bad\s*session|multidevice|connection\s*(replaced|closed)|unauthori[sz]ed|\b401\b|\b403\b|\b440\b/i.test(msg);
      if (isSessionFailure || err?.code === 'SCAN_STOPPED') {
        throw err;
      }
      console.error(`Error checking number ${phoneNumber}:`, err.message);
      result.error = err.message || 'Verification failed';
      this.logToShieldGateway('ERROR', `checkNumber: Error checking ${phoneNumber}`, { error: err.message, phoneNumber });
    }

    this.logToShieldGateway('INFO', `checkNumber: Completed check for ${phoneNumber} (exists: ${result.exists})`, { result });

    return result;
  }

  // Expose current outbound budget state for /api/health, auditing, and the UI.
  // Only the message-agent send budget keeps long-window accounting; lookup
  // tracking is a 60s pacing window only (see checkNumber).
  getOutboundState() {
    const now = Date.now();
    const sends = this._globalSendTimes.filter(t => now - t < 86400000);
    const lookups = this._globalLookupTimes.filter(t => now - t < 60000);
    const maxPerMinute = Number(process.env.WA_LOOKUP_MAX_PER_MINUTE) || 60;
    return {
      sendsLastHour: sends.filter(t => now - t < 3600000).length,
      sendsToday: sends.length,
      lookupsLastMinute: lookups.length,
      lookupThrottleActive: lookups.length >= maxPerMinute,
      sendBackoffUntil: this._sendBackoffUntil || 0,
      sendInFlight: this._sendInFlight
    };
  }

  // Flush the Signal key store to disk on shutdown. Without this, a SIGINT /
  // process kill during a 'creds.update' can leave creds.json and the pre-key
  // files inconsistent, which is one of the ways a later reconnect ends up
  // unable to decrypt (Bad MAC). Best-effort and time-bounded so it can never
  // hang the exit path.
  async flushAuthState() {
    if (!this.saveCreds) return;
    try {
      await Promise.race([
        this.saveCreds(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('creds flush timed out')), 4000))
      ]);
      console.log('[SHUTDOWN] Signal auth state flushed to disk.');
    } catch (err) {
      console.warn('[SHUTDOWN] Could not flush auth state (session still on disk):', err && err.message);
    }
  }

  // Number of inbound payloads we dropped because they could not be decrypted.
  // Exposed through /api/health so the condition stays observable without
  // flooding the console.
  getDecryptNoiseCount() {
    return this._decryptNoiseCount || 0;
  }

  // Reset rolling outbound budgets — called on logout so a fresh session starts
  // clean and cannot be held back by stale accounting.
  resetOutboundBudgets() {
    this._globalSendTimes = [];
    this._globalLookupTimes = [];
    this._consecutiveSendFailures = 0;
    this._sendBackoffUntil = 0;
    this._sendInFlight = false;
    this._sendHistory.clear();
    this._sendCooldown.clear();
  }
}

const whatsAppService = new WhatsAppService();
module.exports = whatsAppService;
