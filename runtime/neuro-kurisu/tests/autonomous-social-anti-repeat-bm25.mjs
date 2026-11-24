import assert from 'node:assert/strict';
import { AutonomousSocialInitiativeEngine } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';

const hour = 60 * 60 * 1000;
const start = 1_800_000_000_000;
const runtimeInput = (at, topics, novelty01 = .55) => ({
  at,
  externalInput: false,
  socialNeed01: .92,
  relationship01: .42,
  energy01: .9,
  identity01: .96,
  novelty01,
  topics,
  quietPeriodMs: 0,
  cooldownMs: 0,
  startupGraceMs: 0,
});

function deliver(engine, at, topic, message) {
  const planned = engine.cycle(runtimeInput(at, [{
    topic, source: 'reflection', salience01: .92, freshness01: .86,
    interestFit01: .72, affectFit01: .65,
  }]));
  assert.ok(planned.initiative, `expected an initiative for ${topic}`);
  assert.equal(engine.stageMessage(planned.initiative.id, message, at + 1), true);
  assert.equal(engine.acknowledge(planned.initiative.id, at + 2), true);
}

const engine = new AutonomousSocialInitiativeEngine();
const unrelated = [
  ['Acoustic embodiment calibration under changing latency budgets', 'We examined acoustic embodiment calibration under several latency budgets.'],
  ['Tactile sensor grounding across uncertain physical surfaces', 'We explored tactile sensor grounding when physical surfaces were uncertain.'],
  ['Visual scene segmentation for moving objects and depth', 'We compared visual scene segmentation for moving objects and depth.'],
  ['Speech interruption recovery during mixed language turns', 'We reviewed speech interruption recovery during mixed language turns.'],
  ['Motor prediction error in constrained device interactions', 'We considered motor prediction error during constrained device interactions.'],
  ['Temporal perception drift in long-running camera sessions', 'We investigated temporal perception drift in camera sessions.'],
  ['Affective appraisal calibration for ambiguous social cues', 'We discussed affective appraisal calibration for ambiguous social cues.'],
  ['Local inference scheduling with thermal resource limits', 'We examined local inference scheduling under thermal resource limits.'],
  ['Causal world-model correction after failed predictions', 'We studied causal world-model correction after failed predictions.'],
  ['Multimodal attention routing under competing sensory events', 'We analyzed multimodal attention routing under competing sensory events.'],
  ['Autobiographical continuity across interrupted sessions', 'We reviewed autobiographical continuity across interrupted sessions.'],
  ['Ethical action approval under uncertain external evidence', 'We considered ethical action approval under uncertain external evidence.'],
];
let at = start;
for (const [topic, message] of unrelated) {
  deliver(engine, at, topic, message);
  at += hour;
}

const repeatedHistory = [
  ['Neural memory replay stability under sparse checkpoint pressure', 'We revisited neural memory replay stability under sparse checkpoint pressure.'],
  ['Neural memory replay transfer across new task families', 'We revisited neural memory replay transfer across new task families.'],
  ['Neural memory replay credit assignment during delayed feedback', 'We revisited neural memory replay credit assignment during delayed feedback.'],
  ['Neural memory replay consolidation with counterfactual traces', 'We revisited neural memory replay consolidation with counterfactual traces.'],
];
for (const [topic, message] of repeatedHistory) {
  deliver(engine, at, topic, message);
  at += hour;
}

const repeatedCandidate = 'A closer look at neural memory replay for counterfactual transfer and delayed credit';
const freshCandidate = 'Zonal sensory embodiment calibration for multimodal timing and perception';
const selected = engine.cycle(runtimeInput(at, [
  { topic: repeatedCandidate, source: 'reflection', salience01: .92, freshness01: .86, interestFit01: .72, affectFit01: .65 },
  { topic: freshCandidate, source: 'reflection', salience01: .92, freshness01: .86, interestFit01: .72, affectFit01: .65 },
], 1));
assert.equal(selected.initiative?.topic, freshCandidate,
  'a strongly repeated theme in delivered messages should lose to a fresh candidate without being globally banned');

const noDeliveryHistory = new AutonomousSocialInitiativeEngine();
const noHistorySelection = noDeliveryHistory.cycle(runtimeInput(start, [
  { topic: repeatedCandidate, source: 'reflection', salience01: .92, freshness01: .86, interestFit01: .72, affectFit01: .65 },
  { topic: freshCandidate, source: 'reflection', salience01: .92, freshness01: .86, interestFit01: .72, affectFit01: .65 },
], 0));
assert.equal(noHistorySelection.initiative?.topic, repeatedCandidate,
  'the repetition penalty must be derived from acknowledged deliveries, not candidate text alone');

console.log('AUTONOMOUS_SOCIAL_ANTI_REPEAT_BM25=PASS');
