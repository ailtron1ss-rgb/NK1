import assert from 'node:assert/strict';
import { PerceptualEvidenceCompiler } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import { ExternalPostconditionVerifier, isTrustedEmbodiedOutcomeVerification } from '../src/organism/system/ExternalPostconditionVerifier.ts';
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
assert.ok(isTrustedEmbodiedOutcomeVerification(proof,action),'test fixture must produce the canonical executor-bound proof');
const forgedProof=structuredClone(proof);
assert.equal(isTrustedEmbodiedOutcomeVerification(forgedProof,action),false,'a JSON copy of a verifier result must not retain its ephemeral capability');

const trustedCompiler=new PerceptualEvidenceCompiler();
const trustedRow=trustedCompiler.recordExternalEvidence({
  at:at+20,claim:'independently verified door postcondition',confidence01:.94,verified:false,
  verification:proof,embodiedAction:action,
});
assert.equal(trustedRow.kind,'observed','exact verifier token plus exact executor result may enter the observed lane');
const untrustedProofRow=untrustedCompiler.recordExternalEvidence({
  at:at+21,claim:'copied verifier result',confidence01:.94,verified:true,
  verification:forgedProof,embodiedAction:action,
});
assert.equal(untrustedProofRow.kind,'derived','copied verifier result plus verified=true remains untrusted');

const trustedSnapshot=trustedCompiler.snapshot();
const groundedTrusted=new GroundedWorldState();
const trustedWorld=groundedTrusted.integrate({at:at+20,evidence:trustedSnapshot});
assert.ok(trustedWorld.facts.includes('observed-evidence:independently verified door postcondition'),
  'GroundedWorldState accepts observed evidence only from the live owner snapshot capability');
const clonedSnapshot=structuredClone(trustedSnapshot);
const groundedClone=new GroundedWorldState();
const clonedWorld=groundedClone.integrate({at:at+20,evidence:clonedSnapshot});
assert.ok(clonedWorld.facts.includes('derived-evidence:independently verified door postcondition'),
  'serialized/copied owner snapshots lose the ephemeral admission capability');

console.log('OBSERVATION_ADMISSION_TRUST_BOUNDARY=PASS');
