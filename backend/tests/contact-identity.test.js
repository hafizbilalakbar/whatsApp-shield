'use strict';

// Guards the "only real people in the CRM" rule. Every case here is a real
// regression: group/channel ids used to be digit-stripped into convincing
// numbers and saved as fake contacts.

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyIdentifier, toContactIdentity, isNonUserIdentifier } = require('../services/contact-identity');

const allowed = [
  ['+14165550199', '+14165550199'],
  ['14165550199', '+14165550199'],
  ['923096762902@s.whatsapp.net', '+923096762902'],
  ['923096762902:12@s.whatsapp.net', '+923096762902'],
  ['+923 096 762 902', '+923096762902'],
];

const blocked = [
  ['120363012345678901@g.us', 'group'],
  ['120363@g.us', 'group'],
  ['120363012345678901@newsletter', 'channel'],
  ['status@broadcast', 'broadcast'],
  ['15551234567@broadcast', 'broadcast'],
  ['198888888888888888@lid', 'lid'],
  ['+', 'invalid'],
  ['', 'invalid'],
  ['   ', 'invalid'],
  ['status', 'invalid'],
  ['calls', 'invalid'],
  ['99999999999999999999', 'invalid'],
  ['1234567890123456', 'invalid'],
  ['abcdefg@s.whatsapp.net', 'invalid'],
  ['15551234567@call', 'invalid'],
];

test('accepts real 1-to-1 WhatsApp users', () => {
  for (const [input, expected] of allowed) {
    const result = classifyIdentifier(input);
    assert.equal(result.valid, true, `${input} should be allowed`);
    assert.equal(result.kind, 'user');
    assert.equal(result.e164, expected);
  }
});

test('rejects groups, channels, broadcasts and unresolved LIDs', () => {
  for (const [input, kind] of blocked) {
    const result = classifyIdentifier(input);
    assert.equal(result.valid, false, `${input} must be rejected`);
    assert.equal(result.kind, kind, `${input} should be classified as ${kind}`);
    assert.equal(toContactIdentity(input), null, `${input} must not yield an identity`);
  }
});

test('toContactIdentity returns a canonical E.164 identity', () => {
  assert.deepEqual(toContactIdentity('923096762902@s.whatsapp.net'), {
    digits: '923096762902',
    e164: '+923096762902',
    kind: 'user',
  });
});

test('isNonUserIdentifier flags legacy junk rows for cleanup', () => {
  assert.equal(isNonUserIdentifier('+'), true);
  assert.equal(isNonUserIdentifier('120363012345678901@g.us'), true);
  assert.equal(isNonUserIdentifier('198888888888888888@lid'), true);
  assert.equal(isNonUserIdentifier('99999999999999999999'), true);
  assert.equal(isNonUserIdentifier('923096762902@s.whatsapp.net'), false);
  assert.equal(isNonUserIdentifier('+14165550199'), false);
});
