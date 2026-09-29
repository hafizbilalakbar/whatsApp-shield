// Backend safety mechanisms — rate limiting, single-flight locks, and request guards.
// These exist to keep WhatsApp interaction volumes human-natural and to protect
// against accidental or abusive bursts. No frontend/UI changes are required.

// --- Rate Limiter (in-memory, sliding window per key) ---
class RateLimiter {
  constructor({ windowMs = 60000, max = 60, name = 'limiter' } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.name = name;
    this.hits = new Map();
    this._pruneTimer = setInterval(() => this._prune(), 60000);
    if (this._pruneTimer.unref) this._pruneTimer.unref();
  }

  _now() {
    return Date.now();
  }

  _prune() {
    const now = this._now();
    for (const [key, entry] of this.hits) {
      if (now - entry.resetAt >= this.windowMs) {
        this.hits.delete(key);
      }
    }
  }

  _keyFor(req) {
    return (
      req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  // Returns { allowed: boolean, retryAfterMs }
  check(key) {
    const now = this._now();
    let entry = this.hits.get(key);
    if (!entry || now - entry.resetAt >= this.windowMs) {
      entry = { count: 0, resetAt: now, firstAt: now };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > this.max) {
      return { allowed: false, retryAfterMs: entry.resetAt + this.windowMs - now };
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  // Read-only check: reports whether the key is currently over the limit WITHOUT
  // incrementing the counter. Used for passive guards (e.g. WebSocket control
  // frames) where every legit event already passes through and we only want to
  // short-circuit a flood.
  isBlocked(key) {
    const now = this._now();
    const entry = this.hits.get(key);
    if (!entry) return false;
    if (now - entry.resetAt >= this.windowMs) {
      this.hits.delete(key);
      return false;
    }
    return entry.count > this.max;
  }

  // Counts a hit without inspecting the cap; lets a caller charge events
  // regardless of the limit (used to keep the per-socket counter honest).
  charge(key) {
    const now = this._now();
    let entry = this.hits.get(key);
    if (!entry || now - entry.resetAt >= this.windowMs) {
      entry = { count: 0, resetAt: now, firstAt: now };
      this.hits.set(key, entry);
    }
    entry.count += 1;
  }

  middleware() {
    return (req, res, next) => {
      const key = this._keyFor(req);
      const result = this.check(key);
      if (!result.allowed) {
        return res.status(429).json({
          error: `Rate limit exceeded (${this.name}). Please wait a moment and try again.`,
          retryAfterMs: result.retryAfterMs
        });
      }
      next();
    };
  }
}

// --- Single-flight lock (prevents concurrent bulk operations) ---
class SingleFlight {
  constructor(name = 'operation') {
    this.name = name;
    this.active = false;
    this.lastStartedAt = 0;
  }

  tryAcquire() {
    if (this.active) return false;
    this.active = true;
    this.lastStartedAt = Date.now();
    return true;
  }

  release() {
    this.active = false;
  }

  get isActive() {
    return this.active;
  }
}

// --- Number sanitization for bulk checks ---
// Dedupes, strips non-digits, rejects obviously invalid numbers, and caps batch
// size. The ceiling is generous (10k) so real campaigns are never truncated —
// it exists only as a sanity bound against absurdly large request bodies, not
// as a per-campaign product quota.
function sanitizeNumbers(numbers, maxBatch = 10000) {
  if (!Array.isArray(numbers)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of numbers) {
    if (out.length >= maxBatch) break;
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const clean = String(raw).replace(/\D/g, '');
    if (clean.length < 8 || clean.length > 15) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

// --- Delay clamping for bulk loops ---
// Enforces a natural minimum spacing between checks and a sane ceiling.
function clampDelay(delayMs, shieldMode) {
  let delay = Number(delayMs);
  if (!Number.isFinite(delay) || delay <= 0) delay = shieldMode ? 3000 : 1200;
  const min = shieldMode ? 1200 : 600;
  const max = 30000;
  if (delay < min) delay = min;
  if (delay > max) delay = max;
  return delay;
}

// --- Jitter clamping (algorithmic randomization of the inter-check delay) ---
// The UI exposes jitter as a percentage (0-100). The backend re-validates it
// here so a tampered/edited client can never push the scan outside a safe
// band, and so the ETA the UI shows can be computed from the same numbers the
// scan loop actually enforces.
const DEFAULT_JITTER_PCT = 50;

// Normalises a client-supplied jitter percentage to a 0..1 fraction.
//
// `Number()` coerces null, '', false and [] to 0, so a missing or malformed
// field would silently become "0% jitter" - a perfectly even request rhythm
// and the most machine-like pattern possible. Only a real, finite number is
// honoured; everything else falls back to the safe default. An explicit 0 IS
// honoured, because the Safety step legitimately offers 0-100% and silently
// overriding the user's choice would desync the UI from what is enforced.
function clampJitter(jitterPct) {
  let pct = DEFAULT_JITTER_PCT;
  if (typeof jitterPct === 'number') {
    if (Number.isFinite(jitterPct)) pct = jitterPct;
  } else if (typeof jitterPct === 'string') {
    const trimmed = jitterPct.trim();
    if (trimmed !== '') {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) pct = parsed;
    }
  }
  if (pct < 0) pct = DEFAULT_JITTER_PCT;   // nonsense value -> safe default
  if (pct > 100) pct = 100;                 // clamp the band, never widen it
  return pct / 100; // returns a 0..1 fraction
}

// --- Effective per-check delay ---
// Single source of truth for the randomized inter-check wait. Both the scan
// loop and the ETA estimator derive their numbers from this function, so the
// time the user is shown can never drift from the time actually enforced.
const COOLDOWN_EVERY = 10;   // short shield rest, every 10 checks
const COOLDOWN_MS = 5000;     // 5s
const LONG_BREAK_EVERY = 100; // extended randomized rest, every 100 checks
const LONG_BREAK_MIN_MS = 20000;
const LONG_BREAK_MAX_MS = 45000;

function effectiveDelayMs(baseDelay, jitterFraction, isShieldMode) {
  const base = clampDelay(baseDelay, isShieldMode);
  if (!isShieldMode) {
    // Fast mode: no randomization, but a hard floor so bursts stay impossible.
    return Math.max(1000, base * 0.3);
  }
  // Shield mode: uniform random walk inside baseDelay ± jitter% of baseDelay.
  const spread = base * jitterFraction;
  const raw = base + (Math.random() * 2 - 1) * spread;
  return Math.max(1000, Math.round(raw));
}

// Deterministic companion to effectiveDelayMs used for ETA math (no RNG).
function delayRangeMs(baseDelay, jitterFraction, isShieldMode) {
  const base = clampDelay(baseDelay, isShieldMode);
  if (!isShieldMode) {
    const flat = Math.max(1000, base * 0.3);
    return { min: flat, max: flat };
  }
  const spread = base * jitterFraction;
  return { min: Math.max(1000, Math.round(base - spread)), max: Math.max(1000, Math.round(base + spread)) };
}

// Total expected wall-clock for a batch, including both rest tiers.
function estimateTotalMs({ audienceSize, baseDelay, jitterFraction, isShieldMode }) {
  if (!audienceSize || audienceSize <= 0) return 0;
  const { min, max } = delayRangeMs(baseDelay, jitterFraction, isShieldMode);
  const avg = (min + max) / 2;
  // Rest only happens *between* checks, so a batch of N has N-1 gaps.
  const gaps = Math.max(0, audienceSize - 1);
  const shortRests = Math.floor(gaps / COOLDOWN_EVERY);
  // Long breaks are randomized; estimate their midpoint.
  const longBreaks = Math.floor(gaps / LONG_BREAK_EVERY);
  const longAvg = (LONG_BREAK_MIN_MS + LONG_BREAK_MAX_MS) / 2;
  const cooldownMs = isShieldMode
    ? shortRests * COOLDOWN_MS + longBreaks * longAvg
    : 0;
  return avg * gaps + cooldownMs;
}

function longBreakMs() {
  return Math.round(LONG_BREAK_MIN_MS + Math.random() * (LONG_BREAK_MAX_MS - LONG_BREAK_MIN_MS));
}

module.exports = {
  RateLimiter,
  SingleFlight,
  sanitizeNumbers,
  clampDelay,
  clampJitter,
  effectiveDelayMs,
  delayRangeMs,
  estimateTotalMs,
  longBreakMs,
  COOLDOWN_EVERY,
  COOLDOWN_MS,
  LONG_BREAK_EVERY,
  LONG_BREAK_MIN_MS,
  LONG_BREAK_MAX_MS,
};
