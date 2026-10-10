const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
  DEFAULT_CONNECTION_CONFIG,
  jidNormalizedUser,
  isJidGroup,
  getBinaryNodeChild,
  DisconnectReason,
  BufferJSON
} = require('@whiskeysockets/baileys');
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

// The ONLY close reason that means the persisted session is no longer usable and
// a fresh QR scan is required: 401 (loggedOut). Every other close code —
// including 408/428/440/500/503/515, connectionClosed, connectionLost, timeouts
// and unknown errors — is transient and MUST be recovered with the SAME session.
// An explicit user logout is handled separately via _intentionalDisconnect.
const SESSION_INVALID_CODES = new Set([
  DisconnectReason.loggedOut            // 401 — WhatsApp logged the device out
]);

// Close codes that mean WhatsApp rejected the WhatsApp Web version we advertised
// (usually a stale value). On these we refresh the version once and reconnect —
// always with the SAME session, never a logout.
const WA_VERSION_REJECT_CODES = new Set([
  405,                                  // 405 — version/browser rejected by WA servers
  DisconnectReason.connectionClosed,    // 428
  DisconnectReason.restartRequired      // 515
]);

// Authorization / session-identity denials from WhatsApp's servers. These are
// NOT transient network failures — retrying them forever just hammers WhatsApp
// and keeps the account flagged. 403 (forbidden) is usually "access denied after
// repeated bad handshakes", 411 (multideviceMismatch) means the linked device
// changed pairing mode, 419 means the session did not match the current app
// version. We try once more after a background version refresh (403/419 are at
// times a stale-version proxy), then STOP auto-reconnecting and ask the user to
// relink with a fresh QR — without deleting the session files.
const WA_AUTH_STOP_CODES = new Set([
  DisconnectReason.forbidden,           // 403 — access denied / account flagged
  DisconnectReason.multideviceMismatch, // 411 — pairing mode mismatch
  419,                                  // 419 — session did not match current app version
  DisconnectReason.badSession           // 500 — persisted session keys rejected by WA
]);

// --- WhatsApp Web version management ---------------------------------------
// The cached "last known good" version lives inside the project's existing
// backend/cache area (never the session folder, never a new top-level file), so
// startup works even when the network is slow or offline.
const WA_VERSION_FILE = 'wa-version.json';
const WA_VERSION_FETCH_TIMEOUT_MS = Number(process.env.WA_VERSION_FETCH_TIMEOUT_MS) || 18000;
const WA_VERSION_FETCH_RETRIES = Number(process.env.WA_VERSION_FETCH_RETRIES) || 3;
const WA_VERSION_REFRESH_INTERVAL_MS = Number(process.env.WA_VERSION_REFRESH_INTERVAL_MS) || 6 * 60 * 60 * 1000;
// Absolute last resort only — a fresh fetch (background + on rejection) keeps
// this from ever being used on a healthy network.
const WA_VERSION_FALLBACK = [2, 3000, 1043857760];

// --- Reconnect policy -------------------------------------------------------
// Transient drops reconnect with exponential backoff + jitter. A burst is
// capped at WA_RECONNECT_MAX_ATTEMPTS; after that the connection enters a
// cooldown pause (few attempts per window, never a hammer) and a slow recheck
// timer probes connectivity again at WA_RECONNECT_COOLDOWN_MS. The attempt
// counter resets only once the session stays connected for
// WA_RECONNECT_STABLE_RESET_MS (a brief blip does NOT grant a fresh burst).
const WA_RECONNECT_BASE_MS = Number(process.env.WA_RECONNECT_BASE_MS) || 5000;
const WA_RECONNECT_MAX_MS = Number(process.env.WA_RECONNECT_MAX_MS) || 5 * 60 * 1000;
const WA_RECONNECT_JITTER_MS = Number(process.env.WA_RECONNECT_JITTER_MS) || 1000;
const WA_RECONNECT_MAX_ATTEMPTS = Number(process.env.WA_RECONNECT_MAX_ATTEMPTS) || 5;
const WA_RECONNECT_COOLDOWN_MS = Number(process.env.WA_RECONNECT_COOLDOWN_MS) || 10 * 60 * 1000;
const WA_RECONNECT_STABLE_RESET_MS = Number(process.env.WA_RECONNECT_STABLE_RESET_MS) || 60 * 1000;
// How long a lookup (scan) will wait for a reconnecting session before giving
// up. The scan pauses and resumes on its own within this window.
const WA_RECONNECT_MAX_WAIT_MS = Number(process.env.WA_RECONNECT_MAX_WAIT_MS) || 5 * 60 * 1000;
// Socket timeouts sized for slow/metered networks (Baileys' own connect default
// is 20s). connectTimeoutMs/defaultQueryTimeoutMs keep a slow link from being
// mistaken for a dead one.
const WA_CONNECT_TIMEOUT_MS = Number(process.env.WA_CONNECT_TIMEOUT_MS) || 60000;
const WA_QUERY_TIMEOUT_MS = Number(process.env.WA_QUERY_TIMEOUT_MS) || 60000;
const WA_KEEPALIVE_INTERVAL_MS = Number(process.env.WA_KEEPALIVE_INTERVAL_MS) || 30000;

// Safety valve for the transient-set reconnect loop: if the SAME close code
// keeps recurring (e.g. a dead endpoint returning 500 forever), widen each
// retry to a slow cadence so the backend polls instead of hammers.
const WA_RECONNECT_SAME_CODE_SLOW = 10; // after N consecutive identical close codes
const WA_RECONNECT_SLOW_MS = Number(process.env.WA_RECONNECT_SLOW_MS) || 120 * 1000; // slow cadence: 2 min

// Close codes that are genuinely TRANSITORY and safe to auto-recover with the
// same session: connectionLost(408), connectionClosed(428), connectionReplaced
// (440 — another client took our slot; retrying is valid and the session lock
// prevents a second instance of this app), unavailableService(503),
// restartRequired(515). A null/undefined statusCode means the socket died
// without a code (pure network loss) — also retryable. EVERY other explicit
// code is treated as a stop (never hammer an unknown rejection).
const WA_RETRYABLE_CLOSE_CODES = new Set([
  DisconnectReason.connectionLost,       // 408
  DisconnectReason.connectionClosed,     // 428
  DisconnectReason.connectionReplaced,   // 440
  DisconnectReason.unavailableService,   // 503
  DisconnectReason.restartRequired       // 515
]);

// --- QR / pairing flow guards ------------------------------------------------
const WA_QR_MAX_REFRESHES = Number(process.env.WA_QR_MAX_REFRESHES) || 5;    // QRs per attempt
const WA_QR_TIMEOUT_MS = Number(process.env.WA_QR_TIMEOUT_MS) || 60 * 1000;   // whole attempt window
const WA_QR_COOLDOWN_MS = Number(process.env.WA_QR_COOLDOWN_MS) || 30 * 1000; // min gap between attempts
const WA_WARMUP_MS = Number(process.env.WA_WARMUP_MS) || 5 * 1000;            // silent before own-avatar / bursts
const WA_GLOBAL_OPS_PER_MINUTE = Number(process.env.WA_GLOBAL_OPS_PER_MINUTE) || 120; // 0 disables
const WA_RATE_LIMIT_PAUSE_MS = Number(process.env.WA_RATE_LIMIT_PAUSE_MS) || 2 * 60 * 1000;

// --- Circuit breaker --------------------------------------------------------
// A rolling window of connection/operation failures. Auth-family denials
// (403/411/419/500) trip the circuit immediately; N weaker errors trip it too.
// While open, ALL WhatsApp activity for this account pauses (status + reason
// surfaced to the dashboard) until the window expires.
const WA_CIRCUIT_TRIPS = Number(process.env.WA_CIRCUIT_TRIPS) || 5;
const WA_CIRCUIT_WINDOW_MS = Number(process.env.WA_CIRCUIT_WINDOW_MS) || 15 * 60 * 1000;
const WA_CIRCUIT_OPEN_MS = Number(process.env.WA_CIRCUIT_OPEN_MS) || 30 * 60 * 1000;

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
    this._autoRestoreAttempts = 0; // retained for compatibility; no longer gates reconnection
    this._reconnectAttempts = 0;   // consecutive transient-reconnect attempts (backoff, reset on open)
    this._reconnectTimer = null;   // single in-flight reconnect timer (guards against duplicates)
    this._sessionInvalidated = false; // true ONLY on a genuine 401 logout
    this._authRejectStreak = 0;   // consecutive authorization denials (403/411/419); one retry max
    this._lastCloseCode = null;   // last non-null close status code (for same-code cadence logic)
    this._sameCodeStreak = 0;     // consecutive identical close codes (transient-set slowdown)
    // Reconnect burst / cooldown bookkeeping.
    this._reconnectPaused = false;    // true while the burst is in the cooldown pause
    this._cooldownTimer = null;       // slow recheck timer armed after a burst cap
    this._connectedSince = null;      // when the current connection became established
    this._stableResetTimer = null;    // arms resetting _reconnectAttempts after a stable window
    this._needsManualRelink = false;  // true after an auth-family stop: only a fresh QR fixes it
    // QR / pairing-flow bookkeeping.
    this._pairingConnect = false;     // true when this connect() started without a valid session
    this._qrRefreshCount = 0;         // QR refreshes emitted during the current attempt
    this._qrTimeoutTimer = null;      // whole-attempt window for a fresh pairing
    this._qrCooldownUntil = 0;        // earliest allowed start of a NEW QR attempt
    // Warm-up + soft-availability window for outbound ops.
    this._sessionWarm = false;        // true once connected + stable for WA_WARMUP_MS
    this._warmupTimer = null;
    // Circuit breaker state.
    this._circuitErrors = [];         // rolling timestamps of recorded failures
    this._circuitOpenUntil = 0;       // 0 = closed
    this._circuitStopReason = null;
    // Rate-limit (429) pause + global outbound op budget.
    this._rateLimitedUntil = 0;
    this._globalOpTimes = [];         // ts of every global outbound op (lookup/send/profile)
    // WhatsApp Web version state: in-memory last-known-good version + its source.
    this._waVersion = null;
    this._waVersionSource = null;
    this._versionRefreshTimer = null;
    this._versionRefreshInFlight = false;
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

    // Resilient WhatsApp Web version management: never blocks startup. The first
    // connect uses the cached/bundled version immediately; a fresh fetch runs in
    // the background (and every ~6h) and applies on the next reconnect.
    this._startVersionRefreshLoop();
    this._checkBaileysNpmVersion().catch(() => {});

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
    // Cooldown between QR attempts: a user cannot hammer the QR endpoint (each
    // fresh attempt wipes the session folder and opens a new pairing socket).
    if (Date.now() < this._qrCooldownUntil) {
      const waitMs = this._qrCooldownUntil - Date.now();
      console.log(`[QR] Ignoring QR request — cooldown active, try again in ${Math.ceil(waitMs / 1000)}s.`);
      this.logToShieldGateway('WARN', 'QR generation throttled by cooldown', { waitMs });
      return;
    }
    // Guard: only one QR generation at a time to prevent concurrent session wipes
    // and overlapping connect attempts that cause the "WebSocket client limit reached"
    // spam and endless QR regeneration cycles.
    if (this._qrGenerating) {
      console.log('[QR] QR generation already in progress; skipping duplicate request.');
      return;
    }
    console.log('[QR] Connect/Relink requested by user — clearing all previous state.');
    // A fresh QR attempt is a deliberate user action: it resets EVERY pause,
    // manual-relink (403/401 stop), circuit, cooldown, retry timer and counter
    // so the account can be re-paired cleanly from any prior state.
    this._reconnectPaused = false;
    this._needsManualRelink = false;
    this._manualRelinkReason = null;
    this._closeCircuit();
    this._rateLimitedUntil = 0;
    this._qrCooldownUntil = 0;
    this._cancelCooldownTimer();
    this._cancelReconnect();
    this._cancelWarmup();
    this._cancelStableReset();
    this._clearConnectTimers();
    this._qrRefreshCount = 0;
    this._qrGenerating = true;
    try {
      this._intentionalDisconnect = true;
      this._pendingPairing = false;
      this._autoRestoreAttempts = 0;
      this._reconnectAttempts = 0;
      this._sameCodeStreak = 0;
      this._lastCloseCode = null;
      this._sessionInvalidated = false;
      this._authRejectStreak = 0;
      this._lastDisconnectReason = null;
      // Closes any old socket, removes its listeners and clears internal timers.
      this._cleanupInternalState();
      // Release the single-flight "connecting" lock so this explicit request is
      // never ignored by a stale in-flight attempt.
      this._connecting = false;
      console.log('[QR] Old state cleared (socket, timers, locks, stop flags, circuit).');

      // NON-DESTRUCTIVE fresh start: move the old (possibly 403/401-denied)
      // session folder to a TIMESTAMPED BACKUP instead of hard-deleting it,
      // then create an empty session directory so Baileys emits a fresh QR.
      if (this.sessionManager) {
        let backup = { moved: false, reason: 'no_manager' };
        try {
          backup = this.sessionManager.backupSession(this.sessionId);
        } catch (e) {
          backup = { moved: false, reason: e.message };
        }
        if (backup && backup.moved) {
          console.log(`[QR] Old session moved to timestamped backup: ${backup.backupPath}`);
        } else {
          console.log(`[QR] No old session to back up (${(backup && backup.reason) || 'none'}).`);
        }
        fs.mkdirSync(this.sessionPath, { recursive: true });
        console.log('[QR] Fresh empty session directory prepared.');
      }

      console.log('[QR] Starting fresh pairing socket — awaiting connection.update / QR event...');
      await this.connect();
    } finally {
      this._qrGenerating = false;
    }
  }

  isConnecting() {
    return this.status === 'CONNECTING' || this._connecting;
  }

  // ---------------------------------------------------------------------------
  // WhatsApp Web version resolution (resilient, never blocks the connection)
  // ---------------------------------------------------------------------------
  _versionCachePath() {
    return path.join(__dirname, 'cache', WA_VERSION_FILE);
  }

  _isValidVersion(v) {
    return Array.isArray(v) && v.length === 3 && v.every((n) => Number.isInteger(n) && n >= 0);
  }

  // Version shipped inside the installed @whiskeysockets/baileys package.
  _getBundledVersion() {
    try {
      const v = DEFAULT_CONNECTION_CONFIG && DEFAULT_CONNECTION_CONFIG.version;
      if (this._isValidVersion(v)) return v.slice();
    } catch (_) {}
    try {
      const p = require.resolve('@whiskeysockets/baileys/lib/Defaults/baileys-version.json');
      const j = require(p);
      if (j && this._isValidVersion(j.version)) return j.version.slice();
    } catch (_) {}
    return null;
  }

  _loadCachedVersion() {
    try {
      const file = this._versionCachePath();
      if (!fs.existsSync(file)) return null;
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && this._isValidVersion(data.version)) {
        return { version: data.version.slice(), source: 'cache' };
      }
    } catch (err) {
      console.warn('[WA_VERSION] Could not read cached Web version:', err.message);
    }
    return null;
  }

  _persistVersion(version, source = 'fetched') {
    try {
      const file = this._versionCachePath();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp-${process.pid}`;
      fs.writeFileSync(tmp, JSON.stringify({ version, source, updatedAt: new Date().toISOString() }), 'utf8');
      fs.renameSync(tmp, file);
    } catch (err) {
      console.warn('[WA_VERSION] Could not persist Web version cache:', err.message);
    }
  }

  // Resolve a usable version WITHOUT any network access: in-memory → cached →
  // bundled-in-package → hardcoded fallback. This is what keeps connect() from
  // ever being blocked by a slow/unreachable version endpoint.
  _ensureVersion() {
    if (this._isValidVersion(this._waVersion)) {
      return { version: this._waVersion, source: this._waVersionSource || 'cache' };
    }
    const cached = this._loadCachedVersion();
    if (cached) {
      this._waVersion = cached.version;
      this._waVersionSource = 'cache';
      return cached;
    }
    const bundled = this._getBundledVersion();
    if (bundled) {
      this._waVersion = bundled;
      this._waVersionSource = 'bundled';
      return { version: bundled, source: 'bundled' };
    }
    this._waVersion = WA_VERSION_FALLBACK.slice();
    this._waVersionSource = 'fallback';
    return { version: this._waVersion, source: 'fallback' };
  }

  _logVersion(version, source) {
    console.log(`[WA_VERSION] Using WhatsApp Web version v${version.join('.')} (source: ${source}).`);
  }

  // Fresh fetch across every source the installed Baileys offers, with a long
  // timeout and retry/backoff. Returns { version, source:'fetched' } or null.
  async _fetchVersionFresh() {
    const sources = [];
    if (typeof fetchLatestBaileysVersion === 'function') {
      sources.push({ name: 'baileys-master', run: () => fetchLatestBaileysVersion({ timeout: WA_VERSION_FETCH_TIMEOUT_MS }) });
    }
    if (typeof fetchLatestWaWebVersion === 'function') {
      sources.push({ name: 'web.whatsapp.com', run: () => fetchLatestWaWebVersion({ timeout: WA_VERSION_FETCH_TIMEOUT_MS }) });
    }
    let lastErr = null;
    for (const src of sources) {
      for (let attempt = 1; attempt <= WA_VERSION_FETCH_RETRIES; attempt++) {
        try {
          const res = await withTimeout(Promise.resolve(src.run()), WA_VERSION_FETCH_TIMEOUT_MS, `wa-version:${src.name}`);
          const v = res && res.version;
          if (this._isValidVersion(v) && res.isLatest !== false) {
            return { version: v.slice(), source: 'fetched', detail: src.name };
          }
          lastErr = new Error(`${src.name} returned a non-authoritative version`);
        } catch (err) {
          lastErr = err;
        }
        if (attempt < WA_VERSION_FETCH_RETRIES) {
          await new Promise((r) => setTimeout(r, Math.min(2000, 400 * Math.pow(2, attempt - 1))));
        }
      }
    }
    if (lastErr) console.warn('[WA_VERSION] Fresh version fetch failed on every source:', lastErr.message);
    return null;
  }

  // Non-blocking refresh: store a fresh version for the NEXT reconnect. Never
  // disconnects, logs out or resets the session just because a new version
  // appeared.
  async _refreshWaVersionInBackground() {
    if (this._versionRefreshInFlight) return null;
    this._versionRefreshInFlight = true;
    try {
      const result = await this._fetchVersionFresh();
      if (result && this._isValidVersion(result.version)) {
        const prev = this._isValidVersion(this._waVersion) ? this._waVersion.join('.') : null;
        const changed = prev !== result.version.join('.');
        this._waVersion = result.version.slice();
        this._waVersionSource = 'fetched';
        this._persistVersion(this._waVersion, 'fetched');
        if (changed) {
          console.log(`[WA_VERSION] Refreshed to v${result.version.join('.')} (source: fetched via ${result.detail}); will apply on next reconnect.`);
        }
        return result;
      }
    } catch (err) {
      console.warn('[WA_VERSION] Background version refresh failed:', err.message);
    } finally {
      this._versionRefreshInFlight = false;
    }
    return null;
  }

  _startVersionRefreshLoop() {
    if (this._versionRefreshTimer) return;
    // Startup refresh is non-blocking (deferred), then every ~6 hours.
    const kick = setTimeout(() => { this._refreshWaVersionInBackground().catch(() => {}); }, 3000);
    if (typeof kick.unref === 'function') kick.unref();
    this._versionRefreshTimer = setInterval(() => {
      this._refreshWaVersionInBackground().catch(() => {});
    }, WA_VERSION_REFRESH_INTERVAL_MS);
    if (typeof this._versionRefreshTimer.unref === 'function') this._versionRefreshTimer.unref();
  }

  // Warn (never install) when a newer @whiskeysockets/baileys exists on npm.
  async _checkBaileysNpmVersion() {
    let installed = null;
    try {
      installed = require('@whiskeysockets/baileys/package.json').version;
    } catch (_) {
      try {
        const main = require.resolve('@whiskeysockets/baileys');
        let dir = path.dirname(main);
        for (let i = 0; i < 4 && dir && !fs.existsSync(path.join(dir, 'package.json')); i++) dir = path.dirname(dir);
        if (dir) installed = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
      } catch (_) {}
    }
    try {
      const res = await withTimeout(
        fetch('https://registry.npmjs.org/@whiskeysockets/baileys/latest', { signal: AbortSignal.timeout(10000) }),
        12000,
        'baileys-npm-version'
      );
      if (!res || !res.ok) return;
      const data = await res.json();
      const latest = data && data.version;
      if (latest && installed && this._compareVersions(latest, installed) > 0) {
        console.warn(`[WA_VERSION] A newer @whiskeysockets/baileys is available: ${latest} (installed ${installed}). Update recommended (no auto-install).`);
      } else if (latest && installed) {
        console.log(`[WA_VERSION] @whiskeysockets/baileys ${installed} installed (latest on npm: ${latest}).`);
      }
    } catch (_) {
      // offline / registry unreachable — non-fatal
    }
  }

  _compareVersions(a, b) {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Reconnect plumbing (never loses a valid session)
  // ---------------------------------------------------------------------------
  _hasValidSession() {
    try {
      if (this.sessionManager) return !!this.sessionManager.isSessionValid(this.sessionId);
      return fs.existsSync(path.join(this.sessionPath, 'creds.json'));
    } catch (_) {
      return false;
    }
  }

  _clearConnectTimers() {
    if (this._connectTimeout) {
      clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }
    if (this._qrTimeoutTimer) {
      clearTimeout(this._qrTimeoutTimer);
      this._qrTimeoutTimer = null;
    }
    if (this._presenceInterval) {
      clearInterval(this._presenceInterval);
      this._presenceInterval = null;
    }
  }

  _cancelReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _cancelCooldownTimer() {
    if (this._cooldownTimer) {
      clearTimeout(this._cooldownTimer);
      this._cooldownTimer = null;
    }
    this._reconnectPaused = false;
  }

  _cancelWarmup() {
    if (this._warmupTimer) {
      clearTimeout(this._warmupTimer);
      this._warmupTimer = null;
    }
    this._sessionWarm = false;
  }

  _cancelStableReset() {
    if (this._stableResetTimer) {
      clearTimeout(this._stableResetTimer);
      this._stableResetTimer = null;
    }
  }

  // The session is usable for outbound traffic only once it has been connected
  // and stable for a short warm-up window. This prevents burst requests (avatar,
  // lookups, presence-adjacent calls) from racing the socket right after open.
  isSessionWarm() {
    return this.status === 'CONNECTED' && !!this.sock && this._sessionWarm;
  }

  // Interruptible warm-up wait used by checkNumber/sendMessage.
  async _waitForSessionReady(opts = {}) {
    const shouldStop = typeof opts.shouldStop === 'function' ? opts.shouldStop : () => false;
    const giveUpAt = Date.now() + Math.max(WA_WARMUP_MS + 5000, 15000);
    while (!this.isSessionWarm()) {
      if (shouldStop()) return false;
      if (this._intentionalDisconnect || this._sessionInvalidated) return false;
      if (this._needsManualRelink || this._circuitOpenUntil > Date.now()) return false;
      if (Date.now() > giveUpAt) {
        // Connected but still warming up is NOT an error — surface the gate.
        if (this.status === 'CONNECTED' && this.sock) return true;
        return false;
      }
      if (!this._hasValidSession()) return false;
      await new Promise((r) => setTimeout(r, 200));
    }
    return true;
  }

  _completeWarmup() {
    this._sessionWarm = true;
    if (this._warmupTimer) this._warmupTimer = null;
    // The warm-up window is also the stability floor for attempt-reset: only a
    // connection that survives this long earns a fresh reconnect burst.
    this._cancelStableReset();
    this._stableResetTimer = setTimeout(() => {
      this._stableResetTimer = null;
      if (this.status === 'CONNECTED' && this.sock) {
        const fired = this._reconnectAttempts > 0;
        this._reconnectAttempts = 0;
        this._lastCloseCode = null;
        this._sameCodeStreak = 0;
        this._autoRestoreAttempts = 0;
        this._closeCircuit();
        this._reconnectPaused = false;
        if (fired) console.log(`[RECONNECT] Session has been stable for ${(WA_RECONNECT_STABLE_RESET_MS / 1000).toFixed(0)}s — retry counter reset.`);
      }
    }, WA_RECONNECT_STABLE_RESET_MS);
    if (this._stableResetTimer && typeof this._stableResetTimer.unref === 'function') this._stableResetTimer.unref();
    // Own-avatar fetch deferred to the warm window (no request burst on open).
    if (this._pendingAvatarJid && this.sock && this.status === 'CONNECTED') {
      const jid = this._pendingAvatarJid;
      this._pendingAvatarJid = null;
      this._loadOwnAvatar(jid);
    } else {
      this._pendingAvatarJid = null;
    }
  }

  // --- Close-code classification -------------------------------------------
  // Returns { decision, reason, code } where decision is one of:
  //   'intentional' | 'pairing' | 'loggedOut' | 'noSession' | 'authStop' |
  //   'unknownStop' | 'retry'
  _classifyClose(statusCode, hasValidSession) {
    if (!hasValidSession) return { decision: 'noSession', reason: 'No valid persisted session', code: statusCode };
    if (SESSION_INVALID_CODES.has(statusCode)) {
      return { decision: 'loggedOut', reason: 'Session logged out (401) — fresh QR scan required', code: statusCode };
    }
    if (WA_AUTH_STOP_CODES.has(statusCode)) {
      return { decision: 'authStop', reason: this._authStopReason(statusCode), code: statusCode };
    }
    if (statusCode != null && !WA_RETRYABLE_CLOSE_CODES.has(statusCode)) {
      return { decision: 'unknownStop', reason: `Unhandled disconnect (${statusCode}) — not auto-retrying to protect the account`, code: statusCode };
    }
    return { decision: 'retry', reason: `Transient disconnect (${statusCode == null ? 'no status code' : statusCode})`, code: statusCode };
  }

  _authStopReason(statusCode) {
    if (statusCode === DisconnectReason.multideviceMismatch) {
      return 'Multi-device pairing mismatch (411) — relink with a fresh QR scan.';
    }
    if (statusCode === 419) {
      return 'Unauthorized (419) — session did not match the current WhatsApp app version. Relink with a fresh QR scan.';
    }
    if (statusCode === DisconnectReason.badSession) {
      return 'Bad session (500) — WhatsApp rejected the persisted session keys. Relink with a fresh QR scan.';
    }
    return 'Access denied (403) — WhatsApp is refusing this session/account. Relink with a fresh QR scan.';
  }

  // --- Circuit breaker ------------------------------------------------------
  _circuitOpen() {
    return this._circuitOpenUntil > Date.now();
  }

  _recordCircuitError(severity = 2) {
    const now = Date.now();
    this._circuitErrors = this._circuitErrors.filter((t) => now - t < WA_CIRCUIT_WINDOW_MS);
    for (let i = 0; i < severity; i++) this._circuitErrors.push(now);
    const pending = this._circuitErrors.filter((t) => now - t < WA_CIRCUIT_WINDOW_MS);
    if (pending.length >= WA_CIRCUIT_TRIPS) {
      this._openCircuit('Repeated WhatsApp errors detected — WhatsApp activity paused to protect the account.');
      return true;
    }
    return false;
  }

  _openCircuit(reason) {
    this._circuitOpenUntil = Date.now() + WA_CIRCUIT_OPEN_MS;
    this._circuitStopReason = reason;
    this._cancelReconnect();
    this._cancelCooldownTimer();
    console.warn(`[CIRCUIT] ${reason} Resume after ${(WA_CIRCUIT_OPEN_MS / 60000).toFixed(0)} min at ${new Date(this._circuitOpenUntil).toLocaleTimeString()}.`);
    this.logToShieldGateway('WARN', 'Circuit breaker opened — WhatsApp activity paused', { reason, resumeAt: new Date(this._circuitOpenUntil).toISOString() });
    this.updateStatus('DISCONNECTED', { error: `${reason} Auto-resumes at ${new Date(this._circuitOpenUntil).toLocaleTimeString()}.` });
  }

  _closeCircuit() {
    this._circuitErrors = [];
    this._circuitOpenUntil = 0;
    this._circuitStopReason = null;
  }

  // --- Global outbound op budget (lookups/sends/profile fetch share one pool) -
  _consumeGlobalOp() {
    if (!WA_GLOBAL_OPS_PER_MINUTE) return true;
    const now = Date.now();
    this._globalOpTimes = this._globalOpTimes.filter((t) => now - t < 60000);
    if (this._globalOpTimes.length >= WA_GLOBAL_OPS_PER_MINUTE) return false;
    this._globalOpTimes.push(now);
    return true;
  }

  _globalOpWaitMs() {
    if (!this._globalOpTimes.length) return 0;
    const now = Date.now();
    const oldest = this._globalOpTimes[0];
    return Math.max(0, Math.min(30000, oldest - now + 60000));
  }

  // --- Stuck pairing / QR-window teardown ------------------------------------
  // Ends a QR/pairing attempt cleanly, wipes any half-created session files
  // (there is never a valid session during a pairing attempt — generateQRCode
  // already prepared a fresh empty folder), and surfaces a user-actionable
  // status. Never touches a valid persisted session.
  _abortPairingAttempt(reason, errorMsg = reason) {
    this._cancelReconnect();
    this._clearConnectTimers();
    this._cancelWarmup();
    this._cancelStableReset();
    this._pendingPairing = false;
    this._pairingConnect = false;
    this._connecting = false;
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        this.sock.end().catch(() => {});
      } catch (e) {}
      this.sock = null;
    }
    const hadValid = this._hasValidSession();
    if (this.sessionManager && !hadValid) {
      try {
        this.sessionManager.deleteSession(this.sessionId);
        console.log(`[QR] ${reason} — removed half-created session files.`);
      } catch (e) {
        console.warn(`[QR] Could not clean half-created session: ${e.message}`);
      }
    }
    console.log(`[QR] ${reason}`);
    this.logToShieldGateway('WARN', `QR/pairing attempt aborted: ${reason}`, { errorMsg });
    this.updateStatus('DISCONNECTED', { error: errorMsg });
  }

  // Called on EVERY `qr` field event. Baileys may emit a fresh QR repeatedly
  // while the pairing stays un-scanned; cap the refreshes and start the attempt
  // window on the first one so a stale QR can never linger forever.
  _onQr(update) {
    if (!update || !update.qr) return;
    this._qrRefreshCount += 1;
    if (!this._qrTimeoutTimer && this._pairingConnect) {
      this._qrTimeoutTimer = setTimeout(() => {
        this._qrTimeoutTimer = null;
        if (this.status === 'QR_CODE' && this._pairingConnect) {
          this._abortPairingAttempt('QR_EXPIRED', 'QR code expired — click "Connect" to get a new one.');
        }
      }, WA_QR_TIMEOUT_MS);
      if (this._qrTimeoutTimer.unref) this._qrTimeoutTimer.unref();
    }
    if (this._qrRefreshCount > WA_QR_MAX_REFRESHES) {
      this._abortPairingAttempt(`QR_REFRESH_CAP (${WA_QR_MAX_REFRESHES} refreshes)`, `QR code was refreshed too many times — click "Connect" for a new QR code.`);
      return;
    }
    QRCode.toDataURL(update.qr)
      .then((dataUrl) => {
        // Only apply while this is still the live pairing attempt. The FIRST QR
        // arrives while status is still CONNECTING, so we must NOT require an
        // already-QR_CODE status here (doing so dropped every first QR and left
        // the UI spinning forever). Abort/supersede clears _pairingConnect.
        if (!this._pairingConnect || this.status === 'CONNECTED') return;
        this.qrCodeDataUrl = dataUrl;
        this.updateStatus('QR_CODE');
        console.log(`[QR] QR emitted (refresh ${this._qrRefreshCount}/${WA_QR_MAX_REFRESHES}) — broadcast to the frontend as QR_CODE.`);
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
      });
  }

  // Central close/teardown handler. EVERY socket close funnels through here so
  // the classify → stop/retry decision is testable in one place and can never
  // diverge from the QC rules (no auto-retry on the auth family, burst-capped
  // transient retries, session files always preserved on transient/unknown).
  async _handleClose({ statusCode, closeMessage = '', wasIntentional = this._intentionalDisconnect, shouldCompletePairing = this._pendingPairing }) {
    this._clearConnectTimers();
    this._cancelWarmup();
    this._cancelStableReset();
    this._intentionalDisconnect = false;
    this._pendingPairing = false;
    this._connecting = false;
    this._pairingConnect = false;

    console.log(`Connection closed. Status code: ${statusCode}. Intentional: ${wasIntentional}. Completing pairing: ${shouldCompletePairing}.`);

    // Close the dead socket cleanly BEFORE any reconnect, so there is never
    // more than one socket / connect attempt in flight at a time.
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        await this.sock.end().catch(() => {});
      } catch (e) {}
    }
    this.sock = null;

    // An explicit user logout / QR cancel stops here.
    if (wasIntentional) {
      console.log('Intentional disconnect — not reconnecting.');
      this._cancelReconnect();
      this.updateStatus('DISCONNECTED');
      return;
    }

    const hasValidSession = this._hasValidSession();

    // A pairing that just succeeded reconnects once (immediately) to finish the
    // user-initiated login.
    if (shouldCompletePairing && hasValidSession) {
      console.log('Pairing complete — reconnecting immediately to finish login.');
      this._scheduleReconnect({ immediate: true, reason: 'pairing-complete' });
      return;
    }

    const { decision, reason } = this._classifyClose(statusCode, hasValidSession);
    this._lastDisconnectReason = reason;
    console.log(`[CLOSE_DECISION] status=${statusCode == null ? 'null' : statusCode} → ${decision} (${reason})`);
    this.logToShieldGateway('INFO', `Socket closed with status ${statusCode == null ? 'null' : statusCode} — decision: ${decision}`, { statusCode, decision, reason });

    switch (decision) {
      case 'loggedOut': {
        this._sessionInvalidated = true;
        this._needsManualRelink = true;
        this._manualRelinkReason = reason;
        this._cancelReconnect();
        this._cancelCooldownTimer();
        console.log('WhatsApp logged this device out (401) — a fresh QR scan is required.');
        this.updateStatus('DISCONNECTED', { loggedOut: true, relinkRequired: true, needsManualRelink: true, reason });
        return;
      }
      case 'authStop': {
        // NEVER auto-retry 403/411/419/500. Keep the session files, stop all
        // retries, surface the actionable reason, and trip the circuit breaker
        // so no other WhatsApp activity for this account can continue.
        this._needsManualRelink = true;
        this._manualRelinkReason = reason;
        this._authRejectStreak = 0;
        this._cancelReconnect();
        this._cancelCooldownTimer();
        console.log(`Connection closed. Status code: ${statusCode}. Stopping auto-reconnect to protect the account.`);
        console.log(`[STATUS] ${reason}`);
        this._recordCircuitError(3);
        this.updateStatus('DISCONNECTED', { error: reason, statusCode, relinkRequired: true, needsManualRelink: true, reason });
        return;
      }
      case 'unknownStop': {
        this._cancelReconnect();
        this._cancelCooldownTimer();
        console.log(`[STATUS] ${reason}`);
        this.logToShieldGateway('WARN', 'Stopped auto-reconnect — unrecognized close code', { statusCode, reason });
        this._recordCircuitError(2);
        // An unrecognized close is not auto-retried either: the session stays on
        // disk but the app must not silently reconnect. Surface it as a manual
        // relink so the UI offers a fresh QR rather than hanging.
        this._needsManualRelink = true;
        this._manualRelinkReason = reason;
        this.updateStatus('DISCONNECTED', { error: reason, statusCode, relinkRequired: true, needsManualRelink: true, reason });
        return;
      }
      case 'noSession': {
        this._cancelReconnect();
        this._cancelCooldownTimer();
        console.log('No valid persisted session — waiting for user to generate a fresh QR code.');
        this.updateStatus('DISCONNECTED');
        return;
      }
      case 'retry':
      default: {
        // Version rejected by WhatsApp? Refresh once before reconnecting, but
        // KEEP the same session (never a logout). The refresh is non-blocking.
        if (WA_VERSION_REJECT_CODES.has(statusCode) || /version/i.test(closeMessage)) {
          console.warn(`[WA_VERSION] WhatsApp rejected the current Web version (status ${statusCode}${closeMessage ? `, "${closeMessage}"` : ''}) — refreshing before reconnect.`);
          this._refreshWaVersionInBackground().catch(() => {});
        }
        console.log('Transient disconnect — restoring persisted WhatsApp session automatically.');
        this._recordCircuitError(1);
        this._scheduleReconnect({ statusCode, reason: `close:${statusCode == null ? 'unknown' : statusCode}` });
        return;
      }
    }
  }

  // Central open handler. Marks the session warm after a short quiet window,
  // defers the own-avatar fetch until then, and only resets the reconnect burst
  // after the connection has been stable for WA_RECONNECT_STABLE_RESET_MS.
  _handleOpen() {
    this._clearConnectTimers();
    this._cancelWarmup();
    this._cancelStableReset();
    this._pendingPairing = false;
    this._sessionInvalidated = false;
    this._authRejectStreak = 0;
    this._needsManualRelink = false;
    this._manualRelinkReason = null;
    this._lastDisconnectReason = null;
    this._cancelReconnect();
    console.log('WhatsApp connection successfully opened!');

    const me = this.sock && this.sock.user;
    this.userInfo = me ? {
      id: me.id,
      name: me.name || 'WhatsApp Session',
      number: me.id.split(':')[0]
    } : null;
    this._connecting = false;
    this._connectedSince = Date.now();

    // Broadcast CONNECTED immediately. The own-profile picture query can hang
    // for many seconds on a fresh pairing (Baileys issues a request/response iq
    // to s.whatsapp.net right after open), so it must never block the login
    // transition.
    this.updateStatus('CONNECTED');

    // Persist creds in the background (non-blocking) once the session is
    // actually established (saveCreds itself skips partial/unpaired creds).
    this.saveCreds && this.saveCreds().catch(() => {});

    // Quiet window: no own-avatar / outbound burst until the session is warm.
    this._sessionWarm = false;
    this._warmupTimer = setTimeout(() => this._completeWarmup(), WA_WARMUP_MS);
    if (this._warmupTimer && typeof this._warmupTimer.unref === 'function') this._warmupTimer.unref();

    // Defer the own-avatar fetch until the warm window completes.
    const meId = me && me.id;
    this._avatarLoading = false;
    if (meId && this.sock) {
      this._pendingAvatarJid = meId;
    }
  }

  // --- Corrupt persisted auth -------------------------------------------------
  _handleCorruptAuth(errMsg) {
    console.error(`[AUTH] Persisted auth state is corrupt/unreadable: ${errMsg}`);
    this.logToShieldGateway('ERROR', 'Corrupt auth state detected — requiring fresh login', { errMsg });
    if (this.sessionManager) {
      try {
        this.sessionManager.deleteSession(this.sessionId);
        console.log('[AUTH] Corrupt session folder removed — a fresh QR scan is required.');
      } catch (e) {
        console.warn(`[AUTH] Could not remove corrupt session folder: ${e.message}`);
      }
    }
    this._needsManualRelink = true;
    this._intentionalDisconnect = false;
    this._connecting = false;
    this._sessionInvalidated = false;
    this.updateStatus('DISCONNECTED', { error: 'Saved authentication state was corrupted — a fresh QR scan is required.' });
  }

  // Manual/restart recovery lever when auto-reconnect has paused or stopped.
  // Resets the pause state and schedules ONE immediate reconnect attempt with
  // the same persisted session (never deletes anything).
  retryReconnect() {
    if (this._intentionalDisconnect || this._sessionInvalidated) {
      console.log('[RECONNECT] retryReconnect ignored — session intentionally disconnected / logged out.');
      return false;
    }
    if (!this._hasValidSession()) {
      console.log('[RECONNECT] retryReconnect ignored — no valid persisted session.');
      return false;
    }
    if (this.status === 'CONNECTED' && this.sock) {
      console.log('[RECONNECT] retryReconnect ignored — already connected.');
      return false;
    }
    this._cancelCooldownTimer();
    this._cancelReconnect();
    this._cancelWarmup();
    this._reconnectPaused = false;
    this._needsManualRelink = false;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    console.log('[RECONNECT] Manual retry requested — reconnecting with the same session.');
    this._scheduleReconnect({ immediate: true, reason: 'manual-retry' });
    return true;
  }

  // Clean, non-destructive teardown for server shutdown. Detaches listeners,
  // ends the socket, and cancels every timer — the session files are left
  // untouched so a restart restores the same session.
  async shutdown() {
    this._intentionalDisconnect = true;
    this._cancelReconnect();
    this._cancelCooldownTimer();
    this._cancelWarmup();
    this._cancelStableReset();
    this._clearConnectTimers();
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        await this.sock.end().catch(() => {});
      } catch (e) {}
      this.sock = null;
    }
    this._connecting = false;
  }

  // Schedule exactly ONE reconnect at a time. Exponential backoff with jitter,
  // capped at WA_RECONNECT_MAX_MS. A burst is limited to WA_RECONNECT_MAX_ATTEMPTS
  // then pauses into a cooldown + slow recheck — never a hammer. While waiting,
  // broadcast CONNECTING (never DISCONNECTED) so a running scan pauses instead
  // of failing. `statusCode` tracks identical-code streaks so a dead endpoint
  // that never recovers widens to a slow cadence.
  _scheduleReconnect({ immediate = false, reason = 'transient', statusCode = null } = {}) {
    if (this._intentionalDisconnect || this._sessionInvalidated) return;
    if (this._needsManualRelink) {
      console.log(`[RECONNECT] Not reconnecting (${reason}) — a fresh QR login is required (${this._manualRelinkReason || 'auth stop'}).`);
      return;
    }
    if (this._circuitOpen()) {
      console.log(`[RECONNECT] Not reconnecting (${reason}) — circuit breaker is open until ${new Date(this._circuitOpenUntil).toLocaleTimeString()}.`);
      return;
    }
    if (this._reconnectPaused) {
      console.log(`[RECONNECT] Not reconnecting (${reason}) — in cooldown pause; a slow recheck is already armed.`);
      return;
    }
    if (this._reconnectTimer) return; // one reconnect scheduled at a time
    if (!this._hasValidSession()) return;
    if (statusCode != null) {
      if (statusCode === this._lastCloseCode) {
        this._sameCodeStreak = (this._sameCodeStreak || 0) + 1;
      } else {
        this._sameCodeStreak = 1;
        this._lastCloseCode = statusCode;
      }
    }
    const attempt = this._reconnectAttempts;

    // Hard burst cap → pause + slow recheck. Keeps a failing endpoint/target at
    // a few attempts per window while still self-healing once connectivity
    // (or WhatsApp) returns.
    if (!immediate && attempt >= WA_RECONNECT_MAX_ATTEMPTS) {
      // Cancel any PREVIOUS cooldown first: _cancelCooldownTimer clears the
      // pause flag, so it must run before we set the new pause + arm the timer.
      this._cancelCooldownTimer();
      this._reconnectPaused = true;
      const pauseMsg = `Reconnect attempts exhausted (${attempt}/${WA_RECONNECT_MAX_ATTEMPTS}) — retries paused. Will recheck in ${(WA_RECONNECT_COOLDOWN_MS / 1000).toFixed(0)}s.`;
      console.warn(`[RECONNECT] ${pauseMsg}`);
      this.logToShieldGateway('WARN', 'Auto-reconnect paused (burst cap reached)', { attempt, cooldownMs: WA_RECONNECT_COOLDOWN_MS });
      this.updateStatus('DISCONNECTED', { error: pauseMsg, reconnectPaused: true });
      this._cooldownTimer = setTimeout(() => {
        this._cooldownTimer = null;
        this._reconnectPaused = false;
        this._reconnectAttempts = 0;
        if (!this._intentionalDisconnect && !this._sessionInvalidated && !this._needsManualRelink) {
          console.log('[RECONNECT] Cooldown elapsed — starting a fresh reconnect burst.');
          this._scheduleReconnect({ reason: 'cooldown-elapsed' });
        }
      }, WA_RECONNECT_COOLDOWN_MS);
      if (this._cooldownTimer.unref) this._cooldownTimer.unref();
      return;
    }

    let delay = immediate ? 250 : Math.min(WA_RECONNECT_MAX_MS, WA_RECONNECT_BASE_MS * Math.pow(2, attempt));
    delay += Math.floor(Math.random() * (WA_RECONNECT_JITTER_MS + 1)); // ±jitter so a fleet of restarts never fires in lockstep
    if (this._sameCodeStreak > WA_RECONNECT_SAME_CODE_SLOW) {
      delay = Math.max(delay, WA_RECONNECT_SLOW_MS);
    }
    this._reconnectAttempts = attempt + 1;
    if (this.status !== 'CONNECTING') this.updateStatus('CONNECTING');
    console.log(`[RECONNECT] ${reason} — reconnecting with the same session in ${(delay / 1000).toFixed(1)}s (attempt ${this._reconnectAttempts}/${WA_RECONNECT_MAX_ATTEMPTS}).`);
    this.logToShieldGateway('INFO', 'Transient disconnect — scheduling automatic reconnect', { reason, attempt: this._reconnectAttempts, delay });
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (this._intentionalDisconnect || this._sessionInvalidated || this._needsManualRelink) return;
      this.connect().catch((err) => {
        console.warn('[RECONNECT] Reconnect attempt failed:', err.message);
        const msg = String(err.message || '');
        const isNetwork = /ENOTFOUND|EHOSTUNREACH|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ENETUNREACH|fetch\s*failed|network/i.test(msg);
        this._scheduleReconnect({ reason: isNetwork ? 'network-unreachable' : 'reconnect-failed', statusCode: isNetwork ? null : undefined });
      });
    }, delay);
  }

  // Wait (interruptibly) for a reconnecting session to come back, so a running
  // scan pauses and auto-resumes instead of failing with "session is not active".
  async _waitForConnection(opts = {}) {
    const shouldStop = typeof opts.shouldStop === 'function' ? opts.shouldStop : () => false;
    let announced = false;
    const giveUpAt = Date.now() + WA_RECONNECT_MAX_WAIT_MS;
    while (this.status !== 'CONNECTED' || !this.sock) {
      if (this._intentionalDisconnect || this._sessionInvalidated) return false;
      if (shouldStop()) return false;
      if (Date.now() > giveUpAt) return false;
      if (!this._hasValidSession()) return false;
      if (!announced) {
        announced = true;
        console.log('[CHECK_NUMBER] Session is reconnecting — pausing lookups until it is back.');
        this.logToShieldGateway('WARN', 'checkNumber paused: session reconnecting (auto-resume)', { status: this.status });
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return true;
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
    // A fresh connect supersedes any pending reconnect timer so there is only
    // ever one connect attempt in flight.
    this._cancelReconnect();

    // A connect that starts without a valid persisted session is a pairing
    // attempt: it has a hard QR window (WA_QR_TIMEOUT_MS) and any leftover
    // half-created session files are wiped on abort.
    this._pairingConnect = !this._hasValidSession();
    this._qrRefreshCount = 0;
    this._cancelWarmup();
    this._cancelStableReset();

    // Safety timeout: reset _connecting flag if Baileys never fires connection.update.
    // Also tears down the stalled socket. For a valid persisted session this
    // schedules another reconnect instead of abandoning the session.
    if (this._connectTimeout) clearTimeout(this._connectTimeout);
    this._connectTimeout = setTimeout(() => {
      if (!this._connecting) return;
      console.warn(`[CONNECT] Connection timed out after ${WA_CONNECT_TIMEOUT_MS / 1000}s — tearing down stalled socket.`);
      this._connecting = false;
      this._pendingPairing = false;
      if (!this._intentionalDisconnect && this._pairingConnect) {
        // Never leave a stale QR / half-created session behind after a timeout.
        this._abortPairingAttempt('CONNECT_TIMEOUT', 'Connection timed out — click "Connect" to try again.');
        return;
      }
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
      if (!this._intentionalDisconnect && this._hasValidSession()) {
        this._scheduleReconnect({ reason: 'connect-timeout' });
      } else {
        this.updateStatus('DISCONNECTED', { error: 'Connection timed out' });
      }
    }, WA_CONNECT_TIMEOUT_MS);

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

      let state;
      try {
        ({ state } = await useMultiFileAuthState(this.sessionPath));
      } catch (authErr) {
        // Unparseable/corrupt creds.json (or a load failure) must never loop:
        // delete the unusable auth state and require a fresh login.
        this._handleCorruptAuth(String(authErr && authErr.message || authErr));
        return;
      }
      this.state = state;
      this.saveCreds = async () => {
        try {
          // Never persist a PARTIAL pairing: creds without a device identity are
          // a half-created QR login, not a session. Only a genuinely linked set
          // (device id + key material) is atomically written, so a crash during
          // pairing can never leave a "half-registered" creds.json behind.
          const cred = this.state && this.state.creds;
          if (!cred || !cred.me || !cred.me.id || !cred.noiseKey) {
            this._partialCredsSkips = (this._partialCredsSkips || 0) + 1;
            if (this._partialCredsSkips === 1) {
              console.log('[SAVE_CREDS] Skipping persist of partial (unpaired) auth state.');
            }
            return;
          }
          // Atomic persistence: serialize the in-memory creds and write via
          // temp+rename. Baileys' own saveCreds uses a plain non-atomic
          // writeFile, so a crash mid-write could corrupt creds.json. We keep
          // the reference (for key-file writes) but persist creds ourselves.
          const serialized = JSON.stringify(cred, BufferJSON.replacer);
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

      // Resilient Web-version resolution. This is deliberately SYNCHRONOUS and
      // network-free so the connection is NEVER blocked by a slow or unreachable
      // version endpoint: in-memory/cached last-good → bundled-in-package →
      // hardcoded fallback. A fresh fetch runs in the background (and once on a
      // version-rejection close) and is applied on the NEXT reconnect.
      const { version, source } = this._ensureVersion();
      this._logVersion(version, source);

      this.sock = makeWASocket({
        version,
        auth: this.state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        // Socket timeouts sized for slow/metered networks (Baileys' own default
        // connect timeout is 20s). A slow link is not a dead link.
        connectTimeoutMs: WA_CONNECT_TIMEOUT_MS,
        defaultQueryTimeoutMs: WA_QUERY_TIMEOUT_MS,
        keepAliveIntervalMs: WA_KEEPALIVE_INTERVAL_MS,
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
      console.log('[CONNECT] Socket created; awaiting connection.update / QR...');

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
        console.log(`[CONNECT] connection.update received: connection=${connection || '-'}, qr=${qr ? 'present' : 'none'}, newLogin=${update.isNewLogin ? 'yes' : 'no'}`);

        // Baileys emits isNewLogin:true on pair-success, just before the server
        // intentionally closes the connection so the freshly-paired session can be
        // re-established. Remember this so the post-pairing close can be completed
        // with a single reconnect (required to finish the user-initiated login).
        if (update.isNewLogin) {
          this._pendingPairing = true;
        }

        if (qr) {
          this._onQr(update);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const closeMessage = String(
            lastDisconnect?.error?.message || lastDisconnect?.error?.output?.payload?.message || ''
          ).slice(0, 200);
          await this._handleClose({ statusCode, closeMessage });
        } else if (connection === 'open') {
          this._handleOpen();
        }
      });

    } catch (err) {
      this._clearConnectTimers();
      console.error('Error during WhatsApp connection initialization:', err);
      this._connecting = false;
      // A failed connect with a still-valid session is transient: keep retrying
      // (same session) instead of dropping to the QR flow.
      if (!this._intentionalDisconnect && !this._sessionInvalidated && this._hasValidSession()) {
        this._scheduleReconnect({ reason: 'connect-error' });
      } else {
        this.updateStatus('DISCONNECTED', { error: err.message });
      }
    }
  }

  _cleanupInternalState() {
    // Tears down socket, timers, and flags but does NOT touch session files on disk
    this._pendingPairing = false;
    this._cancelReconnect();
    this._clearConnectTimers();
    this._cancelWarmup();
    this._cancelStableReset();
    this._pendingAvatarJid = null;
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
    // cancel_qr is only meant to clear stale QR-generation/pairing state. Never
    // tear down a live, connected session — that would silently invalidate a link
    // the user just established. Ending an active session requires an explicit
    // logout (preserves the user-initiated connection flow).
    if (this.status === 'CONNECTED' && this.sock) {
      console.log('[CANCEL_QR] Ignored — an active WhatsApp session is connected.');
      return;
    }
    // A CONNECTING state that is a real session restore (valid creds on disk +
    // reconnect in progress) is never cancelled — that would kill a healthy
    // auto-restore. Only the client-driven pairing flow (no valid session yet)
    // is a pairing attempt that can be aborted.
    if (this.status === 'CONNECTING' && !this._pairingConnect && this._hasValidSession()) {
      console.log('[CANCEL_QR] Ignored — session restore in progress.');
      return;
    }
    console.log('[CANCEL_QR] Cancelling active QR generation / pairing');
    this._intentionalDisconnect = true;
    this._pendingPairing = false;
    this._autoRestoreAttempts = 0;
    this._reconnectAttempts = 0;
    this._sessionInvalidated = false;
    this._authRejectStreak = 0;
    this._lastCloseCode = null;
    this._sameCodeStreak = 0;
    this._cancelWarmup();
    this._cancelStableReset();
    this._cancelCooldownTimer();
    this._pendingAvatarJid = null;
    if (this._pairingConnect) {
      // Live pairing socket → tear it down and remove any half-created session
      // files (only when no valid session exists), so closing the page can't
      // leave a stale socket or orphaned auth material behind.
      this._abortPairingAttempt('USER_CANCELLED', 'QR pairing cancelled.');
      return;
    }
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
    this._cancelReconnect();
    this._cancelCooldownTimer();
    this._cancelWarmup();
    this._cancelStableReset();
    this._clearConnectTimers();
    this._connecting = false;
    this._intentionalDisconnect = true;
    this._autoRestoreAttempts = 0;
    this._reconnectAttempts = 0;
    this._sessionInvalidated = true;
    this._authRejectStreak = 0;
    this._needsManualRelink = false;
    this._manualRelinkReason = null;
    this._closeCircuit();
    this._rateLimitedUntil = 0;
    this._pendingAvatarJid = null;

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

    // Safety gates (circuit breaker / rate-limit pause / warm-up) must stop a
    // send before any bytes reach WhatsApp. Fail closed with a clear reason.
    if (this._circuitOpen()) {
      const err = new Error(`Messages are paused by the safety circuit — resume at ${new Date(this._circuitOpenUntil).toLocaleTimeString()}.`);
      this.logToShieldGateway('WARN', `sendMessage circuit-breaker gate: ${to}`, { to, err: err.message });
      throw err;
    }
    if (Date.now() < this._rateLimitedUntil) {
      const waitMs = this._rateLimitedUntil - Date.now();
      const err = new Error(`Rate-limited by WhatsApp — messages paused for ${Math.ceil(waitMs / 1000)}s.`);
      this.logToShieldGateway('WARN', `sendMessage rate-limit pause: ${to}`, { to, err: err.message, waitMs });
      throw err;
    }
    if (!this.isSessionWarm()) {
      const warmOk = await this._waitForSessionReady();
      if (!warmOk && !this.isSessionWarm()) {
        const err = new Error('Session is still warming up / reconnecting — please retry in a few seconds.');
        this.logToShieldGateway('WARN', `sendMessage warm-up gate: ${to}`, { to, err: err.message });
        throw err;
      }
    }
    if (!this._consumeGlobalOp()) {
      const err = new Error('Global outbound rate limit reached — please retry shortly.');
      this.logToShieldGateway('WARN', `sendMessage global op budget: ${to}`, { to, err: err.message });
      throw err;
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
      // A 429/rate-limit rejection pauses the whole send channel (all contacts)
      // so we stop generating any further WhatsApp traffic immediately.
      if (/429|rate\s*limit|too\s*many/i.test(String(err?.message || ''))) {
        this._rateLimitedUntil = Date.now() + WA_RATE_LIMIT_PAUSE_MS;
        console.warn(`[SEND_MESSAGE] Rate-limited by WhatsApp — paused for ${WA_RATE_LIMIT_PAUSE_MS / 1000}s.`);
        this.logToShieldGateway('WARN', 'sendMessage paused by rate limit (429)', { to, jid, backoffMs });
      }
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
    // Cooperative cancellation: the caller can hand us a predicate (e.g. "user
    // pressed Stop") so pacing waits below cede control promptly instead of
    // sleeping out a fixed interval. Throws a marked error so the scan loop can
    // exit cleanly without recording a fake failure.
    const shouldStop = typeof opts.shouldStop === 'function' ? opts.shouldStop : () => false;

    // If the session dropped mid-scan (transient 408/428/etc.), pause lookups
    // until the automatic reconnect brings it back (auto-resume instead of a
    // hard "session is not active" failure). Give up quietly when the session
    // was invalidated (401/logout), the user stopped the scan, the wait exceeds
    // WA_RECONNECT_MAX_WAIT_MS, or there is no persisted session.
    if (this.status !== 'CONNECTED' || !this.sock) {
      const waitOk = await this._waitForConnection({ shouldStop });
      if (!waitOk) {
        const errorMsg = 'WhatsApp is not connected. Please link your device first.';
        console.error(`[CHECK_NUMBER] ${errorMsg} (Status: ${this.status})`);
        this.logToShieldGateway('ERROR', `checkNumber failed: ${errorMsg}`, { phoneNumber, status: this.status });
        throw new Error(errorMsg);
      }
    }

    // Safety gates: a circuit-breaker pause or rate-limit pause stops ALL
    // lookups immediately (never hammer a flagged/throttled account), and a
    // freshly-connected session waits out its warm-up window before traffic
    // starts (no burst against a socket that just opened).
    if (this._circuitOpen()) {
      const err = new Error(`WhatsApp activity is paused by the safety circuit — resumes at ${new Date(this._circuitOpenUntil).toLocaleTimeString()}.`);
      this.logToShieldGateway('WARN', `checkNumber circuit-breaker gate: ${phoneNumber}`, { phoneNumber, err: err.message });
      throw err;
    }
    if (Date.now() < this._rateLimitedUntil) {
      const waitMs = this._rateLimitedUntil - Date.now();
      const err = new Error(`Rate-limited by WhatsApp — lookups paused for ${Math.ceil(waitMs / 1000)}s.`);
      this.logToShieldGateway('WARN', `checkNumber rate-limit pause: ${phoneNumber}`, { phoneNumber, err: err.message, waitMs });
      throw err;
    }
    if (!this.isSessionWarm()) {
      const warmOk = await this._waitForSessionReady({ shouldStop });
      if (!warmOk && !this.isSessionWarm()) {
        const errorMsg = 'WhatsApp session is still warming up / reconnecting — please retry in a few seconds.';
        console.error(`[CHECK_NUMBER] ${errorMsg} (Status: ${this.status})`);
        this.logToShieldGateway('ERROR', `checkNumber failed: ${errorMsg}`, { phoneNumber, status: this.status });
        throw new Error(errorMsg);
      }
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
        // Global outbound op budget (shared with sends + profile fetches). When
        // the pool is exhausted, wait for a slot like the per-minute backstop so
        // a scan throttles instead of failing.
        if (!this._consumeGlobalOp()) {
          const waitMs = this._globalOpWaitMs();
          this.logToShieldGateway('WARN', `checkNumber global op budget reached — throttling ${Math.ceil(waitMs / 1000)}s`, { phoneNumber, waitMs });
          await interruptibleWait(waitMs);
          if (!this._consumeGlobalOp()) {
            const e = new Error('Global outbound rate limit reached — please retry shortly.');
            e.code = 'RATE_LIMITED';
            throw e;
          }
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
          if (isSessionFailure) {
            this._recordCircuitError(2);
            throw lookupErr;
          }
          // A 429/rate-limit rejection pauses ALL lookups for an account-level
          // window so WhatsApp stops receiving any further validation traffic.
          if (/429|rate\s*limit|too\s*many/i.test(msg)) {
            this._rateLimitedUntil = Date.now() + WA_RATE_LIMIT_PAUSE_MS;
            console.warn(`[CHECK_NUMBER] Rate-limited by WhatsApp — pausing lookups for ${WA_RATE_LIMIT_PAUSE_MS / 1000}s.`);
            this.logToShieldGateway('WARN', 'checkNumber paused by rate limit (429)', { phoneNumber });
            this._recordCircuitError(1);
            throw lookupErr;
          }
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
      sendInFlight: this._sendInFlight,
      reconnectPaused: this._reconnectPaused,
      reconnectPausedUntil: this._reconnectPaused ? (this._reconnectPausedUntil || 0) : 0,
      reconnectAttempts: this._reconnectAttempts || 0,
      needsManualRelink: this._needsManualRelink,
      manualRelinkReason: this._manualRelinkReason || null,
      circuitOpen: this._circuitOpen(),
      circuitOpenUntil: this._circuitOpen() ? (this._circuitOpenUntil || 0) : 0,
      circuitErrors: this._circuitErrors || [],
      sessionWarm: this.isSessionWarm(),
      rateLimitedUntil: this._rateLimitedUntil || 0,
      rateLimitPauseActive: now < (this._rateLimitedUntil || 0),
      globalOpsLastMinute: this._globalOpTimes.filter(t => now - t < 60000).length,
      lastDisconnectReason: this._lastDisconnectReason || null
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
    this._globalOpTimes = [];
    this._consecutiveSendFailures = 0;
    this._sendBackoffUntil = 0;
    this._sendInFlight = false;
    this._sendHistory.clear();
    this._sendCooldown.clear();
  }
}

const whatsAppService = new WhatsAppService();
module.exports = whatsAppService;
