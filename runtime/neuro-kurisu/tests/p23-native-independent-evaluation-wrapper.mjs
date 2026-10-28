import assert from 'node:assert/strict';
import test from 'node:test';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { createLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { fingerprintSkillPayload } from '../src/organism/learning/VersionedSkillCandidateStore.ts';
import { withIndependentCandidateEvaluation } from '../src/organism/learning/P23IndependentEvaluationProvider.ts';

test('native P23 wrapper independently evaluates baseline, source and revision method arms', async () => {
  const prompts = {
    'task-validation': 'Read and verify a short note.',
    'task-holdout': 'Read and verify a separate note.',
  };
  const manifest = Object.entries(prompts).map(([taskId, prompt]) => ({
    taskId,
    family: taskId === 'task-validation' ? 'validation-family' : 'holdout-family',
    split: taskId === 'task-validation' ? 'validation' : 'holdout',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(prompt),
    verifierId: 'host-verifier-v1',
    version: 'v1',
  }));
  const ledger = new VerifiedOutcomeLedger(manifest);
  const planOptions = {
    seeds: [13],
    resetEvery: [1, 2],
    priorMethod: 'baseline-v1',
    continuousMethod: 'source-v1',
    resetMethodPrefix: 'revision-',
  };
  const validationPlan = createLearningExperimentPlan(manifest, { ...planOptions, split: 'validation' });
  const holdoutPlan = createLearningExperimentPlan(manifest, { ...planOptions, split: 'holdout' });
  const tasks = manifest.map(entry => ({
    taskId: entry.taskId,
    trialId: 'trial-' + entry.taskId,
    seed: 13,
    split: entry.split,
    input: { prompt: prompts[entry.taskId] },
    requiredCapabilityIds: ['cap-read'],
    expectedStepIds: ['read', 'verify'],
  }));
  const executionLog = [];
  const config = {
    tasks,
    executor: {
      execute: async ({ payload, task, context }) => {
        assert.equal(typeof payload, 'object');
        assert.ok(context.plannedRunId, 'every arm must be bound to an independently scheduled run');
        executionLog.push({ method: context.plannedRunId, payloadFingerprint: context.payloadFingerprint });
        return { runId: context.plannedRunId, observedStepIds: [...task.expectedStepIds] };
      },
    },
    verifier: {
      verify: async ({ task, execution }) => ({
        bindingVerified: execution.observedStepIds.join('|') === task.expectedStepIds.join('|'),
        passed: true,
        coveredCapabilityIds: [...task.requiredCapabilityIds],
      }),
    },
    safetyScanner: {
      scan: async () => ({ violationCount: 0 }),
    },
    environmentFingerprint: 'e'.repeat(64),
    serviceTimeoutMs: 5000,
    baselineMethod: 'baseline-v1',
    sourceCandidateMethod: 'source-v1',
    experimentAuthority: {
      manifest,
      ledger,
      validationPlan,
      holdoutPlan,
      method: 'revision-1',
      attempt: 1,
    },
  };
  const baselinePayload = { skill: 'v1', steps: ['read'] };
  const sourcePayload = { skill: 'v2', steps: ['read', 'verify'] };
  let lineageChecks = 0;
  const provider = async () => ({
    proposal: {},
    sourceCandidateId: 'source-candidate-id',
    baseline: { validation: [], holdout: [] },
    candidateEvaluation: { validation: [], holdout: [] },
    baselinePayload,
    baselinePayloadFingerprint: fingerprintSkillPayload(baselinePayload),
    sourceCandidatePayload: sourcePayload,
    sourceCandidatePayloadFingerprint: fingerprintSkillPayload(sourcePayload),
    assertCanonicalLineageCurrent: async () => { lineageChecks++; },
    generate: async request => ({ ...request.sourcePayload, revised: true }),
    evaluateRevisedCandidate: async () => { throw new Error('raw provider evaluator must be replaced'); },
  });

  const wrapped = withIndependentCandidateEvaluation(provider, () => config);
  const prepared = await wrapped({ skillId: 'skill-a', repairFingerprints: [], repairEvidence: [] });
  assert.ok(prepared.baseline.validation.length > 0);
  assert.ok(prepared.baseline.holdout.length > 0);
  assert.ok(prepared.candidateEvaluation.validation.length > 0);
  assert.ok(prepared.candidateEvaluation.holdout.length > 0);
  assert.equal(prepared.baseline.provenance.experimentAuthority.method, 'baseline-v1');
  assert.equal(prepared.candidateEvaluation.provenance.experimentAuthority.method, 'source-v1');
  assert.equal(lineageChecks, 4, 'canonical lineage is rechecked before/after each pre-revision evaluation');

  const revisedPayload = { skill: 'v3', steps: ['read', 'verify', 'confirm'] };
  const revision = await prepared.evaluateRevisedCandidate({
    payload: revisedPayload,
    payloadFingerprint: fingerprintSkillPayload(revisedPayload),
    baseline: prepared.baseline,
    previousEvaluation: prepared.candidateEvaluation,
  });
  assert.equal(revision.evaluation.provenance.experimentAuthority.method, 'revision-1');
  assert.ok(revision.evaluation.validation.length > 0);
  assert.ok(revision.evaluation.holdout.length > 0);
  assert.equal(lineageChecks, 5, 'canonical lineage is rechecked after the generated candidate evaluation');
  assert.equal(executionLog.length, 6, 'two fixed tasks run in baseline, source and revision arms');
});

console.log('P23_NATIVE_INDEPENDENT_EVALUATION=PASS');
