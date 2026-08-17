const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const { parsePhoneNumber } = require('libphonenumber-js');
const whatsAppService = require('./whatsapp');
const HealthMonitor = require('./services/health-monitor');
const ConversationIntelligence = require('./services/conversation-intelligence');
const TemplateManager = require('./services/template-manager');
const { RateLimiter, SingleFlight, sanitizeNumbers, clampDelay } = require('./services/safety-guard');

// Phone number normalization - ensures numbers are in proper E.164 format for WhatsApp JID
function normalizePhone(phone, defaultCountry) {
  if (!phone) return '';
  try {
    const parsed = parsePhoneNumber(phone, defaultCountry || null);
    if (parsed && parsed.isValid()) {
      const national = parsed.nationalNumber;
      const code = parsed.countryCallingCode;
      return code + national;
    }
  } catch (e) {}
  let cleaned = phone.replace(/\D/g, '');
  while (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  return cleaned;
}

function formatE164(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return '';
  return '+' + digits;
}

// Polyfill fetch for Node.js < 18
if (!globalThis.fetch) {
  globalThis.fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 5000;

// --- Middleware ---
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// CORS allowlist — blocks foreign-origin browser requests (CSRF/DNS-rebinding protection)
app.use(cors({
  origin(origin, callback) {
    // Allow non-browser clients (curl, same-origin, server-to-server) with no Origin header
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS policy'));
  }
}));
app.use(express.json({ limit: '10mb' }));

// --- Rate Limiters (per-IP) ---
const bulkCheckLimiter = new RateLimiter({ windowMs: 60000, max: 5, name: 'bulk-check' });
const messageLimiter = new RateLimiter({ windowMs: 60000, max: 120, name: 'message-send' });
const aiGenerateLimiter = new RateLimiter({ windowMs: 60000, max: 60, name: 'ai-generate' });
const authActionLimiter = new RateLimiter({ windowMs: 60000, max: 10, name: 'auth-action' });

// Single-flight lock so only one bulk check runs at a time (prevents concurrent
// runs hammering WhatsApp from WS + REST paths simultaneously)
const bulkCheckLock = new SingleFlight('bulk-check');

// --- Data Files ---
const CAMPAIGN_HISTORY_FILE = path.join(__dirname, 'campaign_history.json');
const SAFETY_SETTINGS_FILE = path.join(__dirname, 'safety_settings.json');
const AI_PROVIDERS_FILE = path.join(__dirname, 'ai_providers.json');
const BUSINESS_PROFILE_FILE = path.join(__dirname, 'business_profile.json');
const CONTACTS_FILE = path.join(__dirname, 'contacts.json');

// Profile-picture cache: in-memory + disk, keyed by phone digits. Only serves
// pictures obtained through the app's own authorized WhatsApp session
// (whatsAppService.getProfilePicture) — never arbitrary URLs. Cached bytes keep
// avatars visible when the signed pps URLs expire or the session is offline.
const PROFILE_PIC_CACHE_DIR = path.join(__dirname, 'cache', 'profile-pictures');
const PROFILE_PIC_TTL_MS = 12 * 60 * 60 * 1000; // refresh when connected after 12h
const profilePicCache = new Map(); // phone -> { data, contentType, savedAt }
const profilePicCachePath = (phone) => path.join(PROFILE_PIC_CACHE_DIR, `${phone}.jpg`);
// Per-phone in-flight dedupe: only one WhatsApp lookup per number at a time so a
// page full of avatars can't fan out N duplicate profilePictureUrl requests.
const profilePicInFlight = new Map(); // phone -> Promise
// Bounded in-memory avatar cache: evicts the oldest entry once it grows past a
// cap so long-running sessions don't leak memory while scanning many numbers.
const MAX_PROFILE_PIC_CACHE = 2000;
const setProfilePicCache = (phone, entry) => {
  profilePicCache.set(phone, entry);
  if (profilePicCache.size > MAX_PROFILE_PIC_CACHE) {
    const oldest = profilePicCache.keys().next().value;
    if (oldest !== undefined) profilePicCache.delete(oldest);
  }
};

// --- Profile-Picture Cache Cleanup ---
// Cached avatars are keyed by phone digits only (shared across sessions), so a
// deleted campaign's pictures must only be removed when no remaining campaign or
// contact still references that number. Cleanup is best-effort: failures are
// logged and never block the campaign deletion that triggered it.

const campaignPhoneNumbers = (campaign) => {
  const nums = new Set();
  if (!campaign || !Array.isArray(campaign.results)) return nums;
  for (const r of campaign.results) {
    if (!r) continue;
    for (const field of ['number', 'cleanNumber', 'formatted', 'whatsappId', 'jid']) {
      const raw = r[field];
      if (!raw) continue;
      const digits = String(raw).split('@')[0].replace(/\D/g, '');
      if (digits) { nums.add(digits); break; }
    }
  }
  return nums;
};

const collectReferencedProfilePicNumbers = () => {
  const referenced = new Set();
  for (const c of loadCampaignHistory()) {
    for (const num of campaignPhoneNumbers(c)) referenced.add(num);
  }
  for (const c of loadContacts()) {
    const digits = String(c.phone || c.number || '').split('@')[0].replace(/\D/g, '');
    if (digits) referenced.add(digits);
  }
  return referenced;
};

const deleteProfilePicCacheEntry = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return;
  profilePicCache.delete(digits);
  profilePicInFlight.delete(digits);
  const filePath = profilePicCachePath(digits);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to delete cached profile picture for ${digits}:`, err.message);
    }
  }
};

const sweepOrphanedProfilePicFiles = (referenced) => {
  let entries = [];
  try {
    entries = fs.readdirSync(PROFILE_PIC_CACHE_DIR);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Failed to list profile-picture cache directory:', err.message);
    }
    return;
  }
  for (const file of entries) {
    const match = /^(\d+)\.jpg$/.exec(file);
    if (!match || referenced.has(match[1])) continue;
    try {
      fs.unlinkSync(path.join(PROFILE_PIC_CACHE_DIR, file));
    } catch (err) {
      console.error(`Failed to delete orphaned cached profile picture ${file}:`, err.message);
    }
  }
};

// Best-effort cleanup invoked after campaign deletion. Removes cached avatars
// for the deleted campaigns' numbers when no remaining campaign or contact still
// references them, then sweeps any leftover orphaned cache files. Never throws.
const cleanupProfilePicCacheAfterCampaignDeletion = (deletedCampaigns) => {
  try {
    const referenced = collectReferencedProfilePicNumbers();
    const list = Array.isArray(deletedCampaigns) ? deletedCampaigns : (deletedCampaigns ? [deletedCampaigns] : []);
    for (const campaign of list) {
      for (const num of campaignPhoneNumbers(campaign)) {
        if (!referenced.has(num)) deleteProfilePicCacheEntry(num);
      }
    }
    sweepOrphanedProfilePicFiles(referenced);
  } catch (err) {
    console.error('Profile-picture cache cleanup failed:', err.message);
  }
};

// --- Data Loaders ---
// Campaign history is the largest data file (every campaign holds a full result
// list). Load it into memory once and write back asynchronously with a short
// debounce so hot paths (get_history, /api/campaigns, message sends, bulk-check
// completion) never block the event loop re-reading/re-writing the whole file.
// Mutations are safe because all callers pair loadCampaignHistory() with
// saveCampaignHistory() and the cache is the live array they mutate.
let campaignHistoryCache = null;
let campaignHistoryDirty = false;
let campaignHistorySaveTimer = null;
let campaignHistorySaveChain = Promise.resolve();
const CAMPAIGN_MAX_ENTRIES = 500;
const CAMPAIGN_SAVE_DEBOUNCE_MS = 150;

const loadCampaignHistory = () => {
  if (campaignHistoryCache) return campaignHistoryCache;
  try {
    if (fs.existsSync(CAMPAIGN_HISTORY_FILE)) {
      campaignHistoryCache = JSON.parse(fs.readFileSync(CAMPAIGN_HISTORY_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading campaign history:', err);
  }
  if (!Array.isArray(campaignHistoryCache)) campaignHistoryCache = [];
  return campaignHistoryCache;
};

const persistCampaignHistory = () => {
  if (!campaignHistoryDirty) return;
  campaignHistoryDirty = false;
  const trimmed = campaignHistoryCache.slice(0, CAMPAIGN_MAX_ENTRIES);
  const payload = JSON.stringify(trimmed, null, 2);
  campaignHistorySaveChain = campaignHistorySaveChain
    .then(() => fs.promises.writeFile(CAMPAIGN_HISTORY_FILE, payload, 'utf8'))
    .catch(err => console.error('Error saving campaign history:', err));
};

const saveCampaignHistory = (data) => {
  campaignHistoryCache = Array.isArray(data) ? data : [];
  if (campaignHistoryCache.length > CAMPAIGN_MAX_ENTRIES) {
    campaignHistoryCache = campaignHistoryCache.slice(0, CAMPAIGN_MAX_ENTRIES);
  }
  campaignHistoryDirty = true;
  if (campaignHistorySaveTimer) clearTimeout(campaignHistorySaveTimer);
  campaignHistorySaveTimer = setTimeout(() => {
    campaignHistorySaveTimer = null;
    persistCampaignHistory();
  }, CAMPAIGN_SAVE_DEBOUNCE_MS);
  if (campaignHistorySaveTimer && typeof campaignHistorySaveTimer.unref === 'function') {
    campaignHistorySaveTimer.unref();
  }
  return true;
};

// Flush pending campaign-history writes on graceful shutdown so a debounce
// window can never lose data.
const flushCampaignHistory = () => {
  if (campaignHistorySaveTimer) {
    clearTimeout(campaignHistorySaveTimer);
    campaignHistorySaveTimer = null;
  }
  if (campaignHistoryDirty) {
    campaignHistoryDirty = false;
    try {
      const trimmed = campaignHistoryCache.slice(0, CAMPAIGN_MAX_ENTRIES);
      fs.writeFileSync(CAMPAIGN_HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
    } catch (err) {
      console.error('Error flushing campaign history:', err);
    }
  }
};
process.on('beforeExit', flushCampaignHistory);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    flushCampaignHistory();
    process.exit(0);
  });
}

const loadJsonFile = (filePath, fallback = null) => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`Error loading ${filePath}:`, err);
  }
  return fallback;
};

const saveJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error saving ${filePath}:`, err);
    return false;
  }
};

// --- Safety Settings ---
const loadSafetySettings = () => loadJsonFile(SAFETY_SETTINGS_FILE, null);
const saveSafetySettings = (settings) => saveJsonFile(SAFETY_SETTINGS_FILE, settings);

// --- AI Providers ---
const loadAiProviders = () => loadJsonFile(AI_PROVIDERS_FILE, []);
const saveAiProviders = (providers) => saveJsonFile(AI_PROVIDERS_FILE, providers);

// --- Business Profile ---
const loadBusinessProfile = () => loadJsonFile(BUSINESS_PROFILE_FILE, {});
const saveBusinessProfile = (profile) => saveJsonFile(BUSINESS_PROFILE_FILE, profile);

// --- Contacts ---
const loadContacts = () => loadJsonFile(CONTACTS_FILE, []);
const saveContacts = (contacts) => saveJsonFile(CONTACTS_FILE, contacts);

// --- Session Ownership (Message Agent isolation) ---
// The backend hosts one authenticated WhatsApp session at a time, but campaigns
// and contacts persist on disk across sessions. Every record created while a
// session is connected is tagged with that session's owner number, and all
// Message Agent reads are scoped to the currently connected session so one
// user's conversations/contacts can never surface for another user.
const sessionOwnerPhone = () => {
  const info = whatsAppService.userInfo || {};
  return String(info.number || info.id || '').replace(/\D/g, '');
};

const belongsToSession = (record) => {
  const owner = sessionOwnerPhone();
  if (!owner) return false;
  return (
    String(record.ownerPhone || '').replace(/\D/g, '') === owner ||
    String(record.phone || '').replace(/\D/g, '') === owner
  );
};

const campaignsForSession = (campaigns) => campaigns.filter(belongsToSession);
const contactsForSession = (contacts) => contacts.filter(belongsToSession);

const healthMonitor = new HealthMonitor(() => ({
  contacts: loadContacts(),
  campaigns: loadCampaignHistory(),
  settings: loadSafetySettings() || {}
}));

const conversationIntelligence = new ConversationIntelligence({});

const templateManager = new TemplateManager({
  loadTemplates: async () => {
    const data = loadJsonFile(path.join(__dirname, 'message_templates.json'), null);
    return data;
  },
  saveTemplates: async (templates) => {
    return saveJsonFile(path.join(__dirname, 'message_templates.json'), templates);
  }
});

const ComplianceService = require('./services/compliance-service');
const complianceService = new ComplianceService({ dataDir: __dirname });

templateManager.init().catch(err => console.error('TemplateManager init error:', err.message));

// --- WebSocket Clients ---
const clients = new Set();

function broadcast(message, excludeWs = null) {
  const payload = JSON.stringify(message);
  clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

function broadcastAll(message) {
  const payload = JSON.stringify(message);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// --- Shield-gateway log rotation ---
// Both server.js and whatsapp.js append a JSON line to shield-gateway.log for
// every checkNumber/sendMessage, so the file grows without bound during scans.
// Rotate it (move to <name>.1, replacing an old .1) once it exceeds a cap.
const SHIELD_LOG_PATHS = [
  path.join(__dirname, 'shield-gateway.log'),
  path.join(__dirname, 'session_auth_info', 'shield-gateway.log')
];
const SHIELD_LOG_MAX_BYTES = 8 * 1024 * 1024;

const rotateShieldLogs = () => {
  for (const filePath of SHIELD_LOG_PATHS) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const size = fs.statSync(filePath).size;
      if (size <= SHIELD_LOG_MAX_BYTES) continue;
      const rotated = `${filePath}.1`;
      if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
      fs.renameSync(filePath, rotated);
      console.log(`[LOG_ROTATE] ${filePath} (${size} bytes) -> ${rotated}`);
    } catch (err) {
      console.error('Failed to rotate shield-gateway.log:', err.message);
    }
  }
};
rotateShieldLogs();
setInterval(rotateShieldLogs, 60 * 1000).unref();

// --- Bulk check lifecycle ---
// One authoritative job object powers every scan: start, progress, pause,
// resume, and stop. Every live event carries the job id so clients can ignore
// events from a superseded job. Only one job can be active at a time (enforced
// by bulkCheckLock + this object).
const bulkCheckJob = {
  active: false,
  id: null,
  state: 'IDLE', // IDLE | STARTING | SCANNING | PAUSED | RESUMING | COMPLETED | STOPPED
  total: 0,
  cursor: -1, // authoritative 0-based position of the last processed number
  results: [],
  stopped: false, // set by stopBulkCheck(); the loop checks it at every checkpoint
};

function pauseBulkCheck() {
  if (!bulkCheckJob.active) return;
  if (bulkCheckJob.state !== 'SCANNING' && bulkCheckJob.state !== 'STARTING' && bulkCheckJob.state !== 'RESUMING') return;
  bulkCheckJob.state = 'PAUSED';
  broadcastAll({
    type: 'BULK_CHECK_PAUSED',
    jobId: bulkCheckJob.id,
    cursor: bulkCheckJob.cursor,
    total: bulkCheckJob.total,
    processed: bulkCheckJob.results.length
  });
}

function resumeBulkCheck() {
  if (!bulkCheckJob.active) return;
  if (bulkCheckJob.state !== 'PAUSED') return;
  bulkCheckJob.state = 'RESUMING';
  broadcastAll({ type: 'BULK_CHECK_RESUMING', jobId: bulkCheckJob.id });
  setTimeout(() => {
    if (bulkCheckJob.state === 'RESUMING') bulkCheckJob.state = 'SCANNING';
  }, 300).unref?.();
}

function stopBulkCheck() {
  bulkCheckJob.stopped = true;
  // Wake any pause waiter so the loop finalizes promptly.
  if (bulkCheckJob.state === 'PAUSED' || bulkCheckJob.state === 'RESUMING') {
    bulkCheckJob.state = 'SCANNING';
  }
}

// Holds the scan loop while the job is paused. Resolves true when resumed,
// false when stopped.
function waitIfPausedOrStopped() {
  if (bulkCheckJob.state !== 'PAUSED' && bulkCheckJob.state !== 'RESUMING') {
    return Promise.resolve(!bulkCheckJob.stopped);
  }
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (bulkCheckJob.stopped) {
        clearInterval(timer);
        resolve(false);
      } else if (bulkCheckJob.state === 'SCANNING') {
        clearInterval(timer);
        resolve(true);
      }
    }, 100);
    timer.unref?.();
  });
}

// Delay that resolves immediately when the job is stopped OR paused so a
// Pause/Stop takes effect without waiting out the remaining shield delay.
function pausableDelay(ms) {
  if (bulkCheckJob.stopped || bulkCheckJob.state === 'PAUSED') return Promise.resolve();
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (bulkCheckJob.stopped || bulkCheckJob.state === 'PAUSED' || Date.now() - start >= ms) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
    timer.unref?.();
  });
}

function appendShieldLog(level, message, data) {
  try {
    const logFile = path.join(__dirname, 'shield-gateway.log');
    const entry = { timestamp: new Date().toISOString(), level, message };
    if (data !== undefined) entry.data = data;
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to write to shield-gateway.log:', err);
  }
}

// Shared bulk-check engine — the single authoritative scan implementation.
// Both the WS (start_bulk_check) and REST (/api/check-bulk) entry points funnel
// into here so pause/resume/stop, progress, and lifecycle are identical no
// matter how the job was started. Callers hold bulkCheckLock while this runs.
async function runBulkCheck({ numbers, phone, countryCode, delayMs, shieldMode }) {
  const sanitized = sanitizeNumbers(numbers, 500);
  if (sanitized.length === 0) {
    broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', reason: 'No valid numbers provided' });
    return;
  }
  if (whatsAppService.status !== 'CONNECTED' || !whatsAppService.sock) {
    broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', reason: 'WhatsApp is not connected. Please link your device first.' });
    return;
  }

  const jobId = crypto.randomUUID();
  bulkCheckJob.active = true;
  bulkCheckJob.id = jobId;
  bulkCheckJob.state = 'STARTING';
  bulkCheckJob.total = sanitized.length;
  bulkCheckJob.cursor = -1;
  bulkCheckJob.results = [];
  bulkCheckJob.stopped = false;

  broadcastAll({ type: 'BULK_CHECK_START', jobId, total: sanitized.length });
  appendShieldLog('INFO', `Starting validation of ${sanitized.length} numbers`, { jobId, count: sanitized.length, phone, countryCode, delayMs, shieldMode });

  const results = [];
  const isShieldMode = shieldMode !== false;
  const baseDelay = clampDelay(delayMs, isShieldMode);

  for (let i = 0; i < sanitized.length; i++) {
    if (bulkCheckJob.stopped) break;

    // Pause / resume / stop checkpoint — no number is checked while PAUSED.
    const proceed = await waitIfPausedOrStopped();
    if (!proceed) break;

    const num = sanitized[i];
    const cleanNum = num.replace(/\D/g, '');
    bulkCheckJob.state = 'SCANNING';
    bulkCheckJob.cursor = i;

    try {
      const result = await whatsAppService.checkNumber(num);
      const parsed = {
        ...result,
        formatted: result.formatted || `+${cleanNum}`,
        detectedCountry: result.detectedCountry || null
      };
      results.push(parsed);
      broadcastAll({ type: 'BULK_CHECK_PROGRESS', jobId, index: i, total: sanitized.length, result: parsed });
      appendShieldLog('INFO', `Validating number ${i + 1}/${sanitized.length}: ${num} (exists: ${result.exists})`, { jobId, index: i, total: sanitized.length, result: parsed });
    } catch (err) {
      const errorResult = {
        number: num,
        formatted: `+${cleanNum}`,
        exists: false,
        isValidFormat: false,
        error: err.message
      };
      results.push(errorResult);
      broadcastAll({ type: 'BULK_CHECK_PROGRESS', jobId, index: i, total: sanitized.length, result: errorResult });
      appendShieldLog('ERROR', `Error validating number ${i + 1}/${sanitized.length}: ${num} - ${err.message}`, { jobId, index: i, total: sanitized.length, error: err.message });
    }

    if (i < sanitized.length - 1) {
      const delay = isShieldMode
        ? baseDelay + Math.random() * baseDelay * 0.5
        : Math.max(1000, baseDelay * 0.3);

      if (isShieldMode && i > 0 && i % 10 === 0) {
        broadcastAll({
          type: 'BULK_CHECK_COOLDOWN',
          jobId,
          message: `Shield cooldown: pausing ${Math.ceil(delay / 1000)}s after ${i} checks`,
          timeLeft: Math.ceil(delay / 1000)
        });
      }

      await pausableDelay(delay);
    }
  }

  const stopped = bulkCheckJob.stopped;
  const registeredCount = results.filter(r => r.exists).length;
  const unregisteredCount = results.filter(r => !r.exists && r.isValidFormat).length;
  const invalidCount = results.filter(r => !r.isValidFormat).length;

  const campaign = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    phone: (phone || '').replace(/\D/g, ''),
    contactName: null,
    countryCode: countryCode || 'Unknown',
    totalChecked: results.length,
    registeredCount,
    unregisteredCount,
    invalidCount,
    aiMode: 'manual',
    results,
    shieldMode: isShieldMode,
    delayMs: baseDelay,
    status: stopped ? 'STOPPED' : 'COMPLETED',
    countryBreakdown: {}
  };

  const allCampaigns = loadCampaignHistory();
  allCampaigns.unshift(campaign);
  saveCampaignHistory(allCampaigns);

  if (stopped) {
    bulkCheckJob.state = 'STOPPED';
    broadcastAll({
      type: 'BULK_CHECK_STOPPED',
      jobId,
      resultsCount: results.length,
      total: sanitized.length,
      registered: registeredCount,
      unregistered: unregisteredCount,
      invalid: invalidCount,
      campaign,
      status: 'STOPPED'
    });
    appendShieldLog('INFO', `Validation stopped by user. ${results.length} partial results saved.`, { jobId, resultsCount: results.length, registered: registeredCount, unregistered: unregisteredCount, invalid: invalidCount });
  } else {
    bulkCheckJob.state = 'COMPLETED';
    broadcastAll({
      type: 'BULK_CHECK_COMPLETE',
      jobId,
      resultsCount: results.length,
      registered: registeredCount,
      unregistered: unregisteredCount,
      invalid: invalidCount,
      campaign,
      status: 'COMPLETED'
    });
    appendShieldLog('INFO', `Validation completed for phone: ${phone}. Results: ${results.length}`, { jobId, resultsCount: results.length, registered: registeredCount, unregistered: unregisteredCount, invalid: invalidCount });
  }

  bulkCheckJob.active = false;
}

// --- WhatsApp Service Integration ---
whatsAppService.init((statusData) => {
  broadcastAll({ type: 'STATUS_UPDATE', ...statusData });
  console.log('[SHIELD_GATEWAY] WhatsApp status updated:', statusData);
  // Log status update to shield-gateway.log
  const logFile = path.join(__dirname, 'shield-gateway.log');
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: `WhatsApp status updated: ${JSON.stringify(statusData)}`
  };
  try {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to write to shield-gateway.log:', err);
  }
});

// Non-blocking profile-picture refresh: only updates sessionUser, does not
// re-trigger authentication or history loading on the client.
whatsAppService.onUserUpdateCallback = (user) => {
  broadcastAll({ type: 'USER_UPDATE', user });
};

whatsAppService.onMessage((messageData) => {
  const { phone, text, id, timestamp } = messageData;

  const e164Phone = formatE164(phone);
  const cleanPhone = normalizePhone(phone);
  let contacts = loadContacts();
  let contact = contacts.find(c => normalizePhone(c.phone) === cleanPhone);
  if (!contact) {
    const logFile = path.join(__dirname, 'shield-gateway.log');
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `onMessage: New message from ${phone}: ${text}`, 
      data: { phone, text, id, timestamp }
    };
    try {
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to write to shield-gateway.log:', err);
    }

    contact = {
      id: `contact_${cleanPhone}_${Date.now()}`,
      phone: e164Phone || `+${cleanPhone}`,
      name: e164Phone || `+${cleanPhone}`,
      country: 'Unknown',
      avatar: null,
      about: '',
      exists: true,
      isVerified: false,
      isBusiness: false,
      mode: 'manual',
      pinned: false,
      archived: false,
      starred: false,
      tags: [],
      notes: '',
      journey: 'new_lead',
      crm: null,
      unread: 0,
      status: 'online',
      source: 'whatsapp',
      ownerPhone: sessionOwnerPhone(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    contacts.unshift(contact);
    saveContacts(contacts);
  } else if (e164Phone && contact.phone !== e164Phone) {
    contact.phone = e164Phone;
    contact.updatedAt = new Date().toISOString();
    saveContacts(contacts);
  }
  if (contact && !contact.ownerPhone) contact.ownerPhone = sessionOwnerPhone();

  const messageResult = {
    id: id || crypto.randomUUID(),
    number: contact.phone,
    formatted: contact.phone,
    exists: true,
    statusText: text,
    text,
    avatar: null,
    isValidFormat: true,
    timestamp,
    from: 'them',
    mode: contact.mode || 'manual',
    status: 'delivered'
  };

  let allCampaigns = loadCampaignHistory();
  let conversation = allCampaigns.find(c => c.phone === phone);
  if (!conversation) {
    conversation = {
      id: crypto.randomUUID(),
      timestamp,
      phone,
      contactName: contact.name || null,
      countryCode: contact.country || 'Unknown',
      totalChecked: 0,
      registeredCount: 0,
      unregisteredCount: 0,
      invalidCount: 0,
      aiMode: contact.mode || 'manual',
      results: [],
      shieldMode: true,
      delayMs: 1000,
      ownerPhone: sessionOwnerPhone(),
      countryBreakdown: {}
    };
    allCampaigns.unshift(conversation);
  }
  if (conversation && !conversation.ownerPhone) conversation.ownerPhone = sessionOwnerPhone();
  if (!conversation.results) conversation.results = [];
  conversation.results.push(messageResult);

  saveCampaignHistory(allCampaigns);

  contact.unread = (contact.unread || 0) + 1;
  contact.updatedAt = new Date().toISOString();
  saveContacts(contacts);

  broadcastAll({
    type: 'MESSAGE_AGENT_UPDATE',
    action: 'new_message',
    contactId: contact.id,
    phone,
    message: messageResult
  });

  // Auto-detect opt-out intent in incoming messages
  try {
    const optOutCheck = conversationIntelligence.checkOptOut({ text, phone });
    if (optOutCheck.isOptOut && optOutCheck.confidence >= 0.6) {
      complianceService.addToSuppressionList(contact.id, phone, 'auto_detected');
      contact.optedOut = true;
      const contacts = loadContacts();
      const idx = contacts.findIndex(c => c.id === contact.id);
      if (idx !== -1) {
        contacts[idx].optedOut = true;
        contacts[idx].updatedAt = new Date().toISOString();
        saveContacts(contacts);
        broadcastAll({
          type: 'MESSAGE_AGENT_UPDATE',
          action: 'contact_opted_out',
          contactId: contact.id,
          contact: contacts[idx]
        });
      }
      console.log(`[COMPLIANCE] Auto-suppressed ${contact.id} after incoming opt-out message`);
    }
  } catch (optOutErr) {
    console.error('[COMPLIANCE] Error in auto opt-out detection:', optOutErr.message);
  }
});

whatsAppService.onMessageStatus((statusData) => {
  const { messageId, jid, status } = statusData;
  const phone = jid?.split('@')[0] || '';

  let allCampaigns = loadCampaignHistory();
  let updated = false;
  for (const conv of allCampaigns) {
    if (conv.results) {
      for (const msg of conv.results) {
        if (msg.id === messageId) {
          msg.status = status;
          updated = true;
          break;
        }
      }
    }
  }
  if (updated) saveCampaignHistory(allCampaigns);

  broadcastAll({
    type: 'MESSAGE_AGENT_UPDATE',
    action: 'message_status',
    messageId,
    phone,
    status
  });
});

// --- WebSocket Handler ---
wss.on('connection', (ws, req) => {
  clients.add(ws);
  ws._rateKey = (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'ws'
  );
  console.log(`WebSocket client connected. Total: ${clients.size}`);

  // Send current status on connect
  ws.send(JSON.stringify({
    type: 'STATUS_UPDATE',
    status: whatsAppService.status,
    qr: whatsAppService.qrCodeDataUrl,
    user: whatsAppService.userInfo
  }));

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'get_qr':
        case 'generate_qr':
          await whatsAppService.generateQRCode();
          break;

        case 'cancel_qr':
          whatsAppService.cancelQR();
          break;

        case 'logout':
          stopBulkCheck();
          await whatsAppService.logout();
          ws.send(JSON.stringify({ type: 'LOGOUT_RESULT', success: true }));
          break;

        case 'get_history': {
          const phone = data.phone?.replace(/\D/g, '') || '';
          const campaigns = loadCampaignHistory();
          const userCampaigns = campaigns.filter(c => c.phone === phone);
          ws.send(JSON.stringify({ type: 'HISTORY_RESULT', campaigns: userCampaigns }));
          break;
        }

        case 'delete_campaign': {
          const phone = data.phone?.replace(/\D/g, '') || '';
          let campaigns = loadCampaignHistory();
          const deleted = campaigns.find(c => c.id === data.id);
          campaigns = campaigns.filter(c => c.id !== data.id);
          saveCampaignHistory(campaigns);
          // Clean up cached profile pictures associated with this campaign's
          // numbers — only when no remaining campaign/contact still references
          // them. Best-effort: failures never block the deletion response.
          if (deleted) cleanupProfilePicCacheAfterCampaignDeletion(deleted);
          const userCampaigns = campaigns.filter(c => c.phone === phone);
          ws.send(JSON.stringify({ type: 'DELETE_RESULT', success: true, campaigns: userCampaigns }));
          break;
        }

        case 'stop_bulk_check':
          stopBulkCheck();
          break;

        case 'pause_bulk_check':
          pauseBulkCheck();
          break;

        case 'resume_bulk_check':
          resumeBulkCheck();
          break;

         case 'start_bulk_check': {
          const { numbers, phone, settings: scanSettings } = data;

          if (!bulkCheckLock.tryAcquire()) {
            ws.send(JSON.stringify({ type: 'BULK_CHECK_INTERRUPTED', reason: 'A bulk check is already running. Wait for it to finish or stop it first.' }));
            break;
          }

          try {
            await runBulkCheck({
              numbers,
              phone: phone || '',
              countryCode: scanSettings?.countryCode,
              delayMs: scanSettings?.delayMs,
              shieldMode: scanSettings?.shieldMode
            });
          } finally {
            bulkCheckLock.release();
          }
          break;
        }

        case 'SEND_MESSAGE': {
          const { message, conversationId, mode, phone, contactId } = data;
          const cleanPhone = normalizePhone(phone || '');
          let waResult = null;
          let messageStatus = 'sent';
          let waError = null;

          // Per-socket rate limit on message sends
          const sendRateCheck = messageLimiter.check(ws._rateKey || ws._socket?.remoteAddress || 'ws');
          if (!sendRateCheck.allowed) {
            ws.send(JSON.stringify({ type: 'MESSAGE_SENT', success: false, message: {
              id: message?.id || crypto.randomUUID(),
              text: message?.text || message,
              from: 'me',
              timestamp: new Date().toISOString(),
              status: 'blocked',
              waError: 'Too many messages sent in a short window. Please wait a moment.'
            }}));
            break;
          }

          // Compliance gate before sending
          let gateContact = loadContacts().find(c => c.id === contactId || c.phone?.replace(/\D/g, '') === cleanPhone);
          const complianceResult = complianceService.canSendMessage(contactId || gateContact?.id || phone, cleanPhone, gateContact);
          if (!complianceResult.allowed) {
            ws.send(JSON.stringify({ type: 'MESSAGE_SENT', success: false, message: {
              id: message?.id || crypto.randomUUID(),
              text: message?.text || message,
              from: 'me',
              timestamp: new Date().toISOString(),
              status: 'blocked',
              waError: complianceResult.reason
            }}));
            break;
          }

          // Never send to numbers verified as NOT registered on WhatsApp (anti-ban)
          if (gateContact && gateContact.exists === false) {
            ws.send(JSON.stringify({ type: 'MESSAGE_SENT', success: false, message: {
              id: message?.id || crypto.randomUUID(),
              text: message?.text || message,
              from: 'me',
              timestamp: new Date().toISOString(),
              status: 'blocked',
              waError: 'Number not registered on WhatsApp'
            }}));
            break;
          }

          // Health auto-pause gate
          try {
            const autoPause = healthMonitor.checkAutoPause();
            if (autoPause && autoPause.isPaused) {
              const reason = autoPause.pauseConditions?.[0]?.reason || 'Account health too low';
              ws.send(JSON.stringify({ type: 'MESSAGE_SENT', success: false, message: {
                id: message?.id || crypto.randomUUID(),
                text: message?.text || message,
                from: 'me',
                timestamp: new Date().toISOString(),
                status: 'blocked',
                waError: `Outreach paused for safety: ${reason}`
              }}));
              break;
            }
          } catch (healthErr) {
            console.error('Health auto-pause check error:', healthErr.message);
          }

          if (cleanPhone && whatsAppService.status === 'CONNECTED') {
            try {
              waResult = await whatsAppService.sendMessage(cleanPhone, message.text || message);
              messageStatus = 'sent';
            } catch (waErr) {
              console.error('WhatsApp send failed:', waErr.message);
              messageStatus = 'failed';
              waError = waErr.message;
            }
          } else {
            // Not connected — never mark as 'sent' silently (was a correctness bug)
            messageStatus = 'failed';
            waError = 'WhatsApp is not connected. Please link your device first.';
          }

          const messageResult = {
            id: waResult?.id || message.id || crypto.randomUUID(),
            text: message.text || message,
            from: 'me',
            timestamp: new Date().toISOString(),
            status: messageStatus,
            replyTo: message.replyTo || null,
            attachment: message.attachment || null
          };

          let contacts = loadContacts();
          let contact = contacts.find(c => c.id === contactId || c.phone?.replace(/\D/g, '') === cleanPhone);
          if (!contact && cleanPhone) {
            contact = {
              id: `contact_${cleanPhone}_${Date.now()}`,
              phone: `+${cleanPhone}`,
              name: `+${cleanPhone}`,
              country: 'Unknown',
              avatar: null,
              about: '',
              exists: true,
              isVerified: false,
              isBusiness: false,
              mode: mode || 'manual',
              pinned: false,
              archived: false,
              starred: false,
              tags: [],
              notes: '',
              journey: 'new_lead',
              crm: null,
              unread: 0,
              status: 'offline',
              source: 'manual',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            contacts.unshift(contact);
            saveContacts(contacts);
          }

          let allCampaigns = loadCampaignHistory();
          let conversation = allCampaigns.find(c => c.phone === cleanPhone);
          if (!conversation && cleanPhone) {
            conversation = {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              phone: cleanPhone,
              contactName: contact?.name || null,
              countryCode: contact?.country || 'Unknown',
              totalChecked: 0,
              registeredCount: 0,
              unregisteredCount: 0,
              invalidCount: 0,
              aiMode: mode || 'manual',
              results: [],
              shieldMode: true,
              delayMs: 1000,
              countryBreakdown: {}
            };
            allCampaigns.unshift(conversation);
          }
          if (conversation && conversation.results) {
            conversation.results.push(messageResult);
            saveCampaignHistory(allCampaigns);
          }
          if (contact) {
            contact.updatedAt = new Date().toISOString();
            saveContacts(contacts);
          }

          broadcastAll({
            type: 'MESSAGE_AGENT_UPDATE',
            action: 'new_message',
            contactId: contact?.id,
            phone: cleanPhone,
            message: messageResult
          });
          ws.send(JSON.stringify({ type: 'MESSAGE_SENT', success: messageStatus !== 'failed', message: messageResult }));
          break;
        }

        case 'DELETE_MESSAGE': {
          const { messageId, conversationPhone, deleteForEveryone } = data;
          const cleanPhone = (conversationPhone || '').replace(/\D/g, '');
          let allCampaigns = loadCampaignHistory();
          let conv = allCampaigns.find(c => c.phone === cleanPhone);
          if (conv && conv.results) {
            if (deleteForEveryone) {
              conv.results = conv.results.filter(m => m.id !== messageId);
            } else {
              conv.results = conv.results.map(m => m.id === messageId ? { ...m, text: 'You deleted this message', deleted: true, from: 'system' } : m);
            }
            saveCampaignHistory(allCampaigns);
          }
          broadcastAll({
            type: 'MESSAGE_AGENT_UPDATE',
            action: 'message_deleted',
            messageId,
            phone: cleanPhone,
            deleteForEveryone: !!deleteForEveryone
          });
          ws.send(JSON.stringify({ type: 'MESSAGE_DELETED', success: true, messageId }));
          break;
        }

        case 'UPDATE_CONTACT': {
          broadcastAll({
            type: 'MESSAGE_AGENT_UPDATE',
            action: 'contact_updated',
            contact: data.contact,
            conversationId: data.conversationId
          });
          break;
        }

        default:
          console.log('Unhandled WS message type:', data.type);
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`WebSocket client disconnected. Total: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    clients.delete(ws);
  });
});

// --- REST API Routes ---

// Health check
app.get('/api/status', (req, res) => {
  res.json({
    status: whatsAppService.status,
    qr: whatsAppService.qrCodeDataUrl,
    user: whatsAppService.userInfo
  });
});

// Logout
app.post('/api/logout', authActionLimiter.middleware(), async (req, res) => {
  try {
    stopBulkCheck();
    await whatsAppService.logout();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk check endpoint (REST trigger — results flow through WebSocket)
app.post('/api/check-bulk', bulkCheckLimiter.middleware(), async (req, res) => {
  let bulkLockAcquired = false;
  try {
    const { numbers, phone, countryCode, delayMs, shieldMode } = req.body;
    const sanitized = sanitizeNumbers(numbers, 500);
    if (sanitized.length === 0) {
      return res.status(400).json({ error: 'No valid numbers provided' });
    }

    // Fail fast when WhatsApp is not connected — avoids a flood of per-number errors
    if (whatsAppService.status !== 'CONNECTED' || !whatsAppService.sock) {
      return res.status(409).json({ error: 'WhatsApp is not connected. Please link your device first.' });
    }

    if (!(bulkLockAcquired = bulkCheckLock.tryAcquire())) {
      return res.status(429).json({ error: 'A bulk check is already running. Wait for it to finish or stop it first.' });
    }

    res.json({ success: true, message: 'Bulk check started', total: sanitized.length });

    await runBulkCheck({ numbers: sanitized, phone, countryCode, delayMs, shieldMode });
  } catch (err) {
    console.error('Bulk check error:', err);
    broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', reason: err.message });
  } finally {
    if (bulkLockAcquired) bulkCheckLock.release();
  }
});

// Get campaigns (REST endpoint for CampaignHistoryPage)
app.get('/api/campaigns', (req, res) => {
  try {
    const phone = req.query.phone?.replace(/\D/g, '') || '';
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }
    const allCampaigns = loadCampaignHistory();
    const userCampaigns = allCampaigns.filter(c => c.phone === phone);
    res.json({ success: true, campaigns: userCampaigns });
  } catch (err) {
    console.error('Error loading campaigns:', err);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

// Profile-picture endpoint: same-origin, cached, SSRF-safe. Accepts ONLY a
// phone number; the jid is built server-side and the picture is fetched via the
// app's own authorized WhatsApp session (Baileys profilePictureUrl), so only
// legitimately-public pictures are ever returned. Falls back to cached bytes
// (fresh or stale) when the session is offline, and 404s when no public picture
// is available so the UI can show a fallback avatar.
app.get('/api/profile-picture', async (req, res) => {
  const phone = String(req.query.phone || '').replace(/\D/g, '');
  if (!phone) {
    return res.status(400).json({ error: 'phone (digits) required' });
  }

  const connected = whatsAppService.status === 'CONNECTED';
  const mem = profilePicCache.get(phone);
  const fresh = !!(mem && (Date.now() - mem.savedAt) < PROFILE_PIC_TTL_MS);

  const sendCached = (entry) => {
    res.set('Content-Type', entry.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(entry.data);
  };

  // Resolve the picture bytes through a per-phone single-flight so concurrent
  // requests for the same number share one WhatsApp lookup and one result.
  const resolvePicture = async () => {
    const existing = profilePicInFlight.get(phone);
    if (existing) return existing;
    const p = whatsAppService.getProfilePicture(phone).finally(() => {
      if (profilePicInFlight.get(phone) === p) profilePicInFlight.delete(phone);
    });
    profilePicInFlight.set(phone, p);
    return p;
  };

  try {
    // Serve a fresh in-memory copy immediately (also covers offline clients).
    if (mem && (fresh || !connected)) {
      return sendCached(mem);
    }

    // Refresh from the authorized session when connected and cache is stale/missing.
    if (connected) {
      const pic = await resolvePicture();
      if (pic && pic.data) {
        const entry = { data: pic.data, contentType: pic.contentType, savedAt: Date.now() };
        setProfilePicCache(phone, entry);
        try {
          fs.mkdirSync(PROFILE_PIC_CACHE_DIR, { recursive: true });
          fs.writeFileSync(profilePicCachePath(phone), pic.data);
        } catch (e) {}
        return sendCached(entry);
      }
    }

    // Graceful stale: serve a previously cached picture (disk or memory) even if
    // the session is offline or the signed URL expired — better than a broken image.
    if (mem) return sendCached(mem);
    const filePath = profilePicCachePath(phone);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      const entry = { data, contentType: 'image/jpeg', savedAt: Date.now() };
      setProfilePicCache(phone, entry);
      return sendCached(entry);
    }

    // Cache the negative result briefly so repeat visits don't hammer the endpoint
    // for every registered number that legitimately has no public picture.
    res.set('Cache-Control', 'public, max-age=300');
    res.status(404).json({ error: 'Profile picture not available' });
  } catch (err) {
    console.error('Error serving profile picture:', err.message);
    if (mem) return sendCached(mem);
    res.status(500).json({ error: 'Failed to load profile picture' });
  }
});

// --- Message Agent API ---

// Get conversations for Message Agent
app.get('/api/message-agent/conversations', (req, res) => {
  try {
    // Conversations are strictly scoped to the connected WhatsApp session so a
    // different user's contacts/campaigns are never exposed.
    const contacts = contactsForSession(loadContacts());
    const allCampaigns = campaignsForSession(loadCampaignHistory());
    
    // Build conversations from contacts.
    // Only include contacts that are on WhatsApp OR already have real message history.
    // This filters out shield-imported numbers that were never detected as registered.
    const conversations = [];

    for (const contact of contacts) {
      const relatedCampaigns = allCampaigns.filter(c => 
        c.results?.some(r => r.number?.replace(/\D/g, '') === contact.phone?.replace(/\D/g, ''))
      );
      
      const messages = [];
      relatedCampaigns.forEach(c => {
        if (c.results) {
          c.results.forEach(r => {
            if (r.from) {
              messages.push({
                id: r.timestamp || crypto.randomUUID(),
                text: typeof r.statusText === 'string' ? r.statusText : (typeof r.message === 'string' ? r.message : ''),
                from: r.from === 'user' ? 'me' : r.from === 'ai' ? 'ai' : 'them',
                timestamp: r.timestamp || c.timestamp,
                status: r.status || 'delivered'
              });
            }
          });
        }
      });

      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Skip contacts that are not on WhatsApp and never had a real conversation.
      if (contact.exists === false && messages.length === 0) {
        continue;
      }

      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

      conversations.push({
        id: contact.id,
        contact: {
          name: contact.name || `+${contact.phone}`,
          phone: contact.phone,
          country: contact.country || 'Unknown',
          avatar: contact.avatar || null,
          about: contact.about || '',
          exists: contact.exists !== false,
          isVerified: contact.isVerified || false,
          isBusiness: contact.isBusiness || false,
        },
        lastMessage: lastMsg ? {
          text: lastMsg.text,
          timestamp: lastMsg.timestamp,
          from: lastMsg.from,
          status: lastMsg.status
        } : null,
        unread: contact.unread || 0,
        mode: contact.mode || 'manual',
        pinned: contact.pinned || false,
        archived: contact.archived || false,
        starred: contact.starred || false,
        tags: contact.tags || [],
        notes: contact.notes || '',
        journey: contact.journey || 'new_lead',
        crm: contact.crm || null,
        createdAt: contact.createdAt || new Date().toISOString(),
        messages,
        status: contact.status || 'offline',
      });
    }

    // Sort by last message timestamp
    conversations.sort((a, b) => {
      const tsA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const tsB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return tsB - tsA;
    });

    res.json({ success: true, conversations });
  } catch (err) {
    console.error('Error loading conversations:', err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// Create or get conversation
app.post('/api/message-agent/conversation', async (req, res) => {
  try {
    const { phone, mode = 'manual', contactInfo } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }
    
    const cleanPhone = normalizePhone(phone);
    const e164Phone = formatE164(phone);
    
    // Check if contact already exists
    const contacts = loadContacts();
    let existingContact = contacts.find(c => c.id === phone || normalizePhone(c.phone) === cleanPhone);
    
    if (existingContact) {
      // Update phone format if needed
      if (e164Phone && existingContact.phone !== e164Phone) {
        existingContact.phone = e164Phone;
      }
      // Tag ownership when a legacy contact created before session tagging is adopted
      if (!existingContact.ownerPhone) existingContact.ownerPhone = sessionOwnerPhone();
      // Update mode if provided
      if (mode) existingContact.mode = mode;
      if (contactInfo?.name) existingContact.name = contactInfo.name;
      if (contactInfo?.about) existingContact.about = contactInfo.about;
      if (contactInfo?.avatar) existingContact.avatar = contactInfo.avatar;
      if (contactInfo?.country) existingContact.country = contactInfo.country;
      if (contactInfo?.exists !== undefined) existingContact.exists = contactInfo.exists;
      if (contactInfo?.isBusiness !== undefined) existingContact.isBusiness = contactInfo.isBusiness;
      existingContact.updatedAt = new Date().toISOString();
      
      saveContacts(contacts);
      
      return res.json({ success: true, conversation: existingContact, isNew: false });
    }
    
    // Create new contact
    const newContact = {
      id: `contact_${cleanPhone}_${Date.now()}`,
      phone: e164Phone || `+${cleanPhone}`,
      name: contactInfo?.name || e164Phone || `+${cleanPhone}`,
      country: contactInfo?.country || 'Unknown',
      avatar: contactInfo?.avatar || null,
      about: contactInfo?.about || '',
      exists: contactInfo?.exists !== false,
      isVerified: contactInfo?.isVerified || false,
      isBusiness: contactInfo?.isBusiness || false,
      mode,
      pinned: false,
      archived: false,
      starred: false,
      tags: [],
      notes: '',
      journey: 'new_lead',
      crm: null,
      unread: 0,
      status: 'offline',
      source: contactInfo?.source || 'manual',
      ownerPhone: sessionOwnerPhone(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    contacts.unshift(newContact);
    saveContacts(contacts);
    
    res.json({ success: true, conversation: newContact, isNew: true });
  } catch (err) {
    console.error('Error creating conversation:', err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Send a message
app.post('/api/message-agent/message', messageLimiter.middleware(), async (req, res) => {
  try {
    const { contactId, phone, message, from = 'user', mode = 'manual' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    const rawPhone = phone || '';
    const cleanDigits = normalizePhone(rawPhone);
    const e164Phone = formatE164(rawPhone);
    
    // Find contact by ID or normalized phone
    const contacts = loadContacts();
    let contact = contacts.find(c => c.id === contactId || normalizePhone(c.phone) === cleanDigits);
    
    if (!contact && cleanDigits) {
      const country = req.body.country || 'Unknown';
      contact = {
        id: `contact_${cleanDigits}_${Date.now()}`,
        phone: e164Phone || `+${cleanDigits}`,
        name: `+${cleanDigits}`,
        country,
        avatar: null,
        about: '',
        exists: true,
        isVerified: false,
        isBusiness: false,
        mode,
        pinned: false,
        archived: false,
        starred: false,
        tags: [],
        notes: '',
        journey: 'new_lead',
        crm: null,
        unread: 0,
        status: 'offline',
        source: 'message',
        ownerPhone: sessionOwnerPhone(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      contacts.unshift(contact);
    } else if (contact && e164Phone && contact.phone !== e164Phone) {
      contact.phone = e164Phone;
      contact.updatedAt = new Date().toISOString();
    }
    if (contact && !contact.ownerPhone) contact.ownerPhone = sessionOwnerPhone();

    // Guard against sending to numbers that were verified as NOT registered on WhatsApp.
    // Sending to unregistered numbers is the #1 cause of account blocks.
    if (contact && contact.exists === false && (from === 'user' || from === 'ai')) {
      return res.status(403).json({
        success: false,
        error: 'This number is not registered on WhatsApp. Sending is disabled to protect your account.',
        code: 'NOT_REGISTERED',
        contact,
        message: {
          id: crypto.randomUUID(),
          text: message,
          timestamp: new Date().toISOString(),
          from: from,
          status: 'blocked',
          waError: 'Number not registered on WhatsApp',
          complianceBlocked: true
        }
      });
    }

    // Compliance check before sending
    const contactIdForCheck = contact?.id || contactId || phone;
    const complianceResult = complianceService.canSendMessage(contactIdForCheck, cleanDigits, contact);
    if (!complianceResult.allowed) {
      return res.status(403).json({
        success: false,
        error: complianceResult.reason,
        code: complianceResult.code,
        contact,
        message: {
          id: crypto.randomUUID(),
          text: message,
          timestamp: new Date().toISOString(),
          from: from,
          status: 'blocked',
          waError: complianceResult.reason,
          complianceBlocked: true
        }
      });
    }

    // Health auto-pause gate — blocks sends when account health is critical
    try {
      const autoPause = healthMonitor.checkAutoPause();
      if (autoPause && autoPause.isPaused) {
        const reason = autoPause.pauseConditions?.[0]?.reason || 'Account health too low';
        return res.status(429).json({
          success: false,
          error: `Outreach paused for safety: ${reason}`,
          code: 'HEALTH_PAUSED',
          contact,
          message: {
            id: crypto.randomUUID(),
            text: message,
            timestamp: new Date().toISOString(),
            from: from,
            status: 'blocked',
            waError: `Outreach paused for safety: ${reason}`,
            complianceBlocked: true
          }
        });
      }
    } catch (healthErr) {
      console.error('Health auto-pause check error:', healthErr.message);
    }

    let waMessageId = null;
    let messageStatus = 'sending';
    let waError = null;

    if ((from === 'user' || from === 'ai') && cleanDigits) {
      try {
        if (whatsAppService.status !== 'CONNECTED') {
          throw new Error('WhatsApp is not connected. Scan QR code first.');
        }
        const waResult = await whatsAppService.sendMessage(cleanDigits, message);
        waMessageId = waResult.id;
        messageStatus = 'sent';
      } catch (waErr) {
        console.error('WhatsApp send failed:', waErr.message);
        waError = waErr.message;
        messageStatus = 'failed';
      }
    } else if (from === 'system') {
      messageStatus = 'delivered';
    }

    const messageResult = {
      id: waMessageId || crypto.randomUUID(),
      number: contact?.phone || e164Phone || `+${cleanDigits}`,
      formatted: contact?.phone || e164Phone || `+${cleanDigits}`,
      exists: contact?.exists || false,
      statusText: message,
      text: message,
      avatar: null,
      isValidFormat: !!cleanDigits,
      timestamp: new Date().toISOString(),
      from: from,
      mode: mode,
      status: messageStatus,
      waError: waError
    };

    let allCampaigns = loadCampaignHistory();
    let conversation = allCampaigns.find(c => c.phone === cleanDigits);
    
    if (!conversation) {
      conversation = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        phone: cleanDigits,
        contactName: contact?.name || null,
        countryCode: contact?.country || 'Unknown',
        totalChecked: 0,
        registeredCount: 0,
        unregisteredCount: 0,
        invalidCount: 0,
        aiMode: mode,
        results: [],
        shieldMode: true,
        delayMs: 1000,
        ownerPhone: sessionOwnerPhone(),
        countryBreakdown: {}
      };
      allCampaigns.unshift(conversation);
    }
    if (conversation && !conversation.ownerPhone) conversation.ownerPhone = sessionOwnerPhone();
    
    if (!conversation.results) conversation.results = [];
    conversation.results.push(messageResult);
    
    saveCampaignHistory(allCampaigns);
    saveContacts(contacts);
    
    broadcastAll({
      type: 'MESSAGE_AGENT_UPDATE',
      action: 'new_message',
      contactId: contact?.id,
      phone: cleanDigits,
      message: messageResult
    });
    
    res.json({
      success: messageStatus !== 'failed',
      message: messageResult,
      contact,
      waError: waError || null
    });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message: ' + err.message });
  }
});

// Update conversation/contact
app.put('/api/message-agent/conversation/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const contacts = loadContacts();
    const index = contacts.findIndex(c => c.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    contacts[index] = {
      ...contacts[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    saveContacts(contacts);
    
    broadcastAll({
      type: 'MESSAGE_AGENT_UPDATE',
      action: 'contact_updated',
      contact: contacts[index]
    });
    
    res.json({ success: true, contact: contacts[index] });
  } catch (err) {
    console.error('Error updating conversation:', err);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// Delete conversation
app.delete('/api/message-agent/conversation/:id', (req, res) => {
  try {
    const { id } = req.params;
    const contacts = loadContacts();
    const filtered = contacts.filter(c => c.id !== id);
    
    if (filtered.length === contacts.length) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    saveContacts(filtered);
    
    broadcastAll({
      type: 'MESSAGE_AGENT_UPDATE',
      action: 'contact_deleted',
      contactId: id
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Delete a message (for me or for everyone)
app.post('/api/message-agent/message/delete', (req, res) => {
  try {
    const { messageId, phone, deleteForEveryone } = req.body;
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!messageId || !cleanPhone) {
      return res.status(400).json({ error: 'messageId and phone required' });
    }
    let allCampaigns = loadCampaignHistory();
    let conv = allCampaigns.find(c => c.phone === cleanPhone);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (!conv.results) conv.results = [];
    if (deleteForEveryone) {
      conv.results = conv.results.filter(m => m.id !== messageId);
    } else {
      conv.results = conv.results.map(m => m.id === messageId ? { ...m, text: 'You deleted this message', deleted: true, from: 'system' } : m);
    }
    saveCampaignHistory(allCampaigns);
    broadcastAll({
      type: 'MESSAGE_AGENT_UPDATE',
      action: 'message_deleted',
      messageId,
      phone: cleanPhone,
      deleteForEveryone: !!deleteForEveryone
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Bulk import contacts from WhatsApp Shield detection results
app.post('/api/message-agent/import-bulk', async (req, res) => {
  try {
    const { contacts: importContacts, mode = 'manual' } = req.body;
    if (!importContacts || !Array.isArray(importContacts) || importContacts.length === 0) {
      return res.status(400).json({ error: 'No contacts provided' });
    }

    const existingContacts = loadContacts();
    const added = [];
    const skipped = [];

    for (const item of importContacts) {
      const rawPhone = item.phone || item.number || '';
      const cleanPhone = normalizePhone(rawPhone);
      if (!cleanPhone) continue;

      // Validation gate: never import invalid, errored, or unregistered numbers.
      if (item.isValidFormat === false || item.error || item.exists === false) {
        skipped.push(cleanPhone);
        continue;
      }

      const e164Phone = formatE164(rawPhone) || `+${cleanPhone}`;

      const exists = existingContacts.find(c => normalizePhone(c.phone) === cleanPhone);
      if (exists) {
        skipped.push(cleanPhone);
        continue;
      }

      const newContact = {
        id: `contact_${cleanPhone}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        phone: e164Phone,
        name: item.name || item.displayName || e164Phone,
        country: item.country || item.detectedCountry || 'Unknown',
        avatar: item.avatar || null,
        about: item.about || '',
        exists: item.exists !== false,
        isVerified: item.isVerified || false,
        isBusiness: item.isBusiness || false,
        mode,
        pinned: false,
        archived: false,
        starred: false,
        tags: [],
        notes: '',
        journey: 'new_lead',
        crm: null,
        unread: 0,
        status: 'offline',
        source: 'whatsapp_shield',
        ownerPhone: sessionOwnerPhone(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      existingContacts.unshift(newContact);
      added.push(newContact);
    }

    saveContacts(existingContacts);

    broadcastAll({
      type: 'MESSAGE_AGENT_UPDATE',
      action: 'contacts_imported',
      count: added.length,
      skipped: skipped.length
    });

    res.json({ success: true, added: added.length, skipped: skipped.length });
  } catch (err) {
    console.error('Error bulk importing contacts:', err);
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

// Get Shield campaign contacts (for import) with filters
app.get('/api/message-agent/shield-contacts', (req, res) => {
  try {
    const { country, registration, campaignId } = req.query;
    // Only surface shield-importable contacts from the connected session's own
    // detection campaigns — never another user's scan results.
    const allCampaigns = campaignsForSession(loadCampaignHistory());
    const shieldContacts = [];
    const campaignSlots = {};
    const seen = new Set();

    for (const campaign of allCampaigns) {
      if (!campaign.results) continue;
      if (campaignId && campaign.id !== campaignId) continue;

      if (!campaignSlots[campaign.id]) {
        campaignSlots[campaign.id] = {
          id: campaign.id,
          date: campaign.timestamp || campaign.createdAt || null,
          totalChecked: campaign.totalChecked || campaign.results.length,
          registered: campaign.registeredCount || 0,
          countryCode: campaign.countryCode || 'Unknown',
          slotSize: campaign.slotSize || campaign.results.length,
        };
      }

      for (const r of campaign.results) {
        // Skip invalid-format entries — they are not real WhatsApp numbers
        if (r.isValidFormat === false) continue;

        const rawPhone = r.formatted || r.number || '';
        const phone = normalizePhone(rawPhone);
        if (!phone || seen.has(phone)) continue;

        const isRegistered = r.exists === true;
        if (registration === 'registered' && !isRegistered) continue;
        if (registration === 'unregistered' && isRegistered) continue;

        const contactCountry = r.detectedCountry || campaign.countryCode || '';
        if (country && contactCountry.toLowerCase() !== country.toLowerCase()) continue;

        seen.add(phone);
        const e164 = formatE164(rawPhone) || `+${phone}`;
        shieldContacts.push({
          phone: e164,
          number: phone,
          name: r.displayName || e164,
          country: contactCountry || 'Unknown',
          avatar: r.avatar || null,
          about: r.about || '',
          exists: isRegistered,
          isVerified: r.isVerified || false,
          isBusiness: r.isBusiness || false,
          source: 'whatsapp_shield',
          campaignDate: campaign.timestamp || null,
          campaignId: campaign.id
        });
      }
    }

    // Collect unique campaign slots for filter UI
    const slots = Object.values(campaignSlots).sort((a, b) => new Date(b.date) - new Date(a.date));
    // Collect unique countries
    const countries = [...new Set(shieldContacts.map(c => c.country).filter(Boolean))].sort();

    res.json({ success: true, contacts: shieldContacts, slots, countries });
  } catch (err) {
    console.error('Error loading shield contacts:', err);
    res.status(500).json({ error: 'Failed to load shield contacts' });
  }
});

// Delete shield contacts by phone numbers (bulk) - removes from campaign history
app.post('/api/message-agent/shield-contacts/delete-bulk', (req, res) => {
  try {
    const { phones } = req.body;
    if (!phones || !Array.isArray(phones)) {
      return res.status(400).json({ error: 'phones array required' });
    }
    const allCampaigns = loadCampaignHistory();
    const sessionCampaigns = new Set(campaignsForSession(allCampaigns).map(c => c.id));
    const normalizedPhones = phones.map(p => p.replace(/\D/g, ''));
    let deleted = 0;

    for (const campaign of allCampaigns) {
      if (!sessionCampaigns.has(campaign.id)) continue;
      if (!campaign.results) continue;
      const before = campaign.results.length;
      campaign.results = campaign.results.filter(r => {
        const rawPhone = r.formatted || r.number || '';
        const phone = rawPhone.replace(/\D/g, '');
        return !normalizedPhones.includes(phone);
      });
      deleted += before - campaign.results.length;
    }

    saveCampaignHistory(allCampaigns);

    broadcastAll({
      type: 'MESSAGE_AGENT_UPDATE',
      action: 'shield_contacts_deleted',
      count: deleted
    });

    res.json({ success: true, deleted });
  } catch (err) {
    console.error('Error deleting shield contacts:', err);
    res.status(500).json({ error: 'Failed to delete shield contacts' });
  }
});

// Delete all shield contacts - clears the connected session's own detection history
app.post('/api/message-agent/shield-contacts/delete-all', (req, res) => {
  try {
    const owner = sessionOwnerPhone();
    const allCampaigns = loadCampaignHistory();
    // Remove only the current session's campaigns; keep any other user's history.
    const deletedCampaigns = owner ? allCampaigns.filter(c => belongsToSession(c)) : [];
    const kept = owner
      ? allCampaigns.filter(c => !belongsToSession(c))
      : allCampaigns;
    saveCampaignHistory(kept);
    // Clean cached profile pictures for the removed campaigns' numbers.
    if (deletedCampaigns.length > 0) cleanupProfilePicCacheAfterCampaignDeletion(deletedCampaigns);

    broadcastAll({
      type: 'MESSAGE_AGENT_UPDATE',
      action: 'shield_contacts_deleted',
      count: 0
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting all shield contacts:', err);
    res.status(500).json({ error: 'Failed to delete all shield contacts' });
  }
});

// Delete contacts by phone numbers (bulk)
app.post('/api/message-agent/contacts/delete-bulk', (req, res) => {
  try {
    const { phones } = req.body;
    if (!phones || !Array.isArray(phones)) {
      return res.status(400).json({ error: 'phones array required' });
    }
    const contacts = loadContacts();
    const owner = sessionOwnerPhone();
    if (!owner) return res.status(401).json({ error: 'No active session' });
    const normalizedPhones = phones.map(p => p.replace(/\D/g, ''));
    const deleteSet = new Set(normalizedPhones);
    const kept = contacts.filter(c => {
      // Only consider contacts owned by the connected session for deletion.
      if (!belongsToSession(c)) return true;
      return !deleteSet.has((c.phone || '').replace(/\D/g, ''));
    });
    saveContacts(kept);
    res.json({ success: true, deleted: contacts.length - kept.length });
  } catch (err) {
    console.error('Error deleting contacts:', err);
    res.status(500).json({ error: 'Failed to delete contacts' });
  }
});

// Delete all contacts
app.post('/api/message-agent/contacts/delete-all', (req, res) => {
  try {
    const owner = sessionOwnerPhone();
    const contacts = loadContacts();
    const kept = owner
      ? contacts.filter(c => !belongsToSession(c))
      : contacts;
    saveContacts(kept);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting all contacts:', err);
    res.status(500).json({ error: 'Failed to delete all contacts' });
  }
});

// Get analytics
app.get('/api/message-agent/analytics', (req, res) => {
  try {
    const contacts = contactsForSession(loadContacts());
    const allCampaigns = campaignsForSession(loadCampaignHistory());
    
    const totalConversations = contacts.length;
    const activeChats = contacts.filter(c => c.status === 'online' || c.mode === 'ai').length;
    const aiConversations = contacts.filter(c => c.mode === 'ai').length;
    const manualConversations = contacts.filter(c => c.mode === 'manual').length;
    
    let totalMessages = 0;
    let aiMessages = 0;
    let manualMessages = 0;
    let sentMessages = 0;
    let receivedMessages = 0;
    
    allCampaigns.forEach(c => {
      if (c.results) {
        const msgs = c.results.filter(r => r.from);
        totalMessages += msgs.length;
        aiMessages += msgs.filter(r => r.from === 'ai').length;
        manualMessages += msgs.filter(r => r.from === 'user').length;
        sentMessages += msgs.filter(r => r.from === 'user' || r.from === 'ai').length;
        receivedMessages += msgs.filter(r => r.from === 'them').length;
      }
    });

    const journeyStats = {
      new_lead: contacts.filter(c => c.journey === 'new_lead').length,
      contacted: contacts.filter(c => c.journey === 'contacted').length,
      interested: contacts.filter(c => c.journey === 'interested').length,
      negotiation: contacts.filter(c => c.journey === 'negotiation').length,
      converted: contacts.filter(c => c.journey === 'converted').length,
      closed: contacts.filter(c => c.journey === 'closed').length,
    };

    // Daily stats for last 7 days
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayCampaigns = allCampaigns.filter(c => c.timestamp?.startsWith(dateStr));
      const dayMessages = dayCampaigns.reduce((sum, c) => sum + (c.results?.filter(r => r.from).length || 0), 0);
      
      dailyStats.push({
        date: dateStr,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        messages: dayMessages,
        conversations: dayCampaigns.length,
      });
    }

    const analytics = {
      totalConversations,
      activeChats,
      aiConversations,
      manualConversations,
      totalMessages,
      aiMessages,
      manualMessages,
      sentMessages,
      receivedMessages,
      responseRate: totalMessages > 0 ? Math.round((receivedMessages / Math.max(sentMessages, 1)) * 100) : 0,
      generatedLeads: contacts.filter(c => c.journey !== 'new_lead').length,
      convertedCustomers: contacts.filter(c => c.journey === 'converted').length,
      journeyStats,
      dailyStats,
      aiProviderStatus: (() => {
        const providers = loadJsonFile(path.join(__dirname, 'ai_providers.json'), []);
        if (providers.length === 0) return {};
        const status = {};
        providers.forEach((p, i) => {
          const key = i === 0 ? 'primary' : `backup${i}`;
          status[key] = p.apiKey ? 'configured' : 'not_configured';
        });
        return status;
      })()
    };
    
    res.json({ success: true, analytics });
  } catch (err) {
    console.error('Error loading analytics:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// --- AI Provider Management ---

app.get('/api/message-agent/ai-providers', (req, res) => {
  try {
    const providers = loadAiProviders();
    res.json({ success: true, providers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load AI providers' });
  }
});

app.post('/api/message-agent/ai-providers', (req, res) => {
  try {
    const { name, apiKey, provider, priority = 0 } = req.body;
    
    if (!name || !apiKey || !provider) {
      return res.status(400).json({ error: 'Name, API key, and provider required' });
    }
    
    const providers = loadAiProviders();
    
    if (providers.length >= 3) {
      return res.status(400).json({ error: 'Maximum 3 AI providers allowed' });
    }
    
    const newProvider = {
      id: crypto.randomUUID(),
      name,
      apiKey: Buffer.from(apiKey).toString('base64'), // Basic obfuscation
      provider,
      priority,
      enabled: true,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    
    providers.push(newProvider);
    providers.sort((a, b) => a.priority - b.priority);
    saveAiProviders(providers);
    
    res.json({ success: true, provider: { ...newProvider, apiKey: '***' } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add AI provider' });
  }
});

app.put('/api/message-agent/ai-providers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const providers = loadAiProviders();
    const index = providers.findIndex(p => p.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    if (updates.apiKey) {
      updates.apiKey = Buffer.from(updates.apiKey).toString('base64');
    }
    
    providers[index] = { ...providers[index], ...updates };
    providers.sort((a, b) => a.priority - b.priority);
    saveAiProviders(providers);
    
    res.json({ success: true, provider: { ...providers[index], apiKey: '***' } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update AI provider' });
  }
});

app.delete('/api/message-agent/ai-providers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const providers = loadAiProviders();
    const filtered = providers.filter(p => p.id !== id);
    
    if (filtered.length === providers.length) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    saveAiProviders(filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete AI provider' });
  }
});

// AI generate response endpoint
app.post('/api/message-agent/ai-generate', aiGenerateLimiter.middleware(), async (req, res) => {
  try {
    const { message, conversationHistory, contact, businessProfile } = req.body;
    
    const providers = loadAiProviders().filter(p => p.enabled);
    
    if (providers.length === 0) {
      return res.json({ 
        success: true, 
        response: generateFallbackResponse(message, conversationHistory, contact),
        provider: 'fallback',
        confidence: 0.5
      });
    }

    // Try providers in priority order
    for (const provider of providers) {
      try {
        const apiKey = Buffer.from(provider.apiKey, 'base64').toString('utf8');
        const response = await callAIProvider(provider.provider, apiKey, message, conversationHistory, contact, businessProfile);
        
        if (response) {
          return res.json({ 
            success: true, 
            response: response.text,
            provider: provider.name,
            confidence: response.confidence || 0.85
          });
        }
      } catch (err) {
        console.error(`AI provider ${provider.name} failed:`, err.message);
        continue; // Try next provider
      }
    }

    // All providers failed, use fallback
    res.json({ 
      success: true, 
      response: generateFallbackResponse(message, conversationHistory, contact),
      provider: 'fallback',
      confidence: 0.5
    });
  } catch (err) {
    console.error('Error generating AI response:', err);
    res.json({ 
      success: true, 
      response: generateFallbackResponse(req.body.message, req.body.conversationHistory, req.body.contact),
      provider: 'fallback',
      confidence: 0.5
    });
  }
});

// --- AI Provider Call Logic ---
// Bounded provider calls so a slow/unresponsive upstream never holds the send
// flow hostage (the UI shows "AI is thinking..." while awaiting this).
const AI_PROVIDER_TIMEOUT_MS = 30000;

function aiProviderFetch(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_PROVIDER_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function callAIProvider(providerType, apiKey, message, history, contact, businessProfile) {
  const historyText = (history || []).slice(-10).map(m => 
    `${m.from === 'me' ? 'Agent' : 'Customer'}: ${m.text}`
  ).join('\n');

  const systemPrompt = buildSystemPrompt(contact, businessProfile);
  const fullPrompt = `${systemPrompt}\n\nConversation history:\n${historyText}\n\nCustomer: ${message}\n\nAgent:`;

  // OpenAI API
  if (providerType === 'openai') {
    const response = await aiProviderFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history || []).slice(-10).map(m => ({
            role: m.from === 'me' ? 'assistant' : 'user',
            content: m.text
          })),
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data = await response.json();
    return { text: data.choices[0].message.content, confidence: 0.9 };
  }
  
  // Anthropic API
  if (providerType === 'anthropic') {
    const response = await aiProviderFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          ...(history || []).slice(-10).map(m => ({
            role: m.from === 'me' ? 'assistant' : 'user',
            content: m.text
          })),
          { role: 'user', content: message }
        ]
      })
    });
    
    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);
    const data = await response.json();
    return { text: data.content[0].text, confidence: 0.9 };
  }

  // Groq API
  if (providerType === 'groq') {
    const response = await aiProviderFetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history || []).slice(-10).map(m => ({
            role: m.from === 'me' ? 'assistant' : 'user',
            content: m.text
          })),
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
    const data = await response.json();
    return { text: data.choices[0].message.content, confidence: 0.85 };
  }

  // Together API
  if (providerType === 'together') {
    const response = await aiProviderFetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3-70b-chat-hf',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history || []).slice(-10).map(m => ({
            role: m.from === 'me' ? 'assistant' : 'user',
            content: m.text
          })),
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) throw new Error(`Together API error: ${response.status}`);
    const data = await response.json();
    return { text: data.choices[0].message.content, confidence: 0.85 };
  }

  // Mistral AI API
  if (providerType === 'mistral') {
    const response = await aiProviderFetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history || []).slice(-10).map(m => ({
            role: m.from === 'me' ? 'assistant' : 'user',
            content: m.text
          })),
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) throw new Error(`Mistral API error: ${response.status}`);
    const data = await response.json();
    return { text: data.choices[0].message.content, confidence: 0.85 };
  }

  // DeepSeek API (OpenAI-compatible)
  if (providerType === 'deepseek') {
    const response = await aiProviderFetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history || []).slice(-10).map(m => ({
            role: m.from === 'me' ? 'assistant' : 'user',
            content: m.text
          })),
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
    const data = await response.json();
    return { text: data.choices[0].message.content, confidence: 0.85 };
  }

  // OpenRouter (OpenAI-compatible, supports 100+ models)
  if (providerType === 'openrouter') {
    const response = await aiProviderFetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://whatsapp-shield.app',
        'X-Title': 'WhatsApp Shield'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-70b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history || []).slice(-10).map(m => ({
            role: m.from === 'me' ? 'assistant' : 'user',
            content: m.text
          })),
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) throw new Error(`OpenRouter API error: ${response.status}`);
    const data = await response.json();
    return { text: data.choices[0].message.content, confidence: 0.85 };
  }

  // OpenAI-compatible (generic fallback)
  if (providerType === 'openai-compatible') {
    const response = await aiProviderFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history || []).slice(-10).map(m => ({
            role: m.from === 'me' ? 'assistant' : 'user',
            content: m.text
          })),
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) throw new Error(`OpenAI-compatible API error: ${response.status}`);
    const data = await response.json();
    return { text: data.choices[0].message.content, confidence: 0.85 };
  }

  return null;
}

function buildSystemPrompt(contact, businessProfile) {
  const bp = businessProfile || {};
  return `You are a professional WhatsApp business communication agent for ${bp.companyName || 'our company'}.
${bp.description ? `About the business: ${bp.description}` : ''}

Your role:
- Respond professionally and courteously to customer messages
- Understand customer intent and provide helpful, relevant responses
- Maintain conversation context and reference previous messages when appropriate
- Adapt your communication style to match the customer's language and tone
- Avoid spam-like behavior - focus on trust and quality communication
- If you don't know something, acknowledge it honestly and offer alternatives
- Keep responses concise and natural, like a real person would write
- Never send identical duplicate messages
- Consider the customer's country and cultural context

${contact?.country ? `Customer's country: ${contact.country}` : ''}
${contact?.name ? `Customer's name: ${contact.name}` : ''}
${contact?.about ? `Customer's profile: ${contact.about}` : ''}

Respond naturally and professionally. Do not use overly formal language. Be helpful and solution-oriented.`;
}

function generateFallbackResponse(message, history, contact) {
  const lowerMsg = (message || '').toLowerCase();
  
  const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'salam', 'ola'];
  const thanks = ['thank', 'thanks', 'appreciate', 'grateful'];
  const questions = ['what', 'how', 'when', 'where', 'why', 'can you', 'could you', 'do you', 'is there'];
  const price = ['price', 'cost', 'how much', 'pricing', 'rate', 'fee'];
  const help = ['help', 'support', 'issue', 'problem', 'not working', 'error', 'trouble'];
  const goodbye = ['bye', 'goodbye', 'see you', 'later', 'take care'];

  if (greetings.some(g => lowerMsg.includes(g))) {
    const greetingResponses = [
      `Hello! Thank you for reaching out. How can I assist you today?`,
      `Hi there! Welcome. How may I help you?`,
      `Hello! Great to hear from you. What can I do for you today?`,
      `Hey! Thanks for contacting us. How can I help?`
    ];
    return greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
  }

  if (thanks.some(t => lowerMsg.includes(t))) {
    return `You're welcome! Is there anything else I can help you with?`;
  }

  if (price.some(p => lowerMsg.includes(p))) {
    return `Thank you for your interest! Could you tell me more about what you're looking for? I'd be happy to provide you with the right pricing information.`;
  }

  if (help.some(h => lowerMsg.includes(h))) {
    return `I understand you need assistance. Could you please describe the issue in more detail? I'll do my best to help resolve it for you.`;
  }

  if (goodbye.some(g => lowerMsg.includes(g))) {
    return `Thank you for chatting with us! Feel free to reach out anytime if you need assistance. Have a great day!`;
  }

  if (questions.some(q => lowerMsg.includes(q))) {
    return `That's a great question! Let me look into that for you. Could you provide a bit more detail so I can give you the most accurate information?`;
  }

  const defaultResponses = [
    `Thank you for your message. I'd be happy to help you with that. Could you provide more details so I can assist you better?`,
    `I appreciate you reaching out. Let me understand your needs better. What specifically are you looking for?`,
    `Thanks for contacting us! I'm here to help. Could you tell me more about what you need?`,
    `Got it! I understand your message. Let me help you with this. Could you share a bit more context?`
  ];
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// --- Business Profile ---
app.get('/api/message-agent/business-profile', (req, res) => {
  try {
    const profile = loadBusinessProfile();
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load business profile' });
  }
});

app.put('/api/message-agent/business-profile', (req, res) => {
  try {
    const profile = req.body;
    if (!profile) {
      return res.status(400).json({ error: 'Profile data required' });
    }
    profile.updatedAt = new Date().toISOString();
    saveBusinessProfile(profile);
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save business profile' });
  }
});

// --- Safety Settings ---
app.get('/api/message-agent/safety-settings', (req, res) => {
  try {
    const settings = loadSafetySettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load safety settings' });
  }
});

app.put('/api/message-agent/safety-settings', (req, res) => {
  try {
    const settings = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'Settings data required' });
    }
    const saved = saveSafetySettings(settings);
    if (saved) {
      res.json({ success: true, settings });
    } else {
      res.status(500).json({ error: 'Failed to save safety settings' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to save safety settings' });
  }
});

// --- Compliance Endpoints ---
app.get('/api/message-agent/compliance/stats', (req, res) => {
  try {
    res.json({ success: true, stats: complianceService.getStats() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get compliance stats' });
  }
});

app.get('/api/message-agent/compliance/check/:contactId', (req, res) => {
  try {
    const { contactId } = req.params;
    const contacts = loadContacts();
    const contact = contacts.find(c => c.id === contactId);
    const phone = contact ? contact.phone.replace(/\D/g, '') : '';
    const result = complianceService.canSendMessage(contactId, phone, contact);
    res.json({
      success: true,
      ...result,
      isBlocked: complianceService.isBlocked(contactId),
      isSuppressed: complianceService.isSuppressed(contactId)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check compliance' });
  }
});

app.post('/api/message-agent/compliance/block', (req, res) => {
  try {
    const { contactId, phone, reason } = req.body;
    if (!contactId) return res.status(400).json({ error: 'contactId required' });
    complianceService.blockContact(contactId, phone || '', reason || 'manual');
    // Also update contact's pipeline/status
    const contacts = loadContacts();
    const idx = contacts.findIndex(c => c.id === contactId);
    if (idx !== -1) {
      contacts[idx].blocked = true;
      contacts[idx].blockedAt = new Date().toISOString();
      contacts[idx].blockReason = reason || 'Manual block';
      contacts[idx].updatedAt = new Date().toISOString();
      saveContacts(contacts);
      broadcastAll({
        type: 'MESSAGE_AGENT_UPDATE',
        action: 'contact_blocked',
        contactId,
        contact: contacts[idx]
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block contact' });
  }
});

app.post('/api/message-agent/compliance/unblock', (req, res) => {
  try {
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ error: 'contactId required' });
    complianceService.unblockContact(contactId);
    const contacts = loadContacts();
    const idx = contacts.findIndex(c => c.id === contactId);
    if (idx !== -1) {
      delete contacts[idx].blocked;
      delete contacts[idx].blockedAt;
      delete contacts[idx].blockReason;
      contacts[idx].updatedAt = new Date().toISOString();
      saveContacts(contacts);
      broadcastAll({
        type: 'MESSAGE_AGENT_UPDATE',
        action: 'contact_unblocked',
        contactId,
        contact: contacts[idx]
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock contact' });
  }
});

app.get('/api/message-agent/compliance/suppression-list', (req, res) => {
  try {
    const contacts = loadContacts();
    const suppressed = contacts.filter(c => complianceService.isSuppressed(c.id));
    res.json({ success: true, suppressed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get suppression list' });
  }
});

// Safety check endpoint
app.post('/api/message-agent/safety-check', (req, res) => {
  try {
    const { phone, messageCount, lastMessageTime, contactId } = req.body;
    const settings = loadSafetySettings();
    
    if (!settings) {
      return res.json({ success: true, allowed: true, reason: 'No safety settings configured' });
    }

    // Add compliance check
    if (contactId) {
      const complianceCheck = complianceService.canSendMessage(contactId, (phone || '').replace(/\D/g, ''));
      if (!complianceCheck.allowed) {
        return res.json({ success: true, allowed: false, reason: complianceCheck.reason, code: complianceCheck.code, riskScore: 100 });
      }
    }

    const now = new Date();
    const checks = {
      allowed: true,
      reason: null,
      riskScore: 0,
      details: {}
    };

    // Check business hours
    if (settings.sessionSafety?.businessHoursOnly) {
      const hours = settings.sessionSafety.businessHours;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const startTime = hours.start.split(':').map(Number);
      const endTime = hours.end.split(':').map(Number);
      
      const isWithinHours = (
        currentHour > startTime[0] || 
        (currentHour === startTime[0] && currentMinute >= startTime[1])
      ) && (
        currentHour < endTime[0] || 
        (currentHour === endTime[0] && currentMinute < endTime[1])
      );
      
      checks.details.businessHours = isWithinHours;
      if (!isWithinHours) {
        checks.allowed = false;
        checks.reason = 'Outside business hours';
        checks.riskScore += 30;
      }
    }

    // Check rate limits
    if (settings.rateLimiting?.enabled && messageCount !== undefined) {
      if (messageCount >= settings.rateLimiting.maxPerDay) {
        checks.allowed = false;
        checks.reason = 'Daily message limit reached';
        checks.riskScore += 50;
      }
      checks.details.messageCount = messageCount;
    }

    checks.riskScore = Math.min(checks.riskScore, 100);
    
    res.json({ success: true, ...checks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to perform safety check' });
  }
});

// --- Enterprise Health Monitoring ---
app.get('/api/message-agent/health', (req, res) => {
  try {
    const health = healthMonitor.calculateAccountHealth();
    res.json({ success: true, health });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate health: ' + err.message });
  }
});

app.get('/api/message-agent/health/conversation/:phone', (req, res) => {
  try {
    const quality = healthMonitor.analyzeConversationQuality(req.params.phone);
    res.json({ success: true, quality });
  } catch (err) {
    res.status(500).json({ error: 'Failed to analyze conversation: ' + err.message });
  }
});

app.get('/api/message-agent/health/recommendations', (req, res) => {
  try {
    const recs = healthMonitor.getRecommendations();
    res.json({ success: true, ...recs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get recommendations: ' + err.message });
  }
});

app.get('/api/message-agent/health/auto-pause', (req, res) => {
  try {
    const pause = healthMonitor.checkAutoPause();
    res.json({ success: true, ...pause });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check auto-pause: ' + err.message });
  }
});

app.get('/api/message-agent/health/schedule', (req, res) => {
  try {
    const schedule = healthMonitor.getOutreachSchedule();
    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get schedule: ' + err.message });
  }
});

app.get('/api/message-agent/health/daily-report', (req, res) => {
  try {
    const report = healthMonitor.getDailyReport();
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get daily report: ' + err.message });
  }
});

// --- Conversation Intelligence ---
app.post('/api/message-agent/intelligence/analyze', async (req, res) => {
  try {
    const { text, context } = req.body;
    const analysis = await conversationIntelligence.analyzeMessage(text, context || {});
    res.json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ error: 'Failed to analyze message: ' + err.message });
  }
});

app.post('/api/message-agent/intelligence/lead-score', (req, res) => {
  try {
    const { conversationHistory, contact } = req.body;
    const score = conversationIntelligence.scoreLeadQuality(conversationHistory || [], contact || {});
    res.json({ success: true, score });
  } catch (err) {
    res.status(500).json({ error: 'Failed to score lead: ' + err.message });
  }
});

app.post('/api/message-agent/intelligence/next-action', (req, res) => {
  try {
    const { conversationState } = req.body;
    const action = conversationIntelligence.recommendNextAction(conversationState || {});
    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: 'Failed to recommend action: ' + err.message });
  }
});

app.post('/api/message-agent/intelligence/summary', (req, res) => {
  try {
    const { conversationHistory } = req.body;
    const summary = conversationIntelligence.generateSummary(conversationHistory || []);
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate summary: ' + err.message });
  }
});

app.post('/api/message-agent/intelligence/culture', (req, res) => {
  try {
    const { country, language } = req.body;
    const culture = conversationIntelligence.adaptForCulture(country, language);
    res.json({ success: true, culture });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get culture adaptation: ' + err.message });
  }
});

app.post('/api/message-agent/intelligence/check-optout', (req, res) => {
  try {
    const { message, contactId, phone } = req.body;
    const isOptOut = conversationIntelligence.checkOptOut(message);
    // Auto-suppress when opt-out detected with high confidence
    if (isOptOut.isOptOut && isOptOut.confidence >= 0.6) {
      const targetId = contactId || phone || '';
      if (targetId) {
        complianceService.addToSuppressionList(targetId, phone || '', 'auto_detected');
        console.log(`[COMPLIANCE] Auto-suppressed ${targetId} after opt-out detection`);
        // Also update contact record
        const contacts = loadContacts();
        const idx = contacts.findIndex(c => c.id === targetId || (c.phone || '').replace(/\D/g, '') === (phone || '').replace(/\D/g, ''));
        if (idx !== -1) {
          contacts[idx].optedOut = true;
          contacts[idx].updatedAt = new Date().toISOString();
          saveContacts(contacts);
          broadcastAll({
            type: 'MESSAGE_AGENT_UPDATE',
            action: 'contact_opted_out',
            contactId: contacts[idx].id,
            contact: contacts[idx]
          });
        }
      }
    }
    res.json({ success: true, isOptOut });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check opt-out: ' + err.message });
  }
});

// --- Template Management ---
app.get('/api/message-agent/templates', async (req, res) => {
  try {
    const { category } = req.query;
    const templates = await templateManager.getTemplates(category);
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load templates: ' + err.message });
  }
});

app.get('/api/message-agent/templates/categories', async (req, res) => {
  try {
    const categories = await templateManager.getTemplateCategories();
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load categories: ' + err.message });
  }
});

app.post('/api/message-agent/templates/recommend', async (req, res) => {
  try {
    const { conversationState } = req.body;
    const recommended = await templateManager.recommendTemplate(conversationState || {});
    res.json({ success: true, recommended });
  } catch (err) {
    res.status(500).json({ error: 'Failed to recommend template: ' + err.message });
  }
});

app.post('/api/message-agent/templates/personalize', async (req, res) => {
  try {
    const { templateId, contactData, businessProfile } = req.body;
    const personalized = await templateManager.personalizeTemplate(templateId, contactData || {}, businessProfile || {});
    res.json({ success: true, personalized });
  } catch (err) {
    res.status(500).json({ error: 'Failed to personalize template: ' + err.message });
  }
});

app.post('/api/message-agent/templates', async (req, res) => {
  try {
    const template = await templateManager.saveCustomTemplate(req.body);
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save template: ' + err.message });
  }
});

app.delete('/api/message-agent/templates/:id', async (req, res) => {
  try {
    await templateManager.deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template: ' + err.message });
  }
});

app.put('/api/message-agent/templates/:id', async (req, res) => {
  try {
    const template = await templateManager.updateTemplate(req.params.id, req.body);
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update template: ' + err.message });
  }
});

app.post('/api/message-agent/templates/:id/duplicate', async (req, res) => {
  try {
    const template = await templateManager.duplicateTemplate(req.params.id);
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ error: 'Failed to duplicate template: ' + err.message });
  }
});

app.post('/api/message-agent/templates/button-click', async (req, res) => {
  try {
    const { templateId, buttonActionTag, contactId, phone, metadata } = req.body;
    const result = await templateManager.processButtonClick(templateId, buttonActionTag, contactId, metadata);
    // Wire template opt-out to global ComplianceService
    if (buttonActionTag === 'BLACKLIST_OPTOUT' && contactId) {
      complianceService.addToSuppressionList(contactId, phone || '', 'template_optout');
      const contacts = loadContacts();
      const idx = contacts.findIndex(c => c.id === contactId);
      if (idx !== -1) {
        contacts[idx].optedOut = true;
        contacts[idx].updatedAt = new Date().toISOString();
        saveContacts(contacts);
        broadcastAll({
          type: 'MESSAGE_AGENT_UPDATE',
          action: 'contact_opted_out',
          contactId,
          contact: contacts[idx]
        });
      }
    }
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process button click: ' + err.message });
  }
});

app.get('/api/message-agent/templates/search', async (req, res) => {
  try {
    const { q } = req.query;
    const templates = await templateManager.searchTemplates(q || '');
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search templates: ' + err.message });
  }
});

app.post('/api/message-agent/templates/variations', async (req, res) => {
  try {
    const { template } = req.body;
    const variations = await templateManager.generateVariation(template);
    res.json({ success: true, variations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate variations: ' + err.message });
  }
});

// --- Static File Serving (Production) ---
const frontendDist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  
  // SPA catch-all — serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });
} else {
  console.log('Frontend dist not found. Running in API-only mode. Build frontend with: cd frontend && npm run build');
}

// Server-side WebSocket keep-alive ping (every 25s, independent from client pings)
setInterval(() => {
  const payload = JSON.stringify({ type: 'ping' });
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch (_) {}
    }
  });
}, 25000);

// --- Export for Vercel serverless ---
module.exports = app;

// --- Start Server (standalone) ---
if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`WhatsApp Shield server running on port ${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
  });
}
