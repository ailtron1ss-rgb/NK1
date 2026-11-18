import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { sha256Stable } from '../src/organism/core/StableSerialization.ts';

const moduleUnderTest = await import('../src/organism/learning/NeuralJitEngine.ts').catch(() => null);
assert.ok(moduleUnderTest, 'NeuralJitEngine must exist and accept evidence-bound activation traces');

const { NeuralJitEngine } = moduleUnderTest;
const trustedCaptures = new WeakSet();
const trustedCaptureDigests = new WeakMap();
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
  trustedCaptureDigests.set(capture, digest(JSON.stringify({ inputFeatures: capture.inputFeatures, targetResidual: capture.targetResidual })));
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
const compiledAgain = engine.compileCandidate({ taskFamily: 'memory-retrieval', modelFingerprint });
assert.equal(compiledAgain.id, candidate.id,
  'identical evidence must compile to the same deterministic candidate identity');
assert.equal(engine.diagnostics().candidates.length, 1,
  'recompiling unchanged evidence must replace, not duplicate, its candidate');
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
const shadowProjection = engine.projectShadowResidual(candidate.id, candidate.meanInput);
assert.ok(shadowProjection);
assert.equal(shadowProjection.mode, 'shadow');
assert.equal(shadowProjection.appliedToInference, false);
assert.equal(shadowProjection.fallback, 'base-inference-path');
assert.equal(shadowProjection.residual.length, candidate.outputDimension);
assert.ok(shadowProjection.residual.every(Number.isFinite));
assert.equal(engine.projectShadowResidual(candidate.id, [0.1]), null,
  'host branch must fail closed on activation dimension mismatch');

const stored = engine.persistenceSnapshot();
assert.equal(stored.traces, undefined, 'raw activation traces must not be persisted as trusted evidence');
assert.equal(stored.candidates.length, 1);
assert.ok(stored.seenObservationFingerprints?.length > 0,
  'the durable sidecar must retain bounded replay protection across process restarts');
assert.ok(stored.seenCaptureFingerprints?.length > 0,
  'the durable sidecar must retain capture replay protection across process restarts');
assert.ok(stored.seenObservationFingerprints.every(value => /^[a-f0-9]{64}$/.test(value)));
assert.ok(stored.seenCaptureFingerprints.every(value => /^[a-f0-9]{64}$/.test(value)));
assert.equal(JSON.stringify(stored).includes('observation-'), false,
  'raw observation IDs must never be persisted');
assert.equal(JSON.stringify(stored).includes('capture-'), false,
  'raw capture IDs must never be persisted');

const restored = new NeuralJitEngine({ activationCaptureVerifier: verifier });
restored.restore(stored);
const replayAfterRestart = await restored.recordVerifiedTrace(await makeTrace(0));
assert.equal(replayAfterRestart.accepted, false,
  'a previously admitted outcome must remain replay-protected after restart');
assert.equal(replayAfterRestart.reason, 'duplicate-outcome-observation');
assert.equal(restored.diagnostics().candidates[0].status, 'quarantined',
  'persisted weights must not retain trust after process restart');
assert.equal(restored.diagnostics().liveInferenceEnabled, false);
assert.equal(restored.diagnostics().activeCandidates, 0);
assert.equal(restored.projectShadowResidual(candidate.id,candidate.meanInput), null,
  'restored candidates remain quarantined and cannot feed a local inference shadow branch');
const wideWeights = structuredClone(stored);
wideWeights.candidates[0].outputDirection[0] = 128;
const restoredWideWeights = new NeuralJitEngine({ activationCaptureVerifier: verifier });
restoredWideWeights.restore(wideWeights);
assert.equal(restoredWideWeights.persistenceSnapshot().candidates.length, 0,
  'persisted candidates with out-of-range residual coefficients must be rejected rather than clamped or quarantined');

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

const unstableCoefficientEngine = new NeuralJitEngine({ activationCaptureVerifier: verifier });
for (let i = 0; i < 120; i += 1) {
  const input = 0.0001 + i * 0.0000015;
  const target = -3.5 + i * 0.055;
  const trace = await makeTrace(4_000 + i, {
    inputFeatures: [input, input * 2],
    targetResidual: [target, -target],
  });
  const admittedTrace = await unstableCoefficientEngine.recordVerifiedTrace(trace);
  assert.equal(admittedTrace.accepted, true);
}
assert.equal(unstableCoefficientEngine.compileCandidate({ taskFamily: 'memory-retrieval', modelFingerprint }), null,
  'rank-1 compilation must reject unstable residual coefficients instead of persisting unbounded adapters');

const expiredEngine = new NeuralJitEngine({ activationCaptureVerifier: verifier });
const expiredTrace = await makeTrace(998);
expiredTrace.capture.capturedAt = Date.now() - 10 * 60_000 - 1;
const expiredResult = await expiredEngine.recordVerifiedTrace(expiredTrace);
assert.equal(expiredResult.accepted, false,
  'a trusted but stale activation capture must not be admitted as fresh training evidence');
assert.equal(expiredResult.reason, 'activation-capture-expired');

// A capture that is fresh before asynchronous host verification must also be
// rejected if its ten-minute trust window expires while the verifier is pending.
const agingEngine = new NeuralJitEngine({
  activationCaptureVerifier: {
    verifyCapture(capture, expected) {
      const trusted = verifier.verifyCapture(capture, expected);
      simulatedNow = Number(capture.capturedAt) + 10 * 60_000 + 1;
      return trusted;
    },
  },
});
const agingTrace = await makeTrace(997, {
  inputFeatures: [0.25, 0.5],
  targetResidual: [0.05, -0.02],
});
const realDateNow = Date.now;
let simulatedNow = agingTrace.capture.capturedAt + 9 * 60_000;
let agingResult;
try {
  Date.now = () => simulatedNow;
  agingResult = await agingEngine.recordVerifiedTrace(agingTrace);
} finally {
  Date.now = realDateNow;
}
assert.equal(agingResult.accepted, false,
  'capture freshness must be checked again after asynchronous host verification');
assert.equal(agingResult.reason, 'activation-capture-expired');

// An unresponsive host verifier must be bounded and receive a cancellation signal.
let verificationAbortObserved = false;
const timeoutEngine = new NeuralJitEngine({
  activationCaptureVerificationTimeoutMs: 25,
  activationCaptureVerifier: {
    verifyCapture(_capture, _expected, options) {
      options?.signal?.addEventListener('abort', () => { verificationAbortObserved = true; }, { once: true });
      return new Promise(() => {});
    },
  },
});
const timeoutTrace = await makeTrace(996, {
  inputFeatures: [0.25, 0.5],
  targetResidual: [0.05, -0.02],
});
const timeoutResult = await timeoutEngine.recordVerifiedTrace(timeoutTrace);
assert.equal(timeoutResult.accepted, false);
assert.equal(timeoutResult.reason, 'activation-capture-verification-timeout');
assert.equal(verificationAbortObserved, true,
  'a host verifier that exceeds its budget must receive an abort signal');

const malformedTrace = await makeTrace(999);
malformedTrace.capture.inputFeatures = Array(257).fill(0.1);
const malformed = await engine.recordVerifiedTrace(malformedTrace);
assert.equal(malformed.accepted, false);
assert.equal(malformed.reason, 'invalid-activation-vector');


// Regression: a host verifier may be asynchronous. Mutating its original capture
// while verification is pending must not change the values eventually learned.
let releaseCaptureVerification;
let notifyCaptureVerificationStarted;
const captureVerificationStarted = new Promise(resolve => { notifyCaptureVerificationStarted = resolve; });
const captureVerificationGate = new Promise(resolve => { releaseCaptureVerification = resolve; });
const raceEngine = new NeuralJitEngine({
  activationCaptureVerifier: {
    async verifyCapture(capture, expected) {
      // Mimic a valid host signature check performed before an asynchronous
      // confirmation completes; later mutation of the same object must not alter
      // the already-verified payload admitted by the engine.
      const verifiedPayloadDigest = digest(JSON.stringify({
        inputFeatures: capture.inputFeatures,
        targetResidual: capture.targetResidual,
      }));
      if (capture.captureId === 'capture-9000') {
        notifyCaptureVerificationStarted();
        await captureVerificationGate;
      }
      return trustedCaptures.has(capture) &&
        verifiedPayloadDigest === trustedCaptureDigests.get(capture) &&
        capture.modelFingerprint === expected.modelFingerprint &&
        capture.taskFingerprint === expected.taskFingerprint &&
        capture.seed === expected.seed;
    },
  },
});
const racedTrace = await makeTrace(9_000, {
  inputFeatures: [0.25, 0.5],
  targetResidual: [0.05, -0.02],
});
const racedAdmission = raceEngine.recordVerifiedTrace(racedTrace);
await captureVerificationStarted;
racedTrace.capture.inputFeatures[0] = 7;
racedTrace.capture.targetResidual[0] = 7;
racedTrace.binding.input.executionPayload = 'mutated-after-verifier-start';
releaseCaptureVerification();
const firstRacedResult = await racedAdmission;
assert.equal(firstRacedResult.accepted, true);
const expectedTrainInputs = [];
if (firstRacedResult.split === 'train') expectedTrainInputs.push(0.25);
for (let i = 0; i < 119; i += 1) {
  const input = 0.2 + i / 1_000;
  const trace = await makeTrace(9_001 + i, {
    inputFeatures: [input, input * 2],
    targetResidual: [0.05, -0.02],
  });
  const result = await raceEngine.recordVerifiedTrace(trace);
  assert.equal(result.accepted, true);
  if (result.split === 'train') expectedTrainInputs.push(input);
}
const raceCandidate = raceEngine.compileCandidate({ taskFamily: 'memory-retrieval', modelFingerprint });
assert.ok(raceCandidate);
const handCheckedTrainMean = expectedTrainInputs.reduce((sum, value) => sum + value, 0) / expectedTrainInputs.length;
assert.ok(Math.abs(raceCandidate.meanInput[0] - handCheckedTrainMean) < 1e-10,
  'the compiled candidate must use the capture values snapshotted before asynchronous host verification');
assert.ok(Math.abs(raceCandidate.meanOutput[0] - 0.05) < 1e-10,
  'an asynchronous verifier race must not replace the target residual after verification began');

// Regression: activation vectors with accessors or holes must be rejected without
// executing caller-controlled getters.
const accessorTrace = await makeTrace(9_500);
let activationGetterExecuted = false;
Object.defineProperty(accessorTrace.capture.inputFeatures, '0', {
  configurable: true,
  enumerable: true,
  get() {
    activationGetterExecuted = true;
    return 0.25;
  },
});
const accessorResult = await engine.recordVerifiedTrace(accessorTrace);
assert.equal(accessorResult.accepted, false);
assert.equal(accessorResult.reason, 'invalid-activation-vector');
assert.equal(activationGetterExecuted, false,
  'validation must inspect array descriptors instead of executing accessors');

const sparseTrace = await makeTrace(9_501);
delete sparseTrace.capture.inputFeatures[0];
const sparseResult = await engine.recordVerifiedTrace(sparseTrace);
assert.equal(sparseResult.accepted, false);
assert.equal(sparseResult.reason, 'invalid-activation-vector',
  'sparse activation vectors must be rejected rather than silently training on missing values');

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
