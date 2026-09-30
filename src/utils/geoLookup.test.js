import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  detectLeadLocation,
  loadGeocodesForCallingCode,
  clearDetectionCache,
  lookupExistingNumberingPlanRegion,
  normalizeGeoLocation,
} from './geoLookup.js';

async function runTests() {
  console.log('--- Starting Geo Detection Test Suite ---');

  // Pre-load geocode data for calling code 1, 44, 61
  await loadGeocodesForCallingCode('1');
  await loadGeocodesForCallingCode('44');
  await loadGeocodesForCallingCode('61');

  // TEST 1: US Numbers (Florida, New York, Texas, California)
  console.log('1. Testing US numbers:');
  const leadFL = { number: '+13055584900' };
  const locFL = detectLeadLocation(leadFL);
  console.log('  FL (+1 305):', locFL);
  assert(locFL && (locFL.includes('Florida') || locFL.includes('Hialeah')), `Expected Florida, got ${locFL}`);

  const leadNY = { number: '+12125551234' };
  const locNY = detectLeadLocation(leadNY);
  console.log('  NY (+1 212):', locNY);
  assert(locNY && locNY.includes('New York'), `Expected New York, got ${locNY}`);

  const leadTX = { number: '+17135551234' };
  const locTX = detectLeadLocation(leadTX);
  console.log('  TX (+1 713):', locTX);
  assert(locTX && locTX.includes('Texas'), `Expected Texas, got ${locTX}`);

  const leadCA = { number: '+14155551234' };
  const locCA = detectLeadLocation(leadCA);
  console.log('  CA (+1 415):', locCA);
  assert(locCA && (locCA.includes('California') || locCA.includes('San Francisco')), `Expected California, got ${locCA}`);

  // TEST 2: UAE number through Step 2 (existing numbering plan reverse index)
  console.log('2. Testing UAE number (Step 2 reverse index from numberingPlans.js):');
  const leadUAE = { number: '+971501234567' };
  const locUAE = detectLeadLocation(leadUAE);
  console.log('  UAE (+971 501):', locUAE);
  assert.strictEqual(locUAE, 'Dubai', `Expected Dubai from numbering plan, got ${locUAE}`);

  // TEST 3: UK, Canada, Australia, Pakistan
  console.log('3. Testing International (UK, Canada, Australia, Pakistan):');
  const leadUK = { number: '+442079460912' };
  const locUK = detectLeadLocation(leadUK);
  console.log('  UK (+44 20):', locUK);
  assert(locUK && locUK.includes('London'), `Expected London, got ${locUK}`);

  const leadCA_ON = { number: '+14165551234' };
  const locCA_ON = detectLeadLocation(leadCA_ON);
  console.log('  Canada (+1 416):', locCA_ON);
  assert.strictEqual(locCA_ON, 'Ontario', `Expected Ontario, got ${locCA_ON}`);

  const leadAU = { number: '+61291234567' };
  const locAU = detectLeadLocation(leadAU);
  console.log('  Australia (+61 2):', locAU);
  assert(locAU && locAU.includes('Sydney'), `Expected Sydney, got ${locAU}`);

  const leadPK = { number: '+923001234567' };
  const locPK = detectLeadLocation(leadPK);
  console.log('  Pakistan (+92 300):', locPK);
  assert.strictEqual(locPK, 'Punjab', `Expected Punjab from numbering plan, got ${locPK}`);

  // TEST 4: Jamaica (+1 876) -> MUST NEVER return a US state
  console.log('4. Testing Jamaica (+1 876):');
  const leadJM = { number: '+18765551234' };
  const locJM = detectLeadLocation(leadJM);
  console.log('  Jamaica (+1 876):', locJM);
  assert.strictEqual(locJM, null, `Jamaica must return null for state/region, got ${locJM}`);

  // TEST 5: Toll-free and invalid numbers
  console.log('5. Testing Toll-free and invalid numbers:');
  const leadTollFree = { number: '+18005551234' };
  const locTF = detectLeadLocation(leadTollFree);
  console.log('  Toll-free (+1 800):', locTF);
  assert.strictEqual(locTF, null, `Toll-free must return null, got ${locTF}`);

  const leadInvalid = { number: 'invalid-number' };
  const locInv = detectLeadLocation(leadInvalid);
  console.log('  Invalid number:', locInv);
  assert.strictEqual(locInv, null, `Invalid number must return null, got ${locInv}`);

  // TEST 6: Lead with own state/city field overrides detected
  console.log('6. Testing lead with explicit custom state field override:');
  const leadCustom = { number: '+13055584900', state: 'Custom State Override', city: 'Miami Beach' };
  const locCustom = detectLeadLocation(leadCustom);
  console.log('  Custom lead field:', locCustom);
  assert.strictEqual(locCustom, 'Miami Beach, Custom State Override');

  // TEST 7: Verification that no manual area-code table exists
  console.log('7. Verifying no hand-written area-code JSON/JS files exist:');
  const nanpPath = path.resolve(process.cwd(), 'src/data/nanpAreaCodes.js');
  const exists = fs.existsSync(nanpPath);
  assert(!exists, 'nanpAreaCodes.js must NOT exist in the repository');
  console.log('  Verified: nanpAreaCodes.js does not exist.');

  // TEST 8: Performance Benchmark (5,000 lookups)
  console.log('8. Performance benchmark (5,000 lookups):');
  clearDetectionCache();
  const perfNumbers = [
    { number: '+13055581234' },
    { number: '+12125551234' },
    { number: '+17135551234' },
    { number: '+14155551234' },
    { number: '+14165551234' },
    { number: '+971501234567' },
    { number: '+442079460912' },
    { number: '+61291234567' },
    { number: '+923001234567' },
    { number: '+18765551234' },
  ];

  const startTime = Date.now();
  for (let i = 0; i < 5000; i++) {
    const lead = perfNumbers[i % perfNumbers.length];
    detectLeadLocation(lead);
  }
  const elapsed = Date.now() - startTime;
  console.log(`  5,000 lookups completed in ${elapsed}ms (${(elapsed / 5000).toFixed(4)}ms per lookup)`);
  assert(elapsed < 200, `Expected 5,000 lookups in under 200ms, took ${elapsed}ms`);

  console.log('\n--- ALL GEO DETECTION TESTS PASSED (8/8) ---');
}

runTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
