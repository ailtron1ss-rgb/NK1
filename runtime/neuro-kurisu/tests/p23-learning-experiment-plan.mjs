import assert from 'node:assert/strict';
import { createLearningExperimentPlan, recordPlannedLearningOutcome, validateLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const manifest = [
  { taskId: 'm-1', family: 'memory', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('remember a stable fact'), verifierId: 'v1', version: '1' },
  { taskId: 't-1', family: 'transfer', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('apply a rule to a new context'), verifierId: 'v2', version: '2' },
  { taskId: 'train-1', family: 'memory', split: 'train', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('training-only prompt'), verifierId: 'v1', version: '1' },
  { taskId: 'val-1', family: 'transfer', split: 'validation', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('validation-only prompt'), verifierId: 'v2', version: '1' },
];
const options = { split: 'holdout', seeds: [17, 3, 9], resetEvery: [1, 4], priorMethod: 'prior-v1', continuousMethod: 'continuous-v1', resetMethodPrefix: 'reset-' };
const plan = createLearningExperimentPlan(manifest, options);
assert.equal(plan.counts.tasks, 2);
assert.equal(plan.counts.seeds, 3);
assert.equal(plan.counts.arms, 4);
assert.equal(plan.counts.runs, 24);
assert.deepEqual(plan.seedIds, [3, 9, 17]);
assert.ok(plan.runs.every(run => run.split === 'holdout'));
assert.equal(new Set(plan.runs.map(run => run.runId)).size, plan.runs.length);
assert.deepEqual(validateLearningExperimentPlan(plan, manifest), { valid: true, runCount: 24 });
assert.deepEqual(createLearningExperimentPlan(manifest, options), plan, 'plan must be reproducible byte-for-byte');
assert.notDeepEqual(createLearningExperimentPlan(manifest, { ...options, seeds: [17, 3, 10] }), plan, 'changing seeds must change plan identity');
assert.throws(() => validateLearningExperimentPlan({ ...plan, runs: plan.runs.slice(1) }, manifest), /run count mismatch|incomplete matched coverage/);
assert.throws(() => validateLearningExperimentPlan({ ...plan, runs: plan.runs.map((run, i) => i === 0 ? { ...run, method: 'tampered' } : run) }, manifest), /does not match plan identity|fingerprint mismatch/);
assert.throws(() => createLearningExperimentPlan(manifest, { ...options, seeds: [1, 1] }), /distinct non-negative/);
assert.throws(() => createLearningExperimentPlan(manifest, { ...options, resetEvery: [1, 1] }), /distinct positive/);
assert.throws(() => createLearningExperimentPlan(manifest, { ...options, priorMethod: 'same', continuousMethod: 'same' }), /unique/);
const leaked = [...manifest, { ...manifest[0], taskId: 'leaked', split: 'train' }];
assert.throws(() => createLearningExperimentPlan(leaked, options), /cross-split prompt leakage/);
assert.throws(() => validateLearningExperimentPlan({ ...plan, counts: { ...plan.counts, tasks: 999 } }, manifest), /summary counts/);
assert.throws(() => validateLearningExperimentPlan({ ...plan, seedIds: [17, 3, 9] }, manifest), /sorted/);
assert.throws(() => validateLearningExperimentPlan({ ...plan, arms: [...plan.arms, plan.arms[0]] }, manifest), /prior, continuous and reset arms|unique labels/);
console.log('P23_LEARNING_EXPERIMENT_PLAN=PASS');

const ledger = new VerifiedOutcomeLedger(manifest);
const scheduled = plan.runs.find(run => run.taskId === 'm-1' && run.seed === 3 && run.arm === 'P');
const recorded = recordPlannedLearningOutcome(ledger, plan, scheduled.runId, {
  attempt: 1, passed: true, authority: 'independent-verifier',
  evidenceRef: 'artifact://experiment/receipt-001', observedAt: 1_800_000_000_000,
});
assert.equal(recorded.accepted, true);
assert.equal(ledger.snapshot().outcomes[0].method, 'prior-v1');
assert.equal(ledger.snapshot().outcomes[0].seed, 3);
assert.throws(() => recordPlannedLearningOutcome(ledger, plan, scheduled.runId, {
  attempt: 1, passed: true, authority: 'independent-verifier',
  evidenceRef: 'artifact://experiment/receipt-duplicate', observedAt: 1_800_000_000_001,
}), /already has an outcome/);
const otherLedger = new VerifiedOutcomeLedger(manifest.map(task => task.taskId === 'm-1' ? { ...task, version: '2' } : task));
assert.throws(() => recordPlannedLearningOutcome(otherLedger, plan, scheduled.runId, {
  attempt: 1, passed: true, authority: 'independent-verifier',
  evidenceRef: 'artifact://experiment/wrong-manifest', observedAt: 1_800_000_000_000,
}), /manifest fingerprint mismatch|different ledger manifest/);
assert.throws(() => recordPlannedLearningOutcome(new VerifiedOutcomeLedger(manifest), plan, scheduled.runId, {
  taskId: 't-1', attempt: 1, passed: true, authority: 'independent-verifier',
  evidenceRef: 'artifact://experiment/wrong-task', observedAt: 1_800_000_000_000,
}), /metadata does not match scheduled run/);


// WorkPass350: manifest/outcome accessors must be rejected without running getters.
let manifestGetterCalls = 0;
const hostileManifestEntry = { ...manifest[0] };
Object.defineProperty(hostileManifestEntry, 'taskId', {
  enumerable: true,
  get() { manifestGetterCalls++; return 'm-1'; },
});
assert.throws(() => new VerifiedOutcomeLedger([hostileManifestEntry, ...manifest.slice(1)]),
  /task manifest data boundary/);
assert.equal(manifestGetterCalls, 0, 'manifest snapshots must never execute caller-owned getters');

let outcomeGetterCalls = 0;
const hostileOutcome = {
  taskId: 'm-1', taskVersion: '1', method: 'prior-v1', seed: 3, attempt: 1,
  authority: 'independent-verifier', verifierId: 'v1',
  evidenceRef: 'artifact://getter-backed', observedAt: 1_800_000_000_000,
};
Object.defineProperty(hostileOutcome, 'passed', {
  enumerable: true,
  get() { outcomeGetterCalls++; return true; },
});
const hostileOutcomeLedger = new VerifiedOutcomeLedger(manifest);
const hostileOutcomeResult = hostileOutcomeLedger.record(hostileOutcome);
assert.equal(hostileOutcomeResult.accepted, false);
assert.equal(hostileOutcomeResult.rejection?.code, 'invalid-outcome');
assert.equal(outcomeGetterCalls, 0, 'outcome snapshots must never execute caller-owned getters');

const uniqueReceiptLedger = new VerifiedOutcomeLedger(manifest);
const uniqueReceipt = {
  taskId: 'm-1', taskVersion: '1', method: 'prior-v1', seed: 3, attempt: 1,
  passed: true, authority: 'independent-verifier', verifierId: 'v1',
  evidenceRef: 'artifact://single-measurement', observedAt: 1_800_000_000_000,
};
assert.equal(uniqueReceiptLedger.record(uniqueReceipt).accepted, true);
const reusedReceipt = uniqueReceiptLedger.record({
  ...uniqueReceipt, method: 'candidate-v1', seed: 9,
});
assert.equal(reusedReceipt.accepted, false,
  'the same evidence receipt cannot attest a second method or seed');
assert.equal(reusedReceipt.rejection?.code, 'duplicate-evidence-ref');

assert.equal(new VerifiedOutcomeLedger(manifest).record({
  ...uniqueReceipt, evidenceRef: ' artifact://surrounded ',
}).rejection?.code, 'invalid-evidence-reference',
'evidence receipt identities must be trimmed and normalized');
