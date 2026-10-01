import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { getRegionsForCountry, getRegionNumbers } from './src/data/numberingPlans.js';

console.log('=== MULTI-STATE GENERATION & REGION TAGGING AUDIT ===\n');

// 1. Test US Multi-Region Generation (Geographic)
console.log('--- TEST 1: US Geographic Regions (California 310, New York 917, Florida 305) ---');
const usRegions = [
  { name: 'California', prefix: '310' },
  { name: 'New York', prefix: '917' },
  { name: 'Florida', prefix: '305' }
];

const totalTarget = 300;
const perRegionTarget = Math.floor(totalTarget / usRegions.length);
let usGenerated = [];
let usMetadataMap = new Map();

for (let r = 0; r < usRegions.length; r++) {
  const reg = usRegions[r];
  const count = r === usRegions.length - 1 ? (totalTarget - usGenerated.length) : perRegionTarget;
  const res = getRegionNumbers('US', reg.prefix, count);
  
  for (const num of res.numbers) {
    const clean = num.replace(/\D/g, '');
    usMetadataMap.set(clean, {
      country: 'US',
      countryCode: '1',
      regionId: `US::${reg.name.toLowerCase().replace(/\s+/g, '-')}`,
      regionName: reg.name,
      prefix: reg.prefix
    });
    usGenerated.push({ number: num, cleanNumber: clean, regionName: reg.name });
  }
}

// Check distribution
const usCounts = {};
let usInvalid = 0;
const usSeen = new Set();
let usDuplicates = 0;

for (const item of usGenerated) {
  usCounts[item.regionName] = (usCounts[item.regionName] || 0) + 1;
  if (usSeen.has(item.number)) {
    usDuplicates++;
  } else {
    usSeen.add(item.number);
  }
  const parsed = parsePhoneNumberFromString(item.number, 'US');
  if (!parsed || !parsed.isValid()) {
    usInvalid++;
  }
}

console.log(`Total Generated: ${usGenerated.length}`);
console.log(`Per-region distribution:`, usCounts);
console.log(`Duplicates: ${usDuplicates}`);
console.log(`Invalid numbers: ${usInvalid}`);

// 2. Test UAE Multi-Region Generation (Non-geographic carrier targeting)
console.log('\n--- TEST 2: UAE Regions (Abu Dhabi 501, Dubai 501, Sharjah 501) ---');
const uaeRegions = [
  { name: 'Abu Dhabi', prefix: '501' },
  { name: 'Dubai', prefix: '501' },
  { name: 'Sharjah', prefix: '501' }
];

let uaeGenerated = [];
let uaeMetadataMap = new Map();
const uaePerRegionTarget = Math.floor(totalTarget / uaeRegions.length);

for (let r = 0; r < uaeRegions.length; r++) {
  const reg = uaeRegions[r];
  const count = r === uaeRegions.length - 1 ? (totalTarget - uaeGenerated.length) : uaePerRegionTarget;
  const res = getRegionNumbers('AE', reg.prefix, count);
  
  for (const num of res.numbers) {
    const clean = num.replace(/\D/g, '');
    uaeMetadataMap.set(clean, {
      country: 'AE',
      countryCode: '971',
      regionId: `AE::${reg.name.toLowerCase().replace(/\s+/g, '-')}`,
      regionName: reg.name,
      prefix: reg.prefix
    });
    uaeGenerated.push({ number: num, cleanNumber: clean, regionName: reg.name });
  }
}

const uaeCounts = {};
let uaeInvalid = 0;
const uaeSeen = new Set();
let uaeDuplicates = 0;

for (const item of uaeGenerated) {
  uaeCounts[item.regionName] = (uaeCounts[item.regionName] || 0) + 1;
  if (uaeSeen.has(item.number)) {
    uaeDuplicates++;
  } else {
    uaeSeen.add(item.number);
  }
  const parsed = parsePhoneNumberFromString(item.number, 'AE');
  if (!parsed || !parsed.isValid()) {
    uaeInvalid++;
  }
}

console.log(`Total Generated: ${uaeGenerated.length}`);
console.log(`Per-region distribution:`, uaeCounts);
console.log(`Duplicates: ${uaeDuplicates}`);
console.log(`Invalid numbers: ${uaeInvalid}`);

console.log('\n=== AUDIT COMPLETE ===');
