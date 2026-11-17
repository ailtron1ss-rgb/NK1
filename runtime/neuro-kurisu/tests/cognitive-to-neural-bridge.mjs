import assert from 'node:assert/strict';
import { CognitiveToNeuralBridge, applyCognitiveNeuralControl } from '../src/organism/cognition/CognitiveToNeuralBridge.ts';

const bridge = new CognitiveToNeuralBridge();
const neural = {
  version: 1, tick: 16,
  predictionError01: .3, plasticity01: .4, neuromodulation01: .5, sparseActivity01: .6,
  recurrentCoherence01: .7, neuralConfidence01: .8, modelAgreement01: .9,
  counterfactualDivergence01: .25, goalField01: .35, actionEntropy01: .45,
  allostatic: { drive01: .11, arousal01: .12, exploration01: .13, preservation01: .14, reflection01: .15, socialApproach01: .16 },
  selfModel: { agency01: .17, continuity01: .18, growthReadiness01: .19, identityConflict01: .2 },
  goalAuthorship: { ownership01: .21, commitment01: .22, revisionPressure01: .23 },
};
const input = {
  tick: 17, action: 'verify', mode: 'deep', motivation01: .8, uncertainty01: .4,
  urgency01: .6, budgetRemaining01: .3, attention01: .7, neural,
};
const before = structuredClone(input);
const profile = bridge.project(input);

assert.equal(profile.version, 2);
assert.equal(profile.tick, 17);
assert.equal(profile.action, 'verify');
assert.equal(profile.mode, 'deep');
assert.equal(profile.adapterHint, 'deep');
assert.equal(profile.neuralSnapshotAvailable, true);
assert.equal(profile.neuralSnapshotTick, 16);
assert.equal(profile.neuralSnapshotAgeTicks, 1);
assert.equal(profile.featureKeys.length, 43);
assert.equal(profile.featureVector01.length, 43);
assert.deepEqual(profile.featureVector01, [
  0,0,1,0,0,0,0,
  .8,.4,.6,.3,.7,
  .3,.4,.5,.6,.7,.8,.9,.25,.35,.45,
  .11,.12,.13,.14,.15,.16,
  .17,.18,.19,.2,
  .21,.22,.23,
  .875,
  0,0,0,1,0,0,0,
]);
assert.ok(profile.featureVector01.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
assert.equal(profile.maxTokens, 416);
assert.equal(profile.temperature, .62);
assert.ok(Object.values(profile.steeringIntent01).every(value => value >= 0 && value <= .15));
assert.deepEqual(profile.controlsConfigured, {
  samplingParameters: true, adapterSelection: false, activationSteering: false, residualBlock: false,
});
assert.deepEqual(input, before, 'projection must not mutate organism or neural state');
assert.deepEqual(bridge.project(input), profile, 'projection must be deterministic');

const malformed = bridge.project({
  tick: -1, action: 'not-an-action', mode: 'future-mode',
  motivation01: Number.NaN, uncertainty01: Number.POSITIVE_INFINITY,
  urgency01: -4, budgetRemaining01: 4, attention01: undefined,
});
assert.equal(malformed.tick, 0);
assert.equal(malformed.action, 'none');
assert.equal(malformed.mode, 'shallow');
assert.equal(malformed.adapterHint, 'balanced');
assert.equal(malformed.neuralSnapshotAvailable, false);
assert.deepEqual(malformed.featureVector01.slice(7, 12), [0,.5,0,1,.5]);
assert.ok(malformed.featureVector01.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
assert.ok(malformed.temperature >= .2 && malformed.temperature <= .85);

const signal = new AbortController().signal;
const contextLedger = { owner:'LanguageOrgan', totalInputChars:12 };
const request = { system:'system', user:'user', temperature:.7, maxTokens:512, signal, contextLedger };
const applied = applyCognitiveNeuralControl(request, profile);
assert.equal(applied.temperature, .62);
assert.equal(applied.maxTokens, 416);
assert.equal(applied.cognitiveControl.tick, 17);
assert.equal(applied.system, 'system');
assert.equal(applied.user, 'user');
assert.equal(applied.signal, signal);
assert.equal(applied.contextLedger, contextLedger);
assert.notEqual(applied.cognitiveControl, profile, 'provider metadata must not alias mutable profile state');

const sleep = bridge.project({ mode:'sleep', budgetRemaining01:0, uncertainty01:1, neural });
assert.equal(sleep.adapterHint, 'conservative');
assert.equal(sleep.maxTokens, 96);
assert.ok(sleep.temperature >= .2 && sleep.temperature <= .85);
assert.ok(sleep.steeringIntent01.caution01 <= .15);

const stale = bridge.project({ tick: 99, mode:'shallow', neural });
assert.equal(stale.neuralSnapshotAvailable, false, 'future neural snapshot must be rejected');
assert.equal(stale.neuralSnapshotAgeTicks, null);

const incompleteNeural = {
  ...neural,
  allostatic: { ...neural.allostatic, arousal01: undefined },
};
const incompleteSnapshot = bridge.project({ tick: 17, neural: incompleteNeural });
assert.equal(incompleteSnapshot.neuralSnapshotAvailable, false,
  'a partially malformed B365 snapshot must be rejected as a whole, not filled with neutral-looking values');
assert.equal(incompleteSnapshot.neuralSource, 'unavailable');
assert.ok(incompleteSnapshot.featureVector01.slice(12, 35).every(value => value === .5));

console.log('COGNITIVE_TO_NEURAL_BRIDGE_V2_PASS');
