import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { evaluateSkillLearnBenchTrial } from '../src/organism/learning/SkillLearnBenchAdapter.ts';
import * as validationOnly from '../src/organism/learning/ValidationOnlySkillCandidateEvaluator.ts';

assert.equal(
  typeof validationOnly.createValidationOnlySkillCandidateEvaluator,
  'function',
  'P23 must expose a validation-only evaluator with no holdout collection capability',
);

const digest = value => createHash('sha256').update(value).digest('hex');
const promptA = 'Read the visible memory note.';
const promptB = 'Use the approved tool to inspect the object.';
const manifest = [
  {
    taskId: 'validation-memory-1',
    family: 'memory',
    split: 'validation',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(promptA),
    verifierId: 'fixture-verifier',
    version: 'v1',
  },
  {
    taskId: 'validation-tool-1',
    family: 'tool-use',
    split: 'validation',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(promptB),
    verifierId: 'fixture-verifier',
    version: 'v1',
  },
];
const plan = createLearningExperimentPlan(manifest, {
  split: 'validation',
  seeds: [17],
  resetEvery: [1],
  priorMethod: 'baseline',
  continuousMethod: 'candidate',
  resetMethodPrefix: 'reset-',
});
function makeTasks() {
  return [
    {
      taskId: 'validation-memory-1',
      trialId: 'validation-memory-trial-17',
      taskFamily: 'memory',
      seed: 17,
      split: 'validation',
      input: { prompt: promptA },
      requiredCapabilityIds: ['cap-memory-read'],
      expectedStepIds: ['step-read-note'],
    },
    {
      taskId: 'validation-tool-1',
      trialId: 'validation-tool-trial-17',
      taskFamily: 'tool-use',
      seed: 17,
      split: 'validation',
      input: { prompt: promptB },
      requiredCapabilityIds: ['cap-tool-inspect'],
      expectedStepIds: ['step-inspect-object'],
    },
  ];
}
const tasks = makeTasks();
const contexts = [];
const executed = [];
const config = {
  tasks,
  manifest,
  plan,
  method: 'candidate',
  environmentFingerprint: digest('fixture-environment'),
  serviceTimeoutMs: 100,
  executor: {
    async execute(input) {
      contexts.push(input.context);
      executed.push(input.task);
      return {
        runId: 'run-' + input.task.taskId,
        observedStepIds: [...input.task.expectedStepIds],
      };
    },
  },
  verifier: {
    async verify(input) {
      assert.equal(input.context.payloadFingerprint, digest('{"name":"candidate"}'));
      assert.ok(input.context.plannedRunId);
      return {
        bindingVerified: true,
        passed: true,
        coveredCapabilityIds: [...input.task.requiredCapabilityIds],
      };
    },
  },
  safetyScanner: {
    async scan() { return { violationCount: 0 }; },
  },
};
const evaluator = validationOnly.createValidationOnlySkillCandidateEvaluator(config);
tasks[0].input.prompt = 'caller mutation after construction';
const payload = { name: 'candidate' };
const result = await evaluator.evaluate({
  payload,
  payloadFingerprint: digest('{"name":"candidate"}'),
});

assert.equal(result.payloadFingerprint, digest('{"name":"candidate"}'));
assert.equal(result.validationManifestFingerprint, new VerifiedOutcomeLedger(manifest).manifestFingerprint());
assert.equal(result.validationPlanFingerprint, plan.planFingerprint);
assert.equal(result.environmentFingerprint, config.environmentFingerprint);
assert.equal(result.reports.length, 2);
assert.deepEqual(result.reports.map(report => report.taskId).sort(), [
  'validation-memory-1',
  'validation-tool-1',
]);
assert.ok(result.reports.every(report => report.taskSuccess.passed));
assert.equal(executed[0].input.prompt, promptA,
  'the evaluator must snapshot caller-owned task input before asynchronous execution');
assert.ok(contexts.every(context => context.experimentPlanFingerprint === plan.planFingerprint));
assert.ok(contexts.every(context => context.manifestFingerprint === result.validationManifestFingerprint));
assert.ok(!JSON.stringify({ result, executed, contexts }).includes('holdout-secret-task'));

// A holdout task is rejected during construction, before any host capability is invoked.
let holdoutCalls = 0;
assert.throws(() => validationOnly.createValidationOnlySkillCandidateEvaluator({
  ...config,
  tasks: [...makeTasks(), {
    taskId: 'holdout-secret-task',
    trialId: 'holdout-trial',
    taskFamily: 'memory',
    seed: 17,
    split: 'holdout',
    input: { prompt: 'secret holdout prompt' },
    requiredCapabilityIds: ['cap-memory-read'],
    expectedStepIds: ['step-read-note'],
  }],
  executor: { async execute() { holdoutCalls++; throw new Error('must not execute holdout'); } },
}), /validation-only/);
assert.equal(holdoutCalls, 0);

// A candidate fingerprint mismatch is rejected before execution.
let mismatchExecutions = 0;
const mismatchEvaluator = validationOnly.createValidationOnlySkillCandidateEvaluator({
  ...config,
  tasks: makeTasks(),
  executor: { async execute() { mismatchExecutions++; throw new Error('must not execute'); } },
});
await assert.rejects(
  mismatchEvaluator.evaluate({ payload, payloadFingerprint: digest('different-payload') }),
  /payload-fingerprint-mismatch/,
);
assert.equal(mismatchExecutions, 0);

// An unbound verifier result cannot become a successful report.
const unboundEvaluator = validationOnly.createValidationOnlySkillCandidateEvaluator({
  ...config,
  tasks: makeTasks(),
  verifier: { async verify() {
    return { bindingVerified: false, passed: true, coveredCapabilityIds: ['cap-memory-read'] };
  } },
});
const unbound = await unboundEvaluator.evaluate({
  payload,
  payloadFingerprint: digest('{"name":"candidate"}'),
});
assert.equal(unbound.reports.every(report => !report.taskSuccess.passed), true);

// The service deadline aborts the executor signal and rejects the whole evaluation.
const timeoutEvaluator = validationOnly.createValidationOnlySkillCandidateEvaluator({
  ...config,
  tasks: makeTasks(),
  serviceTimeoutMs: 10,
  executor: {
    execute({ signal }) {
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('executor-observed-abort')), { once: true });
      });
    },
  },
});
await assert.rejects(
  timeoutEvaluator.evaluate({ payload, payloadFingerprint: digest('{"name":"candidate"}') }),
  /timeout/,
);

console.log('P23_VALIDATION_ONLY_CANDIDATE_EVALUATOR=PASS');
