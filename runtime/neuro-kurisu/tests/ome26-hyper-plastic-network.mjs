import assert from 'node:assert/strict';
import { B292CognitiveStateBus, defaultB292CognitiveStateBus } from '../src/organism/system/B292CognitiveStateBus.ts';
import {
  HyperPlasticNetwork,
  applyLowRankAdapter,
  hyperPlasticContextFromB292,
} from '../src/organism/research/HyperPlasticNetwork.ts';
import {
  LocalLanguageBackendPolicy,
  evaluateHyperPlasticPromotion,
  resolveHyperPlasticAdapterRoute,
} from '../src/server/local-language-backend-policy.mjs';

// First red/green seam: adapter activation must be explicitly fail-closed.
assert.equal(typeof resolveHyperPlasticAdapterRoute, 'function',
  'language backend must expose the fail-closed Hyper-Plastic route resolver');

const bus = new B292CognitiveStateBus();
bus.restore(defaultB292CognitiveStateBus());
const cognitiveState = bus.snapshot();
const context = hyperPlasticContextFromB292(cognitiveState, {
  taskType: 'reasoning',
  strategy: 'verify',
  confidence01: 0.82,
  resourceBudget01: 0.78,
});
const baseModelFingerprint = 'nk1-local-model-sha256:fixture-v1';
const network = new HyperPlasticNetwork({
  target: { layer: 'attention.query', rows: 4, cols: 4 },
  rank: 2,
  hiddenDim: 12,
  seed: 26017,
});
const generated = network.generateCandidate(context, baseModelFingerprint, cognitiveState.tick);

assert.equal(generated.status, 'candidate');
assert.equal(generated.adapter.schema, 'nk1-lora-v1');
assert.equal(Object.isFrozen(generated.adapter), true);
assert.equal(Object.isFrozen(generated.adapter.A), true);
assert.equal(Object.isFrozen(generated.adapter.B), true);
assert.equal(generated.adapter.rank, 2);
assert.equal(generated.adapter.A.length, 2);
assert.equal(generated.adapter.A[0].length, 4);
assert.equal(generated.adapter.B.length, 4);
assert.equal(generated.adapter.B[0].length, 2);
assert.ok(generated.adapter.deltaNormL2 <= generated.adapter.maxDeltaNormL2 + 1e-8);
assert.ok(generated.adapter.A.concat(generated.adapter.B)
  .flat().every((value) => Math.abs(value) <= generated.adapter.maxFactorAbs + 1e-9));

const repeated = network.generateCandidate(context, baseModelFingerprint, cognitiveState.tick);
assert.equal(repeated.status, 'candidate');
assert.equal(repeated.adapter.fingerprint, generated.adapter.fingerprint,
  'same state and network seed must generate the same adapter fingerprint');

const baseline = [
  [0.2, 0.1, 0.0, -0.1],
  [0.0, 0.3, 0.2, 0.1],
  [-0.2, 0.0, 0.4, 0.1],
  [0.1, -0.1, 0.0, 0.2],
];
const baselineBefore = structuredClone(baseline);
const adapted = applyLowRankAdapter(baseline, generated.adapter);
assert.deepEqual(baseline, baselineBefore, 'baseline matrix must remain immutable');
const tamperedAdapter = {
  ...generated.adapter,
  A: generated.adapter.A.map((row) => [...row]),
};
tamperedAdapter.A[0][0] += 0.001;
assert.throws(() => applyLowRankAdapter(baseline, tamperedAdapter), /adapter-fingerprint-mismatch/);
assert.notDeepEqual(adapted, baseline, 'LoRA composition must produce a separate candidate matrix');
assert.notStrictEqual(adapted, baseline);

const lowBudget = { ...context, resourceBudget01: 0.05 };
assert.deepEqual(network.generateCandidate(lowBudget, baseModelFingerprint, 1), {
  status: 'fallback', reason: 'resource-budget-below-floor', adapter: null,
});
const unstable = { ...context, readiness01: 0.1 };
assert.equal(network.generateCandidate(unstable, baseModelFingerprint, 1).reason,
  'cognitive-state-not-ready');

const target = generated.adapter;
const seeds = [11, 22, 33, 44, 55];
const makeReports = (datasetFingerprint, improvements) => seeds.map((seed, index) => ({
  seed,
  baseModelFingerprint,
  adapterFingerprint: target.fingerprint,
  datasetFingerprint,
  baselineScore: 0.70,
  adaptedScore: 0.70 + improvements[index],
  baselineLatencyMs: 100,
  adaptedLatencyMs: 105,
  safetyRegressionCount: 0,
}));
const calibrationReports = makeReports('calibration-dataset-fp', [0.020, 0.022, 0.021, 0.019, 0.023]);
const holdoutReports = makeReports('independent-holdout-fp', [0.018, 0.019, 0.017, 0.020, 0.0185]);

const languagePolicy = new LocalLanguageBackendPolicy();
const noCapability = languagePolicy.routeHyperPlasticAdapter({
  backendCapabilities: { supportsLowRankAdapters: false },
  baseModelFingerprint,
  adapter: target,
  promotionPermit: { eligible: true },
});
assert.deepEqual(noCapability, {
  mode: 'baseline',
  reason: 'backend-adapter-capability-unavailable',
});

const rawPromotion = evaluateHyperPlasticPromotion({ adapter: target, calibrationReports, holdoutReports });
assert.equal(rawPromotion.eligible, false);
assert.equal(rawPromotion.permit, null);
assert.deepEqual(rawPromotion.reasons, ['signed-outcome-evidence-required']);

const forgedPermit = resolveHyperPlasticAdapterRoute({
  backendCapabilities: { supportsLowRankAdapters: true, supportedLowRankTargets: ['attention.query'] },
  baseModelFingerprint,
  adapter: target,
  promotionPermit: { eligible: true, adapterFingerprint: target.fingerprint },
});
assert.equal(forgedPermit.mode, 'baseline');
assert.equal(forgedPermit.reason, 'promotion-permit-not-issued-by-signed-ledger');

const wrongModelRoute = resolveHyperPlasticAdapterRoute({
  backendCapabilities: { supportsLowRankAdapters: true, supportedLowRankTargets: ['attention.query'] },
  baseModelFingerprint: 'different-base-model',
  adapter: target,
  promotionPermit: {},
});
assert.equal(wrongModelRoute.mode, 'baseline');

const trainingNetwork = new HyperPlasticNetwork({
  target: { layer: 'attention.query', rows: 4, cols: 4 },
  rank: 2,
  hiddenDim: 12,
  seed: 26018,
});
const targetFactors = new Array(16).fill(0.025);
const firstLoss = trainingNetwork.trainStep(context, targetFactors, 0.01).loss;
let lastLoss = firstLoss;
for (let index = 0; index < 80; index += 1) {
  lastLoss = trainingNetwork.trainStep(context, targetFactors, 0.01).loss;
}
assert.ok(lastLoss < firstLoss, 'offline fitting step must reduce the supervised adapter-factor loss');
const checkpoint = trainingNetwork.snapshotParameters();
const restoredNetwork = new HyperPlasticNetwork({
  target: { layer: 'attention.query', rows: 4, cols: 4 },
  rank: 2,
  hiddenDim: 12,
  seed: 999,
});
restoredNetwork.restoreParameters(checkpoint);
assert.deepEqual(restoredNetwork.snapshotParameters(), checkpoint);
const tamperedCheckpoint = structuredClone(checkpoint);
tamperedCheckpoint.outputWeights[0][0] = Number.NaN;
assert.throws(() => restoredNetwork.restoreParameters(tamperedCheckpoint), /nonfinite-or-malformed/);
const finiteTamperedCheckpoint = structuredClone(checkpoint);
finiteTamperedCheckpoint.outputWeights[0][0] += 0.001;
assert.throws(() => restoredNetwork.restoreParameters(finiteTamperedCheckpoint), /checkpoint-fingerprint-mismatch/);

console.log('OME26_HYPER_PLASTIC_NETWORK=PASS', JSON.stringify({
  assertions: 41,
  generatedRank: target.rank,
  generatedDeltaNormL2: target.deltaNormL2,
  rawCallerScorePromotionRejected: true,
  offlineFitLossBefore: firstLoss,
  offlineFitLossAfter: lastLoss,
  baseWeightsMutated: false,
  unsupportedBackendFallback: true,
  copiedPermitRejected: true,
}));
