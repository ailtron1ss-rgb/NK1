import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const hash = prompt => VerifiedOutcomeLedger.fingerprintPrompt(prompt);
const manifest = [
  { taskId:'task-a', family:'memory', split:'train', promptFingerprint:hash('Remember the blue key.'), verifierId:'verify-v1', version:'1' },
  { taskId:'task-b', family:'memory', split:'holdout', promptFingerprint:hash('Which key was mentioned?'), verifierId:'verify-v1', version:'1' },
  { taskId:'task-c', family:'transfer', split:'holdout', promptFingerprint:hash('Use the learned rule in a new context.'), verifierId:'verify-v1', version:'1' },
];
const ledger = new VerifiedOutcomeLedger(manifest);
const outcome = (overrides={}) => ({
  taskId:'task-b', taskVersion:'1', method:'baseline', seed:99, attempt:1,
  passed:true, authority:'independent-verifier', verifierId:'verify-v1',
  evidenceRef:'artifact://trial-1', observedAt:1000, ...overrides,
});
assert.equal(VerifiedOutcomeLedger.fingerprintPrompt('  REMEMBER   the blue key. '), hash('Remember the blue key.'));
assert.throws(() => new VerifiedOutcomeLedger([
  manifest[0],
  { ...manifest[1], promptFingerprint:hash(' remember the BLUE key. ') },
]), /cross-split prompt leakage/);
assert.throws(() => new VerifiedOutcomeLedger([manifest[0], manifest[0]]), /duplicate task id/);

let manifestGetterCalls = 0;
const accessorManifestEntry = { ...manifest[0] };
Object.defineProperty(accessorManifestEntry, 'taskId', {
  enumerable: true, configurable: true,
  get() { manifestGetterCalls++; return 'task-a'; },
});
assert.throws(() => new VerifiedOutcomeLedger([accessorManifestEntry]), /invalid task manifest entry/);
assert.equal(manifestGetterCalls, 0, 'manifest validation must not invoke accessors');

let ignoredManifestGetterCalls = 0;
const manifestWithExtraGetter = { ...manifest[0] };
Object.defineProperty(manifestWithExtraGetter, 'externalMetadata', {
  enumerable: true, configurable: true,
  get() { ignoredManifestGetterCalls++; return 'unbound'; },
});
const safeManifestLedger = new VerifiedOutcomeLedger([manifestWithExtraGetter]);
assert.equal(safeManifestLedger.snapshot().manifest[0].taskId, 'task-a');
assert.equal(ignoredManifestGetterCalls, 0, 'unknown manifest properties must not be copied by reading them');
assert.throws(() => new VerifiedOutcomeLedger(new Array(1)), /dense array of data entries/,
  'sparse manifest arrays must be rejected without reading missing elements');

let subclassFindCalls = 0;
class ManifestWithOverriddenFind extends Array {
  find(...args) { subclassFindCalls++; return super.find(...args); }
}
assert.throws(() => new VerifiedOutcomeLedger(new ManifestWithOverriddenFind(...manifest)),
  /dense array of data entries/, 'array subclasses with overridden behavior must not cross the manifest boundary');
assert.equal(subclassFindCalls, 0, 'ledger construction must not invoke caller-controlled array methods');

assert.equal(ledger.record(outcome()).accepted, true);

let outcomeGetterCalls = 0;
const accessorOutcome = { ...outcome({ method: 'accessor-outcome' }) };
Object.defineProperty(accessorOutcome, 'taskId', {
  enumerable: true, configurable: true,
  get() { outcomeGetterCalls++; return 'task-b'; },
});
assert.equal(ledger.record(accessorOutcome).rejection.code, 'invalid-outcome');
assert.equal(outcomeGetterCalls, 0, 'outcome validation must not invoke accessors');

let ignoredOutcomeGetterCalls = 0;
const outcomeWithExtraGetter = { ...outcome({ method: 'extra-field-outcome', seed: 777 }) };
Object.defineProperty(outcomeWithExtraGetter, 'callerMetadata', {
  enumerable: true, configurable: true,
  get() { ignoredOutcomeGetterCalls++; return 'untrusted'; },
});
assert.equal(ledger.record(outcomeWithExtraGetter).accepted, true);
assert.equal(ignoredOutcomeGetterCalls, 0, 'extra outcome getters must not run during storage');
assert.equal(Object.hasOwn(ledger.snapshot().outcomes.find(row => row.method === 'extra-field-outcome'), 'callerMetadata'), false,
  'ledger stores only declared outcome schema fields');
assert.equal(ledger.record(outcome()).rejection.code, 'duplicate-attempt');
assert.equal(ledger.record(outcome({ method:'self-judge', authority:'self-report' })).rejection.code, 'self-report-not-authoritative');
assert.equal(ledger.record(outcome({ method:'wrong-version', taskVersion:'2' })).rejection.code, 'version-mismatch');
assert.equal(ledger.record(outcome({ method:'   ' })).rejection.code, 'invalid-method');
assert.equal(ledger.record(outcome({ method:'wrong-verifier', verifierId:'forged-v9' })).rejection.code, 'verifier-mismatch');
assert.equal(ledger.record(outcome({ method:'no-evidence', evidenceRef:'' })).rejection.code, 'missing-evidence');
assert.equal(ledger.record(outcome({ method:'bad-seed', seed:-1 })).rejection.code, 'invalid-seed');
assert.equal(ledger.record(outcome({ method:'bad-time', observedAt:NaN })).rejection.code, 'invalid-time');

for (let seed=0; seed<12; seed++) {
  ledger.record(outcome({ taskId:'task-b', method:'baseline', seed, passed:seed%2===0, evidenceRef:`artifact://b-${seed}` }));
  ledger.record(outcome({ taskId:'task-b', method:'candidate', seed, passed:seed%3!==0, evidenceRef:`artifact://c-${seed}` }));
}
for (let seed=0; seed<8; seed++) {
  ledger.record(outcome({ taskId:'task-c', method:'baseline', seed, passed:false, evidenceRef:`artifact://b2-${seed}` }));
  ledger.record(outcome({ taskId:'task-c', method:'candidate', seed, passed:true, evidenceRef:`artifact://c2-${seed}` }));
}
const paired = ledger.comparePaired('baseline','candidate');
assert.equal(paired.pairedN, 20);
assert.ok(paired.candidatePassRate > paired.baselinePassRate);
assert.ok(paired.discordantCandidateWins > 0);
assert.ok(paired.approximate95CI[0] <= paired.absoluteGain);
assert.ok(paired.approximate95CI[1] >= paired.absoluteGain);
assert.equal(ledger.comparePaired('baseline','candidate','train').pairedN, 0);
const byFamily = ledger.comparePairedByFamily('baseline', 'candidate');
assert.deepEqual(byFamily.map(row => row.family), ['memory', 'transfer']);
assert.equal(byFamily.find(row => row.family === 'memory').pairedN, 12);
assert.equal(byFamily.find(row => row.family === 'transfer').pairedN, 8);
assert.ok(byFamily.find(row => row.family === 'transfer').absoluteGain > 0);
assert.equal(ledger.comparePairedByFamily('baseline', 'candidate', 'train')[0].pairedN, 0);
const snapshot = ledger.snapshot();
assert.equal(snapshot.manifestCount, 3);
assert.equal(snapshot.rejectionCounts['self-report-not-authoritative'], 1);
assert.equal(snapshot.rejectionCounts['invalid-outcome'], 1);
assert.equal(snapshot.acceptedOutcomes, 42);
assert.equal(snapshot.rejectedOutcomes, 9);

const restored = VerifiedOutcomeLedger.restoreSnapshot(snapshot);
assert.equal(restored.snapshot().acceptedOutcomes, snapshot.acceptedOutcomes);
assert.equal(restored.snapshot().rejectedOutcomes, snapshot.rejectedOutcomes);

let snapshotGetterCalls = 0;
const snapshotWithAccessor = ledger.snapshot();
Object.defineProperty(snapshotWithAccessor, 'schemaVersion', {
  enumerable: true, configurable: true,
  get() { snapshotGetterCalls++; return 2; },
});
assert.throws(() => VerifiedOutcomeLedger.restoreSnapshot(snapshotWithAccessor), /unsupported or malformed ledger snapshot/);
assert.equal(snapshotGetterCalls, 0, 'snapshot restore must not invoke top-level accessors');

let arrayGetterCalls = 0;
const snapshotWithAccessorRow = ledger.snapshot();
Object.defineProperty(snapshotWithAccessorRow.outcomes, '0', {
  enumerable: true, configurable: true,
  get() { arrayGetterCalls++; return snapshot.outcomes[0]; },
});
assert.throws(() => VerifiedOutcomeLedger.restoreSnapshot(snapshotWithAccessorRow), /unsupported or malformed ledger snapshot arrays/);
assert.equal(arrayGetterCalls, 0, 'snapshot restore must reject array accessors without invoking them');

snapshot.outcomes[0].passed = !snapshot.outcomes[0].passed;
assert.notEqual(snapshot.outcomes[0].passed, ledger.snapshot().outcomes[0].passed, 'snapshot must not mutate ledger state');
console.log('P23_VERIFIED_OUTCOME_LEDGER=PASS');
console.log(JSON.stringify({paired, counts:{accepted:ledger.snapshot().acceptedOutcomes,rejected:ledger.snapshot().rejectedOutcomes}}));