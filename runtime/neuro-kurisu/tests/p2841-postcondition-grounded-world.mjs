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
