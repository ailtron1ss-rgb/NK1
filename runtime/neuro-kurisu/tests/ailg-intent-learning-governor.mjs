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

console.log(JSON.stringify({ pass: 'AILG_INTENT_AND_PROMOTION_GATE', decisions: governor.snapshot().decisions.length }));
