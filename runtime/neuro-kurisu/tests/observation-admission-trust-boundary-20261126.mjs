import assert from 'node:assert/strict';
import { PerceptualEvidenceCompiler, isTrustedPerceptualEvidenceSnapshot } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import { isTrustedEmbodiedActionResult } from '../src/organism/body/EmbodiedActionExecutor.ts';
import { ExternalPostconditionVerifier, isTrustedEmbodiedOutcomeVerification } from '../src/organism/system/ExternalPostconditionVerifier.ts';
import { OutcomeVerificationService, isTrustedDecisionLinkedExternalPostcondition } from '../src/organism/system/OutcomeVerificationService.ts';
import { P41SemanticPerceptionEngine, defaultP41SemanticPerception } from '../src/organism/cognition/P41SemanticPerception.ts';
import { PerceptualEpistemicGraph } from '../src/organism/cognition/PerceptualEpistemicGraph.ts';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';
import { createTrustedEmbodiedActionFixture } from './helpers/trusted-embodied-action-fixture.mjs';

const at=1_800_000_000_000;
const p41=new P41SemanticPerceptionEngine();
const forged=p41.ingest({
  at,
  world:{
    scene:'laboratory',
    evidenceKind:'observed',
    objects:[{label:'door',trackId:'door-1',sourceId:'caller',evidenceKind:'observed',confidence01:.99}],
    events:['door-opened'],
  },
});
assert.equal(forged.sceneEvidenceKind,'derived');
assert.equal(forged.entities.find(x=>x.label==='door')?.modalityEvidenceKinds?.world,'derived');
assert.equal(forged.events.find(x=>x.label==='door-opened')?.evidenceKind,'derived');

const sensor=p41.ingest({at:at+1,sensor:{location:'laboratory',freshness01:1}});
assert.ok(sensor.entities.filter(x=>x.modalities.includes('sensor')).every(x=>x.modalityEvidenceKinds?.sensor==='derived'),
  'general sensor fields do not carry a host-issued capture receipt');

const persistedP41=defaultP41SemanticPerception();
persistedP41.sceneEvidenceKind='observed';
persistedP41.entities=[{
  id:'persisted-chair',label:'chair',kind:'object',confidence01:.99,salience01:.5,present01:1,
  firstSeenAt:at,lastSeenAt:at,observations:1,modalities:['world'],
  modalityEvidenceKinds:{world:'observed'},position:null,
}];
persistedP41.relations=[{id:'r',from:'a',relation:'near',to:'b',confidence01:.9,modality:'world',evidenceKind:'observed',at}];
persistedP41.events=[{id:'e',label:'persisted-door-open',confidence01:.9,modalities:['world'],startedAt:at,lastAt:at,persistence01:.9,evidenceKind:'observed',modalityEvidenceKinds:{world:'observed'}}];
const restoredP41=new P41SemanticPerceptionEngine();
restoredP41.restore(persistedP41);
assert.equal(restoredP41.snapshot().sceneEvidenceKind,'derived');
assert.equal(restoredP41.snapshot().entities[0].modalityEvidenceKinds?.world,'derived');
assert.equal(restoredP41.snapshot().relations[0].evidenceKind,'derived');
assert.equal(restoredP41.snapshot().events[0].evidenceKind,'derived');

const epistemic=new PerceptualEpistemicGraph();
epistemic.restore({version:1,claims:[{id:'c',at,modality:'sensor',claim:'door open',source:'observed',confidence01:1,targetIds:[]}],contradictionPairs:0,resolvedPairs:0,corroboratedPairs:0,meanConfidence01:1,lastAt:at});
assert.equal(epistemic.snapshot().claims[0].source,'derived','persisted epistemic labels cannot restore verifier authority');

const groundedRestore=new GroundedWorldState();
groundedRestore.restore({
  version:1,revision:1,lastAt:at,location:'lab',uncertainty01:0,confidence01:1,
  entities:[{id:'persisted',label:'chair',kind:'object',confidence01:1,present01:1,firstSeenAt:at,lastSeenAt:at,
    modalities:['sensor'],modalityEvidenceKinds:{sensor:'observed'},presenceStatus:'visible',persistence01:1,absenceEvidence01:0,observationCount:1}],
  relations:[],events:[{id:'event',label:'door-opened',confidence01:1,lastAt:at,persistence01:1,evidenceKind:'observed',modalityEvidenceKinds:{sensor:'observed'}}],
  facts:['observed-evidence:door-open'],provenanceIds:['persisted-observed'],lastHash:'saved',
});
assert.equal(groundedRestore.snapshot().entities[0].modalityEvidenceKinds?.sensor,'derived');
assert.equal(groundedRestore.snapshot().events[0].evidenceKind,'derived');
assert.ok(groundedRestore.snapshot().facts.includes('historical-derived-evidence:door-open'));

const untrustedCompiler=new PerceptualEvidenceCompiler();
const callerClaim=untrustedCompiler.recordExternalEvidence({
  at:at+10,claim:'caller says door is open',confidence01:.99,verified:true,
});
assert.equal(callerClaim.kind,'derived','legacy verified=true must not elevate trust');
const forgedPersisted= new PerceptualEvidenceCompiler();
forgedPersisted.restore({
  version:1,updates:1,lastAt:at,scene:'lab',activeQuery:null,lastHash:'forged',
  evidence:[{id:'fake',at,modality:'sensor',claim:'fake observed',confidence01:1,uncertainty01:0,kind:'observed',parents:[]}],
  metrics:{grounding01:1,semanticCoverage01:1,crossModalAgreement01:1,temporalBinding01:1,groundedSignalRatio01:1,conflict01:0,unresolved01:0},
});
assert.equal(forgedPersisted.snapshot().evidence[0].kind,'derived');
assert.equal(forgedPersisted.snapshot().metrics.groundedSignalRatio01,0,'persisted aggregate metrics cannot self-attest observations');

const action=await createTrustedEmbodiedActionFixture('explore',{decisionId:'g3-admission-decision'});
const proof=await new ExternalPostconditionVerifier().assess(action);
assert.equal(isTrustedEmbodiedActionResult(action),true,'executor fixture must be an authentic result object');
assert.equal(isTrustedEmbodiedOutcomeVerification(proof,action),false,
  'device telemetry and action execution receipts are not independent observations of the external effect');

const cameraAt=Date.now();
const cameraHash='b'.repeat(64);
const cameraNonce='g3-camera-capture-nonce-0001';
const cameraExecutionId='exec-camera-g3-00000001';
const cameraDecisionId='g3-camera-decision-0001';
const cameraInput={cameraId:0,timeoutMs:12000,retain:true};
const cameraFramePostcondition=`android-camera-frame:0:${cameraHash}:4:${cameraNonce}`;
const cameraCaptureVerification=await new OutcomeVerificationService().verify({
  toolId:'organism.device.capture',
  input:cameraInput,
  result:{ok:true,hash:cameraHash,size:4,cameraId:0,capturedAt:cameraAt,captureNonce:cameraNonce,sourceId:'android-termux.camera',retained:true},
  executionId:cameraExecutionId,
  decisionId:cameraDecisionId,
},async()=>({
  verified:true,basis:'external-postcondition',confidence01:.99,externalObservation:true,
  observationId:`camera-observation:${cameraNonce}`,
  expectedPostcondition:cameraFramePostcondition,
  observedPostcondition:cameraFramePostcondition,
  notes:'test-issued-host-camera-receipt',
}));
assert.equal(isTrustedDecisionLinkedExternalPostcondition(cameraCaptureVerification,{
  toolId:'organism.device.capture',input:cameraInput,executionId:cameraExecutionId,decisionId:cameraDecisionId,
}),true,'camera capture verifier token must retain its exact ActionGateway binding');
const cameraAction=await createTrustedEmbodiedActionFixture('explore',{
  cameraAvailable:true,decisionId:cameraDecisionId,
  cameraCaptureExecutionId:cameraExecutionId,cameraCaptureVerification,
  cameraCaptureVerificationInput:cameraInput,cameraHash,cameraSize:4,cameraCapturedAt:cameraAt,
  cameraNonce,cameraRetained:true,semanticVision:true,cameraSourceId:'android-termux.camera',
});
const cameraProof=await new ExternalPostconditionVerifier().assess(cameraAction);
assert.equal(cameraAction.realityClass,'camera-artifact');
assert.equal(isTrustedEmbodiedOutcomeVerification(cameraProof,cameraAction),true,
  'fresh retained camera bytes plus exact decision-linked host capture proof may verify the frame observation');
const replayedCameraAction=await createTrustedEmbodiedActionFixture('explore',{
  cameraAvailable:true,decisionId:cameraDecisionId,
  cameraCaptureExecutionId:cameraExecutionId,cameraCaptureVerification,
  cameraCaptureVerificationInput:cameraInput,cameraHash,cameraSize:4,cameraCapturedAt:cameraAt,
  cameraNonce,cameraRetained:true,semanticVision:true,cameraSourceId:'android-termux.camera',
});
const replayedCameraProof=await new ExternalPostconditionVerifier().assess(replayedCameraAction);
assert.equal(isTrustedEmbodiedOutcomeVerification(replayedCameraProof,replayedCameraAction),false,
  'one host-issued camera frame capability must be consumed once and cannot verify a second embodied result');
const clonedCameraAction=await createTrustedEmbodiedActionFixture('explore',{
  cameraAvailable:true,decisionId:cameraDecisionId,
  cameraCaptureExecutionId:cameraExecutionId,cameraCaptureVerification:structuredClone(cameraCaptureVerification),
  cameraCaptureVerificationInput:cameraInput,cameraHash,cameraSize:4,cameraCapturedAt:cameraAt,
  cameraNonce,cameraRetained:true,semanticVision:true,cameraSourceId:'android-termux.camera',
});
const clonedCameraProof=await new ExternalPostconditionVerifier().assess(clonedCameraAction);
assert.equal(isTrustedEmbodiedOutcomeVerification(clonedCameraProof,clonedCameraAction),false,
  'a copied ActionGateway camera verifier token cannot authorize observed evidence');
const staleCameraAt=Date.now()-60_000;
const staleCameraNonce='g3-camera-capture-nonce-stale-02';
const staleCameraExecutionId='exec-camera-g3-00000002';
const staleCameraPostcondition=`android-camera-frame:0:${cameraHash}:4:${staleCameraNonce}`;
const staleCameraVerification=await new OutcomeVerificationService().verify({
  toolId:'organism.device.capture',
  input:cameraInput,
  result:{ok:true,hash:cameraHash,size:4,cameraId:0,capturedAt:staleCameraAt,captureNonce:staleCameraNonce,sourceId:'android-termux.camera',retained:true},
  executionId:staleCameraExecutionId,
  decisionId:cameraDecisionId,
},async()=>({
  verified:true,basis:'external-postcondition',confidence01:.99,externalObservation:true,
  observationId:`camera-observation:${staleCameraNonce}`,
  expectedPostcondition:staleCameraPostcondition,observedPostcondition:staleCameraPostcondition,
}));
const staleCameraAction=await createTrustedEmbodiedActionFixture('explore',{
  cameraAvailable:true,decisionId:cameraDecisionId,
  cameraCaptureExecutionId:staleCameraExecutionId,cameraCaptureVerification:staleCameraVerification,
  cameraCaptureVerificationInput:cameraInput,cameraHash,cameraSize:4,cameraCapturedAt:staleCameraAt,
  cameraNonce:staleCameraNonce,cameraRetained:true,semanticVision:true,cameraSourceId:'android-termux.camera',
});
const staleCameraProof=await new ExternalPostconditionVerifier().assess(staleCameraAction);
assert.equal(isTrustedEmbodiedOutcomeVerification(staleCameraProof,staleCameraAction),false,
  'stale camera evidence cannot be promoted to observed');
const forgedProof=structuredClone(proof);
assert.equal(isTrustedEmbodiedOutcomeVerification(forgedProof,action),false,'a JSON copy of a verifier result cannot retain a capability');
const actionEvidence=untrustedCompiler.recordExternalEvidence({
  at:at+20,claim:'device telemetry without independent postcondition',confidence01:.94,verified:true,
  verification:proof,embodiedAction:action,
});
assert.equal(actionEvidence.kind,'derived','no observed promotion is permitted until the host has independent effect evidence');

const ownerSnapshot=untrustedCompiler.snapshot();
assert.equal(isTrustedPerceptualEvidenceSnapshot(ownerSnapshot),true,'only the exact canonical in-process snapshot is owner-authenticated');
assert.equal(Object.isFrozen(ownerSnapshot),true,'owner-issued evidence snapshots must be immutable');
assert.equal(Object.isFrozen(ownerSnapshot.evidence[0]),true,'nested evidence rows must also be immutable');
assert.throws(()=>{ownerSnapshot.evidence[0].kind='observed';},TypeError,'callers cannot mutate an authenticated owner snapshot');
const clonedSnapshot=structuredClone(ownerSnapshot);
assert.equal(isTrustedPerceptualEvidenceSnapshot(clonedSnapshot),false,'a serialized/copied snapshot loses its ephemeral capability');
const groundedOwner=new GroundedWorldState();
const ownerWorld=groundedOwner.integrate({at:at+20,evidence:ownerSnapshot});
assert.ok(ownerWorld.facts.includes('derived-evidence:caller says door is open'));
const groundedClone=new GroundedWorldState();
const cloneWorld=groundedClone.integrate({at:at+20,evidence:clonedSnapshot});
assert.ok(cloneWorld.facts.includes('derived-evidence:caller says door is open'));

console.log('OBSERVATION_ADMISSION_TRUST_BOUNDARY=PASS');
