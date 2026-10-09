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
const { RateLimiter, SingleFlight, sanitizeNumbers, clampDelay, clampJitter, effectiveDelayMs, longBreakMs, LONG_BREAK_EVERY } = require('./services/safety-guard');
const { validatePhoneNumber } = require('./services/number-validation');
const createCampaignService = require('./services/campaign-service');
const {
  redact,
  safeError,
  installProcessHandlers,
  CircuitBreaker,
  MemoryWatchdog,
  HealthRegistry,
} = require('./services/stability');
const { audit, rotate: rotateAuditLog } = require('./services/audit');
const { getSessionManager } = require('./services/sessionManager');
const { sanitizeForLog, sanitizeMessage, maskPhone } = require('./services/log-sanitizer');
const scanJournal = require('./services/scanJournal');
const aiManager = require('./services/ai/manager');
const aiCatalog = require('./services/ai/catalog');
const aiUsage = require('./services/ai/usage-store');
const { installDecryptLogFilter } = require('./services/decrypt-log-filter');
const {
  toContactIdentity,
  classifyIdentifier,
  isNonUserIdentifier,
} = require('./services/contact-identity');
const providerBoundary = require('./services/provider-boundary');
const { assertCanSend, PROVIDERS, resolveSendPolicy, detectOptOut, normalizeOptIn, isOptedOut } = providerBoundary;

// Collapse libsignal's repeated Bad MAC / decrypt-failure stack traces into a
// single rate-limited line. Installed before any socket work so the very first
// burst is already collapsed. Real errors pass through untouched.
installDecryptLogFilter({ intervalMs: Number(process.env.DECRYPT_LOG_INTERVAL_MS) || 60000 });

// Global error containment first — a stray rejection/exception must never take
// down the whole server (and with it every active session and user).
installProcessHandlers();

const healthRegistry = new HealthRegistry();

// --- Send gate (compliance) ---
// The server is READ-ONLY by default after login: nothing may be sent to
// WhatsApp until the user explicitly arms messaging AND confirms each send.
// This fails closed — any send that is not explicitly authorized is blocked.
const sendGate = {
  armed: false,
  armedAt: null,
};
const SEND_GATE_REASON = 'Messaging is disabled. Enable it explicitly before sending any message.';

// --- Shield auth gate (HTTP) ---
// The Message Agent CRM and its settings must only be reachable after a
// WhatsApp Shield (Baileys) login. This mirrors the WebSocket `isAuthenticated`
// state the frontend already uses. The Meta webhook stays public (verified by
// signature + verify token), so it is never wrapped with this middleware.
const SHIELD_AUTH_GRACE_MS = 20000;
let shieldAuthGraceUntil = 0;
const requireShieldAuth = (req, res, next) => {
  const live = whatsAppService.status === 'CONNECTED' && whatsAppService.userInfo;
  if (live) {
    // Refresh the grace window on every authenticated request so a brief
    // reconnect (status blips to CONNECTING/DISCONNECTED and back) does not
    // 403 requests that were already in flight during the blip.
    shieldAuthGraceUntil = Date.now() + SHIELD_AUTH_GRACE_MS;
    return next();
  }
  if (Date.now() < shieldAuthGraceUntil) return next();
  return res.status(403).json({
    success: false,
    error: 'Shield login required',
    code: 'SHIELD_AUTH_REQUIRED',
  });
};

// Rotate the audit log periodically so it stays disk-bounded.
rotateAuditLog();
setInterval(rotateAuditLog, 60 * 1000).unref();

// Phone number normalization - ensures numbers are in proper E.164 format for
// WhatsApp JID.
//
// A group (`120363...@g.us`), channel (`@newsletter`) or broadcast
// (`status@broadcast`) identifier is NOT a person. Previously the fallback
// stripped every non-digit, which turned those IDs into plausible-looking
// numbers and created fake CRM contacts. They now return '' and are rejected by
// every caller.
function normalizePhone(phone, defaultCountry) {
  if (!phone) return '';
  const raw = String(phone).trim();
  if (!raw) return '';

  const identity = toContactIdentity(raw);
  if (!identity) return '';
  const digits = identity.digits;

  // libphonenumber is the authority on the calling code; fall back to the
  // already-validated digits when it cannot parse (e.g. offline metadata).
  try {
    const parsed = parsePhoneNumber(digits, defaultCountry || null);
    if (parsed && parsed.isValid()) {
      return `${parsed.countryCallingCode}${parsed.nationalNumber}`;
    }
  } catch (e) {}

  let cleaned = digits;
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

// --- HTTP timeouts ---
// Bounds every connection so a stalled upstream or slow client can never hold a
// socket (or its memory) open forever. App-level routes also enforce their own
// timeouts where relevant (AI provider calls, WhatsApp lookups).
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 60000;
server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS) || 15000;
server.timeout = Number(process.env.SOCKET_TIMEOUT_MS) || 120000;
server.keepAliveTimeout = 5000;

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
// Capture the exact raw body for Meta webhook signature verification
// (X-Hub-Signature-256 is computed over the unmodified bytes). Other routes
// keep the normal JSON parsing below.
app.use('/api/meta/webhook', express.raw({ type: '*/*', limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// State-changing origin check: browser requests that change server/WhatsApp
// state must come from an allowlisted origin. Requests with no Origin header
// (CLI, same-origin, server-to-server) are allowed — matching the CORS policy.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    audit({ action: 'origin.rejected', outcome: 'blocked', code: 'CORS', ip: req.ip, origin, detail: `${req.method} ${req.path}` });
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  next();
});

// --- Rate Limiters (per-IP) ---
const SCAN_CIRCUIT_FAILURE_THRESHOLD = Number(process.env.SCAN_CIRCUIT_FAILURE_THRESHOLD) || 8;
const SCAN_CIRCUIT_RESET_MS = Number(process.env.SCAN_CIRCUIT_RESET_MS) || 120000;
const SCAN_CIRCUIT_HALF_OPEN_MS = Number(process.env.SCAN_CIRCUIT_HALF_OPEN_MS) || 15000;
const MAX_WS_CLIENTS = Number(process.env.MAX_WS_CLIENTS) || 25;
const MAX_WS_FRAME_BYTES = 1024 * 1024; // 1 MiB max frame
const bulkCheckLimiter = new RateLimiter({ windowMs: 60000, max: 5, name: 'bulk-check' });
const messageLimiter = new RateLimiter({ windowMs: 60000, max: 120, name: 'message-send' });
const aiGenerateLimiter = new RateLimiter({ windowMs: 60000, max: 60, name: 'ai-generate' });
const authActionLimiter = new RateLimiter({ windowMs: 60000, max: 10, name: 'auth-action' });
const profilePicLimiter = new RateLimiter({ windowMs: 60000, max: 120, name: 'profile-picture' });
const importBulkLimiter = new RateLimiter({ windowMs: 60000, max: 5, name: 'import-bulk' });
const wsControlLimiter = new RateLimiter({ windowMs: 60000, max: 300, name: 'ws-control' });

// --- Server-side request governance / circuit breaker ---
// A persistent, cross-scan circuit breaker. Unlike the per-scan anomaly stop
// (which resets on each new scan), this breaker survives across scans: if the
// linked account repeatedly fails hard (risk signals, session loss, anomalies),
// scan starts are refused until the breaker half-opens and a fresh probe
// succeeds. This implements the "fail closed under sustained abnormal error
// rates" requirement at the campaign level, not just within a single scan.
const scanCircuitBreaker = new CircuitBreaker({
  name: 'scan-upstream',
  failureThreshold: SCAN_CIRCUIT_FAILURE_THRESHOLD,
  resetMs: SCAN_CIRCUIT_RESET_MS,
  halfOpenMs: SCAN_CIRCUIT_HALF_OPEN_MS,
  onStateChange: (name, state, err) => {
    console.log(`[CIRCUIT] ${name} -> ${state}${state === 'open' ? ` (${String(err?.message || '')})` : ''}`);
    appendShieldLog('WARN', `Scan circuit breaker ${state}`, { name, state, error: err && safeError(err, false) });
  }
});

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
// contact still references that number. All campaign deletion and avatar-cache
// cleanup logic lives in ./services/campaign-service (constructed below once the
// data loaders exist) so History-page, Profile-page, and bulk deletions all use
// the same reliable, ownership-safe path.

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
  // Backfill names/country on every legacy record (idempotent) so pre-existing
  // campaigns are immediately correct instead of showing a default label.
  if (campaignHistoryCache.length > 0) {
    let enriched = false;
    campaignHistoryCache.forEach((c) => {
      if (enrichCampaignIdentity(c)) enriched = true;
    });
    // Persist the enriched names to disk once so legacy campaigns carry their
    // real country-based names across restarts (not just in memory).
    if (enriched) flushCampaignHistory();
  }
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

// Every campaign is given a stable, professional, user-facing name plus a short
// human-readable referral code (refId). New scans build the name from the real
// country detected from the numbers (or explicitly selected); legacy records
// are enriched on load/save so the History page never deals with a missing name
// or a hardcoded "United States" label. The unique `id` is always retained.
const CAMPAIGN_COUNTRY_NAMES = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AR: 'Argentina', AM: 'Armenia',
  AU: 'Australia', AT: 'Austria', AZ: 'Azerbaijan', BH: 'Bahrain', BD: 'Bangladesh',
  BY: 'Belarus', BE: 'Belgium', BJ: 'Benin', BO: 'Bolivia', BA: 'Bosnia and Herzegovina',
  BR: 'Brazil', BG: 'Bulgaria', BF: 'Burkina Faso', KH: 'Cambodia', CM: 'Cameroon',
  CA: 'Canada', CL: 'Chile', CN: 'China', CO: 'Colombia', CR: 'Costa Rica',
  CI: 'Côte d\u2019Ivoire', HR: 'Croatia', CU: 'Cuba', CY: 'Cyprus', CZ: 'Czechia',
  DK: 'Denmark', DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt', SV: 'El Salvador',
  EE: 'Estonia', ET: 'Ethiopia', FI: 'Finland', FR: 'France', GE: 'Georgia',
  DE: 'Germany', GH: 'Ghana', GR: 'Greece', GT: 'Guatemala', HN: 'Honduras',
  HK: 'Hong Kong', HU: 'Hungary', IN: 'India', ID: 'Indonesia', IR: 'Iran',
  IQ: 'Iraq', IE: 'Ireland', IL: 'Israel', IT: 'Italy', JP: 'Japan',
  JO: 'Jordan', KZ: 'Kazakhstan', KE: 'Kenya', KR: 'South Korea', KW: 'Kuwait',
  KG: 'Kyrgyzstan', LA: 'Laos', LV: 'Latvia', LB: 'Lebanon', LY: 'Libya',
  LT: 'Lithuania', LU: 'Luxembourg', MY: 'Malaysia', MT: 'Malta', MX: 'Mexico',
  MD: 'Moldova', MN: 'Mongolia', MA: 'Morocco', MM: 'Myanmar', NP: 'Nepal',
  NL: 'Netherlands', NZ: 'New Zealand', NI: 'Nicaragua', NG: 'Nigeria', MK: 'North Macedonia',
  NO: 'Norway', OM: 'Oman', PK: 'Pakistan', PA: 'Panama', PE: 'Peru',
  PH: 'Philippines', PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RO: 'Romania',
  RU: 'Russia', SA: 'Saudi Arabia', RS: 'Serbia', SG: 'Singapore', SK: 'Slovakia',
  SI: 'Slovenia', ZA: 'South Africa', ES: 'Spain', LK: 'Sri Lanka', SD: 'Sudan',
  SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan', TJ: 'Tajikistan',
  TZ: 'Tanzania', TH: 'Thailand', TN: 'Tunisia', TR: 'Turkey', TM: 'Turkmenistan',
  UG: 'Uganda', UA: 'Ukraine', AE: 'United Arab Emirates', GB: 'United Kingdom',
  US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan', VE: 'Venezuela', VN: 'Vietnam',
  YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe'
};
const toCampaignCountryName = (iso) => {
  if (!iso) return null;
  return CAMPAIGN_COUNTRY_NAMES[String(iso).toUpperCase()] || null;
};

// The country that actually represents a campaign's dataset: the dominant
// dialing country detected by libphonenumber across its results.
const dominantIsoFromResults = (results) => {
  const counts = {};
  if (!Array.isArray(results)) return null;
  for (const r of results) {
    if (r && r.detectedCountry) {
      const iso = String(r.detectedCountry).toUpperCase();
      counts[iso] = (counts[iso] || 0) + 1;
    }
  }
  let best = null;
  let bestCount = 0;
  for (const [iso, count] of Object.entries(counts)) {
    if (count > bestCount) { best = iso; bestCount = count; }
  }
  return best;
};

const campaignIdShort = (id) => String(id || '').replace(/[^a-f0-9]/gi, '').slice(0, 8).toUpperCase() || 'N/A';
// Campaign names are intentionally date-free: run date/time is stored separately
// on the campaign (timestamp) and rendered by the UI as its own piece of
// information (with relative age like "5 minutes ago"). The name is just the
// human-friendly audience label so it stays short and timeless in lists/exports.
const buildCampaignIdentity = (countryName, countryIso, ts, id, regionName) => {
  const idShort = campaignIdShort(id);
  const label = countryName || toCampaignCountryName(countryIso) || (countryIso ? String(countryIso).toUpperCase() : 'International');
  // Region-Wise runs get the state in the title so a History list of several
  // states is instantly scannable. Runs without a state keep the plain label,
  // which is also what every pre-migration record already shows.
  const scope = regionName ? `${label} · ${regionName}` : label;
  return {
    name: `${scope} Audience Scan`,
    refId: idShort,
  };
};
const enrichCampaignIdentity = (c) => {
  if (!c || typeof c !== 'object') return false;
  let changed = false;
  if (!c.countryIso) {
    const iso = dominantIsoFromResults(c.results) || null;
    if (iso && iso !== c.countryIso) { c.countryIso = iso; changed = true; }
  }
  if (!c.countryName) {
    const name = c.countryIso ? (toCampaignCountryName(c.countryIso) || c.countryIso) : null;
    if (name && name !== c.countryName) { c.countryName = name; changed = true; }
  }
  if (!c.name || !c.refId) {
    const built = buildCampaignIdentity(c.countryName, c.countryIso, c.timestamp, c.id);
    if (built.name && built.name !== c.name) { c.name = built.name; changed = true; }
    if (built.refId && built.refId !== c.refId) { c.refId = built.refId; changed = true; }
  }
  // --- Forward-compatible migration for records written before the
  // region/jitter/audience-type fields existed. Old runs are backfilled with
  // nulls (no state was recorded, so none is invented) rather than being
  // dropped, and the title gains the state suffix only when one is known.
  if (!('regionName' in c)) { c.regionName = null; changed = true; }
  if (!('regionPrefix' in c)) { c.regionPrefix = null; changed = true; }
  if (!('audienceType' in c)) {
    // Historical runs predate the audience-type flag. 'manual' is the honest
    // default: those lists were pasted or uploaded, not generated.
    c.audienceType = 'manual';
    changed = true;
  }
  if (typeof c.jitterPct !== 'number' || !Number.isFinite(c.jitterPct)) {
    // Older runs always used the hardcoded +/-50% band.
    c.jitterPct = c.shieldMode === false ? 0 : 50;
    changed = true;
  }
  return changed;
};

const saveCampaignHistory = (data) => {
  const list = Array.isArray(data) ? data : [];
  if (list.length > 0) list.forEach(enrichCampaignIdentity);
  campaignHistoryCache = list;
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
  refreshKnownNumbers();
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
    // Deferred to the graceful shutdown routine (defined at module bottom):
    // flush pending writes, close WebSockets, then exit cleanly.
    if (typeof gracefulShutdown === 'function') {
      gracefulShutdown(sig);
    } else {
      flushCampaignHistory();
      process.exit(0);
    }
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
const secureRedact = (p) => ({ ...p, apiKey: p.apiKey ? '••••••••••' : '' });

// --- Business Profile ---
const loadBusinessProfile = () => loadJsonFile(BUSINESS_PROFILE_FILE, {});
const saveBusinessProfile = (profile) => saveJsonFile(BUSINESS_PROFILE_FILE, profile);

// --- Contacts ---
const loadContacts = () => loadJsonFile(CONTACTS_FILE, []);
const saveContacts = (contacts) => {
  const ok = saveJsonFile(CONTACTS_FILE, contacts);
  if (ok) refreshKnownNumbers();
  return ok;
};

// --- Authorized numbers for avatar serving ---
// The profile-picture endpoint only performs on-demand WhatsApp lookups for
// numbers that reached this server through the user's own campaigns, contacts,
// or scan jobs ("known" numbers). Arbitrary numbers are never probed — the
// endpoint serves cached bytes for previously-authorized numbers and 404s for
// everything else, so it cannot be used as an existence oracle for random
// numbers.
const knownNumbers = new Set();
function refreshKnownNumbers() {
  knownNumbers.clear();
  try {
    for (const c of loadCampaignHistory()) {
      const ownerNum = String(c.phone || '').replace(/\D/g, '');
      if (ownerNum) knownNumbers.add(ownerNum);
      if (Array.isArray(c.results)) {
        for (const r of c.results) {
          const n = String(r.number || r.formatted || '').replace(/\D/g, '');
          if (n) knownNumbers.add(n);
        }
      }
    }
  } catch (_) {}
  try {
    for (const c of loadContacts()) {
      const n = String(c.phone || '').replace(/\D/g, '');
      if (n) knownNumbers.add(n);
    }
  } catch (_) {}
}
refreshKnownNumbers();

// --- Recorded public profile-picture URLs ---
// Index of the last publicly-available pps.whatsapp.net picture URL recorded by
// the app's own authorized session (from campaign results and contacts). Used by
// /api/profile-picture as a graceful fallback when the live WhatsApp lookup is
// transiently unavailable or the session is offline: the recorded URL is fetched
// directly and its bytes preserved in the cache. Only URLs produced by
// profilePictureUrl (always pps.whatsapp.net, always public-only) are ever stored,
// so no arbitrary or private media can be resolved through this index.
const recordedAvatarUrls = new Map(); // phone digits -> public pps URL
const recordAvatarUrl = (phone, url) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || !url || typeof url !== 'string') return;
  if (!/^https:\/\/pps\.whatsapp\.net\//.test(url)) return;
  recordedAvatarUrls.set(digits, url);
};
const indexRecordedAvatarUrls = () => {
  recordedAvatarUrls.clear();
  (loadCampaignHistory() || []).forEach((c) => {
    (c.results || []).forEach((r) => {
      if (r.avatar && r.cleanNumber) recordAvatarUrl(r.cleanNumber, r.avatar);
    });
  });
  (loadContacts() || []).forEach((ct) => {
    if (ct.avatar) recordAvatarUrl(ct.phone || ct.number || ct.id || '', ct.avatar);
  });
};
indexRecordedAvatarUrls();

// --- Centralized Campaign Deletion / Resource Cleanup ---
// Single service shared by every campaign-deletion path (History page, Profile
// page, Step-5 reports, "clear all shield contacts"). It owns the ownership-safe
// removal of campaigns from history AND the safe cleanup of campaign-owned
// cached profile pictures.
const campaignService = createCampaignService({
  loadCampaignHistory,
  saveCampaignHistory,
  flushCampaignHistoryNow: flushCampaignHistory,
  loadContacts,
  saveContacts,
  profilePicCache,
  profilePicCachePath,
  profilePicInFlight,
  recordedAvatarUrls,
});

// Reset every session-scoped in-memory cache. Passed to
// sessionManager.clearSessionData so a logout / history deletion leaves no
// stale data resident in the running process (idempotent, safe to call twice).
function clearInMemoryState() {
  try { profilePicCache.clear(); } catch (_) {}
  try { profilePicInFlight.clear(); } catch (_) {}
  try { recordedAvatarUrls.clear(); } catch (_) {}
  try { scanJournal.clearActiveScan && scanJournal.clearActiveScan(); } catch (_) {}
}

// Helper for clearSessionData at logout/delete sites.
async function clearSessionData(options = {}) {
  const mgr = whatsAppService.sessionManager || getSessionManager();
  return mgr.clearSessionData(whatsAppService.sessionId || 'default', {
    clearInMemory: clearInMemoryState,
    ...options,
  });
}

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

// Campaigns and contacts saved before owner tagging existed carry no
// ownerPhone. They belong to the session that created them, so adopt them
// lazily instead of hiding them — this is what made "Import from WhatsApp
// Shield" show 0 contacts for a user with real saved campaign results.
const adoptUntagged = (record) => {
  const owner = sessionOwnerPhone();
  if (!owner) return record;
  if (!record.ownerPhone) {
    record.ownerPhone = owner;
    record.ownerAdoptedAt = new Date().toISOString();
    return record; // signal: needs persisting
  }
  return record;
};

const campaignsForSession = (campaigns) => {
  const owner = sessionOwnerPhone();
  let adopted = false;
  const out = [];
  for (const campaign of campaigns || []) {
    if (!campaign.ownerPhone && owner) {
      adoptUntagged(campaign);
      adopted = true;
      out.push(campaign);
      continue;
    }
    if (belongsToSession(campaign)) out.push(campaign);
  }
  if (adopted) {
    try { saveCampaignHistory(campaigns); } catch (e) { /* best effort */ }
  }
  return out;
};
const contactsForSession = (contacts) => {
  const owner = sessionOwnerPhone();
  let adopted = false;
  const out = [];
  for (const contact of contacts || []) {
    if (!contact.ownerPhone && owner) {
      adoptUntagged(contact);
      adopted = true;
      out.push(contact);
      continue;
    }
    if (belongsToSession(contact)) out.push(contact);
  }
  if (adopted) {
    try { saveContacts(contacts); } catch (e) { /* best effort */ }
  }
  return out;
};

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
const wsLock = { value: false }; // single-flight guard for broadcast+heartbeat

function broadcast(message, excludeWs = null) {
  // Single-flight: only one broadcast at a time so we don't flood the event loop
  if (wsLock.value) return;
  wsLock.value = true;
  const payload = JSON.stringify(message);
  const next = () => { wsLock.value = false; };
  clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload, { binary: false }, next);
    }
  });
  // In case some WS are already closed, still clear the lock
  setTimeout(next, 10);
}

function broadcastAll(message) {
  // Single-flight guard
  if (wsLock.value) return;
  wsLock.value = true;
  const payload = JSON.stringify(message);
  const next = () => { wsLock.value = false; };
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      // Bounded socket buffer backpressure: if a client's OS buffer is already
      // full (slow consumer), drop non-critical events for it instead of letting
      // an unbounded backlog inflate memory. Terminal/authoritative events
      // (START/PROGRESS/COMPLETE/STOPPED/INTERRUPTED) travel on the reconnect
      // snapshot path, so losing a transient update is safe.
      if (typeof ws.bufferedAmount === 'number' && ws.bufferedAmount > 1024 * 1024) {
        return;
      }
      try {
        ws.send(payload);
      } catch (_) {}
    }
  });
  // In case some WS are already closed, still clear the lock
  setTimeout(next, 10);
}

// --- Shield-gateway log rotation ---
// Logs are written to backend/logs/shield-gateway.log via SessionManager.
// Rotate once it exceeds a cap, keep a bounded number of generations, and prune
// anything older than a few days so disk usage can never grow without bound.
const SHIELD_LOG_PATHS = [
  path.join(__dirname, 'logs', 'shield-gateway.log'),
];
const SHIELD_LOG_MAX_BYTES = Number(process.env.SHIELD_LOG_MAX_BYTES) || 8 * 1024 * 1024;
const SHIELD_LOG_MAX_FILES = Number(process.env.SHIELD_LOG_MAX_FILES) || 5;
const SHIELD_LOG_MAX_AGE_DAYS = Number(process.env.SHIELD_LOG_MAX_AGE_DAYS) || 7;

const rotateShieldLogs = () => {
  for (const filePath of SHIELD_LOG_PATHS) {
    try {
      const mgr = whatsAppService.sessionManager || getSessionManager();
      const res = mgr.rotateLogFile(filePath, {
        maxBytes: SHIELD_LOG_MAX_BYTES,
        maxFiles: SHIELD_LOG_MAX_FILES,
        maxAgeDays: SHIELD_LOG_MAX_AGE_DAYS,
      });
      if (res.rotated) {
        console.log(`[LOG_ROTATE] ${filePath} rotated (keep ${SHIELD_LOG_MAX_FILES}, max age ${SHIELD_LOG_MAX_AGE_DAYS}d)`);
      }
      if (res.pruned.length) {
        console.log(`[LOG_ROTATE] pruned ${res.pruned.length} old log file(s) for ${path.basename(filePath)}`);
      }
    } catch (err) {
      console.error('Failed to rotate shield-gateway.log:', err.message);
    }
  }
};
rotateShieldLogs();
setInterval(rotateShieldLogs, 60 * 1000).unref();

// --- WebSocket liveness ---
//
// This used to be TWO competing sweeps: a 30s one that terminated any socket
// that had not sent an app-level message in the last window (it sent no ping of
// its own), plus a 25s protocol-ping sweep that ALSO cleared `isAlive` but had
// no 'pong' listener to ever set it back to true. A client pinging every 30s
// against 25s and 30s checkers with no pong acknowledgement is a coin-flip: the
// healthy socket was terminated roughly once a minute, which is exactly the
// repeated "Backend is offline ... Reconnected to active validation: 48/500"
// cycle seen during scans.
//
// The single sweep below is the standard pattern: ping on a 30s cadence, only
// close after 3 consecutive misses (~90s), and acknowledge via the protocol
// 'pong' event (registered on the socket in the connection handler).
const KEEPALIVE_INTERVAL_MS = 30000;
const KEEPALIVE_MISSES_BEFORE_CLOSE = 3;
setInterval(() => {
  const payload = JSON.stringify({ type: 'ping' });
  const now = Date.now();
  clients.forEach(ws => {
    if (ws.readyState !== WebSocket.OPEN) {
      clients.delete(ws);
      return;
    }
    if (ws.isAlive === false) {
      ws.heartbeatMisses = (ws.heartbeatMisses || 0) + 1;
      if (ws.heartbeatMisses >= KEEPALIVE_MISSES_BEFORE_CLOSE) {
        try { ws.terminate(); } catch (_) {}
        clients.delete(ws);
        appendShieldLog('WARN', 'Terminated WebSocket client after missing heartbeat', { misses: ws.heartbeatMisses, remaining: clients.size });
        return;
      }
      // Still within the grace window: re-ping rather than closing outright.
      // App-level clients (the browser) also get a JSON ping they understand.
      try { ws.send(payload); } catch (_) {}
      return;
    }
    ws.heartbeatMisses = 0;
    ws.isAlive = false;
    ws.lastPingAt = now;
    try { ws.send(payload); } catch (_) {}
    try { ws.ping(); } catch (_) {}
  });
}, KEEPALIVE_INTERVAL_MS).unref();

// Per-session scan safeguard (no-unlimited mode): each unique linked session may
// only validate up to SCAN_DAILY_CAP numbers per rolling 24h window / SCAN_MINUTE_CAP
// per minute. These are hard server-side floors that protect a real WhatsApp
// account from self-inflicted damage even if the UI is bypassed. The per-minute
// ceiling intentionally stays generous (WhatsApp-side pacing already throttles
// harder in whatsapp.js) so a legit session is never needlessly frozen.
const SCAN_DAILY_CAP = Number(process.env.WA_SCAN_DAILY_CAP) || 3000;
const SCAN_MINUTE_CAP = Number(process.env.WA_SCAN_MINUTE_CAP) || 180;
const SCAN_BACKOFF_BASE_MS = 4000;   // exponentially grows on consecutive errors
const SCAN_BACKOFF_MAX_MS = 30000;   // hard ceiling for the backoff pause
const SCAN_CONSECUTIVE_ANOMALY = 5;  // consecutive failures => anomaly path

// Rolling usage windows keyed by session owner phone (or 'anonymous').
const __scanUsage = new Map();

function getScanUsage(ownerPhone) {
  const key = String(ownerPhone || 'anonymous');
  let entry = __scanUsage.get(key);
  if (!entry) {
    entry = { minute: [], day: [] };
    __scanUsage.set(key, entry);
  }
  const now = Date.now();
  entry.minute = entry.minute.filter(t => now - t < 60000);
  entry.day = entry.day.filter(t => now - t < 24 * 60 * 60 * 1000);
  return entry;
}

// Records a newly processed number against the session and enforces the caps.
// Returns { ok:boolean, code, waitMs } — ok=false means the caller must stop
// (daily cap exhausted) or wait waitMs (minute cap reached).
function checkScanCap(ownerPhone) {
  const entry = getScanUsage(ownerPhone);
  if (entry.day.length >= SCAN_DAILY_CAP) {
    return { ok: false, code: 'DAILY_CAP', waitMs: 0 };
  }
  if (entry.minute.length >= SCAN_MINUTE_CAP) {
    const oldest = entry.minute[0];
    return { ok: false, code: 'MINUTE_CAP', waitMs: Math.max(0, oldest - Date.now() + 60000) };
  }
  return { ok: true, code: null, waitMs: 0 };
}

// Called once per successfully processed number inside the scan loop to charge
// the session's usage window (respecting combined per-minute + daily caps).
//
// The per-minute wait is COOPERATIVELY cancellable: it uses the same pause-aware
// pausableDelay as the rest of the loop, so a Pause or Stop takes effect during
// a rate-limit wait instead of freezing the worker for up to 60s. If the job is
// stopped while waiting, this throws a SCAN_STOPPED error which the scan loop's
// catch path treats as a clean exit (never recording a fake failed number).
async function chargeScanUsage(ownerPhone) {
  const entry = getScanUsage(ownerPhone);
  if (entry.minute.length >= SCAN_MINUTE_CAP) {
    const oldest = entry.minute[0];
    const waitMs = Math.max(0, oldest - Date.now() + 60000);
    await pausableDelay(waitMs);
    if (bulkCheckJob.stopped) {
      const e = new Error('Scan stopped while waiting for safety throttle.');
      e.code = 'SCAN_STOPPED';
      throw e;
    }
    getScanUsage(ownerPhone); // re-prune after the wait
  }
  const now = Date.now();
  const entry2 = getScanUsage(ownerPhone);
  entry2.minute.push(now);
  entry2.day.push(now);
}

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
  validTotal: 0, // numbers actually dispatched to WhatsApp (total - invalidCount)
  invalidCount: 0, // numbers refused by the pre-scan validation gate
  cursor: -1, // authoritative 0-based position of the last processed number
  currentNumber: null, // number currently being checked (for mid-scan resume snapshots)
  results: [],
  stopped: false, // set by stopBulkCheck(); the loop checks it at every checkpoint
  cooldownUntil: null, // Date.now() ms when the current shield cooldown/backoff ends (null when not in a pause)
  cooldownMessage: null, // human-readable text for the active cooldown pause
  consecutiveNetErrors: 0, // consecutive connectivity-type errors (drives auto-resume backoff)
  // Idempotency guard: the jobId whose finalization has already run. Finalization
  // can be re-entered (resume path, defensive retry, transport-driven reconcile),
  // and it MUST NOT produce a second campaign record / report for the same scan.
  finalizedJobId: null,
};

// Snapshot of the most recently finished scan, retained AFTER `active` flips to
// false.
//
// This is what makes completion recoverable. The terminal WS event
// (BULK_CHECK_COMPLETE) is delivered exactly once; if the socket dropped, the
// tab was backgrounded, or the client reconnected at the wrong moment, that
// event is gone forever and /api/scan-status used to answer a bare
// { active:false, state:'IDLE' } — leaving a client that had already seen
// 11/11 results stuck on "Scanning" with no way to ever finish. The client now
// polls /api/scan-status and can read this snapshot to run the same completion
// flow exactly once.
const lastCompletedScan = {
  jobId: null,
  campaign: null,
  resultsCount: 0,
  registered: 0,
  unregistered: 0,
  invalid: 0,
  total: 0,
  status: null, // 'COMPLETED' | 'STOPPED'
  at: null,
};

// Clear the completion snapshot when a new scan starts, so a fresh scan's
// results are never confused with a previous campaign's.
function resetLastCompletedScan() {
  lastCompletedScan.jobId = null;
  lastCompletedScan.campaign = null;
  lastCompletedScan.resultsCount = 0;
  lastCompletedScan.registered = 0;
  lastCompletedScan.unregistered = 0;
  lastCompletedScan.invalid = 0;
  lastCompletedScan.total = 0;
  lastCompletedScan.status = null;
  lastCompletedScan.at = null;
}

// --- Duplicate scan-submission guard (idempotency) ---
// A client that double-submits the exact same batch twice (double-click, retry
// loop, reconnect echo) must not start two scans back-to-back. We remember the
// hash of the last submitted batch and refuse an identical re-submission until
// it ages out of the dedup window.
const lastScanHash = { value: null, at: 0 };
const SCAN_DEDUP_MS = 30000;

function computeScanHash(numbers) {
  const key = Array.isArray(numbers) ? numbers.slice(0, 10000).join('|') : '';
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

// Returns null when a scan start is allowed, or an error reason string when the
// exact same batch was just submitted and is still inside the dedup window.
function guardDuplicateScanStart(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return null;
  const hash = computeScanHash(numbers);
  if (lastScanHash.value === hash && Date.now() - lastScanHash.at < SCAN_DEDUP_MS) {
    return 'This exact batch was just submitted. Duplicate scan skipped.';
  }
  lastScanHash.value = hash;
  lastScanHash.at = Date.now();
  return null;
}

// Pause / Resume / Stop are pure in-memory control-plane operations: they flip
// the job state, tell the scan loop to yield, and broadcast an ack. They must
// NEVER touch the WhatsApp socket, must never await, and must be idempotent so a
// double-click or a replayed frame cannot corrupt the job. Wrapped so a failure
// here can never take the process (or the live session) down.
function pauseBulkCheck() {
  try {
    if (!bulkCheckJob.active) return;
    if (bulkCheckJob.state !== 'SCANNING' && bulkCheckJob.state !== 'STARTING' && bulkCheckJob.state !== 'RESUMING') return;
    bulkCheckJob.state = 'PAUSED';
    bulkCheckJob.cooldownUntil = null;
    bulkCheckJob.cooldownMessage = null;
    broadcastAll({
      type: 'BULK_CHECK_PAUSED',
      jobId: bulkCheckJob.id,
      cursor: bulkCheckJob.cursor,
      total: bulkCheckJob.total,
      processed: bulkCheckJob.results.length
    });
  } catch (err) {
    appendShieldLog('ERROR', `Pause failed: ${err.message}`, { jobId: bulkCheckJob.id });
  }
}

function resumeBulkCheck() {
  try {
    if (!bulkCheckJob.active) return;
    if (bulkCheckJob.state !== 'PAUSED') return;
    bulkCheckJob.state = 'RESUMING';
    broadcastAll({ type: 'BULK_CHECK_RESUMING', jobId: bulkCheckJob.id });
    // Definitively flip to SCANNING a short moment later and BROADCAST it so the
    // frontend is never left stuck in the transient RESUMING state waiting for a
    // progress event that may not arrive promptly (e.g. a long cooldown follows
    // the resume). Every client derives a definitive "SCANNING" from this ack.
    setTimeout(() => {
      try {
        if (bulkCheckJob.state === 'RESUMING') {
          bulkCheckJob.state = 'SCANNING';
          broadcastAll({ type: 'BULK_CHECK_RESUMED', jobId: bulkCheckJob.id, cursor: bulkCheckJob.cursor, total: bulkCheckJob.total, processed: bulkCheckJob.results.length });
        }
      } catch (err) {
        appendShieldLog('ERROR', `Resume ack failed: ${err.message}`, { jobId: bulkCheckJob.id });
      }
    }, 300).unref?.();
  } catch (err) {
    appendShieldLog('ERROR', `Resume failed: ${err.message}`, { jobId: bulkCheckJob.id });
  }
}

function stopBulkCheck(reason) {
  try {
    bulkCheckJob.stopped = true;
    // Wake any pause waiter so the loop finalizes promptly.
    if (bulkCheckJob.state === 'PAUSED' || bulkCheckJob.state === 'RESUMING' || bulkCheckJob.state === 'STARTING') {
      bulkCheckJob.state = 'SCANNING';
    }
    if (reason) {
      appendShieldLog('INFO', `Scan stop requested: ${reason}`, { jobId: bulkCheckJob.id });
    }
  } catch (err) {
    appendShieldLog('ERROR', `Stop failed: ${err.message}`, { jobId: bulkCheckJob.id });
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

// Non-blocking log queue: all shield-gateway writes are serialized through a
// promise chain so they never call appendFileSync on the main thread, which
// would block the event loop and cause Baileys WebSocket ping timeouts.
let _shieldLogChain = Promise.resolve();
const SHIELD_LOG_FILE = path.join(__dirname, 'logs', 'shield-gateway.log');
function appendShieldLog(level, message, data) {
  const entry = { timestamp: new Date().toISOString(), level, message: sanitizeMessage(message) };
  if (data !== undefined && data !== null) entry.data = sanitizeForLog(data);
  const line = JSON.stringify(entry) + '\n';
  // Fire-and-forget: chain the async write so they are ordered but never block.
  _shieldLogChain = _shieldLogChain
    .then(() => fs.promises.appendFile(SHIELD_LOG_FILE, line, 'utf8'))
    .catch(err => console.error('Failed to write to shield-gateway.log:', err));
}

// Shared bulk-check engine — the single authoritative scan implementation.
// Both the WS (start_bulk_check) and REST (/api/check-bulk) entry points funnel
// into here so pause/resume/stop, progress, and lifecycle are identical no
// matter how the job was started. Callers hold bulkCheckLock while this runs.
async function runBulkCheck({ numbers, numberMetadata, phone, countryCode, delayMs, shieldMode, jitter, countryIso, countryName, regionName, regionPrefix, audienceType, restored = null }) {
  const sanitized = sanitizeNumbers(numbers, 10000);
  if (sanitized.length === 0) {
    broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', reason: 'No valid numbers provided' });
    return;
  }

  // ---- PRE-SCAN VALIDATION GATE -------------------------------------------
  // Every number is re-validated here, before a single WhatsApp lookup, using
  // the same authority the lookup itself uses. Invalid entries are reported as
  // "Invalid" (so they reach logs, counters, reports and exports) and are NEVER
  // dispatched to WhatsApp - no onWhatsApp call, no rate-limit slot, no spend.
  //
  // This is what stops a malformed number such as +92310000023 (9 national
  // digits for a country that requires 10) from being looked up and reported as
  // "Not registered".
  // The pre-scan gate deliberately does NOT force a single country: a pasted
  // list may legitimately mix countries, and each number is validated against
  // its OWN country's length rules by libphonenumber. When the campaign's target
  // country disagrees with some entries we surface that as a warning instead of
  // silently dropping the user's data.
  const scanMeta = numberMetadata || {};
  const preflight = sanitized.map((raw) => {
    const meta = scanMeta[raw] || scanMeta[String(raw).replace(/\D/g, '')] || {};
    const verdict = validatePhoneNumber(raw, {
      countryCallingCode: countryCode,
      allowFixedLine: true,
    });
    return { raw, meta, verdict };
  });

  const dispatchable = preflight.filter((p) => p.verdict.valid).map((p) => p.verdict.e164);
  const rejected = preflight.filter((p) => !p.verdict.valid);

  // Numbers that are perfectly valid but belong to a country other than the
  // campaign target. Reported, never blocked.
  const offTarget = countryIso
    ? preflight.filter((p) => p.verdict.valid && p.verdict.country && String(p.verdict.country).toUpperCase() !== String(countryIso).toUpperCase())
    : [];

  if (dispatchable.length === 0) {
    broadcastAll({
      type: 'BULK_CHECK_INTERRUPTED',
      reason: `None of the ${sanitized.length} numbers are valid phone numbers for ${countryName || countryIso || 'the selected country'}. Nothing was sent to WhatsApp.`,
    });
    appendShieldLog('ERROR', `Scan refused: all ${sanitized.length} numbers failed format validation. Nothing was sent to WhatsApp.`, {
      jobId: null,
      total: sanitized.length,
      invalid: rejected.length,
      reasons: rejected.slice(0, 5).map((r) => `${r.raw}: ${r.verdict.reason}`),
    });
    audit({ action: 'scan.blocked', outcome: 'blocked', code: 'ALL_INVALID', detail: `${rejected.length} numbers failed validation` });
    return;
  }

  if (offTarget.length) {
    appendShieldLog('WARN', `Pre-scan validation: ${offTarget.length} valid numbers belong to a country other than ${countryName || countryIso}. They will still be checked.`, {
      jobId: null,
      count: offTarget.length,
      target: countryIso,
      samples: offTarget.slice(0, 5).map((r) => `${r.raw}: ${r.verdict.country}`),
    });
  }

  if (rejected.length) {
    appendShieldLog('WARN', `Pre-scan validation: ${rejected.length} of ${sanitized.length} numbers are invalid and will NOT be sent to WhatsApp.`, {
      jobId: null,
      total: sanitized.length,
      valid: dispatchable.length,
      invalid: rejected.length,
      reasons: rejected.slice(0, 5).map((r) => `${r.raw}: ${r.verdict.reason}`),
    });
    broadcastAll({
      type: 'BULK_CHECK_INVALID_INPUT',
      total: sanitized.length,
      valid: dispatchable.length,
      invalid: rejected.length,
      samples: rejected.slice(0, 5).map((r) => ({ number: r.raw, reason: r.verdict.reason })),
    });
  }

  // Persistent circuit breaker: refuse to start when the upstream has been
  // repeatedly failing across scans (fail closed) so a campaign can never
  // hammer a degraded session back-to-back scan after scan.
  if (!scanCircuitBreaker.isAvailable) {
    broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', reason: 'Scan safety circuit is open from repeated failures. Please wait a few minutes before retrying.' });
    audit({ action: 'scan.blocked', outcome: 'blocked', code: 'CIRCUIT_OPEN', detail: `${sanitized.length} numbers requested` });
    return;
  }

  if (whatsAppService.status !== 'CONNECTED' || !whatsAppService.sock) {
    // A non-connected session is an upstream unavailability signal — count it
    // toward the circuit so rapid scan starts against a dead session trip the
    // breaker instead of looping forever.
    scanCircuitBreaker.recordFailure(new Error('WhatsApp not connected'));
    broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', reason: 'WhatsApp is not connected. Please link your device first.' });
    return;
  }

  const jobId = crypto.randomUUID();
  bulkCheckJob.active = true;
  bulkCheckJob.id = jobId;
  bulkCheckJob.state = 'STARTING';
  // A new job re-arms the single-shot finalization guard and clears the previous
  // completion snapshot, so this scan can never be mistaken for the previous one.
  bulkCheckJob.finalizedJobId = null;
  resetLastCompletedScan();
  // `total` is the FULL number of entries the user submitted (valid + invalid).
  // It is the denominator of the UI progress bar and of the Processed counter,
  // so it must include the pre-scan rejects - otherwise the bar stalls at
  // "valid/valid" and never reaches 100%, and "Processed" permanently disagrees
  // with the result rows on screen.
  // `validTotal` is the number of numbers actually dispatched to WhatsApp, and
  // is the denominator for lookup progress and the per-lookup "n/validTotal" log
  // lines.
  bulkCheckJob.total = sanitized.length;
  bulkCheckJob.validTotal = dispatchable.length;
  bulkCheckJob.cursor = -1;
  bulkCheckJob.invalidCount = rejected.length;
  bulkCheckJob.results = [];
  bulkCheckJob.stopped = false;
  bulkCheckJob.consecutiveNetErrors = 0;

  // --- Crash-durable scan state ---------------------------------------------
  // Persist the job identity + full queue (atomic replace) BEFORE any lookup, so
  // a restart at 0% is still recoverable. Results are then appended to the
  // journal as they complete, which is what lets a restart resume at the exact
  // index instead of losing every processed row.
  //
  // `restored` is set when this run continues a scan that was interrupted by a
  // backend restart: the already-processed results are re-seeded and the loop
  // starts at the first number that was never looked up.
  if (!restored) {
    scanJournal.writeMeta({
      jobId,
      startedAt: new Date().toISOString(),
      numbers: sanitized,
      dispatchable,
      settings: {
        numberMetadata: numberMetadata || null,
        phone: phone || '',
        countryCode: countryCode || null,
        delayMs: delayMs == null ? null : Number(delayMs),
        shieldMode: shieldMode !== false,
        jitter: jitter == null ? null : Number(jitter),
        countryIso: countryIso || null,
        countryName: countryName || null,
        regionName: regionName || null,
        regionPrefix: regionPrefix || null,
        audienceType: audienceType || null,
      },
    }).catch(() => {});
  }

  // Invalid numbers are seeded as authoritative results BEFORE the scan starts
  // so they are visible in the log, the counters, the Validation Summary, the
  // reports and every export - indistinguishable in shape from a scanned row,
  // and flagged with isValidFormat:false / exists:null.
  const invalidSeedResults = rejected.map((r) => ({
    ...r.meta,
    number: r.verdict.e164 || `+${r.verdict.digits || String(r.raw).replace(/\D/g, '')}`,
    cleanNumber: r.verdict.digits || String(r.raw).replace(/\D/g, ''),
    formatted: r.verdict.e164 || String(r.raw),
    isValidFormat: false,
    invalidReason: r.verdict.reason,
    detectedCountry: r.verdict.country || r.meta.country || null,
    exists: null,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    verifiedName: null,
    error: null,
    skippedLookup: true,
  }));
  if (invalidSeedResults.length && !restored) {
    invalidSeedResults.forEach((seedRow) => {
      // `bulkCheckJob.results` is the one authoritative array; seed into it
      // directly so counters, the resume snapshot and reports all include them.
      bulkCheckJob.results.push(seedRow);
      appendShieldLog('WARN', `Invalid number skipped (${seedRow.invalidReason}): ${seedRow.formatted}`, {
        jobId, number: seedRow.formatted, reason: seedRow.invalidReason,
      });
    });
    // Journal the invalid rows too, so a restart re-seeds them exactly once.
    // They use negative indexes: they are not loop positions.
    scanJournal.appendResults(invalidSeedResults.map((row, n) => ({ i: -1 - n, v: row })));
  }

  // --- Re-seed a scan that survived a backend restart -----------------------
  // Every already-processed row (valid results AND invalid rows) is restored
  // verbatim - photos, country, state, verdicts - and the loop restarts at the
  // first number that was never looked up. Nothing already paid for is redone
  // and nothing already displayed is lost.
  let startIndex = 0;
  if (restored && Array.isArray(restored.results) && restored.results.length) {
    for (const row of restored.results) {
      if (row && typeof row === 'object') bulkCheckJob.results.push(row);
    }
    startIndex = Number.isInteger(restored.cursor) && restored.cursor >= 0 ? restored.cursor + 1 : 0;
    bulkCheckJob.cursor = startIndex - 1;
    appendShieldLog('INFO', `Restored interrupted scan at ${bulkCheckJob.results.length}/${sanitized.length}. Continuing from index ${startIndex}.`, { jobId, startIndex, restored: bulkCheckJob.results.length });
    broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', jobId, reason: `Backend restarted mid-scan. Restored ${bulkCheckJob.results.length} of ${sanitized.length} processed results and continuing automatically.` });
  }

  // BULK_CHECK_START must be the FIRST event of the job.
  //
  // The client resets its result map on a genuine (non-resume) start, so any
  // event delivered before this one is discarded. It also uses `index` as a
  // monotonic "last processed lookup" guard and drops any row whose index is
  // not greater than the last one seen - which is why invalid rows are shipped
  // INSIDE this event instead of as synthetic progress events (an `index: -1`
  // progress row would be silently dropped, and would also rewind the guard).
  // Every tab therefore learns about the skipped numbers from one payload and
  // they occupy their final position in the results list from the very first
  // frame.
  broadcastAll({
    type: 'BULK_CHECK_START',
    jobId,
    total: sanitized.length,
    validTotal: dispatchable.length,
    invalidCount: rejected.length,
    // A restored scan keeps every row already processed across the restart, so
    // clients must MERGE this snapshot instead of resetting their result map.
    // Its invalid rows are already inside `results` (journaled pre-scan), so
    // they are not re-sent here.
    invalidResults: restored ? [] : invalidSeedResults,
    resume: Boolean(restored),
    processedCount: bulkCheckJob.results.length,
    results: restored ? bulkCheckJob.results.slice() : undefined,
  });
  appendShieldLog('INFO', `Starting validation of ${dispatchable.length} numbers${rejected.length ? ` (${rejected.length} invalid, skipped)` : ''}`, { jobId, count: dispatchable.length, invalid: rejected.length, phone, countryCode, delayMs, shieldMode });
  audit({ action: 'scan.start', outcome: 'ok', phone: (phone || '').replace(/\D/g, '') || null, code: shieldMode ? 'SHIELD' : 'FAST', detail: `${dispatchable.length} numbers looked up, ${rejected.length} invalid skipped` });

  // CRITICAL: `bulkCheckJob.results` is THE authoritative results array. Every
  // completed number (success or error) is pushed into it below, and it is what
  // the mid-scan reconnect snapshot (BULK_CHECK_START resume:true), the
  // pause/resume broadcasts, and GET /api/scan-status all report. There must be
  // exactly ONE array so all tabs and the UI reconcile to the same Processed /
  // Registered / Current values. `results` is just an alias to it.
  const results = bulkCheckJob.results;
  const isShieldMode = shieldMode !== false;
  const baseDelay = clampDelay(delayMs, isShieldMode);
  // Jitter is a percentage (0-100) coming from the Safety step. It is
  // re-validated server-side (clampJitter) so a tampered client cannot widen
  // the randomization band beyond +/-100% of the base delay.
  //
  // 0 is honoured literally: the Safety step's slider is specified as 0-100%
  // and its delay-range/ETA helpers compute from the same value, so silently
  // substituting a 5% floor here would make the UI promise a fixed interval
  // while the server randomized one. The anti-pattern risk of a perfectly even
  // rhythm is instead surfaced to the user as a high predictability score in
  // the Safety Meter, which is where the choice can actually be made.
  const jitterFraction = isShieldMode ? clampJitter(jitter) : 0;
  const runAudienceType = audienceType === 'region' || audienceType === 'random' || audienceType === 'sequential'
    ? audienceType
    : 'manual';
  const runRegionName = regionName ? String(regionName).slice(0, 80) : null;
  const runRegionPrefix = regionPrefix ? String(regionPrefix).replace(/[^\d+]/g, '').slice(0, 8) : null;

  // Per-session safety: refuse to start when the daily scan cap for this linked
  // account is already exhausted (no-unlimited mode). The cap is still checked
  // live inside the loop (chargeScanUsage) so a long scan can never overshoot it.
  const owner = sessionOwnerPhone() || (phone || '').replace(/\D/g, '') || 'anonymous';
  const preCap = checkScanCap(owner);
  if (preCap && preCap.ok === false && preCap.code === 'DAILY_CAP') {
    broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', jobId, reason: `Daily validation limit for this session reached (${SCAN_DAILY_CAP} numbers / 24h). Come back tomorrow or wait for the window to reset.` });
    audit({ action: 'scan.blocked', outcome: 'blocked', phone: owner || null, code: 'DAILY_CAP', detail: `${dispatchable.length} numbers requested` });
    bulkCheckJob.active = false;
    return;
  }

  // Failure backoff state: consecutive failures escalate how long we wait before
  // the next check, and past a threshold trigger a hard anomaly stop.
  let consecutiveFailures = 0;

  for (let i = startIndex; i < dispatchable.length; i++) {
    if (bulkCheckJob.stopped) break;

    // Pause / resume / stop checkpoint — no number is checked while PAUSED.
    const proceed = await waitIfPausedOrStopped();
    if (!proceed) break;

    // Enforce the per-minute + per-day session caps before each check; chargeScan
    // waits out the minute window when needed and rejects beyond the daily cap.
    const cap = checkScanCap(owner);
    if (cap.ok === false) {
      if (cap.code === 'DAILY_CAP') {
        broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', jobId, reason: `Daily validation limit for this session reached (${SCAN_DAILY_CAP} numbers / 24h). Scan stopped.` });
        audit({ action: 'scan.blocked', outcome: 'blocked', phone: owner || null, code: 'DAILY_CAP', detail: `${i + 1}/${dispatchable.length} processed` });
        bulkCheckJob.stopped = true;
        break;
      }
      // MINUTE_CAP — pause briefly so we never burst past the per-minute floor.
      appendShieldLog('WARN', `Scan throttled by per-minute cap (${SCAN_MINUTE_CAP}/min); pausing ${Math.ceil(cap.waitMs / 1000)}s`, { jobId, index: i, waitMs: cap.waitMs });
      await pausableDelay(cap.waitMs);
      if (bulkCheckJob.stopped) break;
    }

    const num = dispatchable[i];
    const cleanNum = num.replace(/\D/g, '');
    // The number was reached through the user's own authorized scan, so it is
    // now "known" for avatar serving (and never before the scan starts).
    if (cleanNum) knownNumbers.add(cleanNum);
    bulkCheckJob.state = 'SCANNING';
    bulkCheckJob.cursor = i;
    bulkCheckJob.currentNumber = num;
    // The cooldown window ended — a fresh check is running. Clear it so any
    // reconciling tab no longer shows "cooling down".
    bulkCheckJob.cooldownUntil = null;
    bulkCheckJob.cooldownMessage = null;

    // Push the in-flight number to clients BEFORE the (potentially slow) WhatsApp
    // lookup so the Live Scan updates the "Current Number" the instant a check
    // starts, instead of leaving the previous number on screen for seconds while
    // onWhatsApp/profile/business queries run. The authoritative result still
    // arrives via BULK_CHECK_PROGRESS when the check finishes.
    broadcastAll({
      type: 'BULK_CHECK_PROCESSING',
      jobId,
      index: i,
      total: sanitized.length,
      validTotal: dispatchable.length,
      number: num,
      cleanNumber: cleanNum
    });

    try {
      // `allowFixedLine` mirrors the pre-scan gate exactly. If the two policies
      // disagreed, a number could be admitted as dispatchable and then be
      // re-rejected here as a format error, which would double-report it and
      // spend a lookup slot on a number the gate already accepted.
      const result = await whatsAppService.checkNumber(num, {
        shouldStop: () => !!bulkCheckJob.stopped,
        allowFixedLine: true,
      });
      consecutiveFailures = 0; // a clean lookup resets the failure streak
      bulkCheckJob.consecutiveNetErrors = 0; // connectivity recovered
      scanCircuitBreaker.recordSuccess(); // a clean upstream response closes/keeps the circuit
      const numMeta = (numberMetadata && (numberMetadata[cleanNum] || numberMetadata[num])) || {};
      const parsed = {
        ...numMeta,
        ...result,
        formatted: result.formatted || `+${cleanNum}`,
        detectedCountry: result.detectedCountry || numMeta.country || null,
        regionName: numMeta.regionName || result.regionName || (runRegionName ? runRegionName : null),
        regionPrefix: numMeta.prefix || result.regionPrefix || (runRegionPrefix ? runRegionPrefix : null),
        regionId: numMeta.regionId || null
      };
      results.push(parsed);
      scanJournal.appendResult(i, parsed);
      broadcastAll({ type: 'BULK_CHECK_PROGRESS', jobId, index: i, total: sanitized.length, validTotal: dispatchable.length, result: parsed });
      // Throttled progress logging: one line every 25 lookups (plus the final
      // one) instead of one line per number. A per-number line produced a
      // multi-megabyte log for a single 10k scan and embedded phone numbers.
      const LOG_EVERY_N = 25;
      if ((i + 1) % LOG_EVERY_N === 0 || (i + 1) === dispatchable.length) {
        appendShieldLog('INFO', `Validating number ${i + 1}/${dispatchable.length} (exists: ${result.exists})`, { jobId, index: i, total: dispatchable.length, exists: result.exists });
      }
      // Charge the session usage window AFTER a successful lookup so the
      // per-minute/per-day caps are enforced even across multiple scans.
      await chargeScanUsage(owner);
    } catch (err) {
      // Cooperative cancellation raised from inside the pacing waits: exit
      // cleanly without recording the number as a failed lookup.
      if (err && err.code === 'SCAN_STOPPED') {
        bulkCheckJob.stopped = true;
        break;
      }
      // Fail-fast on risk signals: account-level responses (blocked, restricted,
      // rate-limited, unauthorized, session replaced) mean continuing would be
      // unsafe or non-compliant. Stop hard instead of pushing through the rest.
      const riskSignal = /blocked|restricted|rate\s*limit|too\s*many\s*request|suspended|banned?\b|unauthori[sz]ed|forbidden|connection\s*replaced/i.test(err.message || '');
      if (riskSignal) {
        bulkCheckJob.stopped = true;
        scanCircuitBreaker.recordFailure(err); // account-level risk => feed the persistent circuit
        appendShieldLog('ERROR', `Risk signal (${err.message}). Stopping scan to protect the session.`, { jobId, index: i });
        broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', jobId, reason: 'WhatsApp signaled a risk (blocked / rate-limited). Scan stopped to protect the session. All completed results are preserved.' });
        audit({ action: 'scan.risk_signal', outcome: 'stopped', code: 'RISK_SIGNAL', detail: `${err.message} at ${i + 1}/${dispatchable.length}` });
        break;
      }
      consecutiveFailures += 1;
      // Connectivity vs hard-failure classification. A temporary network /
      // gateway / timeout error (the machine lost internet, WhatsApp's servers
      // were briefly unreachable) must NOT be recorded as a fake "Not Registered"
      // result and must NOT count toward the hard anomaly stop. Instead we keep
      // the exact same position, back off, and retry the same number — automatic
      // resume when connectivity returns, with zero state loss. Only genuine
      // per-number failures (invalid format, WhatsApp says "number not found" in a
      // stable way) become error rows below.
      const isConnectivityError = /timed\s*out|timeout|network|fetch\s*failed|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket|closed|refused|reset/i.test(err.message || '');
      if (isConnectivityError) {
        bulkCheckJob.consecutiveNetErrors = (bulkCheckJob.consecutiveNetErrors || 0) + 1;
        const netBackoffMs = Math.min(30000, 3000 * Math.pow(2, Math.min(bulkCheckJob.consecutiveNetErrors, 4) - 1));
        bulkCheckJob.cooldownUntil = Date.now() + netBackoffMs;
        bulkCheckJob.cooldownMessage = `Internet / WhatsApp gateway unreachable — validation is paused and will auto-resume. Retrying in ${Math.ceil(netBackoffMs / 1000)}s.`;
        broadcastAll({
          type: 'BULK_CHECK_COOLDOWN',
          jobId,
          message: bulkCheckJob.cooldownMessage,
          timeLeft: Math.ceil(netBackoffMs / 1000),
          cooldownUntil: bulkCheckJob.cooldownUntil,
          connectivityPaused: true
        });
        appendShieldLog('WARN', `[Live Scan] Internet connection / gateway lost — validation paused at ${i + 1}/${dispatchable.length}. Will retry same number.`, { jobId, index: i, netBackoffMs, consecutiveNetErrors: bulkCheckJob.consecutiveNetErrors });
        await pausableDelay(netBackoffMs);
        if (bulkCheckJob.stopped) break;
        // Keep `i` unchanged so the SAME number is retried from the preserved
        // position — nothing is lost, nothing is duplicated, nothing is marked
        // invalid because the connection blipped.
        consecutiveFailures = Math.max(0, consecutiveFailures - 1);
        i -= 1;
        continue;
      }
      bulkCheckJob.consecutiveNetErrors = 0;
      const errorResult = {
        number: num,
        formatted: `+${cleanNum}`,
        exists: false,
        isValidFormat: false,
        error: err.message
      };
      results.push(errorResult);
      scanJournal.appendResult(i, errorResult);
      broadcastAll({ type: 'BULK_CHECK_PROGRESS', jobId, index: i, total: sanitized.length, validTotal: dispatchable.length, result: errorResult });
      appendShieldLog('ERROR', `Error validating number ${i + 1}/${dispatchable.length}: ${num} - ${err.message}`, { jobId, index: i, total: dispatchable.length, error: err.message });
      // If the WhatsApp session itself was lost mid-scan, stop instead of
      // burning through every remaining number with fake errors. Partial
      // results are preserved and the session auto-restores on the backend.
      if (whatsAppService.status !== 'CONNECTED' || /not connected/i.test(err.message)) {
        bulkCheckJob.stopped = true;
        scanCircuitBreaker.recordFailure(err); // session loss mid-scan => feed the persistent circuit
        broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', jobId, reason: 'WhatsApp session was lost mid-scan. All completed results are preserved.' });
        audit({ action: 'scan.session_lost', outcome: 'stopped', code: 'SESSION_LOST', detail: `${i + 1}/${dispatchable.length} processed` });
        break;
      }
      // Anomaly detection: a run of consecutive per-number failures suggests
      // something is wrong upstream (e.g. the session is degraded or the pipeline
      // is being throttled hard). Fail safe — hard-stop instead of hammering.
      if (consecutiveFailures >= SCAN_CONSECUTIVE_ANOMALY) {
        bulkCheckJob.stopped = true;
        scanCircuitBreaker.recordFailure(err); // sustained anomaly streak => feed the persistent circuit
        appendShieldLog('ERROR', `Anomaly: ${consecutiveFailures} consecutive failures. Stopping scan to protect the session.`, { jobId, index: i, consecutiveFailures });
        broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', jobId, reason: `Too many consecutive failures (${consecutiveFailures}). Scan stopped to protect your account. All completed results are preserved.` });
        audit({ action: 'scan.anomaly', outcome: 'stopped', phone: owner || null, code: 'ANOMALY', detail: `${consecutiveFailures} consecutive failures at ${i + 1}/${dispatchable.length}` });
        break;
      }
    }

    if (i < dispatchable.length - 1) {
      // Base inter-check delay. Shield mode randomizes it inside
      // baseDelay +/- jitter% (jitter comes from the Safety step and is
      // re-validated server-side); fast mode keeps a hard floor so bursts stay
      // impossible even without the shield. effectiveDelayMs() is the single
      // source of truth shared with the ETA estimator.
      const delay = effectiveDelayMs(baseDelay, jitterFraction, isShieldMode);

      // Shield cooldown every 10 checks: a real extended pause, not just a
      // notification. This is what the Safety step's ETA accounts for.
      let cooldownMs = 0;
      if (isShieldMode && i > 0 && i % 10 === 0) {
        cooldownMs = 5000;
        const timeLeft = Math.ceil((delay + cooldownMs) / 1000);
        bulkCheckJob.cooldownUntil = Date.now() + (delay + cooldownMs);
        bulkCheckJob.cooldownMessage = `Shield cooldown: pausing ${timeLeft}s after ${i} checks`;
        broadcastAll({
          type: 'BULK_CHECK_COOLDOWN',
          jobId,
          message: bulkCheckJob.cooldownMessage,
          timeLeft,
          cooldownUntil: bulkCheckJob.cooldownUntil
        });
      }

      // Extended randomized rest break every 100 checks. A long campaign must
      // not hold one perfectly steady rhythm for its whole duration - a
      // sustained machine-like cadence is exactly what detection looks for.
      // The break is deliberately randomized (20-45s) so it cannot be
      // fingerprinted either.
      if (isShieldMode && i > 0 && i % LONG_BREAK_EVERY === 0) {
        const longMs = longBreakMs();
        const timeLeft = Math.ceil((delay + cooldownMs + longMs) / 1000);
        bulkCheckJob.cooldownUntil = Date.now() + (delay + cooldownMs + longMs);
        bulkCheckJob.cooldownMessage = `Long rest break after ${i} checks: pausing ${timeLeft}s to cool the session down`;
        appendShieldLog('WARN', `Long rest break triggered at check ${i}/${dispatchable.length}: ${Math.round(longMs / 1000)}s randomized rest.`, { jobId, index: i, longBreakMs: longMs });
        broadcastAll({
          type: 'BULK_CHECK_COOLDOWN',
          jobId,
          message: bulkCheckJob.cooldownMessage,
          timeLeft,
          cooldownUntil: bulkCheckJob.cooldownUntil,
          longBreak: true
        });
        cooldownMs += longMs;
      }

      // Failure backoff: after every error, scale the pause up (4s, 8s, 16s...)
      // so a failing pipeline self-throttles instead of hammering WhatsApp.
      let backoffMs = 0;
      if (consecutiveFailures > 0) {
        backoffMs = Math.min(SCAN_BACKOFF_MAX_MS, SCAN_BACKOFF_BASE_MS * Math.pow(2, Math.min(consecutiveFailures, 6) - 1));
      }

      if (backoffMs > 0) {
        const timeLeft = Math.ceil((delay + backoffMs) / 1000);
        bulkCheckJob.cooldownUntil = Date.now() + (delay + backoffMs);
        bulkCheckJob.cooldownMessage = `Recovering after ${consecutiveFailures} error(s): pausing ${timeLeft}s`;
        broadcastAll({
          type: 'BULK_CHECK_COOLDOWN',
          jobId,
          message: bulkCheckJob.cooldownMessage,
          timeLeft,
          cooldownUntil: bulkCheckJob.cooldownUntil
        });
      }

      await pausableDelay(delay + cooldownMs + backoffMs);
    }
  }

  const stopped = bulkCheckJob.stopped;
  const registeredCount = results.filter(r => r.exists).length;
  const unregisteredCount = results.filter(r => !r.exists && r.isValidFormat).length;
  const invalidCount = results.filter(r => !r.isValidFormat).length;

  // ---- IDEMPOTENT FINALIZATION ------------------------------------------------
  // A scan can legitimately arrive here more than once: the resume path re-enters
  // the engine, and a transport-driven reconcile can re-trigger the tail. The
  // jobId guard makes the campaign record, the terminal event and the completion
  // snapshot single-shot, so a reconnect can never produce a duplicate report.
  if (bulkCheckJob.finalizedJobId === jobId) {
    appendShieldLog('WARN', `Ignoring repeated finalization for an already-finished scan.`, { jobId });
    return;
  }
  bulkCheckJob.finalizedJobId = jobId;
  bulkCheckJob.state = stopped ? 'STOPPED' : 'COMPLETED';

  // The scan is now durably represented by a campaign/history record, so the
  // crash journal has served its purpose. Clearing it here means a later restart
  // never resurrects a finished job.
  scanJournal.clearActiveScan().catch(() => {});

  const nowIso = new Date().toISOString();
  const campaignId = crypto.randomUUID();
  // The campaign's country always reflects the actual dataset: use the caller's
  // reported country when present, otherwise fall back to the dominant country
  // detected from the scanned numbers — never a hardcoded default.
  const resolvedIso = (countryIso || dominantIsoFromResults(results) || null);
  const resolvedName = (countryName || toCampaignCountryName(resolvedIso) || (resolvedIso ? resolvedIso : null));

  const campaign = {
    id: campaignId,
    // The scan this campaign was produced by. Lets a client that finalized from
    // a status snapshot (or its own processed>=total safety net, which fires
    // before this record is written) identify the saved campaign unambiguously
    // once it arrives in campaign history.
    jobId,
    timestamp: nowIso,
    phone: (phone || '').replace(/\D/g, ''),
    ownerPhone: sessionOwnerPhone(),
    contactName: null,
    countryCode: countryCode || 'Unknown',
    countryIso: resolvedIso,
    countryName: resolvedName,
    // Region / state scope for Region-Wise scans, so History, the Report page
    // and every export can show "United States · New Jersey · +1 201".
    // Null for manual/random/sequential audiences, which have no single state.
    regionName: runRegionName,
    regionPrefix: runRegionPrefix,
    audienceType: runAudienceType,
    ...buildCampaignIdentity(resolvedName, resolvedIso, nowIso, campaignId, runRegionName),
    totalChecked: results.length,
    registeredCount,
    unregisteredCount,
    invalidCount,
    aiMode: 'manual',
    results,
    shieldMode: isShieldMode,
    delayMs: baseDelay,
    jitterPct: Math.round(jitterFraction * 100),
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
      validTotal: dispatchable.length,
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

  // Retain the completion snapshot so a client that missed the one-shot
  // terminal event (socket drop, backgrounded tab, page refresh) can still run
  // the completion flow exactly once via GET /api/scan-status.
  lastCompletedScan.jobId = jobId;
  lastCompletedScan.campaign = campaign;
  lastCompletedScan.resultsCount = results.length;
  lastCompletedScan.registered = registeredCount;
  lastCompletedScan.unregistered = unregisteredCount;
  lastCompletedScan.invalid = invalidCount;
  lastCompletedScan.total = sanitized.length;
  lastCompletedScan.status = stopped ? 'STOPPED' : 'COMPLETED';
  lastCompletedScan.at = nowIso;

  bulkCheckJob.active = false;
  bulkCheckJob.currentNumber = null;
}

// --- WhatsApp Service Integration ---
// --- Interrupted-scan recovery ---------------------------------------------
// A backend restart (crash, uncaught exception, manual restart, machine reboot)
// used to destroy the running scan outright. The journal in backend/scan-state
// makes it recoverable instead: on boot we replay it and re-enter the SAME scan
// engine at the exact index it stopped at, so counters, leads, photos, reports
// and history all survive.
let _restoreAttempted = false;

async function restoreInterruptedScan() {
  if (_restoreAttempted) return;
  let snapshot;
  try {
    snapshot = scanJournal.readActiveScan();
  } catch (err) {
    appendShieldLog('ERROR', `Could not read the interrupted-scan journal: ${err.message}`, {});
    return;
  }
  if (!snapshot || !snapshot.meta || !Array.isArray(snapshot.meta.numbers) || snapshot.meta.numbers.length === 0) return;
  _restoreAttempted = true;

  const { meta, results, cursor } = snapshot;
  const total = meta.numbers.length;
  const processed = results.length;
  const processedLoop = Math.max(cursor + 1, 0);
  const dispatchableCount = Array.isArray(meta.dispatchable) ? meta.dispatchable.length : total;

  appendShieldLog('INFO', `Found an interrupted scan from ${meta.startedAt || 'a previous session'}: ${processed}/${total} results durably saved (cursor ${cursor}). Restoring it.`, { jobId: meta.jobId, processed, total });

  // Auto-resume is only safe with a live, connected WhatsApp session: lookups
  // would otherwise all fail and burn the remaining queue as fake errors.
  if (whatsAppService.status !== 'CONNECTED') {
    broadcastAll({
      type: 'BULK_CHECK_INTERRUPTED',
      jobId: meta.jobId,
      reason: `Backend restarted mid-scan. ${processed} of ${total} results were recovered and are safe. Reconnect WhatsApp and press Resume to continue.`,
    });
    return;
  }

  if (!bulkCheckLock.tryAcquire()) {
    appendShieldLog('WARN', 'Interrupted scan found but another bulk check holds the lock; leaving the journal in place.', { jobId: meta.jobId });
    return;
  }

  try {
    await runBulkCheck({
      ...meta.settings,
      numbers: meta.numbers,
      restored: { results, cursor },
    });
  } catch (err) {
    bulkCheckLock.release();
    appendShieldLog('ERROR', `Failed to resume the interrupted scan: ${err.message}`, { jobId: meta.jobId });
    broadcastAll({ type: 'BULK_CHECK_INTERRUPTED', jobId: meta.jobId, reason: `Could not resume the interrupted scan: ${err.message}. ${processed}/${total} results are still saved.` });
  }
  // On success the lock is released by the normal finalization path in
  // runBulkCheck's caller; release defensively if that path did not run.
  if (!bulkCheckJob.active) {
    try { bulkCheckLock.release(); } catch (_) { /* already released */ }
  }
}

// Re-attempt recovery whenever the session becomes usable. This is what makes
// a restore that was waiting on WhatsApp finish on its own.
whatsAppService.init((statusData) => {
  broadcastAll({ type: 'STATUS_UPDATE', ...statusData });
  // A scan interrupted by a crash/restart is only safe to continue once the
  // WhatsApp session is usable again, so recovery is driven from here.
  if (statusData.status === 'CONNECTED') {
    setTimeout(() => { restoreInterruptedScan().catch(() => {}); }, 1500).unref?.();
  }
  const GATEWAY_APP = 'WhatsApp Shield';
  // Distinguish the APPLICATION identity (WhatsApp Shield) from the LINKED
  // ACCOUNT identity. Logs must never contain the linked account's name or full
  // phone number, and never the QR payload — only the masked number.
  const accountDetail = statusData.user && statusData.user.number
    ? ` linked account: ${maskPhone(statusData.user.number)}`
    : '';
  console.log(`[SHIELD_GATEWAY] [${GATEWAY_APP}] WhatsApp status updated: ${statusData.status}${accountDetail}`);
  // Log status update to shield-gateway.log. Only the status (and masked phone)
  // is persisted — never statusData, which carries the QR image and account info.
  if (whatsAppService.sessionManager) {
    whatsAppService.sessionManager.appendShieldLog('INFO', `${GATEWAY_APP} status updated: ${statusData.status}${accountDetail}`, { status: statusData.status });
  }
  // Compliance: any loss of the connected session returns the server to
  // read-only mode. Sending must be explicitly re-armed after every reconnect,
  // so a stale/restored session can never send anything unattended.
  if (statusData.status !== 'CONNECTED' && sendGate.armed) {
    sendGate.armed = false;
    sendGate.armedAt = null;
    console.log('[SEND_GATE] Disarmed (session no longer CONNECTED).');
    audit({ action: 'send_gate.disarm', outcome: 'ok', code: 'SESSION_LOST', detail: statusData.status });
  }
  if (statusData.status === 'CONNECTED') {
    audit({ action: 'session.connected', outcome: 'ok', detail: (whatsAppService.userInfo && whatsAppService.userInfo.number) || null });
  }
});

// Non-blocking profile-picture refresh: only updates sessionUser, does not
// re-trigger authentication or history loading on the client.
whatsAppService.onUserUpdateCallback = (user) => {
  broadcastAll({ type: 'USER_UPDATE', user });
};

// Cache the logged-in user's own profile-picture bytes as soon as they are
// fetched after login. This makes the /api/profile-picture proxy endpoint
// (used by the header/profile avatar) serve instantly after QR login instead of
// triggering a slow WhatsApp lookup on the very first browser request — which is
// what made the avatar only appear after a manual page refresh.
whatsAppService.onOwnProfilePictureCallback = (phone, pic) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || !pic || !pic.data) return;
  const entry = { data: pic.data, contentType: pic.contentType || 'image/jpeg', savedAt: Date.now() };
  setProfilePicCache(digits, entry);
  try {
    fs.mkdirSync(PROFILE_PIC_CACHE_DIR, { recursive: true });
    fs.writeFileSync(profilePicCachePath(digits), pic.data);
  } catch (err) {
    console.error('Failed to persist own profile picture cache:', err.message);
  }
};

// Preserve every legitimately-public profile picture discovered during a scan:
// record the pps URL for the /api/profile-picture fallback and cache the BYTES
// immediately so the photo keeps displaying in History / Reports / PDF even after
// the signed URL expires or the session goes offline.
whatsAppService.onScannedProfilePictureCallback = (phone, avatarUrl, pic) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || !pic || !pic.data) return;
  recordAvatarUrl(digits, avatarUrl);
  const entry = { data: pic.data, contentType: pic.contentType || 'image/jpeg', savedAt: Date.now() };
  setProfilePicCache(digits, entry);
  try {
    fs.mkdirSync(PROFILE_PIC_CACHE_DIR, { recursive: true });
    fs.writeFileSync(profilePicCachePath(digits), pic.data);
  } catch (err) {
    console.error('Failed to persist scanned profile picture cache:', err.message);
  }
};

// Live Display Name follow-ups. A name for an already-scanned number can arrive
// AFTER its row completed when WhatsApp pushes contact data (a rename/contact
// notification or an inbound pushName) later in the session. The name cache is
// free (no network), so patching the open job row and any in-memory campaign
// keeps every tab and History current without rescanning anything.
whatsAppService.onScannedDisplayNameCallback = (phone, displayName) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || !displayName || typeof displayName !== 'string') return;
  const hit = (r) => r && String(r.cleanNumber || r.number || r.formatted || '').replace(/\D/g, '') === digits;

  try {
    if (bulkCheckJob && bulkCheckJob.id && bulkCheckJob.active && Array.isArray(bulkCheckJob.results)) {
      const row = bulkCheckJob.results.find(hit);
      if (row) {
        if (!row.displayName) {
          row.displayName = displayName;
          row.nameFound = true;
          row.nameChecked = true;
          row.nameSource = row.nameSource || 'contact';
          broadcastAll({
            type: 'BULK_CHECK_NAME',
            jobId: bulkCheckJob.id,
            cleanNumber: digits,
            displayName: row.displayName,
            nameSource: row.nameSource
          });
        }
        // Keep the completion snapshot in sync so a late name survives finalize.
        if (lastCompletedScan && lastCompletedScan.campaign && lastCompletedScan.campaign.results) {
          const completedRow = lastCompletedScan.campaign.results.find(hit);
          if (completedRow && !completedRow.displayName) {
            completedRow.displayName = displayName;
            completedRow.nameFound = true;
            completedRow.nameChecked = true;
          }
        }
      }
    }

    // Patch the newest matching campaign in history so Reports / History pick the
    // late name up too. Best-effort and bounded to an in-memory, then persisted,
    // row update — never a rescan.
    const allCampaigns = loadCampaignHistory();
    const target = allCampaigns.find((c) => Array.isArray(c.results) && c.results.some(hit));
    if (target) {
      let changed = false;
      for (const r of target.results) {
        if (hit(r) && !r.displayName) {
          r.displayName = displayName;
          r.nameFound = true;
          r.nameChecked = true;
          r.nameSource = r.nameSource || 'contact';
          changed = true;
        }
      }
      if (changed) saveCampaignHistory(allCampaigns);
    }
  } catch (err) {
    console.warn('[SHIELD] Failed to patch live rows with late display name:', err.message);
  }
};

whatsAppService.onMessage((messageData) => {
  const { phone, text, id, timestamp } = messageData;

  // PROVIDER BOUNDARY: inbound personal-account messages arrive over Baileys.
  // The CRM receives inbound traffic ONLY from the Meta Cloud API webhook, so
  // this handler must never create or mutate a CRM contact. It exists purely to
  // drive the Shield live phone preview. Routing it into CRM stores was the
  // source of the Bad MAC noise and the group-JID junk contacts.
  const inboundIdentity = toContactIdentity(phone);
  if (!inboundIdentity) {
    const verdict = classifyIdentifier(phone);
    console.warn(`[SHIELD] Ignored inbound message from non-person identifier (${verdict.kind}): ${verdict.reason || 'unknown'}`);
    return;
  }

  const e164Phone = formatE164(phone);
  const cleanPhone = inboundIdentity.digits;
  const contacts = loadContacts();
  let contact = contacts.find(c => normalizePhone(c.phone) === cleanPhone);

  // The contact is used ONLY to resolve a display name for the Shield live
  // preview. It is never persisted into CRM stores (contacts.json /
  // campaign_history.json), which are fed exclusively by the Meta webhook and
  // by explicit Shield campaign imports.
  if (!contact) {
    contact = {
      id: `preview_${cleanPhone}`,
      phone: e164Phone || `+${cleanPhone}`,
      name: e164Phone || `+${cleanPhone}`,
      country: 'Unknown',
      avatar: null,
      unread: 0,
      mode: 'manual'
    };
  }

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
    status: 'delivered',
    provider: PROVIDERS.SHIELD
  };

  // Live phone preview only — no CRM persistence, no inbound CRM conversation.
  broadcastAll({
    type: 'SHIELD_INBOUND_MESSAGE',
    action: 'preview_message',
    phone,
    contactPhone: contact.phone,
    message: messageResult
  });
});

whatsAppService.onMessageStatus((statusData) => {
  const { messageId, jid, status } = statusData;
  const phone = jid?.split('@')[0] || '';

  // PROVIDER BOUNDARY: delivery receipts for the linked device are Shield
  // preview information only. CRM message statuses come from the Meta webhook,
  // so they are never written into CRM campaign history from here.
  broadcastAll({
    type: 'SHIELD_MESSAGE_STATUS',
    action: 'preview_status',
    messageId,
    phone,
    status,
    provider: PROVIDERS.SHIELD
  });
});

// --- WebSocket Handler ---
wss.on('connection', (ws, req) => {
  // Bound total concurrent WebSocket clients so a flood of sockets can't
  // exhaust memory or let a single caller spin up many scan controllers.
  // Evict dead sockets first so a stale entry can never consume a slot.
  for (const existing of clients) {
    if (existing.readyState !== WebSocket.OPEN) clients.delete(existing);
  }
  // If still at the cap, apply "last connection wins": evict the oldest live
  // socket (a page refresh always supersedes its own stale predecessor) instead
  // of rejecting the newcomer. Rejecting caused a fast reconnect loop — the
  // frontend saw onopen then an immediate 1013 close and retried every ~2s,
  // and once 25 stale clients accumulated a refresh could never recover.
  if (clients.size >= MAX_WS_CLIENTS) {
    let oldest = null;
    for (const existing of clients) {
      if (!oldest || (existing.connectedAt || 0) < (oldest.connectedAt || 0)) oldest = existing;
    }
    if (oldest) {
      try { oldest.close(1013, 'Superseded by a newer connection'); } catch (_) {}
      clients.delete(oldest);
      appendShieldLog('WARN', 'WebSocket client limit reached; evicted oldest client', { limit: MAX_WS_CLIENTS, evictedAt: oldest.connectedAt || null });
    }
  }
  clients.add(ws);
  ws.connectedAt = Date.now();
  ws.isAlive = true;
  ws._rateKey = (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'ws'
  );
  console.log(`WebSocket client connected. Total: ${clients.size}`);

  // Heartbeat: mark the socket as alive on each ping, and terminate dead sockets
  // after a generous timeout so transient network blips don't orphan connections.
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Clean up dead sockets from the client set when they close.
  // This prevents the clients Set from growing unboundedly and hitting the
  // MAX_WS_CLIENTS limit due to stale connections that never fire onerror/onclose.
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`WebSocket client disconnected. Remaining: ${clients.size}`);
  });

  // Send current status on connect
  ws.send(JSON.stringify({
    type: 'STATUS_UPDATE',
    status: whatsAppService.status,
    qr: whatsAppService.qrCodeDataUrl,
    user: whatsAppService.userInfo
  }));

  // Tell the client immediately whether messaging is armed (read-only default).
  ws.send(JSON.stringify({ type: 'SEND_GATE_UPDATE', armed: sendGate.armed }));

  // If a scan is already in progress, hand the freshly-connected client a
  // complete snapshot (job id, total, already-completed results, current
  // number, and live state) so a mid-scan reconnect, page refresh, or second
  // tab resumes the same live view instead of only showing numbers validated
  // after the link — that gap is what made live results appear incomplete.
  if (bulkCheckJob.active) {
    ws.send(JSON.stringify({
      type: 'BULK_CHECK_START',
      jobId: bulkCheckJob.id,
      total: bulkCheckJob.total,
      state: bulkCheckJob.state,
      resume: true,
      results: bulkCheckJob.results,
      processedCount: bulkCheckJob.results.length,
      currentNumber: bulkCheckJob.currentNumber || null,
      cooldownUntil: bulkCheckJob.cooldownUntil,
      cooldownMessage: bulkCheckJob.cooldownMessage
    }));
  }

  ws.on('message', async (raw) => {
    // --- Per-socket input governance (fail-closed) ---
    // Bound the size of a single frame so a malformed/oversized payload can't
    // goad the parser into buffering unbounded data, and rate-limit command
    // volume per socket (an attacker spamming control frames can't spin the
    // scan state machine or the send handlers without tripping the limiter).
    const frameBytes = typeof raw === 'string' ? Buffer.byteLength(raw) : raw.length;
    if (frameBytes > MAX_WS_FRAME_BYTES) {
      appendShieldLog('WARN', 'Rejected oversized WebSocket frame', { bytes: frameBytes, type: (ws._rateKey || 'ws') });
      return;
    }
    wsControlLimiter.charge(ws._rateKey);
    if (wsControlLimiter.isBlocked(ws._rateKey)) {
      appendShieldLog('WARN', 'WebSocket control rate limit hit', { type: ws._rateKey });
      return;
    }
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case 'ping':
          ws.isAlive = true;
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'pong':
          ws.isAlive = true;
          break;

        case 'ARM_SENDING': {
          // Explicit user confirmation to leave read-only mode. Requires
          // confirm:true; anything else is ignored (fail closed).
          if (data && data.confirm === true && whatsAppService.status === 'CONNECTED') {
            sendGate.armed = true;
            sendGate.armedAt = new Date().toISOString();
            console.log('[SEND_GATE] Armed — messaging enabled by explicit user action.');
            audit({ action: 'send_gate.arm', outcome: 'ok', ip: ws._socket?.remoteAddress || null });
            ws.send(JSON.stringify({ type: 'SEND_GATE_UPDATE', armed: true }));
          } else {
            ws.send(JSON.stringify({ type: 'SEND_GATE_UPDATE', armed: false, error: sendGate.armed ? 'Already armed' : 'Cannot arm messaging: not connected or confirmation missing.' }));
          }
          break;
        }

        case 'DISARM_SENDING': {
          sendGate.armed = false;
          sendGate.armedAt = null;
          console.log('[SEND_GATE] Disarmed by user.');
          audit({ action: 'send_gate.disarm', outcome: 'ok', code: 'USER', ip: ws._socket?.remoteAddress || null });
          ws.send(JSON.stringify({ type: 'SEND_GATE_UPDATE', armed: false }));
          break;
        }

        case 'get_qr':
        case 'generate_qr': {
          // Rate-limit QR (re)generation per client: double-clicks, reconnect
          // storms, or buggy loops must not fan out an unbounded series of QR
          // sessions, each of which tears down the previous Baileys socket.
          const qrOk = authActionLimiter.check(ws._rateKey || ws._socket?.remoteAddress || 'ws');
          if (!qrOk.allowed) {
            ws.send(JSON.stringify({
              type: 'QR_CODE',
              error: 'Too many QR generation requests. Please wait before trying again.',
              qr: null
            }));
            audit({ action: 'session.qr.rate_limited', outcome: 'blocked', code: 'RATE_LIMIT', ip: ws._socket?.remoteAddress || null });
            break;
          }
          await whatsAppService.generateQRCode();
          break;
        }

        case 'cancel_qr':
          whatsAppService.cancelQR();
          break;

        case 'logout': {
          // Same per-client limiter as QR generation: repeated logout pings from
          // a stuck client must not churn the WhatsApp session in a loop.
          const loOk = authActionLimiter.check(ws._rateKey || ws._socket?.remoteAddress || 'ws');
          if (!loOk.allowed) {
            ws.send(JSON.stringify({ type: 'LOGOUT_RESULT', success: false, error: 'Too many requests. Please wait a moment and try again.' }));
            break;
          }
          stopBulkCheck();
          sendGate.armed = false;
          sendGate.armedAt = null;
          await whatsAppService.logout();
          // Full data cleanup (session, logs, scan-state, cached avatars, pdf
          // exports). Compliance data is only removed when explicitly opted in.
          const clearSummary = await clearSessionData({
            mode: 'logout',
            deleteComplianceData: !!data.deleteComplianceData,
            logNote: 'Session logged out; logs cleared.',
          });
          audit({ action: 'session.logout', outcome: 'ok', code: 'WS', ip: ws._socket?.remoteAddress || null });
          ws.send(JSON.stringify({ type: 'LOGOUT_RESULT', success: true, cleared: clearSummary }));
          break;
        }

        case 'get_history': {
          // History is strictly scoped to the connected session's owner so one
          // user's campaigns can never surface for another user/session.
          const phone = data.phone?.replace(/\D/g, '') || '';
          const owner = sessionOwnerPhone() || phone;
          const userCampaigns = campaignService.campaignsForOwnerPhone(owner);
          ws.send(JSON.stringify({ type: 'HISTORY_RESULT', campaigns: userCampaigns }));
          break;
        }

        case 'delete_campaign': {
          // Ownership-safe deletion via the centralized service: the campaign is
          // removed from history AND every campaign-owned local resource (cached
          // profile pictures) is cleaned up — but only when the campaign really
          // belongs to the current session and no other campaign/contact still
          // references a cached picture. The requestId is echoed so the UI can
          // correlate the result instead of assuming deletion succeeded.
          const requestId = data.requestId || null;
          const phone = data.phone?.replace(/\D/g, '') || '';
          const owner = sessionOwnerPhone() || phone;
          const { deleted, notFound, denied } = campaignService.deleteCampaignsById([data.id], owner);
          const userCampaigns = campaignService.campaignsForOwnerPhone(owner);
          if (deleted.length > 0) {
            // Real history deletion: also purge the scan log entries that belong
            // to the deleted campaign(s), their orphaned contacts, and their
            // cached profile pictures — so "delete history" removes the data
            // from disk, not just from the JSON list.
            try {
              const jobIds = deleted.map(c => c.id);
              const contactNumbers = [];
              deleted.forEach(c => (c.results || []).forEach(r => {
                const n = String(r.cleanNumber || r.number || '').replace(/\D/g, '');
                if (n) contactNumbers.push(n);
              }));
              await clearSessionData({ mode: 'history', jobIds, contactNumbers });
            } catch (_) {}
            ws.send(JSON.stringify({
              type: 'DELETE_RESULT',
              requestId,
              success: true,
              deletedIds: deleted.map(c => c.id),
              campaigns: userCampaigns
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'DELETE_RESULT',
              requestId,
              success: false,
              error: denied
                ? 'No active session — campaign could not be deleted.'
                : (notFound.length > 0 ? 'Campaign not found or does not belong to this account.' : 'No such campaign.'),
              campaigns: userCampaigns
            }));
          }
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

          // Per-client limiter on scan starts (shared 5/min window with the REST
          // /api/check-bulk limiter keyed by the same client identity) so a
          // reconnect loop can't re-trigger unbounded back-to-back scans.
          const bulkOk = bulkCheckLimiter.check(ws._rateKey || ws._socket?.remoteAddress || 'ws');
          if (!bulkOk.allowed) {
            ws.send(JSON.stringify({ type: 'BULK_CHECK_INTERRUPTED', reason: 'Too many scan starts. Please wait a moment before starting another validation.' }));
            audit({ action: 'bulk_check.rate_limited', outcome: 'blocked', code: 'RATE_LIMIT', ip: ws._socket?.remoteAddress || null });
            break;
          }

          if (!bulkCheckLock.tryAcquire()) {
            ws.send(JSON.stringify({ type: 'BULK_CHECK_INTERRUPTED', reason: 'A bulk check is already running. Wait for it to finish or stop it first.' }));
            break;
          }

          // Idempotency guard: the exact same batch submitted twice within the
          // dedup window (double-click / retry echo) is skipped, never re-run.
          const dupReason = guardDuplicateScanStart(numbers);
          if (dupReason) {
            bulkCheckLock.release();
            ws.send(JSON.stringify({ type: 'BULK_CHECK_INTERRUPTED', reason: dupReason }));
            audit({ action: 'bulk_check.duplicate_submit', outcome: 'blocked', code: 'DUPLICATE', ip: ws._socket?.remoteAddress || null });
            break;
          }

          try {
            await runBulkCheck({
              numbers,
              phone: phone || '',
              countryCode: scanSettings?.countryCode,
              delayMs: scanSettings?.delayMs,
              shieldMode: scanSettings?.shieldMode,
              jitter: scanSettings?.jitter,
              countryIso: scanSettings?.countryIso,
              countryName: scanSettings?.countryName,
              regionName: scanSettings?.regionName,
              regionPrefix: scanSettings?.regionPrefix,
              audienceType: scanSettings?.audienceType
            });
          } finally {
            bulkCheckLock.release();
          }
          break;
        }

        case 'SEND_MESSAGE': {
          // PROVIDER BOUNDARY: WhatsApp Shield is a lookup-only lead finder and
          // cannot send messages. The linked-device socket is not a send
          // transport for any flow. The CRM sends exclusively through the
          // official Meta Cloud API (/api/message-agent/message).
          ws.send(JSON.stringify({
            type: 'MESSAGE_SENT',
            success: false,
            message: {
              id: crypto.randomUUID(),
              from: 'me',
              timestamp: new Date().toISOString(),
              status: 'blocked',
              waError: 'WhatsApp Shield is a lookup-only tool and cannot send messages. Send from the Message Agent using the official Meta API.'
            }
          }));
          audit({
            action: 'shield.send.blocked',
            outcome: 'blocked',
            code: 'PROVIDER_BOUNDARY_VIOLATION',
            ip: ws._socket?.remoteAddress || null
          });
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
          if (data.type !== 'pong') {
            console.log('Unhandled WS message type:', redact(data.type));
          }
      }
    } catch (err) {
      console.error('WebSocket message error:', safeError(err));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`WebSocket client disconnected. Total: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', safeError(err, false));
    clients.delete(ws);
  });

  ws.on('pong', () => {
    ws.isAlive = true;
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

// Session status — authoritative source for frontend to know session state on mount/refresh.
// Returns: connected, connecting, qr_required, logged_out, restoring
// This is the source of truth for login persistence across page refreshes and backend restarts.
app.get('/api/session/status', (req, res) => {
  let sessionState = 'logged_out';
  let sessionInfo = null;
  
  if (whatsAppService.sessionManager) {
    sessionInfo = whatsAppService.sessionManager.getSessionInfo(whatsAppService.sessionId || 'default');
  }
  
  if (whatsAppService.status === 'CONNECTED') {
    sessionState = 'connected';
  } else if (whatsAppService.status === 'CONNECTING' || whatsAppService._connecting) {
    sessionState = 'connecting';
  } else if (whatsAppService.status === 'QR_CODE') {
    sessionState = 'qr_required';
  } else if (sessionInfo && sessionInfo.valid) {
    // Session exists and is valid but not currently connected (restoring)
    sessionState = 'restoring';
  } else if (sessionInfo && sessionInfo.exists && !sessionInfo.valid) {
    // Session exists but invalid (logged out by WhatsApp)
    sessionState = 'logged_out';
  }
  
  res.json({
    state: sessionState,
    whatsappStatus: whatsAppService.status,
    qr: whatsAppService.qrCodeDataUrl,
    user: whatsAppService.userInfo,
    session: sessionInfo
  });
});

// Authoritative scan state — the single source of truth for active scan
// accounting. Frontend reconciliation (visibility change, page refresh,
// reconnect) fetches this endpoint to restore Processed / Registered /
// Total / Progress / State instead of relying solely on accumulated
// WebSocket events which can be dropped or missed.
app.get('/api/scan-status', (req, res) => {
  if (!bulkCheckJob.active) {
    // Idle, but the last finished scan is still available. A client that lost
    // the one-shot terminal event uses this to run the completion flow exactly
    // once instead of hanging at N/N.
    //
    // `interrupted` describes a scan that a crash/restart left on disk and that
    // has NOT been resumed yet (e.g. WhatsApp is not connected). The client uses
    // it to keep showing the recovered counters/leads instead of resetting to
    // 0/Idle while it waits for Resume.
    let interrupted = null;
    try {
      const snap = scanJournal.readActiveScan();
      if (snap && snap.meta && Array.isArray(snap.meta.numbers) && snap.meta.numbers.length > 0) {
        const total = snap.meta.numbers.length;
        interrupted = {
          jobId: snap.meta.jobId,
          state: 'INTERRUPTED',
          total,
          validTotal: Array.isArray(snap.meta.dispatchable) ? snap.meta.dispatchable.length : total,
          cursor: snap.cursor,
          currentNumber: null,
          results: snap.results,
          resultCount: snap.results.length,
          registeredCount: snap.results.filter((r) => r && r.exists).length,
          startedAt: snap.meta.startedAt || null,
        };
      }
    } catch (_) { /* never fail the status endpoint */ }

    return res.json({
      active: false,
      state: bulkCheckJob.state === 'COMPLETED' || bulkCheckJob.state === 'STOPPED' ? bulkCheckJob.state : 'IDLE',
      interrupted,
      lastCompleted: lastCompletedScan.jobId
        ? {
          jobId: lastCompletedScan.jobId,
          campaign: lastCompletedScan.campaign,
          resultsCount: lastCompletedScan.resultsCount,
          registered: lastCompletedScan.registered,
          unregistered: lastCompletedScan.unregistered,
          invalid: lastCompletedScan.invalid,
          total: lastCompletedScan.total,
          status: lastCompletedScan.status,
          at: lastCompletedScan.at,
        }
        : null,
    });
  }
  res.json({
    active: true,
    jobId: bulkCheckJob.id,
    state: bulkCheckJob.state,
    total: bulkCheckJob.total,
    validTotal: bulkCheckJob.validTotal,
    invalidCount: bulkCheckJob.invalidCount,
    cursor: bulkCheckJob.cursor,
    currentNumber: bulkCheckJob.currentNumber || null,
    results: bulkCheckJob.results,
    resultCount: bulkCheckJob.results.length,
    registeredCount: bulkCheckJob.results.filter(r => r && r.exists).length,
    cooldownUntil: bulkCheckJob.cooldownUntil,
    cooldownMessage: bulkCheckJob.cooldownMessage,
    connectivityPaused: (bulkCheckJob.consecutiveNetErrors || 0) > 0,
    // A scan whose processed count has already reached the requested total is
    // finished in substance even if the terminal event has not been delivered
    // yet. The client treats this as authoritative and finalizes once.
    processedComplete: bulkCheckJob.total > 0
      && bulkCheckJob.results.length >= bulkCheckJob.total
      && bulkCheckJob.state !== 'PAUSED',
  });
});

// Liveness — the process is up and serving. Never throws.
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    uptime: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    sending: { readOnly: !sendGate.armed, armed: sendGate.armed },
    outbound: whatsAppService.getOutboundState ? whatsAppService.getOutboundState() : null,
    components: healthRegistry.snapshot()
  });
});

// Readiness — recoverable dependencies (disk, WhatsApp session state, AI
// providers) report their status. The server stays up in degraded state even
// when a component is down; readiness reflects the overall health for load
// balancers without ever triggering an app restart.
app.get('/api/ready', (req, res) => {
  const components = healthRegistry.snapshot();
  const degraded = Object.keys(components).filter(k => components[k].status !== 'ok');
  res.json({
    success: true,
    ready: degraded.length === 0,
    degraded,
    components
  });
});

// Logout
app.post('/api/logout', authActionLimiter.middleware(), async (req, res) => {
  try {
    stopBulkCheck();
    sendGate.armed = false;
    sendGate.armedAt = null;
    await whatsAppService.logout();
    const clearSummary = await clearSessionData({
      mode: 'logout',
      deleteComplianceData: !!(req.body && req.body.deleteComplianceData),
      logNote: 'Session logged out; logs cleared.',
    });
    audit({ action: 'session.logout', outcome: 'ok', code: 'REST', ip: req.ip });
    res.json({ success: true, cleared: clearSummary });
  } catch (err) {
    audit({ action: 'session.logout', outcome: 'failed', code: err.code || 'ERROR', ip: req.ip });
    res.status(500).json({ error: err.message });
  }
});

// Bulk check endpoint (REST trigger — results flow through WebSocket)
app.post('/api/check-bulk', bulkCheckLimiter.middleware(), async (req, res) => {
  let bulkLockAcquired = false;
  try {
    const { numbers, numberMetadata, phone, countryCode, delayMs, shieldMode, jitter, countryIso, countryName, regionName, regionPrefix, audienceType } = req.body;
    const sanitized = sanitizeNumbers(numbers, 10000);
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

    // Idempotency guard: reject an identical re-submission of the same batch
    // inside the dedup window (double-click / retry echo).
    const dupReason = guardDuplicateScanStart(sanitized);
    if (dupReason) {
      return res.status(409).json({ error: dupReason, code: 'DUPLICATE' });
    }

    res.json({ success: true, message: 'Bulk check started', total: sanitized.length });

    await runBulkCheck({ numbers: sanitized, numberMetadata, phone, countryCode, delayMs, shieldMode, jitter, countryIso, countryName, regionName, regionPrefix, audienceType });
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
    // Scoped to the connected session's owner (never an arbitrary query value)
    // so campaigns stay isolated per authenticated session/user.
    const owner = sessionOwnerPhone() || phone;
    const userCampaigns = campaignService.campaignsForOwnerPhone(owner);
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
  // Per-client flood guard: a results page with N avatars is normal, but a
  // script hitting this endpoint in a loop must be throttled.
  const picRate = profilePicLimiter.check(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown');
  if (!picRate.allowed) {
    audit({ action: 'profile_picture.rate_limited', outcome: 'blocked', code: 'RATE_LIMIT', ip: req.ip, phone: phone.slice(0, 6) + '****' });
    return res.status(429).json({ error: 'Too many profile picture requests. Please wait a moment.' });
  }

  const connected = whatsAppService.status === 'CONNECTED';
  const mem = profilePicCache.get(phone);
  const fresh = !!(mem && (Date.now() - mem.savedAt) < PROFILE_PIC_TTL_MS);
  // Authorized-only gate: on-demand WhatsApp/recorded-URL lookups happen ONLY
  // for numbers this session has actually worked with (campaigns, contacts,
  // current scan). Everything else can only be answered from already-cached
  // bytes — never probed.
  const known = knownNumbers.has(phone);

  const sendCached = (entry) => {
    res.set('Content-Type', entry.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(entry.data);
  };

  // Fallback source: the last public pps URL recorded by our own session's
  // lookups for this phone (from scan results / contacts). The live WhatsApp
  // lookup can be transiently flaky or the session can be offline; the recorded
  // URL is fetched directly and its bytes preserved, so an actually-public photo
  // is never dropped just because the live lookup failed. SSRF-safe: only
  // pps.whatsapp.net URLs produced by profilePictureUrl are ever resolved.
  const fetchRecordedUrl = async () => {
    const url = recordedAvatarUrls.get(phone);
    if (!url || !/^https:\/\/pps\.whatsapp\.net\//.test(url)) return null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const data = Buffer.from(await res.arrayBuffer());
      if (!data.length) return null;
      return { data, contentType: res.headers.get('content-type') || 'image/jpeg' };
    } catch (e) {
      return null;
    }
  };

  const cacheAndSend = (pic) => {
    if (!pic || !pic.data) return false;
    const entry = { data: pic.data, contentType: pic.contentType, savedAt: Date.now() };
    setProfilePicCache(phone, entry);
    // Fire-and-forget async write: this runs for EVERY lead found, and the
    // synchronous version used to block the event loop mid-scan (delaying
    // pong/progress handling behind disk I/O). The directory is created once
    // eagerly at startup, so mkdir here is only a cheap race guard.
    const bytes = pic.data;
    fs.promises.mkdir(PROFILE_PIC_CACHE_DIR, { recursive: true })
      .then(() => fs.promises.writeFile(profilePicCachePath(phone), bytes))
      .catch(() => {});
    sendCached(entry);
    return true;
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
    // Restricted to "known" numbers so an arbitrary phone is never probed.
    let pic = null;
    if (connected && known) {
      pic = await resolvePicture();
      if (pic && pic.data && cacheAndSend(pic)) return;
    }

    // The session fetch came up empty (offline, flaky, or the picture URL
    // changed/expired). Fall back to the last recorded public URL before
    // declaring the picture unavailable. Also gated to known numbers.
    if (known && await cacheAndSend(await fetchRecordedUrl())) return;

    // Graceful stale: serve a previously cached picture (disk or memory) even if
    // the session is offline or the signed URL expired — better than a broken image.
    if (mem) return sendCached(mem);
    // Async so a slow disk read during a busy scan never stalls the event loop
    // (the same risk as the write path above).
    try {
      const data = await fs.promises.readFile(profilePicCachePath(phone));
      if (data && data.length) {
        const entry = { data, contentType: 'image/jpeg', savedAt: Date.now() };
        setProfilePicCache(phone, entry);
        return sendCached(entry);
      }
    } catch (_) { /* no cached bytes */ }

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

// Every CRM endpoint requires an active Shield (Baileys) login. The Meta
// webhook and the Shield login/QR routes are mounted separately and remain
// public, so the CRM cannot be reached or driven while logged out.
app.use('/api/message-agent', requireShieldAuth);

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

      // Never render a non-person as a chat. Legacy rows created before the
      // JID validator existed (groups/channels digit-stripped into numbers, or
      // stray placeholders) are hidden rather than shown as fake people. They
      // are not deleted here — data is preserved and only the list is guarded.
      const contactIdentity = toContactIdentity(contact.phone || '');
      if (!contactIdentity) continue;
      const displayPhone = contactIdentity.e164;

      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

      conversations.push({
        id: contact.id,
        contact: {
          name: contact.name && contact.name !== '+' && contact.name !== displayPhone
            ? contact.name
            : displayPhone,
          phone: displayPhone,
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
        notesList: (Array.isArray(contact.notesList) && contact.notesList.length) ? contact.notesList
          : (contact.notes ? [{ id: `note_seed`, text: contact.notes, category: 'General', createdAt: contact.updatedAt || contact.createdAt || new Date().toISOString(), updatedAt: contact.updatedAt || contact.createdAt || new Date().toISOString() }] : []),
        journey: contact.journey || 'new_lead',
        crm: contact.crm || null,
        aiObjective: contact.aiObjective || 'lead_qualification',
        createdAt: contact.createdAt || new Date().toISOString(),
        messages,
        status: contact.status || 'offline',
        saved: !!contact.saved,
        savedAt: contact.savedAt || null,
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

    // Only real 1-to-1 people may become CRM conversations. Groups, channels,
    // broadcasts and unresolved LIDs are rejected with a clear reason so the UI
    // can explain itself instead of silently creating a bogus contact.
    const identifier = classifyIdentifier(phone);
    if (!identifier.valid) {
      return res.status(400).json({
        error: identifier.reason || 'Not a valid WhatsApp contact',
        reason: identifier.kind,
      });
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
      if (contactInfo?.avatar) {
        existingContact.avatar = contactInfo.avatar;
        recordAvatarUrl(cleanPhone, contactInfo.avatar);
      }
      if (contactInfo?.country) existingContact.country = contactInfo.country;
      if (contactInfo?.exists !== undefined) existingContact.exists = contactInfo.exists;
      if (contactInfo?.isBusiness !== undefined) existingContact.isBusiness = contactInfo.isBusiness;
      existingContact.updatedAt = new Date().toISOString();
      
      saveContacts(contacts);
      
      return res.json({ success: true, conversation: existingContact, isNew: false });
    }
    
    // Create new contact
    if (contactInfo?.avatar) recordAvatarUrl(cleanPhone, contactInfo.avatar);
    const newContact = {
      id: `contact_${cleanPhone}_${Date.now()}`,
      phone: e164Phone || `+${cleanPhone}`,
      name: contactInfo?.name || e164Phone || `+${cleanPhone}`,
      country: contactInfo?.country || 'Unknown',
      avatar: contactInfo?.avatar || null,
      about: contactInfo?.about || '',
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
      saved: false,
      savedAt: null,
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

    // --- Compliance payload validation (fail closed) ---
    const messageText = typeof message === 'string' ? message : '';
    const confirmed = req.body && req.body.confirmed === true;
    if (!messageText.trim() || messageText.length > 4096) {
      audit({ action: 'message.send.blocked', outcome: 'blocked', phone: normalizePhone(phone || '') || null, code: 'INVALID_PAYLOAD', ip: req.ip });
      return res.status(400).json({ error: 'Invalid message payload', code: 'INVALID_PAYLOAD' });
    }
    // Read-only gate: server refuses every send unless the user explicitly armed
    // messaging.
    if (!sendGate.armed) {
      audit({ action: 'message.send.blocked', outcome: 'blocked', phone: normalizePhone(phone || '') || null, code: 'SENDING_READONLY', ip: req.ip });
      return res.status(403).json({ error: SEND_GATE_REASON, code: 'SENDING_READONLY' });
    }
    // Per-send explicit confirmation.
    if (!confirmed) {
      audit({ action: 'message.send.blocked', outcome: 'blocked', phone: normalizePhone(phone || '') || null, code: 'SENDING_NOT_CONFIRMED', ip: req.ip });
      return res.status(403).json({ error: 'Send not confirmed. Confirm this message before sending.', code: 'SENDING_NOT_CONFIRMED' });
    }

    const rawPhone = phone || '';
    const cleanDigits = normalizePhone(rawPhone);
    if (!cleanDigits || cleanDigits.length < 8 || cleanDigits.length > 15) {
      audit({ action: 'message.send.blocked', outcome: 'blocked', phone: cleanDigits || null, code: 'INVALID_PHONE', ip: req.ip });
      return res.status(400).json({ error: 'Invalid recipient phone number', code: 'INVALID_PHONE' });
    }
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

    if (from === 'user' || from === 'ai') {
      // PROVIDER BOUNDARY: the CRM sends ONLY through the official Meta Cloud
      // API. The linked-device (Baileys) transport is deliberately not reachable
      // from this route — assertCanSend rejects any attempt to use it.
      try {
        assertCanSend('message-agent.message', { provider: PROVIDERS.META, transport: PROVIDERS.META });
      } catch (boundaryErr) {
        messageStatus = 'failed';
        waError = boundaryErr.message;
      }

      if (!waError && !cleanDigits) {
        messageStatus = 'failed';
        waError = 'A valid recipient phone number is required.';
      }

      if (!waError) {
        // Opt-out is absolute: never message a contact who opted out.
        const existingOptOut = contacts.find(c => normalizePhone(c.phone) === cleanDigits);
        if (existingOptOut && isOptedOut(existingOptOut)) {
          messageStatus = 'blocked';
          waError = 'Contact has opted out and must never be messaged.';
        }
      }

      if (!waError) {
        const sendPolicy = resolveSendPolicy(
          contacts.find(c => normalizePhone(c.phone) === cleanDigits) || {},
          { templateName: req.body.templateName || null }
        );
        if (!sendPolicy.allowed) {
          messageStatus = 'blocked';
          waError = sendPolicy.reason;
        } else if (sendPolicy.requiresOptInWarning) {
          audit({
            action: 'message.send.optin_unverified',
            outcome: 'warn',
            phone: cleanDigits,
            code: 'OPT_IN_UNKNOWN',
            ip: req.ip
          });
        }
      }

      if (!waError) {
        // Delivered to the official API transport. The Meta messaging service
        // owns Graph API calls, throttling, retries and status tracking.
        try {
          const metaService = require('./services/meta/messaging-service');
          const metaConfig = require('./services/meta/meta-config');
          const workspaceId = metaConfig.getWorkspaceId
            ? metaConfig.getWorkspaceId()
            : `session_${sessionOwnerPhone() || 'default'}`;

          if (!metaConfig.getStatus || !metaConfig.getStatus().connected) {
            throw new Error('Meta Cloud API is not connected. Connect the business number in Settings.');
          }

          const isTemplate = !!req.body.templateName;
          const sent = isTemplate
            ? await metaService.sendSingleTemplate({
                workspaceId,
                to: e164Phone,
                templateName: req.body.templateName,
                language: req.body.language || 'en',
                variables: req.body.variables || {}
              })
            : await metaService.sendOfficialText({ workspaceId, to: e164Phone, text: message });

          waMessageId = sent?.id || sent?.wamid || null;
          messageStatus = 'sent';
        } catch (metaErr) {
          console.error('Meta send failed:', metaErr.message);
          messageStatus = 'failed';
          waError = metaErr.message;
        }
      }
    } else if (from === 'system') {
      messageStatus = 'delivered';
    }

    // Audit every transmission attempt (never logs message bodies).
    audit({ action: 'message.send', outcome: messageStatus, phone: cleanDigits, code: waError ? 'SEND_FAILED' : 'SENT', ip: req.ip, origin: req.headers.origin || null });

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
app.post('/api/message-agent/import-bulk', importBulkLimiter.middleware(), async (req, res) => {
  try {
    const { contacts: importContacts, mode = 'manual', metadata = {} } = req.body;
    if (!importContacts || !Array.isArray(importContacts) || importContacts.length === 0) {
      return res.status(400).json({ error: 'No contacts provided' });
    }
    // Hard cap on the number of contacts a single import may create — a target
    // list is a sending surface, so it must be bounded server-side even if the
    // client is bypassed. Real campaigns import in far smaller batches.
    const MAX_IMPORT_CONTACTS = Number(process.env.MAX_IMPORT_CONTACTS) || 2000;
    if (importContacts.length > MAX_IMPORT_CONTACTS) {
      return res.status(400).json({ error: `Cannot import more than ${MAX_IMPORT_CONTACTS} contacts at once.` });
    }

    // Verified Lead Transfer rules: allow a staged pipeline + default journey for
    // leads coming out of WhatsApp Shield detection campaigns.
    const TRANSFER_RULES_FILE = path.join(__dirname, 'transfer_rules.json');
    let transferRules = {};
    try { transferRules = JSON.parse(fs.readFileSync(TRANSFER_RULES_FILE, 'utf8')); } catch (_) {}
    const importedJourney = transferRules.defaultJourney || metadata.defaultJourney || 'new_lead';

    const existingContacts = loadContacts();
    const added = [];
    const skipped = [];
    const rejected = [];

    for (const item of importContacts) {
      const rawPhone = item.phone || item.number || '';
      if (!rawPhone) continue;

      // Reject non-person JIDs (groups, channels, broadcasts, unresolved LIDs)
      // BEFORE any digit stripping so they can never become fake contacts.
      const identifier = classifyIdentifier(rawPhone);
      if (!identifier.valid) {
        rejected.push({ value: String(rawPhone), reason: identifier.reason || identifier.kind });
        continue;
      }

      const cleanPhone = normalizePhone(rawPhone);
      if (!cleanPhone) {
        rejected.push({ value: String(rawPhone), reason: 'unparseable number' });
        continue;
      }

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

      const isVerified = item.isVerified || item.verified === true || metadata.verified === true || false;
      const itemTags = Array.isArray(item.tags) ? item.tags : [];
      const metaTags = Array.isArray(metadata.tags) ? metadata.tags : [];
      const tags = [...new Set([...(transferRules.addTags || []), ...itemTags, ...metaTags].filter(Boolean))].slice(0, 8);

      const uploadedAt = new Date().toISOString();
      const newContact = {
        id: `contact_${cleanPhone}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        phone: e164Phone,
        name: item.name || item.displayName || e164Phone,
        country: item.country || item.detectedCountry || metadata.country || 'Unknown',
        avatar: item.avatar || null,
        about: item.about || '',
        exists: item.exists !== false,
        isVerified,
        isBusiness: item.isBusiness || false,
        mode,
        pinned: false,
        archived: false,
        starred: false,
        tags,
        notes: '',
        journey: item.journey || importedJourney,
        crm: null,
        unread: 0,
        status: 'offline',
        source: metadata.source || 'whatsapp_shield',
        // Provider boundary: CRM contacts are addressed through the official
        // Meta Cloud API. `shield` only describes where the lead was FOUND.
        provider: 'meta',
        // Imported leads have no opt-in evidence yet.
        optIn: item.optIn || 'unknown',
        // Shield campaign + validation provenance (Verified Lead Transfer)
        campaignId: item.campaignId || metadata.campaignId || null,
        campaignDate: item.campaignDate || metadata.campaignDate || null,
        shieldValidatedAt: (isVerified || metadata.validated === true) ? (item.validationDate || metadata.validationDate || uploadedAt) : null,
        saved: false,
        savedAt: null,
        ownerPhone: sessionOwnerPhone(),
        createdAt: uploadedAt,
        updatedAt: uploadedAt,
      };
      existingContacts.unshift(newContact);
      added.push(newContact);
    }

    saveContacts(existingContacts);

    broadcastAll({
      type: 'MESSAGE_AGENT_UPDATE',
      action: 'contacts_imported',
      count: added.length,
      skipped: skipped.length,
      rejected: rejected.length
    });

    res.json({
      success: true,
      added: added.length,
      skipped: skipped.length,
      rejected: rejected.length,
      rejectedSample: rejected.slice(0, 5)
    });
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

        // Only real 1-to-1 users are importable. A group (`@g.us`), channel
        // (`@newsletter`), broadcast (`@broadcast`) or unresolved `@lid` id is
        // rejected here so it can never reach the CRM contact list.
        if (!classifyIdentifier(rawPhone).valid) continue;

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
    if (deletedCampaigns.length > 0) campaignService.cleanupProfilePicCacheAfterCampaignDeletion(deletedCampaigns);

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

// Minimal conversation envelope carrying the saved flag, broadcast so other tabs
// can merge the change without a full reload.
function savedContactEnvelope(contact) {
  return {
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
    saved: !!contact.saved,
    savedAt: contact.savedAt || null,
  };
}

// Save a contact into the session's address book. Idempotent: repeated calls
// never create duplicates or repeat writes. Works against the session's own
// contact store (fed by the connected WhatsApp account) — no scraping, no
// browser automation, no WhatsApp-restriction workarounds.
app.post('/api/message-agent/contacts/save', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return res.status(400).json({ error: 'Invalid phone number' });

    const contacts = loadContacts();
    const contact = contacts.find(c => belongsToSession(c) && normalizePhone(c.phone) === cleanPhone);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const alreadySaved = !!contact.saved;
    if (!alreadySaved) {
      contact.saved = true;
      contact.savedAt = new Date().toISOString();
      contact.updatedAt = contact.savedAt;
      saveContacts(contacts);
    }

    broadcastAll({ type: 'MESSAGE_AGENT_UPDATE', action: 'contact_updated', contact: savedContactEnvelope(contact) });
    res.json({ success: true, saved: true, alreadySaved });
  } catch (err) {
    console.error('Error saving contact:', err);
    res.status(500).json({ error: 'Failed to save contact' });
  }
});

// Remove the saved flag (inverse of save). Idempotent — removing a contact that
// was never saved is a no-op, and no duplicate deletion can occur.
app.post('/api/message-agent/contacts/unsave', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return res.status(400).json({ error: 'Invalid phone number' });

    const contacts = loadContacts();
    const contact = contacts.find(c => belongsToSession(c) && normalizePhone(c.phone) === cleanPhone);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const alreadyUnsaved = !contact.saved;
    if (!alreadyUnsaved) {
      contact.saved = false;
      contact.savedAt = null;
      contact.updatedAt = new Date().toISOString();
      saveContacts(contacts);
    }

    broadcastAll({ type: 'MESSAGE_AGENT_UPDATE', action: 'contact_updated', contact: savedContactEnvelope(contact) });
    res.json({ success: true, saved: false, alreadyUnsaved });
  } catch (err) {
    console.error('Error unsaving contact:', err);
    res.status(500).json({ error: 'Failed to remove saved contact' });
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

// --- AI Provider Management (unified, encrypted, routed) ---

app.get('/api/message-agent/ai-providers', (req, res) => {
  try {
    const providers = aiManager.listForClient();
    const settings = aiManager.loadSettings();
    res.json({ success: true, providers, settings, maxProviders: aiCatalog.DEFAULT_MAX_PROVIDERS });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load AI providers' });
  }
});

app.post('/api/message-agent/ai-providers', async (req, res) => {
  try {
    const { apiKey, provider, name, displayName, model, priority, enabled } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and API key are required' });
    }
    if (req.body.testOnly) {
      try {
        const ok = await aiManager.validateKey({
          apiKey,
          provider,
          model,
          baseUrl: req.body.baseUrl,
          azureResource: req.body.azureResource,
          azureDeployment: req.body.azureDeployment,
          apiVersion: req.body.apiVersion,
        });
        return res.json({ success: true, validation: { status: 'connected', error: null, model: ok.result && ok.result.model } });
      } catch (err) {
        const category = err.category || 'UNKNOWN';
        const message = err.message || 'Connection could not be verified';
        return res.json({ success: true, validation: { status: 'connection_failed', error: message, category } });
      }
    }
    const existing = aiManager.getAll();
    if (existing.length >= aiCatalog.DEFAULT_MAX_PROVIDERS) {
      return res.status(400).json({ error: `Maximum ${aiCatalog.DEFAULT_MAX_PROVIDERS} AI providers allowed` });
    }
    const saved = aiManager.add(req.body);
    let validation = { status: 'configuring', error: null };
    try {
      const ok = await aiManager.validateKey({
        apiKey,
        provider,
        model,
        baseUrl: req.body.baseUrl,
        azureResource: req.body.azureResource,
        azureDeployment: req.body.azureDeployment,
        apiVersion: req.body.apiVersion,
      });
      aiManager.update(saved.id, { status: 'connected', validatedAt: new Date().toISOString() });
      validation = { status: 'connected', error: null, model: ok.result && ok.result.model };
    } catch (err) {
      const category = err.category || 'UNKNOWN';
      const message = err.message || 'Connection could not be verified';
      aiManager.update(saved.id, { status: 'connection_failed', connectionError: message });
      validation = { status: 'connection_failed', error: message, category };
    }
    res.json({ success: true, provider: secureRedact(saved), validation });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to add AI provider' });
  }
});

app.get('/api/message-agent/ai-providers/catalog', (req, res) => {
  res.json({ success: true, catalog: aiCatalog.PROVIDER_CATALOG });
});

app.get('/api/message-agent/ai-providers/usage', (req, res) => {
  try {
    res.json({ success: true, ...aiUsage.summary() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load AI usage' });
  }
});

app.get('/api/message-agent/ai-routing', (req, res) => {
  try {
    res.json({ success: true, settings: aiManager.loadSettings() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load AI routing settings' });
  }
});

app.put('/api/message-agent/ai-routing', (req, res) => {
  try {
    const settings = aiManager.saveSettings(req.body || {});
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save AI routing settings' });
  }
});

app.put('/api/message-agent/ai-providers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const provider = aiManager.update(id, updates);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    let keyPreview = '';
    try {
      const dec = aiManager.decode(provider);
      if (dec) keyPreview = String(dec).slice(-4);
    } catch { /* keep empty preview */ }
    res.json({ success: true, provider: secureRedact(provider), keyPreview });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update AI provider' });
  }
});

app.post('/api/message-agent/ai-providers/reorder', (req, res) => {
  try {
    const { orderedIds } = req.body || {};
    const providers = aiManager.reorder(orderedIds);
    if (!providers) return res.status(400).json({ error: 'Invalid provider order' });
    res.json({ success: true, providers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder AI providers' });
  }
});

app.delete('/api/message-agent/ai-providers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const removed = aiManager.remove(id);
    if (!removed) return res.status(404).json({ error: 'Provider not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete AI provider' });
  }
});

app.post('/api/message-agent/ai-providers/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    if (!aiManager.findById(id)) return res.status(404).json({ error: 'Provider not found' });
    const result = await aiManager.testProvider(id);
    aiManager.update(id, { status: 'connected', validatedAt: new Date().toISOString(), connectionError: '' });
    res.json({ success: true, ...result });
  } catch (err) {
    const id = req.params.id;
    aiManager.update(id, { status: 'connection_failed', connectionError: err.message });
    res.status(400).json({ success: false, error: err.message, category: err.category });
  }
});

app.get('/api/message-agent/ai-providers/:id/models', async (req, res) => {
  try {
    const { id } = req.params;
    const provider = aiManager.findById(id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const models = await aiManager.listModels(provider.provider, aiManager.decode(provider));
    res.json({ success: true, models });
  } catch (err) {
    const { id } = req.params;
    const provider = aiManager.findById(id);
    res.json({ success: true, models: provider ? aiCatalog.getModels(provider.provider) : [] });
  }
});

app.post('/api/message-agent/ai-providers/discover-models', async (req, res) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    if (!provider) return res.status(400).json({ error: 'Provider type is required' });
    if (!apiKey) return res.status(400).json({ error: 'API key is required' });
    const models = await aiManager.discoverModels(provider, apiKey, baseUrl);
    res.json({ success: true, models, count: models.length });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to discover models' });
  }
});

// AI generate response endpoint
app.post('/api/message-agent/ai-generate', aiGenerateLimiter.middleware(), async (req, res) => {
  try {
    const { message, conversationHistory, contact, businessProfile, crm, journey, notes, notesList, aiObjective } = req.body;

    const enrichedContact = {
      ...(contact || {}),
      crm: crm || null,
      journey: journey || null,
      notes: notesList && notesList.length ? notesList.map(n => n.text).filter(Boolean).join('\n') : (notes || ''),
      aiObjective: aiObjective || null,
    };

    const systemPrompt = buildSystemPrompt(enrichedContact, businessProfile);
    const history = (conversationHistory || []).slice(-10).map(m => ({
      role: m.from === 'me' ? 'assistant' : 'user',
      content: m.text,
    }));

    if (aiManager.getEnabled().length === 0) {
      return res.json({
        success: true,
        response: generateFallbackResponse(message, conversationHistory, contact),
        provider: 'fallback',
        confidence: 0.5,
        model: null,
      });
    }

    const result = await aiManager.complete({ system: systemPrompt, history, user: message, temperature: 0.7, maxTokens: 500 });

    if (result.ok) {
      return res.json({
        success: true,
        response: result.text,
        provider: result.provider,
        providerType: result.providerType,
        model: result.model,
        confidence: 0.85,
        latencyMs: result.latencyMs,
      });
    }
    res.json({
      success: true,
      response: generateFallbackResponse(message, conversationHistory, contact),
      provider: 'fallback',
      confidence: 0.5,
      aiError: result.error,
    });
  } catch (err) {
    console.error('Error generating AI response:', err);
    res.json({
      success: true,
      response: generateFallbackResponse(req.body.message, req.body.conversationHistory, req.body.contact),
      provider: 'fallback',
      confidence: 0.5,
    });
  }
});

function buildSystemPrompt(contact, businessProfile) {
  const bp = businessProfile || {};
  const journeyLabels = {
    new_lead: 'New Lead',
    contacted: 'Contacted',
    interested: 'Interested',
    negotiation: 'In Negotiation',
    converted: 'Converted',
    closed: 'Closed',
  };
  const objectives = {
    lead_qualification: 'Qualify the lead - identify their needs, budget, timeline and decision authority before pitching.',
    product_inquiry: 'Answer product/service questions accurately and guide toward a purchase decision.',
    follow_up: 'Politely follow up on an earlier conversation without being pushy.',
    appointment: 'Help the customer book/reschedule an appointment or inquiry slot.',
    conversion: 'Move the customer toward closing the sale with clear next steps and urgency where appropriate.',
    general: 'Respond helpfully and professionally while keeping the conversation flowing naturally.',
  };
  const objectiveText = objectives[contact?.aiObjective] || objectives.general;
  const journeyText = journeyLabels[contact?.journey] || null;
  const notesText = contact?.notes || '';

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

Customer's country: ${contact?.country || 'Unknown'}
Customer's name: ${contact?.name || 'Unknown'}
${contact?.about ? `Customer's profile: ${contact.about}` : ''}

CRM context:
- Current pipeline stage: ${journeyText || 'Not set'}
- Conversation objective: ${objectiveText}
- You may advance the customer through the sales journey naturally (e.g. New Lead -> Contacted -> Interested -> In Negotiation -> Converted) only when the conversation genuinely warrants it. Never pretend the stage changed without real progress.
${notesText ? `Internal notes about this customer (context only, never repeat them verbatim to the customer):\n${notesText}\n` : ''}
${contact?.crm?.company ? `Customer's company: ${contact.crm.company}` : ''}
${contact?.crm?.position ? `Customer's position: ${contact.crm.position}` : ''}

Respond naturally and professionally. Do not use overly formal language. Be helpful and solution-oriented. Do not reveal that you are an automated agent unless asked directly.`;
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

// --- Meta / WhatsApp Cloud API (AI Agents, official templates & campaigns, inbox, dashboard) ---
const { createMetaRouter } = require('./services/meta/meta-router');
// Guard the Meta management API behind a Shield login, but keep the inbound
// webhook public: Meta cannot present a browser session, so it is authenticated
// by X-Hub-Signature-256 + verify token instead.
app.use('/api/meta', (req, res, next) => {
  if (req.path === '/webhook') return next();
  return requireShieldAuth(req, res, next);
});
app.use('/api/meta', createMetaRouter({ sessionOwnerPhone, broadcastAll }));

// --- AI Orchestrator: central decision layer (intent -> agent -> action -> CRM) ---
const { runOrchestrator } = require('./services/ai/orchestrator');
app.post('/api/message-agent/ai-orchestrator', async (req, res) => {
  try {
    const result = await runOrchestrator(req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('AI Orchestrator error:', err);
    res.status(500).json({ success: false, error: err.message || 'Orchestrator failed' });
  }
});

app.post('/api/message-agent/ai-orchestrator/handoff', async (req, res) => {
  try {
    const { generateSummary } = require('./services/ai/orchestrator');
    const { conversation = {}, contact = {}, providerId, model } = req.body || {};
    const summary = await generateSummary({ conversation, contact, providerId, model });
    res.json({ success: true, summary });
  } catch (err) {
    console.error('AI Orchestrator handoff error:', err);
    res.status(500).json({ success: false, error: err.message || 'Handoff summary failed' });
  }
});

// --- Verified Lead Transfer settings (Shield -> Message Agent) ---
const TRANSFER_RULES_FILE = path.join(__dirname, 'transfer_rules.json');
const DEFAULT_TRANSFER_RULES = {
  enabled: true,
  defaultJourney: 'new_lead',
  addTags: ['shield_verified'],
  mapShieldStage: { registered: 'new_lead', unregistered: 'new_lead' },
  skipUnregistered: false,
};

app.get('/api/message-agent/lead-transfer', (req, res) => {
  try {
    const rules = Object.assign({}, DEFAULT_TRANSFER_RULES, loadJsonFile(TRANSFER_RULES_FILE, {}));
    res.json({ success: true, rules });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load lead transfer settings' });
  }
});

app.put('/api/message-agent/lead-transfer', (req, res) => {
  try {
    const body = req.body || {};
    const next = Object.assign({}, DEFAULT_TRANSFER_RULES, {
      enabled: body.enabled !== undefined ? !!body.enabled : DEFAULT_TRANSFER_RULES.enabled,
      defaultJourney: body.defaultJourney || DEFAULT_TRANSFER_RULES.defaultJourney,
      addTags: Array.isArray(body.addTags) ? body.addTags.slice(0, 8) : DEFAULT_TRANSFER_RULES.addTags,
      mapShieldStage: body.mapShieldStage && typeof body.mapShieldStage === 'object' ? body.mapShieldStage : DEFAULT_TRANSFER_RULES.mapShieldStage,
      skipUnregistered: !!body.skipUnregistered,
    }, { updatedAt: new Date().toISOString() });
    saveJsonFile(TRANSFER_RULES_FILE, next);
    res.json({ success: true, rules: next });
  } catch (err) {
    console.error('Error saving lead transfer settings:', err);
    res.status(500).json({ error: 'Failed to save lead transfer settings' });
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

// --- API 404 + Global Error Handling ---
// Unknown /api/* routes get a clean JSON 404 (not the SPA fallback), and any
// uncaught sync error or body-parser failure (malformed JSON, oversized payload)
// becomes a bounded JSON response instead of an HTML error or a crashed request.

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message && /origin not allowed/i.test(err.message)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (err && err.type === 'entity.verify.failed') {
    return res.status(400).json({ error: 'Request body validation failed' });
  }
  console.error('[STABILITY] Uncaught route error:', safeError(err));
  res.status(500).json({ error: 'Internal server error' });
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

// Server-side WebSocket keep-alive + zombie cleanup.
// The single client keep-alive sweep lives in the "WebSocket liveness" section
// above (30s ping, 90s grace). It must not be duplicated here: two sweeps with
// competing flags were what terminated healthy sockets mid-scan.

// --- Health registry updates ---
// Periodically report recoverable component state so /api/health and /api/ready
// reflect reality without ever causing an app restart.
const updateHealthRegistry = () => {
  const waStatus = whatsAppService.status || 'DISCONNECTED';
  healthRegistry.report('whatsapp', waStatus === 'CONNECTED' ? 'ok' : 'degraded', waStatus);
  try {
    const probe = path.join(__dirname, 'cache');
    if (!fs.existsSync(probe)) fs.mkdirSync(probe, { recursive: true });
    healthRegistry.report('disk', 'ok', null);
  } catch (err) {
    healthRegistry.report('disk', 'degraded', safeError(err, false));
  }
};
setInterval(updateHealthRegistry, 30000);
updateHealthRegistry();

// --- Profile-picture cache maintenance ---
// Periodic sweep keeps backend/cache/profile-pictures bounded: any cached image
// not referenced by a remaining campaign or contact (after a grace period) is
// removed, and a hard ceiling guarantees the directory can never accumulate
// thousands of obsolete files over time. Runs every 6 hours plus once shortly
// after startup to clean up leftovers from previous sessions.
const sweepProfilePicCacheNow = () => campaignService.sweepProfilePicCache({ minAgeMs: 15 * 60 * 1000 });
setInterval(sweepProfilePicCacheNow, 6 * 60 * 60 * 1000).unref?.();
setTimeout(sweepProfilePicCacheNow, 30 * 1000).unref?.();

// A graceful shutdown must still persist the results buffered in the journal,
// so a restart never loses the last few lookups of a scan.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    try { scanJournal.flushSync(); } catch (_) { /* best effort */ }
  });
}

// --- Process-level crash guards ---
// A single bad lookup, socket event or stray promise must NEVER take the whole
// backend down: when it dies, Vite's proxy turns every /api call and the
// WebSocket into ECONNREFUSED and Live Scan dies with it. These handlers log
// the real error (so the cause is visible in the terminal) and keep serving.
const describeFatal = (err) => {
  if (!err) return 'Unknown error';
  if (err instanceof Error) return `${err.name}: ${err.message}\n${err.stack || ''}`;
  try { return `Non-error rejection: ${JSON.stringify(err)}`; } catch (_) { return String(err); }
};

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL-GUARD] Unhandled promise rejection (server kept alive):\n' + describeFatal(reason));
  appendShieldLog('ERROR', 'Unhandled promise rejection contained by process guard.', {});
  audit({ action: 'process.unhandled_rejection', outcome: 'contained' });
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL-GUARD] Uncaught exception (server kept alive):\n' + describeFatal(err));
  appendShieldLog('ERROR', 'Uncaught exception contained by process guard.', {});
  audit({ action: 'process.uncaught_exception', outcome: 'contained' });
  // Tell any connected client the backend is degraded rather than letting the UI
  // sit on a frozen socket; the frontend shows a single "backend offline" line.
  try {
    broadcastAll({ type: 'BACKEND_DEGRADED', message: 'Backend recovered from an internal error and is still running.' });
  } catch (_) { /* never rethrow from the guard itself */ }
});

// --- Export for Vercel serverless ---
module.exports = app;

// --- Start Server (standalone) ---
if (!process.env.VERCEL) {
  // A bind failure MUST be fatal. If it were swallowed by the process guard
  // below, the process would stay alive while serving nothing - and, worse, it
  // would still open a SECOND WhatsApp socket on the same session folder,
  // fighting the healthy instance for credentials and flapping the session
  // (which is what made Live Scan drop right after Pause).
  server.on('error', (err) => {
    if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
      console.error(`[FATAL] Cannot bind port ${PORT} (${err.code}). Another WhatsApp Shield backend is already running. Close it first (or stop the other terminal) and retry.`);
      process.exit(1);
    }
    console.error('[FATAL] HTTP server error:', err);
    process.exit(1);
  });
  server.listen(PORT, () => {
    console.log(`WhatsApp Shield server running on port ${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
  });
}

// --- Memory protection ---
// Long-running bulk scans accumulate per-number caches. If the heap climbs past
// a soft cap, purge the bounded in-memory caches (avatars stay on disk, so this
// never breaks the UI) and log the event. This runs independent of the event
// loop and unrefs so it never keeps the process alive by itself.
const memoryWatchdog = new MemoryWatchdog({
  onPressure: ({ heapMb, rssMb }) => {
    const cleared = profilePicCache.size;
    profilePicCache.clear();
    profilePicInFlight.clear();
    console.warn(`[STABILITY] Memory pressure (heap ${heapMb}MB, rss ${rssMb}MB). Cleared ${cleared} cached profile pictures.`);
  }
});

// --- Graceful shutdown ---
// On SIGTERM/SIGINT: stop accepting new work, flush pending JSON saves, close
// WebSockets, and exit cleanly. The WhatsApp session file is left untouched so
// a restart restores the same session. Never force-kills in-flight operations.
let shuttingDown = false;
const gracefulShutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[STABILITY] ${signal} received — shutting down gracefully.`);
  try { stopBulkCheck(); } catch (_) {}
  try { flushCampaignHistory(); } catch (_) {}
  const forceExit = setTimeout(() => process.exit(0), 10000);
  if (forceExit.unref) forceExit.unref();
  try {
    for (const ws of clients) { try { ws.close(); } catch (_) {} }
  } catch (_) {}
  // Flush the Signal key store BEFORE closing the socket so a restart resumes
  // from a consistent creds.json / pre-key set (a truncated write here is a
  // direct cause of undecryptable sessions).
  Promise.resolve()
    .then(() => whatsAppService.flushAuthState())
    .catch(() => {})
    .then(() => { try { sessionLock.release(); } catch (_) {} })
    .then(() => new Promise((resolve) => {
      const done = () => { try { memoryWatchdog.dispose(); } catch (_) {} clearTimeout(forceExit); resolve(); };
      try { server.close(done); } catch (_) { done(); }
    }))
    .then(() => process.exit(0));
};
