import assert from 'node:assert/strict';
import { P2702PersistentPersonalityDynamics } from '../src/organism/cognition/P2702PersistentPersonalityDynamics.ts';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const p=new P2702PersistentPersonalityDynamics();
const before=p.snapshot();
let out=p.beforeDecision({tick:1,novelty01:.9,uncertainty01:.8,goalPressure01:.7,identityGap01:.2,reward01:.5,actionUtilities:actions,identityVector:new Array(24).fill(.2)});
assert(out.actionBias.explore>0,'exploration should receive curiosity-driven personality bias');
p.afterOutcome({reward01:.95,verified01:1,predictionError01:.05,identityGap01:.1,action:'explore',identityVector:new Array(24).fill(.4)});
const after=p.snapshot();
assert(after.learningUpdates>before.learningUpdates);
assert(after.autobiographicalStrength01>before.autobiographicalStrength01);
assert(after.adaptiveValues.some((v,i)=>Math.abs(v-(before.adaptiveValues[i]??v))>1e-6));

const respondLearner = new P2702PersistentPersonalityDynamics();
const respondBefore = respondLearner.snapshot();
respondLearner.afterOutcome({ reward01: .95, verified01: 1, predictionError01: .05, identityGap01: .1, action: 'respond', identityVector: new Array(24).fill(.95) });
const respondAfter = respondLearner.snapshot();
const traitIndex = (state, name) => state.adaptiveNames.indexOf(name);
const valueIndex = (state, name) => state.valueNames.indexOf(name);
assert.ok(respondAfter.adaptiveValues[traitIndex(respondAfter, 'warmth')] > respondBefore.adaptiveValues[traitIndex(respondBefore, 'warmth')],
  'verified successful responses should train warmth, not whichever trait happens to be index zero');
assert.equal(respondAfter.adaptiveValues[traitIndex(respondAfter, 'sarcasm')], respondBefore.adaptiveValues[traitIndex(respondBefore, 'sarcasm')],
  'respond outcomes must not accidentally train sarcasm through enum-position coupling');
assert.ok(respondAfter.valueWeights[valueIndex(respondAfter, 'relationship')] > respondBefore.valueWeights[valueIndex(respondBefore, 'relationship')],
  'respond outcomes should provide targeted evidence about relationship value');
assert.equal(respondAfter.valueWeights[valueIndex(respondAfter, 'science')], respondBefore.valueWeights[valueIndex(respondBefore, 'science')],
  'a social response must not globally rewrite unrelated science value weights');
assert.ok(respondAfter.selfBeliefs[0] > respondBefore.selfBeliefs[0],
  'verified identity evidence should update the self belief anchor');
assert.ok(respondAfter.selfUncertainty[0] < respondBefore.selfUncertainty[0],
  'verified low-error evidence should reduce self uncertainty');

const exploreLearner = new P2702PersistentPersonalityDynamics();
const exploreBefore = exploreLearner.snapshot();
exploreLearner.afterOutcome({ reward01: .95, verified01: 1, predictionError01: .05, identityGap01: .1, action: 'explore' });
const exploreAfter = exploreLearner.snapshot();
assert.ok(exploreAfter.adaptiveValues[traitIndex(exploreAfter, 'playfulness')] > exploreBefore.adaptiveValues[traitIndex(exploreBefore, 'playfulness')],
  'successful exploration should train playfulness');
assert.equal(exploreAfter.adaptiveValues[traitIndex(exploreAfter, 'warmth')], exploreBefore.adaptiveValues[traitIndex(exploreBefore, 'warmth')],
  'exploration must not update the response-warmth trait');

const verifyLearner = new P2702PersistentPersonalityDynamics();
const verifyBefore = verifyLearner.snapshot();
verifyLearner.afterOutcome({ reward01: .95, verified01: 1, predictionError01: .05, identityGap01: .1, action: 'verify' });
const verifyAfter = verifyLearner.snapshot();
assert.ok(verifyAfter.adaptiveValues[traitIndex(verifyAfter, 'composure')] > verifyBefore.adaptiveValues[traitIndex(verifyBefore, 'composure')],
  'successful verification should train composure');
assert.ok(verifyAfter.valueWeights[valueIndex(verifyAfter, 'truth')] > verifyBefore.valueWeights[valueIndex(verifyBefore, 'truth')],
  'verified checks should reinforce truth-seeking value evidence');
assert.ok(verifyAfter.valueWeights[valueIndex(verifyAfter, 'science')] > verifyBefore.valueWeights[valueIndex(verifyBefore, 'science')],
  'verified checks should reinforce science value evidence');

const unverifiedLearner = new P2702PersistentPersonalityDynamics();
const unverifiedBefore = unverifiedLearner.snapshot();
unverifiedLearner.afterOutcome({ reward01: .95, verified01: 0, predictionError01: .05, identityGap01: .1, action: 'respond', identityVector: new Array(24).fill(.99) });
assert.equal(unverifiedLearner.snapshot().selfBeliefs[0], unverifiedBefore.selfBeliefs[0],
  'unverified latent identity hints must not rewrite autobiographical self-belief');
assert.ok(unverifiedLearner.snapshot().selfUncertainty[0] > unverifiedBefore.selfUncertainty[0],
  'unverified outcome should increase uncertainty');

const restored=new P2702PersistentPersonalityDynamics();restored.restore(after);assert.deepEqual(restored.snapshot(),after);

const corruptedRestore = new P2702PersistentPersonalityDynamics();
corruptedRestore.restore({
  tick: -4,
  experienceCount: -2,
  learningUpdates: 2.5,
  stability01: Number.NaN,
  coherence01: 4,
  identityContinuity01: -1,
  contradiction01: Number.POSITIVE_INFINITY,
  plasticity01: Number.NaN,
  drift01: -1,
  autobiographicalStrength01: Number.NaN,
  lastReward01: 3,
  relationshipTrust: { trusted: 0.8, malformed: Number.NaN, numericString: "0.7" },
  actionPreference: { respond: Number.NaN, explore: 0.9, unknownAction: 1 },
});
const restoredSafe = corruptedRestore.snapshot();
assert.equal(restoredSafe.tick, 0, 'restored tick must be a non-negative integer');
assert.equal(restoredSafe.experienceCount, 0, 'restored experience count must be a non-negative integer');
assert.equal(restoredSafe.learningUpdates, 2, 'restored update count must be floored and non-negative');
for (const metric of ['stability01', 'coherence01', 'identityContinuity01', 'contradiction01', 'plasticity01', 'drift01', 'autobiographicalStrength01', 'lastReward01']) {
  assert.ok(Number.isFinite(restoredSafe[metric]) && restoredSafe[metric] >= 0 && restoredSafe[metric] <= 1,
    'restored ' + metric + ' must be finite and bounded');
}
assert.deepEqual(restoredSafe.relationshipTrust, { trusted: 0.8 },
  'restore must discard non-finite and non-numeric relationship trust entries');
assert.equal(restoredSafe.actionPreference.respond, 0,
  'malformed action preferences must fall back to the canonical default');
assert.equal(restoredSafe.actionPreference.explore, 0.9,
  'finite action preferences must be retained');
assert.equal(Object.keys(restoredSafe.actionPreference).length, Object.keys(actions).length,
  'restore must not retain unknown action keys');

const b=new NeuralExperienceBranch();
let s=defaultNeuralExperienceBranch();b.restore(s);
const d=b.beforeDecision({tick:1,input:new Array(64).fill(.15),baseUtilities:actions,predictionError01:.3,novelty01:.8,uncertainty01:.5,homeostasis01:.2,identityGap01:.2,goalPressure01:.7,reward01:.5,identityVector:new Array(24).fill(.3)});
b.commitAction('explore',actions);
b.afterOutcome({tick:1,action:'explore',reward01:.9,predictionError01:.1,verified01:1,nextInput:new Array(64).fill(.25),identityGap01:.15,goalPressure01:.7,identityVector:new Array(24).fill(.4)});
const snap=b.snapshot();
assert.equal(snap.version,32,'NeuralExperienceBranch snapshot contract is version 32');
assert(snap.persistentPersonality.learningUpdates>0);
const b2=new NeuralExperienceBranch();b2.restore(snap);assert.deepEqual(b2.snapshot().persistentPersonality,snap.persistentPersonality);
console.log(JSON.stringify({pass:true,learningUpdates:snap.persistentPersonality.learningUpdates,drift01:snap.persistentPersonality.drift01,coherence01:snap.persistentPersonality.coherence01,identityContinuity01:snap.persistentPersonality.identityContinuity01}));
