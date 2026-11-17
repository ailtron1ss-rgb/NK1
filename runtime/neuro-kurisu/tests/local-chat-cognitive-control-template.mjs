import assert from 'node:assert/strict';
import { OpenAICompatibleLocalChatProvider } from '../src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts';
import { CognitiveToNeuralBridge, isValidCognitiveNeuralControlProfile } from '../src/organism/cognition/CognitiveToNeuralBridge.ts';

const profile = new CognitiveToNeuralBridge().project({
  tick: 24,
  action: 'verify',
  mode: 'deep',
  motivation01: .8,
  uncertainty01: .35,
  urgency01: .6,
  budgetRemaining01: .7,
  attention01: .75,
  neural: {
    version: 14,
    tick: 23,
    predictionError01: .2,
    plasticity01: .4,
    neuromodulation01: .6,
    sparseActivity01: .5,
    recurrentCoherence01: .8,
    neuralConfidence01: .85,
    modelAgreement01: .9,
    counterfactualDivergence01: .1,
    goalField01: .7,
    actionEntropy01: .3,
    allostatic: { drive01: .6, arousal01: .5, exploration01: .7, preservation01: .2, reflection01: .4, socialApproach01: .3 },
    selfModel: { agency01: .8, continuity01: .9, growthReadiness01: .7, identityConflict01: .1 },
    goalAuthorship: { ownership01: .8, commitment01: .75, revisionPressure01: .2 },
  },
});

const payloads = [];
const fetchImpl = async (_url, init) => {
  payloads.push(JSON.parse(init.body));
  return new Response(JSON.stringify({
    model: 'fake-llama-template',
    choices: [{ message: { content: 'local provider response' } }],
  }), { status:200, headers:{'content-type':'application/json'} });
};

assert.equal(isValidCognitiveNeuralControlProfile(profile), true,
  'the complete B365-aware profile must satisfy the canonical hand-off validator');

const baseRequest = {
  system:'system prompt',
  user:'user prompt',
  temperature:profile.temperature,
  maxTokens:profile.maxTokens,
  cognitiveControl:profile,
};

const defaultProvider = new OpenAICompatibleLocalChatProvider({
  baseUrl:'http://127.0.0.1:1234/v1',
  fetchImpl,
});
const defaultResponse = await defaultProvider.generate(baseRequest);
assert.equal(defaultResponse.text,'local provider response');
assert.equal(Object.hasOwn(payloads[0],'chat_template_kwargs'),false,
  'unknown Jinja controls must remain disabled by default');
assert.equal(Object.hasOwn(defaultResponse,'providerControlReceipt'),false);

const enabledProvider = new OpenAICompatibleLocalChatProvider({
  baseUrl:'http://127.0.0.1:1234/v1',
  enableCognitiveTemplateControls:true,
  fetchImpl,
});
const enabledResponse = await enabledProvider.generate(baseRequest);
const kwargs = payloads[1].chat_template_kwargs;
assert.ok(kwargs && typeof kwargs === 'object');
assert.equal(kwargs.nk1_control_version,2);
assert.equal(kwargs.nk1_feature_schema,'nk1-cognitive-neural-43-v2');
assert.equal(kwargs.nk1_tick,24);
assert.equal(kwargs.nk1_action,'verify');
assert.equal(kwargs.nk1_mode,'deep');
assert.equal(kwargs.nk1_adapter_hint,'deep');
assert.equal(kwargs.nk1_feature_keys.length,43);
assert.deepEqual(kwargs.nk1_feature_vector01,profile.featureVector01);
assert.equal(kwargs.nk1_motivation01,.8);
assert.equal(kwargs.nk1_uncertainty01,.35);
assert.equal(kwargs.nk1_budget_remaining01,.7);
assert.equal(kwargs.nk1_neural_snapshot_available,true);
assert.equal(kwargs.nk1_neural_snapshot_version,14);
assert.ok(kwargs.nk1_neural_snapshot_freshness01>=0 && kwargs.nk1_neural_snapshot_freshness01<=1);
assert.ok(kwargs.nk1_steering_caution01>=0 && kwargs.nk1_steering_caution01<=.15);
assert.ok(Object.values(kwargs).every(value => typeof value !== 'number' || Number.isFinite(value)));
assert.deepEqual(enabledResponse.providerControlReceipt,{
  provider:'llama.cpp',
  templateKwargsSent:true,
  featureSchema:'nk1-cognitive-neural-43-v2',
});
assert.equal(payloads[1].temperature,profile.temperature);
assert.equal(payloads[1].max_tokens,profile.maxTokens);

// A missing/invalid B365 snapshot must be explicit and still produce a valid,
// conservative hand-off instead of failing the whole local language request.
const unavailableProfile = new CognitiveToNeuralBridge().project({
  tick:25, action:'reflect', mode:'shallow', motivation01:.4,
});
assert.equal(unavailableProfile.neuralSnapshotAvailable,false);
assert.equal(unavailableProfile.neuralSnapshotVersion,null);
assert.equal(unavailableProfile.neuralSnapshotTick,null);
assert.equal(unavailableProfile.neuralSnapshotAgeTicks,null);
assert.ok(unavailableProfile.featureVector01.slice(12,35).every(value=>value===.5));
assert.equal(isValidCognitiveNeuralControlProfile(unavailableProfile),true);
const unavailableResponse = await enabledProvider.generate({
  ...baseRequest, cognitiveControl:unavailableProfile,
});
const unavailableKwargs = payloads[2].chat_template_kwargs;
assert.equal(unavailableResponse.text,'local provider response');
assert.equal(unavailableKwargs.nk1_neural_snapshot_available,false);
assert.equal(unavailableKwargs.nk1_neural_snapshot_version,null);
assert.equal(unavailableKwargs.nk1_neural_snapshot_freshness01,0);
assert.ok(unavailableKwargs.nk1_feature_vector01.slice(12,35).every(value=>value===.5));

const invalidProfiles = [
  { ...profile, featureKeys: [] },
  { ...profile, action: 'untrusted-action' },
  { ...profile, featureVector01: profile.featureVector01.map((value,index)=>index===0?Number.NaN:value) },
  { ...profile, steeringIntent01: { ...profile.steeringIntent01, caution01: .9 } },
  { ...profile, neuralSnapshotAvailable: true, neuralSnapshotTick: 999, neuralSnapshotAgeTicks: null },
  { ...profile, temperature: 1.4 },
  { ...profile, controlsConfigured: { ...profile.controlsConfigured, activationSteering: true } },
  { ...profile, action: 'reflect' },
  { ...profile, mode: 'retrieve' },
  { ...profile, adapterHint: 'fast' },
  { ...profile, featureVector01: profile.featureVector01.map((value,index)=>index===0?1:index===2?0:value) },
  { ...profile, featureVector01: profile.featureVector01.map((value,index)=>index===39?0:index===38?1:value) },
  { ...profile, featureVector01: profile.featureVector01.map((value,index)=>index === 35 ? 0.5 : value) },
  { ...profile, neuralSnapshotAgeTicks: 2 },
  { ...profile, neuralSnapshotVersion: null },
  { ...profile, neuralSource: 'unavailable' },
  { ...profile, maxTokens: 97 },
  { ...profile, featureVector01: profile.featureVector01.map((value,index)=>index === 22 ? -0.1 : value) },

];
for (const invalidProfile of invalidProfiles) {
  const malformedResponse = await enabledProvider.generate({ ...baseRequest, cognitiveControl: invalidProfile });
  assert.equal(malformedResponse.text,'local provider response');
  assert.equal(Object.hasOwn(payloads[payloads.length-1],'chat_template_kwargs'),false,
    'malformed control profiles must be dropped rather than forwarded to the template');
  assert.equal(Object.hasOwn(malformedResponse,'providerControlReceipt'),false);
}


console.log('LOCAL_CHAT_COGNITIVE_CONTROL_TEMPLATE_PASS');
