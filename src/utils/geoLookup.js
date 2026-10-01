import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { getRegionsForCountry } from '../data/numberingPlans.js';

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
export async function getDynamicRegionsForCountry(countryIso, callingCode) {
  if (!countryIso) return [];
  const iso = countryIso.toUpperCase();
  const cc = String(callingCode || '').replace(/\D/g, '');

  const regionMap = new Map();

  // 1. Check numberingPlans.js for predefined regions
  try {
    const existing = getRegionsForCountry(iso);
    if (Array.isArray(existing)) {
      for (const r of existing) {
        if (!r.isDefault && r.prefix && r.name && !r.name.startsWith('Mobile (All)')) {
          if (!regionMap.has(r.name)) {
            regionMap.set(r.name, new Set());
          }
          regionMap.get(r.name).add(r.prefix);
        }
      }
    }
  } catch {}

  // 2. Load geocodes for calling code
  const data = await loadGeocodesForCallingCode(cc);
  if (data && typeof data === 'object') {
    for (const [prefix, rawLoc] of Object.entries(data)) {
      if (!rawLoc || typeof rawLoc !== 'string') continue;
      
      // NANP (+1) scoping
      if (cc === '1') {
        if (iso === 'US') {
          // Exclude Canadian provinces and other NANP territories
          if (CANADIAN_PROVINCES[rawLoc] || Object.values(CANADIAN_PROVINCES).includes(rawLoc) || rawLoc.includes(', ON') || rawLoc.includes(', QC') || rawLoc.includes(', BC') || rawLoc.includes(', AB') || rawLoc.includes('Ontario') || rawLoc.includes('Quebec') || rawLoc.includes('British Columbia')) {
            continue;
          }
          const norm = normalizeGeoLocation(rawLoc, 'US');
          if (norm && (US_STATE_NAMES[norm] || Object.values(US_STATE_NAMES).includes(norm) || Object.values(US_STATE_NAMES).some(st => norm.endsWith(st)))) {
            const stateName = Object.values(US_STATE_NAMES).find(st => norm.endsWith(st)) || norm;
            if (!regionMap.has(stateName)) regionMap.set(stateName, new Set());
            regionMap.get(stateName).add(prefix);
          }
        } else if (iso === 'CA') {
          if (CANADIAN_PROVINCES[rawLoc] || Object.values(CANADIAN_PROVINCES).includes(rawLoc) || rawLoc.includes(', ON') || rawLoc.includes(', QC') || rawLoc.includes(', BC') || rawLoc.includes(', AB') || rawLoc.includes('Ontario') || rawLoc.includes('Quebec') || rawLoc.includes('British Columbia')) {
            const norm = normalizeGeoLocation(rawLoc, 'CA');
            const provName = Object.values(CANADIAN_PROVINCES).find(pv => norm.endsWith(pv)) || norm;
            if (!regionMap.has(provName)) regionMap.set(provName, new Set());
            regionMap.get(provName).add(prefix);
          }
        }
      } else {
        const norm = normalizeGeoLocation(rawLoc, iso);
        if (norm) {
          if (!regionMap.has(norm)) regionMap.set(norm, new Set());
          regionMap.get(norm).add(prefix);
        }
      }
    }
  }

  const result = [];
  for (const [name, prefixesSet] of regionMap.entries()) {
    const prefixes = Array.from(prefixesSet).sort((a, b) => a.length - b.length || a.localeCompare(b));
    if (prefixes.length > 0) {
      result.push({
        id: `${iso}::${prefixes[0]}::${name}`,
        name,
        prefix: prefixes[0],
        prefixes,
        count: prefixes.length
      });
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}
