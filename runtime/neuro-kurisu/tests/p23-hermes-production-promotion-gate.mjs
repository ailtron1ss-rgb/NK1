import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';

const report = (taskId, trialId) => ({
  taskId, trialId,
  taskSuccess: { passed: true, passRate: 1 },
  skillQuality: { functionalCoverage: 1, executability: 1, safety: 1, aggregate: 1, missingCapabilityIds: [], safetyViolationCount: 0 },
  trajectoryQuality: { keyPointRecall: 1, executionOrder: 1, completeness: 1, aggregate: 1, missingStepIds: [], unexpectedStepIds: [] },
});
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
  approveAndPromote: () => { approvalCalls += 1; throw new Error('must not reach approval on failed fitness'); },
};
const engine = new P23LearningEngine();
engine.configureVerifiedSkillLifecycle(fakeStore);
assert.throws(() => engine.approveReflectiveVerifiedSkillCandidate(
  candidate.candidateId,
  { approvedBy: 'reviewer', approvedAt: 100, expectedActiveVersion: null },
  { validation, holdout },
  { validation, holdout },
  () => true,
), /raw-report-array-reflective-promotion-disabled/);
assert.equal(approvalCalls, 0, 'legacy array-only API must never reach promotion approval');

// WorkPass336: array-only reflective promotion is intentionally disabled because it cannot prove paired-seed lineage.
// WorkPass237: the independent promotion path must not accept caller-invented
// baseline report arrays. It requires full evaluator envelopes so the canonical
// matched comparison can prove task/seed/split/environment/manifest identity.
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
assert.equal(approvalCalls, 0, 'unmatched caller-supplied baseline data must never reach promotion approval');

assert.throws(() => engine.approveIndependentlyEvaluatedSkillCandidate(
  candidate.candidateId,
  { approvedBy: 'reviewer', approvedAt: 100, expectedActiveVersion: null },
  null,
  null,
  () => true,
), /matched independent baseline and candidate envelopes are required/);
assert.equal(approvalCalls, 0, 'malformed envelopes must fail before approval');

import { createHash } from 'node:crypto';

const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const buildEnvelope = payloadFingerprint => {
  const validation = [report('validation-task', 'validation-run')];
  const holdout = [
    report('holdout-task-a', 'holdout-run-a'),
    report('holdout-task-b', 'holdout-run-b'),
  ];
  const runBindings = [
    ...validation.map(row => ({ ...row, runId: 'run-' + row.trialId, plannedRunId: null, seed: 11, split: 'validation', bindingVerified: true, verifierPassed: true, safetyViolationCount: 0 })),
    ...holdout.map(row => ({ ...row, runId: 'run-' + row.trialId, plannedRunId: null, seed: 11, split: 'holdout', bindingVerified: true, verifierPassed: true, safetyViolationCount: 0 })),
  ];
  const evaluation = {
    validation,
    holdout,
    provenance: {
      payloadFingerprint,
      environmentFingerprint: 'a'.repeat(64),
      planFingerprint: 'b'.repeat(64),
      experimentAuthority: null,
      runBindings,
    },
  };
  return { payloadFingerprint, evaluationFingerprint: digest(evaluation), evaluation };
};

// A complete-looking envelope still cannot authorize activation without a
// canonical manifest and scheduled validation/holdout plans.
const baselineWithoutAuthority = buildEnvelope('f'.repeat(64));
const candidateWithoutAuthority = buildEnvelope(candidate.payloadFingerprint);
candidate.revisionProvenance = {
  schemaVersion: 1,
  evaluationFingerprint: candidateWithoutAuthority.evaluationFingerprint,
};
assert.throws(() => engine.approveIndependentlyEvaluatedSkillCandidate(
  candidate.candidateId,
  { approvedBy: 'reviewer', approvedAt: 100, expectedActiveVersion: null },
  baselineWithoutAuthority,
  candidateWithoutAuthority,
  () => true,
), /experiment-authority-required/);
assert.equal(approvalCalls, 0, 'missing canonical experiment authority must block skill activation');

console.log('P23_HERMES_PRODUCTION_PROMOTION_GATE=PASS fitnessFailureBlocksApproval=true matchedEnvelopeRequired=true canonicalExperimentAuthorityRequired=true malformedEnvelopeDenied=true');
