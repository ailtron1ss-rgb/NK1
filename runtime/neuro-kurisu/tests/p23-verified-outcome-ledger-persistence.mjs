import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { restoreVerifiedOutcomeLedger, serializeVerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedgerStore.ts';

const manifest = [
  { taskId: 'task-1', family: 'memory', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('remember red'), verifierId: 'verifier-v1', version: 'v1' },
  { taskId: 'task-2', family: 'transfer', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('apply red'), verifierId: 'verifier-v1', version: 'v1' },
];
const ledger = new VerifiedOutcomeLedger(manifest);
const row = (overrides = {}) => ({
  taskId: 'task-1', taskVersion: 'v1', method: 'baseline', seed: 7, attempt: 1,
  passed: true, authority: 'independent-verifier', verifierId: 'verifier-v1',
  evidenceRef: 'evidence://run/7', observedAt: 1_800_000_000_000, ...overrides,
});
assert.equal(ledger.record(row()).accepted, true);
assert.equal(ledger.record(row({ evidenceRef: 'evidence://run/7-retry' })).rejection.code, 'duplicate-attempt');
assert.equal(ledger.record(row({ method: 'candidate', seed: 9, evidenceRef: 'evidence://run/7' })).rejection.code, 'duplicate-evidence-ref');
assert.equal(ledger.record(row({ method: 'self-check', authority: 'self-report' })).rejection.code, 'self-report-not-authoritative');
ledger.record(row({ taskId: 'task-2', method: 'candidate', seed: 8, passed: false, evidenceRef: 'evidence://run/8' }));
assert.equal(ledger.record(row({ method: 'malformed', evidenceRef: undefined })).rejection.code, 'invalid-outcome');
assert.equal(ledger.record(row({ method: 'malformed-pass', passed: 'yes' })).rejection.code, 'invalid-outcome');

const encoded = serializeVerifiedOutcomeLedger(ledger);
const restored = restoreVerifiedOutcomeLedger(encoded);
assert.deepEqual(restored.snapshot(), ledger.snapshot(), 'roundtrip must preserve manifest, accepted outcomes and rejection history');
assert.deepEqual(restored.comparePaired('baseline', 'candidate'), ledger.comparePaired('baseline', 'candidate'));

assert.throws(() => restoreVerifiedOutcomeLedger('{broken'), /valid JSON/);
assert.throws(() => restoreVerifiedOutcomeLedger(JSON.stringify({ format: 'wrong', formatVersion: 1, payload: {}, sha256: '0'.repeat(64) })), /unsupported/);
const tampered = JSON.parse(encoded);
tampered.payload.outcomes[0].passed = !tampered.payload.outcomes[0].passed;
assert.throws(() => restoreVerifiedOutcomeLedger(JSON.stringify(tampered)), /checksum mismatch/);
const corruptedButRehashed = JSON.parse(encoded);
corruptedButRehashed.payload.outcomes[0].method = '   ';
import { createHash } from 'node:crypto';
const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
corruptedButRehashed.sha256 = createHash('sha256').update(canonical(corruptedButRehashed.payload)).digest('hex');
assert.throws(() => restoreVerifiedOutcomeLedger(JSON.stringify(corruptedButRehashed)), /invalid accepted outcome/);
const badManifest = JSON.parse(encoded);
badManifest.payload.manifest[1].promptFingerprint = badManifest.payload.manifest[0].promptFingerprint;
 badManifest.payload.manifest[1].split = 'train';
badManifest.sha256 = createHash('sha256').update(canonical(badManifest.payload)).digest('hex');
assert.throws(() => restoreVerifiedOutcomeLedger(JSON.stringify(badManifest)), /cross-split prompt leakage|invalid accepted outcome/);

console.log('P23_VERIFIED_OUTCOME_LEDGER_PERSISTENCE=PASS');
console.log(JSON.stringify({ bytes: Buffer.byteLength(encoded), accepted: restored.snapshot().acceptedOutcomes, rejected: restored.snapshot().rejectedOutcomes }));
