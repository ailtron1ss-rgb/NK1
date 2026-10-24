import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';

const f=new ExternalObserverFabric();
f.registerSource({id:'device-smoke',sourceClass:'device',channel:'sensor',independenceKey:'sensor:smoke',reliability01:.9});
const first=f.observeAndAssess({sourceId:'device-smoke',sourceClass:'device',channel:'sensor',claimKey:'door',observedPostcondition:'door=open',confidence01:.96,actionRef:'exec-1',tool:'door.open',tick:1,expectedPostcondition:'door=open'});
assert.equal(first.assessment.verified,true);
assert.equal(f.summary().verifiedCount,1);
const conflict=f.observeAndAssess({sourceId:'device-smoke',sourceClass:'device',channel:'sensor',claimKey:'door-2',observedPostcondition:'door=closed',confidence01:.96,actionRef:'exec-2',tool:'door.open',tick:2,expectedPostcondition:'door=open'});
assert.equal(conflict.assessment.assessment,'mismatch');
assert.equal(conflict.assessment.verified,false);
const ambiguous=f.observeAndAssess({sourceId:'device-smoke',sourceClass:'device',channel:'sensor',claimKey:'door-3',observedPostcondition:'temperature=21',confidence01:.96,actionRef:'exec-3',tool:'door.open',tick:3,expectedPostcondition:'door=open'});
assert.equal(ambiguous.assessment.assessment,'unknown');
assert.equal(ambiguous.assessment.verified,false);

const dir=await mkdtemp(path.join(tmpdir(),'nk-p64-'));
try {
  const core=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false});
  await core.init();
  core.registerActionTool({
    id:'observer.smoke',capability:'smoke',destructive:false,
    observationSource:{sourceId:'device-smoke',sourceClass:'device',channel:'sensor',independenceKey:'sensor:smoke'},
    execute:async()=>({ok:true,value:1}),
  });
  core.registerExternalObserverSourceForTool('observer.smoke');
  const executed=await core.executeTool('observer.smoke',{value:1},'p64-smoke');
  assert.ok(executed.executionId);
  const resolved=await core.ingestExternalObservation({sourceId:'device-smoke',sourceClass:'device',channel:'sensor',claimKey:'observer.smoke:counter',observedPostcondition:'counter=1',confidence01:.99,actionRef:executed.executionId,tool:'observer.smoke',tick:core.snapshot().state.tick,expectedPostcondition:'counter=1'});
  assert.equal(resolved.assessment?.verified,true);
  assert.equal(resolved.resolution?.resolved,true);
  const outcome=core.outcomeCognitionSnapshot();
  const verifiedOutcome=outcome.records.find(record=>record.executionId===executed.executionId);
  assert.ok(verifiedOutcome?.verified, 'the matching execution record must contain the verified external outcome');
  assert.equal(verifiedOutcome.executionId,executed.executionId);
  assert.ok(outcome.causal.nodes.some(n=>n.kind==='observation' && n.evidenceRef===resolved.observation.id));
  assert.ok(core.externalObserverSummary().verifiedCount >= 1);
  await core.flush();
  const restored=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false});
  restored.registerActionTool({
    id:'observer.smoke',capability:'smoke',destructive:false,
    observationSource:{sourceId:'device-smoke',sourceClass:'device',channel:'sensor',independenceKey:'sensor:smoke'},
    execute:async()=>({ok:true,value:1}),
  });
  await restored.init();
  assert.ok(restored.externalObserverSnapshot().observations.length >= 1);
  assert.ok(restored.outcomeCognitionSnapshot().records.some(r=>r.executionId===executed.executionId && r.verified));
  console.log('BIG_PASS_64_EXTERNAL_OBSERVER=PASS verified='+core.externalObserverSummary().verifiedCount+' contradicted='+core.externalObserverSummary().contradictedCount+' observations='+core.externalObserverSummary().observations);
} finally { await rm(dir,{recursive:true,force:true}); }
