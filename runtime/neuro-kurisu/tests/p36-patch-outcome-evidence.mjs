import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import {
  measureP36PatchOutcomeEvidence,
  patchTreatmentMethod,
} from '../src/organism/learning/P36PatchOutcomeEvidenceAuthority.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type:'spki', format:'pem' }).toString();
const privatePem = privateKey.export({ type:'pkcs8', format:'pem' }).toString();
const verifierId='nk1-patch-outcome-test-verifier';
const baseSha='a'.repeat(40);
const patchSha256='b'.repeat(64);
const manifest=Array.from({length:4},(_,index)=>({
  taskId:`patch-outcome-holdout-${index}`,
  family:'self-improvement',
  split:'holdout',
  promptFingerprint:VerifiedOutcomeLedger.fingerprintPrompt(`exact patch evaluation task ${index}`),
  verifierId,
  version:'v1',
}));
const ledger=new VerifiedOutcomeLedger(manifest);
const treatmentMethod=patchTreatmentMethod(patchSha256);
const methods=['baseline-v1',treatmentMethod];
for(let seed=0;seed<4;seed++){
  for(let taskIndex=0;taskIndex<manifest.length;taskIndex++){
    for(const method of methods){
      const task=manifest[taskIndex];
      const payload={
        schemaVersion:1,
        artifactId:`patch-outcome-${method}-seed-${seed}-${task.taskId}`,
        runId:`patch-outcome-run-${seed}`,
        manifestFingerprint:ledger.manifestFingerprint(),
        taskId:task.taskId,
        taskVersion:task.version,
        method,
        seed,
        attempt:1,
        passed:method===treatmentMethod||taskIndex<2,
        verifierId,
        observedAt:Date.now(),
      };
      const artifact=signOutcomePayloadForFixture(payload,privatePem);
      const ingested=ingestSignedOutcomeArtifact(ledger,manifest,artifact,new Map([[verifierId,publicPem]]));
      assert.equal(ingested.accepted,true,ingested.rejection);
    }
  }
}
const hostConfig={
  baseSha,
  ledger,
  manifest,
  evaluatorVersion:'nk1-patch-outcome-v1',
  baselineMethod:'baseline-v1',
  taskFamily:'self-improvement',
  sourceId:'nk1-p36-patch-outcome',
  independenceKey:'nk1-p36-verifier',
  minimumPairedSeeds:4,
};

test('derives patch treatment identity from the exact SHA and measures signed paired holdout outcomes',()=>{
  const evidence=measureP36PatchOutcomeEvidence({candidateId:'candidate-1',baseSha,patchSha256},hostConfig);
  assert.ok(evidence);
  assert.equal(evidence.candidateId,'candidate-1');
  assert.equal(evidence.baseSha,baseSha);
  assert.equal(evidence.patchSha256,patchSha256);
  assert.equal(evidence.treatmentMethod,treatmentMethod);
  assert.equal(evidence.pairedSeedCount,4);
  assert.equal(evidence.baselinePassRate,.5);
  assert.equal(evidence.candidatePassRate,1);
  assert.equal(evidence.absoluteGain,.5);
  assert.equal(evidence.evidenceRefs.length,32);
  assert.match(evidence.evidenceFingerprint,/^[a-f0-9]{64}$/);
});
test('refuses a base SHA that differs from the host-pinned source revision',()=>{
  assert.equal(measureP36PatchOutcomeEvidence({
    candidateId:'candidate-1',baseSha:'c'.repeat(40),patchSha256,
  },hostConfig),null);
});
test('a different patch digest cannot reuse the previous patch holdout outcomes',()=>{
  assert.equal(measureP36PatchOutcomeEvidence({
    candidateId:'candidate-1',baseSha,patchSha256:'d'.repeat(64),
  },hostConfig),null);
});
test('rejects a method identity supplied by the caller instead of deriving it from patch SHA',()=>{
  const result=measureP36PatchOutcomeEvidence({
    candidateId:'candidate-1',baseSha,patchSha256,treatmentMethod:'baseline-v1',
  },hostConfig);
  assert.ok(result);
  assert.equal(result.treatmentMethod,treatmentMethod);
});
test('refuses malformed patch identities and invalid host configurations',()=>{
  assert.equal(measureP36PatchOutcomeEvidence({candidateId:'',baseSha,patchSha256},hostConfig),null);
  assert.equal(measureP36PatchOutcomeEvidence({candidateId:'candidate-1',baseSha,patchSha256:'bad'},hostConfig),null);
  assert.throws(()=>measureP36PatchOutcomeEvidence({candidateId:'candidate-1',baseSha,patchSha256},
    {...hostConfig,minimumPairedSeeds:2}),/minimum-paired-seeds-invalid/);
});
test('never counts ledger rows that have no authenticated signed artifact receipt',()=>{
  const unauthenticated=new VerifiedOutcomeLedger(manifest);
  for(let seed=0;seed<4;seed++)for(const task of manifest)for(const method of methods){
    unauthenticated.record({
      taskId:task.taskId,taskVersion:task.version,method,seed,attempt:1,
      passed:true,authority:'independent-verifier',verifierId,
      evidenceRef:`unsigned-row-${seed}-${task.taskId}-${method}`,observedAt:Date.now(),
    });
  }
  assert.equal(measureP36PatchOutcomeEvidence({candidateId:'candidate-1',baseSha,patchSha256},
    {...hostConfig,ledger:unauthenticated}),null);
});
test('does not infer delayed retention from point-in-time P36 holdout evidence',()=>{
  const result=measureP36PatchOutcomeEvidence({candidateId:'candidate-1',baseSha,patchSha256},hostConfig);
  assert.equal(result?.delayMs,0);
  assert.equal(result?.evidenceScope,'point-in-time-holdout-only');
});
