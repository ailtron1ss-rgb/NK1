import assert from 'node:assert/strict';
import { ExternalPostconditionVerifier } from '../src/organism/system/ExternalPostconditionVerifier.ts';
import { RealityGroundingController } from '../src/organism/system/RealityGroundingController.ts';
import { isTrustedEmbodiedActionResult } from '../src/organism/body/EmbodiedActionExecutor.ts';
import { isTrustedEmbodiedOutcomeVerification } from '../src/organism/system/ExternalPostconditionVerifier.ts';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';
import { createTrustedEmbodiedActionFixture } from './helpers/trusted-embodied-action-fixture.mjs';

const verifier=new ExternalPostconditionVerifier();
const strong=await createTrustedEmbodiedActionFixture('explore');
const weak=await createTrustedEmbodiedActionFixture('respond');
assert.equal(isTrustedEmbodiedActionResult(strong),true);
assert.equal(Object.isFrozen(strong),true);
assert.equal(Object.isFrozen(strong.consequenceVerification),true);

const a=await verifier.assess(strong);
const b=await verifier.assess(weak);
assert.equal(a.basis,'external-postcondition');
assert.equal(a.verified,true);
assert.equal(isTrustedEmbodiedOutcomeVerification(a,strong),true);
assert.equal(b.basis,'none');
assert.equal(b.verified,false);
assert.equal(isTrustedEmbodiedOutcomeVerification(b,weak),false,
  'a command receipt is not an independently verified external postcondition');

// A fresh post-sample cannot compensate for a stale pre-action sample.
const stale=await createTrustedEmbodiedActionFixture('explore',{staleFirstSample:true});
const staleVerification=await verifier.assess(stale);
assert.equal(isTrustedEmbodiedActionResult(stale),true);
assert.equal(stale.consequenceVerification.independent,true);
assert.equal(stale.consequenceVerification.verified,false);
assert.equal(stale.realityClass,'derived');
assert.equal(staleVerification.verified,false);
assert.equal(isTrustedEmbodiedOutcomeVerification(staleVerification,stale),false);

// Copies and JSON-like caller objects lose the executor capability and the canonical verifier token.
const copied=structuredClone(strong);
assert.equal(isTrustedEmbodiedActionResult(copied),false);
const copiedVerification=await verifier.assess(copied);
assert.equal(copiedVerification.verified,false);
assert.equal(isTrustedEmbodiedOutcomeVerification(copiedVerification,copied),false);

const forgedController=new RealityGroundingController();
forgedController.setMode('external-first');
const forged=forgedController.resolve({
  tick:1,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:copied,postcondition:copiedVerification,novelty01:.3,resource01:.9,
});
assert.equal(forged.source,'simulation');
assert.equal(forgedController.snapshot().externalPrimary,0,
  'a copied receipt must not enter the external-primary lane');

const copiedAssessment=structuredClone(a);
const copiedAssessmentController=new RealityGroundingController();
copiedAssessmentController.setMode('external-first');
const copiedAssessmentResult=copiedAssessmentController.resolve({
  tick:2,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:strong,postcondition:copiedAssessment,novelty01:.3,resource01:.9,
});
assert.equal(copiedAssessmentResult.source,'simulation',
  'a serialized OutcomeVerification must not retain its trust capability');

const otherObservation=await createTrustedEmbodiedActionFixture('explore');
const crossRunController=new RealityGroundingController();
crossRunController.setMode('external-first');
const crossRunResult=crossRunController.resolve({
  tick:3,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:otherObservation,postcondition:a,novelty01:.3,resource01:.9,
});
assert.equal(crossRunResult.source,'simulation',
  'a verifier token must not authorize a different execution/result fingerprint');

const actionMismatchController=new RealityGroundingController();
actionMismatchController.setMode('external-first');
const actionMismatch=actionMismatchController.resolve({
  tick:4,action:'respond',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:strong,postcondition:a,novelty01:.3,resource01:.9,
});
assert.equal(actionMismatch.source,'simulation',
  'an observation receipt cannot be rebound to a different selected action');

// Only six independently verified observations contribute to causal holdout readiness.
const holdout=new RealityGroundingController();
let early=0;
let lateRow=null;
for(let tick=1;tick<=6;tick++){
  const observation=tick===1?strong:await createTrustedEmbodiedActionFixture('explore');
  const verification=tick===1?a:await verifier.assess(observation);
  lateRow=holdout.resolve({
    tick,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
    simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
    novelty01:.3,resource01:.9,embodiedAction:observation,postcondition:verification,
  });
  if(tick===1) early=holdout.causalHoldoutReadiness('explore','external',6);
}
const ready=holdout.causalHoldoutReadiness('explore','external',6);
assert.ok(early>.1 && early<.3);
assert.ok(ready>.9 && ready>early);
assert.equal(lateRow?.source,'external');
assert.equal(lateRow?.proofClass,'independent-observation');

const world=new GroundedWorldState();
const before=world.snapshot();
const row=world.integrateExternalOutcome({
  at:strong.at,action:'explore',status:'executed',proofClass:'independent-observation',
  verified01:1,independent01:1,evidence01:a.confidence01,
  consequence01:strong.consequenceVerification.changed01,claim:'fresh independent observation',
  provenanceId:`outcome:1:${strong.executionId}`,divergence01:.42,
});
const after=world.snapshot();
assert.equal(row.verified01,1);
assert.equal(after.revision,before.revision+1);
assert.ok(after.facts.some(x=>x.startsWith('external-observed:explore')));
assert.ok(after.events.some(x=>x.id===row.eventId && x.label.startsWith('external-observed:explore')));

// Stable device receipts are retained as diagnostics, but cannot change world facts or confidence.
const receiptWorld=new GroundedWorldState();
const receiptBefore=receiptWorld.snapshot();
const receiptRow=receiptWorld.integrateExternalOutcome({
  at:weak.at,action:'respond',status:'executed',proofClass:'stable-device-receipt',
  verified01:0,independent01:0,evidence01:.26,consequence01:.18,
  claim:'command accepted; effect unverified',provenanceId:`receipt:${weak.executionId}`,divergence01:.7,
});
const receiptAfter=receiptWorld.snapshot();
assert.deepEqual(receiptAfter.facts,receiptBefore.facts);
assert.equal(receiptAfter.confidence01,receiptBefore.confidence01);
assert.ok(receiptAfter.events.some(x=>x.id===receiptRow.eventId && x.label.startsWith('external-receipt:respond')));

console.log(JSON.stringify({ok:true,strong:a,weak:b,stale:staleVerification,holdout:{early,ready},world:{revision:after.revision,lastHash:after.lastHash,facts:after.facts.slice(-2)}}));
