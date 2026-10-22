import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const make = (overrides = {}) => ({
  taskId: 'task-a',
  family: 'memory',
  split: 'holdout',
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('retrieve the relevant memory'),
  verifierId: 'verifier-v1',
  version: '1',
  ...overrides,
});
const a = make();
const b = make({ taskId: 'task-b', family: 'reasoning', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('solve the related task') });
const digest = new VerifiedOutcomeLedger([a, b]).manifestFingerprint();
assert.match(digest, /^[a-f0-9]{64}$/);
assert.equal(new VerifiedOutcomeLedger([b, a]).manifestFingerprint(), digest, 'manifest digest must not depend on insertion order');
assert.notEqual(new VerifiedOutcomeLedger([make({ version: '2' }), b]).manifestFingerprint(), digest, 'task version changes must change manifest digest');
assert.notEqual(new VerifiedOutcomeLedger([make({ verifierId: 'verifier-v2' }), b]).manifestFingerprint(), digest, 'verifier identity changes must change manifest digest');
assert.notEqual(new VerifiedOutcomeLedger([make({ split: 'train' }), b]).manifestFingerprint(), digest, 'split assignment changes must change manifest digest');
assert.notEqual(new VerifiedOutcomeLedger([make({ promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('different prompt') }), b]).manifestFingerprint(), digest, 'prompt changes must change manifest digest');
console.log('P23_TASK_MANIFEST_FINGERPRINT=PASS');
