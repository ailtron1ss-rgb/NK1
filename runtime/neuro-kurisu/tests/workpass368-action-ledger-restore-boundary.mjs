import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const key='workpass368:action-ledger-restore:v1';
const options={idempotencyKey:key,decisionId:'decision:workpass368:restore'};
let executions=0;
const makeGateway=()=>{
  const gateway=new ActionGateway();
  gateway.setExecutionLedgerPersister(async()=>{});
  gateway.registerTool({
    id:'test.restore.inspect',capability:'test.inspect',destructive:false,requiresIdempotencyKey:true,
    execute:async()=>{executions++;return {ok:true,state:'stable'};},
  });
  return gateway;
};

const source=makeGateway();
const first=await source.executeTool('test.restore.inspect',{},'restore-fixture',options);
assert.equal(first.ok,true);
assert.equal(executions,1);
const baseline=source.snapshotExecutionLedger();
assert.equal(baseline.records.length,1);
assert.equal(baseline.records[0].status,'completed');

// Legacy snapshots without an explicit version or approval section remain readable.
const legacy=makeGateway();
legacy.restoreExecutionLedger({records:baseline.records});
const legacyReplay=await legacy.executeTool('test.restore.inspect',{},'legacy-replay',options);
assert.equal(legacyReplay.ok,true);
assert.equal(legacyReplay.idempotentReplay,true);
assert.equal(executions,1,'a valid restored receipt must replay without executing twice');

// Every root/schema failure must leave both ledgers byte-for-byte equivalent to prior state.
const protectedGateway=makeGateway();
await protectedGateway.executeTool('test.restore.inspect',{},'protected-state',{idempotencyKey:'workpass368:keep-existing'});
const protectedBefore=protectedGateway.snapshotExecutionLedger();
let rootGetterCalls=0;
const rootAccessor=structuredClone(baseline);
Object.defineProperty(rootAccessor,'records',{
  enumerable:true,configurable:true,
  get(){rootGetterCalls++;throw new Error('root getter must never execute');},
});
let rowGetterCalls=0;
const rowAccessor=structuredClone(baseline);
const accessorRow={...rowAccessor.records[0]};
Object.defineProperty(accessorRow,'keyHash',{
  enumerable:true,configurable:true,
  get(){rowGetterCalls++;throw new Error('row getter must never execute');},
});
rowAccessor.records=[accessorRow];
let permissionGetterCalls=0;
const permissionAccessor=structuredClone(baseline);
Object.defineProperty(permissionAccessor.permissions,'created',{
  enumerable:true,configurable:true,
  get(){permissionGetterCalls++;throw new Error('permission getter must never execute');},
});
const invalidSnapshots=[
  {...structuredClone(baseline),version:2},
  {...structuredClone(baseline),records:'not-an-array'},
  rootAccessor,
  rowAccessor,
  permissionAccessor,
  {...structuredClone(baseline),permissions:{...structuredClone(baseline.permissions),approved:1.5}},
];
for(const invalid of invalidSnapshots){
  assert.throws(()=>protectedGateway.restoreExecutionLedger(invalid),/action-ledger/);
  assert.deepEqual(protectedGateway.snapshotExecutionLedger(),protectedBefore,
    'invalid restore must preserve existing execution receipts and approval counters');
}
assert.equal(rootGetterCalls,0,'root accessors must be rejected by descriptor before invocation');
assert.equal(rowGetterCalls,0,'identity accessors must be rejected before invocation');
assert.equal(permissionGetterCalls,0,'approval counter accessors must be rejected before invocation');

// Nested accessor-backed results are not cloned or invoked; the receipt remains a tombstone.
const opaqueSnapshot=structuredClone(baseline);
const opaqueRow=opaqueSnapshot.records[0];
const opaqueResponse={...opaqueRow.response};
const opaqueResult={...opaqueResponse.result};
let nestedGetterCalls=0;
Object.defineProperty(opaqueResult,'secret',{
  enumerable:true,configurable:true,
  get(){nestedGetterCalls++;throw new Error('nested receipt getter must never execute');},
});
opaqueResponse.result=opaqueResult;
opaqueRow.response=opaqueResponse;
const opaqueRestored=makeGateway();
opaqueRestored.restoreExecutionLedger(opaqueSnapshot);
assert.equal(nestedGetterCalls,0,'nested receipt data must be cloned through own data descriptors');
assert.equal(opaqueRestored.snapshotExecutionLedger().records[0].responseOmitted,true,
  'an opaque completed receipt must retain a no-reexecution tombstone');
const opaqueReplay=await opaqueRestored.executeTool('test.restore.inspect',{},'opaque-replay',options);
assert.equal(opaqueReplay.outcomeClass,'idempotency-recovery-required');
assert.equal(opaqueReplay.result.error,'idempotency-recovery-required');
assert.equal(executions,1,'opaque receipt recovery must never call the tool executor');

// A persisted omission marker is authoritative even if stale response bytes also exist.
const omittedSnapshot=structuredClone(baseline);
omittedSnapshot.records[0].responseOmitted=true;
const omittedRestored=makeGateway();
omittedRestored.restoreExecutionLedger(omittedSnapshot);
const omittedReplay=await omittedRestored.executeTool('test.restore.inspect',{},'omitted-replay',options);
assert.equal(omittedReplay.outcomeClass,'idempotency-recovery-required');
assert.equal(executions,1,'a tombstoned receipt must not be promoted back into a replayable response');

console.log('NK1_WORKPASS368_ACTION_LEDGER_RESTORE=PASS atomic=true accessors=not-invoked tombstone=true duplicate-execution=false');
