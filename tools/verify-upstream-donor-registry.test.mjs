import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateDonorRegistry } from './verify-upstream-donor-registry.mjs';

const registryUrl = new URL('../research/upstream-donors/registry.json', import.meta.url);
const sourceRegistry = JSON.parse(await readFile(registryUrl, 'utf8'));
const clone = (value) => structuredClone(value);

test('checked-in donor registry is structurally valid without claiming external audits', () => {
  const errors = validateDonorRegistry(sourceRegistry);
  assert.deepEqual(errors, []);
  assert.equal(sourceRegistry.donors.length, 27);
  assert.ok(sourceRegistry.donors.every((donor) =>
    donor.integration.mode !== 'runtime-dependency' && donor.decision !== 'adopt'));
});

test('duplicate donor IDs are rejected', () => {
  const registry = clone(sourceRegistry);
  registry.donors[1].id = registry.donors[0].id;
  assert.ok(validateDonorRegistry(registry).some((error) => error.includes('duplicates donor id')));
});

test('non-HTTPS donor URLs are rejected', () => {
  const registry = clone(sourceRegistry);
  registry.donors[0].primaryUrl = 'http://example.org/source';
  assert.ok(validateDonorRegistry(registry).some((error) => error.includes('must use HTTPS')));
});

test('runtime dependency cannot pass while audit evidence is pending', () => {
  const registry = clone(sourceRegistry);
  const donor = registry.donors[0];
  donor.integration.mode = 'runtime-dependency';
  const errors = validateDonorRegistry(registry);
  assert.ok(errors.some((error) => error.includes('sourceCodeAudit is complete')));
  assert.ok(errors.some((error) => error.includes('licenseAudit is complete')));
  assert.ok(errors.some((error) => error.includes('tests is complete')));
  assert.ok(errors.some((error) => error.includes('benchmark is complete')));
});

test('fully evidenced runtime dependency must carry source, license, test, and benchmark reports', () => {
  const registry = clone(sourceRegistry);
  const donor = registry.donors[0];
  donor.decision = 'adopt';
  donor.integration.mode = 'runtime-dependency';
  donor.sourceCodeAudit = { status: 'complete', reportPath: 'docs/review/source.md' };
  donor.licenseAudit = { status: 'complete', reportPath: 'docs/review/license.md', spdxLicense: 'MIT' };
  donor.tests = { status: 'complete', reportPath: 'docs/review/tests.md', command: 'npm test' };
  donor.benchmark = { status: 'complete', reportPath: 'docs/review/benchmark.md' };
  assert.deepEqual(validateDonorRegistry(registry), []);
});

test('complete evidence without a report is rejected even before adoption', () => {
  const registry = clone(sourceRegistry);
  registry.donors[0].sourceCodeAudit = { status: 'complete' };
  assert.ok(validateDonorRegistry(registry).some((error) =>
    error.includes('sourceCodeAudit is complete but has no reportPath')));
});
