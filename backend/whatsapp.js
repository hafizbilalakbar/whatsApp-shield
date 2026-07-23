const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser, isJidGroup } = require('@whiskeysockets/baileys');
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
    this.reconnectTimer = null;
    this.sessionDir = path.join(__dirname, 'session_auth_info');
    this.sessionHistoryFile = path.join(__dirname, 'session_history.json');
    this.previouslyConnected = [];
    this._restoreAttempt = false;
    this._restoreJustFailed = false;
    this._restorePhone = '';
    this._connecting = false;
    this._intentionalDisconnect = false;
    this._connectTimeout = null;
    this.loadSessionHistory();
  }

  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  onMessageStatus(callback) {
    this.onMessageStatusCallback = callback;
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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

  scheduleReconnect(delayMs = 3000) {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  loadSessionHistory() {
    try {
      if (fs.existsSync(this.sessionHistoryFile)) {
        const raw = fs.readFileSync(this.sessionHistoryFile, 'utf8');
        const parsed = JSON.parse(raw);
        this.previouslyConnected = Array.isArray(parsed) ? parsed : [parsed];
        console.log(`Session history loaded. Total profiles cached: ${this.previouslyConnected.length}`);
      } else {
        this.previouslyConnected = [];
      }
    } catch (e) {
      console.warn('Failed to load session history:', e.message);
      this.previouslyConnected = [];
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
    // Don't auto-connect — wait for user to click "Generate QR Code"
    // or for the frontend to send restore_session over WebSocket.
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
        previouslyConnected: this.previouslyConnected,
        ...additionalData
      });
    }
  }

  get backupDir() {
    return this.sessionDir + '_backup';
  }

  async generateQRCode() {
    // Backup existing session before clearing — never destroy a valid restorable session
    const backupDir = this.backupDir;
    if (fs.existsSync(this.sessionDir)) {
      if (fs.existsSync(backupDir)) {
        console.log('[QR] Removing stale backup before creating new backup.');
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
      console.log('[QR] Backing up existing session to:', backupDir);
      fs.renameSync(this.sessionDir, backupDir);
    }

    this._restoreAttempt = false;
    this._restoreJustFailed = false;
    this._restorePhone = '';
    this._connecting = false;
    // Cleanup internal state (socket, timers) without deleting session — it was renamed above
    this._cleanupInternalState();
    await this.connect();
  }

  isConnecting() {
    return this.status === 'CONNECTING' || this._connecting;
  }

  _cleanStaleSessionFiles() {
    try {
      if (!fs.existsSync(this.sessionDir)) return;
      const files = fs.readdirSync(this.sessionDir);
      const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));
      if (sessionFiles.length <= 1) return;

      // Determine current identity from creds.json or this.userInfo
      let currentNumber = this.userInfo?.number || '';
      if (!currentNumber) {
        const credsPath = path.join(this.sessionDir, 'creds.json');
        if (fs.existsSync(credsPath)) {
          try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            currentNumber = creds.me?.id?.split(':')[0] || '';
          } catch (e) {}
        }
      }

      if (!currentNumber) {
        console.log('[CLEANUP] Cannot determine current identity, skipping stale file cleanup.');
        return;
      }

      console.log(`[CLEANUP] Found ${sessionFiles.length} session files, current number: ${currentNumber}`);
      sessionFiles.forEach(file => {
        try {
          const content = fs.readFileSync(path.join(this.sessionDir, file), 'utf8');
          const parsed = JSON.parse(content);
          if (parsed && parsed.id) {
            const fileNumber = parsed.id.split(':')[0];
            if (fileNumber && currentNumber !== fileNumber) {
              console.log(`[CLEANUP] Removing stale session file: ${file} (number: ${fileNumber}, current: ${currentNumber})`);
              fs.unlinkSync(path.join(this.sessionDir, file));
            }
          }
        } catch (e) {
          console.warn(`[CLEANUP] Could not parse session file ${file}, removing: ${e.message}`);
          try { fs.unlinkSync(path.join(this.sessionDir, file)); } catch (er) {}
        }
      });
    } catch (err) {
      console.error('[CLEANUP] Error cleaning stale session files:', err.message);
    }
  }

  async restoreSession(phone) {
    if (this.status === 'CONNECTED' && this.sock) {
      console.log('Restore skipped: already connected.');
      return;
    }
    if (this.status === 'CONNECTING' && this._connecting) {
      console.log('Restore skipped: already connecting.');
      return;
    }

    const credsPath = path.join(this.sessionDir, 'creds.json');
    const backupDir = this.backupDir;
    const hasPrimaryCreds = fs.existsSync(credsPath);
    const hasBackupCreds = !hasPrimaryCreds && fs.existsSync(path.join(backupDir, 'creds.json'));

    // If primary was backed up during a QR generation that never completed, restore from backup
    if (hasBackupCreds) {
      console.log('[RESTORE] Primary session missing. Restoring from backup.');
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
      }
      fs.renameSync(backupDir, this.sessionDir);
    }

    const hasCreds = fs.existsSync(credsPath);
    console.log(`[RESTORE] Attempting restore for phone=${phone}. creds.json exists: ${hasCreds}`);

    if (!hasCreds) {
      console.log('[RESTORE] No saved credentials found. Generating fresh QR code.');
      await this.generateQRCode();
      return;
    }

    // Guard: force reset _connecting in case it was left stuck by a previous failed connect
    this._connecting = false;
    this._restoreAttempt = true;
    this._restoreJustFailed = false;
    this._restorePhone = phone || '';
    await this.connect();
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
    this._restoreJustFailed = false;
    this._intentionalDisconnect = false;
    this.clearReconnectTimer();

    // Safety timeout: reset _connecting flag if Baileys never fires connection.update
    if (this._connectTimeout) clearTimeout(this._connectTimeout);
    this._connectTimeout = setTimeout(() => {
      if (this._connecting) {
        console.warn('[CONNECT] Connection timeout — resetting _connecting flag after 45s');
        this._connecting = false;
        this.updateStatus('DISCONNECTED', { error: 'Connection timed out' });
      }
    }, 45000);

    // Remove stale session files that may interfere with restore
    this._cleanStaleSessionFiles();

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
      console.log(`[CONNECT] Auth state loaded. _restoreAttempt=${this._restoreAttempt}`);

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
        browser: ['Antigravity Shield', 'Chrome', '125.0.0.0'],
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
          const isRestore = this._restoreAttempt;
          if (isRestore) {
            this._restoreAttempt = false;
            this._restoreJustFailed = true;
            console.log('QR received during restore attempt — restore failed, falling back to QR');
          }
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
            this.updateStatus('QR_CODE', isRestore ? { restoreFailed: true } : {});
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
          const wasRestore = this._restoreJustFailed;
          const wasAttemptingRestore = this._restoreAttempt && !wasRestore;
          const wasIntentional = this._intentionalDisconnect;
          this._restoreJustFailed = false;
          this._restoreAttempt = false;
          this._intentionalDisconnect = false;
          this._connecting = false;
          const shouldReconnect = !wasIntentional && statusCode !== DisconnectReason.loggedOut && !wasRestore;
          
          console.log(`Connection closed. Status code: ${statusCode}. Intentional: ${wasIntentional}. Reconnecting: ${shouldReconnect}`);
          
          if (this.sock) {
            try {
              this.sock.ev.removeAllListeners();
              await this.sock.end().catch(() => {});
            } catch (e) {}
          }
          this.sock = null;

          if (wasIntentional) {
            console.log('Intentional disconnect — not reconnecting. Session files preserved.');
            this.updateStatus('DISCONNECTED');
          } else if (wasRestore) {
            console.log('Restore failed — session may be expired. QR code ready for fresh scan.');
          } else if (wasAttemptingRestore && statusCode === DisconnectReason.loggedOut) {
            // Stale credentials caused 401 without QR event — clean up and show QR
            console.log('Logged out with stale session — cleaning up and generating fresh QR.');
            this.cleanupSession('staleSession');
            this.qrCodeDataUrl = null;
            this.userInfo = null;
            this.updateStatus('DISCONNECTED', { staleSession: true });
            // Auto-generate QR after cleanup so user can pair fresh
            this._intentionalDisconnect = false;
            this.connect();
          } else if (shouldReconnect) {
            const credsExist = fs.existsSync(path.join(this.sessionDir, 'creds.json'));
            if (credsExist) {
              console.log('Session exists. Scheduling reconnect...');
              this.updateStatus('DISCONNECTED');
              this.scheduleReconnect(3000);
            } else {
              console.log('No saved session. Waiting for user to generate QR.');
              this.updateStatus('DISCONNECTED');
            }
          } else {
            console.log(`Connection closed (status: ${statusCode}). Waiting for user action.`);
            this.updateStatus('DISCONNECTED');
          }
        } else if (connection === 'open') {
          if (this._connectTimeout) {
            clearTimeout(this._connectTimeout);
            this._connectTimeout = null;
          }
          console.log('WhatsApp connection successfully opened!');
          
          // New session established — clean up old backup (it's no longer restorable)
          const backupDir = this.backupDir;
          if (fs.existsSync(backupDir)) {
            console.log('[CONNECT] New session confirmed, removing old backup:', backupDir);
            fs.rmSync(backupDir, { recursive: true, force: true });
          }

          const me = this.sock.user;
          this.userInfo = {
            id: me.id,
            name: me.name || 'WhatsApp Session',
            number: me.id.split(':')[0]
          };

          // Clean up stale session files that don't match current identity
          this._cleanStaleSessionFiles();

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
          const postOpenFiles = fs.readdirSync(this.sessionDir);
          console.log(`[CONNECT] Session dir files AFTER open: ${postOpenFiles.join(', ')}`);

          try {
            this.previouslyConnected = this.previouslyConnected || [];
            this.previouslyConnected = this.previouslyConnected.filter(p => p.number !== this.userInfo.number);
            this.previouslyConnected.unshift({
              ...this.userInfo,
              timestamp: new Date().toISOString()
            });
            this.previouslyConnected = this.previouslyConnected.slice(0, 5);
            fs.writeFileSync(this.sessionHistoryFile, JSON.stringify(this.previouslyConnected, null, 2));
          } catch (historyErr) {
            console.error('Failed to save session history:', historyErr);
          }

          const isRestore = this._restoreAttempt;
          this._restoreAttempt = false;
          this._restoreJustFailed = false;
          this._connecting = false;
          this.updateStatus('CONNECTED', isRestore ? { restoreSucceeded: true } : {});
        }
      });

    } catch (err) {
      if (this._connectTimeout) {
        clearTimeout(this._connectTimeout);
        this._connectTimeout = null;
      }
      console.error('Error during WhatsApp connection initialization:', err);
      this._restoreAttempt = false;
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
    this.clearReconnectTimer();
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

  // Remove a session reference from the history list only.
  // NEVER deletes session_auth_info files — those are preserved for future restore.
  removeSession(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    const wasConnected = this.userInfo?.number === cleanPhone;

    this.previouslyConnected = this.previouslyConnected.filter(p => {
      const pNum = (p.number || '').replace(/\D/g, '');
      return pNum !== cleanPhone;
    });
    try {
      fs.writeFileSync(this.sessionHistoryFile, JSON.stringify(this.previouslyConnected, null, 2));
    } catch (err) {
      console.error('Failed to save session history after removal:', err);
    }

    if (this._connectTimeout) {
      clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }
    if (this._presenceInterval) {
      clearInterval(this._presenceInterval);
      this._presenceInterval = null;
    }
    // Disconnect the socket if it's the same phone
    if (wasConnected && this.sock) {
      try {
        this._intentionalDisconnect = true;
        this.sock.ev.removeAllListeners();
        this.sock.end().catch(() => {});
      } catch (e) {}
      this.sock = null;
    }

    this.clearReconnectTimer();
    this._restoreAttempt = false;
    this._restoreJustFailed = false;
    this._connecting = false;
    if (wasConnected) {
      this.userInfo = null;
      this.updateStatus('DISCONNECTED', { cleaned: true });
    }

    console.log(`[REMOVE_SESSION] Removed session ref for ${phone}. session_auth_info preserved.`);
    return { previouslyConnected: this.previouslyConnected, disconnected: wasConnected };
  }

  cancelQR() {
    console.log('[CANCEL_QR] Cancelling active QR generation / session');
    this._intentionalDisconnect = true;
    this._cleanupInternalState();
    this._restoreAttempt = false;
    this._restoreJustFailed = false;
    this._connecting = false;
    this.qrCodeDataUrl = null;
    this.userInfo = null;
    this.updateStatus('DISCONNECTED');
  }

  // Full session cleanup — destroys session_auth_info and backup.
  // Use only for explicit "start fresh" actions (stale session, forced reset).
  cleanupAuthSession(reason = 'unknown') {
    console.log(`[CLEANUP_AUTH] Full auth session cleanup triggered by: ${reason}`);
    this._cleanupInternalState();
    this._restoreAttempt = false;
    this._restoreJustFailed = false;
    this._connecting = false;
    this.userInfo = null;
    this.cleanupSession(reason);
  }

  async logout() {
    this.clearReconnectTimer();
    if (this._connectTimeout) {
      clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }
    if (this._presenceInterval) {
      clearInterval(this._presenceInterval);
      this._presenceInterval = null;
    }
    this._restoreAttempt = false;
    this._restoreJustFailed = false;
    this._connecting = false;
    this._intentionalDisconnect = true;

    if (this.sock) {
      try {
        // DO NOT remove creds.update listener before end() — Baileys needs it to flush final state
        await this.sock.end();
      } catch (err) {
        console.error('Error during WhatsApp logout:', err);
      }
      // Remove listeners only AFTER end() so final creds are saved
      try {
        this.sock.ev.removeAllListeners();
      } catch (e) {}
      this.sock = null;
    }

    // Force-save creds one last time to disk to ensure they're not corrupted
    if (this.saveCreds) {
      try {
        await this.saveCreds();
      } catch (e) {
        console.error('[LOGOUT] Force saveCreds after end failed:', e);
      }
    }

    console.log('[LOGOUT] Disconnected. Session files preserved for future restore.');
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

    this.logToShieldGateway('INFO', `sendMessage: Sending to ${to} -> jid:${jid}`, { to, text, cleanNumber, jid });

    try {
      const result = await this.sock.sendMessage(jid, { text });
      this.logToShieldGateway('INFO', `sendMessage: Success to ${jid}`, { result });
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

  async checkNumber(phoneNumber) {
    if (this.status !== 'CONNECTED' || !this.sock) {
      const errorMsg = 'WhatsApp is not connected. Please link your device first.';
      console.error(`[CHECK_NUMBER] ${errorMsg} (Status: ${this.status})`);
      this.logToShieldGateway('ERROR', `checkNumber failed: ${errorMsg}`, { phoneNumber, status: this.status });
      throw new Error(errorMsg);
    }

    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const jid = `${cleanNumber}@s.whatsapp.net`;

    const result = {
      number: phoneNumber,
      cleanNumber: cleanNumber,
      exists: false,
      avatar: null,
      statusText: null,
      error: null
    };

    this.logToShieldGateway('INFO', `checkNumber: Checking number ${phoneNumber} (${cleanNumber})`, { phoneNumber, cleanNumber, jid });

    try {
      const [res] = await this.sock.onWhatsApp(jid);
      
      this.logToShieldGateway('INFO', `checkNumber: API response for ${phoneNumber}`, { result: res });
      
      if (res && res.exists) {
        result.exists = true;
        result.whatsappId = res.jid;

        try {
          result.avatar = await this.sock.profilePictureUrl(res.jid, 'image');
          this.logToShieldGateway('INFO', `checkNumber: Retrieved avatar for ${phoneNumber}`, { avatar: result.avatar });
        } catch (avatarErr) {
          result.avatar = null;
          this.logToShieldGateway('WARN', `checkNumber: Avatar fetch failed for ${phoneNumber}: ${avatarErr.message}`, { avatarErr });
        }

        try {
          const statusRes = await this.sock.fetchStatus(res.jid);
          if (statusRes && statusRes.status) {
            result.statusText = statusRes.status;
            this.logToShieldGateway('INFO', `checkNumber: Retrieved status for ${phoneNumber}: ${statusRes.status}`, { status: statusRes.status });
          }
        } catch (statusErr) {
          result.statusText = null;
          this.logToShieldGateway('WARN', `checkNumber: Status fetch failed for ${phoneNumber}: ${statusErr.message}`, { statusErr });
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
