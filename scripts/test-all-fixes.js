import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { countries, getCountryByCallingCode, getCountryByIso } from '../src/data/countries.js';
import {
  detectLeadLocation,
  getDynamicRegionsForCountry,
  normalizeGeoLocation
} from '../src/utils/geoLookup.js';
import fs from 'fs';

console.log('=== STARTING AUTOMATED QA TEST SUITE ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

async function runTests() {
  // Test 1: Country list count and integrity
  console.log('--- TEST 1: Country List Coverage ---');
  const libCountries = getCountries();
  assert(countries.length === libCountries.length, `Country count (${countries.length}) matches libphonenumber (${libCountries.length})`);
  assert(countries.length === 245, 'Exactly 245 countries supported');
  const us = getCountryByIso('us');
  assert(us && us.name === 'United States' && us.code === '1', 'US country lookup works');
  const ca = getCountryByIso('ca');
  assert(ca && ca.name === 'Canada' && ca.code === '1', 'Canada country lookup works');
  const jm = getCountryByIso('jm');
  assert(jm && jm.name === 'Jamaica' && jm.code === '1', 'Jamaica country lookup works with +1');

  // Test 2: Dynamic Region Extraction
  console.log('\n--- TEST 2: Dynamic State/Region Extraction ---');
  const usRegions = await getDynamicRegionsForCountry('US', '1');
  assert(usRegions.length >= 50, `US returns ${usRegions.length} states/territories (>= 50)`);
  const fl = usRegions.find(r => r.name === 'Florida');
  assert(fl && fl.prefixes.includes('305') && fl.prefixes.includes('786') && fl.prefixes.includes('954'), 'Florida contains 305, 786, 954');
  const ny = usRegions.find(r => r.name === 'New York');
  assert(ny && ny.prefixes.includes('212') && ny.prefixes.includes('917') && ny.prefixes.includes('347'), 'New York contains 212, 917, 347');
  const tx = usRegions.find(r => r.name === 'Texas');
  assert(tx && tx.prefixes.includes('713') && tx.prefixes.includes('512') && tx.prefixes.includes('214'), 'Texas contains 713, 512, 214');

  const caRegions = await getDynamicRegionsForCountry('CA', '1');
  assert(caRegions.length >= 10, `Canada returns ${caRegions.length} provinces (>= 10)`);
  const on = caRegions.find(r => r.name === 'Ontario');
  assert(on && on.prefixes.includes('416') && on.prefixes.includes('647'), 'Ontario contains 416, 647');

  const jmRegions = await getDynamicRegionsForCountry('JM', '1');
  assert(jmRegions.length === 0, 'Jamaica returns 0 state options (offers country-wide only, never lists US states)');

  const aeRegions = await getDynamicRegionsForCountry('AE', '971');
  assert(aeRegions.length > 0 && aeRegions.some(r => r.name.toLowerCase().includes('dubai')), 'UAE lists Dubai');

  const pkRegions = await getDynamicRegionsForCountry('PK', '92');
  assert(pkRegions.length > 0 && pkRegions.some(r => r.name.toLowerCase().includes('punjab') || r.name.toLowerCase().includes('lahore')), 'Pakistan lists provinces');

  // Test 3: Display-Time Lead Location Detection Hierarchy
  console.log('\n--- TEST 3: Lead Location Detection Hierarchy ---');
  await import('../src/utils/geoLookup.js').then(m => Promise.all([m.loadGeocodesForCallingCode('1'), m.loadGeocodesForCallingCode('44')]));
  // Rule 1: Lead own field wins
  const lead1 = { number: '+13055581234', detectedCountry: 'US', state: 'California' };
  assert(detectLeadLocation(lead1) === 'California', 'Rule 1: Lead state override wins');

  // Rule 2: Automatic lookup for Florida number
  const lead2 = { number: '+13055581234', cleanNumber: '13055581234', detectedCountry: 'US' };
  const loc2 = detectLeadLocation(lead2);
  assert(loc2 === 'Florida', `Rule 2/3: 305 number detects as Florida (got: ${loc2})`);

  // Rule 3: UK number
  const lead3 = { number: '+442079460912', cleanNumber: '442079460912', detectedCountry: 'GB' };
  const loc3 = detectLeadLocation(lead3);
  assert(loc3 && loc3.includes('London'), `UK +44 20 number detects as London (got: ${loc3})`);

  // Rule 4: No location data number (Jamaica +1 876)
  const lead4 = { number: '+18765551234', cleanNumber: '18765551234', detectedCountry: 'JM' };
  const loc4 = detectLeadLocation(lead4);
  assert(loc4 === null, `Jamaica toll/mobile number returns null (got: ${loc4})`);

  // Test 4: Verification of zero hand-written tables
  console.log('\n--- TEST 4: Verification of Zero Hand-Written Tables ---');
  const srcFiles = ['src/utils/geoLookup.js', 'src/components/dashboard/mockup/IosLeadRow.jsx', 'src/components/dashboard/mockup/IosPhoneScreen.jsx'];
  for (const f of srcFiles) {
    const content = fs.readFileSync(f, 'utf8');
    assert(!content.includes('areaCodeMap = {') && !content.includes('area_codes.json'), `No hardcoded area code map in ${f}`);
  }

  console.log(`\n=== QA TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===`);
  if (failCount > 0) process.exit(1);
}

runTests();
