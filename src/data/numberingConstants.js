/* ============================================================================
   WhatsApp Shield — Number Generation Constants
   ----------------------------------------------------------------------------
   ONE source of truth for every limit, budget and rejection rule used by the
   number generator (UI and engine). Keeping them together guarantees the UI cap
   and the engine cap can never disagree.
   ============================================================================ */

export const LIMITS = {
  /** Maximum quantity the UI will accept in Random / Region-Wise modes. */
  UI_MAX_QTY: 50000,
  /** Absolute engine ceiling, regardless of what the UI asks for. */
  ENGINE_MAX_QTY: 500000,
  /** Maximum sequential range span (end - start + 1). */
  SEQUENTIAL_MAX: 10000,
  /** Attempts per requested number before the engine gives up. */
  MAX_ATTEMPT_FACTOR: 60,
  /** Minimum attempts regardless of how few numbers were requested. */
  MIN_TOTAL_ATTEMPTS: 20000,
  /** Give up after this many consecutive empty attempts... */
  STALL_FLOOR: 5000,
  /** ...or this many per usable prefix, whichever is larger. */
  STALL_POOL_FACTOR: 20,
  /** Wall-clock budget for one whole job (all buckets), in ms. */
  TOTAL_TIME_BUDGET_MS: 8000,
  /** Accepted numbers produced per async slice before yielding. */
  CHUNK_SIZE: 200,
  /** Minimum time between yields so the UI can paint, in ms. */
  CHUNK_YIELD_MS: 12,
  /** Operator prefixes shorter than this are ignored (too coarse to be safe). */
  MIN_OPERATOR_PREFIX_LEN: 2,
};

/* Backwards-friendly named exports. */
export const UI_MAX_QTY = LIMITS.UI_MAX_QTY;
export const HARD_MAX_QUANTITY = LIMITS.ENGINE_MAX_QTY;
export const SEQUENTIAL_RANGE_LIMIT = LIMITS.SEQUENTIAL_MAX;
export const MAX_ATTEMPT_FACTOR = LIMITS.MAX_ATTEMPT_FACTOR;
export const MIN_TOTAL_ATTEMPTS = LIMITS.MIN_TOTAL_ATTEMPTS;
export const STALL_FLOOR = LIMITS.STALL_FLOOR;
export const STALL_POOL_FACTOR = LIMITS.STALL_POOL_FACTOR;
export const TOTAL_TIME_BUDGET_MS = LIMITS.TOTAL_TIME_BUDGET_MS;

/**
 * Subscriber-part plausibility rules. These reject *implausible* synthetic
 * shapes only — never a structurally valid number. Every rule is configurable
 * and documented so the policy is explicit instead of buried in a regex.
 *
 *   rejectAllSame  : subscriber is a single repeated digit (e.g. 11111111)
 *   maxRepeatRun   : longest allowed run of one repeated digit. A run LONGER
 *                    than this is rejected. 4 means a legitimate 4-digit repeat
 *                    is ALLOWED and only 5+ in a row is dropped.
 *   rejectStaircase: subscriber is strictly ascending/descending (123456 / 654321)
 *   minSubscriberLenForRunCheck: do not apply the run rules below this length
 */
export const SUBSCRIBER_RULES = {
  rejectAllSame: true,
  maxRepeatRun: 4,
  rejectStaircase: true,
  minSubscriberLenForRunCheck: 3,
};

/**
 * Human-readable dataset provenance. `generatedAt` is stamped by
 * scripts/build-numbering-datasets.mjs and surfaced in the UI as "Data date".
 */
export const DATASET_INFO = {
  generatedAt: '2026-10-10',
  source: 'libphonenumber-js metadata + libphonenumber-geo-carrier resources',
  regenerate: 'npm run build:datasets',
};
