import assert from 'node:assert/strict';
import { ExternalPostconditionVerifier, isTrustedEmbodiedOutcomeVerification } from '../src/organism/system/ExternalPostconditionVerifier.ts';
import { RealityGroundingController } from '../src/organism/system/RealityGroundingController.ts';
import { RealityLearningGate } from '../src/organism/system/RealityLearningGate.ts';
import { createTrustedEmbodiedActionFixture } from './helpers/trusted-embodied-action-fixture.mjs';

const callerId='exec-caller-controlled-00000001';
const first=await createTrustedEmbodiedActionFixture('explore',{executionId:callerId});
const second=await createTrustedEmbodiedActionFixture('explore',{executionId:callerId});
assert.notEqual(first.executionId,callerId);
assert.notEqual(second.executionId,callerId);
assert.notEqual(first.executionId,second.executionId,'replayed caller keys must not collide with executor-minted identities');

const verifier=new ExternalPostconditionVerifier();
const firstVerification=await verifier.assess(first);
assert.equal(first.realityClass,'device-telemetry');
assert.equal(first.consequenceVerification.verified,false);
assert.equal(first.consequenceVerification.independent,false);
assert.equal(first.consequenceVerification.freshBefore01,1);
assert.equal(first.consequenceVerification.freshAfter01,1);
assert.equal(first.consequenceVerification.changed01,0);
assert.equal(first.effect01,0);
assert.equal(firstVerification.verified,false);
assert.equal(firstVerification.notes,'device-telemetry-is-not-world-observation');
assert.equal(isTrustedEmbodiedOutcomeVerification(firstVerification,first),false);

const camera=await createTrustedEmbodiedActionFixture('explore',{cameraAvailable:true,executionId:callerId});
const cameraVerification=await verifier.assess(camera);
assert.equal(camera.realityClass,'camera-artifact');
assert.equal(camera.artifact?.kind,'camera-capture');
assert.equal(cameraVerification.verified,false);
assert.equal(cameraVerification.notes,'camera-artifact-requires-semantic-world-observation-receipt');
assert.equal(isTrustedEmbodiedOutcomeVerification(cameraVerification,camera),false);

const controller=new RealityGroundingController();
controller.setMode('external-first');
const grounded=controller.resolve({
  tick:1,action:'explore',expectedReward01:.7,predictionConfidence01:.8,
  simulatedReward01:.4,simulatedSurprise01:.2,simulatedSuccess01:1,
  embodiedAction:first,postcondition:firstVerification,novelty01:.5,resource01:.9,
});
assert.equal(grounded.source,'simulation');
assert.equal(grounded.verified01,0);
assert.equal(grounded.independent01,0);
assert.equal(controller.snapshot().externalPrimary,0);
assert.ok(grounded.reason.includes('device-telemetry-is-not-world-observation'));

const gate=new RealityLearningGate();
const blocked=gate.decide({
  source:'external',evidence01:.99,verified01:1,independent01:1,consequence01:1,
  predictionError01:.9,surprise01:.9,reward01:1,success01:1,actuation:false,resource01:1,
  embodiedAction:first,postconditionVerification:firstVerification,
});
assert.equal(blocked.learningScale01,0);
assert.equal(blocked.memoryPromotionScale01,0);
assert.equal(blocked.identityUpdateScale01,0);

console.log(JSON.stringify({ok:true,executionIds:[first.executionId,second.executionId],telemetry:firstVerification,camera:cameraVerification,grounded,blocked}));
