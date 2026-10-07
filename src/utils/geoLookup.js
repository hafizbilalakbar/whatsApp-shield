import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { getRegionsForCountry, getSubdivisionsForCountry } from '../data/numberingPlans.js';
import { ensureNumberingDatasets } from '../data/numberingDatasets.js';

/* ============================================================================
   US State Abbreviation -> Full English Name Standard Normalizer
   ============================================================================ */
const US_STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico', VI: 'Virgin Islands', GU: 'Guam',
};

const CANADIAN_PROVINCES = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',
};

/**
 * Normalizes location strings (e.g. "Miami, FL" -> "Miami, Florida").
 */
export function normalizeGeoLocation(rawLocation, countryIso) {
  if (!rawLocation || typeof rawLocation !== 'string') return null;
  const trimmed = rawLocation.trim();
  if (!trimmed) return null;

  // Handle US / CA abbreviation formats like "City, ST" or "ST"
  if (countryIso === 'US' || countryIso === 'CA') {
    const parts = trimmed.split(',').map((p) => p.trim());
    if (parts.length === 2) {
      const city = parts[0];
      const stateAbbr = parts[1].toUpperCase();
      const stateFull = (countryIso === 'US' ? US_STATE_NAMES[stateAbbr] : CANADIAN_PROVINCES[stateAbbr]) || parts[1];
      return city ? `${city}, ${stateFull}` : stateFull;
    }
    if (parts.length === 1) {
      const abbr = parts[0].toUpperCase();
      if (countryIso === 'US' && US_STATE_NAMES[abbr]) return US_STATE_NAMES[abbr];
      if (countryIso === 'CA' && CANADIAN_PROVINCES[abbr]) return CANADIAN_PROVINCES[abbr];
    }
  }

  return trimmed;
}

/* ============================================================================
   STEP 2: RUNTIME REVERSE INDEX OF APP'S EXISTING NUMBERING PLANS
   Dynamically indexed in-memory from `src/data/numberingPlans.js` at runtime.
   Zero duplicate / hand-written tables.
   ============================================================================ */
let reverseRegionMap = null;

function getRuntimeReverseRegionIndex() {
  if (reverseRegionMap) return reverseRegionMap;

  reverseRegionMap = new Map();
  const prefixCounts = new Map(); // key -> Set(regionNames)

  const ALL_COUNTRY_ISOS = [
    'US', 'CA', 'IN', 'BR', 'AU', 'DE', 'MX', 'GB', 'FR', 'IT', 'ES', 'PK',
    'NG', 'BD', 'ZA', 'TR', 'RU', 'CN', 'JP', 'ID', 'KR', 'TH', 'VN', 'PH',
    'MY', 'AE', 'SA', 'EG', 'AR', 'CO', 'CL', 'PE', 'UZ', 'KZ', 'UA', 'IR',
    'IQ', 'IL', 'RO', 'NL', 'SE', 'NO', 'FI', 'PL', 'GR', 'PT', 'AT', 'CH',
    'BE', 'IE', 'NZ', 'LK', 'NP', 'KH', 'ET', 'KE', 'GH', 'TZ', 'UG', 'MA',
    'DZ', 'TN',
  ];

  for (const iso of ALL_COUNTRY_ISOS) {
    try {
      const regionList = getRegionsForCountry(iso);
      if (!Array.isArray(regionList)) continue;

      for (const r of regionList) {
        if (r.isDefault || !r.prefix || !r.name || r.name.startsWith('Mobile (All)')) continue;
        const key = `${iso}::${r.prefix}`;
        if (!prefixCounts.has(key)) {
          prefixCounts.set(key, new Set());
        }
        prefixCounts.get(key).add(r.name);
      }
    } catch {
      // Continue indexing
    }
  }

  // Only index prefixes that uniquely identify a single region
  for (const [key, names] of prefixCounts.entries()) {
    if (names.size === 1) {
      reverseRegionMap.set(key, Array.from(names)[0]);
    }
  }

  return reverseRegionMap;
}

/**
 * Reverse lookup against the app's existing numbering plan data.
 */
export function lookupExistingNumberingPlanRegion(countryIso, nationalNumber) {
  if (!countryIso || !nationalNumber) return null;
  const index = getRuntimeReverseRegionIndex();
  const digits = String(nationalNumber).replace(/\D/g, '');

  for (let len = Math.min(digits.length, 6); len >= 1; len--) {
    const sub = digits.slice(0, len);
    const key = `${countryIso}::${sub}`;
    if (index.has(key)) {
      return index.get(key);
    }
  }

  return null;
}

/* ============================================================================
   STEP 3: MAINTAINED GEOCODING DATASET (Google libphonenumber offline data)
   Lazy-loaded on-demand per country calling code without network requests.
   ============================================================================ */
const geocodeCache = new Map(); // callingCode -> Promise<Record<string, string>>
const syncGeocodeData = new Map(); // callingCode -> Record<string, string>
const listeners = new Set(); // Re-render listeners when lazy chunks load

export function subscribeGeocodesLoaded(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyGeocodesLoaded() {
  listeners.forEach((fn) => {
    try { fn(); } catch {}
  });
}

// Vite glob for offline geocodes
const geocodeModules = typeof import.meta !== 'undefined' && import.meta.glob
  ? import.meta.glob('../data/geocodes/*.json')
  : null;

/**
 * Lazy loads geocoding data for a calling code.
 */
export async function loadGeocodesForCallingCode(callingCode) {
  const cc = String(callingCode || '').replace(/\D/g, '');
  if (!cc) return null;

  if (syncGeocodeData.has(cc)) return syncGeocodeData.get(cc);
  if (geocodeCache.has(cc)) return geocodeCache.get(cc);

  let promise;
  if (geocodeModules) {
    const modulePath = `../data/geocodes/${cc}.json`;
    const loader = geocodeModules[modulePath];
    if (!loader) {
      syncGeocodeData.set(cc, null);
      return null;
    }
    promise = loader()
      .then((mod) => {
        const data = mod.default || mod;
        syncGeocodeData.set(cc, data);
        notifyGeocodesLoaded();
        return data;
      })
      .catch(() => {
        syncGeocodeData.set(cc, null);
        return null;
      });
  } else {
    // Node.js fallback (for unit tests without Vite)
    promise = (async () => {
      try {
        const nodeFs = await (Function('return import("fs")')());
        const nodePath = await (Function('return import("path")')());
        const filePath = nodePath.resolve(process.cwd(), 'src/data/geocodes', `${cc}.json`);
        if (nodeFs.existsSync(filePath)) {
          const content = nodeFs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          syncGeocodeData.set(cc, data);
          notifyGeocodesLoaded();
          return data;
        }
      } catch {}
      syncGeocodeData.set(cc, null);
      return null;
    })();
  }

  geocodeCache.set(cc, promise);
  return promise;
}

/**
 * Synchronous registration of geocode dataset for a calling code
 */
export function registerGeocodeDataSync(callingCode, data) {
  const cc = String(callingCode || '').replace(/\D/g, '');
  if (cc && data) {
    syncGeocodeData.set(cc, data);
  }
}

/**
 * Helper to asynchronously preload geocode datasets for calling codes
 */
export function preloadCallingCodeGeocodes(callingCodes) {
  if (!Array.isArray(callingCodes)) return;
  callingCodes.forEach((cc) => loadGeocodesForCallingCode(cc));
}

/**
 * Performs longest prefix lookup in offline geocoding dataset.
 */
function lookupOfflineGeocode(callingCode, nationalNumber) {
  const cc = String(callingCode || '').replace(/\D/g, '');
  const data = syncGeocodeData.get(cc);

  if (!data) {
    if (!geocodeCache.has(cc)) {
      loadGeocodesForCallingCode(cc);
    }
    return null;
  }

  const digits = String(nationalNumber || '').replace(/\D/g, '');
  for (let len = digits.length; len > 0; len--) {
    const sub = digits.slice(0, len);
    if (data[sub]) {
      return data[sub];
    }
  }

  return null;
}

/* ============================================================================
   TOP-LEVEL DETECT STATE / LOCATION FUNCTION
   Strict Detection Order:
   1. Lead's own fields (state, region, city, countryName)
   2. App's existing geo data (Runtime reverse index of numberingPlans.js)
   3. Maintained geocoding dataset (Google libphonenumber offline geocodes)
   4. Nothing found -> null (no placeholder, no guessing)
   ============================================================================ */

const detectionMemoCache = new Map();

export function detectLeadLocation(lead) {
  if (!lead) return null;

  // 1. Check lead's own fields (regionName, state, region, city)
  const explicitState = (lead.regionName || lead.region_name || lead.state || lead.region || '').trim();
  const explicitCity = (lead.city || '').trim();
  if (explicitState || explicitCity) {
    if (explicitCity && explicitState) return `${explicitCity}, ${explicitState}`;
    if (explicitState) return explicitState;
    if (explicitCity) return explicitCity;
  }

  const rawNumber = String(lead.number || lead.phone || lead.cleanNumber || '').trim();
  if (!rawNumber) return null;

  const fullNumber = rawNumber.startsWith('+') ? rawNumber : `+${rawNumber.replace(/\D/g, '')}`;

  if (detectionMemoCache.has(fullNumber)) {
    return detectionMemoCache.get(fullNumber);
  }

  const parsed = parsePhoneNumberFromString(fullNumber, lead.detectedCountry || lead.countryCode || undefined);
  if (!parsed || !parsed.isValid()) {
    detectionMemoCache.set(fullNumber, null);
    return null;
  }

  const countryIso = parsed.country; // e.g. "US", "CA", "JM", "AE", "PK"
  const callingCode = parsed.countryCallingCode; // e.g. "1", "971", "92"
  const nationalNumber = parsed.nationalNumber; // e.g. "3055581234"

  // 2. Check App's existing geo data (reverse index of numberingPlans.js)
  const existingPlanRegion = lookupExistingNumberingPlanRegion(countryIso, nationalNumber);
  if (existingPlanRegion) {
    detectionMemoCache.set(fullNumber, existingPlanRegion);
    return existingPlanRegion;
  }

  // 3. Check Maintained Geocoding Library (Google libphonenumber offline geocodes)
  const rawGeocode = lookupOfflineGeocode(callingCode, nationalNumber);
  if (rawGeocode) {
    const normalized = normalizeGeoLocation(rawGeocode, countryIso);
    if (normalized) {
      detectionMemoCache.set(fullNumber, normalized);
      return normalized;
    }
  }

  // 4. Nothing found -> null
  detectionMemoCache.set(fullNumber, null);
  return null;
}

export function clearDetectionCache() {
  detectionMemoCache.clear();
}

/**
 * Loads dynamic state/region and city options for a country using official geocoding data
 */
const dynamicRegionCache = new Map(); // "ISO::cc" -> { source, regions }

/**
 * Loads region options for a country, combining two clearly separated sources:
 *
 *  1. Prefix regions - names that came from the offline geocoder chunks, so the
 *     prefixes attached to them are verified. These can generate numbers that
 *     belong to that specific area.
 *  2. ISO 3166-2 subdivisions - official administrative names, but with no
 *     verified prefix-to-area mapping. They are surfaced as label-only choices
 *     and are never presented as confirmed locations.
 *
 * Results are memoised per country; `clearRegionCache` drops them when the
 * caller needs a refresh.
 */
export async function getDynamicRegionsForCountry(countryIso, callingCode) {
  if (!countryIso) return { source: 'none', regions: [] };

  const iso = String(countryIso).toUpperCase();
  const cc = String(callingCode || '').replace(/\D/g, '');
  const cacheKey = `${iso}::${cc}`;
  if (dynamicRegionCache.has(cacheKey)) return dynamicRegionCache.get(cacheKey);

  const prefixRegions = new Map(); // region name -> Set(prefix)
  const addPrefix = (name, prefix) => {
    if (!name || !prefix) return;
    if (!prefixRegions.has(name)) prefixRegions.set(name, new Set());
    prefixRegions.get(name).add(prefix);
  };

  // 1. Prefix regions from the offline geocoder chunks (verified)
  let data = null;
  try {
    data = await loadGeocodesForCallingCode(cc);
  } catch {}

  if (data && typeof data === 'object') {
    for (const [prefix, rawLoc] of Object.entries(data)) {
      if (!rawLoc || typeof rawLoc !== 'string') continue;

      // NANP (+1) scoping: the shared calling code also covers Canada and the
      // Caribbean, so only keep locations that belong to the requested country.
      if (cc === '1') {
        if (iso === 'US') {
          if (isCanadianLocation(rawLoc)) continue;
          const norm = normalizeGeoLocation(rawLoc, 'US');
          if (!norm) continue;
          const stateName =
            Object.values(US_STATE_NAMES).find((st) => norm === st || norm.endsWith(st)) || null;
          if (stateName) addPrefix(stateName, prefix);
        } else if (iso === 'CA') {
          if (!isCanadianLocation(rawLoc)) continue;
          const norm = normalizeGeoLocation(rawLoc, 'CA');
          if (!norm) continue;
          const provName = Object.values(CANADIAN_PROVINCES).find((pv) => norm === pv || norm.endsWith(pv)) || null;
          if (provName) addPrefix(provName, prefix);
        }
        continue;
      }

      const norm = normalizeGeoLocation(rawLoc, iso);
      if (norm) addPrefix(norm, prefix);
    }
  }

  const regions = [];

  for (const [name, prefixesSet] of prefixRegions.entries()) {
    const prefixes = Array.from(prefixesSet).sort((a, b) => a.length - b.length || a.localeCompare(b));
    if (prefixes.length === 0) continue;
    regions.push({
      id: `${iso}::p::${name}`,
      name,
      code: null,
      prefix: prefixes[0],
      prefixes,
      count: prefixes.length,
      verified: true,
      labelOnly: false,
      source: 'prefix',
    });
  }

  // 2. ISO 3166-2 subdivisions (label-only, no verified prefix mapping)
  let subdivisions = [];
  try {
    await ensureNumberingDatasets();
    subdivisions = getSubdivisionsForCountry(iso) || [];
  } catch {}

  for (const sub of subdivisions) {
    if (!sub) continue;
    const name = sub.name;
    const code = sub.isoCode || sub.code || null;
    if (!name) continue;
    regions.push({
      id: `${iso}::iso::${code || name}`,
      name,
      code,
      prefix: '',
      prefixes: [],
      count: 0,
      verified: false,
      labelOnly: true,
      source: 'iso',
    });
  }

  // Never list the same region twice: a subdivision already covered by verified
  // prefixes keeps the verified entry and drops its label-only twin.
  const verifiedNames = new Set(regions.filter((r) => r.verified).map((r) => r.name));
  const deduped = regions.filter((r) => r.verified || !verifiedNames.has(r.name));

  deduped.sort((a, b) => a.name.localeCompare(b.name));

  const hasVerified = deduped.some((r) => r.verified);
  const hasLabelOnly = deduped.some((r) => r.labelOnly);
  const result = {
    source: hasVerified ? (hasLabelOnly ? 'prefix+iso' : 'prefix') : hasLabelOnly ? 'iso' : 'none',
    regions: deduped,
  };

  dynamicRegionCache.set(cacheKey, result);
  return result;
}

export function clearRegionCache() {
  dynamicRegionCache.clear();
}

function isCanadianLocation(rawLoc) {
  if (CANADIAN_PROVINCES[rawLoc]) return true;
  if (Object.values(CANADIAN_PROVINCES).includes(rawLoc)) return true;
  return /(,\s*(ON|QC|BC|AB|NB|NS|PE|NL|MB|SK)\b)|(Ontario)|(Quebec)|(British Columbia)|(Alberta)|(Manitoba)|(Saskatchewan)|(New Brunswick)|(Nova Scotia)|(Newfoundland)|(Prince Edward)/.test(
    rawLoc
  );
}
