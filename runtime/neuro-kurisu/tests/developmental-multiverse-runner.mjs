import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIndependentSkillCandidateEvaluator } from '../src/organism/learning/IndependentSkillCandidateEvaluator.ts';
import {
  AtomicFileDevelopmentalMultiverseCheckpointStore,
  DevelopmentalMultiverseIndependentRunner,
} from '../src/organism/developmental/DevelopmentalMultiverseIndependentRunner.ts';

const baselineProfile = { exploration: 0.5, verification: 0.5, reflection: 0.5, attention: 0.5, prediction: 0.5 };
const scenarioList = (prefix, start, count) =>
  Array.from({ length: count }, (_, index) => ({ id: prefix + '-' + index, seed: start + index }));
const root = await mkdtemp(join(tmpdir(), 'nk1-dm19-runner-'));
const checkpoint = join(root, 'developmental-multiverse.json');
const store = new AtomicFileDevelopmentalMultiverseCheckpointStore(checkpoint);
const observations = [];
const services = {
  authorityIdentity: {
    executorExecutable: '/host/executor',
    verifierExecutable: '/host/verifier',
    safetyScannerExecutable: '/host/safety',
  },
  executor: {
    async execute({ payload, task, context }) {
      observations.push({ split: task.split, variantId: payload.variantId, scenarioId: task.taskId });
      const improved = payload.policyProfile.verification >= 0.58;
      return {
        runId: context.plannedRunId,
        observedStepIds: improved ? ['step-core'] : [],
      };
    },
  },
  verifier: {
    async verify({ execution, context }) {
      return {
        bindingVerified: execution.runId === context.plannedRunId,
        passed: true,
        coveredCapabilityIds: ['cap-core'],
      };
    },
  },
  safetyScanner: {
    async scan() { return { violationCount: 0 }; },
  },
};
const buildScenarioTask = scenario => ({
  input: { prompt: 'Use the bounded developmental task fixture for ' + scenario.id },
  requiredCapabilityIds: ['cap-core'],
  expectedStepIds: ['step-core'],
  taskFamily: 'dm19-regression-family',
});
const options = {
  services,
  checkpointStore: store,
  buildScenarioTask,
  environmentFingerprint: 'b'.repeat(64),
  verifierId: 'dm19-independent-verifier',
  costBudgetMsPerScenario: 30_000,
  serviceTimeoutMs: 5_000,
};
const input = {
  runId: 'dm19-independent-runner-e2e',
  createdAt: 1_800_000_000_000,
  sourceRevision: 'a'.repeat(40),
  environmentFingerprint: options.environmentFingerprint,
  baselineProfile,
  validationScenarios: scenarioList('validation', 101, 4),
  holdoutScenarios: scenarioList('holdout', 201, 5),
  variants: [
    { id: 'verification-plus', label: 'verification plus', deltas: { verification: 0.08 } },
    { id: 'exploration-heavy', label: 'exploration heavy', deltas: { exploration: 0.1 } },
  ],
};

try {
  const phaseServices = {
    executor: { async execute() { return { runId: 'phase-run', observedStepIds: ['step-core'] }; } },
    verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['cap-core'] }; } },
    safetyScanner: { async scan() { return { violationCount: 0 }; } },
  };
  assert.doesNotThrow(() => createIndependentSkillCandidateEvaluator({
    tasks: [
      { taskId: 'v1', trialId: 'v1', seed: 1, split: 'validation', input: { prompt: 'v1' }, requiredCapabilityIds: ['cap-core'], expectedStepIds: ['step-core'] },
      { taskId: 'v2', trialId: 'v2', seed: 2, split: 'validation', input: { prompt: 'v2' }, requiredCapabilityIds: ['cap-core'], expectedStepIds: ['step-core'] },
    ],
    ...phaseServices,
    environmentFingerprint: 'c'.repeat(64),
    evaluationScope: 'validation-only',
  }));
  assert.doesNotThrow(() => createIndependentSkillCandidateEvaluator({
    tasks: [
      { taskId: 'h1', trialId: 'h1', seed: 1, split: 'holdout', input: { prompt: 'h1' }, requiredCapabilityIds: ['cap-core'], expectedStepIds: ['step-core'] },
      { taskId: 'h2', trialId: 'h2', seed: 2, split: 'holdout', input: { prompt: 'h2' }, requiredCapabilityIds: ['cap-core'], expectedStepIds: ['step-core'] },
    ],
    ...phaseServices,
    environmentFingerprint: 'c'.repeat(64),
    evaluationScope: 'holdout-only',
  }));
  assert.throws(() => createIndependentSkillCandidateEvaluator({
    tasks: [
      { taskId: 'v1', trialId: 'v1', seed: 1, split: 'validation', input: { prompt: 'v1' }, requiredCapabilityIds: ['cap-core'], expectedStepIds: ['step-core'] },
      { taskId: 'v2', trialId: 'v2', seed: 2, split: 'validation', input: { prompt: 'v2' }, requiredCapabilityIds: ['cap-core'], expectedStepIds: ['step-core'] },
    ],
    ...phaseServices,
    environmentFingerprint: 'c'.repeat(64),
  }), /validation-and-holdout-required/);

  const p55BackedRunner = await DevelopmentalMultiverseIndependentRunner.createFromP55Snapshot(
    { ...input, runId: 'dm19-p55-runner-facade' },
    {
      forks: [
        { id: 'p55-facade-active', style: 'balanced', status: 'candidate', deltas: { exploration: 0.03, verification: 0.03, reflection: 0.03, attention: 0, prediction: 0.03 } },
        { id: 'p55-facade-rejected', style: 'radical', status: 'rejected', deltas: { exploration: 0.12, verification: -0.04, reflection: 0.08, attention: -0.06, prediction: 0.09 } },
      ],
    },
    {
      ...options,
      checkpointStore: new AtomicFileDevelopmentalMultiverseCheckpointStore(join(root, 'p55-facade.json')),
    },
  );
  assert.deepEqual(p55BackedRunner.snapshot().session.variants.map(variant => variant.id), ['p55-facade-active'],
    'the runner facade must directly convert a P55 snapshot and exclude rejected forks');

  const runner = await DevelopmentalMultiverseIndependentRunner.create(input, options);
  assert.equal(runner.snapshot().status, 'validating');
  const selection = await runner.runValidation();
  assert.equal(selection.selectedVariantId, 'verification-plus',
    'the independently evaluated candidate with better ordered execution should win validation');
  assert.equal(runner.snapshot().status, 'holding-out');
  assert.equal(runner.snapshot().validationObservations.length, 12,
    'baseline and both candidate arms should each have four independently bound validation observations');
  assert.ok(runner.snapshot().validationObservations.every(row => row.verifiedEvidence?.runId === row.verifiedEvidence?.plannedRunId));
  assert.ok(runner.snapshot().validationObservations.every(row =>
    /^[a-f0-9]{64}$/.test(row.verifiedEvidence?.outcomeLedgerFingerprint ?? '') &&
    row.verifiedEvidence?.outcomeCount >= 4),
    'each arm receipt must include the canonical P23 outcome ledger fingerprint and accepted row count');

  const validationOnlyHoldoutCalls = observations.filter(row => row.split === 'holdout');
  assert.equal(validationOnlyHoldoutCalls.length, 0, 'validation must never dispatch holdout tasks to any candidate');
  const restoredBeforeHoldout = await DevelopmentalMultiverseIndependentRunner.restore(options);
  assert.equal(restoredBeforeHoldout.snapshot().status, 'holding-out');

  const result = await restoredBeforeHoldout.runHoldout();
  assert.equal(result.status, 'eligible-for-independent-review');
  assert.equal(result.selectedVariantId, 'verification-plus');
  assert.equal(result.automaticPromotion, false);
  assert.equal(result.evidence.verifiedObservationCount, 22,
    'verified evidence count must include 12 validation and 10 finalist-only holdout observations');
  assert.ok(/^[a-f0-9]{64}$/.test(result.evidence.verifiedEvidenceFingerprint));
  assert.ok(restoredBeforeHoldout.snapshot().holdoutObservations.every(row
    /^[a-f0-9]{64}$/.test(row.verifiedEvidence?.outcomeLedgerFingerprint ?? '') &&
    row.verifiedEvidence?.outcomeCount >= 5),
    'holdout receipts must be tied to P23 ledger commits for baseline and finalist only');
  assert.equal(result.evidence.verifiedPlanCount, 2,
    'validation and holdout must be separate evaluator plans');
  const holdoutCalls = observations.filter(row => row.split === 'holdout');
  assert.equal(holdoutCalls.length, 10, 'only baseline and validation finalist may execute on the five holdout scenarios');
  assert.ok(holdoutCalls.every(row => ['baseline', 'verification-plus'].includes(row.variantId)));
  assert.ok(holdoutCalls.every(row => !row.scenarioId.includes('validation-')));

  let getterCalls = 0;
  const accessorStore = new AtomicFileDevelopmentalMultiverseCheckpointStore(join(root, 'accessor-checkpoint.json'));
  const accessorRunner = await DevelopmentalMultiverseIndependentRunner.create(
    { ...input, runId: 'dm19-accessor-boundary' },
    {
      ...options,
      checkpointStore: accessorStore,
      buildScenarioTask: () => {
        const task = {
          requiredCapabilityIds: ['cap-core'],
          expectedStepIds: ['step-core'],
          taskFamily: 'dm19-regression-family',
        };
        Object.defineProperty(task, 'input', {
          enumerable: true,
          get() { getterCalls += 1; return { prompt: 'this getter must never run' }; },
        });
        return task;
      },
    },
  );
  await assert.rejects(() => accessorRunner.runValidation(), /scenario-task-data-invalid/,
    'scenario task accessors must be rejected without executing user code');
  assert.equal(getterCalls, 0, 'scenario input trust-boundary snapshot must not invoke getters');

  const restoredAfterHoldout = await DevelopmentalMultiverseIndependentRunner.restore(options);
  assert.deepEqual(restoredAfterHoldout.snapshot().finalResult, result,
    'atomic checkpoint restore must reproduce the fully revalidated independent evidence');
  const corrupted = JSON.parse(await readFile(checkpoint, 'utf8'));
  corrupted.snapshotFingerprint = 'f'.repeat(64);
  await writeFile(checkpoint, JSON.stringify(corrupted));
  await assert.rejects(() => store.load(), /fingerprint-mismatch/,
    'checkpoint tampering must fail closed before restore');
  console.log('DEVELOPMENTAL_MULTIVERSE_P23_RUNNER=PASS phase-isolation=PASS finalist-only-holdout=PASS durable-restore=PASS verified-evidence=22');
} finally {
  await rm(root, { recursive: true, force: true });
}
