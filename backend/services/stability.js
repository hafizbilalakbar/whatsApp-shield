// Backend production-stability primitives — global error containment, circuit
// breakers, memory protection, and safe logging. No UI/functional changes.

const MEMORY_SOFT_LIMIT_MB = Number(process.env.MEMORY_SOFT_LIMIT_MB) || 512;
const CIRCUIT_FAILURE_THRESHOLD = Number(process.env.CIRCUIT_FAILURE_THRESHOLD) || 5;
const CIRCUIT_RESET_MS = Number(process.env.CIRCUIT_RESET_MS) || 30000;
const CIRCUIT_HALF_OPEN_MS = Number(process.env.CIRCUIT_HALF_OPEN_MS) || 5000;

// --- Safe logging ---
// Redacts anything that looks like a credential/secret so production logs never
// leak API keys, WhatsApp session payloads, or bearer tokens.
const SECRET_PATTERNS = [
  /["']?Authorization["']?\s*[:=]\s*["']?Bearer\s+\S+/gi,
  /["']?x-api-key["']?\s*[:=]\s*["']?[^"',}\]]+/gi,
  /["']?api[_-]?key["']?\s*[:=]\s*["']?[^"',}\]]+/gi,
  /[A-Za-z0-9+/]{40,}={0,2}/g,
];

function redact(value) {
  if (typeof value === 'string') {
    let out = value;
    for (const re of SECRET_PATTERNS) out = out.replace(re, '[REDACTED]');
    return out;
  }
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') {
    try {
      return redact(JSON.stringify(value));
    } catch (_) {
      return '[Unserializable]';
    }
  }
  return String(value);
}

function safeError(err, includeStack = true) {
  if (!(err instanceof Error)) return String(err);
  const safe = { name: err.name, message: redact(err.message) };
  if (includeStack && err.stack) safe.stack = redact(err.stack);
  return safe;
}

// --- Global process error containment ---
// Keeps the process alive on recoverable errors instead of letting Node crash
// on a single stray rejection/exception. Healthy sessions and connected users
// are preserved; only the failed operation is isolated.
function installProcessHandlers() {
  process.on('uncaughtException', (err) => {
    try {
      console.error('[STABILITY] uncaughtException (kept alive):', safeError(err));
    } catch (_) {}
  });

  process.on('unhandledRejection', (reason) => {
    try {
      console.error('[STABILITY] unhandledRejection (kept alive):', safeError(reason));
    } catch (_) {}
  });

  process.on('warning', (warning) => {
    if (warning && /MaxListeners|Possible EventEmitter memory leak/.test(warning.message || '')) {
      try {
        console.warn('[STABILITY] EventEmitter warning:', warning.name, warning.message);
      } catch (_) {}
    }
  });
}

// --- Circuit breaker ---
// Opens after repeated upstream failures, rejects fast while open (degraded
// mode), then half-opens after a cooldown to probe recovery. Auto-recovery.
class CircuitBreaker {
  constructor({ name = 'service', failureThreshold = CIRCUIT_FAILURE_THRESHOLD, resetMs = CIRCUIT_RESET_MS, halfOpenMs = CIRCUIT_HALF_OPEN_MS, onStateChange } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetMs = resetMs;
    this.halfOpenMs = halfOpenMs;
    this.state = 'closed'; // closed | open | half-open
    this.failures = 0;
    this.openedAt = 0;
    this.lastError = null;
    this.onStateChange = onStateChange;
  }

  get isAvailable() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.openedAt >= this.resetMs) {
        this._setState('half-open');
        return true; // allow one probe request
      }
      return false;
    }
    return true; // half-open: allow the single probe
  }

  get degraded() {
    return this.state !== 'closed';
  }

  _setState(state) {
    if (this.state === state) return;
    this.state = state;
    if (this.onStateChange) {
      try { this.onStateChange(this.name, state, this.lastError); } catch (_) {}
    }
  }

  recordFailure(err) {
    this.failures += 1;
    this.lastError = err;
    if (this.state === 'half-open') {
      this._setState('open');
      this.openedAt = Date.now();
      return;
    }
    if (this.failures >= this.failureThreshold) {
      this._setState('open');
      this.openedAt = Date.now();
    }
  }

  recordSuccess() {
    this.failures = 0;
    this.lastError = null;
    if (this.state !== 'closed') this._setState('closed');
  }

  // Run fn guarded by the circuit. Returns { ok, result } or { ok:false, error }.
  async run(fn) {
    if (!this.isAvailable) {
      return { ok: false, error: new Error(`Service ${this.name} is unavailable (circuit open). Using degraded mode.`), circuitOpen: true };
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return { ok: true, result };
    } catch (err) {
      this.recordFailure(err);
      return { ok: false, error: err };
    }
  }
}

// --- Memory watchdog ---
// Monitors heap usage; when it crosses a soft cap it fires onPressure so the
// caller can clear bounded caches, and it forces the GC if exposed.
class MemoryWatchdog {
  constructor({ softLimitMb = MEMORY_SOFT_LIMIT_MB, onPressure, intervalMs = 30000 } = {}) {
    this.softLimitMb = softLimitMb;
    this.onPressure = onPressure;
    this._timer = setInterval(() => this._check(), intervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  heapMb() {
    const stats = process.memoryUsage();
    return Math.round(stats.heapUsed / 1024 / 1024);
  }

  rssMb() {
    return Math.round(process.memoryUsage().rss / 1024 / 1024);
  }

  _check() {
    const mb = this.heapMb();
    if (mb > this.softLimitMb && this.onPressure) {
      try { this.onPressure({ heapMb: mb, rssMb: this.rssMb() }); } catch (_) {}
    }
  }

  dispose() {
    clearInterval(this._timer);
  }
}

// --- Health registry ---
// Components report their status; /api/health reports liveness, /api/ready
// reports readiness of recoverable dependencies.
class HealthRegistry {
  constructor() {
    this.components = new Map(); // name -> { status, detail, updatedAt }
  }

  report(name, status, detail = null) {
    this.components.set(name, { status, detail, updatedAt: new Date().toISOString() });
  }

  snapshot() {
    const out = {};
    for (const [name, entry] of this.components) {
      out[name] = { status: entry.status, detail: entry.detail || null };
    }
    return out;
  }

  isReady(required = []) {
    for (const name of required) {
      const entry = this.components.get(name);
      if (entry && entry.status !== 'ok') return false;
    }
    return true;
  }
}

module.exports = {
  redact,
  safeError,
  installProcessHandlers,
  CircuitBreaker,
  MemoryWatchdog,
  HealthRegistry,
};