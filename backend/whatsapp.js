const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, jidNormalizedUser, isJidGroup, getBinaryNodeChild, DisconnectReason } = require('@whiskeysockets/baileys');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Guards against stalled Baileys socket queries (half-open connection, degraded
// network, etc.) so a single hung lookup can never freeze the whole bulk-check
// loop forever. On timeout the promise rejects and the loop's catch path
// produces an error result for that number and moves on.
const CHECK_TIMEOUT_MS = Number(process.env.WA_CHECK_TIMEOUT_MS) || 15000;

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
    this.onMessageCallback = null;
    this.onMessageStatusCallback = null;
    this.sessionDir = path.join(__dirname, 'session_auth_info');
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
  }

  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  onMessageStatus(callback) {
    this.onMessageStatusCallback = callback;
  }

  logToShieldGateway(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };
    console.log(`[SHIELD_GATEWAY] ${level}: ${message}`);
    try {
      const logFile = path.join(this.sessionDir, 'shield-gateway.log');
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to write to shield-gateway.log:', err);
    }
  }

  init(onStatusChange) {
    this.onStatusChangeCallback = onStatusChange;
    const credsPath = path.join(this.sessionDir, 'creds.json');
    const hasSession = fs.existsSync(credsPath);
    console.log(`[INIT] Session directory: ${this.sessionDir}`);
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
      const url = await this.sock.profilePictureUrl(jid, 'image', 8000);
      if (!url) return null;
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

  get backupDir() {
    return this.sessionDir + '_backup';
  }

  async generateQRCode() {
    // Always start from a clean state. Remove any previously persisted session
    // credentials so that every user-initiated connection produces a fresh QR code.
    this._intentionalDisconnect = true;
    this._pendingPairing = false;
    this._autoRestoreAttempts = 0;
    this._cleanupInternalState();
    this._connecting = false;
    try {
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
      }
      const backupDir = this.backupDir;
      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn('[QR] Failed to clear previous session directory:', err.message);
    }
    await this.connect();
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

      if (!fs.existsSync(this.sessionDir)) {
        fs.mkdirSync(this.sessionDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
      this.state = state;
      this.saveCreds = async () => {
        try {
          await saveCreds();
          const files = fs.readdirSync(this.sessionDir);
          console.log(`[SAVE_CREDS] Credentials saved. Files in session dir: ${files.join(', ')}`);
        } catch (err) {
          console.error('[SAVE_CREDS] FAILED to save credentials:', err);
        }
      };

      const preFiles = fs.existsSync(this.sessionDir) ? fs.readdirSync(this.sessionDir) : [];
      console.log(`[CONNECT] Session dir files BEFORE connect: ${preFiles.length > 0 ? preFiles.join(', ') : '(empty)'}`);

      let version = [2, 3000, 1017531287];
      try {
        const { version: latestVersion, isLatest } = await fetchLatestBaileysVersion();
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
        // fingerprinting triggers. Defaults to a standard Chrome profile.
        browser: (() => {
          const raw = process.env.WA_BROWSER_META;
          if (raw) {
            const parts = raw.split(',').map(s => s.trim());
            if (parts.length === 3) return parts;
          }
          return ['Chrome', 'Chrome', '125.0.0.0'];
        })(),
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 25000
      });

      this.sock.ev.on('creds.update', this.saveCreds);

      this.sock.ev.on('messages.upsert', async (messageUpdate) => {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (msg.key.fromMe) continue;
          if (!msg.message) continue;

          const fromJid = msg.key.remoteJid;
          if (isJidGroup(fromJid)) continue;

          const phone = fromJid.split('@')[0];
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
      });

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

      // Periodic presence keep-alive to prevent WhatsApp idle disconnection
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
              && fs.existsSync(path.join(this.sessionDir, 'creds.json'))) {
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
  }

  cleanupSession(reason = 'unknown') {
    try {
      const stack = new Error().stack.split('\n').slice(1, 4).join(' <- ');
      console.log(`[CLEANUP] Session cleanup triggered by: ${reason}`);
      console.log(`[CLEANUP] Call stack: ${stack}`);
      if (fs.existsSync(this.sessionDir)) {
        const files = fs.readdirSync(this.sessionDir);
        console.log(`[CLEANUP] Session files exist: ${files.length} files — deleting.`);
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
        console.log('[CLEANUP] Session authentication directory cleaned up.');
      } else {
        console.log('[CLEANUP] No session directory to clean.');
      }
      // Also clean up any stale backup directory
      const backupDir = this.backupDir;
      if (fs.existsSync(backupDir)) {
        console.log(`[CLEANUP] Removing backup directory: ${backupDir}`);
        fs.rmSync(backupDir, { recursive: true, force: true });
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

  // Full session cleanup — destroys session_auth_info and backup.
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
    this.cleanupSession('logout');
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
    const verifiedName = getBinaryNodeChild(profiles, 'verified_name');
    const vname = verifiedName?.content?.toString() || verifiedName?.attrs?.vname || verifiedName?.attrs?.name || null;
    return {
      wid: profiles.attrs?.jid,
      verifiedName: vname && vname.trim().length > 0 ? vname.trim() : null,
      hasData: !!(vname || address || description || website?.content || email || category)
    };
  }

  async checkNumber(phoneNumber) {
    if (this.status !== 'CONNECTED' || !this.sock) {
      const errorMsg = 'WhatsApp is not connected. Please link your device first.';
      console.error(`[CHECK_NUMBER] ${errorMsg} (Status: ${this.status})`);
      this.logToShieldGateway('ERROR', `checkNumber failed: ${errorMsg}`, { phoneNumber, status: this.status });
      throw new Error(errorMsg);
    }

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
      await new Promise(resolve => setTimeout(resolve, waitMs));
      this._globalLookupTimes = this._globalLookupTimes.filter(t => Date.now() - t < 60000);
    }

    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const jid = `${cleanNumber}@s.whatsapp.net`;

    // Safety: enforce a minimum spacing between checkNumber calls to avoid
    // rapid-fire lookups that look automated. Client loops add their own delay
    // on top of this floor.
    const MIN_CHECK_INTERVAL_MS = Number(process.env.WA_CHECK_MIN_INTERVAL_MS) || 600;
    const nowMs = Date.now();
    if (this._lastCheckAt && nowMs - this._lastCheckAt < MIN_CHECK_INTERVAL_MS) {
      const waitMs = MIN_CHECK_INTERVAL_MS - (nowMs - this._lastCheckAt);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    this._lastCheckAt = Date.now();

    let isValidFormat = true;
    let formatted = `+${cleanNumber}`;
    let detectedCountry = null;
    try {
      const parsed = parsePhoneNumberFromString(`+${cleanNumber}`);
      if (parsed && parsed.isValid()) {
        formatted = parsed.format('E.164');
        detectedCountry = parsed.country || null;
      } else if (cleanNumber.length < 8) {
        isValidFormat = false;
      }
    } catch (e) {
      if (cleanNumber.length < 8) isValidFormat = false;
    }

    const result = {
      number: phoneNumber,
      cleanNumber: cleanNumber,
      formatted: formatted,
      detectedCountry: detectedCountry,
      isValidFormat: isValidFormat,
      exists: false,
      avatar: null,
      profilePhotoAvailable: false,
      isBusiness: false,
      isVerified: false,
      displayName: null,
      verifiedName: null,
      error: null
    };

    this.logToShieldGateway('INFO', `checkNumber: Checking number ${phoneNumber} (${cleanNumber})`, { phoneNumber, cleanNumber, jid, formatted, detectedCountry, isValidFormat });

    try {
      this._globalLookupTimes.push(nowLookup);
      const [res] = await withTimeout(this.sock.onWhatsApp(jid), CHECK_TIMEOUT_MS, 'checkNumber.onWhatsApp');
      
      this.logToShieldGateway('INFO', `checkNumber: API response for ${phoneNumber}`, { result: res });
      
      if (res && res.exists) {
        result.exists = true;
        result.whatsappId = res.jid;

        try {
          const avatarUrl = await withTimeout(this.sock.profilePictureUrl(res.jid, 'image'), CHECK_TIMEOUT_MS, 'checkNumber.profilePictureUrl');
          result.avatar = avatarUrl || null;
          result.profilePhotoAvailable = !!result.avatar;
          this.logToShieldGateway('INFO', `checkNumber: Retrieved avatar for ${phoneNumber}`, { avatar: result.avatar });
        } catch (avatarErr) {
          result.avatar = null;
          result.profilePhotoAvailable = false;
          this.logToShieldGateway('WARN', `checkNumber: Avatar fetch failed for ${phoneNumber}: ${avatarErr.message}`, { avatarErr });
        }

        try {
          const biz = await withTimeout(this.fetchBusinessProfile(res.jid), CHECK_TIMEOUT_MS, 'checkNumber.fetchBusinessProfile');
          if (biz && biz.hasData) {
            result.isBusiness = true;
            result.verifiedName = biz.verifiedName || null;
            result.displayName = biz.verifiedName || null;
            result.isVerified = !!biz.verifiedName;
            this.logToShieldGateway('INFO', `checkNumber: Retrieved business profile for ${phoneNumber}`, { biz });
          }
        } catch (bizErr) {
          this.logToShieldGateway('WARN', `checkNumber: Business profile fetch failed for ${phoneNumber}: ${bizErr.message}`, { bizErr });
        }
      } else {
        this.logToShieldGateway('INFO', `checkNumber: Number ${phoneNumber} not found on WhatsApp`, { exists: false });
      }
    } catch (err) {
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
