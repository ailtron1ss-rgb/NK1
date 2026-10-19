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
const restored=new P2702PersistentPersonalityDynamics();restored.restore(after);assert.deepEqual(restored.snapshot(),after);

const b=new NeuralExperienceBranch();
let s=defaultNeuralExperienceBranch();b.restore(s);
const d=b.beforeDecision({tick:1,input:new Array(64).fill(.15),baseUtilities:actions,predictionError01:.3,novelty01:.8,uncertainty01:.5,homeostasis01:.2,identityGap01:.2,goalPressure01:.7,reward01:.5,identityVector:new Array(24).fill(.3)});
b.commitAction('explore',actions);
b.afterOutcome({tick:1,action:'explore',reward01:.9,predictionError01:.1,verified01:1,nextInput:new Array(64).fill(.25),identityGap01:.15,goalPressure01:.7,identityVector:new Array(24).fill(.4)});
const snap=b.snapshot();
assert.equal(snap. version,25);
assert(snap.persistentPersonality.learningUpdates>0);
const b2=new NeuralExperienceBranch();b2.restore(snap);assert.deepEqual(b2.snapshot().persistentPersonality,snap.persistentPersonality);
console.log(JSON.stringify({pass:true,learningUpdates:snap.persistentPersonality.learningUpdates,drift01:snap.persistentPersonality.drift01,coherence01:snap.persistentPersonality.coherence01,identityContinuity01:snap.persistentPersonality.identityContinuity01}));
