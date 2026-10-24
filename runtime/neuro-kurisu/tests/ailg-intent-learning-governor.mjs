import assert from 'node:assert/strict';
import { AutonomousIntentLearningGovernor } from '../src/organism/system/AutonomousIntentLearningGovernor.ts';

const governor = new AutonomousIntentLearningGovernor();
const accepted = governor.propose({
  id: 'memory-repair-1',
  goal: 'investigate a repeated retrieval failure',
  triggerEvidence: ['retrieval-regression:case-12'],
  expectedBenefit01: .9,
  uncertainty01: .6,
  cost01: .2,
  risk01: .1,
  externalSideEffect: false,
}, 100);
assert.equal(accepted.status, 'act');

assert.throws(() => governor.propose({
  id: 'memory-repair-1', goal: 'duplicate', triggerEvidence: ['evidence'],
  expectedBenefit01: .8, uncertainty01: .1, cost01: .1, risk01: .1,
  externalSideEffect: false,
}), /duplicate-intent/);

const unsafe = governor.propose({
  id: 'external-write-1', goal: 'publish a change', triggerEvidence: ['candidate-ready'],
  expectedBenefit01: 1, uncertainty01: .1, cost01: .1, risk01: .1,
  externalSideEffect: true,
}, 101);
assert.equal(unsafe.status, 'approval-required');

const risky = governor.propose({
  id: 'high-risk-1', goal: 'run an untrusted script', triggerEvidence: ['script-submitted'],
  expectedBenefit01: 1, uncertainty01: .2, cost01: .1, risk01: .9,
  externalSideEffect: false,
}, 102);
assert.equal(risky.status, 'reject');

assert.deepEqual(governor.recordOutcome({
  intentId: 'unknown', observedBenefit01: 1, evidence: 'verified', observedAt: 103,
}), { accepted: false, reason: 'unknown-intent' });
assert.deepEqual(governor.recordOutcome({
  intentId: 'external-write-1', observedBenefit01: 1, evidence: 'verified', observedAt: 103,
}), { accepted: false, reason: 'intent-not-executed' });
assert.deepEqual(governor.authorize('external-write-1', 'approval:review-44'), { accepted: true, reason: 'authorized' });
assert.deepEqual(governor.recordExecution('external-write-1', 'execution:tool-run-44'), { accepted: true, reason: 'execution-recorded' });

assert.deepEqual(governor.recordOutcome({
  intentId: 'memory-repair-1', observedBenefit01: .8, evidence: 'verified', observedAt: 103,
}), { accepted: false, reason: 'intent-not-executed' });
assert.deepEqual(governor.recordExecution('memory-repair-1', 'execution:task-12'), { accepted: true, reason: 'execution-recorded' });
const outcome = { intentId: 'memory-repair-1', observedBenefit01: .8, evidence: 'holdout-task-pass', observedAt: 104 };
assert.deepEqual(governor.recordOutcome(outcome), { accepted: true, reason: 'outcome-recorded' });
assert.deepEqual(governor.recordOutcome(outcome), { accepted: false, reason: 'duplicate-outcome' });

assert.equal(governor.evaluatePromotion({
  baselineSuccess01: .7, candidateSuccess01: .8, maxRegression01: .05,
  observedRegression01: .02, independentHoldoutCases: 2,
}).reason, 'insufficient-independent-holdout');
assert.equal(governor.evaluatePromotion({
  baselineSuccess01: .7, candidateSuccess01: .8, maxRegression01: .05,
  observedRegression01: .08, independentHoldoutCases: 8,
}).reason, 'regression-budget-exceeded');
assert.equal(governor.evaluatePromotion({
  baselineSuccess01: .7, candidateSuccess01: .8, maxRegression01: .05,
  observedRegression01: .02, independentHoldoutCases: 8,
}).eligible, true);
assert.equal(governor.evaluatePromotion({
  baselineSuccess01: .8, candidateSuccess01: .8, maxRegression01: .05,
  observedRegression01: .02, independentHoldoutCases: 8,
}).reason, 'no-measured-improvement');
assert.throws(() => governor.propose({
  id: 'invalid-time', goal: 'invalid timestamp', triggerEvidence: ['test'],
  expectedBenefit01: .5, uncertainty01: .1, cost01: .1, risk01: .1,
  externalSideEffect: false,
}, Number.NaN), /decision time/);

const saved = governor.snapshot();
const recovered = new AutonomousIntentLearningGovernor();
recovered.restore(saved);
assert.equal(recovered.snapshot().decisions.length, saved.decisions.length);
assert.equal(recovered.snapshot().outcomes.length, 1, 'restore should preserve accepted outcome evidence');
assert.deepEqual(recovered.recordOutcome(outcome), { accepted: false, reason: 'duplicate-outcome' }, 'restore must preserve single-use outcome semantics');
assert.deepEqual(recovered.recordExecution('memory-repair-1', 'second-exec'), { accepted: false, reason: 'duplicate-execution' }, 'restore must retain execution idempotency');

const corrupted = {
  version: 1,
  decisions: [
    { intentId: 'bad', status: 'act', score01: 2, reason: 'corrupt', selectedAt: 0 },
    { intentId: 'good', status: 'act', score01: .8, reason: 'recovered', selectedAt: 10 },
  ],
  outcomes: [{ intentId: 'good', observedBenefit01: 1, evidence: 'forged-without-execution', observedAt: 10 }],
  executedIntentIds: [],
  approvedIntentIds: [],
};
const sanitized = new AutonomousIntentLearningGovernor();
sanitized.restore(corrupted);
assert.deepEqual(sanitized.snapshot().decisions.map(d => d.intentId), ['good'], 'invalid restored decisions should be dropped');
assert.equal(sanitized.snapshot().outcomes.length, 0, 'unexecuted restored outcomes must be dropped');
let snapshotGetterCalls = 0;
const accessorSnapshot = { decisions: [] };
Object.defineProperty(accessorSnapshot, 'version', { enumerable: true, get() { snapshotGetterCalls += 1; return 1; } });
const accessorRestore = new AutonomousIntentLearningGovernor();
accessorRestore.restore(accessorSnapshot);
assert.equal(snapshotGetterCalls, 0, 'restoring a snapshot must never execute top-level getters');
assert.equal(accessorRestore.snapshot().decisions.length, 0);

let inputGetterCalls = 0;
const hostileIntent = {
  goal: 'hostile intent', triggerEvidence: ['test'], expectedBenefit01: .8,
  uncertainty01: .1, cost01: .1, risk01: .1, externalSideEffect: false,
};
Object.defineProperty(hostileIntent, 'id', { enumerable: true, get() { inputGetterCalls += 1; return 'hostile-intent'; } });
assert.throws(() => accessorRestore.propose(hostileIntent), /plain-data/);
assert.equal(inputGetterCalls, 0, 'proposal parsing must not execute input getters');

const hostileOutcome = { observedBenefit01: .8, evidence: 'should-not-be-read', observedAt: 1 };
Object.defineProperty(hostileOutcome, 'intentId', { enumerable: true, get() { inputGetterCalls += 1; return 'memory-repair-1'; } });
assert.deepEqual(accessorRestore.recordOutcome(hostileOutcome), { accepted: false, reason: 'invalid-outcome' });
assert.equal(inputGetterCalls, 0, 'outcome parsing must not execute input getters');

const hostilePromotion = {
  candidateSuccess01: .8, maxRegression01: .05, observedRegression01: .01, independentHoldoutCases: 8,
};
Object.defineProperty(hostilePromotion, 'baselineSuccess01', { enumerable: true, get() { inputGetterCalls += 1; return .7; } });
assert.equal(accessorRestore.evaluatePromotion(hostilePromotion).reason, 'invalid-evaluation-evidence');
assert.equal(inputGetterCalls, 0, 'promotion parsing must not execute input getters');

console.log(JSON.stringify({ pass: 'AILG_INTENT_AND_PROMOTION_GATE', decisions: governor.snapshot().decisions.length }));
