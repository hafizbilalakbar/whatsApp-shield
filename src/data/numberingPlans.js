import { getCountryCallingCode } from 'libphonenumber-js';
import { parsePhoneNumberFromString as parseMaxPhoneNumber } from 'libphonenumber-js/max';
import { countries, getCountryByCallingCode } from './countries.js';
import {
  ensureNumberingDatasets,
  getPrefixIndexSync,
  getOperatorsSync,
  getRegionsSync,
} from './numberingDatasets.js';
import {
  LIMITS,
  HARD_MAX_QUANTITY,
  MAX_ATTEMPT_FACTOR,
  MIN_TOTAL_ATTEMPTS,
  STALL_FLOOR,
  STALL_POOL_FACTOR,
  TOTAL_TIME_BUDGET_MS,
  SUBSCRIBER_RULES,
} from './numberingConstants.js';

/* ============================================================================
   WhatsApp Shield — Number Generation Engine
   ----------------------------------------------------------------------------
   Produces *valid, correctly formatted* numbers for every country in the app.

   Every number is built from the country's real numbering plan (discovered at
   build time from libphonenumber metadata into mobilePrefixes.json) and is then
   re-validated against libphonenumber before it is accepted:

     1. pick a (prefix, nationalLength) pair from the country's prefix pool
     2. randomize only the subscriber digits
     3. re-validate with `isValid()` AND confirm the number type is
        MOBILE / FIXED_LINE_OR_MOBILE (or FIXED_LINE for the handful of
        territories that have no mobile plan at all)
     4. assert the calling code, country and national length round-trip exactly
     5. dedupe and truncate to the requested quantity

   Pools are consumed round-robin so numbers spread evenly across every prefix
   (and therefore across regions/operators when those narrow the pool).

   The system NEVER claims a generated number belongs to a real person, brand or
   WhatsApp account. Generated numbers are synthetic/test data — they must only
   be used against authorized, consent-based or publicly provided contact lists,
   and in compliance with applicable law and WhatsApp's policies.
   ============================================================================ */

const MOBILE_TYPES = new Set(['MOBILE', 'FIXED_LINE_OR_MOBILE']);
const FIXED_TYPES = new Set(['FIXED_LINE', 'FIXED_LINE_OR_MOBILE']);

/** The number types a plan is allowed to produce. */
export function typesForPlan(plan) {
  return plan && plan.isMobileOnly === false ? FIXED_TYPES : MOBILE_TYPES;
}

/* ---------------------------------------------------------------------------
   Random digits.

   Math.random() is NOT suitable for generating test datasets that are audited
   or exported in bulk: V8's xorshift128+ is predictable and reproducible from a
   handful of outputs, and a campaign of 50k numbers can reveal the stream. We
   use Web Crypto (available in the browser and in Node >= 18 as
   globalThis.crypto) with rejection sampling so every digit is uniform and
   unguessable. Bytes >= 250 are discarded because 250 is the largest multiple
   of 10 below 256; taking b % 10 directly would bias 0-5 slightly.
   --------------------------------------------------------------------------- */
const RAND_BUFFER_SIZE = 4096;
let randBuffer = new Uint8Array(0);
let randPos = 0;

function nextRandomDigit() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!c || typeof c.getRandomValues !== 'function') {
    // Last-resort fallback for exotic runtimes; documented so it is never silent.
    return Math.floor(Math.random() * 10);
  }
  if (randPos >= randBuffer.length) {
    randBuffer = new Uint8Array(RAND_BUFFER_SIZE);
    c.getRandomValues(randBuffer);
    randPos = 0;
  }
  let b = randBuffer[randPos++];
  while (b >= 250) {
    if (randPos >= randBuffer.length) {
      c.getRandomValues(randBuffer);
      randPos = 0;
    }
    b = randBuffer[randPos++];
  }
  return b % 10;
}

function randomDigits(len) {
  let out = '';
  for (let i = 0; i < len; i++) out += nextRandomDigit();
  return out;
}

/**
 * Reject degenerate subscriber parts.
 *
 * Uniform-random digits are exactly what we want on average, but they still
 * produce the occasional implausible number: a run of five or more zeros
 * (+92300000023), every digit identical (+92311111111), or a straight
 * ascending/descending staircase (+9234567890). Those are unmistakably
 * synthetic, they cluster a campaign into a tiny slice of the range, and they
 * are the exact shape reported from real scans.
 *
 * The policy lives in SUBSCRIBER_RULES (src/data/numberingConstants.js) so it is
 * explicit and configurable. Note maxRepeatRun = 4: a legitimate four-in-a-row
 * repeat (e.g. ...5555) is ALLOWED, only runs of five or more are dropped. A
 * previously over-aggressive `{3,}` rule rejected valid 4-repeats.
 *
 * `national` is the full national number and `prefixLen` says how much of it is
 * the operator/area prefix, so only the SUBSCRIBER part is judged - a run of
 * zeros inside a legitimately assigned prefix is not the subscriber's fault.
 */
export function hasDegenerateSubscriber(national, prefixLen) {
  const sub = String(national).slice(prefixLen);
  const rules = SUBSCRIBER_RULES;
  if (sub.length < rules.minSubscriberLenForRunCheck) return false;

  // Every digit identical (+92311111111).
  if (rules.rejectAllSame && /^(\d)\1+$/.test(sub)) return true;

  // A run LONGER than maxRepeatRun of the same digit (zero runs being the worst).
  if (rules.maxRepeatRun >= 1) {
    const runRe = new RegExp('(\\d)\\1{' + rules.maxRepeatRun + ',}');
    if (runRe.test(sub)) return true;
  }

  // Strictly ascending or descending staircase across the whole part.
  if (rules.rejectStaircase && sub.length >= 4) {
    let asc = true;
    let desc = true;
    for (let i = 1; i < sub.length; i++) {
      const d = sub.charCodeAt(i) - sub.charCodeAt(i - 1);
      if (d !== 1) asc = false;
      if (d !== -1) desc = false;
      if (!asc && !desc) break;
    }
    if (asc || desc) return true;
  }

  return false;
}

/**
 * Classify a candidate so failures can be reported by reason instead of a bare
 * "invalid". Returns { ok, reason, e164, type }.
 *
 * reason is one of: 'invalid' (unparseable / not a valid number),
 * 'length' (national length changed under a different plan), 'country'
 * (calling code or country round-trip failed) or 'type' (wrong number type for
 * this plan, e.g. a landline in a mobile-only plan).
 */
export function classifyCandidate(iso, callingCode, national, allowedTypes) {
  if (!iso || !callingCode || !national) return { ok: false, reason: 'invalid' };
  let parsed;
  try {
    parsed = parseMaxPhoneNumber('+' + callingCode + national, iso);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!parsed) return { ok: false, reason: 'invalid' };
  if (String(parsed.countryCallingCode) !== String(callingCode)) return { ok: false, reason: 'country' };
  if (parsed.country && String(parsed.country) !== String(iso)) return { ok: false, reason: 'country' };
  if (String(parsed.nationalNumber).length !== String(national).length) return { ok: false, reason: 'length' };
  if (!parsed.isValid()) return { ok: false, reason: 'invalid' };
  if (allowedTypes && !allowedTypes.has(parsed.getType())) {
    return { ok: false, reason: 'type', type: parsed.getType() };
  }
  return { ok: true, reason: null, e164: String(parsed.number), type: parsed.getType() };
}

/**
 * Validate a candidate national number. Returns the E.164 string or null.
 * Thin wrapper over classifyCandidate kept for existing callers/tests.
 */
export function validateCandidate(iso, callingCode, national, allowedTypes) {
  const res = classifyCandidate(iso, callingCode, national, allowedTypes);
  return res.ok ? res.e164 : null;
}

/**
 * The prefix pool for a territory: array of [prefix, nationalLength] pairs.
 * Territories with no numbering plan of their own inherit one from a parent
 * sharing the same calling code (recorded during the build).
 */
export function getCountryPrefixPool(iso) {
  const index = getPrefixIndexSync();
  if (!index || !iso) return [];
  const wanted = String(iso).toUpperCase();
  const seen = new Set();
  let entry = index[wanted];
  let guard = 0;
  while (entry && !entry.prefixes.length && entry.parent && guard++ < 8) {
    entry = index[String(entry.parent).toUpperCase()];
  }
  if (!entry || !Array.isArray(entry.prefixes)) return [];
  for (const pair of entry.prefixes) {
    const key = pair[0] + '@' + pair[1];
    if (!seen.has(key)) seen.add(key);
  }
  return entry.prefixes.map((p) => [String(p[0]), Number(p[1])]);
}

/** The plan metadata (calling code, lengths, whether it is mobile or fixed). */
export function getCountryPlan(iso) {
  const index = getPrefixIndexSync();
  if (!index || !iso) return null;
  const wanted = String(iso).toUpperCase();
  let entry = index[wanted];
  let guard = 0;
  const chain = [wanted];
  while (entry && !entry.prefixes.length && entry.parent && guard++ < 8) {
    chain.push(String(entry.parent).toUpperCase());
    entry = index[String(entry.parent).toUpperCase()];
  }
  if (!entry) return null;
  return {
    iso: wanted,
    sourceIso: chain[chain.length - 1],
    callingCode: String(entry.cc || ''),
    natLens: Array.isArray(entry.natLens) ? entry.natLens.slice() : [],
    prefixes: entry.prefixes.map((p) => [String(p[0]), Number(p[1])]),
    isMobileOnly: entry.type !== 'FIXED_LINE',
  };
}

/**
 * Build a per-country generator context, kept for backwards compatibility with
 * existing callers that only need a single representative prefix.
 */
export function getCountryGeneratorContext(countryCode) {
  if (!countryCode) return null;
  const iso = String(countryCode).toUpperCase();
  const plan = getCountryPlan(iso);
  if (!plan || !plan.prefixes.length) return null;
  const [prefix, natLen] = plan.prefixes[0];
  return {
    country: iso,
    callingCode: plan.callingCode,
    national: prefix + '0'.repeat(Math.max(0, natLen - prefix.length)),
    prefix,
    natLen,
    subscriberLength: Math.max(0, natLen - prefix.length),
  };
}

/** Expand a list of coarse prefixes into concrete (prefix, length) pairs. */
export function expandPrefixes(iso, coarsePrefixes) {
  const plan = getCountryPlan(iso);
  if (!plan || !plan.prefixes.length) return [];
  const out = [];
  const seen = new Set();
  const add = (p, l) => {
    const key = p + '@' + l;
    if (seen.has(key)) return;
    seen.add(key);
    out.push([p, l]);
  };

  const wanted = (coarsePrefixes || [])
    .map((p) => String(p || '').replace(/\D/g, ''))
    .filter(Boolean);

  for (const coarse of wanted) {
    const matches = plan.prefixes.filter(([p]) => p.startsWith(coarse) || coarse.startsWith(p));
    if (matches.length) {
      for (const [planPrefix, natLen] of matches) {
        // Keep the most specific prefix that still belongs to this plan. A
        // carrier prefix can be finer than the plan's coarse prefix (e.g. a
        // 6-digit operator range inside a 3-digit plan prefix); collapsing it
        // back to the plan prefix would silently widen the generation scope.
        const prefix = coarse.startsWith(planPrefix) ? coarse : planPrefix;
        if (prefix.length < Number(natLen)) add(prefix, Number(natLen));
      }
    } else {
      // Carrier/region data can be coarser or finer than the plan; fall back to
      // the raw prefix at each plausible national length and let validation decide.
      for (const L of plan.natLens.length ? plan.natLens : [10]) {
        add(coarse, Math.max(L, coarse.length + 1));
      }
    }
  }
  return out;
}

/**
 * The generation pool for a single region, as concrete (prefix, length) pairs.
 *
 * `region.prefixes` are already plan-intersected by geoLookup (it matches raw
 * geocode prefixes against this country's mobile plan). This function performs
 * the final expand/validate step and returns ONLY prefixes that belong to the
 * country's plan. It deliberately does NOT fall back to the whole-country plan:
 * an empty result means "this selection cannot be resolved to real prefixes",
 * and the caller must treat it as label-only and say so, never silently
 * generate country-wide numbers under a region label.
 */
export function getRegionPool(iso, region) {
  const plan = getCountryPlan(iso);
  if (!plan || !plan.prefixes.length) return [];
  const raw = []
    .concat(region && region.prefixes ? region.prefixes : [])
    .concat(region && region.prefix ? [region.prefix] : [])
    .map((p) => String(p || '').replace(/\D/g, ''))
    .filter(Boolean);
  if (!raw.length) return [];
  return expandPrefixes(iso, raw);
}

/**
 * Carriers that can actually produce numbers for `iso`.
 *
 * Strictness rules (fixes false-positive operator lists):
 *  - both prefixes must be digits, and a carrier prefix must be at least
 *    MIN_OPERATOR_PREFIX_LEN long (a 1-digit "operator" is too coarse to be a
 *    real carrier switch and would match an entire country);
 *  - a carrier is kept only when one of its prefixes genuinely overlaps a plan
 *    prefix (equal, or one is a prefix of the other);
 *  - duplicate carrier names are MERGED into a single entry with the union of
 *    their prefixes, so the picker never shows the same operator twice.
 */
export function getOperatorsForCountry(iso) {
  const index = getOperatorsSync();
  if (!index) return [];
  const plan = getCountryPlan(iso);
  if (!plan) return [];
  const raw = index[String(iso).toUpperCase()];
  if (!Array.isArray(raw)) return [];

  const planPrefixes = plan.prefixes.map((p) => String(p[0]).replace(/\D/g, '')).filter(Boolean);
  const minLen = LIMITS.MIN_OPERATOR_PREFIX_LEN;
  const merged = new Map();

  for (const entry of raw) {
    const name = entry && entry.n;
    const carrierPrefixes = Array.isArray(entry && entry.p) ? entry.p : [];
    if (!name || !carrierPrefixes.length) continue;
    const usable = [];
    for (const p of carrierPrefixes) {
      const c = String(p || '').replace(/\D/g, '');
      if (!c || c.length < minLen) continue;
      const overlaps = planPrefixes.some((mp) => mp === c || mp.startsWith(c) || c.startsWith(mp));
      if (overlaps && !usable.includes(c)) usable.push(c);
    }
    if (!usable.length) continue;
    if (!merged.has(name)) merged.set(name, new Set());
    const set = merged.get(name);
    usable.forEach((p) => set.add(p));
  }

  return Array.from(merged.entries())
    .map(([name, set]) => {
      const prefixes = Array.from(set).sort((a, b) => a.length - b.length || a.localeCompare(b));
      return { id: `${iso}::${name}`, name, prefixes, prefix: prefixes[0] };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolve the concrete generation pool for ONE region/operator bucket.
 *
 * This is the single source of truth shared by the live preview and the
 * generator, so the scope shown in the UI is exactly the scope used to produce
 * numbers. Region and operator filters are INTERSECTED (the more specific of
 * two overlapping prefixes wins) instead of one silently replacing the other.
 */
export function resolveBucketScope(iso, region, operator, plan = null) {
  const selectedPlan = plan || getCountryPlan(iso);
  if (!selectedPlan) return { pool: [], reason: 'no-plan', labelOnly: false };

  const clean = (list) => (Array.isArray(list) ? list : [])
    .map((p) => String(p || '').replace(/\D/g, ''))
    .filter(Boolean);
  const regionPrefixes = clean(region && (region.prefixes || (region.prefix ? [region.prefix] : [])));
  const operatorPrefixes = clean(operator && operator.prefixes);
  const regionLabelOnly = Boolean(region && region.labelOnly && !regionPrefixes.length);

  if (region && operator) {
    if (!regionPrefixes.length && !operatorPrefixes.length) {
      return { pool: [], reason: 'label-only', labelOnly: true };
    }
    if (!regionPrefixes.length) {
      // Label-only region + verified operator: operator ranges are usable but
      // the region remains a reporting label, never a geographic claim.
      return { pool: expandPrefixes(iso, operatorPrefixes), reason: null, labelOnly: true };
    }
    if (!operatorPrefixes.length) {
      return { pool: expandPrefixes(iso, regionPrefixes), reason: null, labelOnly: false };
    }
    const intersection = [];
    for (const rp of regionPrefixes) {
      for (const op of operatorPrefixes) {
        if (rp === op || rp.startsWith(op)) {
          if (!intersection.includes(rp)) intersection.push(rp);
        } else if (op.startsWith(rp)) {
          if (!intersection.includes(op)) intersection.push(op);
        }
      }
    }
    if (!intersection.length) return { pool: [], reason: 'no-overlap', labelOnly: regionLabelOnly };
    const pool = expandPrefixes(iso, intersection);
    return { pool, reason: pool.length ? null : 'no-overlap', labelOnly: regionLabelOnly };
  }

  if (region) {
    const pool = getRegionPool(iso, region);
    return {
      pool,
      reason: pool.length ? null : regionLabelOnly ? 'label-only' : 'no-prefix',
      labelOnly: regionLabelOnly,
    };
  }
  if (operator) {
    const pool = expandPrefixes(iso, operatorPrefixes);
    return { pool, reason: pool.length ? null : 'no-prefix', labelOnly: false };
  }
  return { pool: selectedPlan.prefixes, reason: null, labelOnly: false };
}

/**
 * Build all region x operator buckets for a selection and report the REAL
 * prefix scope. `allowLabelOnly` controls whether label-only regions may fall
 * back to the country plan (the UI asks the user to acknowledge this first).
 */
export function buildScopeBuckets({ iso, regions = [], operators = [], plan = null, allowLabelOnly = false }) {
  const selectedPlan = plan || getCountryPlan(iso);
  if (!selectedPlan) {
    return {
      buckets: [], prefixCount: 0, labelOnly: false, labelOnlyRegions: [],
      operatorFallback: false, blocked: [],
    };
  }
  const regionList = regions.length ? regions : [null];
  const operatorList = operators.length ? operators : [null];
  const buckets = [];
  const labelOnlyRegions = new Set();
  const blocked = [];
  const prefixKeys = new Set();
  let operatorFallback = false;

  regionList.forEach((region, regionIndex) => {
    operatorList.forEach((operator, operatorIndex) => {
      const resolved = resolveBucketScope(iso, region, operator, selectedPlan);
      let pool = resolved.pool;
      let skipped = false;
      if (!pool.length && resolved.reason === 'label-only') {
        labelOnlyRegions.add(region && region.name);
        if (allowLabelOnly) {
          pool = selectedPlan.prefixes;
          if (operator) operatorFallback = true;
        } else {
          skipped = true;
        }
      } else if (!pool.length) {
        skipped = true;
        if (operator) operatorFallback = true;
        blocked.push(
          `${[region && region.name, operator && operator.name].filter(Boolean).join(' + ') || 'selection'}` +
          ` (${resolved.reason === 'no-overlap' ? 'no overlapping verified prefixes' : 'no verified prefixes'})`
        );
      } else if (resolved.labelOnly && region && region.name) {
        labelOnlyRegions.add(region.name);
      }
      if (!skipped) {
        pool.forEach(([prefix, natLen]) => prefixKeys.add(`${prefix}@${natLen}`));
      }
      buckets.push({
        region,
        operator,
        pool,
        labelOnly: resolved.labelOnly || Boolean(region && region.labelOnly),
        skipped,
        regionIndex,
        operatorIndex,
      });
    });
  });

  const explicitRegions = regionList.filter(Boolean);
  return {
    buckets,
    prefixCount: prefixKeys.size,
    labelOnly: labelOnlyRegions.size > 0 || (explicitRegions.length > 0 && explicitRegions.every((r) => r.labelOnly)),
    labelOnlyRegions: Array.from(labelOnlyRegions).filter(Boolean),
    operatorFallback,
    blocked,
    activeBuckets: buckets.filter((b) => !b.skipped),
  };
}

/**
 * ISO 3166-2 subdivisions for a country, marked as label-only.
 */
export function getSubdivisionsForCountry(iso) {
  const subs = getRegionsSync();
  if (!subs || !iso) return [];
  const list = subs[String(iso).toUpperCase()];
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => ({
      id: `${String(iso).toUpperCase()}::sub::${entry[1]}`,
      name: String(entry[1]),
      code: String(entry[0] || ''),
      prefixes: [],
      kind: 'label',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Normalize a [prefix, nationalLength] pool so every entry leaves room for at
 * least one randomized subscriber digit.
 *
 * Short-number territories (e.g. Tokelau +690 and Tristan da Cunha +290 have
 * 4-digit national numbers) are discovered with prefixes as long as the number
 * itself, which would otherwise produce a single fixed number per prefix.
 */
function normalizePool(pool) {
  const out = [];
  const seen = new Set();
  for (const pair of pool || []) {
    if (!Array.isArray(pair)) continue;
    const prefix = String(pair[0] || '').replace(/\D/g, '');
    const natLen = Number(pair[1]);
    if (!prefix || !natLen) continue;
    let usable = prefix;
    if (usable.length >= natLen) usable = usable.slice(0, Math.max(1, natLen - 1));
    if (!usable || usable.length >= natLen) continue;
    const key = usable + '@' + natLen;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([usable, natLen]);
  }
  return out;
}

/**
 * Generate up to `quantity` unique, valid numbers by walking `pool`
 * round-robin. Returns { numbers: [{ number, prefix, national }], error }.
 *
 * `sourceIso` is the territory that actually owns the numbering plan. It differs
 * from `iso` for territories that share a calling code without carrying their own
 * metadata (e.g. "JM" and "GG" borrow the US / GB plan), and validation must be
 * performed against the owning territory.
 *
 * `seen` may be supplied by a caller that runs several pools (one per
 * region/operator bucket) so the whole batch stays globally deduplicated even
 * when two buckets resolve to overlapping prefixes. `startIndex` offsets the
 * round-robin cursor so concurrent buckets do not all begin on the same prefix.
 */
function makeStats() {
  return {
    attempts: 0,
    accepted: 0,
    capacity: 0,
    timedOut: false,
    capacityExhausted: false,
    reasons: { prefix: 0, length: 0, type: 0, country: 0, invalid: 0, degenerate: 0, duplicate: 0 },
  };
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

/**
 * The generator core. Yields each accepted `{ number, prefix, national }`,
 * mutates the shared `stats` object and returns an error string (or null).
 *
 * Keeping this as a generator lets the SAME logic back both the synchronous
 * engine API and the chunked async API, so behaviour can never diverge.
 */
function* poolProducer({ iso, sourceIso, callingCode, quantity, pool, allowedTypes, seen, startIndex, deadlineAt, stats }) {
  const requested = Math.max(0, Math.min(Math.floor(quantity) || 0, HARD_MAX_QUANTITY));
  const types = allowedTypes || MOBILE_TYPES;
  const validateIso = sourceIso || iso;
  const usable = normalizePool(pool);
  if (!iso || !callingCode || !usable.length || requested === 0) {
    return 'No numbering plan is available for this country yet.';
  }

  let capacity = 0;
  for (const [prefix, natLen] of usable) {
    capacity += Math.pow(10, Math.max(0, natLen - prefix.length));
    if (capacity >= requested) break;
  }
  stats.capacity = capacity;
  const target = Math.max(1, Math.min(requested, capacity));
  stats.capacityExhausted = capacity < requested;

  const seenSet = seen instanceof Set ? seen : new Set();
  const maxAttempts = Math.max(MIN_TOTAL_ATTEMPTS, target * MAX_ATTEMPT_FACTOR);
  const stallLimit = Math.max(STALL_FLOOR, usable.length * STALL_POOL_FACTOR);
  const deadline = Number.isFinite(deadlineAt) ? deadlineAt : Infinity;
  let stalled = 0;
  let cursor = Number.isFinite(startIndex) ? startIndex : Math.floor(Math.random() * usable.length);

  while (stats.accepted < target && stats.attempts < maxAttempts && stalled < stallLimit) {
    const [prefix, natLen] = usable[cursor % usable.length];
    cursor += 1;
    stats.attempts += 1;
    const subscriber = randomDigits(Math.max(0, natLen - prefix.length));
    const national = prefix + subscriber;

    if (hasDegenerateSubscriber(national, prefix.length)) {
      stats.reasons.degenerate += 1;
      stalled += 1;
      if (stalled >= stallLimit) break;
      if (nowMs() > deadline) { stats.timedOut = true; break; }
      continue;
    }

    const cls = classifyCandidate(validateIso, callingCode, national, types);
    if (!cls.ok) {
      stats.reasons[cls.reason] = (stats.reasons[cls.reason] || 0) + 1;
      stalled += 1;
      if (stalled >= stallLimit) break;
      if (nowMs() > deadline) { stats.timedOut = true; break; }
      continue;
    }
    if (seenSet.has(cls.e164)) {
      stats.reasons.duplicate += 1;
      stalled += 1;
      if (stalled >= stallLimit) break;
      if (nowMs() > deadline) { stats.timedOut = true; break; }
      continue;
    }

    seenSet.add(cls.e164);
    stats.accepted += 1;
    stalled = 0;
    yield { number: cls.e164, prefix, national };

    if (nowMs() > deadline) { stats.timedOut = true; break; }
  }

  return null;
}

/**
 * Generate up to `quantity` unique, valid numbers by walking `pool`
 * round-robin. Synchronous convenience wrapper over poolProducer.
 *
 * `sourceIso` is the territory that actually owns the numbering plan. It differs
 * from `iso` for territories that share a calling code without carrying their own
 * metadata (e.g. "JM" and "GG" borrow the US / GB plan), and validation must be
 * performed against the owning territory.
 *
 * `seen` may be supplied so several pools stay globally deduplicated, and
 * `startIndex` offsets the round-robin cursor.
 */
export function generateFromPool({ iso, sourceIso, callingCode, quantity, pool, allowedTypes, seen, startIndex, deadlineMs }) {
  const stats = makeStats();
  const requested = Math.max(0, Math.min(Math.floor(quantity) || 0, HARD_MAX_QUANTITY));
  const budget = Number.isFinite(deadlineMs) ? deadlineMs : LIMITS.TOTAL_TIME_BUDGET_MS;
  const gen = poolProducer({
    iso, sourceIso, callingCode, quantity, pool, allowedTypes, seen, startIndex,
    deadlineAt: nowMs() + budget,
    stats,
  });
  const numbers = [];
  let res = gen.next();
  while (!res.done) {
    numbers.push(res.value);
    res = gen.next();
  }
  const error = res.value;
  return {
    numbers,
    truncated: numbers.length < requested,
    error: numbers.length ? null : error,
    stats,
  };
}

/**
 * Chunked async variant of generateFromPool. Yields to the event loop every
 * CHUNK_SIZE accepted numbers (and at least every CHUNK_YIELD_MS) so the UI
 * stays responsive, honouring `onProgress(produced)` and `shouldCancel()`.
 */
export async function generateFromPoolAsync(options, { onProgress, shouldCancel } = {}) {
  const { quantity } = options;
  const requested = Math.max(0, Math.min(Math.floor(quantity) || 0, HARD_MAX_QUANTITY));
  const budget = Number.isFinite(options.deadlineMs) ? options.deadlineMs : LIMITS.TOTAL_TIME_BUDGET_MS;
  const stats = options.stats || makeStats();
  const gen = poolProducer({ ...options, deadlineAt: nowMs() + budget, stats });
  const numbers = [];
  let res = gen.next();
  let sinceYield = 0;
  let lastYield = nowMs();
  let cancelled = false;
  while (!res.done) {
    numbers.push(res.value);
    sinceYield += 1;
    if (shouldCancel && shouldCancel()) { cancelled = true; break; }
    if (sinceYield >= LIMITS.CHUNK_SIZE || nowMs() - lastYield >= LIMITS.CHUNK_YIELD_MS) {
      if (onProgress) onProgress(numbers.length);
      await new Promise((r) => setTimeout(r, 0));
      sinceYield = 0;
      lastYield = nowMs();
    }
    res = gen.next();
  }
  if (!res.done && gen.return) {
    try { res = gen.return(); } catch { /* ignore */ }
  }
  const error = res.done ? res.value : null;
  return {
    numbers,
    truncated: numbers.length < requested,
    error: numbers.length ? null : error,
    stats,
    cancelled,
  };
}

/**
 * Generate `quantity` unique, valid mobile numbers for `countryCode`.
 * Returns { numbers: E164[], error, truncated, stats, capacity }.
 * Chunked and cancellable via the optional `options`.
 */
export async function getRandomNumbers(countryCode, quantity, options = {}) {
  const iso = String(countryCode || '').toUpperCase();
  await ensureNumberingDatasets();
  const plan = getCountryPlan(iso);
  if (!plan || !plan.prefixes.length) {
    return { numbers: [], error: 'No numbering plan is available for this country yet.', truncated: true };
  }
  const types = plan.isMobileOnly ? MOBILE_TYPES : FIXED_TYPES;
  const result = await generateFromPoolAsync(
    {
      iso,
      sourceIso: plan.sourceIso,
      callingCode: plan.callingCode,
      quantity,
      pool: plan.prefixes,
      allowedTypes: types,
    },
    options
  );
  return {
    numbers: result.numbers.map((n) => n.number),
    error: result.error,
    truncated: result.truncated,
    stats: result.stats,
    capacity: result.stats ? result.stats.capacity : 0,
    cancelled: result.cancelled,
  };
}

/**
 * Generate numbers across an inclusive sequential range.
 *
 * Design (fixes the sequential bugs):
 *  - the range is parsed with BigInt, so numbers larger than Number.MAX_SAFE_INTEGER
 *    are not silently rounded (a 15-digit national number used to overflow);
 *  - `start` and `end` are left-padded to the SAME digit length, preserving order
 *    and any leading zeros entered by the user;
 *  - `start === end` is a valid single-number request (only `start > end` errors);
 *  - the span is capped at SEQUENTIAL_RANGE_LIMIT and reported as truncated;
 *  - every candidate must start with a real plan prefix, then pass the SAME
 *    classifyCandidate rules as random generation, with drop reasons counted.
 *
 * Returns { numbers:[{number,national}], error, truncated, stats }.
 */
export function generateSequentialNumbers({ iso, sourceIso, callingCode, pool, start, end, allowedTypes, seen }) {
  const stats = makeStats();
  const types = allowedTypes || MOBILE_TYPES;
  const validateIso = sourceIso || iso;
  const startStr = String(start == null ? '' : start).replace(/\D/g, '');
  const endStr = String(end == null ? '' : end).replace(/\D/g, '');
  if (!startStr || !endStr) {
    return { numbers: [], error: 'Enter both a start and an end number.', truncated: false, stats };
  }

  const len = Math.max(startStr.length, endStr.length);
  const startBig = BigInt(startStr);
  const endBig = BigInt(endStr);
  if (startBig > endBig) {
    return { numbers: [], error: 'Start must be less than or equal to End.', truncated: false, stats };
  }

  const span = endBig - startBig + 1n;
  const cap = BigInt(LIMITS.SEQUENTIAL_MAX);
  const limited = span > cap;
  const effectiveEnd = limited ? startBig + cap - 1n : endBig;

  const usable = normalizePool(pool);
  const planPrefixes = [];
  for (const [prefix] of usable) {
    if (!planPrefixes.includes(prefix)) planPrefixes.push(prefix);
  }
  if (!iso || !callingCode || !planPrefixes.length) {
    return { numbers: [], error: 'No numbering plan is available for this country yet.', truncated: false, stats };
  }

  const seenSet = seen instanceof Set ? seen : new Set();
  const numbers = [];
  for (let i = startBig; i <= effectiveEnd; i += 1n) {
    const national = i.toString().padStart(len, '0');
    stats.attempts += 1;
    const prefix = planPrefixes.find((p) => national.startsWith(p));
    if (!prefix) {
      stats.reasons.prefix += 1;
      continue;
    }
    if (hasDegenerateSubscriber(national, prefix.length)) {
      stats.reasons.degenerate += 1;
      continue;
    }
    const cls = classifyCandidate(validateIso, callingCode, national, types);
    if (!cls.ok) {
      stats.reasons[cls.reason] = (stats.reasons[cls.reason] || 0) + 1;
      continue;
    }
    if (seenSet.has(cls.e164)) {
      stats.reasons.duplicate += 1;
      continue;
    }
    seenSet.add(cls.e164);
    numbers.push({ number: cls.e164, national, prefix });
    stats.accepted += 1;
  }

  return {
    numbers,
    error: numbers.length ? null : 'No valid numbers in this range for the selected country.',
    truncated: limited,
    stats,
  };
}

/* ============================================================================
   COUNTRY CODE CONVERSION
   ----------------------------------------------------------------------------
   The rest of the app selects countries by their *calling code* (e.g. "+1",
   "+92"). libphonenumber-js works with ISO alpha-2 codes (e.g. "US", "PK").
   For the many codes shared between countries (e.g. +1 = US/CA, +7 = RU/KZ)
   we pick a primary/relevant country so the generator stays predictable.
   ============================================================================ */

const CALLING_CODE_PREFERRED_ISO = {
  1: 'US',
  7: 'RU',
  61: 'AU',
  44: 'GB',
  212: 'MA',
};

const callingCodeToIsoCache = {};

/**
 * Convert an app-style calling code (e.g. "92", "1") into an ISO country code
 * the generation engine understands (e.g. "PK", "US").
 */
export function callingCodeToIso(callingCode) {
  const code = String(callingCode || '').replace(/\D/g, '');
  if (!code) return null;
  if (callingCodeToIsoCache[code]) return callingCodeToIsoCache[code];
  let iso = CALLING_CODE_PREFERRED_ISO[code] || null;
  if (!iso) {
    const c = countries.find((x) => x.code === code);
    iso = c ? c.iso.toUpperCase() : null;
  }
  callingCodeToIsoCache[code] = iso;
  return iso;
}

/**
 * Convert an ISO code (e.g. "US") to its calling code (e.g. "1").
 */
export function isoToCallingCode(iso) {
  try {
    return getCountryCallingCode(iso);
  } catch {
    return null;
  }
}

/**
 * Parse a number typed by the user in EITHER national or international form.
 *
 *   "2025550100", "(202) 555-0100", "202-555-0100"  -> selected country
 *   "+12025550100", "+1 (202) 555-0100"             -> country auto-detected
 *   "+442071234567", "+923001234567"                -> country auto-detected
 *
 * libphonenumber's max metadata resolves the exact ISO from the calling code
 * (including shared codes such as +1 / +7) and strips trunk prefixes and
 * formatting. The raw-digit fallback covers structurally incomplete input (a
 * sequential end point is not always a dialable number on its own).
 *
 * Returns { ok, iso, callingCode, national, international, e164?, error? }.
 */
export function parseNumberInput(value, selectedIso) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return { ok: false, error: 'Enter a number.' };

  const selected = String(selectedIso || '').toUpperCase();
  const selectedCc = selected ? isoToCallingCode(selected) : null;
  const hasPlus = raw.startsWith('+');

  let parsed = null;
  try {
    parsed = parseMaxPhoneNumber(raw, selected || undefined);
  } catch {
    parsed = null;
  }
  if (parsed) {
    const callingCode = String(parsed.countryCallingCode || selectedCc || '');
    let iso = parsed.country
      ? String(parsed.country).toUpperCase()
      : hasPlus
        ? String((getCountryByCallingCode(callingCode) || {}).iso || callingCodeToIso(callingCode) || selected).toUpperCase()
        : selected;
    // A national string must remain under the country selected in the UI. If
    // libphonenumber could not decide the country from a "+" number, prefer the
    // selection when its calling code matches the dialled code.
    if (!hasPlus && selected) iso = selected;
    if (hasPlus && !parsed.country && selectedCc === callingCode && selected) iso = selected;
    if (!callingCode) return { ok: false, error: 'Could not resolve a country calling code.' };
    return {
      ok: true,
      iso,
      callingCode,
      national: String(parsed.nationalNumber || '').replace(/\D/g, ''),
      international: hasPlus,
      e164: String(parsed.number || ''),
    };
  }

  // Fallback for ranges whose end point is not a complete dialable number:
  // keep the digits, but still resolve a "+" calling code explicitly.
  let digits = raw.replace(/\D/g, '');
  if (!digits) return { ok: false, error: 'Enter a number containing digits.' };
  if (hasPlus) {
    const codes = Array.from(new Set(countries.map((c) => String(c.code)).filter(Boolean)))
      .sort((a, b) => b.length - a.length);
    const callingCode = codes.find((c) => digits.startsWith(c));
    if (!callingCode) return { ok: false, error: 'Unknown country calling code.' };
    let iso = String((getCountryByCallingCode(callingCode) || {}).iso || callingCodeToIso(callingCode) || '').toUpperCase();
    if (selectedCc === callingCode && selected) iso = selected;
    if (!iso) return { ok: false, error: 'Unknown country calling code.' };
    return {
      ok: true,
      iso,
      callingCode,
      national: digits.slice(callingCode.length),
      international: true,
    };
  }
  if (!selected || !selectedCc) return { ok: false, error: 'Select a country first.' };
  return {
    ok: true,
    iso: selected,
    callingCode: String(selectedCc),
    national: digits,
    international: false,
  };
}

export const REGION_TYPES = {
  US: 'state',
  CA: 'province',
  IN: 'state',
  BR: 'state',
  AU: 'state',
  DE: 'state',
  MX: 'state',
  GB: 'region',
  FR: 'region',
  IT: 'region',
  ES: 'region',
  PK: 'province',
  NG: 'state',
  BD: 'division',
  ZA: 'province',
  TR: 'region',
  RU: 'region',
  CN: 'province',
  JP: 'prefecture',
  ID: 'province',
  KR: 'province',
  TH: 'region',
  VN: 'region',
  PH: 'region',
  MY: 'state',
  AE: 'emirate',
  SA: 'region',
  EG: 'governorate',
  AR: 'province',
  CO: 'department',
  CL: 'region',
  PE: 'department',
  UZ: 'region',
  KZ: 'region',
  UA: 'oblast',
  IR: 'province',
  IQ: 'governorate',
  IL: 'district',
  RO: 'county',
  NL: 'province',
  SE: 'county',
  NO: 'county',
  FI: 'region',
  PL: 'voivodeship',
  GR: 'region',
  PT: 'district',
  AT: 'state',
  CH: 'canton',
  BE: 'region',
  IE: 'province',
  NZ: 'region',
  LK: 'province',
  NP: 'province',
  MM: 'state',
  KH: 'province',
  LA: 'province',
  BD_EXTRA: 'division',
};


// Export the region type label for a country.
export function getRegionTypeLabel(country) {
  return REGION_TYPES[country] || 'region';
}

/**
 * Distribute a batch fairly across region/operator buckets.
 *
 * Each bucket is `{ region, operator, pool }` where `pool` is a list of
 * `[prefix, nationalLength]` pairs. Numbers are generated per bucket against one
 * shared dedupe set, then interleaved so no single bucket clusters at the top of
 * the output.
 *
 * The split is `base = floor(total / buckets)` each, with the first
 * `total % buckets` buckets taking one extra. If a bucket cannot fill its share
 * (a very small prefix pool), a second pass tops the shortfall up bucket by
 * bucket so the requested quantity is still honoured.
 *
 * Returns `{ numbers, error }` where each number is
 * `{ number, prefix, national, bucketIndex }`.
 */
function splitShares(total, count) {
  const base = Math.floor(total / count);
  const extra = total % count;
  return (i) => base + (i < extra ? 1 : 0);
}

function interleaveBuckets(perBucket, target) {
  const interleaved = [];
  const maxLen = Math.max(0, ...perBucket.map((b) => b.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (let b = 0; b < perBucket.length; b += 1) {
      if (i < perBucket[b].length) interleaved.push({ number: perBucket[b][i], bucketIndex: b });
    }
  }
  return interleaved.slice(0, target);
}

function mergeStats(total, stats) {
  total.attempts += stats.attempts;
  total.accepted += stats.accepted;
  // Capacity is additive across buckets: it must describe the whole scope, not
  // the last bucket that happened to finish. A zero here produced the misleading
  // "this plan can only supply 0 distinct numbers" message.
  total.capacity += stats.capacity || 0;
  total.timedOut = total.timedOut || stats.timedOut;
  total.capacityExhausted = total.capacityExhausted || stats.capacityExhausted;
  for (const k of Object.keys(stats.reasons)) total.reasons[k] = (total.reasons[k] || 0) + stats.reasons[k];
}

/**
 * Synchronous fair distribution of one batch across region/operator buckets.
 * Each bucket is `{ pool: [prefix, len][] }`. Kept for tests and simple callers;
 * the UI uses generateBucketedAsync so it can report progress and be cancelled.
 */
export function generateBucketed({ iso, sourceIso, callingCode, total, buckets, allowedTypes }) {
  const target = Math.max(0, Math.min(Math.floor(total) || 0, HARD_MAX_QUANTITY));
  const list = (buckets || []).filter((b) => b && Array.isArray(b.pool) && b.pool.length);
  if (!target) return { numbers: [], error: null };
  if (!iso || !callingCode || !list.length) {
    return { numbers: [], error: 'No numbering plan is available for this country yet.' };
  }

  const types = allowedTypes || MOBILE_TYPES;
  const validateIso = sourceIso || iso;
  const seen = new Set();
  const perBucket = list.map(() => []);
  const agg = makeStats();
  const share = splitShares(target, list.length);
  const jobDeadline = nowMs() + TOTAL_TIME_BUDGET_MS;

  const runBucket = (index, qty) => {
    if (qty <= 0) return;
    const res = generateFromPool({
      iso, sourceIso: validateIso, callingCode, pool: list[index].pool,
      quantity: qty, startIndex: index, seen, allowedTypes: types,
      deadlineMs: Math.max(1, jobDeadline - nowMs()),
    });
    perBucket[index] = perBucket[index].concat(res.numbers);
    if (res.stats) mergeStats(agg, res.stats);
  };

  for (let i = 0; i < list.length && nowMs() < jobDeadline; i += 1) runBucket(i, share(i));
  let produced = perBucket.reduce((s, b) => s + b.length, 0);
  for (let i = 0; produced < target && i < list.length && nowMs() < jobDeadline; i += 1) {
    runBucket(i, target - produced);
    produced = perBucket.reduce((s, b) => s + b.length, 0);
  }

  const numbers = interleaveBuckets(perBucket, target);
  return {
    numbers,
    truncated: numbers.length < target,
    error: numbers.length ? null : 'Could not generate valid numbers for this selection.',
    stats: agg,
  };
}

/**
 * Chunked, cancellable fair distribution across buckets. Shares ONE global time
 * budget (TOTAL_TIME_BUDGET_MS by default); a bucket that finishes early donates
 * its unused time to the remaining buckets, and a bounded second pass recovers
 * any shortfall so the requested quantity is still honoured when the pools allow.
 */
export async function generateBucketedAsync(
  { iso, sourceIso, callingCode, total, buckets, allowedTypes, totalBudgetMs },
  { onProgress, shouldCancel } = {}
) {
  const target = Math.max(0, Math.min(Math.floor(total) || 0, HARD_MAX_QUANTITY));
  const list = (buckets || []).filter((b) => b && Array.isArray(b.pool) && b.pool.length);
  if (!target) return { numbers: [], error: null, stats: makeStats() };
  if (!iso || !callingCode || !list.length) {
    return { numbers: [], error: 'No numbering plan is available for this country yet.', stats: makeStats() };
  }

  const types = allowedTypes || MOBILE_TYPES;
  const validateIso = sourceIso || iso;
  const seen = new Set();
  const perBucket = list.map(() => []);
  // A bucket can run twice (initial fair share + shortfall top-up). Capacity is
  // a property of the bucket's pool, not of each run, so keep one value per
  // bucket; adding every run would double-count and hide a real plan limit.
  const bucketCapacity = list.map(() => 0);
  const agg = makeStats();
  const share = splitShares(target, list.length);
  const jobDeadline = nowMs() + (Number.isFinite(totalBudgetMs) ? totalBudgetMs : TOTAL_TIME_BUDGET_MS);

  const producedSoFar = () => perBucket.reduce((s, b) => s + b.length, 0);

  const runBucket = async (index, qty) => {
    if (qty <= 0) return;
    const remainingBuckets = Math.max(1, list.length - index);
    const perBucketBudget = Math.max(50, (jobDeadline - nowMs()) / remainingBuckets);
    const res = await generateFromPoolAsync(
      {
        iso, sourceIso: validateIso, callingCode, pool: list[index].pool,
        quantity: qty, startIndex: index, seen, allowedTypes: types,
        deadlineMs: perBucketBudget,
      },
      { onProgress: () => onProgress && onProgress(producedSoFar()), shouldCancel }
    );
    perBucket[index] = perBucket[index].concat(res.numbers);
    if (res.stats) {
      bucketCapacity[index] = Math.max(bucketCapacity[index], res.stats.capacity || 0);
      mergeStats(agg, res.stats);
    }
  };

  for (let i = 0; i < list.length; i += 1) {
    if (shouldCancel && shouldCancel()) break;
    if (nowMs() >= jobDeadline) break;
    await runBucket(i, share(i));
  }

  for (let i = 0; producedSoFar() < target && i < list.length; i += 1) {
    if (shouldCancel && shouldCancel()) break;
    if (nowMs() >= jobDeadline) break;
    await runBucket(i, target - producedSoFar());
  }

  const numbers = interleaveBuckets(perBucket, target);
  // Recompute from one value per bucket so top-up runs cannot inflate capacity.
  agg.capacity = bucketCapacity.reduce((sum, c) => sum + c, 0);
  agg.capacityExhausted = agg.capacity < target;
  return {
    numbers,
    truncated: numbers.length < target,
    error: numbers.length ? null : 'Could not generate valid numbers for this selection.',
    stats: agg,
    capacity: agg.capacity,
    capacityExhausted: agg.capacityExhausted,
    timedOut: agg.timedOut,
    cancelled: Boolean(shouldCancel && shouldCancel()),
  };
}

/**
 * Generate `quantity` unique valid numbers for a specific region (by its
 * national prefix) within `countryCode`. Returns E.164 strings.
 */
export async function getRegionNumbers(countryCode, regionPrefix, quantity, options = {}) {
  const iso = String(countryCode || '').toUpperCase();
  await ensureNumberingDatasets();
  const plan = getCountryPlan(iso);
  if (!plan || !plan.prefixes.length) {
    return { numbers: [], error: 'No numbering plan is available for this country yet.' };
  }
  const pool = expandPrefixes(iso, [regionPrefix]);
  const types = plan.isMobileOnly ? MOBILE_TYPES : FIXED_TYPES;
  const result = await generateFromPoolAsync(
    {
      iso,
      sourceIso: plan.sourceIso,
      callingCode: plan.callingCode,
      quantity,
      pool: pool.length ? pool : plan.prefixes,
      allowedTypes: types,
    },
    options
  );
  return { numbers: result.numbers.map((n) => n.number), error: result.error, stats: result.stats };
}
