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

assert.equal(ledger.record(outcome()).accepted, true);
assert.equal(ledger.record(outcome({ evidenceRef:'artifact://trial-2' })).rejection.code, 'duplicate-attempt',
  'the same task/method/seed/attempt is rejected even when a distinct evidence ref is supplied');
assert.equal(ledger.record(outcome({ method:'candidate', seed:100 })).rejection.code, 'duplicate-evidence-ref',
  'one evidence ref cannot be reused for another otherwise-distinct outcome');
assert.equal(ledger.record(outcome({ method:'self-judge', authority:'self-report' })).rejection.code, 'self-report-not-authoritative');
assert.equal(ledger.record(outcome({ method:'wrong-version', taskVersion:'2' })).rejection.code, 'version-mismatch');
assert.equal(ledger.record(outcome({ method:'   ' })).rejection.code, 'invalid-method');
assert.equal(ledger.record(outcome({ method:'wrong-verifier', verifierId:'forged-v9' })).rejection.code, 'verifier-mismatch');
assert.equal(ledger.record(outcome({ method:'no-evidence', evidenceRef:'' })).rejection.code, 'missing-evidence');
assert.equal(ledger.record(outcome({ method:'bad-seed', seed:-1 })).rejection.code, 'invalid-seed');
assert.equal(ledger.record(outcome({ method:'bad-time', observedAt:NaN })).rejection.code, 'invalid-time');
assert.equal(ledger.recordBatch([outcome({ method:'bad-batch-time', seed:101, evidenceRef:'artifact://bad-batch-time', observedAt:NaN })]).rejection.code, 'invalid-time',
  'batch validation must preserve field-specific timestamp rejection instead of collapsing NaN into invalid-outcome');

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
assert.equal(snapshot.acceptedOutcomes, 41);
assert.equal(snapshot.rejectedOutcomes, 10);
snapshot.outcomes[0].passed = !snapshot.outcomes[0].passed;
assert.notEqual(snapshot.outcomes[0].passed, ledger.snapshot().outcomes[0].passed, 'snapshot must not mutate ledger state');
console.log('P23_VERIFIED_OUTCOME_LEDGER=PASS');
console.log(JSON.stringify({paired, counts:{accepted:ledger.snapshot().acceptedOutcomes,rejected:ledger.snapshot().rejectedOutcomes}}));
