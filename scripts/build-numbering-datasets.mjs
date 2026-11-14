/* ============================================================================
   WhatsApp Shield — Numbering dataset builder
   ----------------------------------------------------------------------------
   Regenerates the build-time numbering datasets in src/data from installed
   libphonenumber / country-state-city metadata:

     operators.json   carrier name -> national prefixes, per territory.
                      Entry: [{ n: string, p: string[] }]
     regions.json     ISO 3166-2 subdivisions (label-only unless geocodes
                      provide verified prefixes). Entry: [isoCode, name]

   mobilePrefixes.json is NOT regenerated here: its shipped per-territory
   prefix granularity (2/3/4 digits) comes from a legacy probing heuristic that
   is not reproducible from metadata alone. The shipped file is authoritative
   and is validated/reported, never overwritten. See NUMBERING_DATASETS.md.

   SAFETY: every output is written only if it is BYTE-IDENTICAL to the file
   already on disk (shipped key order is preserved). If a regenerated dataset
   would differ, the shipped file is left untouched and the candidate is
   written to <name>.candidate.json for review. A rebuild can never silently
   corrupt the curated datasets.

   Run:  npm run build:datasets
   ========================================================================== */

import fs from 'fs';
import path from 'path';
import { deserialize } from 'bson';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';
import { State } from 'country-state-city';

const CARRIER = 'node_modules/libphonenumber-geo-carrier/resources/carrier/en';
const OUT = 'src/data';
const countries = getCountries();

const alphabetical = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));

/** Reorder `obj` keys to match the shipped file's key order (new keys appended). */
function preserveOrder(obj, file) {
  if (!fs.existsSync(file)) return obj;
  const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = {};
  for (const k of Object.keys(prev)) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  for (const k of Object.keys(obj).sort()) if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = obj[k];
  return out;
}

/** Write `obj` only when it byte-matches the shipped file; else keep + flag. */
function writeGuarded(name, obj) {
  const file = path.join(OUT, name);
  const next = JSON.stringify(obj);
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev === next) {
    console.log(`${name.padEnd(20)} unchanged (byte-identical to shipped)`);
    return true;
  }
  fs.writeFileSync(path.join(OUT, `${name}.candidate.json`), next);
  console.warn(`${name.padEnd(20)} DIFFERS — shipped file kept; candidate at src/data/${name}.candidate.json`);
  return false;
}

// ---------------------------------------------------------------------------
// 1. Operators — group carrier prefixes by name; order each operator's
//    prefixes by (length asc, then lexical); order operators by (prefix count
//    desc, then name asc); keys alphabetical.
// ---------------------------------------------------------------------------

const operators = {};
for (const iso of countries) {
  const cc = String(getCountryCallingCode(iso));
  const file = path.join(CARRIER, `${cc}.bson`);
  if (!fs.existsSync(file)) continue;
  const data = deserialize(fs.readFileSync(file));
  const byName = new Map();
  for (const [prefix, name] of Object.entries(data)) {
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(String(prefix));
  }
  operators[iso] = Array.from(byName)
    .map(([n, p]) => ({ n, p: [...p].sort((a, b) => a.length - b.length || a.localeCompare(b)) }))
    .sort((a, b) => b.p.length - a.p.length || a.n.localeCompare(b.n));
}
writeGuarded('operators.json', alphabetical(operators));

// ---------------------------------------------------------------------------
// 2. Regions — ISO 3166-2 subdivisions; code NOT stripped; deduped by name
//    keeping the first; sorted by name; shipped key order preserved.
// ---------------------------------------------------------------------------

const regions = {};
for (const iso of countries) {
  let subs = [];
  try { subs = State.getStatesOfCountry(iso) || []; } catch { subs = []; }
  const seen = new Set();
  const list = [];
  for (const s of subs) {
    const code = String(s.isoCode || '');
    const name = String(s.name || '');
    if (!code || !name || seen.has(name)) continue;
    seen.add(name);
    list.push([code, name]);
  }
  if (list.length) regions[iso] = list.sort((a, b) => a[1].localeCompare(b[1]));
}
writeGuarded('regions.json', preserveOrder(regions, path.join(OUT, 'regions.json')));

// ---------------------------------------------------------------------------
// 3. mobilePrefixes.json — authoritative; validated and reported only.
// ---------------------------------------------------------------------------

const mobileFile = path.join(OUT, 'mobilePrefixes.json');
if (fs.existsSync(mobileFile)) {
  const m = JSON.parse(fs.readFileSync(mobileFile, 'utf8'));
  const entries = Object.values(m);
  const withPrefixes = entries.filter((e) => e.prefixes.length).length;
  const fixed = entries.filter((e) => e.type === 'FIXED_LINE').length;
  console.log(`mobilePrefixes.json  authoritative: ${entries.length} territories, ${withPrefixes} with prefixes, ${fixed} fixed-line, ${entries.filter((e) => e.parent).length} inherited parents`);
  console.log(`                     prefix granularity: ${JSON.stringify(entries.reduce((acc, e) => { for (const [p] of e.prefixes) { const g = p.length; acc[g] = (acc[g] || 0) + 1; } return acc; }, {}))}`);
  if (!withPrefixes) console.warn('mobilePrefixes.json looks EMPTY — check src/data.');
} else {
  console.warn('mobilePrefixes.json missing from src/data');
}

console.log('\nNumbering datasets processed.');
