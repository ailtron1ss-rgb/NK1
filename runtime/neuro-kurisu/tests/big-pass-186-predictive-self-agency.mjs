import assert from 'node:assert/strict';
import { PredictiveSelfAgencySubstrate } from '../src/organism/cognition/PredictiveSelfAgencySubstrate.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const state=(tick,at)=>({tick,at,needs:{energy:.82,cognitiveLoad:.22,uncertainty:.28,novelty:.46,goalPressure:.58,socialNeed:.24,identityCoherence:.91}});
const input=(tick,at,requested=false)=>({
  self:[.91,.84,.63,.78,.87,.13],body:[.82,.17,.8],world:[.24,.71,.49,.66],memory:[.62,.77,.31,.54],motivation:[.58,.26,.42,.49],state:state(tick,at),externalRequested:requested
});

const brain=new PredictiveSelfAgencySubstrate();
let last;
for(let i=0;i<96;i++){
  last=brain.observe(input(i,1000+i,i%5===0));
  const action=i%2?'explore':'verify';
  brain.predict(action);
  brain.learnOutcome(action, i%3===0?.84:.61, state(i,1000+i), i%5===0, .72);
}
const q=brain.agencyDiagnostics();
assert(q.samples>=192);
assert(Number.isFinite(q.predictionError01));
assert(Number.isFinite(q.agencyConfidence01));
assert(q.ownership01>=0&&q.ownership01<=1);
assert(last?.latent.length===24);

const snap=brain.snapshot();
const restored=new PredictiveSelfAgencySubstrate();
restored.restore(snap);
assert.deepEqual(restored.snapshot(),snap,'predictive self/agency snapshot must restore exactly');

// WorkPass332: corrupt persisted weights/counters must not poison next-step agency predictions.
const corruptedBrain = new PredictiveSelfAgencySubstrate();
corruptedBrain.restore({
  version: 1,
  selfLatent: [Number.NaN, Number.POSITIVE_INFINITY, 'not-a-number'],
  previousSelfLatent: [Number.NEGATIVE_INFINITY],
  intention: [Number.NaN],
  predictions: [Number.POSITIVE_INFINITY, Number.NaN],
  actionRows: [[Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]],
  actionBias: [Number.NaN],
  selfWeights: [[Number.POSITIVE_INFINITY]],
  stateWeights: [[Number.NaN]],
  learningSteps: Number.POSITIVE_INFINITY,
  predictionSamples: -1,
  predictionError01: Number.NaN,
  agencyError01: Number.POSITIVE_INFINITY,
  ownership01: Number.NaN,
  authorship01: -3,
  selfContinuity01: Number.POSITIVE_INFINITY,
  lastAction: 'unregistered-action',
  lastPredictedOutcome01: Number.NEGATIVE_INFINITY,
  lastPredictedSelfState: [Number.NaN],
  lastObservedSelfState: [Number.POSITIVE_INFINITY],
  lastTick: Number.NaN,
  lastAt: Number.POSITIVE_INFINITY,
});
const cleanBrain = corruptedBrain.snapshot();
assert.equal(cleanBrain.learningSteps, 0);
assert.equal(cleanBrain.predictionSamples, 0);
assert.equal(cleanBrain.predictionError01, .5);
assert.equal(cleanBrain.agencyError01, .5);
assert.equal(cleanBrain.ownership01, .5);
assert.equal(cleanBrain.authorship01, 0);
assert.equal(cleanBrain.selfContinuity01, .5);
assert.equal(cleanBrain.lastAction, 'wait');
assert.equal(cleanBrain.lastTick, 0);
assert.equal(cleanBrain.lastAt, 0);
const restoredNumericValues = [
  ...cleanBrain.selfLatent, ...cleanBrain.previousSelfLatent, ...cleanBrain.intention, ...cleanBrain.predictions,
  ...cleanBrain.actionBias, ...cleanBrain.lastPredictedSelfState, ...cleanBrain.lastObservedSelfState,
  ...cleanBrain.actionRows.flat(), ...cleanBrain.selfWeights.flat(), ...cleanBrain.stateWeights.flat(),
  cleanBrain.predictionError01, cleanBrain.agencyError01, cleanBrain.ownership01, cleanBrain.authorship01,
  cleanBrain.selfContinuity01, cleanBrain.lastPredictedOutcome01,
];
assert.ok(restoredNumericValues.every(Number.isFinite), 'every restored self-model weight and signal must be finite');
const safePrediction = corruptedBrain.predict('explore');
assert.ok([safePrediction.intention01, safePrediction.predictedOutcome01, safePrediction.ownershipPrior01,
  safePrediction.confidence01, safePrediction.selfContinuity01].every(Number.isFinite),
  'restored state must produce finite next-step agency predictions');
assert.throws(() => corruptedBrain.restore({ version: 2 }), /unsupported predictive self-agency state version/);

const beforeUnknownAgencyAction = corruptedBrain.snapshot();
assert.throws(
  () => corruptedBrain.predict('execute-shell'),
  /predictive-self-agency-action-invalid/,
  'an unknown action must not alias the first learned action row',
);
assert.deepEqual(corruptedBrain.snapshot(), beforeUnknownAgencyAction,
  'unknown action rejection must not mutate predictive agency state');
assert.throws(
  () => corruptedBrain.learnOutcome('execute-shell', .99, state(3, 1003), false, 1),
  /predictive-self-agency-action-invalid/,
  'unregistered actions cannot receive outcome learning credit',
);
assert.deepEqual(corruptedBrain.snapshot(), beforeUnknownAgencyAction,
  'invalid-action outcome rejection must happen before any self-model update');


let selfGetterReads = 0;
const accessorSelfState = { version: 1 };
Object.defineProperty(accessorSelfState, 'selfLatent', {
  configurable: true, enumerable: true,
  get() { selfGetterReads += 1; return new Array(24).fill(0.9); },
});
const accessorSafeBrain = new PredictiveSelfAgencySubstrate();
accessorSafeBrain.restore(accessorSelfState);
assert.equal(selfGetterReads, 0, 'self-model restore must not execute caller-owned getters');
assert.equal(accessorSafeBrain.snapshot().learningSteps, 0);
assert.deepEqual(accessorSafeBrain.snapshot().selfLatent, new Array(24).fill(0));

let vectorGetterReads = 0;
const accessorVector = new Array(24).fill(0);
Object.defineProperty(accessorVector, '0', {
  configurable: true, enumerable: true,
  get() { vectorGetterReads += 1; return 1; },
});
const accessorVectorBrain = new PredictiveSelfAgencySubstrate();
accessorVectorBrain.restore({ version: 1, selfLatent: accessorVector });
assert.equal(vectorGetterReads, 0, 'matrix/vector accessors must be rejected before indexing');
assert.deepEqual(accessorVectorBrain.snapshot().selfLatent, new Array(24).fill(0));

// The live observation path is a separate trust boundary from checkpoint restore.
const beforeInvalidObservation = accessorSafeBrain.snapshot();
let liveInputGetterReads = 0;
const getterLiveInput = { ...input(1, 1001, false) };
Object.defineProperty(getterLiveInput, 'self', {
  enumerable: true, configurable: true,
  get() { liveInputGetterReads++; return new Array(24).fill(0.8); },
});
assert.throws(() => accessorSafeBrain.observe(getterLiveInput),
  /predictive-self-agency-input-invalid/);
assert.equal(liveInputGetterReads, 0, 'live self-agency ingress must reject getters before feature extraction');
assert.deepEqual(accessorSafeBrain.snapshot(), beforeInvalidObservation,
  'rejected self-agency observations must not mutate the learned state');
assert.throws(() => accessorSafeBrain.observe({
  ...input(2, 1002, false), world: [0.1, Number.NaN],
}), /predictive-self-agency-vectors-invalid/);
assert.deepEqual(accessorSafeBrain.snapshot(), beforeInvalidObservation,
  'non-finite feature vectors must be rejected without partial learning');
const oversizedSelfInput = { ...input(3, 1003, false), memory: new Array(257).fill(0) };
assert.throws(() => accessorSafeBrain.observe(oversizedSelfInput),
  /predictive-self-agency-vectors-invalid/);

const core=new OrganismCore(new MemoryStateStore());
await core.init();
const world=(tick)=>({tick,location:'self-agency-lab',energy:.84,attention:.8,uncertainty:.2,facts:['self','agency','prediction'],objects:['agent'],events:['action']});
for(let i=0;i<3;i++){
  await core.observe({text:`self agency test ${i}`,novelty:.6,worldContext:world(i)});
  await core.feedback({success:i===1?.81:.72,reward:.73,surprise:.12,worldTransition:{action:'explore',before:world(i),after:world(i+1),reward:.73,surprise:.12,at:50000+i}});
}
const s=core.snapshot();
assert((s.facets.cognition.predictiveSelfAgency?.learningSteps??0)>=3,'predictive self substrate must be live in core');
assert((s.facets.cognition.predictiveSelfAgency?.predictionSamples??0)>=3,'predictive self substrate must observe core cycles');
assert(Number.isFinite(s.facets.cognition.predictiveSelfAgency?.lastAt??NaN),'predictive self state must track canonical time');
console.log(JSON.stringify({pass:186,standalone:{samples:q.samples,agencyConfidence01:q.agencyConfidence01,ownership01:q.ownership01,authorship01:q.authorship01,predictionError01:q.predictionError01},core:{learningSteps:s.facets.cognition.predictiveSelfAgency?.learningSteps,predictionSamples:s.facets.cognition.predictiveSelfAgency?.predictionSamples,ownership01:s.facets.cognition.predictiveSelfAgency?.ownership01,authorship01:s.facets.cognition.predictiveSelfAgency?.authorship01}},null,2));
