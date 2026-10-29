import assert from 'node:assert/strict';
import { P2702PersistentPersonalityDynamics, defaultP2702PersistentPersonality } from '../src/organism/cognition/P2702PersistentPersonalityDynamics.ts';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const p=new P2702PersistentPersonalityDynamics();
const before=p.snapshot();
let out=p.beforeDecision({tick:1,novelty01:.9,uncertainty01:.8,goalPressure01:.7,identityGap01:.2,reward01:.5,actionUtilities:actions,identityVector:new Array(24).fill(.2)});
assert(out.actionBias.explore>0,'exploration should receive curiosity-driven personality bias');
p.afterOutcome({tick:2,reward01:.95,verified01:1,predictionError01:.05,identityGap01:.1,action:'explore',identityVector:new Array(24).fill(.4),evidence:{verified:true,independent:true,source:'world-transition',evidenceRef:'world-transition:p2702-test-1'}});
const after=p.snapshot();
assert(after.learningUpdates>before.learningUpdates);
assert(after.verifiedLearningUpdates>before.verifiedLearningUpdates);
assert.equal(after.lastEvidenceGateReason,'verified-independent-outcome-bound');
assert(after.autobiographicalStrength01>before.autobiographicalStrength01);
assert(after.adaptiveValues.some((v,i)=>Math.abs(v-(before.adaptiveValues[i]??v))>1e-6));
const restored=new P2702PersistentPersonalityDynamics();restored.restore(after);assert.deepEqual(restored.snapshot(),after);

const rejected=new P2702PersistentPersonalityDynamics();
const rejectedBefore=rejected.snapshot();
rejected.afterOutcome({tick:1,reward01:.99,verified01:1,predictionError01:.01,identityGap01:.1,action:'explore',identityVector:new Array(24).fill(.9)});
const rejectedAfter=rejected.snapshot();
assert.deepEqual(rejectedAfter.adaptiveValues,rejectedBefore.adaptiveValues,'reward without provenance must not rewrite traits');
assert.deepEqual(rejectedAfter.valueWeights,rejectedBefore.valueWeights,'reward without provenance must not rewrite stable values');
assert.equal(rejectedAfter.verifiedLearningUpdates,0);
assert.equal(rejectedAfter.rejectedLearningUpdates,1);
assert.equal(rejectedAfter.lastEvidenceGateReason,'missing-provenance');

const badSource=new P2702PersistentPersonalityDynamics();
const badSourceBefore=badSource.snapshot();
badSource.afterOutcome({tick:1,reward01:.99,verified01:1,predictionError01:.01,identityGap01:.1,action:'explore',evidence:{verified:true,independent:true,source:'internal',evidenceRef:'internal:pretend-external'}});
assert.deepEqual(badSource.snapshot().adaptiveValues,badSourceBefore.adaptiveValues,'internal evidence cannot authorize stable personality learning');

const canonicalDefaults=defaultP2702PersistentPersonality();
const tampered=new P2702PersistentPersonalityDynamics();
tampered.restore({...after,invariantNames:['responsibility'],invariantValues:[0],adaptiveValues:[2,...after.adaptiveValues.slice(1)]});
assert.deepEqual(tampered.snapshot().invariantNames,canonicalDefaults.invariantNames,'snapshot cannot replace canonical invariant names');
assert.deepEqual(tampered.snapshot().invariantValues,canonicalDefaults.invariantValues,'snapshot cannot replace canonical invariant values');
assert.equal(tampered.snapshot().adaptiveValues[0],canonicalDefaults.adaptiveValues[0],'out-of-range trait falls back to canonical default');
let getterCalls=0;const hostile={...after};
Object.defineProperty(hostile,'tick',{enumerable:true,get(){getterCalls++;return 999;}});
const safeRestore=new P2702PersistentPersonalityDynamics();safeRestore.restore(hostile);
assert.equal(getterCalls,0,'restore must not invoke persisted getters');
assert.equal(safeRestore.snapshot().tick,0,'hostile restore must fail closed to defaults');

const b=new NeuralExperienceBranch();
let s=defaultNeuralExperienceBranch();b.restore(s);
const d=b.beforeDecision({tick:1,input:new Array(64).fill(.15),baseUtilities:actions,predictionError01:.3,novelty01:.8,uncertainty01:.5,homeostasis01:.2,identityGap01:.2,goalPressure01:.7,reward01:.5,identityVector:new Array(24).fill(.3)});
b.commitAction('explore',actions);
b.afterOutcome({tick:1,action:'explore',reward01:.9,predictionError01:.1,verified01:1,nextInput:new Array(64).fill(.25),identityGap01:.15,goalPressure01:.7,identityVector:new Array(24).fill(.4)});
const snap=b.snapshot();
assert.equal(snap.version,32);
assert(snap.persistentPersonality.learningUpdates>0);
assert.equal(snap.persistentPersonality.verifiedLearningUpdates,0,'no evidence is supplied by this wrapper call, so stable personality learning stays blocked');
const b2=new NeuralExperienceBranch();b2.restore(snap);assert.deepEqual(b2.snapshot().persistentPersonality,snap.persistentPersonality);
console.log(JSON.stringify({pass:true,learningUpdates:snap.persistentPersonality.learningUpdates,drift01:snap.persistentPersonality.drift01,coherence01:snap.persistentPersonality.coherence01,identityContinuity01:snap.persistentPersonality.identityContinuity01}));
