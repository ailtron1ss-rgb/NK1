import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { P66InteroceptiveHomeostasis } from '../src/organism/cognition/P66InteroceptiveHomeostasis.ts';

const core = readFileSync(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const bodyStart = core.indexOf('const intero = this.p66InteroceptiveHomeostasis.observe({');
assert.notEqual(bodyStart, -1, 'body observation path must call canonical P66');
const bodyEnd = core.indexOf('});', bodyStart);
assert.notEqual(bodyEnd, -1, 'body observation call must remain syntactically bounded');
const bodyCall = core.slice(bodyStart, bodyEnd);
assert.ok(bodyCall.includes("source: 'body-telemetry'"), 'body telemetry must declare its provenance');
assert.ok(bodyCall.includes('sampleId: `${body.telemetry.source}:${body.telemetry.sampledAt}`'),
  'body telemetry ID must remain stable across replay of the same sensor sample');

const cognitiveStart = core.indexOf('const p66Homeostasis = this.p66InteroceptiveHomeostasis.observe({');
assert.notEqual(cognitiveStart, -1, 'cognitive cycle must call canonical P66');
const cognitiveEnd = core.indexOf('});', cognitiveStart);
assert.notEqual(cognitiveEnd, -1, 'cognitive observation call must remain syntactically bounded');
const cognitiveCall = core.slice(cognitiveStart, cognitiveEnd);
assert.ok(cognitiveCall.includes("source: 'cognitive-cycle'"), 'cognitive cycle must declare a distinct provenance');
assert.ok(core.includes('emotionAppraisal.observeInteroception({ ...bodyTelemetry, homeostaticPressure01: p66Homeostasis.pressure01, at: cognitiveObservedAt, sampleId: `cycle:${state.tick + 1}` })'),
  'EmotionAppraisalEngine must receive the same cognitive-cycle sample identity as P66');
assert.ok(cognitiveCall.includes('sampleId: `cycle:${state.tick + 1}`'),
  'cognitive sample identity must be tied to the exact Core tick');

const regulation = new P66InteroceptiveHomeostasis();
const sensor = { source: 'android-termux', sampledAt: 1_000 };
const base = {
  tick: 1, at: sensor.sampledAt, energy01: .64, thermal01: .24, capacity01: .76, load01: .28,
  awake: true, uncertainty01: .2, predictionError01: .15, novelty01: .3,
  source: 'body-telemetry', sampleId: `${sensor.source}:${sensor.sampledAt}`,
};
regulation.observe(base);
regulation.observe({ ...base, at: 1_250 });
assert.equal(regulation.snapshot().cycles, 1, 'replayed body telemetry sample must not advance the P66 controller');
assert.equal(regulation.snapshot().duplicateObservations, 1);

regulation.observe({
  ...base, tick: 2, at: 2_000, source: 'cognitive-cycle', sampleId: 'cycle:2',
});
assert.equal(regulation.snapshot().cycles, 2, 'independent cognitive-cycle observation must still be admitted');
assert.equal(regulation.snapshot().bodyTelemetryObservations, 1);
assert.equal(regulation.snapshot().cognitiveObservations, 1);

const restored = new P66InteroceptiveHomeostasis();
restored.restore(regulation.snapshot());
restored.observe(base);
assert.equal(restored.snapshot().cycles, 2, 'restored P66 must retain the body sample replay window');
assert.equal(restored.snapshot().duplicateObservations, 2);

console.log('P66_CORE_OBSERVATION_PROVENANCE=PASS', JSON.stringify({
  cycles: restored.snapshot().cycles,
  bodyTelemetryObservations: restored.snapshot().bodyTelemetryObservations,
  cognitiveObservations: restored.snapshot().cognitiveObservations,
  duplicateObservations: restored.snapshot().duplicateObservations,
  lastMode: restored.snapshot().lastMode,
}));
