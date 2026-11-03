import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { captureReadSet } from './neurok-os-readset.mjs';
import { inspectUnifiedDiff } from './neurok-os-patch.mjs';

const patchModule=await import('./neurok-os-patch.mjs');
const PATCH=`diff --git a/src/core.mjs b/src/core.mjs
--- a/src/core.mjs
+++ b/src/core.mjs
@@ -1 +1 @@
-export const value = 1;
+export const value = 2;
`;
const ADD_PATCH=`diff --git a/src/new.mjs b/src/new.mjs
--- /dev/null
+++ b/src/new.mjs
@@ -0,0 +1 @@
+export const created = true;
`;
const POLICY={
 schemaVersion:1,denyPrefixes:[],denyExactPaths:[],
 humanApprovalPrefixes:[],humanApprovalExactPaths:[],
};

async function fixture(run){
 const root=await mkdtemp(path.join(os.tmpdir(),'neurok-os-admission-'));
 try{
  execFileSync('git',['init','-b','main'],{cwd:root,stdio:'ignore'});
  execFileSync('git',['config','user.name','NK1 admission test'],{cwd:root});
  execFileSync('git',['config','user.email','nk1-admission@example.invalid'],{cwd:root});
  await mkdir(path.join(root,'src'),{recursive:true});
  await writeFile(path.join(root,'src/core.mjs'),'export const value = 1;'+String.fromCharCode(10));
  await writeFile(path.join(root,'docs.md'),'task context'+String.fromCharCode(10));
  const baseSha=commit(root,'base');
  await run({root,baseSha});
 }finally{
  await rm(root,{recursive:true,force:true});
 }
}
function commit(root,message){
 execFileSync('git',['add','-A'],{cwd:root});
 execFileSync('git',['commit','-m',message],{cwd:root,stdio:'ignore'});
 return execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
}
function admission(inspection,receipt,options){
 assert.equal(typeof patchModule.evaluatePatchAdmission,'function',
  'patch admission must require a read-set freshness decision');
 return patchModule.evaluatePatchAdmission(inspection,receipt,options);
}

test('blocks patch admission when no read-set admission mechanism exists',()=>{
 assert.equal(typeof patchModule.evaluatePatchAdmission,'function',
  'patch admission must require a read-set freshness decision');
});

test('admits only a patch whose pre-existing target is covered by a fresh exact-base read-set',async()=>fixture(async({root,baseSha})=>{
 const receipt=captureReadSet(['src/core.mjs','docs.md'],{root,baseSha});
 const result=admission(inspectUnifiedDiff(PATCH),receipt,{
  root,currentSha:baseSha,expectedBaseSha:baseSha,policy:POLICY,
 });
 assert.equal(result.decision,'reviewable');
 assert.equal(result.readSet.ok,true);
 assert.deepEqual(result.requiredReadPaths,['src/core.mjs']);
 assert.deepEqual(result.coveredReadPaths,['src/core.mjs']);
}));

test('blocks a patch when a modified source file is absent from the declared read-set',async()=>fixture(async({root,baseSha})=>{
 const receipt=captureReadSet(['docs.md'],{root,baseSha});
 const result=admission(inspectUnifiedDiff(PATCH),receipt,{
  root,currentSha:baseSha,expectedBaseSha:baseSha,policy:POLICY,
 });
 assert.equal(result.decision,'blocked');
 assert.equal(result.reason,'missing-patch-target-context');
 assert.deepEqual(result.missingReadPaths,['src/core.mjs']);
}));

test('blocks a patch when a declared source dependency changed after the task read it',async()=>fixture(async({root,baseSha})=>{
 const receipt=captureReadSet(['src/core.mjs'],{root,baseSha});
 await writeFile(path.join(root,'src/core.mjs'),'export const value = 99;'+String.fromCharCode(10));
 const currentSha=commit(root,'change read dependency');
 const result=admission(inspectUnifiedDiff(PATCH),receipt,{
  root,currentSha,expectedBaseSha:baseSha,policy:POLICY,
 });
 assert.equal(result.decision,'blocked');
 assert.equal(result.reason,'stale-read-set');
 assert.deepEqual(result.readSet.stalePaths,[{path:'src/core.mjs',reason:'content-changed'}]);
}));

test('blocks a receipt captured against a different task base SHA',async()=>fixture(async({root,baseSha})=>{
 const receipt=captureReadSet(['src/core.mjs'],{root,baseSha});
 await writeFile(path.join(root,'docs.md'),'later context'+String.fromCharCode(10));
 const laterSha=commit(root,'later unrelated commit');
 const result=admission(inspectUnifiedDiff(PATCH),receipt,{
  root,currentSha:laterSha,expectedBaseSha:laterSha,policy:POLICY,
 });
 assert.equal(result.decision,'blocked');
 assert.equal(result.reason,'task-base-mismatch');
}));

test('does not require a read-set entry for a newly added path',async()=>fixture(async({root,baseSha})=>{
 const receipt=captureReadSet(['docs.md'],{root,baseSha});
 const result=admission(inspectUnifiedDiff(ADD_PATCH),receipt,{
  root,currentSha:baseSha,expectedBaseSha:baseSha,policy:POLICY,
 });
 assert.equal(result.decision,'reviewable');
 assert.deepEqual(result.requiredReadPaths,[]);
}));

test('keeps policy denial authoritative after read-set verification',async()=>fixture(async({root,baseSha})=>{
 const receipt=captureReadSet(['src/core.mjs'],{root,baseSha});
 const policy={...POLICY,denyExactPaths:['src/core.mjs']};
 const result=admission(inspectUnifiedDiff(PATCH),receipt,{
  root,currentSha:baseSha,expectedBaseSha:baseSha,policy,
 });
 assert.equal(result.decision,'deny');
 assert.equal(result.readSet.ok,true);
}));

test('rejects .git metadata paths before policy classification',()=>{
  for (const target of ['.git/config', 'tools/.git/index']) {
    const malicious = PATCH.replaceAll('src/core.mjs', target);
    assert.throws(() => inspectUnifiedDiff(malicious), /unsafe patch path/);
  }
});

test('preserves mandatory human approval after read-set verification',async()=>fixture(async({root,baseSha})=>{
  const receipt=captureReadSet(['src/core.mjs'],{root,baseSha});
  const policy={...POLICY,humanApprovalPrefixes:['src/']};
  const result=admission(inspectUnifiedDiff(PATCH),receipt,{
    root,currentSha:baseSha,expectedBaseSha:baseSha,policy,
  });
  assert.equal(result.decision,'human-approval-required');
  assert.equal(result.readSet.ok,true);
}));

test('fails closed for missing or malformed admission inputs',()=>{
 const result=admission(inspectUnifiedDiff(PATCH),null,{
  currentSha:'invalid',expectedBaseSha:'invalid',policy:POLICY,
 });
 assert.equal(result.decision,'blocked');
 assert.equal(result.reason,'invalid-read-set');
});
