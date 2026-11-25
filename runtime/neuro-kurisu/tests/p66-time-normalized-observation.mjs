import assert from 'node:assert/strict';
import { P66InteroceptiveHomeostasis } from '../src/organism/cognition/P66InteroceptiveHomeostasis.ts';

const stressed = {
  energy01: .24, thermal01: .72, capacity01: .34, load01: .82,
  awake: true, uncertainty01: .82, predictionError01: .78, novelty01: .2,
};
const sample = (engine, at, source, sampleId) => engine.observe({
  tick: Math.floor(at / 1000), at, ...stressed, source, sampleId,
});

const dense = new P66InteroceptiveHomeostasis();
const sparse = new P66InteroceptiveHomeostasis();
for (let at = 1_000; at <= 61_000; at += 1_000) sample(dense, at, 'cognitive-cycle', `c:${at}`);
for (let at = 1_000; at <= 61_000; at += 10_000) sample(sparse, at, 'cognitive-cycle', `c:${at}`);
const denseState = dense.snapshot();
const sparseState = sparse.snapshot();
assert.ok(Math.abs(denseState.meanStress01 - sparseState.meanStress01) < .035,
  `mean stress must depend on elapsed time, not observation count (${denseState.meanStress01} vs ${sparseState.meanStress01})`);
assert.ok(Math.abs(denseState.recoveryDebt01 - sparseState.recoveryDebt01) < .035,
  `recovery debt must depend on elapsed time, not observation count (${denseState.recoveryDebt01} vs ${sparseState.recoveryDebt01})`);

// Ten minutes of elapsed time must not be silently truncated to the old five-minute cap.
const longDense = new P66InteroceptiveHomeostasis();
const longSparse = new P66InteroceptiveHomeostasis();
for (let at = 1_000; at <= 601_000; at += 1_000) sample(longDense, at, 'cognitive-cycle', `long:${at}`);
sample(longSparse, 1_000, 'cognitive-cycle', 'long:1000');
sample(longSparse, 601_000, 'cognitive-cycle', 'long:601000');
const longDenseState = longDense.snapshot();
const longSparseState = longSparse.snapshot();
for (const key of ['meanError01', 'meanStress01', 'meanCapacity01', 'recoveryDebt01']) {
  assert.ok(Math.abs(longDenseState[key] - longSparseState[key]) < 1e-9,
    `ten-minute dense and sparse observation schedules must agree for ${key} (${longDenseState[key]} vs ${longSparseState[key]})`);
}

const dedup = new P66InteroceptiveHomeostasis();
sample(dedup, 1_000, 'body-telemetry', 'sensor:1000');
const afterFirst = dedup.snapshot();
sample(dedup, 1_500, 'body-telemetry', 'sensor:1000');
assert.equal(dedup.snapshot().cycles, afterFirst.cycles, 'replayed body sample must not advance P66 state');
assert.equal(dedup.snapshot().duplicateObservations, 1);
assert.equal(dedup.snapshot().bodyTelemetryObservations, 1);

const beforeRollback = dedup.snapshot();
sample(dedup, 900, 'cognitive-cycle', 'c:900');
const afterRollback = dedup.snapshot();
assert.equal(afterRollback.lastAt, beforeRollback.lastAt, 'out-of-order observation must not rewind P66 time');
assert.equal(afterRollback.cycles, beforeRollback.cycles, 'out-of-order observation must not enter regulation averages');
assert.equal(afterRollback.outOfOrderObservations, 1);
const beforeFuture = dedup.snapshot();
sample(dedup, Date.now() + 60_000, 'cognitive-cycle', 'future:clock-skew');
assert.equal(dedup.snapshot().cycles, beforeFuture.cycles, 'far-future timestamp must not poison persisted homeostasis');
assert.equal(dedup.snapshot().invalidTimestampObservations, 1);

// Invalid sensor values must not be interpreted as extreme physiology.
const invalidSensor = new P66InteroceptiveHomeostasis();
const validSensor = {
  tick: 1, at: 1_000, energy01: .7, thermal01: .2, capacity01: .8, load01: .2,
  awake: true, uncertainty01: .1, predictionError01: .1, novelty01: .2,
  source: 'body-telemetry', sampleId: 'sensor:1000',
};
invalidSensor.observe({ ...validSensor, energy01: Number.NaN });
assert.equal(invalidSensor.snapshot().cycles, 0, 'NaN energy must not be interpreted as empty energy');
assert.equal(invalidSensor.snapshot().invalidValueObservations, 1);
invalidSensor.observe({ ...validSensor, capacity01: Number.POSITIVE_INFINITY });
assert.equal(invalidSensor.snapshot().cycles, 0, 'infinite capacity must be rejected before regulation');
assert.equal(invalidSensor.snapshot().invalidValueObservations, 2);
invalidSensor.observe({ ...validSensor, tick: 1.5 });
assert.equal(invalidSensor.snapshot().cycles, 0, 'fractional organism ticks must not enter P66 state');
assert.equal(invalidSensor.snapshot().invalidValueObservations, 3);
invalidSensor.observe(validSensor);
assert.equal(invalidSensor.snapshot().cycles, 1, 'a valid observation must be accepted after rejected malformed input');

const stable = new P66InteroceptiveHomeostasis();
const calm = { ...stressed, energy01: .68, thermal01: .2, capacity01: .72, load01: .2, uncertainty01: .1, predictionError01: .1 };
for (let at = 1_000; at <= 11_000; at += 1_000) stable.observe({ tick: at / 1000, at, ...calm, awake: true, source: 'cognitive-cycle' });
assert.equal(stable.snapshot().stableDurationMs, 10_000,
  'the first stable observation establishes a baseline; only the ten elapsed one-second intervals count');
stable.observe({ tick: 611, at: 611_000, ...calm, awake: true, source: 'cognitive-cycle' });
assert.equal(stable.snapshot().stableDurationMs, 0,
  'a ten-minute gap without observations cannot be treated as continuously confirmed stability');

const legacy = new P66InteroceptiveHomeostasis();
const old = { ...afterFirst };
delete old.duplicateObservations;
delete old.outOfOrderObservations;
delete old.bodyTelemetryObservations;
delete old.cognitiveObservations;
delete old.stableDurationMs;
delete old.invalidTimestampObservations;
legacy.restore(old);
assert.equal(legacy.snapshot().duplicateObservations, 0, 'legacy snapshots must default new cadence diagnostics safely');
assert.equal(legacy.snapshot().invalidValueObservations, 0, 'legacy snapshots must default invalid-value diagnostics safely');

// Persisted regulator data is a trust boundary: malformed ratios/counters/modes
// must not leak NaN, arbitrary keys or invalid mode names into live control.
const corruptRestore = new P66InteroceptiveHomeostasis();
corruptRestore.restore({
  ...afterFirst,
  meanError01: Number.NaN,
  meanStress01: 'broken',
  lastMode: 'unrecognized',
  modeCounts: { engage: -7, recover: Number.NaN, injectedMode: 99 },
  setpoints: { energy01: Number.NaN, thermal01: 'broken', capacity01: 4, load01: -2, awake01: 1 },
});
const corrupt = corruptRestore.snapshot();
assert.equal(corrupt.meanError01, .3, 'non-finite persisted mean must restore to a safe default');
assert.equal(corrupt.meanStress01, .25, 'non-numeric persisted mean must restore to a safe default');
assert.equal(corrupt.lastMode, 'balance', 'unknown persisted mode must restore to a safe mode');
assert.deepEqual(Object.keys(corrupt.modeCounts).sort(), ['balance','engage','explore','protect','recover']);
assert.equal(corrupt.modeCounts.engage, 0);
assert.equal(corrupt.modeCounts.recover, 0);
assert.equal(corrupt.setpoints.energy01, .68);
assert.equal(corrupt.setpoints.thermal01, .25);
assert.equal(corrupt.setpoints.capacity01, 1, 'finite setpoint ratios are bounded');
assert.equal(corrupt.setpoints.load01, 0, 'finite setpoint ratios are bounded');
assert.ok(Object.values(corrupt).every(value => typeof value !== 'number' || Number.isFinite(value)));

const hostileRestore = new P66InteroceptiveHomeostasis();
const hostileSnapshot = {};
Object.defineProperty(hostileSnapshot, 'lastAt', { enumerable: true, get() { throw new Error('getter must not execute'); } });
hostileRestore.restore(hostileSnapshot);
assert.equal(hostileRestore.snapshot().lastAt, 0, 'accessor-bearing persisted state must fail closed without invoking getters');

const futureRestore = new P66InteroceptiveHomeostasis();
futureRestore.restore({ ...afterFirst, lastAt: Date.now() + 60_000 });
assert.equal(futureRestore.snapshot().lastAt, 0,
  'a far-future restored timestamp must fail closed to the safe baseline');
assert.equal(futureRestore.snapshot().cycles, 0,
  'invalid restored clock must not retain stale temporal EMA history');
assert.equal(futureRestore.snapshot().history.length, 0,
  'invalid restored clock must clear stale sample IDs from the replay window');
assert.equal(futureRestore.snapshot().stableDurationMs, 0,
  'invalid restored clock must not retain continuity evidence across an uncertain timebase');
futureRestore.observe({ tick: 1, at: Date.now(), ...calm, awake: true, source: 'cognitive-cycle' });
assert.equal(futureRestore.snapshot().cycles, 1,
  'the next valid observation must establish a fresh temporal baseline');

console.log('P66_TIME_NORMALIZED_OBSERVATION=PASS', JSON.stringify({
  denseCycles: denseState.cycles, sparseCycles: sparseState.cycles,
  denseStress: denseState.meanStress01, sparseStress: sparseState.meanStress01,
  denseDebt: denseState.recoveryDebt01, sparseDebt: sparseState.recoveryDebt01,
  duplicateObservations: afterRollback.duplicateObservations,
  stableDurationMs: stable.snapshot().stableDurationMs,
  invalidTimestampObservations: dedup.snapshot().invalidTimestampObservations,
  longDense: {
    cycles: longDenseState.cycles,
    meanError01: longDenseState.meanError01,
    meanStress01: longDenseState.meanStress01,
    meanCapacity01: longDenseState.meanCapacity01,
    recoveryDebt01: longDenseState.recoveryDebt01,
  },
  longSparse: {
    cycles: longSparseState.cycles,
    meanError01: longSparseState.meanError01,
    meanStress01: longSparseState.meanStress01,
    meanCapacity01: longSparseState.meanCapacity01,
    recoveryDebt01: longSparseState.recoveryDebt01,
  },
  stableAfterGap: {
    stableCycles: stable.snapshot().stableCycles,
    stableDurationMs: stable.snapshot().stableDurationMs,
  },
  futureRestore: {
    cyclesAfterRecovery: futureRestore.snapshot().cycles,
    lastAt: futureRestore.snapshot().lastAt,
  },
}));
