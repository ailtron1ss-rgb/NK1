import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';

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
), /reflective fitness gate rejected candidate/);
assert.equal(approvalCalls, 0, 'failed reflective fitness must not reach promotion approval');

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
// WorkPass528: promotion derives corroboration from the canonical ledger,
// so callers cannot forge an assessment object with a claimed source count.
const realityLedger = new RealityEvidenceLedger();
realityLedger.record({
  tick: 1, at: 1, realityClass: 'device-observation',
  claim: 'skill-a:consequential-postcondition', confidence01: 0.90,
  independenceKey: 'camera:front', parentIds: [],
  eventId: `outcome:${'d'.repeat(40)}`,
});
realityLedger.record({
  tick: 2, at: 2, realityClass: 'device-observation',
  claim: 'skill-a:consequential-postcondition', confidence01: 0.20,
  independenceKey: 'camera:side', parentIds: [],
  eventId: `outcome:${'e'.repeat(40)}`,
});
assert.throws(() => engine.approveRealityCorroboratedSkillCandidate(
  realityLedger,
  'skill-a:consequential-postcondition',
  candidate.candidateId,
  { approvedBy: 'reviewer', approvedAt: 100, expectedActiveVersion: null },
  { validation, holdout },
  candidateEnvelope,
  () => true,
), /reality corroboration gate rejected consequential promotion/);
assert.throws(() => engine.approveRealityCorroboratedSkillCandidate(
  {},
  'skill-a:consequential-postcondition',
  candidate.candidateId,
  { approvedBy: 'reviewer', approvedAt: 100, expectedActiveVersion: null },
  { validation, holdout },
  candidateEnvelope,
  () => true,
), /reality corroboration gate requires a canonical ledger/);
assert.equal(approvalCalls, 0, 'ledger corroboration failure must block before store approval');
console.log('P23_HERMES_PRODUCTION_PROMOTION_GATE=PASS fitnessFailureBlocksApproval=true matchedEnvelopeRequired=true malformedEnvelopeDenied=true canonicalRealityLedgerRequired=true');
