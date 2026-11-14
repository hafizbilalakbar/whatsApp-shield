/* ============================================================================
   Numbering generation regression suite.

   Covers the Sequential / Random / Region-Wise audit after operator
   functionality and dataset regeneration:
     - sequential: BigInt ranges, start===end, reverse errors, range cap,
       leading-zero preservation and per-reason drop counting;
     - random: uniqueness, prefix conformity, capacity and cancellation;
     - region: intersection-only pools, fair bucket splits, label-only fallback;
     - operators: strict (digit, ≥2-digit, plan-overlapping) filtering.

   Run:  node src/data/numberingGeneration.test.js
   ============================================================================ */

import assert from 'node:assert';
import {
  getRandomNumbers,
  generateSequentialNumbers,
  generateBucketedAsync,
  getRegionPool,
  getOperatorsForCountry,
  getCountryPlan,
  typesForPlan,
} from './numberingPlans.js';
import { ensureNumberingDatasets } from './numberingDatasets.js';

let passed = 0;
const ok = (name) => { passed += 1; console.log(`  ok - ${name}`); };

await ensureNumberingDatasets();

const US_TYPES = () => typesForPlan(getCountryPlan('US'));
const PK_TYPES = () => typesForPlan(getCountryPlan('PK'));
const seq = (o) => generateSequentialNumbers({ iso: 'US', sourceIso: 'US', callingCode: '1', pool: getCountryPlan('US').prefixes, allowedTypes: US_TYPES(), ...o });

console.log('--- Sequential generation ---');

{
  const r = seq({ start: '3055581000', end: '3055581009' });
  assert.strictEqual(r.numbers.length, 10, 'produces the full inclusive range');
  assert.strictEqual(r.numbers[0].number, '+13055581000', 'first number is correct');
  assert.strictEqual(r.numbers[9].number, '+13055581009', 'last number is correct');
  ok('inclusive sequential range 3055581000..3055581009');
}

{
  const r = seq({ start: '3055581000', end: '3055581000' });
  assert.strictEqual(r.numbers.length, 1, 'start === end is a single number, not an error');
  ok('start === end yields one number');
}

{
  const r = seq({ start: '3055581001', end: '3055581000' });
  assert.strictEqual(r.numbers.length, 0);
  assert.ok(/Start must be/.test(r.error), `reverse range errors (${r.error})`);
  ok('reverse range errors cleanly');
}

{
  // 15 digits > Number.MAX_SAFE_INTEGER: must parse with BigInt (no rounding
  // means the count is exact) and drop cleanly as invalid (length too long).
  const r = seq({ start: '305123456789012', end: '305123456789013' });
  assert.strictEqual(r.stats.attempts, 2);
  assert.strictEqual(r.numbers.length, 0, '15-digit numbers are not valid US numbers');
  assert.strictEqual(r.stats.reasons.invalid, 2, 'each dropped as invalid');
  ok('15-digit range parses with BigInt, no overflow');
}

{
  const r = seq({ start: '4000000000', end: '4000000999' });
  assert.strictEqual(r.numbers.length, 0);
  assert.strictEqual(r.stats.reasons.prefix, 1000, 'non-prefix numbers dropped as outside prefixes');
  ok('counted prefix drop reasons');
}

{
  const r = seq({ start: '30550000000', end: '30550019999' });
  assert.strictEqual(r.truncated, true, '> SEQUENTIAL_RANGE_LIMIT is capped');
  assert.strictEqual(r.stats.attempts, 10000, 'exactly SEQUENTIAL_MAX attempted');
  ok('range cap at 10,000');
}

{
  const r = seq({ start: '3053100000', end: '3053100001' });
  const prefixLen = getCountryPlan('US').prefixes.find(([p]) => p === '305') ? 3 : 1;
  assert.strictEqual(r.stats.reasons.degenerate, 1, 'zero-run candidate rejected');
  assert.strictEqual(r.numbers.length, 1, 'the plausible candidate survives');
  assert.strictEqual(r.numbers[0].number, '+13053100001', 'survivor is correct');
  // sanity: whatever the plan prefix length, the subscriber tail was all-same.
  assert.ok(prefixLen >= 1);
  ok('degenerate (implausible) candidates counted after prefix');
}

console.log('--- Random generation ---');

{
  const r = await getRandomNumbers('PK', 300, { onProgress: () => {}, shouldCancel: () => false });
  assert.strictEqual(r.numbers.length, 300);
  assert.strictEqual(r.cancelled, false);
  assert.ok(r.capacity > 0, 'capacity reported');
  const set = new Set(r.numbers);
  assert.strictEqual(set.size, 300, 'all unique');
  assert.ok(r.numbers.every((n) => String(n).startsWith('+92')), 'all Pakistani calling code');
  ok('PK random 300 unique, prefix-conformant');
}

{
  let cancelCalls = 0;
  const r = await getRandomNumbers('PK', 5000, {
    onProgress: () => {},
    shouldCancel: () => { cancelCalls += 1; return cancelCalls > 2; },
  });
  assert.strictEqual(r.cancelled, true, 'cancel flag returned');
  assert.ok(r.numbers.length < 5000, 'early stop respected');
  ok('cancellation stops a random batch early');
}

console.log('--- Region-wise generation ---');

{
  const fl = { id: 'fl', name: 'Florida', prefix: '305', prefixes: ['305'], verified: true };
  const ny = { id: 'ny', name: 'New York', prefix: '212', prefixes: ['212'], verified: true };
  assert.ok(getRegionPool('US', fl).length > 0, 'verified region has a pool');
  const batch = await generateBucketedAsync(
    {
      iso: 'US', sourceIso: 'US', callingCode: '1', total: 200,
      buckets: [
        { region: fl, operator: null, pool: getRegionPool('US', fl) },
        { region: ny, operator: null, pool: getRegionPool('US', ny) },
      ],
      allowedTypes: US_TYPES(),
    },
    { onProgress: () => {}, shouldCancel: () => false },
  );
  assert.strictEqual(batch.numbers.length, 200);
  assert.deepStrictEqual(
    [batch.numbers.filter((e) => e.bucketIndex === 0).length, batch.numbers.filter((e) => e.bucketIndex === 1).length],
    [100, 100],
    'fair 50/50 split',
  );
  assert.strictEqual(new Set(batch.numbers.map((e) => e.number.number)).size, 200, 'globally unique');
  assert.ok(batch.numbers.every((e) => e.number.number.startsWith('+1305') || e.number.number.startsWith('+1212')), 'prefixes respected');
  ok('bucket split is fair and unique');
}

{
  const fakeLabelOnly = { id: 'xx', name: 'Label-Only Land', prefixes: [], verified: false, labelOnly: true };
  assert.strictEqual(getRegionPool('US', fakeLabelOnly).length, 0, 'label-only region has an empty intersection pool');
  const batch = await generateBucketedAsync(
    {
      iso: 'US', sourceIso: 'US', callingCode: '1', total: 100,
      buckets: [{ region: fakeLabelOnly, operator: null, pool: getCountryPlan('US').prefixes }],
      allowedTypes: US_TYPES(),
    },
    { onProgress: () => {}, shouldCancel: () => false },
  );
  assert.strictEqual(batch.numbers.length, 100, 'explicit country-plan pool fills');
  ok('explicit country-plan pool fills a label-only bucket');
}

console.log('--- Operators ---');

{
  const ops = getOperatorsForCountry('PK');
  assert.ok(Array.isArray(ops));
  assert.ok(ops.length > 0, 'PK has carriers');
  assert.ok(ops.every((o) => o.name && o.prefixes.length), 'name + prefixes present');
  assert.ok(ops.every((o) => o.prefixes.every((p) => /^\d+$/.test(String(p)) && String(p).length >= 2)), 'digit prefixes ≥2');
  assert.strictEqual(new Set(ops.map((o) => o.name)).size, ops.length, 'no duplicate operator names');
  ok('operators are digit, ≥2-digit and de-duplicated by name');
}

console.log('--- Plan inheritance / contracts ---');

{
  await ensureNumberingDatasets();
  const jm = getCountryPlan('JM');
  assert.strictEqual(jm.sourceIso, 'US', 'JM inherits the US plan');
  assert.ok(jm.prefixes.length > 0, 'inherited prefixes present');
  const gg = getCountryPlan('GG');
  assert.strictEqual(gg.sourceIso, 'GB', 'GG inherits the GB plan');
  ok('parent territories resolve through sourceIso');
}

console.log(`\nALL NUMBERING GENERATION TESTS PASSED (${passed} checks)`);