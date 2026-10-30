import assert from 'node:assert/strict';
import { P78AutobiographicalSelfContinuity } from '../src/organism/developmental/P78AutobiographicalSelfContinuity.ts';
import { P2702PersistentPersonalityDynamics } from '../src/organism/cognition/P2702PersistentPersonalityDynamics.ts';
import { SelfModelEngine } from '../src/organism/cognition/SelfModelV2.ts';
import { PersonalitySelfModelBridge } from '../src/organism/cognition/PersonalitySelfModelBridge.ts';
import { P80UnifiedSelfState } from '../src/organism/cognition/P80UnifiedSelfState.ts';

const p78=new P78AutobiographicalSelfContinuity();
const personality=new P2702PersistentPersonalityDynamics();
const selfModel=new SelfModelEngine();
const bridge=new PersonalitySelfModelBridge(p78,personality,selfModel);

const verifiedEvent={
  tick:10,at:1000,action:'explore',outcome:0.9,
  evidenceStatus:'verified-independent',
  evidenceRef:'external-verification:reb:10:11:outcome',
  evidenceReceiptId:'reb:10:11:outcome',
  verified01:.95,independent01:.9,evidence01:.9,consequence01:.9,identityUpdateScale01:.9,
  authorship:'self-initiated',
  episodeId:'episode-10',
};
const accepted=bridge.recordOutcome({
  event:verifiedEvent,action:'explore',reward01:0.9,goalAlignment01:0.85,
  predictionError01:0.1,identityGap01:0.05,relationshipId:'user',identityVector:[0.95,0.2,0.8,0.4,0.6,0.7,0.5,0.8],
  evidenceReceiptId:'reb:10:11:outcome',learningScale01:1,identityUpdateScale01:1,evidence01:0.9,independent01:0.9,consequence01:0.9,
});
assert.equal(accepted.newEvent,true);
assert.equal(accepted.evidenceAccepted,true);
assert.equal(accepted.evidenceReason,'accepted');
assert.equal(accepted.selfModelUpdate?.identityUpdateAccepted,true);
assert.equal(accepted.selfModel.lastIdentityGate?.accepted,true);
assert.equal(accepted.personality.learningUpdates,1);
assert.ok(accepted.personality.adaptiveValues[5] > 0.46, 'explore outcomes train playfulness by trait name');
assert.equal(accepted.personality.adaptiveValues[1], 0.63, 'explore outcomes must not train warmth by unrelated index');
assert.equal(accepted.personality.adaptiveValues[0], 0.68, 'explore outcomes must not accidentally train sarcasm by array index');
assert.equal(accepted.personality.adaptiveValues[4], 0.86, 'explore outcomes must not accidentally train directness by array index');
assert.ok(accepted.personality.selfBeliefs[0] > 0.72, 'verified identity evidence slowly updates self-beliefs');
assert.ok(accepted.personality.selfBeliefs[1] < 0.68, 'self-belief vectors are updated dimension by dimension');
assert.ok(accepted.personality.valueWeights[0] > 0.98,'verified independent evidence may slowly update protected value weights');
assert.ok(accepted.personality.relationshipTrust.user > 0.5,'relationship trust changes only on a strong independent outcome');

const selfBeliefsBeforeUnbound=[...personality.snapshot().selfBeliefs];
const trustBeforeUnbound={...personality.snapshot().relationshipTrust};
const valuesBeforeUnbound=[...personality.snapshot().valueWeights];
const unbound=bridge.recordOutcome({
  event:{tick:11,at:1100,action:'respond',outcome:0.8,evidenceStatus:'verified-independent',evidenceRef:'local-cache:maybe'},
  action:'respond',reward01:0.8,goalAlignment01:0.8,predictionError01:0.2,identityGap01:0.1,identityVector:[0,0,0,0,0,0,0,0],
});
assert.equal(unbound.newEvent,true);
assert.equal(unbound.evidenceAccepted,false,'P78 syntax alone must not bypass the CEF receipt namespace gate');
assert.equal(unbound.selfModelUpdate?.identityUpdateAccepted,false);
assert.equal(unbound.selfModel.lastIdentityGate?.reason,'outcome-unverified');
assert.deepEqual(unbound.personality.relationshipTrust,trustBeforeUnbound,'unbound outcomes cannot move relationship trust');
assert.deepEqual(unbound.personality.valueWeights,valuesBeforeUnbound,'unbound outcomes cannot rewrite stable values');
assert.equal(unbound.personality.learningUpdates,2);
assert.deepEqual(unbound.personality.selfBeliefs,selfBeliefsBeforeUnbound,'unsupported receipt namespaces cannot update autobiographical self-beliefs');
const mismatchedReceipt = bridge.recordOutcome({
  event:{tick:12,at:1200,action:'verify',outcome:0.9,evidenceStatus:'verified-independent',evidenceRef:'external-verification:reb:12:99:outcome',evidenceReceiptId:'reb:12:98:outcome',verified01:.95,independent01:.9,evidence01:.9,consequence01:.9,identityUpdateScale01:.9},
  evidenceReceiptId:'reb:12:98:outcome',action:'verify',reward01:0.9,goalAlignment01:0.9,
  predictionError01:0.1,identityGap01:0.1,learningScale01:1,identityUpdateScale01:1,evidence01:0.95,independent01:0.95,consequence01:0.95,
});
assert.equal(mismatchedReceipt.evidenceAccepted,false,'receipt ID must exactly match the autobiographical event reference');
assert.equal(mismatchedReceipt.evidenceReason,'receipt-not-bound-to-event');
assert.equal(mismatchedReceipt.selfModel.lastIdentityGate?.accepted,false);
assert.deepEqual(mismatchedReceipt.personality.selfBeliefs,selfBeliefsBeforeUnbound,'mismatched receipts cannot update self beliefs');
assert.deepEqual(mismatchedReceipt.personality.valueWeights,valuesBeforeUnbound,'mismatched receipts cannot update stable values');

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
assert.equal(restoredPersonality.snapshot().learningUpdates,3);

// Corrupted persisted state is bounded and action-keyed.
const hardenedPersonality=new P2702PersistentPersonalityDynamics();
hardenedPersonality.restore({
  experienceCount:-9,learningUpdates:Infinity,adaptiveNames:['directness','warmth','curiosity'],
  adaptiveValues:[9,0.1,0.99],relationshipTrust:{'friend':2,'bad':NaN},
  actionPreference:{explore:4,respond:-4,unknown:9},stability01:8,
});
const safePersonality=hardenedPersonality.snapshot();
assert.equal(safePersonality.experienceCount,0);
assert.deepEqual(safePersonality.selfBeliefNames,['continuity','coherence','agency','reality-grounding','stability','goal-continuity','memory-continuity','authorship-continuity']);
assert.equal(safePersonality.learningUpdates,0);
assert.deepEqual(safePersonality.adaptiveNames,['sarcasm','warmth','guardedness','tenderness','directness','playfulness','composure','embarrassmentSensitivity']);
assert.equal(safePersonality.adaptiveValues.length,8);
assert.equal(safePersonality.adaptiveValues[4],1,'restored values are aligned by semantic trait name, not array position');
assert.equal(safePersonality.adaptiveValues[1],0.1);
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
const personalityDiagnostics=personality.diagnostics();
assert.equal(Object.keys(personalityDiagnostics.tensions).length,5,'the five canonical value tensions are named and measurable');
assert.equal(Object.keys(personalityDiagnostics.selfBeliefs).length,8,'self-belief diagnostics expose all named axes');
assert.ok(Number.isFinite(personalityDiagnostics.drift01));
assert.ok(personalityDiagnostics.autobiographicalStrength01>0.1,'verified autobiographical evidence increases longitudinal self-history strength');

const decisionInput = { tick: 20, novelty01: 0.8, uncertainty01: 0.8, goalPressure01: 0.3, identityGap01: 0.2, actionUtilities: { respond: 0.5, explore: 0.5, verify: 0.5, rest: 0.5, reflect: 0.5, wait: 0.5, defer: 0.5 } };
const trustedPersonality = new P2702PersistentPersonalityDynamics();
trustedPersonality.restore({ relationshipTrust: { user: 0.95 } });
const cautiousPersonality = new P2702PersistentPersonalityDynamics();
cautiousPersonality.restore({ relationshipTrust: { user: 0.05 } });
const trustedBias = trustedPersonality.beforeDecision({ ...decisionInput, relationshipId: 'user' }).actionBias;
const cautiousBias = cautiousPersonality.beforeDecision({ ...decisionInput, relationshipId: 'user' }).actionBias;
assert.ok(trustedBias.respond > cautiousBias.respond,'earned relationship trust changes the social approach prior');
const scienceNames=['truth','science','autonomy','responsibility','privacy','loyalty','curiosity','relationship'];
const evidenceDriven = new P2702PersistentPersonalityDynamics();
evidenceDriven.restore({ valueNames: scienceNames, valueWeights: [0.99,0.99,0.9,0.9,0.8,0.8,0.96,0.72] });
const lowEvidenceValues = new P2702PersistentPersonalityDynamics();
lowEvidenceValues.restore({ valueNames: scienceNames, valueWeights: [0.1,0.1,0.9,0.9,0.8,0.8,0.96,0.72] });
const strongVerificationBias = evidenceDriven.beforeDecision(decisionInput).actionBias.verify;
const weakVerificationBias = lowEvidenceValues.beforeDecision(decisionInput).actionBias.verify;
assert.ok(strongVerificationBias > weakVerificationBias,'truth/science value weights strengthen verification preference');

const forgedReceiptModel = new SelfModelEngine();
const forgedReceiptResult = forgedReceiptModel.learnGoalOutcome({
  action:'verify',goalAlignment01:0.9,reward01:0.9,tick:13,
  evidence:{verified:true,independent:true,source:'external-verification',evidenceRef:'external-verification:reb:13:1:outcome',evidenceReceiptId:'reb:13:2:outcome',evidence01:.9,independent01:.9,consequence01:.9,identityUpdateScale01:.9},
});
assert.equal(forgedReceiptResult.identityUpdateAccepted,false,'SelfModel rejects mismatched receipt IDs even when called outside the bridge');
assert.equal(forgedReceiptResult.identityUpdateReason,'receipt-not-bound-to-outcome-event');
const directValidReceiptModel = new SelfModelEngine();
const directValidReceipt = directValidReceiptModel.learnGoalOutcome({
  action:'verify',goalAlignment01:0.9,reward01:0.9,tick:13,
  evidence:{verified:true,independent:true,source:'external-verification',evidenceRef:'external-verification:reb:13:3:outcome',evidenceReceiptId:'reb:13:3:outcome',evidence01:.9,independent01:.9,consequence01:.9,identityUpdateScale01:.9},
});
assert.equal(directValidReceipt.identityUpdateAccepted,true,'a tick-bound exact receipt is required and sufficient at the SelfModel gate');
const lowQualitySelfModel=new SelfModelEngine();
const lowQualitySelfResult=lowQualitySelfModel.learnGoalOutcome({action:'verify',goalAlignment01:.9,reward01:.9,tick:13,evidence:{verified:true,independent:true,source:'external-verification',evidenceRef:'external-verification:reb:13:4:outcome',evidenceReceiptId:'reb:13:4:outcome',evidence01:.9,independent01:.9,consequence01:.9,identityUpdateScale01:.2}});
assert.equal(lowQualitySelfResult.identityUpdateAccepted,false,'SelfModel requires the identity-specific confidence floor even for a valid receipt');

const poisonedOutcomeModel = new SelfModelEngine();
const poisonedOutcome = poisonedOutcomeModel.learnGoalOutcome({
  action: 'verify', goalAlignment01: NaN, reward01: Infinity, tick: 13,
});
assert.equal(Number.isFinite(poisonedOutcome.quality01), true, 'non-finite rewards must not poison self calibration');
assert.ok(Number.isFinite(poisonedOutcomeModel.snapshot().goalAlignmentEMA01));
const boundedRelationships = new P2702PersistentPersonalityDynamics();
const actionUtilities = { respond: 0.5, explore: 0.5, verify: 0.5, rest: 0.5, reflect: 0.5, wait: 0.5, defer: 0.5 };
boundedRelationships.beforeDecision({
  tick: 1, novelty01: 0.2, uncertainty01: 0.2, goalPressure01: 0.2, identityGap01: 0.1,
  actionUtilities, relationshipId: 'decision-only',
});
assert.equal(Object.keys(boundedRelationships.snapshot().relationshipTrust).length,0,'decision preparation must not invent relationship trust');
for (let i = 0; i < 40; i++) boundedRelationships.afterOutcome({
  tick: i + 2, reward01: 0.9, verified01: 1, predictionError01: 0.1, identityGap01: 0.1,
  action: 'respond', relationshipId: `relationship-${i}`, evidence01: 0.9, independent01: 0.9, consequence01: 0.9, learningScale01: 1, identityUpdateScale01:1, evidenceReceiptId:`reb:${i+2}:1:outcome`, evidenceRef:`external-verification:reb:${i+2}:1:outcome`,
});
boundedRelationships.afterOutcome({
  tick: 42, reward01: 0.9, verified01: 1, predictionError01: 0.1, identityGap01: 0.1,
  action: 'respond', relationshipId: '__proto__', evidence01: 0.9, independent01: 0.9, consequence01: 0.9, learningScale01: 1, identityUpdateScale01:1, evidenceReceiptId:'reb:42:1:outcome', evidenceRef:'external-verification:reb:42:1:outcome',
});
assert.ok(Object.keys(boundedRelationships.snapshot().relationshipTrust).length <= 32);
assert.equal(Object.hasOwn(boundedRelationships.snapshot().relationshipTrust, '__proto__'), false);
const directP2702Bypass = new P2702PersistentPersonalityDynamics();
const directP2702Before = directP2702Bypass.snapshot();
directP2702Bypass.afterOutcome({ tick: 50, reward01: 1, verified01: 1, predictionError01: 0, identityGap01: 0, action: 'respond', identityVector:[1,1,1,1,1,1,1,1], relationshipId:'user', learningScale01:1, evidence01:1, independent01:1, consequence01:1 });
assert.deepEqual(directP2702Bypass.snapshot().valueWeights,directP2702Before.valueWeights,'direct callers cannot update stable values without an exact receipt');
assert.deepEqual(directP2702Bypass.snapshot().selfBeliefs,directP2702Before.selfBeliefs,'direct callers cannot update self-beliefs without an exact receipt');
assert.deepEqual(directP2702Bypass.snapshot().relationshipTrust,directP2702Before.relationshipTrust,'direct callers cannot update relationship trust without an exact receipt');
assert.equal(directP2702Bypass.snapshot().autobiographicalStrength01,directP2702Before.autobiographicalStrength01,'unreceipted outcomes cannot increase autobiographical evidence strength');
const lowIdentityScale = new P2702PersistentPersonalityDynamics();
const lowIdentityBefore = lowIdentityScale.snapshot();
lowIdentityScale.afterOutcome({ tick: 51, reward01:1, verified01:1, predictionError01:0, identityGap01:0, action:'verify', identityVector:[1,1,1,1,1,1,1,1], learningScale01:1, identityUpdateScale01:0.2, evidence01:1, independent01:1, consequence01:1, evidenceReceiptId:'reb:51:1:outcome', evidenceRef:'external-verification:reb:51:1:outcome' });
assert.deepEqual(lowIdentityScale.snapshot().valueWeights,lowIdentityBefore.valueWeights,'identity-specific low confidence blocks stable value revision');
assert.deepEqual(lowIdentityScale.snapshot().selfBeliefs,lowIdentityBefore.selfBeliefs,'identity-specific low confidence blocks self-belief updates');
assert.equal(lowIdentityScale.snapshot().autobiographicalStrength01,lowIdentityBefore.autobiographicalStrength01,'identity-specific low confidence blocks autobiographical strength promotion');
const relationshipRestore = new P2702PersistentPersonalityDynamics();
relationshipRestore.restore({ relationshipTrust:Object.fromEntries([['Ａlice',0.9],['Alice',0.2],['bad'+String.fromCharCode(0)+'key',1],['__proto__',1],['constructor',1]]) });
assert.equal(Object.keys(relationshipRestore.snapshot().relationshipTrust).length,1,'restore normalizes Unicode and drops duplicate/unsafe relationship IDs');
assert.equal(relationshipRestore.snapshot().relationshipTrust.Alice,0.9);
const dimensionSafePersonality = new P2702PersistentPersonalityDynamics();
dimensionSafePersonality.afterOutcome({ tick: 1, reward01: 0.9, verified01: 1, predictionError01: 0.1, identityGap01: 0.1, action: 'reflect', identityVector: [NaN, 0.99], evidence01: 0.9, independent01: 0.9, consequence01: 0.9, learningScale01: 1, identityUpdateScale01:1, evidenceReceiptId:'reb:1:1:outcome', evidenceRef:'external-verification:reb:1:1:outcome' });
assert.equal(dimensionSafePersonality.snapshot().selfBeliefs[0], 0.72, 'invalid vector dimensions are skipped without shifting following coordinates');
assert.ok(dimensionSafePersonality.snapshot().selfBeliefs[1] > 0.68);
const p80 = new P80UnifiedSelfState();
p80.restore({ cycles: Infinity, continuity01: 8, coherence01: NaN, agency01: -2, realityAlignment01: 0.7, currentMode: 'unknown', recentModes: ['unknown','respond','reflect'], recentActions: ['bad-action','verify'], modeStreak: -4, noveltyPressure01: NaN, lastTick: -10, lastAction: '__proto__', lastReason: 'x'.repeat(800) });
const restoredP80 = p80.snapshot();
assert.equal(restoredP80.cycles, 0);
assert.equal(restoredP80.continuity01, 1);
assert.equal(restoredP80.coherence01, 0);
assert.equal(restoredP80.agency01, 0);
assert.equal(restoredP80.currentMode, 'wait');
assert.deepEqual(restoredP80.recentModes, ['respond','reflect']);
assert.deepEqual(restoredP80.recentActions, ['verify']);
assert.equal(restoredP80.modeStreak, 0);
assert.equal(restoredP80.lastTick, 0);
assert.equal(restoredP80.lastAction, 'wait');
assert.equal(restoredP80.lastReason.length, 240);
const updatedP80 = p80.update({ tick: NaN, mode: 'reflect', identity01: NaN, memoryContinuity01: 0.8, realityGap01: 2, predictionError01: 0.1, uncertainty01: 0.2, energy01: 0.8, cognitiveCapacity01: 0.9, goalPressure01: 0.2, grounding01: 0.8, causal01: 0.7, workspace01: 0.9, action: '__proto__', actionScore01: Infinity, externalInput: false, novelty01: 0.2 });
assert.equal(updatedP80.lastTick, 0);
assert.equal(updatedP80.lastAction, 'wait');
assert.equal(updatedP80.currentMode, 'reflect');
assert.ok([updatedP80.continuity01,updatedP80.coherence01,updatedP80.agency01,updatedP80.realityAlignment01].every(Number.isFinite));
console.log('PERSONALITY_SELFMODEL_BRIDGE=PASS');
