import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIndependentSkillCandidateEvaluator } from '../src/organism/learning/IndependentSkillCandidateEvaluator.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import {
  AtomicFileDevelopmentalMultiverseCheckpointStore,
  DevelopmentalMultiverseIndependentRunner,
} from '../src/organism/developmental/DevelopmentalMultiverseIndependentRunner.ts';

const baselineProfile = { exploration: 0.5, verification: 0.5, reflection: 0.5, attention: 0.5, prediction: 0.5 };
const scenarioList = (prefix, scenarioCount, firstSeed, seedCount) =>
  Array.from({ length: scenarioCount }, (_, scenario) => Array.from({ length: seedCount }, (_, offset) => ({ id: prefix + '-' + scenario, seed: firstSeed + offset }))).flat();
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
      observations.push({ split: task.split, variantId: payload.variantId, scenarioId: task.taskId, seed: task.seed });
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
        passed: execution.observedStepIds.includes('step-core'),
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
  validationScenarios: scenarioList('validation', 2, 101, 3),
  holdoutScenarios: scenarioList('holdout', 2, 201, 5),
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
  assert.equal(runner.snapshot().validationObservations.length, 18,
    'baseline and both candidate arms should each have six scenario-seed validation pairs (two scenarios × three seeds)');
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
  assert.equal(result.evidence.verifiedObservationCount, 38,
    'verified evidence count must include 18 validation and 20 finalist-only holdout observations');
  assert.ok(/^[a-f0-9]{64}$/.test(result.evidence.verifiedEvidenceFingerprint));
  assert.ok(restoredBeforeHoldout.snapshot().holdoutObservations.every(row =>
    /^[a-f0-9]{64}$/.test(row.verifiedEvidence?.outcomeLedgerFingerprint ?? '') &&
    row.verifiedEvidence?.outcomeCount >= 5),
    'holdout receipts must be tied to P23 ledger commits for baseline and finalist only');
  assert.equal(result.evidence.verifiedPlanCount, 2,
    'validation and holdout must be separate evaluator plans');
  const holdoutCalls = observations.filter(row => row.split === 'holdout');
  assert.equal(holdoutCalls.length, 20, 'only baseline and validation finalist may execute on two holdout scenarios across five seeds');
  assert.ok(holdoutCalls.every(row => ['baseline', 'verification-plus'].includes(row.variantId)));
  assert.ok(holdoutCalls.every(row => !row.scenarioId.includes('validation-')));

  let getterCalls = 0;
  const accessorStore = new AtomicFileDevelopmentalMultiverseCheckpointStore(join(root, 'accessor-checkpoint.json'));
  await assert.rejects(() => DevelopmentalMultiverseIndependentRunner.create(
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
  ), /scenario-task-data-invalid/,
    'scenario task accessors must be rejected before the runner can be checkpointed');
  assert.equal(getterCalls, 0, 'scenario input trust-boundary snapshot must not invoke getters');

  let frozenFactoryCalls = 0;
  const frozenStore = new AtomicFileDevelopmentalMultiverseCheckpointStore(join(root, 'frozen-corpus.json'));
  const frozenOptions = {
    ...options,
    checkpointStore: frozenStore,
    buildScenarioTask: scenario => {
      frozenFactoryCalls += 1;
      return {
        input: { prompt: 'frozen scenario ' + scenario.id },
        requiredCapabilityIds: ['cap-core'],
        expectedStepIds: ['step-core'],
        taskFamily: 'dm19-frozen-corpus-family',
      };
    },
  };
  const frozenRunner = await DevelopmentalMultiverseIndependentRunner.create(
    { ...input, runId: 'dm19-frozen-corpus' },
    frozenOptions,
  );
  assert.equal(frozenFactoryCalls, 4,
    'the four base scenarios must be built once and expanded into 16 immutable scenario-seed tasks');
  await frozenRunner.runValidation();
  const validationEvidence = frozenRunner.snapshot().validationObservations[0].verifiedEvidence;
  const checkpointAfterValidation = await frozenStore.load();
  assert.equal(checkpointAfterValidation.corpus.rows.length, 16,
    'the checkpoint must retain the exact frozen validation + holdout task corpus');
  assert.equal(checkpointAfterValidation.corpus.manifest.length, 4,
    'P23 manifest must contain one immutable task definition per scenario, not one per seed');
  const repeatedScenarioRows = checkpointAfterValidation.corpus.rows.filter(row =>
    row.phase === 'validation' && row.scenario.id === 'validation-0');
  assert.equal(repeatedScenarioRows.length, 3);
  assert.equal(new Set(repeatedScenarioRows.map(row => row.task.taskId)).size, 1,
    'all independent seeds for a scenario must share the same canonical task identity');
  assert.equal(new Set(repeatedScenarioRows.map(row => row.task.trialId)).size, 3,
    'each seed execution must retain its own distinct trial identity');
  assert.equal(new Set(repeatedScenarioRows.map(row =>
    row.task.input.developmentalMultiverse.scenarioFingerprint)).size, 1,
    'scenario inputs and rubric must stay identical across independent seeds');
  assert.equal(checkpointAfterValidation.corpus.ledgerSnapshot.acceptedOutcomes, 18,
    'the checkpoint must retain canonical P23 validation outcomes, not only their hash');
  const validationLedger = VerifiedOutcomeLedger.restoreSnapshot(checkpointAfterValidation.corpus.ledgerSnapshot);
  const validationBySeed = validationLedger.comparePairedBySeed('dm19:baseline', 'dm19:candidate:1', 'validation');
  assert.equal(validationBySeed.pairedN, 3,
    'every validation seed must contain all task rows for baseline and candidate in the canonical P23 ledger');
  assert.equal(validationBySeed.absoluteGain, 1,
    'P23 seed-clustered summaries must compare complete seed-level task aggregates');
  const frozenRestored = await DevelopmentalMultiverseIndependentRunner.restore(frozenOptions);
  await frozenRestored.runHoldout();
  assert.equal(frozenFactoryCalls, 4,
    'restoring and running holdout must never rebuild the four frozen scenario definitions');
  const frozenHoldoutRows = frozenRestored.snapshot().holdoutObservations;
  assert.ok(frozenHoldoutRows.every(row =>
    row.verifiedEvidence?.manifestFingerprint === validationEvidence.manifestFingerprint),
    'validation and holdout must use the exact same canonical task manifest');
  assert.ok(frozenHoldoutRows.every(row =>
    row.verifiedEvidence?.holdoutPlanFingerprint === validationEvidence.holdoutPlanFingerprint),
    'holdout execution must use the untouched holdout plan frozen before validation');
  const checkpointAfterHoldout = await frozenStore.load();
  assert.equal(checkpointAfterHoldout.corpus.ledgerSnapshot.acceptedOutcomes, 38,
    'the restored P23 ledger must contain validation and finalist-only holdout outcome rows');
  const fullLedger = VerifiedOutcomeLedger.restoreSnapshot(checkpointAfterHoldout.corpus.ledgerSnapshot);
  const holdoutBySeed = fullLedger.comparePairedBySeed('dm19:baseline', 'dm19:candidate:1', 'holdout');
  assert.equal(holdoutBySeed.pairedN, 5,
    'the canonical P23 holdout ledger must expose five complete independent seed clusters');

  const restoredAfterHoldout = await DevelopmentalMultiverseIndependentRunner.restore(options);
  assert.deepEqual(restoredAfterHoldout.snapshot().finalResult, result,
    'atomic checkpoint restore must reproduce the fully revalidated independent evidence');
  const corrupted = JSON.parse(await readFile(checkpoint, 'utf8'));
  corrupted.snapshotFingerprint = 'f'.repeat(64);
  await writeFile(checkpoint, JSON.stringify(corrupted));
  await assert.rejects(() => store.load(), /fingerprint-mismatch/,
    'checkpoint tampering must fail closed before restore');
  console.log('DEVELOPMENTAL_MULTIVERSE_P23_RUNNER=PASS phase-isolation=PASS finalist-only-holdout=PASS durable-restore=PASS verified-evidence=38');
} finally {
  await rm(root, { recursive: true, force: true });
}
