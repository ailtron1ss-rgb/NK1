import assert from 'node:assert/strict';
import { EmbodiedCausalWorldBridge } from '../src/organism/cognition/EmbodiedCausalWorldBridge.ts';

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

// A different context gets an independent, initially empty fast adapter.
decision(bridge, 2, 18);
metrics = bridge.metrics();
assert.equal(metrics.fastAdapterNorm, 0);
assert.equal(metrics.fastContextCount, 2);

// An unverified outcome may not update the test-time adapter.
decision(bridge, 3, 19);
outcome(bridge, 3, 19, 0.79);
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

console.log('P27_TEST_TIME_NEUROPLASTICITY=PASS', JSON.stringify({
  acceptedUpdates: bridge.metrics().fastAcceptedUpdates,
  rejectedUpdates: bridge.metrics().fastRejectedUpdates,
  expiredContexts: bridge.metrics().fastExpiredContexts,
  durableResidualMass: residualMass(restored.snapshot()),
}));
