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

module.exports = { RateLimiter, SingleFlight, sanitizeNumbers, clampDelay };
