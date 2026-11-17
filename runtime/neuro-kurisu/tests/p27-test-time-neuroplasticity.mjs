import assert from 'node:assert/strict';
import { EmbodiedCausalWorldBridge } from '../src/organism/cognition/EmbodiedCausalWorldBridge.ts';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const ACTIONS = ['respond','explore','verify','rest','reflect','wait','defer'];
const utilities = Object.fromEntries(ACTIONS.map(action => [action, 0.5]));
const featuresA = Array.from({ length: 64 }, (_, index) => index % 2 === 0 ? -0.9 : 0.9);
const featuresB = Array.from({ length: 64 }, (_, index) => index % 3 === 0 ? 1 : -1);

function decision(bridge, tick, contextId, features = featuresA) {
  return bridge.beforeDecision({
    tick,
    contextId,
    features,
    actionUtilities: utilities,
    novelty01: 0.55,
    uncertainty01: 0.45,
    predictionError01: 0.65,
    computeBudget01: 0.85,
  });
}

function outcome(bridge, tick, contextId, verified01 = 1) {
  bridge.afterOutcome({
    tick,
    contextId,
    action: 'explore',
    nextFeatures: featuresB,
    reward01: 0.8,
    verified01,
    predictionError01: 0.7,
    sensorFreshness01: 1,
  });
}

function residualMass(snapshot) {
  return snapshot.residualAdapter.flat().reduce((sum, value) => sum + Math.abs(value), 0);
}

const bridge = new EmbodiedCausalWorldBridge();
decision(bridge, 1, 17);
outcome(bridge, 1, 17, 1);

// Test-time offsets must not be written into the durable bridge snapshot.
assert.equal(
  residualMass(bridge.snapshot()),
  0,
  'session-local residual adapter leaked into durable snapshot',
);

let metrics = bridge.metrics();
assert.equal(metrics.fastAcceptedUpdates, 1);
assert.ok(metrics.fastAdapterNorm > 0);
assert.ok(metrics.fastAdapterNorm <= 0.0800001);
assert.equal(metrics.fastContextCount, 1);
const candidate = bridge.exportTestTimeAdaptationCandidate(17);
assert.equal(candidate.status, 'requires-independent-validation');
assert.equal(candidate.updates, 1);
const candidateNorm = candidate.actionOffsets.flat().reduce((sum, value) => sum + value * value, 0) ** 0.5;
assert.ok(candidateNorm <= 0.0800001);
candidate.actionOffsets[3][0] = 100;
assert.ok(bridge.metrics().fastAdapterNorm <= 0.0800001, 'candidate export exposed mutable runtime state');

// A different context gets an independent, initially empty fast adapter.
decision(bridge, 2, 18);
metrics = bridge.metrics();
assert.equal(metrics.fastAdapterNorm, 0);
assert.equal(metrics.fastContextCount, 2);
// Returning to the original context restores its own overlay, not the intervening context.
decision(bridge, 3, 17);
assert.ok(bridge.metrics().fastAdapterNorm > 0);

// An unverified outcome may not update the test-time adapter.
decision(bridge, 4, 19);
outcome(bridge, 4, 19, 0.79);
metrics = bridge.metrics();
assert.equal(metrics.fastAcceptedUpdates, 1);
assert.equal(metrics.fastRejectedUpdates, 1);
assert.equal(metrics.fastAdapterNorm, 0);

// Tick TTL expires stale overlays and the newly active context starts clean.
decision(bridge, 300, 17);
metrics = bridge.metrics();
assert.equal(metrics.fastAdapterNorm, 0);
assert.equal(metrics.fastExpiredContexts, 3);
assert.equal(metrics.fastContextCount, 1);

// Reset is an explicit privacy and recovery boundary.
outcome(bridge, 300, 17, 1);
bridge.resetTestTimeAdaptation(17);
metrics = bridge.metrics();
assert.equal(metrics.fastContextCount, 0);
assert.equal(metrics.fastAdapterNorm, 0);

// Existing persisted legacy residuals remain readable and are not overwritten by fast learning.
const legacy = new EmbodiedCausalWorldBridge();
const legacySnapshot = legacy.snapshot();
legacySnapshot.residualAdapter[3][2] = 0.0125;
legacy.restore(legacySnapshot);
decision(legacy, 1, 'legacy-context');
outcome(legacy, 1, 'legacy-context', 1);
assert.equal(legacy.snapshot().residualAdapter[3][2], 0.0125);

// Process restore must not resurrect an ephemeral overlay.
decision(bridge, 301, 23);
outcome(bridge, 301, 23, 1);
const durable = bridge.snapshot();
const restored = new EmbodiedCausalWorldBridge();
restored.restore(durable);
metrics = restored.metrics();
assert.equal(metrics.fastContextCount, 0);
assert.equal(metrics.fastAdapterNorm, 0);
assert.equal(residualMass(restored.snapshot()), 0);

// The active overlay must affect the next causal action evaluation, not just diagnostics.
const withFastOverlay = new EmbodiedCausalWorldBridge();
decision(withFastOverlay, 1, 'matched-context');
outcome(withFastOverlay, 1, 'matched-context', 1);
const durableOnly = new EmbodiedCausalWorldBridge();
durableOnly.restore(withFastOverlay.snapshot());
const fastResult = decision(withFastOverlay, 2, 'matched-context');
const durableResult = decision(durableOnly, 2, 'matched-context');
const maxActionBiasDelta = Math.max(...ACTIONS.map(action => Math.abs(fastResult.actionBias[action] - durableResult.actionBias[action])));
assert.ok(maxActionBiasDelta > 0, 'ephemeral fast overlay did not affect the next decision');
assert.equal(durableOnly.metrics().fastAdapterNorm, 0);

// The context map is bounded and evicts its least-recently-used entry.
const bounded = new EmbodiedCausalWorldBridge();
for (let index = 0; index < 9; index++) decision(bounded, index + 1, `context-${index}`);
assert.equal(bounded.metrics().fastContextCount, 8);
assert.equal(bounded.metrics().fastEvictedContexts, 1);

// A context has a hard update budget; the 65th verified sample is rejected.
const capped = new EmbodiedCausalWorldBridge();
for (let tick = 1; tick <= 65; tick++) {
  decision(capped, tick, 'bounded-session');
  outcome(capped, tick, 'bounded-session', 1);
}
assert.equal(capped.metrics().fastAcceptedUpdates, 64);
assert.equal(capped.metrics().fastRejectedUpdates, 1);
assert.ok(capped.metrics().fastAdapterNorm <= 0.0800001);

// The real neural experience branch must carry the same context through decision and outcome.
const branch = new NeuralExperienceBranch();
const branchInput = Array.from({ length: 64 }, (_, index) => Math.sin(index * 0.17) * 0.55);
const branchDecision = branch.beforeDecision({
  tick: 1,
  input: branchInput,
  baseUtilities: utilities,
  predictionError01: 0.62,
  novelty01: 0.48,
  uncertainty01: 0.42,
  homeostasis01: 0.7,
  identityGap01: 0.2,
  goalPressure01: 0.55,
  reward01: 0.72,
  embodied: { sensorFeatures: branchInput },
});
assert.equal(typeof branchDecision.experience.adaptationContextId, 'string');
branch.commitAction('explore', utilities);
branch.afterOutcome({
  tick: 1,
  action: 'explore',
  reward01: 0.82,
  predictionError01: 0.62,
  verified01: 1,
  nextInput: branchInput.map((value, index) => value + (index % 2 ? 0.2 : -0.2)),
  holdout01: 1,
});
const branchDiagnostics = branch.diagnostics();
assert.equal(branchDiagnostics.testTimeNeuroplasticity.acceptedUpdates, 1);
assert.ok(branchDiagnostics.testTimeNeuroplasticity.activeAdapterNorm > 0);
assert.equal(residualMass({ residualAdapter: branchDiagnostics.embodiedBridge.residualAdapter }), 0);
branch.resetTestTimeAdaptation();
assert.equal(branch.diagnostics().testTimeNeuroplasticity.contextCount, 0);

console.log('P27_TEST_TIME_NEUROPLASTICITY=PASS', JSON.stringify({
  acceptedUpdates: bridge.metrics().fastAcceptedUpdates,
  rejectedUpdates: bridge.metrics().fastRejectedUpdates,
  expiredContexts: bridge.metrics().fastExpiredContexts,
  durableResidualMass: residualMass(restored.snapshot()),
}));