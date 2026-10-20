import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { selectVerifiedReplayExperiences } from '../src/organism/learning/VerifiedReplayAdmission.ts';

const fp = (text) => VerifiedOutcomeLedger.fingerprintPrompt(text);
const ledger = new VerifiedOutcomeLedger([
  { taskId: 'train-pass', family: 'memory', split: 'train', promptFingerprint: fp('train pass'), verifierId: 'v1', version: 'v1' },
  { taskId: 'train-fail', family: 'tool-use', split: 'train', promptFingerprint: fp('train fail'), verifierId: 'v1', version: 'v1' },
  { taskId: 'holdout-only', family: 'transfer', split: 'holdout', promptFingerprint: fp('holdout'), verifierId: 'v1', version: 'v1' },
]);
const record = (taskId, method, seed, passed, evidenceRef, attempt = 1, authority = 'independent-verifier') =>
  ledger.record({
    taskId, taskVersion: 'v1', method, seed, attempt, passed, authority,
    verifierId: 'v1', evidenceRef, observedAt: 1000 + seed + attempt,
  });

assert.equal(record('train-pass', 'policy-a', 1, true, 'artifact://pass').accepted, true);
assert.equal(record('train-fail', 'policy-a', 1, false, 'artifact://fail').accepted, true);
// Self-report is rejected at the ledger boundary and cannot become replay truth.
assert.equal(record('train-pass', 'self-reported', 2, true, 'artifact://self', 1, 'self-report').accepted, false);
assert.equal(record('holdout-only', 'policy-a', 1, true, 'artifact://holdout').accepted, true);

const experiences = [
  { id: 'good-pass', taskId: 'train-pass', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: 'artifact://pass', tick: 1, contextKey: 'memory', action: 'recall', surprise: 0.4 },
  { id: 'good-failure', taskId: 'train-fail', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: 'artifact://fail', tick: 2, contextKey: 'tools', action: 'repair', surprise: 0.9 },
  { id: 'wrong-evidence', taskId: 'train-pass', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: 'artifact://forged', tick: 3, contextKey: 'memory', action: 'recall', surprise: 1 },
  { id: 'unknown-task', taskId: 'not-in-manifest', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: 'artifact://unknown', tick: 4, contextKey: 'other', action: 'do', surprise: 1 },
  { id: 'wrong-version', taskId: 'train-pass', taskVersion: 'v0', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: 'artifact://pass', tick: 5, contextKey: 'memory', action: 'recall', surprise: 1 },
  { id: 'holdout', taskId: 'holdout-only', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: 'artifact://holdout', tick: 6, contextKey: 'transfer', action: 'generalize', surprise: 1 },
  { id: 'no-outcome', taskId: 'train-pass', taskVersion: 'v1', method: 'policy-a', seed: 99, attempt: 1, evidenceRef: 'artifact://missing', tick: 7, contextKey: 'memory', action: 'recall', surprise: 1 },
  { id: 'good-pass', taskId: 'train-fail', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: 'artifact://fail', tick: 8, contextKey: 'tools', action: 'repair', surprise: 1 },
];

const result = selectVerifiedReplayExperiences(ledger, experiences, { maxBatchSize: 8, recentQuota: 1 });
assert.equal(result.split, 'train');
assert.equal(result.eligibleOutcomeCount, 2);
assert.equal(result.admittedCount, 2, 'only exact task/version/method/seed/attempt/evidence matches are admitted');
assert.equal(result.selectedCount, 2);
assert.deepEqual(result.admitted.map(item => item.experience.id), ['good-pass', 'good-failure']);
assert.equal(result.admitted.find(item => item.experience.id === 'good-pass').outcome.passed, true);
assert.equal(result.admitted.find(item => item.experience.id === 'good-failure').outcome.passed, false,
  'independently verified failures remain useful for repair learning');
assert.equal(result.rejected.some(item => item.code === 'evidence-reference-mismatch'), true);
assert.equal(result.rejected.some(item => item.code === 'wrong-split'), true);
assert.equal(result.rejected.some(item => item.code === 'task-version-mismatch'), true);
assert.equal(result.rejected.some(item => item.code === 'outcome-not-found'), true);
assert.equal(result.rejected.some(item => item.code === 'duplicate-experience-id'), true);
assert.equal(result.selected.every(item => item.manifestFingerprint === ledger.manifestFingerprint()), true);

const explicitlyRequestedHoldout = selectVerifiedReplayExperiences(ledger, [experiences[5]], { split: 'holdout' });
assert.equal(explicitlyRequestedHoldout.admittedCount, 1, 'holdout requires explicit split selection');
console.log('P23_VERIFIED_REPLAY_ADMISSION=PASS');
console.log(JSON.stringify({ admitted: result.admittedCount, rejected: result.rejected.length, selected: result.selectedCount, manifestFingerprint: result.manifestFingerprint }));
