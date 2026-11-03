import test from 'node:test';
import assert from 'node:assert/strict';
import { InteroceptivePrecisionAllocator } from '../src/organism/system/InteroceptivePrecisionAllocator.ts';
import { InteroceptiveStateEstimator } from '../src/organism/system/InteroceptiveStateEstimator.ts';

const allocator = new InteroceptivePrecisionAllocator();
const total = values => Object.values(values).reduce((sum, value) => sum + value, 0);

test('allocates a finite budget across all channels without starving any channel', () => {
  const frame = allocator.allocate({ energy: 0.5, thermal: 0.5, cognitiveLoad: 0.5, sleepPressure: 0.5, attentionBudget01: 0.7 });
  assert.ok(Math.abs(total(frame.allocation01) - 0.7) < 1e-12);
  assert.ok(Object.values(frame.share01).every(value => value >= 0.08 && value <= 1));
  assert.ok(frame.entropy01 > 0.99);
});

test('routes precision toward the most urgent homeostatic channel', () => {
  const energy = allocator.allocate({ energy: 0.08, thermal: 0.1, cognitiveLoad: 0.1, sleepPressure: 0.1 });
  const thermal = allocator.allocate({ energy: 0.9, thermal: 0.96, cognitiveLoad: 0.1, sleepPressure: 0.1 });
  const sleep = allocator.allocate({ energy: 0.9, thermal: 0.1, cognitiveLoad: 0.1, sleepPressure: 0.98 });
  assert.equal(energy.dominantChannel, 'energy');
  assert.equal(thermal.dominantChannel, 'thermal');
  assert.equal(sleep.dominantChannel, 'sleepPressure');
  assert.ok(energy.share01.energy > energy.share01.thermal * 2);
  assert.ok(thermal.share01.thermal > thermal.share01.energy * 2);
});

test('zero budget returns zero precision and a safe no-focus marker', () => {
  const frame = allocator.allocate({ energy: 0, thermal: 1, cognitiveLoad: 1, sleepPressure: 1, attentionBudget01: 0 });
  assert.equal(total(frame.allocation01), 0);
  assert.equal(frame.dominantChannel, 'none');
  assert.ok(Object.values(frame.share01).every(Number.isFinite));
});

test('clamps malformed numeric inputs and is deterministic', () => {
  const input = { energy: -4, thermal: Number.NaN, cognitiveLoad: 4, sleepPressure: 0.4, attentionBudget01: 9 };
  const a = allocator.allocate(input);
  const b = allocator.allocate(input);
  assert.deepEqual(a, b);
  assert.equal(a.budget01, 1);
  assert.ok(Object.values(a.allocation01).every(value => Number.isFinite(value) && value >= 0 && value <= 1));
});

test('interoceptive estimator exposes precision allocation and attended prediction error', () => {
  const estimator = new InteroceptiveStateEstimator();
  const frame = estimator.observe({
    energy01: 0.08, thermal01: 0.1, cognitiveLoad01: 0.1,
    sleepPressure01: 0.1, capacity01: 0.8, sensoryFreshness01: 0.9,
    attentionBudget01: 0.65,
  });
  assert.equal(frame.precisionAllocation01.dominantChannel, 'energy');
  assert.ok(Math.abs(total(frame.precisionAllocation01.allocation01) - 0.65) < 1e-12);
  assert.ok(Number.isFinite(frame.attendedPredictionError01));
  assert.ok(frame.uncertainty01 >= 0 && frame.uncertainty01 <= 1);
});

test('zero attention budget leaves homeostatic recovery at the baseline estimate', () => {
  const estimator = new InteroceptiveStateEstimator();
  const observation = {
    energy01: 0.12, thermal01: 0.72, cognitiveLoad01: 0.66,
    sleepPressure01: 0.8, capacity01: 0.35, sensoryFreshness01: 0.9,
    attentionBudget01: 0,
  };
  const frame = estimator.observe(observation);
  const expected = Math.max(0, Math.min(1,
    (1 - observation.energy01) * 0.42 +
    observation.thermal01 * 0.24 +
    observation.cognitiveLoad01 * 0.18 +
    observation.sleepPressure01 * 0.16
  ));
  assert.ok(Math.abs(frame.latent.recoveryNeed01 - expected) < 1e-12);
});

test('restores legacy interoceptive snapshots with derived precision diagnostics', () => {
  const estimator = new InteroceptiveStateEstimator();
  const legacy = {
    version: 1, ticks: 3, meanPredictionError01: 0.2, meanUncertainty01: 0.3,
    meanConfidence01: 0.7,
    prediction: { energy01: 0.7, thermal01: 0.2, load01: 0.3, capacity01: 0.8 },
    lastFrame: {
      latent: { energy01: 0.4, thermal01: 0.2, load01: 0.3, capacity01: 0.7, recoveryNeed01: 0.4 },
      predicted: { energy01: 0.6, thermal01: 0.2, load01: 0.2, capacity01: 0.8 },
      predictionError01: 0.2, uncertainty01: 0.3, salience01: 0.2,
      conflict01: 0.1, controlPressure01: 0.3, confidence01: 0.7, reason: ['legacy'],
    },
  };
  estimator.restore(legacy);
  const snapshot = estimator.snapshot();
  assert.equal(snapshot.ticks, 3);
  assert.ok(snapshot.lastFrame.precisionAllocation01);
  assert.equal(snapshot.lastFrame.attendedPredictionError01, 0.2);
});

test('does not invoke accessor-backed input fields', () => {
  let getterCalls = 0;
  const input = {
    thermal: 0.1, cognitiveLoad: 0.1, sleepPressure: 0.1, attentionBudget01: 0.5,
    get energy() { getterCalls += 1; return 0; },
  };
  const frame = allocator.allocate(input);
  assert.equal(getterCalls, 0);
  assert.equal(frame.urgency01.energy, 1);
  assert.equal(frame.budget01, 0.5);
});

test('fails closed when hostile proxy reflection throws', () => {
  const input = new Proxy({}, {
    getPrototypeOf() { throw new Error('blocked prototype trap'); },
  });
  assert.doesNotThrow(() => allocator.allocate(input));
  const frame = allocator.allocate(input);
  assert.equal(frame.budget01, 0);
  assert.equal(frame.dominantChannel, 'none');
  assert.ok(Object.values(frame.allocation01).every(value => value === 0));
});
\nconsole.log('WORKPASS_INTEROCEPTIVE_PRECISION_ALLOCATION=PASS');\n