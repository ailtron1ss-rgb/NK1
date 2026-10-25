import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';
import { CausalAccountabilityGraph } from '../src/organism/system/CausalAccountabilityGraph.ts';

// Conflicting persisted execution receipts must not let later evidence attach to
// whichever duplicate happened to appear last in the snapshot.
const receiptGraph = new CausalAccountabilityGraph();
const receiptBase = {
  executionId: 'exec:ambiguous-restore', outcomeId: 'outcome:receipt-a',
  tool: 'door.open', tick: 4, at: 4000, ok: true,
  expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
  observationId: 'obs:a', confidence01: 0.9,
};
receiptGraph.restore({
  version: 1, nodes: [], edges: [], activeChains: [], lastAt: 4, updatedAt: 4000,
  outcomeIndex: [
    receiptBase,
    { ...receiptBase, outcomeId: 'outcome:receipt-b', tool: 'door.close', observedPostcondition: 'door=closed' },
  ],
});
assert.ok(receiptGraph.snapshot().quarantinedExecutionIds?.includes('exec:ambiguous-restore'),
  'conflicting execution receipts must be quarantined during restore');
assert.equal(receiptGraph.resolveExternalVerification({
  tick: 5, tool: 'door.open', observationId: 'obs:late', verified: true,
  confidence01: 0.9, executionId: 'exec:ambiguous-restore',
}).reason, 'ambiguous-execution-receipt',
  'late evidence must not attach to a conflicting restored execution identity');

// Live receipt identity is immutable: exact replay is idempotent; conflicting reuse is quarantined.
const liveReceiptGraph = new CausalAccountabilityGraph();
const liveReceipt = {
  tick: 7, tool: 'door.open', ok: true, verified: false, confidence01: 0.91,
  expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
  externalObservation: true, executionId: 'exec-12345678-live-reuse',
};
const firstLiveReceipt = liveReceiptGraph.recordActionChain(liveReceipt);
const exactLiveReplay = liveReceiptGraph.recordActionChain({ ...liveReceipt });
assert.equal(exactLiveReplay.replayed, true, 'an exact live execution replay must not create a second outcome');
assert.equal(exactLiveReplay.outcomeId, firstLiveReceipt.outcomeId);
assert.equal(liveReceiptGraph.snapshot().nodes.filter(node => node.kind === 'outcome' && node.data?.executionId === liveReceipt.executionId).length, 1);
const liveConflict = liveReceiptGraph.recordActionChain({
  ...liveReceipt, tool: 'door.close', ok: false,
  expectedPostcondition: 'door=closed', observedPostcondition: 'door=closed', confidence01: 0.88,
});
assert.equal(liveConflict.quarantined, true, 'conflicting live execution receipt reuse must be quarantined');
assert.ok(liveReceiptGraph.snapshot().quarantinedExecutionIds?.includes(liveReceipt.executionId));
assert.ok(!liveReceiptGraph.snapshot().outcomeIndex?.some(row => row.executionId === liveReceipt.executionId),
  'quarantined live execution IDs must be removed from the active receipt directory');
for (let tick = 8; tick < 48; tick++) {
  liveReceiptGraph.recordActionChain({
    tick, tool: 'observer.noop', ok: true, verified: false, confidence01: 0.5,
    executionId: `exec-live-window-${tick}`,
  });
}
liveReceiptGraph.compact();
const afterLiveCompaction = liveReceiptGraph.snapshot();
assert.ok(afterLiveCompaction.quarantinedExecutionIds?.includes(liveReceipt.executionId),
  'live receipt quarantine must survive graph compaction');
assert.ok(!afterLiveCompaction.outcomeIndex?.some(row => row.executionId === liveReceipt.executionId));
assert.equal(liveReceiptGraph.resolveExternalVerification({
  tick: 50, tool: 'door.open', observationId: 'obs:live-late', verified: true,
  confidence01: 0.91, executionId: liveReceipt.executionId,
}).reason, 'ambiguous-execution-receipt',
  'compaction must not rehabilitate a conflicting live execution ID');
assert.equal(liveReceiptGraph.recordActionChain(liveReceipt).quarantined, true,
  'a later replay must not clear an existing live quarantine');

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
  assert.ok(verifiedOutcome?.externalObservations?.some(observation=>observation.verified), 'the matching execution record must retain verified external evidence separately from its original receipt');
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
  assert.ok(restored.outcomeCognitionSnapshot().records.some(r=>r.executionId===executed.executionId && r.externalObservations?.some(observation=>observation.verified)), 'restoration must preserve verified external observations without rewriting the original action receipt');
  console.log('BIG_PASS_64_EXTERNAL_OBSERVER=PASS verified='+core.externalObserverSummary().verifiedCount+' contradicted='+core.externalObserverSummary().contradictedCount+' observations='+core.externalObserverSummary().observations);
} finally { await rm(dir,{recursive:true,force:true}); }
