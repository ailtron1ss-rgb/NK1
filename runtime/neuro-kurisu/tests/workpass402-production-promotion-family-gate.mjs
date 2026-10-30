import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { P23LearningEngine, P23_REFLECTIVE_PROMOTION_POLICY } from '../src/organism/learning/P23LearningEngine.ts';
import { createIndependentSkillCandidateEvaluator } from '../src/organism/learning/IndependentSkillCandidateEvaluator.ts';

const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');

const tasks = [
  { taskId: 'validation-a', trialId: 'v-a', seed: 11, split: 'validation', input: { prompt: 'open then summarize A' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
  { taskId: 'validation-b', trialId: 'v-b', seed: 12, split: 'validation', input: { prompt: 'open then summarize B' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
  { taskId: 'holdout-a', trialId: 'h-a', seed: 29, split: 'holdout', input: { prompt: 'open then summarize C' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
  { taskId: 'holdout-b', trialId: 'h-b', seed: 30, split: 'holdout', input: { prompt: 'open then summarize D' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
];
// Deliberately omit taskFamily from every task. Real production evaluators are
// expected to source it from their canonical manifest; no such manifest is
// supplied here, so strict production coverage must stop activation.
async function makeEvaluation(payload, prefix, observedStepIds) {
  const evaluator = createIndependentSkillCandidateEvaluator({
    tasks,
    environmentFingerprint: 'a'.repeat(64),
    executor: {
      async execute({ task }) {
        return { runId: prefix + task.trialId, observedStepIds };
      },
    },
    verifier: {
      async verify() {
        return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] };
      },
    },
    safetyScanner: { async scan() { return { violationCount: 0 }; } },
  });
  return evaluator({
    payload,
    payloadFingerprint: digest(payload),
    baseline: { validation: [], holdout: [] },
    previousEvaluation: { validation: [], holdout: [] },
  });
}

const sourcePayload = { skill: 'summarize', version: 1 };
const candidatePayload = { skill: 'summarize', version: 2, improved: true };
const baseline = await makeEvaluation(sourcePayload, 'baseline-', ['open']);
const candidateEvaluation = await makeEvaluation(candidatePayload, 'candidate-', ['open', 'summarize']);

// Without family coverage enforcement the independent paired reports show a
// real validation gain, sufficient task counts, clean safety and improved holdout.
const engine = new P23LearningEngine();
const journalEvents = [];
let fallbackJournalCalls = 0;
engine.configureLearningFitnessJournal({
  recordFitnessDecision(entry) { journalEvents.push(structuredClone(entry)); },
});
const lifecycleEvents = [];
engine.configureLearningLifecycleJournal({
  recordLifecycleEvent(entry) { lifecycleEvents.push(structuredClone(entry)); },
});
engine.configureLearningFitnessJournalIfAbsent({
  recordFitnessDecision() { fallbackJournalCalls++; },
});
assert.deepEqual(engine.learningFitnessJournalDiagnostics(), {
  configured: true, available: false, reason: 'readback-unavailable',
});
const brokenDiagnosticsEngine = new P23LearningEngine();
brokenDiagnosticsEngine.configureLearningFitnessJournal({
  recordFitnessDecision() {},
  snapshotDiagnostics() { throw new Error('malformed journal'); },
});
assert.deepEqual(brokenDiagnosticsEngine.learningFitnessJournalDiagnostics(), {
  configured: true, available: false, reason: 'journal-read-failed',
});
const advisoryFitness = engine.evaluateReflectiveSkillCandidate(
  { validation: baseline.evaluation.validation, holdout: baseline.evaluation.holdout },
  { validation: candidateEvaluation.evaluation.validation, holdout: candidateEvaluation.evaluation.holdout },
);
assert.equal(advisoryFitness.eligible, true, JSON.stringify(advisoryFitness));
assert.equal(advisoryFitness.validationFamiliesEvaluated, 0);
assert.equal(advisoryFitness.holdoutFamiliesEvaluated, 0);

const staged = {
  candidateId: 'candidate-without-family-evidence',
  skillId: 'summarization-skill',
  version: 2,
  payload: candidatePayload,
  payloadFingerprint: candidateEvaluation.payloadFingerprint,
  status: 'shadow',
  shadowObservations: [],
  revisionProvenance: { schemaVersion: 1, evaluationFingerprint: candidateEvaluation.evaluationFingerprint },
};
let approvalCalls = 0;
let stagedWithInsufficientSeeds = null;
const fakeStore = {
  snapshot() {
    return {
      schemaVersion: 1, revision: 0, active: [],
      candidates: stagedWithInsufficientSeeds ? [staged, stagedWithInsufficientSeeds] : [staged],
    };
  },
  approveAndPromote() {
    approvalCalls++;
    throw new Error('must not reach store approval without strict family coverage');
  },
};
engine.configureVerifiedSkillLifecycle(fakeStore);

assert.throws(() => engine.approveIndependentlyEvaluatedSkillCandidate(
  staged.candidateId,
  { approvedBy: 'test-reviewer', approvedAt: 100, expectedActiveVersion: null },
  baseline,
  candidateEvaluation,
  () => true,
), error => {
  assert.match(error.message, /independent reflective fitness gate rejected candidate/);
  assert.match(error.message, /validation-family-coverage-insufficient/);
  assert.match(error.message, /holdout-family-coverage-insufficient/);
  return true;
});
assert.equal(approvalCalls, 0,
  'production promotion must fail closed before asking the store to activate a family-unverified candidate');
assert.equal(journalEvents.length, 1, 'the rejected production fitness decision must reach the configured journal');
assert.equal(journalEvents[0].decision, 'fitness-rejected');
assert.equal(lifecycleEvents.length, 1, 'fitness rejection must be bound into the skill lifecycle journal');
assert.equal(lifecycleEvents[0].event, 'promotion-rejected');
assert.equal(lifecycleEvents[0].reasonCodes[0], 'fitness-gate-rejected');
assert.equal(lifecycleEvents[0].payloadFingerprint, staged.payloadFingerprint);
assert.equal(lifecycleEvents[0].evaluationFingerprint, candidateEvaluation.evaluationFingerprint);

assert.equal(Object.isFrozen(P23_REFLECTIVE_PROMOTION_POLICY), true);
for (const key of [
  'minimumValidationFamilies', 'minimumHoldoutFamilies',
  'minimumValidationFamilyTasks', 'minimumHoldoutFamilyTasks',
  'maximumValidationTaskRegression01', 'maximumValidationFamilyRegression01',
  'maximumHoldoutRegression01', 'maximumHoldoutFamilyRegression01',
  'minimumValidationFamilySeeds', 'minimumHoldoutFamilySeeds',
  'confidenceLevel', 'bootstrapResamples',
]) {
  assert.equal(journalEvents[0][key], P23_REFLECTIVE_PROMOTION_POLICY[key],
    `fitness journal must record the same production policy value: ${key}`);
}
assert.ok(journalEvents[0].reasonCodes.includes('validation-family-coverage-insufficient'));
assert.equal(journalEvents[0].matchedTrialCount, 4);
assert.equal(journalEvents[0].validation.minimumLowerBound, null);
assert.equal(journalEvents[0].holdout.minimumLowerBound, null);
assert.equal('taskId' in journalEvents[0], false,
  'the fitness journal must not retain individual task identifiers');

// WorkPass403: canonical family labels and two distinct tasks are still not
// enough when that family has only two common paired seeds. Production requires
// three seeds shared across every task in each adequately covered family.
function makeFamilyTasks(seedCount) {
  const rows = [];
  for (const [split, ids, seedBase] of [
    ['validation', ['family-validation-a', 'family-validation-b'], 100],
    ['holdout', ['family-holdout-a', 'family-holdout-b'], 200],
  ]) {
    for (const taskId of ids) {
      for (let seedIndex = 1; seedIndex <= seedCount; seedIndex++) {
        rows.push({
          taskId,
          trialId: `${taskId}-seed-${seedIndex}`,
          seed: seedBase + seedIndex,
          split,
          taskFamily: 'canonical-test-family',
          input: { prompt: `independently execute ${taskId}` },
          requiredCapabilityIds: ['read'],
          expectedStepIds: ['open', 'summarize'],
        });
      }
    }
  }
  return rows;
}
async function makeFamilyEvaluation(payload, seedCount, prefix, observedStepIds) {
  const evaluator = createIndependentSkillCandidateEvaluator({
    tasks: makeFamilyTasks(seedCount),
    environmentFingerprint: 'b'.repeat(64),
    executor: { async execute({ task }) { return { runId: prefix + task.trialId, observedStepIds }; } },
    verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
    safetyScanner: { async scan() { return { violationCount: 0 }; } },
  });
  return evaluator({
    payload,
    payloadFingerprint: digest(payload),
    baseline: { validation: [], holdout: [] },
    previousEvaluation: { validation: [], holdout: [] },
  });
}
const seedSourcePayload = { skill: 'family-aware-summarize', version: 1 };
const seedCandidatePayload = { skill: 'family-aware-summarize', version: 2, improved: true };
const seedBaselineEvaluation = await makeFamilyEvaluation(seedSourcePayload, 2, 'family-baseline-', ['open']);
const seedCandidateEvaluation = await makeFamilyEvaluation(seedCandidatePayload, 2, 'family-candidate-', ['open', 'summarize']);
const seedAdvisoryFitness = engine.evaluateReflectiveSkillCandidate(
  { validation: seedBaselineEvaluation.evaluation.validation, holdout: seedBaselineEvaluation.evaluation.holdout },
  { validation: seedCandidateEvaluation.evaluation.validation, holdout: seedCandidateEvaluation.evaluation.holdout },
);
assert.equal(seedAdvisoryFitness.eligible, true, JSON.stringify(seedAdvisoryFitness));
assert.equal(seedAdvisoryFitness.validationFamiliesEvaluated, 1);
assert.equal(seedAdvisoryFitness.holdoutFamiliesEvaluated, 1);
assert.equal(seedAdvisoryFitness.validationTaskRegressions, 0);

stagedWithInsufficientSeeds = {
  candidateId: 'candidate-with-only-two-family-seeds',
  skillId: 'summarization-skill',
  version: 2,
  payload: seedCandidatePayload,
  payloadFingerprint: seedCandidateEvaluation.payloadFingerprint,
  status: 'shadow',
  shadowObservations: [],
  revisionProvenance: {
    schemaVersion: 1,
    evaluationFingerprint: seedCandidateEvaluation.evaluationFingerprint,
  },
};
assert.throws(() => engine.approveIndependentlyEvaluatedSkillCandidate(
  stagedWithInsufficientSeeds.candidateId,
  { approvedBy: 'test-reviewer', approvedAt: 101, expectedActiveVersion: null },
  seedBaselineEvaluation,
  seedCandidateEvaluation,
  () => true,
), error => {
  assert.match(error.message, /independent reflective fitness gate rejected candidate/);
  assert.match(error.message, /validation-family-seed-coverage-insufficient/);
  assert.match(error.message, /holdout-family-seed-coverage-insufficient/);
  return true;
});
assert.equal(approvalCalls, 0,
  'two matched seeds per task family must be rejected before store approval when three are required');
assert.equal(journalEvents.length, 2, 'seed-coverage failure must also be journaled');
assert.equal(journalEvents[1].decision, 'fitness-rejected');
assert.ok(journalEvents[1].reasonCodes.includes('validation-family-seed-coverage-insufficient'));
assert.ok(journalEvents[1].reasonCodes.includes('holdout-family-seed-coverage-insufficient'));
assert.equal(fallbackJournalCalls, 0,
  'runtime default configuration must not replace an explicit host-provided sink');

console.log('WORKPASS402_PRODUCTION_PROMOTION_FAMILY_GATE=PASS strictFamilyCoverage=true noApprovalSideEffect=true pairedSeedCoverage=true journalConnected=true lifecycleRejectionBound=true hostSinkPreserved=true diagnosticsFailSoft=true');
