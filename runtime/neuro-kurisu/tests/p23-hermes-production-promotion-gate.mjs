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
), /reflective fitness gate rejected candidate/);
assert.equal(approvalCalls, 0, 'failed reflective fitness must not reach promotion approval');
console.log('P23_HERMES_PRODUCTION_PROMOTION_GATE=PASS fitnessFailureBlocksApproval=true');
