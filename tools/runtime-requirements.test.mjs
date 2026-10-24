import test from 'node:test';
import assert from 'node:assert/strict';
import { meetsMinimumVersion } from './runtime-requirements.mjs';

test('accepts the declared Node minimum and the repository-pinned Node 24', () => {
  assert.equal(meetsMinimumVersion('v22.12.0', '22.12.0'), true);
  assert.equal(meetsMinimumVersion('v22.12.1', '22.12.0'), true);
  assert.equal(meetsMinimumVersion('v24.0.0', '22.12.0'), true);
  assert.equal(meetsMinimumVersion('v24.21.0', '22.12.0'), true);
});

test('rejects versions below the engine floor and the floor prerelease', () => {
  assert.equal(meetsMinimumVersion('v20.19.0', '22.12.0'), false);
  assert.equal(meetsMinimumVersion('v22.11.99', '22.12.0'), false);
  assert.equal(meetsMinimumVersion('v22.12.0-rc.1', '22.12.0'), false);
});

test('compares version components numerically, not lexicographically', () => {
  assert.equal(meetsMinimumVersion('v22.9.0', '22.12.0'), false);
  assert.equal(meetsMinimumVersion('v22.13.0', '22.12.0'), true);
  assert.equal(meetsMinimumVersion('10.10.0', '10.8.0'), true);
  assert.equal(meetsMinimumVersion('10.7.99', '10.8.0'), false);
});

test('fails closed for missing or malformed versions', () => {
  assert.equal(meetsMinimumVersion('', '22.12.0'), false);
  assert.equal(meetsMinimumVersion('v24', '22.12.0'), false);
  assert.equal(meetsMinimumVersion('not-a-version', '22.12.0'), false);
  assert.equal(meetsMinimumVersion('v24.0.0', 'invalid'), false);
});
