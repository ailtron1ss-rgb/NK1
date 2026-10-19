import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';

const gateway = new ActionGateway({ live:true });
gateway.registerTool({
  id:'test.external', capability:'test.write', destructive:true, projectAllowed:false,
  execute:async()=>({ok:true, requested:'door=open'}),
  verify:({result})=>({verified:true,basis:'external-postcondition',confidence01:.96,externalObservation:true,observationId:'obs-001',expectedPostcondition:'door=open',observedPostcondition:String(result.requested)})
});
const verified=await gateway.executeTool('test.external',{} ,'external-verification-positive');
assert.equal(verified.ok,true);
assert.equal(verified.verified,true);
assert.equal(verified.verification.basis,'external-postcondition');
assert.equal(verified.verification.observationId,'obs-001');
assert.equal(verified.audit.verificationBasis,'external-postcondition');

const blocked = new ActionGateway({live:true});
blocked.registerTool({id:'test.unsafe',capability:'test.write',destructive:true,execute:async()=>({ok:true})});
const blockedResult=await blocked.executeTool('test.unsafe',{} ,'external-verification-negative');
assert.equal(blockedResult.ok,false);
assert.equal(blockedResult.verified,false);
assert.equal(blockedResult.result.error,'live-destructive-verifier-required');

process.env.ACTIONS_LIVE='true';
const core = new OrganismCore(new MemoryStateStore(), {cycleResultMode:'operational', checkpointMinIntervalMs:60000});
await core.init();
core.registerActionTool({
  id:'test.external-core', capability:'test.write', destructive:true, projectAllowed:true,
  execute:async()=>({ok:true, requested:'switch:on'}),
  verify:({result})=>({verified:true,basis:'external-postcondition',confidence01:.91,externalObservation:true,observationId:'core-obs-001',expectedPostcondition:'switch=on',observedPostcondition:String(result.requested),observedWorldContextAfter:{tick:2,location:'lab',energy:.78,attention:.81,uncertainty:.18,facts:['switch=on'],objects:[],events:['switch:turned-on']}})
});
const coreResult=await core.executeTool('test.external-core',{} ,'core-external-verification');
assert.equal(coreResult.verified,true);
assert.equal(coreResult.verification.basis,'external-postcondition');
const persisted=core.snapshot();
assert.equal(persisted.system.outcomeVerification?.records[0]?.observationId,'core-obs-001');
assert.equal(persisted.system.outcomeVerification?.records[0]?.externalObservation,true);
assert.ok(persisted.facets.memory.eventLog.some(e=>e.type==='external-outcome-verified'));
assert.ok(persisted.system.externalEvidenceTrust?.records.some(r=>r.claimKey==='tool:test.external-core:postcondition'));
assert.ok(core.snapshot().facets.advanced.groundedWorld);
const causal=core.causalAccountabilitySnapshot();
assert.ok(causal.nodes.some(n=>n.kind==='prediction'));
assert.ok(causal.nodes.some(n=>n.kind==='decision'));
assert.ok(causal.nodes.some(n=>n.kind==='verification'));
assert.ok(causal.edges.some(e=>e.relation==='predicted'));

const oldState={...persisted, schemaVersion:94, state:{...persisted.state, version:94}, system:{...persisted.system, schemaVersion:94, outcomeVerification:undefined}};
const migrated=migratePersistedOrganism(oldState);
assert.ok(migrated.schemaVersion>=96); assert.ok(migrated.state.version>=96);
assert.ok(migrated.system.outcomeVerification?.version===1);
assert.ok(Array.isArray(migrated.system.outcomeVerification?.records));

core.registerActionTool({id:'test.ok-only-core',capability:'test.read',destructive:false,projectAllowed:true,execute:async()=>({ok:true})});
const weak=await core.executeTool('test.ok-only-core',{},'weak-no-verifier');
assert.equal(weak.ok,true);
assert.equal(weak.verified,false);
assert.equal(weak.verification.basis,'none');
console.log('BIG_PASS_62_OUTCOME_VERIFICATION=PASS externalConfidence='+verified.verification.confidence01.toFixed(2)+' ledgerRecords='+persisted.system.outcomeVerification.records.length);
