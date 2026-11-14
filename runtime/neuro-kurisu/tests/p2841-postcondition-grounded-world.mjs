import assert from 'node:assert/strict';
import { ExternalPostconditionVerifier, isTrustedEmbodiedOutcomeVerification } from '../src/organism/system/ExternalPostconditionVerifier.ts';
import { RealityGroundingController } from '../src/organism/system/RealityGroundingController.ts';
import { isTrustedEmbodiedActionResult } from '../src/organism/body/EmbodiedActionExecutor.ts';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';
import { createTrustedEmbodiedActionFixture } from './helpers/trusted-embodied-action-fixture.mjs';

const verifier=new ExternalPostconditionVerifier();
const telemetry=await createTrustedEmbodiedActionFixture('explore');
const receipt=await createTrustedEmbodiedActionFixture('respond');
assert.equal(isTrustedEmbodiedActionResult(telemetry),true);
assert.equal(Object.isFrozen(telemetry),true);
assert.equal(Object.isFrozen(telemetry.consequenceVerification),true);
assert.equal(telemetry.realityClass,'device-telemetry');
assert.equal(telemetry.consequenceVerification.verified,false);
assert.equal(telemetry.consequenceVerification.independent,false);
assert.equal(telemetry.consequenceVerification.changed01,0);
assert.equal(telemetry.effect01,0);

const telemetryVerification=await verifier.assess(telemetry);
const receiptVerification=await verifier.assess(receipt);
assert.equal(telemetryVerification.verified,false);
assert.equal(telemetryVerification.notes,'device-telemetry-is-not-world-observation');
assert.equal(isTrustedEmbodiedOutcomeVerification(telemetryVerification,telemetry),false);
assert.equal(receipt.realityClass,'device-actuation');
assert.equal(receiptVerification.verified,false);
assert.equal(isTrustedEmbodiedOutcomeVerification(receiptVerification,receipt),false);

const camera=await createTrustedEmbodiedActionFixture('explore',{cameraAvailable:true});
assert.equal(camera.realityClass,'camera-artifact');
assert.equal(camera.artifact?.kind,'camera-capture');
assert.equal(camera.consequenceVerification.verified,false);
const cameraVerification=await verifier.assess(camera);
assert.equal(cameraVerification.verified,false);
assert.equal(cameraVerification.notes,'camera-artifact-requires-semantic-world-observation-receipt');
assert.equal(isTrustedEmbodiedOutcomeVerification(cameraVerification,camera),false);

const stale=await createTrustedEmbodiedActionFixture('explore',{staleFirstSample:true});
const staleVerification=await verifier.assess(stale);
assert.equal(isTrustedEmbodiedActionResult(stale),true);
assert.equal(stale.consequenceVerification.independent,false);
assert.equal(stale.consequenceVerification.verified,false);
assert.equal(stale.realityClass,'derived');
assert.equal(staleVerification.verified,false);
assert.equal(isTrustedEmbodiedOutcomeVerification(staleVerification,stale),false);

const copied=structuredClone(telemetry);
assert.equal(isTrustedEmbodiedActionResult(copied),false);
const copiedVerification=await verifier.assess(copied);
assert.equal(copiedVerification.verified,false);
assert.equal(isTrustedEmbodiedOutcomeVerification(copiedVerification,copied),false);

const controller=new RealityGroundingController();
controller.setMode('external-first');
const resolved=controller.resolve({
  tick:1,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:telemetry,postcondition:telemetryVerification,novelty01:.3,resource01:.9,
});
assert.equal(resolved.source,'simulation');
assert.equal(controller.snapshot().externalPrimary,0);
assert.equal(resolved.verified01,0);
assert.equal(resolved.independent01,0);

const copiedAssessment=structuredClone(telemetryVerification);
const copiedAssessmentController=new RealityGroundingController();
copiedAssessmentController.setMode('external-first');
const copiedAssessmentResult=copiedAssessmentController.resolve({
  tick:2,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:telemetry,postcondition:copiedAssessment,novelty01:.3,resource01:.9,
});
assert.equal(copiedAssessmentResult.source,'simulation');

const otherObservation=await createTrustedEmbodiedActionFixture('explore');
const crossRunController=new RealityGroundingController();
crossRunController.setMode('external-first');
const crossRunResult=crossRunController.resolve({
  tick:3,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:otherObservation,postcondition:telemetryVerification,novelty01:.3,resource01:.9,
});
assert.equal(crossRunResult.source,'simulation');

const actionMismatchController=new RealityGroundingController();
actionMismatchController.setMode('external-first');
const actionMismatch=actionMismatchController.resolve({
  tick:4,action:'respond',expectedReward01:.72,predictionConfidence01:.8,
  simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
  embodiedAction:telemetry,postcondition:telemetryVerification,novelty01:.3,resource01:.9,
});
assert.equal(actionMismatch.source,'simulation');

const holdout=new RealityGroundingController();
let early=0;
let lateRow=null;
for(let tick=1;tick<=6;tick++){
  const observation=await createTrustedEmbodiedActionFixture('explore');
  const verification=await verifier.assess(observation);
  lateRow=holdout.resolve({
    tick,action:'explore',expectedReward01:.72,predictionConfidence01:.8,
    simulatedReward01:.3,simulatedSurprise01:.1,simulatedSuccess01:1,
    novelty01:.3,resource01:.9,embodiedAction:observation,postcondition:verification,
  });
  if(tick===1) early=holdout.causalHoldoutReadiness('explore','external',6);
}
const ready=holdout.causalHoldoutReadiness('explore','external',6);
assert.equal(early,0);
assert.equal(ready,0);
assert.equal(lateRow?.source,'simulation');
assert.equal(lateRow?.proofClass,'none');

const world=new GroundedWorldState();
const before=world.snapshot();
const telemetryRow=world.integrateExternalOutcome({
  at:telemetry.at,action:'explore',status:'executed',proofClass:'device-telemetry',
  verified01:0,independent01:0,evidence01:0,consequence01:0,
  claim:'fresh device telemetry only',provenanceId:`telemetry:${telemetry.executionId}`,divergence01:.42,
});
const after=world.snapshot();
assert.equal(telemetryRow.verified01,0);
assert.deepEqual(after.facts,before.facts);
assert.equal(after.confidence01,before.confidence01);
assert.ok(after.events.some(x=>x.id===telemetryRow.eventId && x.label.startsWith('external-receipt:explore')));

const receiptWorld=new GroundedWorldState();
const receiptBefore=receiptWorld.snapshot();
const receiptRow=receiptWorld.integrateExternalOutcome({
  at:receipt.at,action:'respond',status:'executed',proofClass:'stable-device-receipt',
  verified01:0,independent01:0,evidence01:.26,consequence01:.18,
  claim:'command accepted; effect unverified',provenanceId:`receipt:${receipt.executionId}`,divergence01:.7,
});
const receiptAfter=receiptWorld.snapshot();
assert.deepEqual(receiptAfter.facts,receiptBefore.facts);
assert.equal(receiptAfter.confidence01,receiptBefore.confidence01);
assert.ok(receiptAfter.events.some(x=>x.id===receiptRow.eventId && x.label.startsWith('external-receipt:respond')));

console.log(JSON.stringify({ok:true,telemetryVerification,cameraVerification,receiptVerification,holdout:{early,ready}}));
