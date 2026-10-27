import assert from 'node:assert/strict';
import { OutcomeCognitionFabric } from '../src/organism/system/OutcomeCognitionFabric.ts';
import { sha256Stable } from '../src/organism/core/StableSerialization.ts';

const f=new OutcomeCognitionFabric();
const v={verified:true,basis:'external-postcondition',confidence01:.93,externalObservation:true,observationId:'obs-fabric-1',expectedPostcondition:'door=open',observedPostcondition:'door=open'};
const a=f.project({tick:7,tool:'door.open',ok:true,verification:v,reason:'goal:test',inputKeys:['room'],predictedAction:'verify',predictionConfidence01:.71});
assert.equal(a.verifiedExternal,true);
assert.ok(a.causal.nodes.some(n=>n.kind==='prediction'));
assert.ok(a.causal.nodes.some(n=>n.kind==='verification'));
assert.equal(a.causal.nodes.some(n=>n.kind==='learning'), false, 'a tool verifier without source identity may verify this receipt but cannot assign learning credit');
const s=f.snapshot(); const g=new OutcomeCognitionFabric(); g.restore(s); assert.equal(g.summary().records,1); assert.equal(g.summary().causal.verificationNodes,1);
const weak=f.project({tick:8,tool:'door.inspect',ok:true,verification:{verified:false,basis:'none',confidence01:0,externalObservation:false},reason:'inspect'});
assert.equal(weak.verifiedExternal,false); assert.equal(f.summary().causal.predictionErrors,0, 'unknown outcome without evidence must not be counted as a prediction error');

// Defense in depth: even a caller that bypasses OutcomeVerificationService cannot
// turn a tool-contract ACK into an external learning signal.
const malformed=f.project({tick:9,tool:'door.write',ok:true,executionId:'exec-forged-external',verification:{verified:true,basis:'tool-contract',confidence01:1,externalObservation:true,observationId:'self-asserted-ack'}});
assert.equal(malformed.verifiedExternal,false);
assert.equal(malformed.verificationRecord.verified,false);
assert.equal(malformed.verificationRecord.externalObservation,false);
assert.equal(malformed.causal.nodes.some(n=>n.kind==='learning' && String(n.label||'').includes('verified-external-outcome:door.write')),false);

const missingIdentity=f.project({tick:10,tool:'door.write',ok:true,executionId:'exec-missing-observation-id',verification:{verified:true,basis:'external-postcondition',confidence01:1,externalObservation:true}});
assert.equal(missingIdentity.verifiedExternal,false);
assert.equal(missingIdentity.verificationRecord.verified,false);
// An external observer with a stable independent source key and high-confidence
// matching postcondition may assign positive evidence-linked learning.
const learner=new OutcomeCognitionFabric();
learner.project({tick:11,tool:'door.open',ok:true,executionId:'exec-learning-with-source',verification:{verified:false,basis:'none',confidence01:0,externalObservation:false}});
const observed=learner.resolveExternalObservation({tick:12,tool:'door.open',executionId:'exec-learning-with-source',observationId:'external-door-observed',verified:true,confidence01:.91,assessment:'match',sourceId:'door-sensor-a',sourceClass:'device',independenceKey:'door-sensor-bus-a',expectedPostcondition:'door=open',observedPostcondition:'door=open'});
assert.equal(observed.resolved,true);
assert.ok(observed.causal.nodes.some(n=>n.kind==='learning'&&n.data?.observationId==='external-door-observed'&&n.data?.evidenceThresholdMet===true));

// Restored projection-index entries must agree with the canonical execution ID and the
// immutable fingerprint. A stale, mismatched or conflicting entry is rebuilt from records.
const indexIntegrityInput={tick:13,tool:'storage.write',ok:true,executionId:'exec-restore-index-integrity',verification:{verified:true,basis:'tool-contract',confidence01:.84,externalObservation:false}};
const indexIntegritySource=new OutcomeCognitionFabric();
const indexIntegrityOriginal=indexIntegritySource.project(indexIntegrityInput);
const originalIndexSnapshot=indexIntegritySource.snapshot();
assert.equal(originalIndexSnapshot.projectionIndex.length,1);
const identityTamperSnapshot=structuredClone(originalIndexSnapshot);
identityTamperSnapshot.projectionIndex[0].record.executionId='exec-forged-other-operation';
const identityRestored=new OutcomeCognitionFabric();
identityRestored.restore(identityTamperSnapshot);
const identityReplay=identityRestored.project(indexIntegrityInput);
assert.equal(identityReplay.verificationRecord.executionId,indexIntegrityInput.executionId,'restored index record must not substitute another execution identity');
assert.equal(identityReplay.verificationRecord.tool,indexIntegrityInput.tool);
assert.equal(identityRestored.snapshot().projectionIndex[0].executionId,indexIntegrityInput.executionId);

const fingerprintTamperSnapshot=structuredClone(originalIndexSnapshot);
fingerprintTamperSnapshot.projectionIndex[0].fingerprint='a'.repeat(64);
const fingerprintRestored=new OutcomeCognitionFabric();
fingerprintRestored.restore(fingerprintTamperSnapshot);
const fingerprintReplay=fingerprintRestored.project(indexIntegrityInput);
assert.equal(fingerprintReplay.verificationRecord.executionId,indexIntegrityInput.executionId,'a well-formed but stale fingerprint must not poison same-key replay');
assert.equal(fingerprintRestored.snapshot().projectionIndex[0].fingerprint,originalIndexSnapshot.projectionIndex[0].fingerprint);
const confidenceTamperSnapshot=structuredClone(originalIndexSnapshot);
confidenceTamperSnapshot.projectionIndex[0].record.confidence01=1.5;
const confidenceRestored=new OutcomeCognitionFabric();
confidenceRestored.restore(confidenceTamperSnapshot);
const confidenceReplay=confidenceRestored.project(indexIntegrityInput);
assert.equal(confidenceReplay.verificationRecord.confidence01,.84,'restored index must not surface a confidence outside [0,1]');
assert.equal(confidenceRestored.snapshot().projectionIndex[0].record.confidence01,.84,'invalid index confidence must be rebuilt from retained canonical records');

const conflictingDuplicateSnapshot=structuredClone(originalIndexSnapshot);
conflictingDuplicateSnapshot.projectionIndex.push({
  ...structuredClone(conflictingDuplicateSnapshot.projectionIndex[0]),
  record:{...structuredClone(conflictingDuplicateSnapshot.projectionIndex[0].record),externalObservations:[{observationId:'forged-observation',verified:true,confidence01:1}]},
});
const conflictRestored=new OutcomeCognitionFabric();
conflictRestored.restore(conflictingDuplicateSnapshot);
const conflictReplay=conflictRestored.project(indexIntegrityInput);
assert.equal(conflictReplay.verificationRecord.executionId,indexIntegrityInput.executionId,'conflicting duplicate index entries must recover from retained canonical records');
assert.equal(conflictReplay.verificationRecord.tool,indexIntegrityInput.tool);
assert.equal(conflictRestored.snapshot().projectionIndex.length,1,'conflicting duplicate index entries must collapse to one canonical execution');
// The projection index is a cache, not an alternate authority for mutable external evidence.
const mutableEvidenceTamperSnapshot=structuredClone(originalIndexSnapshot);
mutableEvidenceTamperSnapshot.projectionIndex[0].record.externalObservations=[{observationId:'forged-observation',verified:true,confidence01:1,at:1,assessment:'match',sourceId:'fake-sensor',sourceClass:'device',independenceKey:'fake-bus'}];
mutableEvidenceTamperSnapshot.projectionIndex[0].record.externalEvidenceStatus='corroborated';
// Recompute the cache-row digest to model a self-consistent stale cache; retained canonical data still wins.
mutableEvidenceTamperSnapshot.projectionIndex[0].recordDigest=sha256Stable(mutableEvidenceTamperSnapshot.projectionIndex[0].record);
const mutableEvidenceRestored=new OutcomeCognitionFabric();
mutableEvidenceRestored.restore(mutableEvidenceTamperSnapshot);
const restoredMutableEvidence=mutableEvidenceRestored.snapshot();
assert.deepEqual(restoredMutableEvidence.records[0].externalObservations,originalIndexSnapshot.records[0].externalObservations,'cached index data must not add unobserved external evidence to the canonical record');
assert.equal(restoredMutableEvidence.records[0].externalEvidenceStatus,originalIndexSnapshot.records[0].externalEvidenceStatus,'cached index data must not upgrade external evidence status');
assert.deepEqual(restoredMutableEvidence.projectionIndex[0].record.externalObservations,originalIndexSnapshot.records[0].externalObservations,'index cache must be rebuilt from the canonical record when both exist');
// Corrupt control characters in restored external evidence are rejected instead of becoming replay metadata.
const controlCharacterSnapshot=structuredClone(originalIndexSnapshot);
const invalidExternalObservation={observationId:'bad\u0000observation',verified:true,confidence01:1,at:1,assessment:'match',sourceId:'device-a',sourceClass:'device',independenceKey:'device-bus'};
controlCharacterSnapshot.records[0].externalObservations=[invalidExternalObservation];
controlCharacterSnapshot.projectionIndex[0].record.externalObservations=[invalidExternalObservation];
controlCharacterSnapshot.projectionIndex[0].recordDigest=sha256Stable(controlCharacterSnapshot.projectionIndex[0].record);
const controlCharacterRestored=new OutcomeCognitionFabric();
controlCharacterRestored.restore(controlCharacterSnapshot);
assert.equal(controlCharacterRestored.snapshot().records.length,0,'malformed external observation must not be retained as a canonical outcome record');
assert.equal(controlCharacterRestored.snapshot().projectionIndex.length,0,'malformed external observation must not survive through the replay index');

console.log('BIG_PASS_63_OUTCOME_COGNITION_FABRIC=PASS records='+f.summary().records+' nodes='+f.summary().causal.nodes+' edges='+f.summary().causal.edges+' external-evidence-contract=fail-closed learning=provenance-gated');
