import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';

const report = (taskId, trialId, passed = true) => {
  const coverage = passed ? 1 : .25;
  const order = passed ? 1 : .25;
  const trajectory = Number(((order + order + order) / 3).toFixed(6));
  const skill = Number(((coverage + 1 + 1) / 3).toFixed(6));
  return {
    taskId, trialId,
    taskSuccess: { passed, passRate: passed ? 1 : 0 },
    skillQuality: {
      functionalCoverage: coverage, executability: 1, safety: 1, aggregate: skill,
      missingCapabilityIds: passed ? [] : ['verify'], safetyViolationCount: 0,
    },
    trajectoryQuality: {
      keyPointRecall: order, executionOrder: order, completeness: order,
      aggregate: trajectory, missingStepIds: passed ? [] : ['verify'], unexpectedStepIds: [],
    },
  };
};
const validation = [report('validation-task', 'validation-run')];
const holdout = [report('holdout-task-a', 'holdout-run-a'), report('holdout-task-b', 'holdout-run-b')];
const candidate = {
  candidateId: 'candidate-shadow', skillId: 'skill-a', version: 1,
  payload: { instructions: 'test' }, payloadFingerprint: 'a'.repeat(64),
  proposalId: 'proposal-a', proposalOutcomeFingerprint: 'b'.repeat(64),
  baseVersion: null, previousActive: null, status: 'shadow', shadowObservations: [], createdAt: 1,
};
let approvalCalls = 0;
const fakeStore = {
  snapshot: () => ({ schemaVersion: 1, revision: 0, active: [], candidates: [candidate] }),
  approveAndPromote: () => { approvalCalls += 1; throw new Error('must not reach approval'); },
};
const engine = new P23LearningEngine();
engine.configureVerifiedSkillLifecycle(fakeStore);

const baseline = {
  validation: [
    report('validation-a', 'validation-run-a', false),
    report('validation-b', 'validation-run-b', false),
  ],
  holdout: [
    report('holdout-a', 'holdout-run-a', false),
    report('holdout-b', 'holdout-run-b', false),
  ],
};
const improved = {
  validation: [
    report('validation-a', 'validation-run-a', true),
    report('validation-b', 'validation-run-b', true),
  ],
  holdout: [
    report('holdout-a', 'holdout-run-a', true),
    report('holdout-b', 'holdout-run-b', true),
  ],
};
// The report arithmetic and holdout delta are good enough for the advisory scorer.
// They are still not an independent, fingerprinted evaluation envelope.
assert.equal(engine.evaluateReflectiveSkillCandidate(baseline, improved).eligible, true);
let receiptVerifierCalls = 0;
assert.throws(() => engine.approveReflectiveVerifiedSkillCandidate(
  candidate.candidateId,
  { approvedBy: 'reviewer', approvedAt: 100, expectedActiveVersion: null },
  baseline,
  improved,
  () => { receiptVerifierCalls += 1; return true; },
), /report-only reflective promotion is disabled/);
assert.equal(receiptVerifierCalls, 0,
  'the legacy API must reject unbound score reports before inspecting signed receipts');
assert.equal(approvalCalls, 0,
  'even a forged-looking perfect holdout score report must not reach promotion approval');

// The independent promotion path rejects caller-invented baseline report arrays;
// it requires complete evaluator envelopes to prove task/seed/split/environment/manifest identity.
candidate.revisionProvenance = { schemaVersion: 1, evaluationFingerprint: 'c'.repeat(64) };
const candidateEnvelope = {
  payloadFingerprint: candidate.payloadFingerprint,
  evaluationFingerprint: 'c'.repeat(64),
  evaluation: { validation: [], holdout: [], provenance: { payloadFingerprint: candidate.payloadFingerprint } },
};
assert.throws(() => engine.approveIndependentlyEvaluatedSkillCandidate(
  candidate.candidateId,
  { approvedBy: 'reviewer', approvedAt: 100, expectedActiveVersion: null },
  { validation, holdout },
  candidateEnvelope,
  () => true,
), /matched-independent-evaluation-baseline-envelope-invalid/);
assert.equal(approvalCalls, 0,
  'unmatched caller-supplied baseline data must never reach promotion approval');

assert.throws(() => engine.approveIndependentlyEvaluatedSkillCandidate(
  candidate.candidateId,
  { approvedBy: 'reviewer', approvedAt: 100, expectedActiveVersion: null },
  null,
  null,
  () => true,
), /matched independent baseline and candidate envelopes are required/);
assert.equal(approvalCalls, 0, 'malformed envelopes must fail before approval');
console.log('P23_HERMES_PRODUCTION_PROMOTION_GATE=PASS reportOnlyPromotionDenied=true independentEnvelopeRequired=true forgedScoresBlocked=true');
