import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, appendFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { FileActionExecutionLedgerArchive } from '../src/organism/persistence/FileActionExecutionLedgerArchive.ts';

const temp = async (t) => { const dir = await mkdtemp(path.join(os.tmpdir(), 'nk-ledger-wp38-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; };
const testTool = (gateway, onExecute) => gateway.registerTool({ id:'test.archive', capability:'test.read', destructive:false, verify:async()=>({verified:true,basis:'tool-contract',confidence01:1,externalObservation:false,notes:'archive fixture contract'}), execute:async(input)=>{ onExecute(); return {ok:true,value:input.value}; } });

test('keyed execution fails closed without a durable persister', async () => {
  const gateway = new ActionGateway(); let calls = 0; testTool(gateway,()=>calls++);
  const result = await gateway.executeTool('test.archive',{value:1},'without-store',{idempotencyKey:'k'});
  assert.equal(result.outcomeClass,'idempotency-storage-failed'); assert.equal(calls,0);
});

test('old completed keys spill to a disk archive and replay after restart without a second side effect', async (t) => {
  const dir=await temp(t); const file=path.join(dir,'ledger.jsonl');
  const archive=new FileActionExecutionLedgerArchive(file); await archive.load();
  let snapshot={version:1,records:[]}; let calls=0;
  const gateway=new ActionGateway({maxIdempotencyRecords:16}); gateway.setExecutionLedgerArchive(archive); gateway.setExecutionLedgerPersister(async next=>{snapshot=structuredClone(next);}); testTool(gateway,()=>calls++);
  const first=[];
  for(let i=0;i<40;i++) first.push(await gateway.executeTool('test.archive',{value:i},'batch',{idempotencyKey:`batch-${i}`}));
  assert.equal(calls,40); assert.equal(snapshot.records.length,16); assert.equal(archive.metrics().entries,24);
  const repeated=await gateway.executeTool('test.archive',{value:0},'replay-old',{idempotencyKey:'batch-0'});
  assert.equal(repeated.result.value,0); assert.equal(repeated.idempotentReplay,true); assert.equal(calls,40);
  const restoredArchive=new FileActionExecutionLedgerArchive(file); await restoredArchive.load();
  const restored=new ActionGateway({maxIdempotencyRecords:16}); restored.setExecutionLedgerArchive(restoredArchive); restored.setExecutionLedgerPersister(async next=>{snapshot=structuredClone(next);}); restored.restoreExecutionLedger(snapshot); testTool(restored,()=>calls++);
  for(let i=0;i<40;i++) { const replay=await restored.executeTool('test.archive',{value:i},'restart-replay',{idempotencyKey:`batch-${i}`}); assert.equal(replay.result.value,i); assert.equal(replay.idempotentReplay,true); }
  assert.equal(calls,40);
  const conflict=await restored.executeTool('test.archive',{value:'different'},'conflict',{idempotencyKey:'batch-0'}); assert.equal(conflict.outcomeClass,'idempotency-conflict'); assert.equal(calls,40);
});

test('archive recovers a torn final append but fails closed on complete-line corruption', async (t) => {
  const dir=await temp(t); const file=path.join(dir,'ledger.jsonl');
  const archive=new FileActionExecutionLedgerArchive(file); await archive.load();
  const gateway=new ActionGateway({maxIdempotencyRecords:16}); gateway.setExecutionLedgerArchive(archive); gateway.setExecutionLedgerPersister(async()=>{}); let calls=0; testTool(gateway,()=>calls++);
  await gateway.executeTool('test.archive',{value:1},'one',{idempotencyKey:'torn-safe'});
  await archive.append(gateway.snapshotExecutionLedger().records[0]);
  const before=(await readFile(file)).length;
  await appendFile(file,'{"partial":');
  const recovered=new FileActionExecutionLedgerArchive(file); await recovered.load();
  const oldKeyHash=(await import('../src/organism/core/StableSerialization.ts')).sha256Stable({idempotencyKey:'torn-safe'});
  assert.equal((await readFile(file)).length,before); assert.equal((await recovered.get(oldKeyHash)).response.result.value,1);
  const damaged=path.join(dir,'damaged.jsonl'); const bytes=await readFile(file); const changed=Buffer.from(bytes);
  const digestAt=changed.indexOf(Buffer.from('\"digest\":\"')); assert.notEqual(digestAt,-1); const digestChar=digestAt+10; changed[digestChar]=changed[digestChar]===0x30?0x31:0x30; await writeFile(damaged,changed);
  const corrupt=new FileActionExecutionLedgerArchive(damaged); await assert.rejects(corrupt.load(),/checksum|invalid|conflict/i);
});

test('file-backed OrganismCore opens the durable archive before replaying persisted receipts', async (t) => {
  const dir=await temp(t); const statePath=path.join(dir,'organism-state.json'); let calls=0;
  const firstCore=new OrganismCore(new FileStateStore(statePath,{backupEverySaves:100,directoryFsyncEverySaves:100}),{cycleResultMode:'operational',checkpointMinIntervalMs:0});
  await firstCore.init();
  assert.equal(firstCore.actionExecutionLedgerMetrics().archive.loaded,true);
  firstCore.registerActionTool({id:'test.file-core',capability:'test.read',destructive:false,projectAllowed:true,execute:async()=>{calls++;return {ok:true,receipt:'file-backed'};}});
  const first=await firstCore.executeTool('test.file-core',{},'file-first',{idempotencyKey:'file-core-operation'});
  assert.equal(first.ok,true); assert.equal(calls,1);
  const restarted=new OrganismCore(new FileStateStore(statePath,{backupEverySaves:100,directoryFsyncEverySaves:100}),{cycleResultMode:'operational',checkpointMinIntervalMs:0});
  await restarted.init(); assert.equal(restarted.actionExecutionLedgerMetrics().archive.loaded,true);
  restarted.registerActionTool({id:'test.file-core',capability:'test.read',destructive:false,projectAllowed:true,execute:async()=>{calls++;return {ok:true,receipt:'duplicate-must-not-run'};}});
  const replay=await restarted.executeTool('test.file-core',{},'file-restart-replay',{idempotencyKey:'file-core-operation'});
  assert.equal(replay.idempotentReplay,true); assert.equal(replay.result.receipt,'file-backed'); assert.equal(calls,1);
});
