import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { buildVerifiedSessionDataset } from '../src/organism/learning/VerifiedSessionDataset.ts';

const fp = value => VerifiedOutcomeLedger.fingerprintPrompt(value);
const ledger = new VerifiedOutcomeLedger([
  { taskId: 'train-1', family: 'tool-use', split: 'train', promptFingerprint: fp('train prompt'), verifierId: 'verifier-a', version: 'v1' },
  { taskId: 'validation-1', family: 'tool-use', split: 'validation', promptFingerprint: fp('validation prompt'), verifierId: 'verifier-a', version: 'v1' },
  { taskId: 'holdout-secret-id', family: 'tool-use', split: 'holdout', promptFingerprint: fp('holdout prompt'), verifierId: 'verifier-a', version: 'v1' },
]);
const now = Date.now();
const record = (taskId, method, passed, evidenceRef, seed = 1) => ledger.record({
  taskId, taskVersion: 'v1', method, seed, attempt: 1, passed,
  authority: 'independent-verifier', verifierId: 'verifier-a', evidenceRef, observedAt: now,
});
assert.equal(record('train-1', 'baseline', true, '/private/path?token=secret').accepted, true);
assert.equal(record('validation-1', 'candidate', false, 'https://example.invalid/evidence?api_key=secret').accepted, true);
assert.equal(record('holdout-secret-id', 'baseline', true, 'private-holdout-ref').accepted, true);
assert.equal(record('holdout-secret-id', 'candidate', false, 'private-holdout-ref-2').accepted, true);
const rejected = ledger.record({
  taskId: 'train-1', taskVersion: 'v1', method: 'self-report', seed: 2, attempt: 1, passed: true,
  authority: 'self-report', verifierId: 'model', evidenceRef: 'model-said-so', observedAt: now,
});
assert.equal(rejected.accepted, false);

const dataset = buildVerifiedSessionDataset(ledger);
assert.equal(dataset.training.length, 1);
assert.equal(dataset.validation.length, 1);
assert.equal(dataset.training[0].split, 'train');
assert.equal(dataset.validation[0].split, 'validation');
assert.ok(!JSON.stringify(dataset).includes('token=secret'));
assert.ok(!JSON.stringify(dataset).includes('api_key=secret'));
assert.ok(!JSON.stringify(dataset).includes('holdout-secret-id'));
assert.ok(!JSON.stringify(dataset).includes('private-holdout-ref'));
assert.equal(dataset.holdoutAggregates.length, 2);
assert.equal(dataset.holdoutAggregates[0].outcomeCount, 1);
assert.equal(dataset.rejectedSelfReports, 1);
console.log('P23_VERIFIED_SESSION_DATASET=PASS');
