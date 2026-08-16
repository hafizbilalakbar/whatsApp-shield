const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, jidNormalizedUser, isJidGroup, getBinaryNodeChild } = require('@whiskeysockets/baileys');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.state = null;
    this.saveCreds = null;
    this.status = 'DISCONNECTED';
    this.qrCodeDataUrl = null;
    this.userInfo = null;
    this.onStatusChangeCallback = null;
    this.onMessageCallback = null;
    this.onMessageStatusCallback = null;
    this.sessionDir = path.join(__dirname, 'session_auth_info');
    this._connecting = false;
    this._intentionalDisconnect = false;
    this._connectTimeout = null;
    this._sendHistory = new Map(); // jid -> [{text, ts}]
    this._sendCooldown = new Map(); // jid -> last send ts
    this._lastCheckAt = 0;
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
    // Don't auto-connect — wait for the user to explicitly initiate a QR scan.
    this.updateStatus('DISCONNECTED');
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

  get backupDir() {
    return this.sessionDir + '_backup';
  }

  async generateQRCode() {
    // Always start from a clean state. Remove any previously persisted session
    // credentials so that every user-initiated connection produces a fresh QR code.
    this._intentionalDisconnect = true;
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

    // Safety timeout: reset _connecting flag if Baileys never fires connection.update
    if (this._connectTimeout) clearTimeout(this._connectTimeout);
    this._connectTimeout = setTimeout(() => {
      if (this._connecting) {
        console.warn('[CONNECT] Connection timeout — resetting _connecting flag after 45s');
        this._connecting = false;
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
          this._intentionalDisconnect = false;
          this._connecting = false;

          console.log(`Connection closed. Status code: ${statusCode}. Intentional: ${wasIntentional}.`);

          if (this.sock) {
            try {
              this.sock.ev.removeAllListeners();
              await this.sock.end().catch(() => {});
            } catch (e) {}
          }
          this.sock = null;

          // No automatic reconnection. The user must explicitly re-initiate a QR scan.
          if (wasIntentional) {
            console.log('Intentional disconnect — not reconnecting.');
          } else {
            console.log('Connection closed. Waiting for user to generate a fresh QR code.');
          }
          this.updateStatus('DISCONNECTED');
        } else if (connection === 'open') {
          if (this._connectTimeout) {
            clearTimeout(this._connectTimeout);
            this._connectTimeout = null;
          }
          console.log('WhatsApp connection successfully opened!');

          const me = this.sock.user;
          this.userInfo = {
            id: me.id,
            name: me.name || 'WhatsApp Session',
            number: me.id.split(':')[0]
          };

          try {
            this.userInfo.avatar = await this.sock.profilePictureUrl(me.id, 'image');
          } catch (e) {
            this.userInfo.avatar = null;
          }

          try {
            await this.saveCreds();
          } catch (e) {
            console.error('[CONNECT] Force saveCreds after open failed:', e);
          }

          this._connecting = false;
          this.updateStatus('CONNECTED');
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
    console.log('[CANCEL_QR] Cancelling active QR generation / session');
    this._intentionalDisconnect = true;
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

    console.log('[LOGOUT] Session invalidated and authentication material removed.');
    this.updateStatus('DISCONNECTED');
  }

  async sendMessage(to, text) {
    if (this.status !== 'CONNECTED' || !this.sock) {
      const errorMsg = 'WhatsApp is not connected.';
      console.error(`[SEND_MESSAGE] ${errorMsg} (Status: ${this.status})`);
      this.logToShieldGateway('ERROR', `sendMessage failed: ${errorMsg}`, { to, text, status: this.status });
      throw new Error(errorMsg);
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
      maxPerDay: Number(process.env.WA_SEND_MAX_PER_DAY) || 400
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

    const lastText = recent.length > 0 ? recent[recent.length - 1] : null;
    if (lastText && lastText.text === text && now - lastText.ts < config.dedupWindowMs) {
      const err = new Error('Duplicate message blocked (identical message sent recently).');
      this.logToShieldGateway('WARN', `sendMessage dedup blocked: ${jid}`, { err: err.message, text });
      throw err;
    }

    this.logToShieldGateway('INFO', `sendMessage: Sending to ${to} -> jid:${jid}`, { to, cleanNumber, jid });

    try {
      const result = await this.sock.sendMessage(jid, { text });
      this.logToShieldGateway('INFO', `sendMessage: Success to ${jid}`, { result });

      // Record successful send for rate/cap accounting
      const entry = { text, ts: now };
      const hist = this._sendHistory.get(jid) || [];
      hist.push(entry);
      // Keep a bounded rolling window (~2 days worth)
      const pruned = hist.filter(h => now - h.ts < 2 * 86400000);
      this._sendHistory.set(jid, pruned);
      this._sendCooldown.set(jid, now);

      return {
        id: result.key.id,
        jid: result.key.remoteJid,
        timestamp: new Date().toISOString(),
        status: 'sent'
      };
    } catch (err) {
      console.error('Failed to send WhatsApp message:', err.message);
      this.logToShieldGateway('ERROR', `sendMessage: Failed to ${jid}: ${err.message}`, { to, jid, err: err.message });
      throw err;
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
      const [res] = await this.sock.onWhatsApp(jid);
      
      this.logToShieldGateway('INFO', `checkNumber: API response for ${phoneNumber}`, { result: res });
      
      if (res && res.exists) {
        result.exists = true;
        result.whatsappId = res.jid;

        try {
          const avatarUrl = await this.sock.profilePictureUrl(res.jid, 'image');
          result.avatar = avatarUrl || null;
          result.profilePhotoAvailable = !!result.avatar;
          this.logToShieldGateway('INFO', `checkNumber: Retrieved avatar for ${phoneNumber}`, { avatar: result.avatar });
        } catch (avatarErr) {
          result.avatar = null;
          result.profilePhotoAvailable = false;
          this.logToShieldGateway('WARN', `checkNumber: Avatar fetch failed for ${phoneNumber}: ${avatarErr.message}`, { avatarErr });
        }

        try {
          const biz = await this.fetchBusinessProfile(res.jid);
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
}

const whatsAppService = new WhatsAppService();
module.exports = whatsAppService;
