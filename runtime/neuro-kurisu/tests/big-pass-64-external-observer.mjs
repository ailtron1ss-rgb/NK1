import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';
import { CausalAccountabilityGraph } from '../src/organism/system/CausalAccountabilityGraph.ts';
import { OutcomeCognitionFabric } from '../src/organism/system/OutcomeCognitionFabric.ts';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';

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

// A restored projection index must not let the last conflicting duplicate execution ID win.
const projectionBaseVerification = {
  verified: true, basis: 'external-postcondition', confidence01: 0.93,
  externalObservation: true, expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
  observationId: 'obs:projection-a',
};
const projectionA = new OutcomeCognitionFabric();
projectionA.project({ tick: 10, tool: 'door.open', ok: true, verification: projectionBaseVerification, executionId: 'exec-projection-conflict', outcomeClass: 'executed-verified' });
const projectionSnapshotA = projectionA.snapshot();
const projectionB = new OutcomeCognitionFabric();
projectionB.project({
  tick: 11, tool: 'door.close', ok: true,
  verification: { ...projectionBaseVerification, expectedPostcondition: 'door=closed', observedPostcondition: 'door=closed', observationId: 'obs:projection-b' },
  executionId: 'exec-projection-conflict', outcomeClass: 'executed-verified',
});
const projectionSnapshotB = projectionB.snapshot();
const projectionRestored = new OutcomeCognitionFabric();
projectionRestored.restore({
  version: 1,
  records: [projectionSnapshotA.records[0], projectionSnapshotB.records[0]],
  projectionIndex: [projectionSnapshotA.projectionIndex[0], projectionSnapshotB.projectionIndex[0]],
  causal: projectionSnapshotA.causal,
});
const projectionAfterRestore = projectionRestored.snapshot();
assert.ok(projectionAfterRestore.causal.quarantinedExecutionIds?.includes('exec-projection-conflict'),
  'projection-index conflicts must be persisted as causal quarantine tombstones');
assert.ok(!projectionAfterRestore.projectionIndex.some(row => row.executionId === 'exec-projection-conflict'),
  'no duplicate projection may survive conflict quarantine');
assert.ok(projectionAfterRestore.records.some(row => row.executionId === 'exec-projection-conflict' && row.receiptQuarantined === true),
  'conflicting outcome must remain visible as quarantined read-only audit history');
assert.ok(projectionRestored.causalAutobiography().some(row => row.executionId === 'exec-projection-conflict' && row.verification === 'ambiguous-execution-quarantined'),
  'autobiography must not report quarantined history as trusted verification');
assert.equal(projectionRestored.resolveExternalObservation({
  tick: 12, executionId: 'exec-projection-conflict', tool: 'door.open', observationId: 'obs:late-projection',
  verified: true, confidence01: 0.96, expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
  assessment: 'match', sourceId: 'world-sensor', sourceClass: 'world', independenceKey: 'sensor:door',
}).reason, 'ambiguous-execution-receipt',
  'late external evidence cannot attach to a quarantined projection ID');
assert.equal(projectionRestored.hasProjectionForExecution('exec-projection-conflict'), false,
  'quarantined identifiers must not be advertised as active projections');

// Invalid trailing rows must not crowd a valid older projection out of the bounded restore index.
const validProjectionSource = new OutcomeCognitionFabric();
validProjectionSource.project({
  tick: 14, tool: 'door.open', ok: true, verification: projectionBaseVerification,
  executionId: 'exec-projection-valid', outcomeClass: 'executed-verified',
});
const validProjectionSnapshot = validProjectionSource.snapshot();
const noisyProjectionRows = Array.from({ length: 900 }, (_, i) => ({
  executionId: 'exec-invalid-projection-tail-' + i,
  // Looks structurally valid but does not match the record's immutable identity.
  fingerprint: '0'.repeat(64),
  record: { ...validProjectionSnapshot.projectionIndex[0].record, executionId: 'exec-invalid-projection-tail-' + i },
  verifiedExternal: validProjectionSnapshot.projectionIndex[0].verifiedExternal,
}));
const noisyProjectionRestored = new OutcomeCognitionFabric();
noisyProjectionRestored.restore({
  version: 1,
  records: validProjectionSnapshot.records,
  projectionIndex: [...validProjectionSnapshot.projectionIndex, ...noisyProjectionRows],
  causal: validProjectionSnapshot.causal,
});
assert.equal(noisyProjectionRestored.hasProjectionForExecution('exec-projection-valid'), true,
  'invalid trailing projection rows must not evict a valid older active projection');
assert.ok(!noisyProjectionRestored.snapshot().causal.quarantinedExecutionIds?.includes('exec-projection-valid'),
  'valid older projections must not be quarantined merely because invalid rows follow them');
assert.throws(() => projectionRestored.project({
  tick: 13, tool: 'door.open', ok: true, verification: projectionBaseVerification,
  executionId: 'exec-projection-conflict', outcomeClass: 'executed-verified',
}), /outcome-execution-id-conflict/,
  'a later project call must not silently reintroduce the quarantined identity');

// A causal-only quarantine keeps historical evidence readable but disables active reuse.
const historicalProjectionSource = new OutcomeCognitionFabric();
historicalProjectionSource.project({
  tick: 20, tool: 'door.open', ok: true, verification: projectionBaseVerification,
  executionId: 'exec-causal-only-quarantine', outcomeClass: 'executed-verified',
});
const historicalProjectionSnapshot = historicalProjectionSource.snapshot();
const historicalProjectionRestored = new OutcomeCognitionFabric();
historicalProjectionRestored.restore({
  ...historicalProjectionSnapshot,
  causal: {
    ...historicalProjectionSnapshot.causal,
    quarantinedExecutionIds: ['exec-causal-only-quarantine'],
  },
});
const historicalAfterRestore = historicalProjectionRestored.snapshot();
assert.ok(historicalAfterRestore.records.some(row => row.executionId === 'exec-causal-only-quarantine' && row.receiptQuarantined === true),
  'causal-only quarantine must preserve the original projection as explicitly marked read-only audit history');
assert.ok(historicalProjectionRestored.causalAutobiography().some(row => row.executionId === 'exec-causal-only-quarantine' && row.verification === 'ambiguous-execution-quarantined'));
assert.ok(!historicalAfterRestore.projectionIndex.some(row => row.executionId === 'exec-causal-only-quarantine'),
  'causal-only quarantine must remove the execution from the active projection index');
assert.equal(historicalProjectionRestored.hasProjectionForExecution('exec-causal-only-quarantine'), false);
assert.equal(historicalProjectionRestored.resolveExternalObservation({
  tick: 21, executionId: 'exec-causal-only-quarantine', tool: 'door.open', observationId: 'obs:history-late',
  verified: true, confidence01: 0.95, expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
  assessment: 'match', sourceId: 'world-sensor', sourceClass: 'world', independenceKey: 'sensor:door',
}).reason, 'ambiguous-execution-receipt',
  'read-only historical records must not allow new evidence attachment');

// Rehydrating an evicted outcome for late evidence must preserve success identity across another restart.
const rehydrationGraph = new CausalAccountabilityGraph(64, 128, 8);
const rehydrationExecutionId = 'exec-12345678-rehydrate-roundtrip';
rehydrationGraph.recordActionChain({
  tick: 1, tool: 'door.open', ok: true, verified: false, confidence01: 0.91,
  expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
  executionId: rehydrationExecutionId,
});
for (let tick = 2; tick < 24; tick++) {
  rehydrationGraph.recordActionChain({
    tick, tool: 'observer.noop', ok: true, verified: false, confidence01: 0.5,
    executionId: `exec-rehydrate-window-${tick}`,
  });
}
rehydrationGraph.compact();
assert.ok(!rehydrationGraph.snapshot().nodes.some(node => node.kind === 'outcome' && node.data?.executionId === rehydrationExecutionId),
  'the oldest outcome should be evicted from graph nodes before late evidence arrives');
const lateReceiptResolution = rehydrationGraph.resolveExternalVerification({
  tick: 25, tool: 'door.open', observationId: 'obs:rehydrated-roundtrip', verified: true,
  confidence01: 0.91, expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
  executionId: rehydrationExecutionId,
});
assert.equal(lateReceiptResolution.resolved, true, 'late verification should rehydrate the outcome from the stable receipt index');
const graphAfterLateEvidence = rehydrationGraph.snapshot();
const rehydrationRestored = new CausalAccountabilityGraph(64, 128, 8);
rehydrationRestored.restore(graphAfterLateEvidence);
assert.ok(!rehydrationRestored.snapshot().quarantinedExecutionIds?.includes(rehydrationExecutionId),
  'receipt rehydration must not look like a contradictory failure on subsequent restart');
const rehydrationReplay = rehydrationRestored.resolveExternalVerification({
  tick: 25, tool: 'door.open', observationId: 'obs:rehydrated-roundtrip', verified: true,
  confidence01: 0.91, expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
  executionId: rehydrationExecutionId,
});
assert.equal(rehydrationReplay.resolved, true);
assert.equal(rehydrationReplay.replayed, true,
  'the same late external evidence must remain an idempotent replay after rehydration and restart');

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
  // Invalid trailing rows must not crowd a valid provider-receipt revision out of the bounded restore ledger.
{
  const revisionFabric = new OutcomeCognitionFabric();
  const digest = 'a'.repeat(64);
  const validRevision = {
    revisionId: 'outcome-revision:retained-after-noise',
    executionId: 'exec:revision-retention',
    tool: 'device.read',
    revisionNumber: 1,
    source: 'authoritative-provider-receipt',
    providerReceiptHash: digest,
    baseFingerprint: 'b'.repeat(64),
    revisionFingerprint: 'c'.repeat(64),
    at: 10,
    tick: 1,
    ok: true,
    verified: true,
    outcomeClass: 'verified',
    basis: 'tool-contract',
    confidence01: 0.9,
    status: 'verified',
  };
  revisionFabric.restore({
    records: [],
    projectionIndex: [],
    evidenceRevisions: [
      validRevision,
      ...Array.from({length: 2050}, (_, i) => ({revisionId: 'invalid-trailing-row-' + i})),
    ],
  });
  assert.ok(
    revisionFabric.snapshot().evidenceRevisions.some(row => row.revisionId === validRevision.revisionId),
    'invalid trailing revision rows must not evict a valid older provider receipt before validation',
  );
}

// State migration must retain bounded causal quarantine tombstones, not only the graph nodes/index.
  const migrationSeed=structuredClone(core.snapshot());
  migrationSeed.system.causalAccountability={
    version:1,nodes:[],edges:[],activeChains:[],lastAt:0,updatedAt:0,outcomeIndex:[],
    quarantinedExecutionIds:['exec-state-migration-quarantine'],
  };
  const migratedSeed=migratePersistedOrganism(migrationSeed);
  assert.ok(migratedSeed.system.causalAccountability.quarantinedExecutionIds?.includes('exec-state-migration-quarantine'),
    'state migration must preserve execution quarantine tombstones across restart');

  const migrationRevision = {
    revisionId:'outcome-revision:migration-retention', executionId:'exec:migration-retention', tool:'device.read',
    revisionNumber:1, source:'authoritative-provider-receipt', providerReceiptHash:'a'.repeat(64),
    baseFingerprint:'b'.repeat(64), revisionFingerprint:'c'.repeat(64), at:10, tick:1, ok:true,
    verified:true, outcomeClass:'verified', basis:'tool-contract', confidence01:0.9, status:'verified',
  };
  migrationSeed.system.outcomeVerification = {
    ...(migrationSeed.system.outcomeVerification ?? {}),
    evidenceRevisions:[migrationRevision,...Array.from({length:2050},(_,i)=>({revisionId:'invalid-migration-row-'+i}))],
  };
  const migratedRevisions = migratePersistedOrganism(migrationSeed).system.outcomeVerification.evidenceRevisions;
  assert.ok(migratedRevisions.some(row=>row.revisionId===migrationRevision.revisionId),
    'migration must validate provider revisions before applying its retention cap');

  // Migration must validate semantic projection fingerprints before its own cap too.
  const projectionMigrationSeed = structuredClone(migrationSeed);
  const migrationProjectionSource = new OutcomeCognitionFabric();
  migrationProjectionSource.project({
    tick: 31, tool: 'door.open', ok: true, verification: projectionBaseVerification,
    executionId: 'exec-migration-projection-valid', outcomeClass: 'executed-verified',
  });
  const migrationProjection = migrationProjectionSource.snapshot().projectionIndex[0];
  projectionMigrationSeed.system.outcomeVerification = {
    ...(projectionMigrationSeed.system.outcomeVerification ?? {}),
    records: [migrationProjection.record],
    projectionIndex: [
      migrationProjection,
      ...Array.from({ length: 2100 }, (_, i) => ({
        executionId: 'exec-migration-projection-forged-' + i,
        fingerprint: '0'.repeat(64),
        record: { ...migrationProjection.record, executionId: 'exec-migration-projection-forged-' + i },
        verifiedExternal: migrationProjection.verifiedExternal,
      })),
      ...Array.from({ length: 2100 }, () => ({
        ...migrationProjection,
        // Identity fingerprint is genuine, but this trust flag contradicts the record.
        verifiedExternal: false,
      })),
    ],
  };
  const migratedProjection = migratePersistedOrganism(projectionMigrationSeed).system.outcomeVerification;
  assert.ok(migratedProjection.projectionIndex.some(row => row.executionId === 'exec-migration-projection-valid'),
    'semantically invalid trailing projection rows must not evict a valid older projection during migration');
  assert.ok(!migratedProjection.projectionIndex.some(row => row.executionId === 'exec-migration-projection-forged-0'),
    'migration must discard projections whose fingerprint does not match their normalized record');

  // Migration must validate semantic projection fingerprints before its own cap too.
  const projectionMigrationSeed = structuredClone(migrationSeed);
  const migrationProjectionSource = new OutcomeCognitionFabric();
  migrationProjectionSource.project({
    tick: 31, tool: 'door.open', ok: true, verification: projectionBaseVerification,
    executionId: 'exec-migration-projection-valid', outcomeClass: 'executed-verified',
  });
  const migrationProjection = migrationProjectionSource.snapshot().projectionIndex[0];
  projectionMigrationSeed.system.outcomeVerification = {
    ...(projectionMigrationSeed.system.outcomeVerification ?? {}),
    records: [migrationProjection.record],
    projectionIndex: [
      migrationProjection,
      ...Array.from({ length: 2100 }, (_, i) => ({
        executionId: 'exec-migration-projection-forged-' + i,
        fingerprint: '0'.repeat(64),
        record: { ...migrationProjection.record, executionId: 'exec-migration-projection-forged-' + i },
        verifiedExternal: migrationProjection.verifiedExternal,
      })),
    ],
  };
  const migratedProjection = migratePersistedOrganism(projectionMigrationSeed).system.outcomeVerification;
  assert.ok(migratedProjection.projectionIndex.some(row => row.executionId === 'exec-migration-projection-valid'),
    'semantically invalid trailing projection rows must not evict a valid older projection during migration');
  assert.ok(!migratedProjection.projectionIndex.some(row => row.executionId === 'exec-migration-projection-forged-0'),
    'migration must discard projections whose fingerprint does not match their normalized record');
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
  const restoredOutcomeSnapshot=restored.outcomeCognitionSnapshot();
  const restoredVerifiedOutcome=restoredOutcomeSnapshot.records.find(r=>r.executionId===executed.executionId);
  assert.ok(restoredVerifiedOutcome?.externalObservations?.some(observation=>observation.verified), 'restoration must preserve verified external observations without rewriting the original action receipt');
  assert.equal(restoredVerifiedOutcome?.outcomeClass, verifiedOutcome.outcomeClass,
    'state migration must preserve outcome identity fields that participate in the projection fingerprint');
  assert.ok(!restoredOutcomeSnapshot.causal.quarantinedExecutionIds?.includes(executed.executionId),
    'a valid single execution must remain eligible for future external evidence after restore');
  assert.notEqual(restoredVerifiedOutcome?.receiptQuarantined,true, 'a valid single-execution restore must not be quarantined by projection reconciliation; reason='+(restoredVerifiedOutcome?.receiptQuarantineReason??'none'));
  assert.ok(!restoredOutcomeSnapshot.causal.quarantinedExecutionIds?.includes(executed.executionId), 'a valid single execution must remain eligible for future external evidence after restore');
  console.log('BIG_PASS_64_EXTERNAL_OBSERVER=PASS verified='+core.externalObserverSummary().verifiedCount+' contradicted='+core.externalObserverSummary().contradictedCount+' observations='+core.externalObserverSummary().observations);
} finally { await rm(dir,{recursive:true,force:true}); }
