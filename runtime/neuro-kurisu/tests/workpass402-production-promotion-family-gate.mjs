import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
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
const fakeStore = {
  snapshot() {
    return { schemaVersion: 1, revision: 0, active: [], candidates: [staged] };
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

console.log('WORKPASS402_PRODUCTION_PROMOTION_FAMILY_GATE=PASS advisoryCompatible=true strictProductionCoverage=true noApprovalSideEffect=true');
