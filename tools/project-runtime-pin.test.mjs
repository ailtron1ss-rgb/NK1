import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchesNodeVersionPin,
  parseNodeVersionPin,
  versionMeetsMinimum,
} from './project-runtime-pin.mjs';

test('a major-only .nvmrc pin accepts compatible patch releases', () => {
  const pin = parseNodeVersionPin('24\n');
  assert.equal(pin.raw, '24');
  assert.equal(pin.precision, 1);
  assert.equal(matchesNodeVersionPin('v24.11.0', pin), true);
  assert.equal(matchesNodeVersionPin('24.0.0', pin), true);
  assert.equal(matchesNodeVersionPin('22.16.0', pin), false);
});

test('minor and full-version pins constrain only their declared precision', () => {
  assert.equal(matchesNodeVersionPin('22.12.9', parseNodeVersionPin('22.12')), true);
  assert.equal(matchesNodeVersionPin('22.11.9', parseNodeVersionPin('22.12')), false);
  assert.equal(matchesNodeVersionPin('24.11.1', parseNodeVersionPin('24.11.1')), true);
  assert.equal(matchesNodeVersionPin('24.11.2', parseNodeVersionPin('24.11.1')), false);
});

test('symbolic, empty, malformed, and non-numeric pins fail closed', () => {
  for (const value of ['', 'lts/*', 'node', '24.x', 'v24.1.0-nightly', '24..1', '-24', '9007199254740992.0.0']) {
    assert.throws(() => parseNodeVersionPin(value), undefined, value);
  }
  assert.equal(matchesNodeVersionPin('not-a-version', parseNodeVersionPin('24')), false);
  assert.equal(matchesNodeVersionPin('24.2.0', 'lts/*'), false);
  assert.equal(matchesNodeVersionPin('24.2.0', { parts: [], precision: 0 }), false);
});

test('minimum engine ranges compare numeric components rather than strings', () => {
  assert.equal(versionMeetsMinimum('v24.11.0', '22.12.0'), true);
  assert.equal(versionMeetsMinimum('10.8.0', '10.8.0'), true);
  assert.equal(versionMeetsMinimum('10.7.99', '10.8.0'), false);
  assert.equal(versionMeetsMinimum('11.0.0', '10.8.0'), true);
  assert.equal(versionMeetsMinimum('not-a-version', '10.8.0'), false);
});
