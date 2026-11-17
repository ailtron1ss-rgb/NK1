import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { sha256Stable } from '../src/organism/core/StableSerialization.ts';

const moduleUnderTest = await import('../src/organism/learning/NeuralJitEngine.ts').catch(() => null);
assert.ok(moduleUnderTest, 'NeuralJitEngine must exist and accept evidence-bound activation traces');

const { NeuralJitEngine } = moduleUnderTest;
const trustedCaptures = new WeakSet();
const verifier = {
  verifyCapture(capture, expected) {
    return Boolean(capture && typeof capture === 'object' &&
      trustedCaptures.has(capture) &&
      capture.modelFingerprint === expected.modelFingerprint &&
      capture.taskFingerprint === expected.taskFingerprint &&
      capture.seed === expected.seed);
  },
};
const digest = value => createHash('sha256').update(value).digest('hex');
const modelFingerprint = 'a'.repeat(64);

async function makeTrace(index, overrides = {}) {
  const taskFingerprint = digest(`neural-jit-task-${index}`);
  const scale = 0.1 + index / 120;
  const decisionId = `neural-jit-decision-${index}`;
  const toolId = 'fixture.neuraljit.observe';
  const actionInput = { executionPayload: `sensitive-payload-${index}` };
  const gateway = new ActionGateway();
  gateway.registerTool({
    id: toolId,
    capability: 'fixture.embedding.probe',
    destructive: false,
    execute: async () => ({ ok: true, providerReceiptId: `provider-receipt-${index}` }),
    verify: async context => ({
      verified: true,
      basis: 'external-postcondition',
      confidence01: 0.99,
      externalObservation: true,
      observationId: `observation-${index}`,
      expectedPostcondition: 'provider result reconciled',
      observedPostcondition: 'provider result reconciled',
    }),
  });
  const execution = await gateway.executeTool(toolId, actionInput, 'neural-jit-fixture', { decisionId });
  assert.equal(execution.verified, true, JSON.stringify(execution));
  const binding = {
    toolId,
    input: actionInput,
    executionId: execution.executionId,
    decisionId,
  };
  const inputFingerprint = sha256Stable({
    toolId: binding.toolId, input: binding.input,
    executionId: binding.executionId, decisionId: binding.decisionId,
  });
  const capture = {
    captureId: `capture-${index}`,
    taskFamily: 'memory-retrieval',
    taskFingerprint,
    modelFingerprint,
    toolId,
    executionId: binding.executionId,
    decisionId,
    inputFingerprint,
    seed: index,
    capturedAt: Date.now() - 1_000 + index,
    inputFeatures: [scale, scale * 2],
    targetResidual: [scale * 0.3, scale * -0.2],
    ...overrides,
  };
  trustedCaptures.add(capture);
  return { capture, verification: execution.verification, binding };
}

const disabled = new NeuralJitEngine();
const first = await makeTrace(1);
const unavailable = await disabled.recordVerifiedTrace(first);
assert.equal(unavailable.accepted, false);
assert.equal(unavailable.reason, 'activation-capture-authority-unavailable');

const engine = new NeuralJitEngine({ activationCaptureVerifier: verifier });
const forged = await engine.recordVerifiedTrace({
  ...first,
  verification: {
    verified: true,
    basis: 'external-postcondition',
    confidence01: 1,
    externalObservation: true,
    observationId: 'forged-observation',
    expectedPostcondition: 'success',
    observedPostcondition: 'success',
  },
});
assert.equal(forged.accepted, false);
assert.equal(forged.reason, 'untrusted-outcome-verification');

const copiedCapture = structuredClone(first.capture);
const copiedCaptureResult = await engine.recordVerifiedTrace({ ...first, capture: copiedCapture });
assert.equal(copiedCaptureResult.accepted, false);
assert.equal(copiedCaptureResult.reason, 'untrusted-activation-capture');

const wrongDecision = await engine.recordVerifiedTrace({
  ...first,
  binding: { ...first.binding, decisionId: 'another-decision' },
});
assert.equal(wrongDecision.accepted, false);
assert.equal(wrongDecision.reason, 'untrusted-outcome-verification');

const recorded = [];
for (let i = 0; i < 120; i += 1) {
  const trace = await makeTrace(i);
  const result = await engine.recordVerifiedTrace(trace);
  assert.equal(result.accepted, true, `trusted trace ${i} should be admitted: ${JSON.stringify(result)}`);
  recorded.push(result);
}
assert.ok(recorded.some(x => x.split === 'train'));
assert.ok(recorded.some(x => x.split === 'holdout'));

const duplicate = await engine.recordVerifiedTrace(await makeTrace(0));
assert.equal(duplicate.accepted, false);
assert.equal(duplicate.reason, 'duplicate-outcome-observation');

const candidate = engine.compileCandidate({
  taskFamily: 'memory-retrieval',
  modelFingerprint,
});
assert.ok(candidate);
assert.equal(candidate.status, 'shadow');
assert.equal(candidate.rank, 1);
assert.ok(candidate.trainTraceCount >= 12);
assert.ok(candidate.trainingTaskFingerprints.length >= 12);
assert.ok(candidate.trainingTaskFingerprints.every(x => /^[a-f0-9]{64}$/.test(x)));

const evaluation = engine.evaluateCandidate(candidate.id);
assert.equal(evaluation.eligible, true);
assert.equal(evaluation.status, 'eligible');
assert.ok(evaluation.holdoutTraceCount >= 8);
assert.ok(evaluation.uniqueHoldoutSeeds >= 5);
assert.ok(evaluation.relativeGain01 >= 0.05);
assert.ok(evaluation.improvedSamples01 >= 0.8);
assert.equal(
  evaluation.holdoutTaskFingerprints.some(x => candidate.trainingTaskFingerprints.includes(x)),
  false,
  'holdout tasks must never be reused as training tasks',
);
assert.equal(engine.diagnostics().liveInferenceEnabled, false,
  'an eligible shadow adapter must not activate without a real local-inference hook');
assert.equal(engine.diagnostics().activeCandidates, 0);

const stored = engine.persistenceSnapshot();
assert.equal(stored.traces, undefined, 'raw activation traces must not be persisted as trusted evidence');
assert.equal(stored.candidates.length, 1);

const restored = new NeuralJitEngine({ activationCaptureVerifier: verifier });
restored.restore(stored);
assert.equal(restored.diagnostics().candidates[0].status, 'quarantined',
  'persisted weights must not retain trust after process restart');
assert.equal(restored.diagnostics().liveInferenceEnabled, false);
assert.equal(restored.diagnostics().activeCandidates, 0);
const wideWeights = structuredClone(stored);
wideWeights.candidates[0].outputDirection[0] = 128;
const restoredWideWeights = new NeuralJitEngine({ activationCaptureVerifier: verifier });
restoredWideWeights.restore(wideWeights);
assert.equal(restoredWideWeights.persistenceSnapshot().candidates[0].outputDirection[0], 128,
  'quarantined persisted residual coefficients must not be silently clamped during restore');

const antiCorrelatedEngine = new NeuralJitEngine({ activationCaptureVerifier: verifier });
for (let i = 0; i < 120; i += 1) {
  const scale = 0.1 + i / 120;
  const trace = await makeTrace(2_000 + i, { inputFeatures: [scale, -scale] });
  const result = await antiCorrelatedEngine.recordVerifiedTrace(trace);
  assert.equal(result.accepted, true);
}
const antiCorrelatedCandidate = antiCorrelatedEngine.compileCandidate({
  taskFamily: 'memory-retrieval',
  modelFingerprint,
});
assert.ok(antiCorrelatedCandidate,
  'rank-1 compilation must not fail when the covariance principal axis is orthogonal to an all-ones seed vector');
assert.equal(antiCorrelatedEngine.evaluateCandidate(antiCorrelatedCandidate.id).eligible, true,
  'anti-correlated holdout samples must be evaluated by the same rank-1 candidate');

const malformedTrace = await makeTrace(999);
malformedTrace.capture.inputFeatures = Array(257).fill(0.1);
const malformed = await engine.recordVerifiedTrace(malformedTrace);
assert.equal(malformed.accepted, false);
assert.equal(malformed.reason, 'invalid-activation-vector');

console.log('NEURAL_JIT_ENGINE=PASS');
console.log(JSON.stringify({
  admittedTraces: engine.diagnostics().acceptedTraces,
  split: engine.diagnostics().splitCounts,
  trainTraces: candidate.trainTraceCount,
  holdoutTraces: evaluation.holdoutTraceCount,
  relativeGain01: evaluation.relativeGain01,
  improvedSamples01: evaluation.improvedSamples01,
  candidateStatus: evaluation.status,
  liveInferenceEnabled: engine.diagnostics().liveInferenceEnabled,
}));
