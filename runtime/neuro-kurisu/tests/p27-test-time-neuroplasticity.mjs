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

// Fast adaptation accepts only one matched outcome for each decision tick.
const idempotent = new EmbodiedCausalWorldBridge();
decision(idempotent, 1, 'idempotent-session');
outcome(idempotent, 1, 'idempotent-session', 1);
assert.equal(idempotent.metrics().fastAcceptedUpdates, 1);
outcome(idempotent, 1, 'idempotent-session', 1);
assert.equal(idempotent.metrics().fastAcceptedUpdates, 1, 'duplicate outcome was applied twice');
assert.equal(idempotent.metrics().fastUnmatchedOutcomes, 1);

// An outcome with no preceding decision cannot create or train a fresh context.
const orphan = new EmbodiedCausalWorldBridge();
outcome(orphan, 1, 'orphan-context', 1);
assert.equal(orphan.metrics().fastAcceptedUpdates, 0);
assert.equal(orphan.metrics().fastContextCount, 0);
assert.equal(orphan.metrics().fastUnmatchedOutcomes, 1);

// Out-of-order outcomes cannot roll the fast adapter back onto an older decision.
const outOfOrder = new EmbodiedCausalWorldBridge();
decision(outOfOrder, 1, 'ordered-session');
decision(outOfOrder, 2, 'ordered-session');
outcome(outOfOrder, 2, 'ordered-session', 1);
assert.equal(outOfOrder.metrics().fastAcceptedUpdates, 1);
outcome(outOfOrder, 1, 'ordered-session', 1);
assert.equal(outOfOrder.metrics().fastAcceptedUpdates, 1);
assert.equal(outOfOrder.metrics().fastUnmatchedOutcomes, 1);

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

// The host runtime session is part of adaptation identity; a later session starts clean.
const sessionScoped = new NeuralExperienceBranch();
const sharedInput = Array.from({ length: 64 }, (_, index) => Math.sin(index * 0.17) * 0.55);
const sessionA = sessionScoped.beforeDecision({
  tick: 10, sessionId: 'runtime-session-A', input: sharedInput, baseUtilities: utilities,
  predictionError01: 0.62, novelty01: 0.48, uncertainty01: 0.42,
  homeostasis01: 0.7, identityGap01: 0.2, goalPressure01: 0.55,
  reward01: 0.72, embodied: { sensorFeatures: sharedInput },
});
sessionScoped.commitAction('explore', utilities);
sessionScoped.afterOutcome({
  tick: 10, action: 'explore', reward01: 0.82, predictionError01: 0.62,
  verified01: 1, nextInput: sharedInput.map((value, index) => value + (index % 2 ? 0.2 : -0.2)), holdout01: 1,
});
const sessionB = sessionScoped.beforeDecision({
  tick: 11, sessionId: 'runtime-session-B', input: sharedInput, baseUtilities: utilities,
  predictionError01: 0.62, novelty01: 0.48, uncertainty01: 0.42,
  homeostasis01: 0.7, identityGap01: 0.2, goalPressure01: 0.55,
  reward01: 0.72, embodied: { sensorFeatures: sharedInput },
});
assert.equal(sessionScoped.diagnostics().testTimeNeuroplasticity.activeAdapterNorm, 0);
assert.equal(sessionScoped.diagnostics().testTimeNeuroplasticity.contextCount, 2);
assert.equal(JSON.stringify(sessionScoped.snapshot()).includes('runtime-session-A'), false, 'host session identifier leaked into durable cognitive snapshot');
sessionScoped.resetTestTimeAdaptation('runtime-session-A');
assert.equal(sessionScoped.diagnostics().testTimeNeuroplasticity.contextCount, 1);
sessionScoped.resetTestTimeAdaptation('runtime-session-B');
assert.equal(sessionScoped.diagnostics().testTimeNeuroplasticity.contextCount, 0);

// Oversized externally supplied context IDs fail closed instead of colliding after truncation.
const invalidContext = new EmbodiedCausalWorldBridge();
decision(invalidContext, 1, 'x'.repeat(97));
outcome(invalidContext, 1, 'x'.repeat(97), 1);
assert.equal(invalidContext.metrics().fastAcceptedUpdates, 0);
assert.equal(invalidContext.metrics().fastContextCount, 0);
assert.equal(invalidContext.metrics().fastUnmatchedOutcomes, 1);

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
assert.equal(JSON.stringify(branch.snapshot()).includes('adaptationContextId'), false, 'ephemeral adapter identity entered durable token state');
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


// Hardened input boundary: malformed inference data must fail before mutating state.
const guarded = new EmbodiedCausalWorldBridge();
assert.throws(
  () => decision(guarded, 1, 'guarded', [0.2, Number.NaN]),
  /finite feature vector/,
);
assert.equal(guarded.metrics().observations, 0, 'invalid decision input mutated bridge state');

decision(guarded, 2, 'guarded');
assert.throws(
  () => guarded.afterOutcome({
    tick: 2, contextId: 'guarded', action: 'unknown-action',
    nextFeatures: featuresB, reward01: 0.8, verified01: 1, predictionError01: 0.2,
  }),
  /known action/,
);
assert.equal(guarded.metrics().transitions, 0, 'invalid outcome mutated durable transition state');
outcome(guarded, 2, 'guarded', 1);
assert.equal(guarded.metrics().fastAcceptedUpdates, 1, 'valid retry was lost after malformed outcome');

// A successfully accepted update must demonstrably reduce the one-step prediction error.
const stabilityGate = new EmbodiedCausalWorldBridge();
decision(stabilityGate, 1, 'stability');
outcome(stabilityGate, 1, 'stability', 1);
const stabilityMetrics = stabilityGate.metrics();
assert.ok(stabilityMetrics.fastLastPredictionErrorAfter01 < stabilityMetrics.fastLastPredictionErrorBefore01,
  'fast adaptation was accepted without improving the observed one-step prediction');

// Fast offsets decay with elapsed cognitive ticks rather than remaining frozen until TTL expiry.
const decaying = new EmbodiedCausalWorldBridge();
decision(decaying, 1, 'decay');
outcome(decaying, 1, 'decay', 1);
const normAtUpdate = decaying.metrics().fastAdapterNorm;
decision(decaying, 25, 'decay');
const normAfterDecay = decaying.metrics().fastAdapterNorm;
assert.ok(normAtUpdate > 0, 'decay fixture did not create an adaptation');
assert.ok(normAfterDecay > 0 && normAfterDecay < normAtUpdate,
  'fast adapter did not gradually relax toward the durable baseline');

console.log('P27_TEST_TIME_NEUROPLASTICITY=PASS', JSON.stringify({
  acceptedUpdates: bridge.metrics().fastAcceptedUpdates,
  rejectedUpdates: bridge.metrics().fastRejectedUpdates,
  expiredContexts: bridge.metrics().fastExpiredContexts,
  durableResidualMass: residualMass(restored.snapshot()),
}));