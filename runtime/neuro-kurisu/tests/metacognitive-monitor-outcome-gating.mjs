import assert from 'node:assert/strict';
import { MetaCognitiveMonitor, defaultMetaCognitiveState } from '../src/organism/cognition/MetaCognitiveMonitor.ts';

const input = {
  confidence: 0.9,
  predictionError: 0.1,
  worldUncertainty: 0.2,
  identityDrift: 0.05,
};
const monitor = new MetaCognitiveMonitor();
const initial = monitor.snapshot();

// Decision-time uncertainty is useful, but it is not an observed outcome.
// It must not be scored as a fabricated neutral success (0.5).
monitor.update(input);
const decisionOnly = monitor.snapshot();
assert.equal(decisionOnly.samples, 1, 'decision-only observations remain visible in the monitor sample count');
assert.equal(decisionOnly.outcomeSamples, 0, 'decision-only observations do not increment outcome calibration samples');
assert.equal(decisionOnly.predictionCalibration, initial.predictionCalibration,
  'unknown action outcomes must not change prediction calibration');
assert.equal(decisionOnly.metacognitiveAccuracy, initial.metacognitiveAccuracy,
  'unknown action outcomes must not change metacognitive accuracy');
assert.notEqual(decisionOnly.uncertaintyAboutDecision, initial.uncertaintyAboutDecision,
  'decision confidence and world uncertainty must still update before an outcome exists');

// A real outcome is the only event allowed to update calibration.
monitor.update({ ...input, outcomeSuccess: 0.9 });
const observed = monitor.snapshot();
assert.equal(observed.samples, 2);
assert.equal(observed.outcomeSamples, 1);
assert.ok(Math.abs(observed.predictionCalibration - 0.59) < 1e-12);
assert.ok(Math.abs(observed.metacognitiveAccuracy - 0.58) < 1e-12);

// Explicit null is the same as unknown; it is not coerced to zero or 0.5.
monitor.update({ ...input, outcomeSuccess: null });
const afterUnknown = monitor.snapshot();
assert.equal(afterUnknown.outcomeSamples, 1);
assert.equal(afterUnknown.predictionCalibration, observed.predictionCalibration);
assert.equal(afterUnknown.metacognitiveAccuracy, observed.metacognitiveAccuracy);

// Previously persisted v1 states predate outcomeSamples and must remain restorable.
const legacy = { ...defaultMetaCognitiveState() };
delete legacy.outcomeSamples;
const restored = new MetaCognitiveMonitor();
restored.restore(legacy);
assert.equal(restored.snapshot().outcomeSamples, 0);

console.log('metacognitive-monitor-outcome-gating: PASS');
