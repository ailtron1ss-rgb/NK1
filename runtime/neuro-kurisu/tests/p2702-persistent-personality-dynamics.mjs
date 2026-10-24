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
assert.notEqual(after.selfBeliefs[0],before.selfBeliefs[0],
  'verified identity observations must refine the persistent self-belief anchor');
const playfulnessIndex=after.adaptiveNames.indexOf('playfulness');
const warmthIndex=after.adaptiveNames.indexOf('warmth');
assert.ok(Math.abs(after.adaptiveValues[playfulnessIndex]-before.adaptiveValues[playfulnessIndex])>1e-6,
  'explore outcomes should train playfulness, not an unrelated trait selected by array position');
assert.equal(after.adaptiveValues[warmthIndex],before.adaptiveValues[warmthIndex],
  'explore outcomes must not accidentally train warmth');
const scienceIndex=after.valueNames.indexOf('science');
const curiosityIndex=after.valueNames.indexOf('curiosity');
const truthIndex=after.valueNames.indexOf('truth');
assert.ok(after.valueWeights[scienceIndex]>before.valueWeights[scienceIndex]);
assert.ok(after.valueWeights[curiosityIndex]>before.valueWeights[curiosityIndex]);
assert.equal(after.valueWeights[truthIndex],before.valueWeights[truthIndex],
  'exploration reward must not indiscriminately change truth value weight');
const restored=new P2702PersistentPersonalityDynamics();restored.restore(after);assert.deepEqual(restored.snapshot(),after);

// Persisted data cannot rename the canonical dimensions, overwrite identity invariants, inject
// unknown actions, or make counters and vectors non-finite.
const hostile=new P2702PersistentPersonalityDynamics();
hostile.restore({
  version:99,tick:-10,experienceCount:NaN,learningUpdates:-4,
  invariantNames:['forged'],invariantValues:[0],
  adaptiveNames:['forged'],adaptiveValues:[NaN,7],
  valueNames:['forged'],valueWeights:[-4,3],
  relationshipTrust:{trusted:4,'bad\\nid':0.2,broken:Infinity,constructor:0.8},
  selfBeliefs:[NaN,2],selfUncertainty:[0,Infinity],tensionState:[-9],
  actionPreference:{explore:99,verify:-99,respond:NaN,unknown:1}
});
const safe=hostile.snapshot();
assert.deepEqual(safe.invariantNames,before.invariantNames);
assert.deepEqual(safe.invariantValues,before.invariantValues);
assert.deepEqual(safe.adaptiveNames,before.adaptiveNames);
assert.equal(safe.adaptiveValues[0],before.adaptiveValues[0]);
assert.equal(safe.adaptiveValues[1],1);
assert.deepEqual(safe.valueNames,before.valueNames);
assert.equal(safe.valueWeights[0],0);
assert.equal(safe.valueWeights[1],1);
assert.equal(safe.tick,0);
assert.equal(safe.experienceCount,0);
assert.equal(safe.learningUpdates,0);
assert.equal(safe.relationshipTrust.trusted,1);
assert.equal(Object.hasOwn(safe.relationshipTrust,'bad\\nid'),false);
assert.equal(Object.hasOwn(safe.relationshipTrust,'constructor'),false);
assert.equal(safe.actionPreference.explore,0.5);
assert.equal(safe.actionPreference.verify,-0.5);
assert.equal(safe.actionPreference.respond,0);
assert.equal(Object.hasOwn(safe.actionPreference,'unknown'),false);
assert.equal(safe.selfBeliefs.length,before.selfBeliefs.length);
assert(safe.selfBeliefs.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
assert(safe.selfUncertainty.every(v=>Number.isFinite(v)&&v>=0.03&&v<=0.97));
assert.equal(safe.tensionState.length,before.tensionState.length);

// The signed action preference should distinguish a low-utility action from a neutral one.
const signed=new P2702PersistentPersonalityDynamics();
signed.beforeDecision({tick:1,novelty01:0.4,uncertainty01:0.4,goalPressure01:0.5,identityGap01:0.2,
  actionUtilities:{...actions,explore:0.2}});
assert.equal(signed.snapshot().actionPreference.explore,-0.3);
assert.equal(signed.snapshot().actionPreference.verify,0);

// Invalid runtime values are neutralized, and invalid actions do not mutate learned personality.
const guarded=new P2702PersistentPersonalityDynamics();
const guardedDecision=guarded.beforeDecision({
  tick:Infinity,novelty01:NaN,uncertainty01:Infinity,goalPressure01:-9,identityGap01:NaN,
  reward01:Infinity,actionUtilities:{...actions,explore:NaN},identityVector:[NaN],relationshipId:'bad\\nid'
});
for(const value of Object.values(guardedDecision.actionBias)) assert(Number.isFinite(value)&&value>=0&&value<=1);
assert(Number.isFinite(guarded.snapshot().tick));
const guardedBeforeInvalidOutcome=guarded.snapshot();
guarded.afterOutcome({action:'invented-action',reward01:1,verified01:1,predictionError01:0,identityGap01:0});
assert.deepEqual(guarded.snapshot(),guardedBeforeInvalidOutcome);

const b=new NeuralExperienceBranch();
let s=defaultNeuralExperienceBranch();b.restore(s);
const d=b.beforeDecision({tick:1,input:new Array(64).fill(.15),baseUtilities:actions,predictionError01:.3,novelty01:.8,uncertainty01:.5,homeostasis01:.2,identityGap01:.2,goalPressure01:.7,reward01:.5,identityVector:new Array(24).fill(.3)});
b.commitAction('explore',actions);
b.afterOutcome({tick:1,action:'explore',reward01:.9,predictionError01:.1,verified01:1,nextInput:new Array(64).fill(.25),identityGap01:.15,goalPressure01:.7,identityVector:new Array(24).fill(.4)});
const snap=b.snapshot();
assert.equal(snap.version,32);
assert(snap.persistentPersonality.learningUpdates>0);
const b2=new NeuralExperienceBranch();b2.restore(snap);assert.deepEqual(b2.snapshot().persistentPersonality,snap.persistentPersonality);
console.log(JSON.stringify({pass:true,learningUpdates:snap.persistentPersonality.learningUpdates,drift01:snap.persistentPersonality.drift01,coherence01:snap.persistentPersonality.coherence01,identityContinuity01:snap.persistentPersonality.identityContinuity01}));
