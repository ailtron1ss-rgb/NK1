import assert from 'node:assert/strict';
import { ExternalPostconditionVerifier } from '../src/organism/system/ExternalPostconditionVerifier.ts';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';

const verifier=new ExternalPostconditionVerifier();
const strong={version:1,action:'explore',status:'executed',realityClass:'device-observation',source:'android-termux',at:100,before:{battery01:.8,thermal01:.2,cognitiveCapacity01:.9,awake:true,source:'android-termux'},after:{battery01:.79,thermal01:.21,cognitiveCapacity01:.9,awake:true,source:'android-termux'},stateDelta:{battery01:-.01,thermal01:.01,cognitiveCapacity01:0,awakeChanged:false},effect01:.7,reason:'live-android-telemetry-observation',capability:'android.sensors',consequenceVerification:{attempted:true,independent:true,verified:true,sourceStable:true,freshBefore01:1,freshAfter01:1,changed01:.6,reason:'independent-live-device-post-action-measurement',verificationMode:'independent-observation'}};
const weak={...strong,action:'respond',realityClass:'device-actuation',effect01:.1,consequenceVerification:{...strong.consequenceVerification,independent:true,verified:false,verificationMode:'actuation-receipt-only',reason:'receipt-only'}};
const a=verifier.assess(strong);
const b=verifier.assess(weak);
assert.equal(a.proofClass,'independent-observation');
assert.equal(a.verified01,1);
assert.ok(a.evidence01>b.evidence01);
assert.equal(b.proofClass,'stable-device-receipt');
assert.equal(b.verified01,0);

const unverifiedClaim = verifier.assess({
  ...strong,
  consequenceVerification: { ...strong.consequenceVerification, verified: false },
});
assert.notEqual(unverifiedClaim.proofClass, 'independent-observation',
  'independence/freshness flags cannot override a failed verification result');
assert.equal(unverifiedClaim.verified01, 0);
const wrongModeClaim = verifier.assess({
  ...strong,
  consequenceVerification: { ...strong.consequenceVerification, verificationMode: 'actuation-receipt-only' },
});
assert.notEqual(wrongModeClaim.proofClass, 'independent-observation',
  'receipt-only mode is not independent observation even if other booleans are forged');
verifier.registerAction('high-threshold-observe', { observation: true, minIndependent01: .95 });
const belowThresholdClaim = verifier.assess({
  ...strong,
  action: 'high-threshold-observe',
  consequenceVerification: { ...strong.consequenceVerification, freshBefore01: .9, freshAfter01: .9 },
});
assert.notEqual(belowThresholdClaim.proofClass, 'independent-observation',
  'the per-action minimum independence strength must be numerically enforced');
assert.throws(() => verifier.registerAction('__proto__', { observation: true }), /postcondition-action-name-invalid/);
assert.equal(verifier.actionContract('__proto__').observation, false,
  'prototype-like action names cannot alter the action contract lookup');
let postconditionGetterCalls = 0;
const getterBackedResult = { ...strong };
Object.defineProperty(getterBackedResult, 'effect01', {
  enumerable: true,
  get() { postconditionGetterCalls++; return .7; },
});
const rejectedAssessment = verifier.assess(getterBackedResult);
assert.equal(postconditionGetterCalls, 0, 'postcondition boundary must reject accessors without invoking them');
assert.equal(rejectedAssessment.proofClass, 'none');
assert.equal(rejectedAssessment.verified01, 0);


const { RealityGroundingController }=await import('../src/organism/system/RealityGroundingController.ts');
const holdout=new RealityGroundingController();
const action='explore';
holdout.resolve({tick:1,action,expectedReward01:.72,predictionConfidence01:.8,simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,novelty01:.3,resource01:.9,embodiedAction:{...strong,at:200,action,realityClass:'device-observation',consequenceVerification:{...strong.consequenceVerification,verified:true,independent:true},effect01:.72}});
const early=holdout.causalHoldoutReadiness(action,'external',6);
assert.ok(early>.1 && early<.3);
for(let i=1;i<5;i++){
  holdout.resolve({tick:i+1,action,expectedReward01:.72,predictionConfidence01:.8,simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,novelty01:.3,resource01:.9,embodiedAction:{...strong,at:200+i,action,realityClass:'device-observation',consequenceVerification:{...strong.consequenceVerification,verified:true,independent:true},effect01:.72}});
}
const lateRow=holdout.resolve({tick:6,action,expectedReward01:.72,predictionConfidence01:.8,simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,novelty01:.3,resource01:.9,embodiedAction:{...strong,at:206,action,realityClass:'device-observation',consequenceVerification:{...strong.consequenceVerification,verified:true,independent:true},effect01:.72}});
const ready=holdout.causalHoldoutReadiness(action,'external',6);
assert.ok(ready>.9 && ready>early);

const world=new GroundedWorldState();
const before=world.snapshot();
const row=world.integrateExternalOutcome({at:100,action:'explore',status:'executed',proofClass:a.proofClass,verified01:a.verified01,independent01:a.independent01,evidence01:a.evidence01,consequence01:a.consequence01,claim:a.reason,provenanceId:'outcome:1:100',divergence01:.42});
const after=world.snapshot();
assert.equal(row.verified01,1);
assert.equal(after.revision,before.revision+1);
assert.ok(after.facts.some(x=>x.startsWith('external-observed:explore')));
assert.ok(after.events.some(x=>x.id===row.eventId));
console.log(JSON.stringify({ok:true,strong:a,weak:b,holdout:{early,ready},world:{revision:after.revision,lastHash:after.lastHash,facts:after.facts.slice(-2)}}));
