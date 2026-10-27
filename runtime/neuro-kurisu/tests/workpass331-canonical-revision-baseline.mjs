import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { withIndependentCandidateEvaluation } from '../src/organism/learning/P23IndependentEvaluationProvider.ts';

const fingerprint = value => createHash('sha256').update(canonical(value)).digest('hex');
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

const taskSpecs = [
  { taskId: 'val-memory-a', family: 'memory', split: 'validation', version: '1', verifierId: 'verifier-memory', prompt: 'Recall a stable preference', capabilities: ['recall'], steps: ['retrieve', 'answer'] },
  { taskId: 'val-transfer-b', family: 'transfer', split: 'validation', version: '1', verifierId: 'verifier-transfer', prompt: 'Apply a learned rule to a new case', capabilities: ['reason'], steps: ['inspect', 'infer', 'verify'] },
  { taskId: 'hold-memory-c', family: 'memory', split: 'holdout', version: '1', verifierId: 'verifier-memory', prompt: 'Recall a revised stable preference', capabilities: ['recall'], steps: ['retrieve', 'answer'] },
  { taskId: 'hold-transfer-d', family: 'transfer', split: 'holdout', version: '1', verifierId: 'verifier-transfer', prompt: 'Apply a rule to an unseen case', capabilities: ['reason'], steps: ['inspect', 'infer', 'verify'] },
];
const manifest = taskSpecs.map(task => ({
  taskId: task.taskId,
  family: task.family,
  split: task.split,
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(task.prompt),
  verifierId: task.verifierId,
  version: task.version,
}));
const planOptions = {
  seeds: [17, 29],
  resetEvery: [1],
  priorMethod: 'active-baseline-v1',
  continuousMethod: 'source-candidate-v1',
  resetMethodPrefix: 'revision-candidate-v',
};
const validationPlan = createLearningExperimentPlan(manifest, { ...planOptions, split: 'validation' });
const holdoutPlan = createLearningExperimentPlan(manifest, { ...planOptions, split: 'holdout' });
const ledger = new VerifiedOutcomeLedger(manifest);
const tasks = taskSpecs.flatMap(spec => [17, 29].map(seed => ({
  taskId: spec.taskId,
  trialId: spec.taskId + '-seed-' + seed,
  seed,
  split: spec.split,
  input: { prompt: spec.prompt },
  requiredCapabilityIds: [...spec.capabilities],
  expectedStepIds: [...spec.steps],
})));
const environmentFingerprint = 'e'.repeat(64);
let sandboxRuns = 0;
let stale = false;
let resolverCalls = 0;
let freshnessChecks = 0;
let providerEvaluatorCalls = 0;

const configFactory = () => ({
  tasks: structuredClone(tasks),
  environmentFingerprint,
  baselineMethod: 'active-baseline-v1',
  sourceCandidateMethod: 'source-candidate-v1',
  executor: {
    async execute({ payload, task, context }) {
      sandboxRuns++;
      const complete = payload.kind !== 'source-candidate';
      return {
        runId: context.plannedRunId + '-' + context.payloadFingerprint.slice(0, 8),
        observedStepIds: complete ? [...task.expectedStepIds] : [],
        metadata: { payloadKind: payload.kind },
      };
    },
  },
  verifier: {
    async verify({ task, execution }) {
      const passed = execution.metadata.payloadKind !== 'source-candidate';
      return {
        bindingVerified: true,
        passed,
        coveredCapabilityIds: passed ? [...task.requiredCapabilityIds] : [],
      };
    },
  },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
  experimentAuthority: {
    manifest,
    ledger,
    validationPlan,
    holdoutPlan,
    method: 'revision-candidate-v1',
    attempt: 1,
  },
});

const provider = withIndependentCandidateEvaluation(
  async () => ({
    proposal: { proposalId: 'provider-proposal' },
    sourceCandidateId: 'canonical-source-id',
    // These deliberately poisoned report objects must never become the source
    // of the P23 revision plan in the canonical production path.
    baseline: { validation: [{ taskId: 'provider-forged-baseline', trialId: 'x' }], holdout: [{ taskId: 'provider-forged-baseline-h', trialId: 'y' }] },
    candidateEvaluation: { validation: [{ taskId: 'provider-forged-candidate', trialId: 'x' }], holdout: [{ taskId: 'provider-forged-candidate-h', trialId: 'y' }] },
    generate: async () => ({ kind: 'generated-unused-by-fixture' }),
    evaluateRevisedCandidate: async () => {
      providerEvaluatorCalls++;
      throw new Error('provider-supplied evaluator must not execute');
    },
  }),
  () => configFactory(),
  {
    requireCanonicalSourceEvaluation: true,
    resolveCanonicalPayloads: (input, prepared) => {
      resolverCalls++;
      assert.equal(input.skillId, 'skill-a');
      assert.equal(prepared.sourceCandidateId, 'canonical-source-id');
      return {
        baselinePayload: { kind: 'active-baseline', body: 'trusted active skill' },
        sourceCandidatePayload: { kind: 'source-candidate', body: 'trusted source version' },
        baselinePayloadFingerprint: fingerprint({ kind: 'active-baseline', body: 'trusted active skill' }),
        sourceCandidatePayloadFingerprint: fingerprint({ kind: 'source-candidate', body: 'trusted source version' }),
        assertStillCurrent() {
          freshnessChecks++;
          if (stale) throw new Error('canonical active/source identity changed during evaluation');
        },
      };
    },
  },
);

const prepared = await provider({
  skillId: 'skill-a',
  repairFingerprints: ['verified-repair-fingerprint'],
  repairEvidence: [],
});
assert.equal(typeof prepared.assertCanonicalLineageCurrent, 'function',
  'the final staging boundary must receive the same host-owned source identity recheck');
assert.equal(resolverCalls, 1);
assert.equal(sandboxRuns, tasks.length * 2, 'baseline and source candidate must both be freshly evaluated');
assert.equal(providerEvaluatorCalls, 0, 'provider-supplied evaluator must be ignored');
assert.ok(prepared.baseline.validation.length > 0);
assert.ok(prepared.baseline.holdout.length > 0);
assert.ok(prepared.candidateEvaluation.validation.length > 0);
assert.ok(prepared.candidateEvaluation.holdout.length > 0);
assert.ok(prepared.baseline.validation.every(report => !report.taskId.startsWith('provider-forged')));
assert.ok(prepared.candidateEvaluation.validation.every(report => !report.taskId.startsWith('provider-forged')));
assert.ok(prepared.baseline.validation.every(report => report.taskSuccess.passed),
  'canonical active baseline should reflect its actual successful execution');
assert.ok(prepared.candidateEvaluation.validation.every(report => !report.taskSuccess.passed),
  'canonical source candidate failures must be retained as evaluation data, not mistaken for untrusted IDs');
assert.ok(prepared.baseline.holdout.every(report => report.taskSuccess.passed));
assert.ok(prepared.candidateEvaluation.holdout.every(report => !report.taskSuccess.passed));

const revisedPayload = { kind: 'revision-candidate', body: 'freshly generated skill' };
const revised = await prepared.evaluateRevisedCandidate({
  payload: revisedPayload,
  payloadFingerprint: fingerprint(revisedPayload),
  baseline: prepared.baseline,
  previousEvaluation: prepared.candidateEvaluation,
});
assert.equal(revised.payloadFingerprint, fingerprint(revisedPayload));
assert.equal(revised.evaluationFingerprint, fingerprint(revised.evaluation));
assert.equal(revised.evaluation.validation.length, 4);
assert.equal(revised.evaluation.holdout.length, 4);
assert.equal(sandboxRuns, tasks.length * 3, 'the revised payload must receive its own independent execution');
assert.equal(providerEvaluatorCalls, 0);
assert.equal(resolverCalls, 1, 'payloads are resolved only from the canonical-store callback');
assert.equal(freshnessChecks, 2, 'active/source versions must be rechecked after source and fresh evaluation');
assert.ok(revised.evaluation.validation.every(report => report.taskSuccess.passed));

// A source/active store revision during generation cannot reuse stale baseline metrics.
stale = true;
await assert.rejects(
  prepared.evaluateRevisedCandidate({
    payload: { kind: 'revision-candidate-2', body: 'freshly generated skill' },
    payloadFingerprint: fingerprint({ kind: 'revision-candidate-2', body: 'freshly generated skill' }),
    baseline: prepared.baseline,
    previousEvaluation: prepared.candidateEvaluation,
  }),
  /canonical active\/source identity changed during evaluation/,
);

const oldNodeEnv = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = 'production';
  assert.throws(
    () => withIndependentCandidateEvaluation(async () => ({}), () => configFactory()),
    /production-independent-evaluation-canonical-source-resolver-required/,
  );
} finally {
  if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = oldNodeEnv;
}

console.log('WorkPass331 canonical P23 revision-baseline regressions passed');
