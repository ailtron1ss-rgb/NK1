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
assert.ok(stable.snapshot().stableDurationMs >= 9_000, 'stable duration must accumulate wall-clock time, not just count cycles');

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

console.log('P66_TIME_NORMALIZED_OBSERVATION=PASS', JSON.stringify({
  denseCycles: denseState.cycles, sparseCycles: sparseState.cycles,
  denseStress: denseState.meanStress01, sparseStress: sparseState.meanStress01,
  denseDebt: denseState.recoveryDebt01, sparseDebt: sparseState.recoveryDebt01,
  duplicateObservations: afterRollback.duplicateObservations,
  stableDurationMs: stable.snapshot().stableDurationMs,
  invalidTimestampObservations: dedup.snapshot().invalidTimestampObservations,
}));
