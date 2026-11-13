import assert from 'node:assert/strict';
import {
  buildP23ValidationCandidateMetrics,
  computeP23ValidationParetoFront,
  dominatesP23ValidationCandidate,
  isValidP23ValidationCandidateMetrics,
} from '../src/organism/learning/P23ValidationCandidateParetoArchive.ts';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';

function report(taskId, trialId, value) {
  const safety = value.safetyViolations > 0 ? 0 : 1;
  const skill = value.skill;
  const trajectory = value.trajectory;
  return {
    taskId, trialId, taskFamily: 'family-' + taskId,
    taskSuccess: { passed: value.success, passRate: value.success ? 1 : 0 },
    skillQuality: {
      functionalCoverage: skill, executability: skill, safety,
      aggregate: Number(((skill + skill + safety) / 3).toFixed(6)),
      safetyViolationCount: value.safetyViolations ?? 0,
      missingCapabilityIds: [],
    },
    trajectoryQuality: {
      keyPointRecall: trajectory, executionOrder: trajectory, completeness: trajectory,
      aggregate: trajectory, missingStepIds: [], unexpectedStepIds: [],
    },
  };
}

const validationA = [
  report('task-01', 'trial-01-a', { success: true, trajectory: 0.6, skill: 0.8 }),
  report('task-02', 'trial-02-a', { success: false, trajectory: 0.9, skill: 0.8 }),
];
const validationB = [
  report('task-01', 'trial-01-b', { success: false, trajectory: 0.9, skill: 0.8 }),
  report('task-02', 'trial-02-b', { success: true, trajectory: 0.6, skill: 0.8 }),
];
const validationC = [
  report('task-01', 'trial-01-c', { success: false, trajectory: 0.4, skill: 0.4 }),
  report('task-02', 'trial-02-c', { success: false, trajectory: 0.4, skill: 0.4 }),
];

const a = buildP23ValidationCandidateMetrics(validationA);
const b = buildP23ValidationCandidateMetrics(validationB);
const c = buildP23ValidationCandidateMetrics(validationC);

assert.equal(isValidP23ValidationCandidateMetrics(a), true);
assert.equal(a.taskCount, 2);
assert.equal(a.trialCount, 2);
assert.deepEqual(a.tasks.map(task => task.taskId), ['task-01', 'task-02']);
assert.equal(JSON.stringify(a).includes('holdout'), false,
  'the persisted validation vector contains no holdout score, case, split or feedback fields');

assert.equal(dominatesP23ValidationCandidate(a, c), true);
assert.equal(dominatesP23ValidationCandidate(b, c), true);
assert.equal(dominatesP23ValidationCandidate(a, b), false,
  'candidate A trades trajectory quality for task success on task 01 and task 02');
assert.equal(dominatesP23ValidationCandidate(b, a), false,
  'candidate B retains a complementary per-task strength');

const front = computeP23ValidationParetoFront([
  { candidateId: 'a'.repeat(64), validationMetrics: a, label: 'A' },
  { candidateId: 'b'.repeat(64), validationMetrics: b, label: 'B' },
  { candidateId: 'c'.repeat(64), validationMetrics: c, label: 'C' },
]);
assert.deepEqual(front.map(entry => entry.label), ['A', 'B'],
  'per-task Pareto archive preserves complementary candidates and removes a fully dominated candidate');

assert.throws(() => computeP23ValidationParetoFront([
  { candidateId: 'a'.repeat(64), validationMetrics: a },
  { candidateId: 'd'.repeat(64), validationMetrics: buildP23ValidationCandidateMetrics([
    report('different-task', 'trial-d', { success: true, trajectory: 1, skill: 1 }),
  ]) },
]), /task-cohort-mismatch/,
'candidates from different task sets are not compared as if they had matched evidence');

assert.throws(() => buildP23ValidationCandidateMetrics([
  validationA[0], validationA[0],
]), /duplicate-trial/);
assert.throws(() => buildP23ValidationCandidateMetrics([
  report('task-01', 'trial-family-a', { success: true, trajectory: 1, skill: 1 }),
  { ...report('task-01', 'trial-family-b', { success: true, trajectory: 1, skill: 1 }), taskFamily: 'other-family' },
]), /task-family-conflict/);
assert.throws(() => buildP23ValidationCandidateMetrics([
  { ...validationA[0], skillQuality: { ...validationA[0].skillQuality, safety: 0.4 } },
]), /report-invalid/);

const sourceCandidateId = '1'.repeat(64);
const fakeStore = {
  snapshot: () => ({
    candidates: [{
      candidateId: sourceCandidateId, skillId: 'p23-gate-test', status: 'staged',
      payload: { name: 'source-skill', steps: ['open'] },
    }],
  }),
  staged: [],
  stageCandidate(proposal, skillId, payload, provenance) {
    this.staged.push({ proposal, skillId, payload, provenance });
    return { candidateId: '2'.repeat(64), skillId, payload, status: 'staged' };
  },
};
const engine = new P23LearningEngine();
engine.configureVerifiedSkillLifecycle(fakeStore);
engine.evaluateReflectiveSkillCandidate = () => ({ eligible: false, reasons: ['holdout-regression-exceeds-tolerance'] });
engine.planReflectiveSkillRevision = () => ({
  candidateEligible: false, blockedBySafety: false, overallFitness01: 0.7,
  targets: [{ dimension: 'trajectory', priority01: 0.8, affectedTaskIds: ['task-01'], evidenceCount: 1, evidenceIds: ['trial-01'], directive: 'Repair validation trajectory.' }],
  preserve: [], rationale: ['Validation trajectory needs repair.'], optimizerInstruction: 'Use validation only.',
});
const proposal = { datasetFingerprint: '3'.repeat(64) };
const baseline = { validation: validationA, holdout: [] };
const candidateEvaluation = {
  validation: validationA,
  holdout: [report('SECRET_HOLDOUT', 'SECRET_HOLDOUT_TRIAL', { success: false, trajectory: 0.1, skill: 0.1 })],
};
const revisedPayload = { name: 'revised-skill', steps: ['open', 'verify'] };
assert.throws(() => engine.stageReflectiveSkillRevision(
  proposal, 'p23-gate-test', sourceCandidateId, revisedPayload, baseline,
  candidateEvaluation, '4'.repeat(64),
), /independent validation\/holdout gate/,
'freshly generated candidates that fail the independent paired gate must not be staged');
assert.equal(fakeStore.staged.length, 0,
  'a previously accepted source proposal cannot authorize staging a newly rejected payload');

engine.evaluateReflectiveSkillCandidate = () => ({ eligible: true, reasons: [] });
const staged = engine.stageReflectiveSkillRevision(
  proposal, 'p23-gate-test', sourceCandidateId, revisedPayload, baseline,
  candidateEvaluation, '5'.repeat(64),
);
assert.equal(fakeStore.staged.length, 1);
assert.equal(staged.candidate.candidateId, '2'.repeat(64));
const savedMetrics = fakeStore.staged[0].provenance.validationMetrics;
assert.equal(isValidP23ValidationCandidateMetrics(savedMetrics), true);
assert.equal(JSON.stringify(savedMetrics).includes('SECRET_HOLDOUT'), false,
  'only validation reports are persisted in versioned candidate provenance');

console.log('P23_VALIDATION_CANDIDATE_PARETO_ARCHIVE=PASS');
