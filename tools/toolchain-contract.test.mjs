import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectToolchainVersions,
  matchesVersionPin,
  meetsMinimumVersion,
} from './toolchain-contract.mjs';

test('matches the major-only .nvmrc pin used by this repository', () => {
  assert.equal(matchesVersionPin('v24.0.0', '24'), true);
  assert.equal(matchesVersionPin('v24.12.3', '24'), true);
  assert.equal(matchesVersionPin('v22.12.0', '24'), false);
});

test('honours minor and patch components when the pin supplies them', () => {
  assert.equal(matchesVersionPin('v24.2.9', '24.2'), true);
  assert.equal(matchesVersionPin('v24.3.0', '24.2'), false);
  assert.equal(matchesVersionPin('v24.2.9', '24.2.9'), true);
  assert.equal(matchesVersionPin('v24.2.10', '24.2.9'), false);
});

test('compares npm and Node versions against a minimum engine contract', () => {
  assert.equal(meetsMinimumVersion('v24.0.0', '>=24.0.0'), true);
  assert.equal(meetsMinimumVersion('v24.0.1', '>=24.0.0'), true);
  assert.equal(meetsMinimumVersion('v23.99.99', '>=24.0.0'), false);
  assert.equal(meetsMinimumVersion('11.0.0', '>=10.8.0'), true);
  assert.equal(meetsMinimumVersion('10.7.9', '>=10.8.0'), false);
  assert.equal(meetsMinimumVersion('not-a-version', '>=10.8.0'), false);
  assert.equal(meetsMinimumVersion('11.0.0', '^10.8.0'), false, 'unsupported engine syntax must fail closed');
});

test('reports pin mismatch separately from package engine requirements', () => {
  assert.deepEqual(inspectToolchainVersions({
    nodeVersion: 'v22.12.0',
    npmVersion: '11.0.0',
    nodePin: '24',
    nodeRequirement: '>=24.0.0',
    npmRequirement: '>=10.8.0',
  }), {
    nodePinMatches: false,
    nodeMeetsRequirement: false,
    npmMeetsRequirement: true,
  });
  assert.deepEqual(inspectToolchainVersions({
    nodeVersion: 'v24.1.0',
    npmVersion: '11.1.0',
    nodePin: '24',
    nodeRequirement: '>=24.0.0',
    npmRequirement: '>=10.8.0',
  }), {
    nodePinMatches: true,
    nodeMeetsRequirement: true,
    npmMeetsRequirement: true,
  });
});

console.log('NK1 toolchain contract regressions passed');
