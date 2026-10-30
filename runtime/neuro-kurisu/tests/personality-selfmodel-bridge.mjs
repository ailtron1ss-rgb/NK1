import assert from 'node:assert/strict';
import { P78AutobiographicalSelfContinuity } from '../src/organism/developmental/P78AutobiographicalSelfContinuity.ts';
import { P2702PersistentPersonalityDynamics } from '../src/organism/cognition/P2702PersistentPersonalityDynamics.ts';
import { SelfModelEngine } from '../src/organism/cognition/SelfModelV2.ts';
import { PersonalitySelfModelBridge } from '../src/organism/cognition/PersonalitySelfModelBridge.ts';

const p78=new P78AutobiographicalSelfContinuity();
const personality=new P2702PersistentPersonalityDynamics();
const selfModel=new SelfModelEngine();
const bridge=new PersonalitySelfModelBridge(p78,personality,selfModel);

const verifiedEvent={
  tick:10,at:1000,action:'explore',outcome:0.9,
  evidenceStatus:'verified-independent',
  evidenceRef:'world-transition:receipt-10',
  authorship:'self-initiated',
  episodeId:'episode-10',
};
const accepted=bridge.recordOutcome({
  event:verifiedEvent,action:'explore',reward01:0.9,goalAlignment01:0.85,
  predictionError01:0.1,identityGap01:0.05,relationshipId:'user',identityVector:[0.95,0.2,0.8,0.4,0.6,0.7,0.5,0.8],
});
assert.equal(accepted.newEvent,true);
assert.equal(accepted.evidenceAccepted,true);
assert.equal(accepted.evidenceReason,'accepted');
assert.equal(accepted.selfModelUpdate?.identityUpdateAccepted,true);
assert.equal(accepted.selfModel.lastIdentityGate?.accepted,true);
assert.equal(accepted.personality.learningUpdates,1);
assert.ok(accepted.personality.adaptiveValues[1] > 0.63, 'respond outcomes train warmth by trait name');
assert.ok(accepted.personality.adaptiveValues[4] > 0.86, 'respond outcomes train directness by trait name');
assert.equal(accepted.personality.adaptiveValues[0], 0.68, 'respond outcomes must not accidentally train sarcasm by array index');
assert.ok(accepted.personality.selfBeliefs[0] > 0.72, 'verified identity evidence slowly updates self-beliefs');
assert.ok(accepted.personality.selfBeliefs[1] < 0.68, 'self-belief vectors are updated dimension by dimension');

const selfBeliefsBeforeUnbound=[...personality.snapshot().selfBeliefs];
const unbound=bridge.recordOutcome({
  event:{tick:11,at:1100,action:'respond',outcome:0.8,evidenceStatus:'verified-independent',evidenceRef:'local-cache:maybe'},
  action:'respond',reward01:0.8,goalAlignment01:0.8,predictionError01:0.2,identityGap01:0.1,identityVector:[0,0,0,0,0,0,0,0],
});
assert.equal(unbound.newEvent,true);
assert.equal(unbound.evidenceAccepted,false,'P78 syntax alone must not bypass the CEF receipt namespace gate');
assert.equal(unbound.selfModelUpdate?.identityUpdateAccepted,false);
assert.equal(unbound.selfModel.lastIdentityGate?.reason,'untrusted-evidence-source');
assert.equal(unbound.personality.learningUpdates,2);
assert.deepEqual(unbound.personality.selfBeliefs,selfBeliefsBeforeUnbound,'unsupported receipt namespaces cannot update autobiographical self-beliefs');

// A non-adjacent replay must not become a second experience or update either downstream learner.
const beforeReplay={samples:p78.snapshot().samples,updates:personality.snapshot().learningUpdates,accepted:selfModel.snapshot().identityGateAcceptedCount,rejected:selfModel.snapshot().identityGateRejectedCount};
const replay=bridge.recordOutcome({
  event:verifiedEvent,action:'explore',reward01:0.9,goalAlignment01:0.85,
  predictionError01:0.1,identityGap01:0.05,relationshipId:'user',
});
assert.equal(replay.newEvent,false);
assert.equal(replay.evidenceReason,'duplicate-event');
assert.deepEqual({
  samples:p78.snapshot().samples,
  updates:personality.snapshot().learningUpdates,
  accepted:selfModel.snapshot().identityGateAcceptedCount,
  rejected:selfModel.snapshot().identityGateRejectedCount,
},beforeReplay);

// The replay fence survives persistence and a fresh bridge instance.
const restoredP78=new P78AutobiographicalSelfContinuity(); restoredP78.restore(p78.snapshot());
const restoredPersonality=new P2702PersistentPersonalityDynamics(); restoredPersonality.restore(personality.snapshot());
const restoredSelfModel=new SelfModelEngine(); restoredSelfModel.restore(selfModel.snapshot());
const restoredBridge=new PersonalitySelfModelBridge(restoredP78,restoredPersonality,restoredSelfModel);
const afterRestart=restoredBridge.recordOutcome({
  event:verifiedEvent,action:'explore',reward01:0.9,goalAlignment01:0.85,
  predictionError01:0.1,identityGap01:0.05,relationshipId:'user',
});
assert.equal(afterRestart.newEvent,false);
assert.equal(restoredPersonality.snapshot().learningUpdates,2);

// Corrupted persisted state is bounded and action-keyed.
const hardenedPersonality=new P2702PersistentPersonalityDynamics();
hardenedPersonality.restore({
  experienceCount:-9,learningUpdates:Infinity,adaptiveNames:['curiosity','directness'],
  adaptiveValues:[NaN,9,-4],relationshipTrust:{'friend':2,'bad':NaN},
  actionPreference:{explore:4,respond:-4,unknown:9},stability01:8,
});
const safePersonality=hardenedPersonality.snapshot();
assert.equal(safePersonality.experienceCount,0);
assert.equal(safePersonality.learningUpdates,0);
assert.equal(safePersonality.adaptiveValues.length,2);
assert.ok(safePersonality.adaptiveValues.every(x=>x>=0&&x<=1));
assert.equal(safePersonality.actionPreference.explore,1);
assert.equal(safePersonality.actionPreference.respond,-1);
assert.equal('unknown' in safePersonality.actionPreference,false);
assert.equal(safePersonality.stability01,1);

const hardenedSelfModel=new SelfModelEngine();
hardenedSelfModel.restore({
  confidence:9,actionAccuracy:NaN,recentErrors:[NaN,3,-2],
  selfConsistentAction11:{explore:9,unknown:7},
  recoveryCount:-2,identityGateAcceptedCount:-4,
});
const safeSelf=hardenedSelfModel.snapshot();
assert.equal(safeSelf.confidence,1);
assert.equal(safeSelf.actionAccuracy,0.5);
assert.deepEqual(safeSelf.recentErrors,[0.5,1,0]);
assert.equal(safeSelf.selfConsistentAction11.explore,1);
assert.equal('unknown' in safeSelf.selfConsistentAction11,false);
assert.equal(safeSelf.recoveryCount,0);
assert.equal(safeSelf.identityGateAcceptedCount,0);

const prepared = bridge.prepareDecision({
  tick: 12, novelty01: 0.7, uncertainty01: 0.4, goalPressure01: 0.3, identityGap01: 0.2,
  actionUtilities: { respond: 0.5, explore: 0.6, verify: 0.8, rest: 0.2, reflect: 0.7, wait: 0.3, defer: 0.4 },
});
assert.equal(Object.keys(prepared.selfModelActionBias).length, 7);
assert.equal(Object.keys(prepared.actionBias).length, 7);
assert.ok(Object.values(prepared.actionBias).every(x=>Number.isFinite(x)&&Math.abs(x)<=0.1));
assert.ok(prepared.personality.traitVector.every(Number.isFinite));
assert.ok(Object.values(prepared.selfModelActionBias).every(Number.isFinite));

const poisonedOutcomeModel = new SelfModelEngine();
const poisonedOutcome = poisonedOutcomeModel.learnGoalOutcome({
  action: 'verify', goalAlignment01: NaN, reward01: Infinity, tick: 13,
});
assert.equal(Number.isFinite(poisonedOutcome.quality01), true, 'non-finite rewards must not poison self calibration');
assert.ok(Number.isFinite(poisonedOutcomeModel.snapshot().goalAlignmentEMA01));
const boundedRelationships = new P2702PersistentPersonalityDynamics();
const actionUtilities = { respond: 0.5, explore: 0.5, verify: 0.5, rest: 0.5, reflect: 0.5, wait: 0.5, defer: 0.5 };
for (let i = 0; i < 40; i++) boundedRelationships.beforeDecision({
  tick: i + 1, novelty01: 0.2, uncertainty01: 0.2, goalPressure01: 0.2, identityGap01: 0.1,
  actionUtilities, relationshipId: `relationship-${i}`,
});
boundedRelationships.beforeDecision({
  tick: 41, novelty01: 0.2, uncertainty01: 0.2, goalPressure01: 0.2, identityGap01: 0.1,
  actionUtilities, relationshipId: '__proto__',
});
assert.ok(Object.keys(boundedRelationships.snapshot().relationshipTrust).length <= 32);
assert.equal(Object.hasOwn(boundedRelationships.snapshot().relationshipTrust, '__proto__'), false);
const dimensionSafePersonality = new P2702PersistentPersonalityDynamics();
dimensionSafePersonality.afterOutcome({ tick: 1, reward01: 0.9, verified01: 1, predictionError01: 0.1, identityGap01: 0.1, action: 'reflect', identityVector: [NaN, 0.99] });
assert.equal(dimensionSafePersonality.snapshot().selfBeliefs[0], 0.72, 'invalid vector dimensions are skipped without shifting following coordinates');
assert.ok(dimensionSafePersonality.snapshot().selfBeliefs[1] > 0.68);
console.log('PERSONALITY_SELFMODEL_BRIDGE=PASS');
