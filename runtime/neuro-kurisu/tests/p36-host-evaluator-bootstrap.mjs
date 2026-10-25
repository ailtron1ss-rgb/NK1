import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { P36_EXTERNAL_EVIDENCE_TOOL_ID } from '../src/organism/learning/P36AutonomousSelfDevelopment.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import {
  loadP36DevelopmentalOutcomeEvaluatorModule,
  loadP36VerifiedOutcomeLedgerEvaluator,
} from '../src/organism/learning/P36HostEvaluatorBootstrap.ts';

const temporary=await mkdtemp(path.join(os.tmpdir(),'nk-p36-host-bootstrap-'));
try {
  const artifactsDir=path.join(temporary,'signed-artifacts');
  await mkdir(artifactsDir,{recursive:true,mode:0o700});
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const publicPem=publicKey.export({type:'spki',format:'pem'}).toString();
  const privatePem=privateKey.export({type:'pkcs8',format:'pem'}).toString();
  const verifierId='p36-production-like-test-verifier';
  const manifest=Array.from({length:4},(_,index)=>({
    taskId:`host-bootstrap-memory-${index}`,
    family:'memory',
    split:'holdout',
    promptFingerprint:VerifiedOutcomeLedger.fingerprintPrompt(`p36 host bootstrap independent task ${index}`),
    verifierId,
    version:'v1',
  }));
  const manifestFingerprint=new VerifiedOutcomeLedger(manifest).manifestFingerprint();
  const manifestPath=path.join(temporary,'manifest.json');
  const keyringPath=path.join(temporary,'trusted-verifier-keys.json');
  const configPath=path.join(temporary,'p36-ledger-config.json');
  await writeFile(manifestPath,JSON.stringify(manifest,null,2),{mode:0o600});
  await writeFile(keyringPath,JSON.stringify({[verifierId]:publicPem},null,2),{mode:0o600});

  let artifactNo=0;
  const artifactPaths=[];
  for(let seed=0;seed<4;seed++){
    for(let taskIndex=0;taskIndex<manifest.length;taskIndex++){
      const task=manifest[taskIndex];
      for(const method of ['baseline-v1','candidate-v1']){
        const payload={
          schemaVersion:1,
          artifactId:`host-bootstrap-artifact-${method}-seed-${seed}-${task.taskId}`,
          runId:`host-bootstrap-run-${seed}`,
          manifestFingerprint,
          taskId:task.taskId,
          taskVersion:task.version,
          method,
          seed,
          attempt:1,
          passed:method==='candidate-v1'||taskIndex<2,
          verifierId,
          observedAt:Date.now(),
        };
        const artifact=signOutcomePayloadForFixture(payload,privatePem);
        const artifactPath=path.join(artifactsDir,`artifact-${String(++artifactNo).padStart(3,'0')}.json`);
        await writeFile(artifactPath,JSON.stringify(artifact),{mode:0o600});
        artifactPaths.push(artifactPath);
      }
    }
  }
  const config={
    version:1,
    manifestFile:'manifest.json',
    trustedVerifierKeysFile:'trusted-verifier-keys.json',
    artifactsDirectory:'signed-artifacts',
    evaluatorVersion:'p36-host-bootstrap-v1',
    baselineMethod:'baseline-v1',
    treatmentMethod:'candidate-v1',
    taskFamily:'memory',
    sourceId:'p36-host-bootstrap-signed-ledger',
    independenceKey:'p36-host-bootstrap-keyring',
    minimumPairedSeeds:4,
  };
  await writeFile(configPath,JSON.stringify(config,null,2),{mode:0o600});
  // Trust inputs are read-only once provisioned, and the production loader forbids mutable-state paths.
  await chmod(manifestPath,0o400);
  await chmod(keyringPath,0o400);
  await chmod(configPath,0o400);
  for(const artifactPath of artifactPaths) await chmod(artifactPath,0o400);
  await chmod(artifactsDir,0o500);

  const evaluator=await loadP36VerifiedOutcomeLedgerEvaluator(configPath);
  const gateway=new ActionGateway({live:true});
  gateway.registerTool({id:P36_EXTERNAL_EVIDENCE_TOOL_ID,...evaluator});
  const request={
    hypothesisId:'host-bootstrap-hypothesis',
    contextKey:'memory',
    control01:.5,
    treatment01:1,
    holdout:true,
    delayMs:0,
    evaluatorVersion:config.evaluatorVersion,
    evidenceSource:'external-evaluator',
    protocolId:manifestFingerprint,
    baselineMethod:config.baselineMethod,
    treatmentMethod:config.treatmentMethod,
    taskFamily:config.taskFamily,
    manifestFingerprint,
  };
  const measured=await gateway.executeTool(P36_EXTERNAL_EVIDENCE_TOOL_ID,request,'p36-signed-host-bootstrap',{decisionId:'p36-host-bootstrap-test-decision'});
  assert.equal(measured.ok,true);
  assert.equal(measured.verified,true);
  assert.equal(measured.verification.basis,'external-postcondition');
  assert.equal(measured.verification.expectedPostcondition,measured.verification.observedPostcondition);
  assert.match(measured.verification.notes,/signed, authenticated paired holdout outcomes/);
  assert.match(measured.verification.notes,/delayed retention is not asserted/);
  assert.equal(artifactPaths.length,32);
  await assert.rejects(loadP36VerifiedOutcomeLedgerEvaluator(configPath,temporary),/p36-host-bootstrap-config-inside-runtime-writable-state/,
    'signed ledger config must not be loaded from mutable organism state');
  await chmod(configPath,0o600);
  await assert.rejects(loadP36VerifiedOutcomeLedgerEvaluator(configPath),/p36-host-bootstrap-config-must-be-read-only/,
    'host trust config must not be writable by the runtime identity');
  await chmod(configPath,0o400);

  // A private signing key is never accepted as a verifier public-key ring entry.
  await chmod(keyringPath,0o600);
  await writeFile(keyringPath,JSON.stringify({[verifierId]:privatePem}),{mode:0o600});
  await chmod(keyringPath,0o400);
  await assert.rejects(loadP36VerifiedOutcomeLedgerEvaluator(configPath),/p36-host-bootstrap-keyring-entry-invalid/);
  await chmod(keyringPath,0o600);
  await writeFile(keyringPath,JSON.stringify({[verifierId]:publicPem}),{mode:0o600});
  await chmod(keyringPath,0o400);

  // A tampered signed outcome blocks host bootstrap instead of being silently skipped.
  const original=JSON.parse(await readFile(artifactPaths[0],'utf8'));
  original.signature='not-a-valid-signature';
  await chmod(artifactPaths[0],0o600);
  await writeFile(artifactPaths[0],JSON.stringify(original),{mode:0o600});
  await chmod(artifactPaths[0],0o400);
  await assert.rejects(loadP36VerifiedOutcomeLedgerEvaluator(configPath),/p36-host-bootstrap-artifact-rejected-invalid-signature/);

  // Maturity is a separate host-owned module; this loader does not fabricate one.
  const stateDirectory=path.join(temporary,'runtime-state');
  await mkdir(stateDirectory,{recursive:true,mode:0o700});
  const maturityModulePath=path.join(temporary,'delayed-maturity-provider.mjs');
  await writeFile(maturityModulePath,`
export function createP36DevelopmentalOutcomeEvaluator({stateDirectory}) {
  return {
    capability:'learning.maturity.test',
    destructive:false,
    projectAllowed:true,
    observationSource:{
      sourceId:'p36-delayed-maturity-test-source',
      sourceClass:'external-api',
      channel:'tool',
      independenceKey:'p36-delayed-maturity-test-key',
    },
    execute:async(input)=>({ok:true,observationId:'maturity-'+String(input.outcome01)}),
    verify:async({input,result})=>{
      const observationId=String(result.observationId??'');
      const ok=Boolean(input?.delayed===true && observationId);
      return {
        verified:ok,
        basis:ok?'external-postcondition':'none',
        externalObservation:ok,
        confidence01:ok?1:0,
        observationId,
        expectedPostcondition:ok?'delayed-retention-measured:'+observationId:undefined,
        observedPostcondition:ok?'delayed-retention-measured:'+observationId:undefined,
        notes:'fixture only; state directory='+stateDirectory,
      };
    },
  };
}
`,{mode:0o600});
  await chmod(maturityModulePath,0o400);
  await assert.rejects(loadP36DevelopmentalOutcomeEvaluatorModule(maturityModulePath,temporary),/p36-maturity-provider-module-inside-runtime-writable-state/,
    'trusted maturity code cannot live inside mutable organism state');
  const maturity=await loadP36DevelopmentalOutcomeEvaluatorModule(maturityModulePath,stateDirectory);
  assert.equal(maturity.destructive,false);
  assert.equal(typeof maturity.execute,'function');
  assert.equal(typeof maturity.verify,'function');
  assert.notEqual(maturity.observationSource.independenceKey,config.independenceKey);

  console.log('P36_HOST_EVALUATOR_BOOTSTRAP=PASS signatures-reingested=32 private-key-blocked=true tampered-artifact-blocked=true separate-maturity-module=true');
} finally {
  await rm(temporary,{recursive:true,force:true});
}
