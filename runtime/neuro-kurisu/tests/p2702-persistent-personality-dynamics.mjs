import assert from 'node:assert/strict';
import { P2702PersistentPersonalityDynamics, defaultP2702PersistentPersonality } from '../src/organism/cognition/P2702PersistentPersonalityDynamics.ts';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};

async function makeTrustedEvidence(id, traitFeedback, valueFeedback) {
  const context = {
    toolId: 'personality-test-action',
    input: { operation: 'change-profile', evidenceCase: id },
    result: { status: 'completed' },
    executionId: 'exec-12345678',
    decisionId: `decision-${id}`,
  };
  const service = new OutcomeVerificationService();
  const verification = await service.verify(context, () => ({
    verified: true, basis: 'external-postcondition', confidence01: 0.95, externalObservation: true,
    observationId: `obs-${id}`, expectedPostcondition: 'profile-updated', observedPostcondition: 'profile-updated',
  }));
  assert.equal(verification.verified, true);
  return { source: 'external-verification', verification,
    expectedBinding: { toolId: context.toolId, input: context.input, executionId: context.executionId, decisionId: context.decisionId },
    ...(traitFeedback ? { traitFeedback } : {}), ...(valueFeedback ? { valueFeedback } : {}) };
}
const p=new P2702PersistentPersonalityDynamics();
const before=p.snapshot();
let out=p.beforeDecision({tick:1,novelty01:.9,uncertainty01:.8,goalPressure01:.7,identityGap01:.2,reward01:.5,actionUtilities:actions,identityVector:new Array(24).fill(.2),relationshipId:'research-partner'});
assert.equal(p.snapshot().relationshipTrust['research-partner'],undefined,'decision intent alone must not change relationship trust');
assert(out.actionBias.explore>0,'exploration should receive curiosity-driven personality bias');
const trustedEvidence=await makeTrustedEvidence('accepted',{traitName:'directness',target01:.95,confidence01:.9},{valueName:'curiosity',target01:.99,confidence01:.9});
p.afterOutcome({tick:2,reward01:.95,verified01:1,predictionError01:.05,identityGap01:.1,action:'explore',identityVector:new Array(24).fill(.4),relationshipId:'research-partner',evidence:trustedEvidence});
const after=p.snapshot();
assert(after.learningUpdates>before.learningUpdates);
assert(after.verifiedLearningUpdates>before.verifiedLearningUpdates);
assert.equal(after.lastEvidenceGateReason,'verified-independent-outcome-bound');
assert(after.autobiographicalStrength01>before.autobiographicalStrength01);
assert(after.adaptiveValues.some((v,i)=>Math.abs(v-(before.adaptiveValues[i]??v))>1e-6));
assert(after.valueWeights.some((v,i)=>Math.abs(v-(before.valueWeights[i]??v))>1e-6),'value weights change only for evidence-attributed dimension');
assert(after.relationshipTrust['research-partner']>.5,'relationship trust changes only after bound verified outcome');
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
badSource.afterOutcome({tick:1,reward01:.99,verified01:1,predictionError01:.01,identityGap01:.1,action:'explore',evidence:{source:'internal'}});
assert.deepEqual(badSource.snapshot().adaptiveValues,badSourceBefore.adaptiveValues,'internal evidence cannot authorize stable personality learning');

const noAttribution=new P2702PersistentPersonalityDynamics();
const noAttributionBefore=noAttribution.snapshot();
noAttribution.afterOutcome({tick:1,reward01:.99,verified01:1,predictionError01:.01,identityGap01:.1,action:'explore',evidence:await makeTrustedEvidence('no-attribution')});
assert.deepEqual(noAttribution.snapshot().adaptiveValues,noAttributionBefore.adaptiveValues,'verified outcome without trait attribution must not pick an arbitrary trait by action index');
assert.deepEqual(noAttribution.snapshot().valueWeights,noAttributionBefore.valueWeights,'verified outcome without value attribution must not move every value weight');

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
