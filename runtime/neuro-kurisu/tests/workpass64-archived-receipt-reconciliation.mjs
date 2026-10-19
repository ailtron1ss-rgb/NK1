import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { FileActionExecutionLedgerArchive } from '../src/organism/persistence/FileActionExecutionLedgerArchive.ts';
import { sha256Stable } from '../src/organism/core/StableSerialization.ts';

const temp = async () => mkdtemp(path.join(os.tmpdir(), 'nk-workpass64-'));
const unresolvedResponse = (executionId, toolId='test.workpass64.device.set-state') => ({
  ok:true, verified:false, executionId, tool:toolId, capability:'device.set-state',
  result:{ok:true,accepted:true},
  audit:{at:Date.now(),executionId,action:'tool',tool:toolId,accepted:true,mode:'live',reason:'initial-result-unverified',verified:false,outcomeClass:'executed-unverified'},
  verification:{verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'initial provider result lacked postcondition evidence'},
  outcomeClass:'executed-unverified',
});

// Completed-but-unverified outcomes must not be spilled merely to free capacity.
{
  const dir=await temp();
  try {
    const archive=new FileActionExecutionLedgerArchive(path.join(dir,'ledger.jsonl')); await archive.load();
    const gateway=new ActionGateway({maxIdempotencyRecords:16});
    let durable={version:1,records:[]}; let effects=0;
    gateway.setExecutionLedgerArchive(archive);
    gateway.setExecutionLedgerPersister(async snapshot=>{durable=structuredClone(snapshot);});
    gateway.registerTool({id:'test.workpass64.unverified',capability:'test.unverified',destructive:false,requiresIdempotencyKey:true,
      execute:async input=>{effects++; return {ok:true,value:input.value};},
      verify:async()=>({verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'fixture deliberately unresolved'}),
    });
    for(let i=0;i<16;i++) {
      const result=await gateway.executeTool('test.workpass64.unverified',{value:i},'unverified-fill',{idempotencyKey:`wp64-unverified-${i}`});
      assert.equal(result.outcomeClass,'executed-unverified');
    }
    assert.equal(gateway.unresolvedExecutionCount(),16);
    assert.equal(gateway.unresolvedExecutionSnapshot(32).entries.length,16);
    const blocked=await gateway.executeTool('test.workpass64.unverified',{value:99},'ledger-must-fail-closed',{idempotencyKey:'wp64-overflow'});
    assert.equal(blocked.outcomeClass,'idempotency-ledger-full');
    assert.equal(effects,16,'capacity pressure cannot replay or execute when only unresolved receipts remain');
    assert.equal(archive.metrics().entries,0,'unresolved outcomes stay in the hot ledger and are not spilled');
    assert.equal(gateway.unresolvedExecutionCount(),16);
  } finally { await rm(dir,{recursive:true,force:true}); }
}

// A legacy archived unresolved receipt gets an immutable revision bound to the same IDs;
// it is visible in recovery before reconciliation and resolved after restart without execute.
{
  const dir=await temp();
  try {
    const file=path.join(dir,'ledger.jsonl');
    const archive=new FileActionExecutionLedgerArchive(file); await archive.load();
    const TOOL='test.workpass64.device.set-state';
    const INPUT={target:'relay-a',desired:'on'};
    const KEY='wp64:relay-a:state-on';
    const DECISION='decision:wp64:relay-a';
    const keyHash=sha256Stable({idempotencyKey:KEY});
    const requestHash=sha256Stable({toolId:TOOL,input:INPUT,expectedOutputKeys:null,decisionId:DECISION,autonomous:false});
    const executionId=`exec-${keyHash.slice(0,32)}`;
    const oldEntry={keyHash,requestHash,status:'completed',recordedAt:Date.now()-1000,executionId,toolId:TOOL,decisionId:DECISION,autonomous:false,response:unresolvedResponse(executionId,TOOL)};
    // Represents a row created by an earlier runtime before archive-safe spill filtering existed.
    await archive.append(oldEntry);
    let durable={version:1,records:[]}; let executeCalls=0; let lookupCalls=0; let finalizerCalls=0;
    const gateway=new ActionGateway(); gateway.setExecutionLedgerArchive(archive);
    gateway.setExecutionLedgerPersister(async snapshot=>{durable=structuredClone(snapshot);});
    gateway.setExecutionFinalizer(async ({result})=>{finalizerCalls++; assert.equal(result.executionId,executionId);});
    gateway.registerTool({id:TOOL,capability:'device.set-state',destructive:false,requiresIdempotencyKey:true,
      execute:async()=>{executeCalls++;return {ok:false,error:'must-not-execute-during-recovery'};},
      reconcile:async(_input,context)=>{lookupCalls++;assert.equal(context.executionId,executionId);assert.equal(context.idempotencyKey,keyHash);return {status:'found',authoritative:true,receiptId:'wp64-provider-receipt',result:{ok:true,desired:'on',providerReceiptId:'wp64-provider-receipt'},checkedAt:Date.now()};},
      verify:async({result})=>({verified:result.desired==='on',basis:'external-postcondition',confidence01:.97,externalObservation:true,observationId:'obs-wp64-relay-a',expectedPostcondition:'relay-a=on',observedPostcondition:result.desired==='on'?'relay-a=on':'relay-a=unknown',notes:'independent fixture observation'}),
    });
    assert.equal(gateway.unresolvedExecutionCount(),1);
    const before=gateway.unresolvedExecutionSnapshot();
    assert.equal(before.entries[0].executionId,executionId);
    assert.equal(before.entries[0].status,'outcome-unverified-requires-reconciliation');
    assert.equal(JSON.stringify(before).includes(keyHash),false,'queue must not leak idempotency key hashes');
    const approvalRequest=await gateway.requestToolApproval(TOOL,INPUT,'workpass64-reconcile',{idempotencyKey:KEY,decisionId:DECISION},'reconcile');
    assert.equal(approvalRequest.created,true);
    assert.equal((await gateway.resolveToolApproval(approvalRequest.request.id,true,'test-owner')).ok,true);
    const reconciled=await gateway.reconcileToolExecution(TOOL,INPUT,'workpass64-archive-reconcile',{idempotencyKey:KEY,decisionId:DECISION,approvalId:approvalRequest.request.id});
    assert.equal(reconciled.executionId,executionId);
    assert.equal(reconciled.verified,true);
    assert.equal(reconciled.reconciled,true);
    assert.equal(reconciled.providerReceiptId,'wp64-provider-receipt');
    assert.equal(lookupCalls,1); assert.equal(executeCalls,0); assert.equal(finalizerCalls,1);
    assert.equal(gateway.unresolvedExecutionCount(),0);
    assert.equal((await archive.get(keyHash)).response.verified,true);
    assert.equal(archive.metrics().entries,1,'revision does not create a second logical key');

    // Re-open the JSONL archive and prove load chooses the latest validated revision.
    const restartedArchive=new FileActionExecutionLedgerArchive(file); await restartedArchive.load();
    const latest=await restartedArchive.get(keyHash);
    assert.equal(latest.response.verified,true);
    assert.equal(latest.response.reconciled,true);
    assert.equal(latest.executionId,executionId);
    const restarted=new ActionGateway(); restarted.setExecutionLedgerArchive(restartedArchive); restarted.setExecutionLedgerPersister(async snapshot=>{durable=structuredClone(snapshot);});
    restarted.registerTool({id:TOOL,capability:'device.set-state',destructive:false,requiresIdempotencyKey:true,
      execute:async()=>{executeCalls++;return {ok:false};},
      reconcile:async()=>{lookupCalls++;return {status:'unknown',reason:'must-not-reconcile-terminal-verified-receipt'};},
      verify:async()=>({verified:true,basis:'external-postcondition',confidence01:1,externalObservation:true,notes:'fixture'}),
    });
    const replay=await restarted.executeTool(TOOL,INPUT,'replay-archived-revision',{idempotencyKey:KEY,decisionId:DECISION});
    assert.equal(replay.idempotentReplay,true); assert.equal(replay.verified,true);
    assert.equal(executeCalls,0); assert.equal(lookupCalls,1);
  } finally { await rm(dir,{recursive:true,force:true}); }
}

// Archive revision rules reject changing request identity, changing execution identity,
// or attempting to supersede a verified receipt.
{
  const dir=await temp();
  try {
    const archive=new FileActionExecutionLedgerArchive(path.join(dir,'ledger.jsonl')); await archive.load();
    const entry={keyHash:'a'.repeat(64),requestHash:'b'.repeat(64),status:'completed',recordedAt:10,executionId:'exec-aaaaaaaa',toolId:'test.archive',response:unresolvedResponse('exec-aaaaaaaa','test.archive')};
    await archive.append(entry);
    await assert.rejects(archive.appendRevision({...entry,requestHash:'c'.repeat(64),recordedAt:20,response:{...entry.response,reconciled:true,verified:true,outcomeClass:'executed-verified'}}),/not-authorized|conflict/i);
    await assert.rejects(archive.appendRevision({...entry,recordedAt:20,response:{...entry.response,reconciled:true,verified:true,outcomeClass:'executed-verified',idempotencyStatus:'reconciled'}}),/not-authorized|conflict/i);
    await archive.appendRevision({...entry,recordedAt:20,response:{...entry.response,reconciled:true,verified:true,outcomeClass:'executed-verified',idempotencyStatus:'reconciled',providerReceiptId:'receipt-valid'}});
    await assert.rejects(archive.appendRevision({...entry,recordedAt:30,response:{...entry.response,reconciled:true,verified:false,outcomeClass:'executed-unverified',idempotencyStatus:'reconciled',providerReceiptId:'receipt-valid'}}),/not-authorized|conflict/i);
  } finally { await rm(dir,{recursive:true,force:true}); }
}

console.log(JSON.stringify({ok:true,pass:'workpass64-archived-receipt-reconciliation',scenarios:3,assertions:'unresolved hot-ledger entries are not evicted; legacy archived unresolved row is recovery-visible; same-execution append-only authoritative revision survives restart; no repeat side effect; identity/terminal revision conflicts rejected'}));
