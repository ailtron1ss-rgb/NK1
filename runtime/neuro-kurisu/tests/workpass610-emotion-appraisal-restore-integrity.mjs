import assert from 'node:assert/strict';
import { EmotionAppraisalEngine, defaultEmotionAppraisalState } from '../src/organism/system/EmotionAppraisalEngine.ts';

const source=new EmotionAppraisalEngine();
source.observeInteroception({energy01:.31,thermal01:.72,capacity01:.44,load01:.68,homeostaticPressure01:.63});
const episode=source.appraise({tick:17,at:17001,novelty01:.81,uncertainty01:.52,predictionError01:.24,homeostaticPressure01:.31,goalPressure01:.7,goalCongruence01:.73,controllability01:.66,success01:.71});
source.inferFeeling(episode,{energy01:.31,cognitiveLoad01:.68,uncertainty01:.52,selfFocus01:.77});
for(let i=0;i<4;i++) source.recordOutcome({action:'rest',success01:.82,surprise01:.14,regulationCost01:.2});
const valid=source.snapshot();

const restored=new EmotionAppraisalEngine();
restored.restore(valid);
assert.deepEqual(restored.snapshot(),valid,'valid v2 snapshots must round-trip without structural drift');

// Root accessors are rejected without invoking user code.
let rootGetterCalls=0;
const rootGetter=Object.defineProperty({},'version',{enumerable:true,get(){rootGetterCalls++;return 2;}});
const rootGetterRestore=new EmotionAppraisalEngine();
assert.doesNotThrow(()=>rootGetterRestore.restore(rootGetter));
assert.equal(rootGetterCalls,0);
assert.deepEqual(rootGetterRestore.snapshot(),defaultEmotionAppraisalState());

// Nested accessors are rejected without invoking user code; unaffected state survives.
let nestedGetterCalls=0;
const nestedGetter=Object.defineProperty({},'cycles',{enumerable:true,get(){nestedGetterCalls++;return 99;}});
const nestedSnapshot=structuredClone(valid);
nestedSnapshot.interoception=nestedGetter;
const nestedRestore=new EmotionAppraisalEngine();
nestedRestore.restore(nestedSnapshot);
assert.equal(nestedGetterCalls,0);
assert.deepEqual(nestedRestore.snapshot().interoception,defaultEmotionAppraisalState().interoception);
assert.deepEqual(nestedRestore.snapshot().history,valid.history);

// Inherited and hostile root records fail closed.
const inherited=Object.create({version:2,episodes:999});
const inheritedRestore=new EmotionAppraisalEngine();
assert.doesNotThrow(()=>inheritedRestore.restore(inherited));
assert.equal(inheritedRestore.snapshot().episodes,0);
const hostileRoot=new Proxy({}, {getPrototypeOf(){throw new Error('hostile getPrototypeOf');}});
assert.doesNotThrow(()=>new EmotionAppraisalEngine().restore(hostileRoot));
const revokedRoot=Proxy.revocable({},{}); revokedRoot.revoke();
assert.doesNotThrow(()=>new EmotionAppraisalEngine().restore(revokedRoot.proxy));

// Sparse and accessor-backed arrays are rejected without evaluating indices.
const sparseSnapshot=structuredClone(valid);
sparseSnapshot.history=new Array(2);
const sparseRestore=new EmotionAppraisalEngine();
sparseRestore.restore(sparseSnapshot);
assert.equal(sparseRestore.snapshot().history.length,0);
let arrayGetterCalls=0;
const accessorArray=[valid.history[0]];
Object.defineProperty(accessorArray,'0',{enumerable:true,configurable:true,get(){arrayGetterCalls++;return valid.history[0];}});
const accessorSnapshot=structuredClone(valid);
accessorSnapshot.history=accessorArray;
const accessorRestore=new EmotionAppraisalEngine();
accessorRestore.restore(accessorSnapshot);
assert.equal(arrayGetterCalls,0);
assert.equal(accessorRestore.snapshot().history.length,0);
const revokedArray=Proxy.revocable([],{}); revokedArray.revoke();
const revokedArraySnapshot=structuredClone(valid);
revokedArraySnapshot.history=revokedArray.proxy;
assert.doesNotThrow(()=>new EmotionAppraisalEngine().restore(revokedArraySnapshot));

// Numeric counters cannot become negative/non-finite; finite normalized metrics are clamped.
const numericSnapshot=structuredClone(valid);
numericSnapshot.episodes=-3;
numericSnapshot.lastTick=Infinity;
numericSnapshot.lastAt=NaN;
numericSnapshot.meanStress01=Infinity;
numericSnapshot.meanValence01=4;
numericSnapshot.interoception.cycles=-2;
numericSnapshot.interoception.regulationPressure01=-4;
numericSnapshot.interoception.lastObserved.energy01=NaN;
const numericRestore=new EmotionAppraisalEngine();
numericRestore.restore(numericSnapshot);
const numeric=numericRestore.snapshot();
assert.equal(numeric.episodes,0);
assert.equal(numeric.lastTick,-1);
assert.equal(numeric.lastAt,0);
assert.equal(numeric.meanStress01,.2);
assert.equal(numeric.meanValence01,1);
assert.equal(numeric.interoception.cycles,0);
assert.equal(numeric.interoception.regulationPressure01,0);
assert.equal(numeric.interoception.lastObserved.energy01,.68);
for(const value of [numeric.meanArousal01,numeric.meanValence01,numeric.meanStress01,numeric.interoception.regulationPressure01,numeric.interoception.lastObserved.energy01]){
  assert.ok(Number.isFinite(value) && value>=0 && value<=1);
}

// Unknown labels/actions, duplicate identities and broken feeling links are not activated.
const invalidSnapshot=structuredClone(valid);
invalidSnapshot.history.unshift({...invalidSnapshot.history[0],label:'transcendent'});
invalidSnapshot.history.unshift({...invalidSnapshot.history[0],actionTendency:'launch_shell'});
invalidSnapshot.history.unshift({...invalidSnapshot.history[0],id:invalidSnapshot.history[0].id});
invalidSnapshot.feelings.unshift({...invalidSnapshot.feelings[0],causeEmotionId:'emo:missing'});
invalidSnapshot.outcomes={launch_shell:{attempts:99,meanSuccess01:1,meanSurprise01:0,meanBenefit01:1},rest:{attempts:4,meanSuccess01:.8,meanSurprise01:.2,meanBenefit01:.7}};
const invalidRestore=new EmotionAppraisalEngine();
invalidRestore.restore(invalidSnapshot);
assert.ok(invalidRestore.snapshot().history.every(row=>row.label!=='transcendent' && row.actionTendency!=='launch_shell'));
assert.equal(new Set(invalidRestore.snapshot().history.map(row=>row.id)).size,invalidRestore.snapshot().history.length);
assert.ok(invalidRestore.snapshot().feelings.every(row=>row.causeEmotionId===valid.history[0].id));
assert.deepEqual(Object.keys(invalidRestore.snapshot().outcomes),['rest']);

// Repeated restoration remains deterministic and history/calibration limits remain bounded.
const replayA=new EmotionAppraisalEngine(); replayA.restore(valid);
const replayB=new EmotionAppraisalEngine(); replayB.restore(replayA.snapshot());
assert.deepEqual(replayB.snapshot(),replayA.snapshot());
const oversized=structuredClone(valid);
oversized.history=Array.from({length:600},(_,i)=>({...valid.history[0],id:`emo:bounded:${i}`}));
const boundedRestore=new EmotionAppraisalEngine();
boundedRestore.restore(oversized);
assert.equal(boundedRestore.snapshot().history.length,0,'oversized untrusted arrays fail closed rather than being traversed');
const manyHistory=structuredClone(valid);
manyHistory.history=Array.from({length:128},(_,i)=>({...valid.history[0],id:`emo:bounded:${i}`,tick:i}));
const cappedRestore=new EmotionAppraisalEngine(); cappedRestore.restore(manyHistory);
assert.equal(cappedRestore.snapshot().history.length,128);
const manyOutcomes=Object.fromEntries(Array.from({length:80},(_,i)=>[['rest','explore','verify','reflect','protect','withdraw','approach','engage'][i%8]+(i<8?'':String(i)),{attempts:1,meanSuccess01:.5,meanSurprise01:.5,meanBenefit01:.5}]));
const outcomeSnapshot=structuredClone(valid); outcomeSnapshot.outcomes=manyOutcomes;
const outcomeRestore=new EmotionAppraisalEngine(); outcomeRestore.restore(outcomeSnapshot);
assert.ok(Object.keys(outcomeRestore.snapshot().outcomes).length<=8,'only registered action keys are restored');

console.log(JSON.stringify({pass:'workpass610',status:'PASS',checks:{
  validV2RoundTrip:true,rootGetterRejected:true,nestedGetterRejected:true,inheritedAndHostileRecordsRejected:true,
  sparseAndAccessorArraysRejected:true,revokedProxySafe:true,finiteCountersAndClampedMetrics:true,
  unknownLabelsActionsAndBrokenLinksRejected:true,repeatedRestoreDeterministic:true,historyBounded:true,outcomesAllowlisted:true
}},null,2));
