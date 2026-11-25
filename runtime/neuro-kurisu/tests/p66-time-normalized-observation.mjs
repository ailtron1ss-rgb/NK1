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
