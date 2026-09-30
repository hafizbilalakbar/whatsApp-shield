import { formatMaskedPhone } from './phoneFormatter.js';

const testCases = [
  {
    country: 'United States',
    input: '+13055581249',
    hint: 'US',
    expected: '+1 (305) 558-••49'
  },
  {
    country: 'United States (no + prefix)',
    input: '13055581249',
    hint: 'US',
    expected: '+1 (305) 558-••49'
  },
  {
    country: 'Canada',
    input: '+14165550199',
    hint: 'CA',
    expected: '+1 (416) 555-••99'
  },
  {
    country: 'United Kingdom',
    input: '+447911123456',
    hint: 'GB',
    expected: '+44 7911 ••••56'
  },
  {
    country: 'Australia',
    input: '+61412345678',
    hint: 'AU',
    expected: '+61 412 ••• •78'
  },
  {
    country: 'Pakistan',
    input: '+923001234567',
    hint: 'PK',
    expected: '+92 300 ••••567'
  },
  {
    country: 'Pakistan (clean number without +)',
    input: '923001234567',
    hint: 'PK',
    expected: '+92 300 ••••567'
  }
];

let failed = 0;
console.log('=== Running Phone Formatter Unit Tests ===');
testCases.forEach(({ country, input, hint, expected }) => {
  const result = formatMaskedPhone(input, hint);
  const pass = result === expected;
  if (pass) {
    console.log(`[PASS] ${country} (${input}) => ${result}`);
  } else {
    failed++;
    console.error(`[FAIL] ${country} (${input}):\n  Expected: ${expected}\n  Received: ${result}`);
  }
});

if (failed > 0) {
  console.error(`\nTests failed: ${failed}`);
  process.exit(1);
} else {
  console.log(`\nAll ${testCases.length} phone formatting unit tests passed successfully!`);
}
