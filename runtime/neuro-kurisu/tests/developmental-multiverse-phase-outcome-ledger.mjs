import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createIndependentSkillCandidateEvaluator, recordIndependentEvaluationOutcomes } from '../src/organism/learning/IndependentSkillCandidateEvaluator.ts';
import { createLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const manifest = [
  { taskId: 'validation-a', family: 'family-a', split: 'validation', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('validation prompt a'), verifierId: 'dm19-verifier', version: 'v1' },
  { taskId: 'validation-b', family: 'family-a', split: 'validation', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('validation prompt b'), verifierId: 'dm19-verifier', version: 'v1' },
  { taskId: 'holdout-a', family: 'family-a', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('holdout prompt a'), verifierId: 'dm19-verifier', version: 'v1' },
  { taskId: 'holdout-b', family: 'family-a', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('holdout prompt b'), verifierId: 'dm19-verifier', version: 'v1' },
];
const ledger = new VerifiedOutcomeLedger(manifest);
const validationPlan = createLearningExperimentPlan(manifest, {
  split: 'validation', seeds: [101, 102], resetEvery: [2],
  priorMethod: 'dm19:baseline', continuousMethod: 'dm19:candidate:1', resetMethodPrefix: 'dm19:candidate:',
});
const holdoutPlan = createLearningExperimentPlan(manifest, {
  split: 'holdout', seeds: [201, 202], resetEvery: [2],
  priorMethod: 'dm19:baseline', continuousMethod: 'dm19:candidate:1', resetMethodPrefix: 'dm19:candidate:',
});
const authority = {
  manifest, ledger, validationPlan, holdoutPlan,
  method: 'dm19:candidate:1', attempt: 1,
};
const environmentFingerprint = 'a'.repeat(64);
const services = {
  executor: { async execute({ context }) {
    return { runId: context.plannedRunId, observedStepIds: ['step-a'] };
  } },
  verifier: { async verify({ execution, context }) {
    return { bindingVerified: execution.runId === context.plannedRunId, passed: true, coveredCapabilityIds: ['cap-a'] };
  } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
};
const canonical = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
};
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const run = async (split, tasks) => {
  const evaluator = createIndependentSkillCandidateEvaluator({
    tasks, ...services, environmentFingerprint,
    evaluationScope: split === 'validation' ? 'validation-only' : 'holdout-only',
    experimentAuthority: authority,
  });
  return evaluator({ payload: { profile: 'candidate-1', split }, payloadFingerprint: digest({ profile: 'candidate-1', split }) });
};
const makeTasks = (split, seeds) => ['a', 'b'].flatMap(scenario => seeds.map(seed => ({
  taskId: split + '-' + scenario,
  trialId: split + '-trial-' + scenario + '-' + seed,
  seed,
  split,
  input: { prompt: split + ' prompt ' + scenario },
  requiredCapabilityIds: ['cap-a'],
  expectedStepIds: ['step-a'],
})));

const validationResult = await run('validation', makeTasks('validation', [101, 102]));
assert.equal(validationResult.evaluation.holdout.length, 0, 'validation-only report must contain no holdout rows');
const detachedResult = structuredClone(validationResult);
detachedResult.evaluation.provenance.runBindings[0].runId = 'detached-runtime-run';
detachedResult.evaluationFingerprint = digest(detachedResult.evaluation);
const detachedLedger = new VerifiedOutcomeLedger(manifest);
assert.throws(
  () => recordIndependentEvaluationOutcomes(detachedResult, {
    ...authority, ledger: detachedLedger, evaluationScope: 'validation-only',
  }),
  /run-not-scheduled/,
  'the canonical ledger must reject an execution receipt detached from its planned run ID',
);
assert.equal(detachedLedger.snapshot().acceptedOutcomes, 0,
  'a detached execution must not write any canonical outcome rows');
const sparseValidationResult = await run('validation', makeTasks('validation', [101]));
assert.throws(
  () => recordIndependentEvaluationOutcomes(sparseValidationResult, {
    ...authority, evaluationScope: 'validation-only',
  }),
  /plan-coverage-incomplete/,
  'strict P23 ledger commits must reject a deliberately incomplete task × seed matrix',
);
assert.equal(recordIndependentEvaluationOutcomes(validationResult, {
  ...authority, evaluationScope: 'validation-only',
}).accepted, 4,
  'every candidate validation task × seed cell should be committed');
assert.deepEqual(ledger.snapshot().outcomes.map(row => row.taskId).sort(), ['validation-a', 'validation-a', 'validation-b', 'validation-b']);
assert.throws(
  () => recordIndependentEvaluationOutcomes(validationResult, {
    ...authority, evaluationScope: 'validation-only',
  }),
  /cell-already-recorded/,
  'a repeated phase receipt must not create duplicate evidence',
);

const holdoutResult = await run('holdout', makeTasks('holdout', [201, 202]));
assert.equal(holdoutResult.evaluation.validation.length, 0, 'holdout-only report must contain no validation rows');
assert.equal(recordIndependentEvaluationOutcomes(holdoutResult, {
  ...authority, evaluationScope: 'holdout-only',
}).accepted, 4,
  'all task × seed holdout cells for the candidate arm must be committed');
assert.deepEqual(
  ledger.snapshot().outcomes.map(row => row.taskId).sort(),
  ['holdout-a', 'holdout-a', 'holdout-b', 'holdout-b', 'validation-a', 'validation-a', 'validation-b', 'validation-b'],
);
console.log('DEVELOPMENTAL_MULTIVERSE_PHASE_OUTCOME_LEDGER=PASS split-scoped-commit=PASS full-factorial-coverage=PASS duplicate-rejection=PASS');
