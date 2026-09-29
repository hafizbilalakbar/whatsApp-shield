// Scan pacing math — MUST stay in lockstep with backend/services/safety-guard.js
// (clampDelay / clampJitter / effectiveDelayMs / delayRangeMs / estimateTotalMs).
//
// The Safety step recomputes the delay range and the ETA live while the user
// drags the sliders. Those numbers have to describe the scan the backend will
// actually run, so the formulas and constants below mirror the backend exactly.
// If you change one side, change the other.

export const COOLDOWN_EVERY = 10;    // short shield rest, every 10 checks
export const COOLDOWN_MS = 5000;      // 5s
export const LONG_BREAK_EVERY = 100;  // extended randomized rest, every 100 checks
export const LONG_BREAK_MIN_MS = 20000;
export const LONG_BREAK_MAX_MS = 45000;

export const MIN_DELAY_MS = 500;
export const MAX_DELAY_MS = 10000;
export const MIN_SHIELD_DELAY_MS = 1200;
export const MIN_FAST_DELAY_MS = 600;
export const ABSOLUTE_MAX_DELAY_MS = 30000;

// Mirrors clampDelay(delayMs, shieldMode).
export function clampDelay(delayMs, shieldMode) {
  let delay = Number(delayMs);
  if (!Number.isFinite(delay) || delay <= 0) delay = shieldMode ? 3000 : 1200;
  const min = shieldMode ? MIN_SHIELD_DELAY_MS : MIN_FAST_DELAY_MS;
  if (delay < min) delay = min;
  if (delay > ABSOLUTE_MAX_DELAY_MS) delay = ABSOLUTE_MAX_DELAY_MS;
  return delay;
}

// Mirrors clampJitter(jitterPct) -> 0..1 fraction.
// Normalises a jitter percentage to a 0..1 fraction.
// Kept byte-for-byte equivalent to clampJitter() in backend/services/safety-guard.js
// so the delay range and ETA shown here can never disagree with what the server
// actually enforces. Note that Number() coerces null/''/false/[] to 0, which
// would read as "0% jitter", so only real finite numbers are honoured.
export function jitterToFraction(jitterPct) {
  let pct = 50;
  if (typeof jitterPct === 'number') {
    if (Number.isFinite(jitterPct)) pct = jitterPct;
  } else if (typeof jitterPct === 'string') {
    const trimmed = jitterPct.trim();
    if (trimmed !== '') {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) pct = parsed;
    }
  }
  if (pct < 0) pct = 50;
  if (pct > 100) pct = 100;
  return pct / 100;
}

// Mirrors delayRangeMs() — the min/max the effective delay will fluctuate between.
export function delayRangeMs(baseDelay, jitterFraction, shieldMode) {
  const base = clampDelay(baseDelay, shieldMode);
  if (!shieldMode) {
    const flat = Math.max(1000, base * 0.3);
    return { min: flat, max: flat };
  }
  const spread = base * jitterFraction;
  return { min: Math.max(1000, Math.round(base - spread)), max: Math.max(1000, Math.round(base + spread)) };
}

// Mirrors estimateTotalMs() — expected wall-clock for a batch including rests.
export function estimateTotalMs({ audienceSize, baseDelay, jitterFraction, shieldMode }) {
  if (!audienceSize || audienceSize <= 0) return 0;
  const { min, max } = delayRangeMs(baseDelay, jitterFraction, shieldMode);
  const avg = (min + max) / 2;
  const gaps = Math.max(0, audienceSize - 1);
  const shortRests = Math.floor(gaps / COOLDOWN_EVERY);
  const longBreaks = Math.floor(gaps / LONG_BREAK_EVERY);
  const longAvg = (LONG_BREAK_MIN_MS + LONG_BREAK_MAX_MS) / 2;
  const cooldownMs = shieldMode ? shortRests * COOLDOWN_MS + longBreaks * longAvg : 0;
  return avg * gaps + cooldownMs;
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0m 0s';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return `~${hours}h ${rem}m`;
  }
  return `~${minutes}m ${seconds}s`;
}

export function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

// Named presets offered in the Safety step. Each is a (baseDelay, jitter) pair
// that keeps the effective request rate inside a defensible band.
//
// The numbers are load-bearing: the backend reads exactly these values, and
// the "Custom" chip logic in Step3Safety compares against them. Only the copy
// below is presentation and may be reworded freely.
export const SAFETY_PRESETS = [
  {
    id: 'safe',
    label: 'Safe',
    description: 'Slowest and safest. Best for your main number.',
    baseDelay: 6000,
    jitter: 70,
    risk: 'low',
    tag: null,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Good speed with natural waits.',
    baseDelay: 3000,
    jitter: 50,
    risk: 'medium',
    tag: 'Recommended',
  },
  {
    id: 'fast',
    label: 'Fast',
    description: 'Quick, but higher chance of being blocked.',
    baseDelay: 1000,
    jitter: 25,
    risk: 'high',
    tag: 'Risky',
  },
];

/**
 * Live risk meter for the current configuration.
 * Scores the effective request rate, how predictable the pattern is (low
 * jitter is machine-like even at a safe delay), and raw volume.
 */
export function safetyRisk({ baseDelay, jitterFraction, shieldMode, audienceSize }) {
  if (!shieldMode) {
    return { level: 'high', label: 'High risk', tone: 'danger', reasons: ['Shield Mode is off — no jitter, no cool-downs.'] };
  }
  const { min } = delayRangeMs(baseDelay, jitterFraction, true);
  const reasons = [];
  let score = 0;

  // Request rate.
  if (min < 1500) { score += 2; reasons.push('Very short gaps between checks.'); }
  else if (min < 2500) { score += 1; reasons.push('Short gaps between checks.'); }

  // Pattern predictability. 0% is a real, selectable option, so the meter has to
  // call out the exact cost of it rather than the server quietly overriding it.
  const jitterPct = Math.round(jitterFraction * 100);
  if (jitterPct === 0) { score += 3; reasons.push('Zero jitter sends every check at an identical interval - the most machine-like pattern possible. 20%+ is strongly recommended.'); }
  else if (jitterPct < 15) { score += 2; reasons.push('Low jitter makes the pattern highly predictable.'); }
  else if (jitterPct < 35) { score += 1; reasons.push('Moderate jitter.'); }

  // Volume.
  if (audienceSize > 5000) { score += 2; reasons.push(`Very large audience (${audienceSize.toLocaleString()}).`); }
  else if (audienceSize > 1000) { score += 1; reasons.push(`Large audience (${audienceSize.toLocaleString()}).`); }

  if (score >= 4) return { level: 'high', label: 'High risk', tone: 'danger', reasons };
  if (score >= 2) return { level: 'medium', label: 'Medium risk', tone: 'warning', reasons };
  return { level: 'low', label: 'Low risk', tone: 'success', reasons };
}

/* ------------------------------------------------------------------ *
 * Plain-language helpers.
 * Everything above this line is shared with the backend and must not be
 * reworded. Everything below is presentation only: same inputs, same
 * numbers, everyday words for a non-technical audience.
 * ------------------------------------------------------------------ */

// One sentence, for the safety gauge. Deliberately not a list - the
// checklist below carries the detail.
export function riskHeadline(risk) {
  if (!risk) return '';
  if (risk.level === 'low') return 'Low risk: your waits are long and they change every time, just like a real person.';
  if (risk.level === 'medium') return 'Medium risk: some of your waits are shorter or more predictable than ideal.';
  return 'High risk: these settings can make your number easier to block. Try Safe or Balanced.';
}

// Live pass/fail checklist. `ok` drives the green/amber icon; `detail` is the
// concrete number so the user can see why, not just that something is wrong.
export function safetyChecklist({ baseDelay, jitterFraction, shieldMode, audienceSize }) {
  const { min } = delayRangeMs(baseDelay, jitterFraction, shieldMode);
  const jitterPct = Math.round(jitterFraction * 100);
  const checks = [];

  checks.push(
    shieldMode
      ? { id: 'shield', ok: true, label: 'Shield Mode is on', detail: 'Your account is being protected' }
      : { id: 'shield', ok: false, label: 'Shield Mode is off', detail: 'Turn it on to protect your number' }
  );

  if (!shieldMode) {
    checks.push({ id: 'wait', ok: false, label: 'Every wait is the same', detail: `Always ${formatSeconds(min)} apart` });
    checks.push({ id: 'variation', ok: false, label: 'Waits never change', detail: 'Turn on Shield Mode to vary them' });
  } else {
    // The pass line is deliberately the same 1500ms boundary the risk scorer
    // uses as its worst tier. A stricter line here contradicted the gauge and
    // made the recommended Balanced preset (shortest wait 1.5s) report a
    // failure while the gauge read "Low risk".
    checks.push(
      min >= 1500
        ? { id: 'wait', ok: true, label: 'Waits are long enough', detail: `Shortest wait is ${formatSeconds(min)}` }
        : { id: 'wait', ok: false, label: 'Waits are too short', detail: `Shortest wait is only ${formatSeconds(min)}. Try 3s or more.` }
    );
    checks.push(
      jitterPct >= 20
        ? { id: 'variation', ok: true, label: 'Waits look natural', detail: `They change by up to ${jitterPct}%` }
        : { id: 'variation', ok: false, label: 'Waits look the same every time', detail: `Only ${jitterPct}% change - 20% or more is safer` }
    );
  }

  if (audienceSize > 0) {
    checks.push(
      audienceSize <= 1000
        ? { id: 'batch', ok: true, label: 'Batch size is fine', detail: `${audienceSize.toLocaleString()} numbers` }
        : { id: 'batch', ok: false, label: 'Large batch: consider splitting it', detail: `${audienceSize.toLocaleString()} numbers in one go` }
    );
  } else {
    checks.push({ id: 'batch', ok: false, label: 'No numbers added yet', detail: 'Add numbers in the previous step' });
  }

  return checks;
}

// "Each wait will be between 1.5s and 4.5s. Every 10 numbers it takes a
// 5-second break, and every 100 numbers a longer 20-45 second break."
export function paceSentence({ range, shieldMode }) {
  if (!shieldMode) {
    return `Every wait is exactly ${formatSeconds(range.max)}. There are no breaks, because Shield Mode is off.`;
  }
  const shortSec = Math.round(COOLDOWN_MS / 1000);
  const longMin = Math.round(LONG_BREAK_MIN_MS / 1000);
  const longMax = Math.round(LONG_BREAK_MAX_MS / 1000);
  const rangePart =
    range.min === range.max
      ? `Every wait is ${formatSeconds(range.max)}.`
      : `Each wait will be between ${formatSeconds(range.min)} and ${formatSeconds(range.max)}.`;
  return `${rangePart} Every ${COOLDOWN_EVERY} numbers it takes a ${shortSec}-second break, and every ${LONG_BREAK_EVERY} numbers a longer ${longMin}-${longMax} second break.`;
}

// "The tool waits about 3 seconds before checking the next number."
export function waitSentence({ range, shieldMode }) {
  const mid = (range.min + range.max) / 2;
  if (!shieldMode) return `The tool waits exactly ${formatSeconds(range.max)} before checking the next number.`;
  return `The tool waits about ${formatSeconds(mid)} on average before checking the next number.`;
}

// "Each wait is changed randomly by up to 50%, so it looks like a real
// person, not a robot."
export function variationSentence({ jitterFraction, shieldMode }) {
  const pct = Math.round(jitterFraction * 100);
  if (!shieldMode) return 'Waits stay the same every time. Turn on Shield Mode to make them look human.';
  if (pct === 0) return 'Every wait is exactly the same, which is the most noticeable pattern. Try 20% or more.';
  return `Each wait is changed by up to ${pct}%, so it looks like a real person, not a robot.`;
}

// "Checking 500 numbers will take about 31 minutes. Your account stays well protected."
export function whatWillHappenSentence({ audienceSize, etaMs, risk }) {
  if (!audienceSize) return 'Add your numbers in the previous step to see how long this will take.';
  const n = audienceSize.toLocaleString();
  const time = formatDuration(etaMs).replace(/^~/, '');
  const tail =
    risk.level === 'low'
      ? 'Your account stays well protected.'
      : risk.level === 'medium'
        ? 'Your account is reasonably protected.'
        : 'Lower these settings to protect your account better.';
  return `Checking ${n} numbers will take about ${time}. ${tail}`;
}
