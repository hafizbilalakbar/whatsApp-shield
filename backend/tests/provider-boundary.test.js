'use strict';

// The provider boundary is the guarantee that Shield can never send and the CRM
// can never fall back to the linked device.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PROVIDERS,
  OPT_IN,
  assertCanSend,
  isShieldLookupResult,
  normalizeOptIn,
  isOptedOut,
  hasUnknownOptIn,
  serviceWindow,
  detectOptOut,
  resolveSendPolicy,
} = require('../services/provider-boundary');

test('Shield can never send a message', () => {
  assert.throws(
    () => assertCanSend('shield.send', { provider: PROVIDERS.SHIELD, transport: PROVIDERS.SHIELD }),
    /lookup-only tool and cannot send/i
  );
});

test('CRM cannot use a non-Meta transport', () => {
  assert.throws(
    () => assertCanSend('crm.send', { provider: PROVIDERS.META, transport: PROVIDERS.SHIELD }),
    /only send through the official Meta Cloud API/i
  );
  assert.throws(
    () => assertCanSend('crm.send', { provider: PROVIDERS.META, transport: 'baileys' }),
    /only send through the official Meta Cloud API/i
  );
});

test('CRM Meta send is permitted', () => {
  assert.equal(
    assertCanSend('crm.send', { provider: PROVIDERS.META, transport: PROVIDERS.META }),
    PROVIDERS.META
  );
});

test('Shield lookup results are filtered to real registered numbers', () => {
  assert.equal(isShieldLookupResult({ exists: true }), true);
  assert.equal(isShieldLookupResult({ exists: true, isValidFormat: false }), false);
  assert.equal(isShieldLookupResult({ exists: false }), false);
  assert.equal(isShieldLookupResult({ exists: true, error: 'invalid jid' }), false);
});

test('opt-in tri-state normalization', () => {
  assert.equal(normalizeOptIn(undefined), OPT_IN.UNKNOWN);
  assert.equal(normalizeOptIn(''), OPT_IN.UNKNOWN);
  assert.equal(normalizeOptIn('opted-in'), OPT_IN.OPTED_IN);
  assert.equal(normalizeOptIn('opted_out'), OPT_IN.OPTED_OUT);
  assert.equal(isOptedOut({ optIn: 'opted_out' }), true);
  assert.equal(hasUnknownOptIn({}), true);
  assert.equal(hasUnknownOptIn({ optIn: 'opted_in' }), false);
});

test('24-hour customer service window', () => {
  const now = Date.parse('2026-01-02T12:00:00Z');
  const fresh = serviceWindow({ lastInboundAt: '2026-01-02T00:00:00Z' }, now);
  assert.equal(fresh.open, true);

  const expired = serviceWindow({ lastInboundAt: '2025-12-30T00:00:00Z' }, now);
  assert.equal(expired.open, false);
  assert.equal(expired.remainingMs, 0);

  assert.equal(serviceWindow({}, now).open, false, 'no inbound history means no window');
});

test('outbound first touch requires an approved template', () => {
  const contact = { lastInboundAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() };

  const freeform = resolveSendPolicy(contact, {});
  assert.equal(freeform.allowed, true);
  assert.equal(freeform.mode, 'freeform');

  const outside = resolveSendPolicy({ lastInboundAt: '2020-01-01T00:00:00Z' }, {});
  assert.equal(outside.allowed, false);
  assert.equal(outside.mode, 'template');
  assert.match(outside.reason, /24-hour/);
});

test('unapproved templates are blocked', () => {
  const result = resolveSendPolicy({}, { templateName: 'promo', templateApproved: false });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /not approved/);
});

test('opted-out contacts are never messaged', () => {
  const result = resolveSendPolicy({ optIn: 'opted_out' }, { templateName: 'promo' });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /opted out/i);
});

test('unknown opt-in surfaces a warning on allowed sends', () => {
  const result = resolveSendPolicy({}, { templateName: 'promo' });
  assert.equal(result.allowed, true);
  assert.equal(result.requiresOptInWarning, true);
});

test('STOP / unsubscribe detection', () => {
  for (const text of ['STOP', 'stop', 'Stop!', 'unsubscribe', 'STOPALL']) {
    assert.equal(detectOptOut(text).optedOut, true, `"${text}" should opt out`);
  }
  for (const text of ['hello', 'send me the report', 'stopwatch']) {
    assert.equal(detectOptOut(text).optedOut, false, `"${text}" should not opt out`);
  }
});
