import examples from 'libphonenumber-js/mobile/examples';
import { getExampleNumber, parsePhoneNumberFromString, getCountryCallingCode, isSupportedCountry } from 'libphonenumber-js';

/* ============================================================================
   WhatsApp Shield — Number Generation Engine
   ----------------------------------------------------------------------------
   Generates *valid, correctly formatted* numbers for a selected country using
   that country's official numbering plan (via libphonenumber-js metadata and
   the per-country mobile *example* number, which is guaranteed valid).

   Algorithm:
   1. Fetch the country's official mobile example number.
   2. Keep its leading National Destination Code (prefix) fixed.
   3. Randomize only the subscriber portion, to the exact base length.
   4. Re-validate every candidate with `isValid()`, keep only valid ones.
   5. Deduplicate and truncate to the requested quantity.

   The system NEVER claims a generated number belongs to a real person, brand or
   WhatsApp account. Generated numbers are synthetic/test data — they must only
   be used against authorized, consent-based or publicly provided contact lists,
   and in compliance with applicable law and WhatsApp's policies.
   ============================================================================ */

// Number of leading National-Destination-Code digits to keep fixed per country.
// These come straight from the country's official mobile numbering plan. For
// most countries the mobile prefix is 2–4 digits; NANP (US/CA/etc.) needs 4.
const KEEP_PREFIX = {
  US: 4, CA: 4, MX: 4, DO: 4, JM: 4, TT: 4, BS: 4, BB: 4, PA: 3,
  PR: 4, GU: 4, VI: 4, AS: 4, KN: 4, AG: 4, AI: 4, GD: 4, DM: 4, VC: 4,
  LC: 4, BM: 4, KY: 4, TC: 4, MS: 4, SX: 4, CW: 4, BQ: 3,
};

// Fallback: derive keep length from the example's national number length.
function prefixLength(country, natLen) {
  if (KEEP_PREFIX[country]) return KEEP_PREFIX[country];
  if (natLen <= 8) return 2;
  if (natLen === 9) return 3;
  if (natLen >= 10) return natLen === 10 ? 3 : 3;
  return 2;
}

// Maximum attempts per generated number before giving up (safety net).
const MAX_ATTEMPTS_PER_NUMBER = 40;
const MAX_TOTAL_ATTEMPTS = 200000;

function randomDigits(len) {
  let out = '';
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

/**
 * Build a per-country generator context: the E.164 prefix (+<cc>), the fixed
 * national destination code, and the subscriber length.
 */
export function getCountryGeneratorContext(countryCode) {
  if (!countryCode || !isSupportedCountry(countryCode)) return null;
  const example = getExampleNumber(countryCode, examples);
  if (!example || !example.nationalNumber) return null;
  const nat = example.nationalNumber;
  const keep = prefixLength(countryCode, nat.length);
  if (keep >= nat.length) {
    // Guard: prefix must be shorter than the number so there is something to vary.
    return {
      country: countryCode,
      callingCode: example.countryCallingCode,
      national: nat,
      prefix: nat,
      subscriberLength: 0,
    };
  }
  return {
    country: countryCode,
    callingCode: example.countryCallingCode,
    national: nat,
    prefix: nat.slice(0, keep),
    subscriberLength: nat.length - keep,
  };
}

function formatValid(candidateDigits, countryCode, callingCode) {
  const p = parsePhoneNumberFromString('+' + callingCode + candidateDigits, countryCode);
  if (p && p.isValid()) return p.number; // E.164
  return null;
}

/**
 * Generate `quantity` unique, valid numbers for `countryCode`.
 * Returns an array of E.164 strings. May return fewer than requested if the
 * country's plan offers limited distinct valid numbers (rare).
 */
export function getRandomNumbers(countryCode, quantity) {
  const ctx = getCountryGeneratorContext(countryCode);
  if (!ctx) return { numbers: [], error: `No numbering data available for this country.` };

  const target = Math.max(1, Math.min(Math.floor(quantity) || 0, 50000));
  const seen = new Set();
  const result = [];
  let totalAttempts = 0;

  while (result.length < target && totalAttempts < MAX_TOTAL_ATTEMPTS) {
    totalAttempts += 1;
    const subscriber = ctx.subscriberLength > 0 ? randomDigits(ctx.subscriberLength) : '';
    const candidate = ctx.prefix + subscriber;
    const e164 = formatValid(candidate, countryCode, ctx.callingCode);
    if (e164 && !seen.has(e164)) {
      seen.add(e164);
      result.push(e164);
    }
  }
  return { numbers: result, error: null };
}

/* ============================================================================
   COUNTRY CODE CONVERSION
   ----------------------------------------------------------------------------
   The rest of the app selects countries by their *calling code* (e.g. "+1",
   "+92"). libphonenumber-js works with ISO alpha-2 codes (e.g. "US", "PK").
   For the many codes shared between countries (e.g. +1 = US/CA, +7 = RU/KZ)
   we pick a primary/relevant country so the generator stays predictable.
   ============================================================================ */

import { countries } from './countries.js';

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
  const cc = code.startsWith('+') ? code.slice(1) : code;
  if (callingCodeToIsoCache[cc]) return callingCodeToIsoCache[cc];
  let iso = CALLING_CODE_PREFERRED_ISO[cc] || null;
  if (!iso) {
    const c = countries.find((x) => x.code === cc);
    iso = c ? c.iso.toUpperCase() : null;
  }
  callingCodeToIsoCache[cc] = iso;
  return iso;
}

/**
 * Convert an ISO code (e.g. "US") to its calling code (e.g. "1").
 */
export function isoToCallingCode(iso) {
  try {
    return getCountryCallingCode(iso);
  } catch (e) {
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
 * Generate `quantity` unique valid numbers for a specific region (by its
 * national prefix) within `countryCode`. Returns E.164 strings.
 */
export function getRegionNumbers(countryCode, regionPrefix, quantity) {
  const ctx = getCountryGeneratorContext(countryCode);
  if (!ctx) return { numbers: [], error: `No numbering data available for this country.` };

  const prefix = String(regionPrefix || ctx.prefix).replace(/\D/g, '');
  const target = Math.max(1, Math.min(Math.floor(quantity) || 0, 50000));
  const seen = new Set();
  const result = [];
  let totalAttempts = 0;

  // Subscriber length: keep national total length, minus the fixed prefix.
  const subscriberLength = Math.max(1, ctx.national.length - prefix.length);

  while (result.length < target && totalAttempts < MAX_TOTAL_ATTEMPTS) {
    totalAttempts += 1;
    const candidate = prefix + randomDigits(subscriberLength);
    const e164 = formatValid(candidate, countryCode, ctx.callingCode);
    if (e164 && !seen.has(e164)) {
      seen.add(e164);
      result.push(e164);
    }
  }
  return { numbers: result, error: null };
}
