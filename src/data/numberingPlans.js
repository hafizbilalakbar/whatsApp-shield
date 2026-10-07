import { getCountryCallingCode } from 'libphonenumber-js';
import { parsePhoneNumberFromString as parseMaxPhoneNumber } from 'libphonenumber-js/max';
import { countries } from './countries.js';
import {
  ensureNumberingDatasets,
  getPrefixIndexSync,
  getOperatorsSync,
  getRegionsSync,
} from './numberingDatasets.js';

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

// Maximum attempts per requested number before giving up (safety net).
const MAX_ATTEMPT_FACTOR = 60;
const MIN_TOTAL_ATTEMPTS = 20000;
const HARD_MAX_QUANTITY = 500000;

// Wall-clock budget for a single bucket. Generation runs on the UI thread, so a
// small country whose pool is genuinely exhausted (e.g. Tokelau +690 can only
// ever produce 300 distinct numbers) must not spin through millions of
// libphonenumber validations and freeze the tab.
const BUCKET_TIME_BUDGET_MS = 4000;

// Give up once this many consecutive attempts produce nothing new, scaled to the
// pool size. Guards against exhausted pools far earlier than the attempt cap.
const STALL_FLOOR = 5000;
const STALL_POOL_FACTOR = 20;

function randomDigits(len) {
  let out = '';
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

/**
 * Reject degenerate subscriber parts.
 *
 * Uniform-random digits are exactly what we want on average, but they still
 * produce the occasional implausible number: a run of four or more zeros
 * (+92300000023), every digit identical (+92311111111), or a straight
 * ascending/descending staircase (+9234567890). Those are unmistakably
 * synthetic, they cluster a campaign into a tiny slice of the range, and they
 * are the exact shape reported from real scans.
 *
 * `national` is the full national number and `prefixLen` says how much of it is
 * the operator/area prefix, so only the SUBSCRIBER part is judged - a run of
 * zeros inside a legitimately assigned prefix is not the subscriber's fault.
 *
 * Digit length is bounded by the country (max 11 national digits), so this is a
 * trivial scan; it runs before the libphonenumber call, which is the expensive
 * part, so rejecting here costs nothing measurable.
 */
function hasDegenerateSubscriber(national, prefixLen) {
  const sub = String(national).slice(prefixLen);
  if (sub.length < 3) return false;

  // Every digit identical (+92311111111).
  if (/^(\d)\1+$/.test(sub)) return true;

  // Four or more of the same digit in a row (zero runs being the worst case).
  if (/(\d)\1{3,}/.test(sub)) return true;

  // Strictly ascending or descending staircase across the whole part.
  if (sub.length >= 4) {
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
 * Validate a candidate national number. Returns the E.164 string or null.
 * The country / calling-code / length round-trip checks reject candidates that
 * libphonenumber silently re-interpreted under a different plan.
 */
export function validateCandidate(iso, callingCode, national, allowedTypes) {
  if (!iso || !callingCode || !national) return null;
  try {
    const parsed = parseMaxPhoneNumber('+' + callingCode + national, iso);
    if (!parsed || !parsed.isValid()) return null;
    if (allowedTypes && !allowedTypes.has(parsed.getType())) return null;
    if (String(parsed.countryCallingCode) !== String(callingCode)) return null;
    if (String(parsed.nationalNumber).length !== String(national).length) return null;
    if (parsed.country && String(parsed.country) !== String(iso)) return null;
    return String(parsed.number);
  } catch {
    return null;
  }
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
      for (const m of matches) add(m[0], m[1]);
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
 * The generation pool for a single region.
 *
 * - "prefix-based" regions carry metadata-backed national prefixes, so numbers
 *   are drawn only from those prefixes.
 * - "label only" subdivisions (ISO 3166-2 names that cannot be tied to a
 *   numbering prefix) spread across the country's real prefix pool instead. The
 *   label is then a targeting label attached to a valid number - never a claim
 *   about where that number is located.
 *
 * If nothing usable can be resolved the country's full plan is returned, which
 * is what keeps Region-Wise working for every country.
 */
export function getRegionPool(iso, region) {
  const plan = getCountryPlan(iso);
  if (!plan || !plan.prefixes.length) return [];
  const raw = []
    .concat(region && region.prefixes ? region.prefixes : [])
    .concat(region && region.prefix ? [region.prefix] : [])
    .map((p) => String(p || '').replace(/\D/g, ''))
    .filter(Boolean);
  if (!raw.length) return plan.prefixes;
  const pool = expandPrefixes(iso, raw);
  return pool.length ? pool : plan.prefixes;
}

/**
 * Carriers that can actually produce numbers for `iso`. Carrier data is stored
 * per calling code, so a carrier is only offered when at least one of its
 * prefixes resolves into this country's plan.
 */
export function getOperatorsForCountry(iso) {
  const index = getOperatorsSync();
  if (!index) return [];
  const plan = getCountryPlan(iso);
  if (!plan) return [];
  const raw = index[String(iso).toUpperCase()];
  if (!Array.isArray(raw)) return [];

  const planPrefixes = plan.prefixes.map((p) => p[0]);
  const out = [];
  for (const entry of raw) {
    const name = entry && entry.n;
    const carrierPrefixes = Array.isArray(entry && entry.p) ? entry.p : [];
    if (!name || !carrierPrefixes.length) continue;
    const usable = carrierPrefixes.filter((p) =>
      planPrefixes.some((mp) => mp.startsWith(p) || p.startsWith(mp))
    );
    if (!usable.length) continue;
    out.push({
      id: `${iso}::${name}`,
      name,
      prefixes: usable,
      prefix: usable[0],
    });
  }
  return out;
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
export function generateFromPool({ iso, sourceIso, callingCode, quantity, pool, allowedTypes, seen, startIndex, deadlineMs }) {
  const requested = Math.max(0, Math.min(Math.floor(quantity) || 0, HARD_MAX_QUANTITY));
  const types = allowedTypes || MOBILE_TYPES;
  const validateIso = sourceIso || iso;
  const usable = normalizePool(pool);
  if (!iso || !callingCode || !usable.length || requested === 0) {
    return { numbers: [], error: 'No numbering plan is available for this country yet.', truncated: false };
  }

  // How many distinct numbers this pool can physically produce. Never attempt
  // more than that: asking for 5,000 numbers in Tokelau (+690, 4-digit national
  // numbers) can only ever yield 300, and chasing the rest wastes the attempt
  // budget on guaranteed duplicates.
  let capacity = 0;
  for (const [prefix, natLen] of usable) {
    capacity += Math.pow(10, Math.max(0, natLen - prefix.length));
    if (capacity >= requested) break;
  }
  const target = Math.max(1, Math.min(requested, capacity));

  const seenSet = seen instanceof Set ? seen : new Set();
  const numbers = [];
  const maxAttempts = Math.max(MIN_TOTAL_ATTEMPTS, target * MAX_ATTEMPT_FACTOR);
  const stallLimit = Math.max(STALL_FLOOR, usable.length * STALL_POOL_FACTOR);
  const budget = Number.isFinite(deadlineMs) ? deadlineMs : BUCKET_TIME_BUDGET_MS;
  const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  let attempts = 0;
  let stalled = 0;
  let cursor = Number.isFinite(startIndex) ? startIndex : Math.floor(Math.random() * usable.length);

  while (numbers.length < target && attempts < maxAttempts && stalled < stallLimit) {
    const [prefix, natLen] = usable[cursor % usable.length];
    cursor += 1;
    attempts += 1;
    const subscriber = randomDigits(Math.max(0, natLen - prefix.length));
    const national = prefix + subscriber;
    // Cheap structural check BEFORE libphonenumber: a subscriber part with a
    // zero run / staircase is implausible, and skipping it here avoids spending
    // a parse on a candidate we would reject anyway.
    if (hasDegenerateSubscriber(national, prefix.length)) {
      stalled += 1;
      if (stalled >= stallLimit) break;
      continue;
    }
    const e164 = validateCandidate(validateIso, callingCode, national, types);
    if (e164 && !seenSet.has(e164)) {
      seenSet.add(e164);
      numbers.push({ number: e164, prefix, national });
      stalled = 0;
      continue;
    }

    stalled += 1;
    if (stalled >= stallLimit) break;
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    if (now - startedAt > budget) break;
  }

  return {
    numbers,
    // `truncated` tells the caller the request exceeded what the plan can supply
    // so it can explain the shortfall instead of silently returning less.
    truncated: numbers.length < requested,
    error: numbers.length ? null : 'Could not generate valid numbers for this selection.',
  };
}

/**
 * Generate `quantity` unique, valid mobile numbers for `countryCode`.
 * Returns an array of E.164 strings.
 */
export async function getRandomNumbers(countryCode, quantity) {
  const iso = String(countryCode || '').toUpperCase();
  await ensureNumberingDatasets();
  const plan = getCountryPlan(iso);
  if (!plan || !plan.prefixes.length) {
    return { numbers: [], error: 'No numbering plan is available for this country yet.', truncated: true };
  }
  const types = plan.isMobileOnly ? MOBILE_TYPES : FIXED_TYPES;
  const result = generateFromPool({
    iso,
    sourceIso: plan.sourceIso,
    callingCode: plan.callingCode,
    quantity,
    pool: plan.prefixes,
    allowedTypes: types,
  });
  return { numbers: result.numbers.map((n) => n.number), error: result.error, truncated: result.truncated };
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

// Region data: countryCode -> [ { name, prefix, desc } ]
// Prefixes are National Destination Codes (mobile area/mobile prefixes) from the
// official ITU / national numbering plans. Universal default "Mobile" prefix per
// country is added automatically from the example number.
const REGIONS = {
  US: [
    { name: 'California', prefix: '310', desc: 'Los Angeles metro mobile prefix' },
    { name: 'New York', prefix: '917', desc: 'New York City mobile prefix' },
    { name: 'Texas', prefix: '713', desc: 'Houston mobile prefix' },
    { name: 'Florida', prefix: '305', desc: 'Miami mobile prefix' },
    { name: 'Illinois', prefix: '312', desc: 'Chicago mobile prefix' },
    { name: 'Pennsylvania', prefix: '215', desc: 'Philadelphia mobile prefix' },
    { name: 'Ohio', prefix: '216', desc: 'Cleveland mobile prefix' },
    { name: 'Georgia', prefix: '404', desc: 'Atlanta mobile prefix' },
    { name: 'Washington', prefix: '206', desc: 'Seattle mobile prefix' },
    { name: 'Massachusetts', prefix: '617', desc: 'Boston mobile prefix' },
  ],
  CA: [
    { name: 'Ontario', prefix: '416', desc: 'Greater Toronto Area prefix' },
    { name: 'Quebec', prefix: '514', desc: 'Montreal prefix' },
    { name: 'British Columbia', prefix: '604', desc: 'Vancouver / Victoria prefix' },
    { name: 'Alberta', prefix: '403', desc: 'Calgary prefix' },
    { name: 'Manitoba', prefix: '204', desc: 'Winnipeg prefix' },
    { name: 'Saskatchewan', prefix: '306', desc: 'Regina / Saskatoon prefix' },
  ],
  IN: [
    { name: 'Maharashtra', prefix: '983', desc: 'Mumbai mobile prefix' },
    { name: 'Delhi NCR', prefix: '981', desc: 'Delhi mobile prefix' },
    { name: 'Karnataka', prefix: '984', desc: 'Bengaluru mobile prefix' },
    { name: 'Tamil Nadu', prefix: '984', desc: 'Chennai mobile prefix' },
    { name: 'West Bengal', prefix: '983', desc: 'Kolkata mobile prefix' },
    { name: 'Telangana', prefix: '984', desc: 'Hyderabad mobile prefix' },
    { name: 'Gujarat', prefix: '760', desc: 'Ahmedabad mobile prefix' },
  ],
  BR: [
    { name: 'São Paulo', prefix: '119', desc: 'São Paulo mobile prefix' },
    { name: 'Rio de Janeiro', prefix: '219', desc: 'Rio mobile prefix' },
    { name: 'Minas Gerais', prefix: '319', desc: 'Belo Horizonte mobile prefix' },
    { name: 'Paraná', prefix: '419', desc: 'Curitiba mobile prefix' },
    { name: 'Bahia', prefix: '719', desc: 'Salvador mobile prefix' },
    { name: 'Pernambuco', prefix: '819', desc: 'Recife mobile prefix' },
  ],
  AU: [
    { name: 'New South Wales', prefix: '412', desc: 'Sydney mobile prefix' },
    { name: 'Victoria', prefix: '412', desc: 'Melbourne mobile prefix' },
    { name: 'Queensland', prefix: '412', desc: 'Brisbane mobile prefix' },
    { name: 'Western Australia', prefix: '412', desc: 'Perth mobile prefix' },
    { name: 'South Australia', prefix: '412', desc: 'Adelaide mobile prefix' },
  ],
  DE: [
    { name: 'Bayern', prefix: '151', desc: 'Bavaria mobile prefix' },
    { name: 'Nordrhein-Westfalen', prefix: '151', desc: 'NRW mobile prefix' },
    { name: 'Baden-Württemberg', prefix: '152', desc: 'SW Germany mobile prefix' },
    { name: 'Berlin/Brandenburg', prefix: '152', desc: 'Berlin mobile prefix' },
  ],
  MX: [
    { name: 'Ciudad de México', prefix: '551', desc: 'CDMX mobile prefix' },
    { name: 'Jalisco', prefix: '331', desc: 'Guadalajara mobile prefix' },
    { name: 'Nuevo León', prefix: '811', desc: 'Monterrey mobile prefix' },
    { name: 'Veracruz', prefix: '22', desc: 'Veracruz mobile prefix' },
  ],
  GB: [
    { name: 'London & South East', prefix: '7400', desc: 'National mobile prefix' },
    { name: 'South West (Bristol)', prefix: '7425', desc: 'South West mobile prefix' },
    { name: 'North West (Manchester)', prefix: '742', desc: 'North West mobile prefix' },
    { name: 'Scotland (Glasgow)', prefix: '7475', desc: 'Scotland mobile prefix' },
  ],
  FR: [
    { name: 'Île-de-France', prefix: '6', desc: 'Paris region mobile prefix' },
    { name: 'Provence-Alpes-Côte d\'Azur', prefix: '6', desc: 'Marseille region mobile prefix' },
    { name: 'Auvergne-Rhône-Alpes', prefix: '6', desc: 'Lyon region mobile prefix' },
    { name: 'Occitanie', prefix: '6', desc: 'Toulouse region mobile prefix' },
  ],
  IT: [
    { name: 'Lombardia', prefix: '312', desc: 'Milan mobile prefix' },
    { name: 'Lazio', prefix: '312', desc: 'Rome mobile prefix' },
    { name: 'Campania', prefix: '312', desc: 'Naples mobile prefix' },
  ],
  ES: [
    { name: 'Madrid', prefix: '612', desc: 'Madrid mobile prefix' },
    { name: 'Cataluña', prefix: '612', desc: 'Barcelona mobile prefix' },
    { name: 'Andalucía', prefix: '612', desc: 'Seville mobile prefix' },
  ],
  PK: [
    { name: 'Punjab', prefix: '300', desc: 'Punjab mobile prefix' },
    { name: 'Sindh', prefix: '300', desc: 'Sindh (Karachi) mobile prefix' },
    { name: 'Khyber Pakhtunkhwa', prefix: '300', desc: 'KP mobile prefix' },
    { name: 'Balochistan', prefix: '300', desc: 'Balochistan mobile prefix' },
    { name: 'Islamabad Capital', prefix: '300', desc: 'Islamabad mobile prefix' },
  ],
  NG: [
    { name: 'Lagos', prefix: '802', desc: 'Lagos mobile prefix' },
    { name: 'Abuja (FCT)', prefix: '803', desc: 'FCT mobile prefix' },
    { name: 'Rivers (Port Harcourt)', prefix: '803', desc: 'Rivers mobile prefix' },
    { name: 'Kano', prefix: '803', desc: 'Kano mobile prefix' },
  ],
  BD: [
    { name: 'Dhaka', prefix: '181', desc: 'Dhaka mobile prefix' },
    { name: 'Chattogram', prefix: '181', desc: 'Chattogram mobile prefix' },
    { name: 'Rajshahi', prefix: '181', desc: 'Rajshahi mobile prefix' },
  ],
  ZA: [
    { name: 'Gauteng', prefix: '71', desc: 'Johannesburg / Pretoria mobile prefix' },
    { name: 'Western Cape', prefix: '71', desc: 'Cape Town mobile prefix' },
    { name: 'KwaZulu-Natal', prefix: '71', desc: 'Durban mobile prefix' },
  ],
  TR: [
    { name: 'İstanbul', prefix: '501', desc: 'Istanbul mobile prefix' },
    { name: 'Ankara', prefix: '501', desc: 'Ankara mobile prefix' },
    { name: 'İzmir', prefix: '501', desc: 'Izmir mobile prefix' },
  ],
  RU: [
    { name: 'Central (Moscow)', prefix: '912', desc: 'Moscow mobile prefix' },
    { name: 'Northwest (St. Petersburg)', prefix: '911', desc: 'St. Petersburg mobile prefix' },
    { name: 'Siberia (Novosibirsk)', prefix: '913', desc: 'Siberia mobile prefix' },
  ],
  CN: [
    { name: 'Beijing', prefix: '131', desc: 'Beijing mobile prefix' },
    { name: 'Shanghai', prefix: '131', desc: 'Shanghai mobile prefix' },
    { name: 'Guangdong', prefix: '131', desc: 'Guangzhou / Shenzhen mobile prefix' },
  ],
  JP: [
    { name: 'Tokyo', prefix: '901', desc: 'Tokyo mobile prefix' },
    { name: 'Osaka', prefix: '901', desc: 'Osaka mobile prefix' },
    { name: 'Fukuoka', prefix: '901', desc: 'Fukuoka mobile prefix' },
  ],
  ID: [
    { name: 'Jakarta', prefix: '812', desc: 'Jakarta mobile prefix' },
    { name: 'West Java', prefix: '812', desc: 'Bandung mobile prefix' },
    { name: 'East Java', prefix: '812', desc: 'Surabaya mobile prefix' },
  ],
  KR: [
    { name: 'Seoul', prefix: '102', desc: 'Seoul mobile prefix' },
    { name: 'Busan', prefix: '102', desc: 'Busan mobile prefix' },
  ],
  TH: [
    { name: 'Bangkok', prefix: '81', desc: 'Bangkok mobile prefix' },
    { name: 'Chiang Mai', prefix: '81', desc: 'Northern Thailand mobile prefix' },
    { name: 'Phuket', prefix: '81', desc: 'Southern Thailand mobile prefix' },
  ],
  VN: [
    { name: 'Hà Nội', prefix: '91', desc: 'Hanoi mobile prefix' },
    { name: 'TP. Hồ Chí Minh', prefix: '91', desc: 'Ho Chi Minh City mobile prefix' },
  ],
  PH: [
    { name: 'Metro Manila', prefix: '905', desc: 'Manila mobile prefix' },
    { name: 'Cebu', prefix: '905', desc: 'Cebu mobile prefix' },
    { name: 'Davao', prefix: '905', desc: 'Davao mobile prefix' },
  ],
  MY: [
    { name: 'Kuala Lumpur', prefix: '123', desc: 'KL mobile prefix' },
    { name: 'Selangor', prefix: '123', desc: 'Selangor mobile prefix' },
    { name: 'Penang', prefix: '123', desc: 'Penang mobile prefix' },
  ],
  AE: [
    { name: 'Dubai', prefix: '501', desc: 'Dubai mobile prefix' },
    { name: 'Abu Dhabi', prefix: '501', desc: 'Abu Dhabi mobile prefix' },
    { name: 'Sharjah', prefix: '501', desc: 'Sharjah mobile prefix' },
  ],
  SA: [
    { name: 'Riyadh', prefix: '51', desc: 'Riyadh mobile prefix' },
    { name: 'Jeddah', prefix: '51', desc: 'Jeddah mobile prefix' },
    { name: 'Dammam', prefix: '51', desc: 'Eastern Province mobile prefix' },
  ],
  EG: [
    { name: 'Cairo', prefix: '100', desc: 'Cairo mobile prefix' },
    { name: 'Alexandria', prefix: '100', desc: 'Alexandria mobile prefix' },
    { name: 'Giza', prefix: '100', desc: 'Giza mobile prefix' },
  ],
  AR: [
    { name: 'Buenos Aires', prefix: '911', desc: 'Buenos Aires mobile prefix' },
    { name: 'Córdoba', prefix: '911', desc: 'Córdoba mobile prefix' },
  ],
  CO: [
    { name: 'Bogotá', prefix: '321', desc: 'Bogotá mobile prefix' },
    { name: 'Medellín', prefix: '321', desc: 'Medellín mobile prefix' },
  ],
  CL: [
    { name: 'Santiago', prefix: '91', desc: 'Santiago mobile prefix' },
    { name: 'Valparaíso', prefix: '91', desc: 'Valparaíso mobile prefix' },
  ],
  PE: [
    { name: 'Lima', prefix: '91', desc: 'Lima mobile prefix' },
    { name: 'Arequipa', prefix: '91', desc: 'Arequipa mobile prefix' },
  ],
  UZ: [
    { name: 'Tashkent', prefix: '91', desc: 'Tashkent mobile prefix' },
    { name: 'Samarkand', prefix: '91', desc: 'Samarkand mobile prefix' },
  ],
  KZ: [
    { name: 'Almaty', prefix: '771', desc: 'Almaty mobile prefix' },
    { name: 'Astana', prefix: '771', desc: 'Astana mobile prefix' },
  ],
  UA: [
    { name: 'Kyiv', prefix: '501', desc: 'Kyiv mobile prefix' },
    { name: 'Odesa', prefix: '501', desc: 'Odesa mobile prefix' },
  ],
  IR: [
    { name: 'Tehran', prefix: '912', desc: 'Tehran mobile prefix' },
    { name: 'Isfahan', prefix: '912', desc: 'Isfahan mobile prefix' },
  ],
  IQ: [
    { name: 'Baghdad', prefix: '791', desc: 'Baghdad mobile prefix' },
    { name: 'Basra', prefix: '791', desc: 'Basra mobile prefix' },
  ],
  IL: [
    { name: 'Tel Aviv', prefix: '502', desc: 'Tel Aviv mobile prefix' },
    { name: 'Jerusalem', prefix: '502', desc: 'Jerusalem mobile prefix' },
  ],
  RO: [
    { name: 'București', prefix: '712', desc: 'Bucharest mobile prefix' },
    { name: 'Cluj', prefix: '712', desc: 'Cluj-Napoca mobile prefix' },
  ],
  NL: [
    { name: 'Noord-Holland', prefix: '612', desc: 'Amsterdam mobile prefix' },
    { name: 'Zuid-Holland', prefix: '612', desc: 'Rotterdam mobile prefix' },
  ],
  SE: [
    { name: 'Stockholm', prefix: '701', desc: 'Stockholm mobile prefix' },
    { name: 'Göteborg', prefix: '701', desc: 'Gothenburg mobile prefix' },
  ],
  NO: [
    { name: 'Oslo', prefix: '406', desc: 'Oslo mobile prefix' },
    { name: 'Bergen', prefix: '406', desc: 'Bergen mobile prefix' },
  ],
  FI: [
    { name: 'Uusimaa (Helsinki)', prefix: '412', desc: 'Helsinki mobile prefix' },
    { name: 'Pirkanmaa (Tampere)', prefix: '412', desc: 'Tampere mobile prefix' },
  ],
  PL: [
    { name: 'Mazowieckie (Warsaw)', prefix: '512', desc: 'Warsaw mobile prefix' },
    { name: 'Małopolskie (Kraków)', prefix: '512', desc: 'Kraków mobile prefix' },
  ],
  GR: [
    { name: 'Attica (Athens)', prefix: '691', desc: 'Athens mobile prefix' },
    { name: 'Central Macedonia', prefix: '691', desc: 'Thessaloniki mobile prefix' },
  ],
  PT: [
    { name: 'Lisboa', prefix: '912', desc: 'Lisbon mobile prefix' },
    { name: 'Porto', prefix: '912', desc: 'Porto mobile prefix' },
  ],
  AT: [
    { name: 'Wien', prefix: '664', desc: 'Vienna mobile prefix' },
    { name: 'Salzburg', prefix: '664', desc: 'Salzburg mobile prefix' },
  ],
  CH: [
    { name: 'Zürich', prefix: '78', desc: 'Zürich mobile prefix' },
    { name: 'Genève', prefix: '78', desc: 'Geneva mobile prefix' },
  ],
  BE: [
    { name: 'Brussels', prefix: '450', desc: 'Brussels mobile prefix' },
    { name: 'Flanders (Antwerp)', prefix: '450', desc: 'Antwerp mobile prefix' },
  ],
  IE: [
    { name: 'Leinster (Dublin)', prefix: '850', desc: 'Dublin mobile prefix' },
    { name: 'Munster (Cork)', prefix: '850', desc: 'Cork mobile prefix' },
  ],
  NZ: [
    { name: 'Auckland', prefix: '211', desc: 'Auckland mobile prefix' },
    { name: 'Wellington', prefix: '211', desc: 'Wellington mobile prefix' },
  ],
  LK: [
    { name: 'Western (Colombo)', prefix: '71', desc: 'Colombo mobile prefix' },
    { name: 'Central (Kandy)', prefix: '71', desc: 'Kandy mobile prefix' },
  ],
  NP: [
    { name: 'Bagmati (Kathmandu)', prefix: '984', desc: 'Kathmandu mobile prefix' },
    { name: 'Lumbini', prefix: '984', desc: 'Lumbini mobile prefix' },
  ],
  KH: [
    { name: 'Phnom Penh', prefix: '91', desc: 'Phnom Penh mobile prefix' },
    { name: 'Siem Reap', prefix: '91', desc: 'Siem Reap mobile prefix' },
  ],
  ET: [
    { name: 'Addis Ababa', prefix: '911', desc: 'Addis Ababa mobile prefix' },
    { name: 'Amhara', prefix: '911', desc: 'Amhara region mobile prefix' },
  ],
  KE: [
    { name: 'Nairobi', prefix: '712', desc: 'Nairobi mobile prefix' },
    { name: 'Mombasa', prefix: '712', desc: 'Mombasa mobile prefix' },
  ],
  GH: [
    { name: 'Greater Accra', prefix: '23', desc: 'Accra mobile prefix' },
    { name: 'Ashanti (Kumasi)', prefix: '23', desc: 'Kumasi mobile prefix' },
  ],
  TZ: [
    { name: 'Dar es Salaam', prefix: '621', desc: 'Dar es Salaam mobile prefix' },
    { name: 'Arusha', prefix: '621', desc: 'Arusha mobile prefix' },
  ],
  UG: [
    { name: 'Kampala', prefix: '712', desc: 'Kampala mobile prefix' },
    { name: 'Gulu', prefix: '712', desc: 'Gulu mobile prefix' },
  ],
  MA: [
    { name: 'Casablanca', prefix: '650', desc: 'Casablanca mobile prefix' },
    { name: 'Rabat', prefix: '650', desc: 'Rabat mobile prefix' },
  ],
  DZ: [
    { name: 'Algiers', prefix: '551', desc: 'Algiers mobile prefix' },
    { name: 'Oran', prefix: '551', desc: 'Oran mobile prefix' },
  ],
  TN: [
    { name: 'Tunis', prefix: '201', desc: 'Tunis mobile prefix' },
    { name: 'Sfax', prefix: '201', desc: 'Sfax mobile prefix' },
  ],
  NG_EXTRA: [],
};

// Export the region type label for a country.
export function getRegionTypeLabel(country) {
  return REGION_TYPES[country] || 'region';
}

/**
 * Get the readable list of regions for a country. Each region carries:
 *   name, prefix (NPA/NXX), desc.
 * A universal "Mobile" option (the country's general mobile prefix) is always
 * prepended so users can generate from the whole mobile range.
 */
export function getRegionsForCountry(countryCode) {
  const ctx = getCountryGeneratorContext(countryCode);
  const list = (REGIONS[countryCode] || []);
  const basePrefix = ctx ? ctx.prefix : null;
  const regions = [];
  if (ctx && ctx.subscriberLength > 0) {
    regions.push({
      name: 'Mobile (All)',
      prefix: basePrefix,
      desc: `General mobile range for ${countryCode.toUpperCase()}`,
      isDefault: true,
    });
  }
  list.forEach((r) => regions.push({ ...r }));
  return regions;
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

  const runBucket = (index, share, budgetMs) => {
    if (share <= 0) return;
    const res = generateFromPool({
      iso,
      sourceIso: validateIso,
      callingCode,
      pool: list[index].pool,
      quantity: share,
      startIndex: index,
      seen,
      allowedTypes: types,
      deadlineMs: budgetMs,
    });
    perBucket[index] = perBucket[index].concat(res.numbers);
  };

  const base = Math.floor(target / list.length);
  const extra = target % list.length;
  for (let i = 0; i < list.length; i += 1) runBucket(i, base + (i < extra ? 1 : 0), Math.ceil(BUCKET_TIME_BUDGET_MS / list.length));

  // Second pass: recover any shortfall from buckets whose pool was too small.
  let produced = perBucket.reduce((sum, list_) => sum + list_.length, 0);
  for (let i = 0; produced < target && i < list.length && i < 8; i += 1) {
    const deficit = target - produced;
    runBucket(i, deficit, Math.ceil(BUCKET_TIME_BUDGET_MS / list.length));
    produced = perBucket.reduce((sum, list_) => sum + list_.length, 0);
  }

  const interleaved = [];
  const maxLen = Math.max(0, ...perBucket.map((b) => b.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (let b = 0; b < perBucket.length; b += 1) {
      if (i < perBucket[b].length) {
        interleaved.push({ number: perBucket[b][i], bucketIndex: b });
      }
    }
  }

  const numbers = interleaved.slice(0, target);
  return {
    numbers,
    truncated: numbers.length < target,
    error: numbers.length ? null : 'Could not generate valid numbers for this selection.',
  };
}

/**
 * Generate `quantity` unique valid numbers for a specific region (by its
 * national prefix) within `countryCode`. Returns E.164 strings.
 */
export async function getRegionNumbers(countryCode, regionPrefix, quantity) {
  const iso = String(countryCode || '').toUpperCase();
  await ensureNumberingDatasets();
  const plan = getCountryPlan(iso);
  if (!plan || !plan.prefixes.length) {
    return { numbers: [], error: 'No numbering plan is available for this country yet.' };
  }
  const pool = expandPrefixes(iso, [regionPrefix]);
  const types = plan.isMobileOnly ? MOBILE_TYPES : FIXED_TYPES;
  const result = generateFromPool({
    iso,
    sourceIso: plan.sourceIso,
    callingCode: plan.callingCode,
    quantity,
    pool: pool.length ? pool : plan.prefixes,
    allowedTypes: types,
  });
  return { numbers: result.numbers.map((n) => n.number), error: result.error };
}
