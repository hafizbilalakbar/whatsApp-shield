import fs from 'fs';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

const enNames = new Intl.DisplayNames(['en'], { type: 'region' });

const allCountries = getCountries().map((iso) => {
  const name = enNames.of(iso) || iso;
  return {
    name,
    code: getCountryCallingCode(iso),
    iso: iso.toLowerCase()
  };
}).sort((a, b) => a.name.localeCompare(b.name));

const lines = [
  '// Generated dynamically from libphonenumber-js official metadata',
  '',
  `export const countries = ${JSON.stringify(allCountries, null, 2)};`,
  '',
  'export const DEFAULT_COUNTRY_CODE = "1";',
  'export const PREFERRED_ISO_FOR_CODE = { "1": "us", "7": "ru", "44": "gb" };',
  '',
  'export const getCountryByCallingCode = (code) => {',
  '  if (!code) return null;',
  '  const normalized = String(code).replace(/\\D/g, "");',
  '  const matches = countries.filter((c) => c.code === normalized);',
  '  if (matches.length === 0) return null;',
  '  if (matches.length === 1) return matches[0];',
  '  const preferredIso = PREFERRED_ISO_FOR_CODE[normalized];',
  '  if (preferredIso) {',
  '    const preferred = matches.find((m) => m.iso === preferredIso);',
  '    if (preferred) return preferred;',
  '  }',
  '  return matches[0];',
  '};',
  '',
  'export const getCountryByIso = (iso) => {',
  '  if (!iso) return null;',
  '  const normalized = String(iso).trim().toLowerCase();',
  '  return countries.find((c) => c.iso === normalized) || null;',
  '};',
  '',
  'export const getDefaultCountry = () => getCountryByCallingCode(DEFAULT_COUNTRY_CODE);',
  ''
];

fs.writeFileSync('./src/data/countries.js', lines.join('\n'));
console.log('Successfully written', allCountries.length, 'countries to src/data/countries.js');
