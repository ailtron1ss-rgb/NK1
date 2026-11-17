import assert from 'node:assert/strict';
import { OpenAICompatibleLocalChatProvider } from '../src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts';
import { CognitiveToNeuralBridge } from '../src/organism/cognition/CognitiveToNeuralBridge.ts';

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
assert.equal(kwargs.nk1_motivation01,.8);
assert.equal(kwargs.nk1_uncertainty01,.35);
assert.equal(kwargs.nk1_budget_remaining01,.7);
assert.equal(kwargs.nk1_neural_snapshot_available,true);
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

const malformedResponse = await enabledProvider.generate({
  ...baseRequest,
  cognitiveControl: { ...profile, featureKeys: [] },
});
assert.equal(malformedResponse.text,'local provider response');
assert.equal(Object.hasOwn(payloads[2],'chat_template_kwargs'),false,
  'malformed control schemas must be dropped rather than forwarded to the template');
assert.equal(Object.hasOwn(malformedResponse,'providerControlReceipt'),false);


console.log('LOCAL_CHAT_COGNITIVE_CONTROL_TEMPLATE_PASS');
