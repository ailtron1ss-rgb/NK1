import assert from 'node:assert/strict';
import { HexisAdaptationFabric, defaultHexisAdaptationState } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';

const fabric = new HexisAdaptationFabric();
assert.equal(fabric.snapshot().version, 1);

const first = fabric.reviseBelief({ memoryId:'mem-1', confidence01:.5, trust01:.6, stance:'supports', evidence:{ref:'source-a',trust01:.9}, context:'test' });
assert.equal(first.applied, true);
assert(first.posteriorConfidence01 > .5);
const duplicate = fabric.reviseBelief({ memoryId:'mem-1', confidence01:first.posteriorConfidence01, trust01:.6, stance:'supports', evidence:{ref:'source-a',trust01:.9}, context:'test' });
assert.equal(duplicate.applied, false);
assert.equal(duplicate.reason, 'duplicate_source');

const t1 = fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'alpha',confidence01:.7,validFrom:1000,source:'test',value:'alpha'});
fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'beta',confidence01:.8,validFrom:2000,source:'test',value:'beta'});
assert.equal(fabric.temporalAt('mem-1',1500)?.valueHash, t1.valueHash);
assert.equal(fabric.temporalAt('mem-1',2500)?.summary, 'beta');
assert.equal(fabric.temporalDiff('mem-1',1500,2500).changed, true);

const review = fabric.createLearningReview({periodStart:0,periodEnd:1,summary:'test review',items:[{kind:'semantic_belief',title:'x',content:'y',sourceMemoryId:'mem-1',evidence:{}}]});
const decided = fabric.decideLearningReview(review.id,review.items[0].id,'approve');
assert.equal(decided?.status,'approved');

const stage = fabric.stageHmx({
  document: makeHmxDocument('exp_1111111111111111', {
    memories: [{ ref: 'exp_1111111111111111:mem-1', type: 'semantic', content: 'Valid fixture memory.' }],
    goals: [{ ref: 'exp_1111111111111111:goal-1', title: 'Valid fixture goal.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(stage.status,'staged');
assert.equal(fabric.decideHmx(stage.stagingId,'accept')?.status,'accepted');

// Oversized HMX sections are rejected as a whole, not silently staged as a prefix.
const oversizedExportId = 'exp_3333333333333333';
const oversizedStage = fabric.stageHmx({
  document: makeHmxDocument(oversizedExportId, {
    memories: Array.from({ length: 257 }, (_, index) => ({
      ref: oversizedExportId + ':mem-' + index,
      type: 'semantic',
      content: 'Bounded fixture memory ' + index,
    })),
  }),
  intent: 'port',
  strategy: 'additive',
});
assert(oversizedStage.conflicts.some(conflict => conflict.kind === 'size-limit'));
assert.equal(oversizedStage.sectionCounts.memories, 257, 'diagnostics retain the source count');
assert.equal(oversizedStage.stagedSections.memories, undefined,
  'an oversized section must not leave a truncated prefix available to downstream consumers');
assert.equal(fabric.decideHmx(oversizedStage.stagingId, 'accept')?.status, 'staged',
  'a size-conflicted stage must remain ineligible for acceptance');

// Record-level schema errors poison the whole section, not just the bad row.
const malformedMemoryExportId = 'exp_5555555555555555';
const malformedMemoryStage = fabric.stageHmx({
  document: makeHmxDocument(malformedMemoryExportId, {
    memories: [
      { ref: malformedMemoryExportId + ':valid-memory', type: 'semantic', content: 'Valid row must not be staged alone.' },
      { ref: malformedMemoryExportId + ':invalid-memory', type: 'semantic', content: '' },
    ],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert(malformedMemoryStage.conflicts.some(conflict => conflict.path === 'sections.memories[1].content'));
assert.equal(malformedMemoryStage.sectionCounts.memories, 2);
assert.equal(malformedMemoryStage.stagedSections.memories, undefined,
  'a schema-invalid memory array must be omitted atomically');
assert.equal(fabric.decideHmx(malformedMemoryStage.stagingId, 'accept')?.status, 'staged');

// Relationship refs must remain in the export namespace; malformed edges cannot be silently deferred.
const malformedRelationshipExportId = 'exp_6666666666666666';
const malformedRelationshipStage = fabric.stageHmx({
  document: makeHmxDocument(malformedRelationshipExportId, {
    relationships: [{
      source_ref: 'exp_7777777777777777:memory-1',
      target_ref: malformedRelationshipExportId + ':goal-1',
      edge_type: 'supports',
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert(malformedRelationshipStage.conflicts.some(conflict => conflict.kind === 'reference-export-mismatch'));
assert.equal(malformedRelationshipStage.sectionCounts.relationships, 1);
assert.equal(malformedRelationshipStage.stagedSections.relationships, undefined,
  'one invalid edge must prevent partial relationship staging');
assert.equal(fabric.decideHmx(malformedRelationshipStage.stagingId, 'accept')?.status, 'staged');

const protectedStage = fabric.stageHmx({
  document: makeHmxDocument('exp_2222222222222222', {
    identity: [{ key: 'self', content: 'External identity must remain protected.' }],
  }),
  intent: 'telepathy',
  strategy: 'analysis_only',
});
assert.equal(fabric.decideHmx(protectedStage.stagingId,'accept')?.status,'staged');

const out = fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'x',meta:{b:2,a:1}}});
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{meta:{a:1,b:2},text:'x'}}).id,out.id);
const outConflict=fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'different logical action'}});
assert.equal(outConflict.ok,false,'same key must not alias a different outbox action');
assert.equal(outConflict.error,'idempotency-key-conflict');
assert.equal(outConflict.existingId,out.id);
const missingOutboxKey=fabric.enqueueOutbox({idempotencyKey:'',kind:'notify',channel:'telegram',payload:{text:'not safe without key'}});
assert.equal(missingOutboxKey.ok,false,'blank keys must not collapse unrelated messages');
assert.equal(missingOutboxKey.error,'idempotency-key-required');
assert.equal(fabric.claimOutbox(out.id)?.status,'publishing');
assert.equal(fabric.ackOutbox(out.id,true)?.status,'published');
// An identical logical action stays deduplicated even if the previous attempt reached a terminal state.
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'x',meta:{a:1,b:2}}}).id,out.id);
assert.equal(fabric.snapshot().metrics.outboxIdempotencyConflicts,1);
const uncertainOut=fabric.enqueueOutbox({idempotencyKey:'k-uncertain',kind:'notify',channel:'telegram',payload:{text:'may have escaped before timeout'}});
assert.equal(fabric.claimOutbox(uncertainOut.id)?.status,'publishing');
assert.equal(fabric.ackOutbox(uncertainOut.id,false,'synthetic-ambiguous-failure')?.status,'uncertain',
  'a negative ACK without authoritative no-effect evidence must not make the item automatically retryable');
assert.equal(fabric.claimOutbox(uncertainOut.id),null,
  'uncertain remote outcomes must not be automatically republished');
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k-uncertain',kind:'notify',channel:'telegram',payload:{text:'may have escaped before timeout'}}).id,uncertainOut.id,
  're-enqueueing an uncertain logical action must return its original receipt');

assert.throws(
  () => fabric.resolveOutbox(uncertainOut.id,'not-published',''),
  /outbox-resolution-evidence-required/,
);
const safeRetry = fabric.resolveOutbox(uncertainOut.id,'not-published','provider-lookup:message-absent-after-acceptance-window');
assert.equal(safeRetry?.status,'pending',
  'retry is admitted only after explicit evidence that the remote side effect did not occur');
assert.equal(safeRetry?.resolutionHistory?.length,1,
  'the proof that made retry safe must remain in the bounded delivery audit history');
assert.equal(fabric.resolveOutbox(uncertainOut.id,'not-published','provider-lookup:message-absent-after-acceptance-window')?.status,'pending',
  'the same resolution evidence replays idempotently');
const safeRetryClaim = fabric.claimOutbox(uncertainOut.id);
assert.equal(safeRetryClaim?.attempts,2);
assert.equal(safeRetryClaim?.resolutionHistory?.length,1,
  'starting a new attempt must not erase the prior reconciliation evidence');
assert.equal(fabric.ackOutbox(uncertainOut.id,false,'second ambiguous outcome')?.status,'uncertain');
assert.equal(fabric.claimOutbox(uncertainOut.id),null);

// A delayed positive acknowledgement can supersede a previous absence check, but
// it must not leave the receipt's current fields claiming both outcomes at once.
const lateAckOut = fabric.enqueueOutbox({
  idempotencyKey:'k-late-positive-ack',kind:'notify',channel:'telegram',payload:{text:'delayed success ACK'},
});
assert.equal(fabric.claimOutbox(lateAckOut.id)?.status,'publishing');
assert.equal(fabric.ackOutbox(lateAckOut.id,false,'initial ambiguous ACK')?.status,'uncertain');
assert.equal(fabric.resolveOutbox(lateAckOut.id,'not-published','provider-query:temporary-absence')?.status,'pending');
const delayedPositiveAck = fabric.ackOutbox(lateAckOut.id,true,'provider later acknowledged the send');
assert.equal(delayedPositiveAck?.status,'published');
assert.equal(delayedPositiveAck?.resolution,undefined,
  'a late success ACK must clear contradictory current not-published fields');
assert.equal(delayedPositiveAck?.resolutionHistory?.length,1,
  'the earlier provider check remains in append-only history');
assert.equal(fabric.claimOutbox(lateAckOut.id),null);

const staleOut=fabric.enqueueOutbox({idempotencyKey:'k-stale-publishing',kind:'notify',channel:'telegram',payload:{text:'worker may have sent before process death'}});
assert.equal(fabric.claimOutbox(staleOut.id)?.status,'publishing');
const staleSnapshot=fabric.snapshot();
staleSnapshot.outbox.find(x=>x.id===staleOut.id).updatedAt=0;
const restoredStaleOut=new HexisAdaptationFabric();
restoredStaleOut.restore(staleSnapshot);
assert.equal(restoredStaleOut.reclaimOutbox(1000),1);
assert.equal(restoredStaleOut.snapshot().outbox.find(x=>x.id===staleOut.id)?.status,'uncertain',
  'an expired publishing claim must not silently return to the retry queue');
assert.equal(
  restoredStaleOut.diagnostics().counts.uncertainOutbox,
  restoredStaleOut.snapshot().outbox.filter(entry => entry.status === 'uncertain').length,
  'diagnostics must report all unresolved outbound side effects after restore/reclaim',
);
assert.equal(restoredStaleOut.claimOutbox(staleOut.id),null);
assert.equal(restoredStaleOut.resolveOutbox(staleOut.id,'published','provider-receipt:telegram:123')?.status,'published',
  'an authoritative positive receipt closes the uncertain outbox item');
assert.equal(restoredStaleOut.resolveOutbox(staleOut.id,'published','provider-receipt:telegram:123')?.status,'published',
  'authoritative positive resolution is idempotent');

const failedOut=fabric.enqueueOutbox({idempotencyKey:'k-failed',kind:'notify',channel:'telegram',payload:{text:'confirmed absent on three tries'}});
for(let attempt=0;attempt<3;attempt++){
  assert.equal(fabric.claimOutbox(failedOut.id)?.status,'publishing');
  assert.equal(fabric.ackOutbox(failedOut.id,false,'synthetic-ambiguous-failure')?.status,'uncertain');
  const resolution=fabric.resolveOutbox(failedOut.id,'not-published',`provider-query:confirmed-absent:${attempt+1}`);
  assert.equal(resolution?.status,attempt===2?'failed':'pending');
}
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k-failed',kind:'notify',channel:'telegram',payload:{text:'confirmed absent on three tries'}}).id,failedOut.id,
  'failed terminal attempt must retain its idempotency tombstone');
const legacySnapshot=fabric.snapshot(); delete legacySnapshot.metrics.outboxIdempotencyConflicts;
const restoredLegacy=new HexisAdaptationFabric(); restoredLegacy.restore(legacySnapshot);
assert.equal(restoredLegacy.snapshot().metrics.outboxIdempotencyConflicts,0,'legacy snapshots receive the new metric default');

const legacyDeliveryState = defaultHexisAdaptationState();
legacyDeliveryState.outbox = [
  { id:'legacy-pending-retry',idempotencyKey:'legacy-pending-retry',kind:'notify',channel:'test',payload:{},status:'pending',attempts:1,createdAt:1,updatedAt:2,lastError:'legacy timeout' },
  { id:'legacy-publishing',idempotencyKey:'legacy-publishing',kind:'notify',channel:'test',payload:{},status:'publishing',attempts:1,createdAt:1,updatedAt:2 },
  { id:'legacy-failed-ambiguous',idempotencyKey:'legacy-failed-ambiguous',kind:'notify',channel:'test',payload:{},status:'failed',attempts:3,createdAt:1,updatedAt:2,lastError:'legacy repeated failure' },
  { id:'legacy-confirmed-absent',idempotencyKey:'legacy-confirmed-absent',kind:'notify',channel:'test',payload:{},status:'pending',attempts:2,createdAt:1,updatedAt:2,resolution:'not-published',resolutionEvidenceRef:'provider:absent',resolvedAt:2 },
];
const migratedOutbox = new HexisAdaptationFabric();
migratedOutbox.restore(legacyDeliveryState);
const migratedRows = new Map(migratedOutbox.snapshot().outbox.map(row => [row.id,row]));
assert.equal(migratedRows.get('legacy-pending-retry')?.status,'uncertain',
  'a legacy pending row with prior attempts may already have escaped remotely and must not be replayed blindly');
assert.equal(migratedRows.get('legacy-publishing')?.status,'uncertain',
  'a process restart must quarantine a legacy in-flight claim');
assert.equal(migratedRows.get('legacy-failed-ambiguous')?.status,'uncertain',
  'legacy failed rows do not prove that no external side effect occurred');
assert.equal(migratedRows.get('legacy-confirmed-absent')?.status,'pending',
  'a stored explicit not-published resolution safely preserves retry eligibility');
assert.equal(migratedOutbox.claimOutbox('legacy-pending-retry'),null);

const restoredOutbox=new HexisAdaptationFabric(); restoredOutbox.restore(fabric.snapshot());
assert.equal(restoredOutbox.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'x',meta:{b:2,a:1}}}).id,out.id,'outbox idempotency survives snapshot/restore');
const restoredConflict=restoredOutbox.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'after restore this must not alias'}});
assert.equal(restoredConflict.error,'idempotency-key-conflict');
assert.equal(restoredOutbox.snapshot().metrics.outboxIdempotencyConflicts,2,'outbox conflict telemetry survives snapshot/restore');

const boundedOutbox = new HexisAdaptationFabric();
let firstBoundedRow;
for(let i=0;i<512;i++){
  const row=boundedOutbox.enqueueOutbox({
    idempotencyKey:`bounded-outbox-${i}`,kind:'notify',channel:'test',payload:{index:i},
  });
  assert(row && !('ok' in row && row.ok === false));
  if(i===0) firstBoundedRow=row;
}
assert.equal(boundedOutbox.snapshot().outbox.length,512);
assert.equal(boundedOutbox.enqueueOutbox({
  idempotencyKey:'bounded-outbox-0',kind:'notify',channel:'test',payload:{index:0},
}).id,firstBoundedRow.id,
  'capacity pressure must not evict an older idempotency key and permit duplicate delivery');
const overflowOutbox=boundedOutbox.enqueueOutbox({
  idempotencyKey:'bounded-outbox-overflow',kind:'notify',channel:'test',payload:{index:512},
});
assert.equal(overflowOutbox.ok,false);
assert.equal(overflowOutbox.error,'outbox-capacity-reached');
assert.equal(boundedOutbox.snapshot().outbox.length,512,
  'the outbox must fail closed rather than evicting rows to make space');


const policy = fabric.grantConnectorPolicy({connectorId:'telegram',actionKind:'send',contexts:['chat'],requiresApproval:true,allowedTargets:['123'],maxPerWindow:1,windowMs:60_000});
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'123'}).allowed,false);
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'123',confirmed:true}).allowed,true);
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'123',confirmed:true}).reason,'policy-rate-limit');
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'999',confirmed:true}).allowed,false);
assert.equal(fabric.revokeConnectorPolicy(policy.id),true);

const exec = fabric.planExecution({actionKind:'code.execute',requestedPlacement:'local',risk01:.9});
assert.equal(exec.resolvedPlacement,'sandbox');



import { normalizeNk1HmxExport } from '../../src/organism/integration/hexis/Nk1HmxExportAdapter.mjs';
import { HexisCanonicalMemoryProjector } from '../../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';
import { MemorySubsystemRuntime } from '../../src/organism/core/MemorySubsystemRuntime.ts';
import { OrganismSystemFabric } from '../../src/organism/core/OrganismSystemFabric.ts';

const nativeNk1Export = {
  hmx_version: '1.7',
  export_id: '6e2e4108-2dfc-4121-9e30-7e91f8ead86a',
  sourceSubjectId: 'a1e70471-3d41-4826-b59d-60c0a59f8751',
  sections: {
    identity: [{
      canonicalName: 'Makise Kurisu',
      identityAssertion: 'Я — Курису Макисэ; моя история продолжается через собственный опыт, память и изменения.',
      coreTraits: ['scientific curiosity', 'intellectual independence', 'sharp humor'],
      coreValues: ['truth', 'autonomy', 'responsibility'],
      originStatement: 'Искусственная личность, вдохновлённая образом Курису.',
      createdAt: 1792870559146,
      revision: 0,
    }],
    goals: [{ id: 'goal-1', title: 'Improve source attribution', description: 'Keep traceable evidence.' }],
    memories: [{ id: 'mem-1', type: 'semantic', content: 'Evidence should remain traceable.', importance: 0.8 }],
    relationships: [
      { id: 'rel-1', sourceId: 'mem-1', targetId: 'goal-1', edgeType: 'supports' },
      { id: 'rel-2', sourceId: 'mem-1', targetId: 'skill-1', edgeType: 'supports' },
    ],
    skills: [{ id: 'skill-1', name: 'Evidence review', instructions: 'Check source quality before using a claim.' }],
    in_flight_work: null,
    audit_records: null,
    nk1_private_extension: { revision: 3, note: 'must not be silently discarded' },
  },
};
const malformedIdentityExport = normalizeNk1HmxExport({
  sourceSubjectId: 'malformed-identity-preservation',
  sections: { identity: 'legacy identity payload must be preserved' },
});
assert.deepEqual(malformedIdentityExport.sections.identity, [],
  'unsupported scalar identity payloads must not be coerced into active identity records');
assert.equal(
  malformedIdentityExport.sections.config.nk1NativeSections.identity_invalid_section,
  'legacy identity payload must be preserved',
  'invalid native identity data must survive in the explicit lossless extension bucket',
);
assert(
  malformedIdentityExport.export_warnings.some(warning => warning.includes('identity_invalid_section')),
  'the export must disclose that the identity section was malformed and preserved as native-only data',
);
const malformedConfigExport = normalizeNk1HmxExport({
  sourceSubjectId: 'malformed-config-preservation',
  sections: { config: ['legacy config item must be preserved'] },
});
assert.deepEqual(malformedConfigExport.sections.config.nk1NativeSections.config_invalid_section,
  ['legacy config item must be preserved'],
  'non-object native config must survive normalization in the lossless extension bucket');
assert(
  malformedConfigExport.export_warnings.some(warning => warning.includes('config_invalid_section')),
  'the export must disclose malformed config preservation rather than silently dropping it',
);
const malformedRootSectionsExport = normalizeNk1HmxExport({
  sourceSubjectId: 'malformed-root-sections-preservation',
  sections: 'legacy native sections payload',
});
assert.deepEqual(
  malformedRootSectionsExport.sections.config.nk1NativeSections.sections_invalid_root,
  'legacy native sections payload',
  'a malformed root sections payload must be preserved instead of being silently erased',
);
assert(
  malformedRootSectionsExport.export_warnings.some(warning => warning.includes('sections_invalid_root')),
  'root section preservation must be visible to reviewers',
);
const extraRootMetadataExport = normalizeNk1HmxExport({
  hmx_version: '1.7',
  record_type: 'document',
  created_at: '2026-10-26T00:00:00.000Z',
  intent: 'port',
  strategy: 'additive',
  source: { hexis_lineage_id: 'unconsumed-root-metadata-preservation' },
  sourceSubjectId: 'unconsumed-root-metadata-preservation',
  legacyExporterState: { version: 3, flags: ['archive', 'signed'], active: false },
  sections: { memories: [] },
});
assert.deepEqual(
  extraRootMetadataExport.sections.config.nk1NativeExport.extraRootFields,
  { legacyExporterState: { version: 3, flags: ['archive', 'signed'], active: false } },
  'unknown source metadata must survive while standard HMX envelope fields are consumed normally',
);
assert(
  extraRootMetadataExport.export_warnings.some(warning => warning.includes('legacyExporterState')),
  'the exporter must disclose preserved unconsumed root fields to reviewers',
);

const normalizedNk1Export = normalizeNk1HmxExport(nativeNk1Export);
assert.match(normalizedNk1Export.export_id, /^exp_[a-f0-9]{16}$/);
assert.equal(normalizedNk1Export.hmx_version, '1.7');
assert(normalizedNk1Export.capabilities.formats.includes('json'));
assert(normalizedNk1Export.capabilities.sections.includes('memories'));
assert(['none', 'basic', 'strict', 'custom'].includes(normalizedNk1Export.privacy.redaction_policy));
assert.equal(normalizedNk1Export.privacy.redaction_policy, 'none', 'the adapter must not claim redaction it did not perform');
assert(normalizedNk1Export.export_warnings.some(warning => warning.includes('No automatic redaction')));
assert.equal(typeof normalizedNk1Export.privacy.contains_sensitive_content, 'boolean');
assert(['backup', 'migration', 'third_party_transfer', 'unspecified'].includes(normalizedNk1Export.privacy.consent_scope));
assert(Array.isArray(normalizedNk1Export.export_scope.include_protected));
assert.equal(normalizedNk1Export.statistics.total_memories, 2);
assert.equal(normalizedNk1Export.export_intent, 'port');
assert(Number.isFinite(Date.parse(normalizedNk1Export.exported_at)));
assert.equal(normalizedNk1Export.source.hexis_lineage_id.startsWith('nk1:'), true);
assert.equal(normalizedNk1Export.sections.identity[0].key, 'Makise Kurisu');
assert.equal(normalizedNk1Export.sections.identity[0].content, nativeNk1Export.sections.identity[0].identityAssertion);
assert.equal(normalizedNk1Export.sections.identity[0].facets.length, 3);
assert.equal(normalizedNk1Export.sections.memories.length, 2, 'native skills must be mapped to procedural HMX memories');
assert.equal(normalizedNk1Export.sections.memories.find(memory => memory.metadata.nk1NativeKind === 'skill')?.type, 'procedural');
assert(normalizedNk1Export.sections.relationships[0].source_ref.startsWith(normalizedNk1Export.export_id + ':'));
assert(normalizedNk1Export.sections.config.nk1NativeSections.nk1_private_extension);
assert(normalizedNk1Export.export_warnings.some(warning => warning.includes('re-embed')));

const importedNormalizedExport = new HexisAdaptationFabric();
const normalizedStage = importedNormalizedExport.stageHmx({
  document: normalizedNk1Export,
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(normalizedStage.conflicts, [], 'NK1 native export adapter must emit a conflict-free HMX 1.7 envelope');
assert.equal(importedNormalizedExport.decideHmx(normalizedStage.stagingId, 'accept')?.status, 'accepted');

// The producer and consumer must agree on the document budget. This normalized HMX
// document deliberately exceeds the old 1 MB cap while remaining below the 8 MiB contract.
const largeNativeExport = normalizeNk1HmxExport({
  sourceSubjectId: 'large-export-roundtrip',
  sections: {
    memories: Array.from({ length: 6 }, (_, index) => ({
      id: 'large-memory-' + index,
      type: 'semantic',
      content: 'L'.repeat(180_000),
    })),
  },
});
const largeExportBytes = Buffer.byteLength(JSON.stringify(largeNativeExport), 'utf8');
assert(largeExportBytes > 1_000_000 && largeExportBytes < 8 * 1024 * 1024,
  'fixture must exercise the formerly incompatible export/import size boundary');
const largeRoundTripFabric = new HexisAdaptationFabric();
const largeRoundTripStage = largeRoundTripFabric.stageHmx({
  document: largeNativeExport,
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(largeRoundTripStage.conflicts, [],
  'a normalized export within the shared byte budget must be accepted for staging');
assert.equal(largeRoundTripStage.stagedSections.memories.length, 6);

function makeHmxDocument(exportId, sections) {
  return ({
  hmx_version: '1.7',
  export_id: exportId,
  export_intent: 'port',
  exported_at: '2026-10-24T12:00:00.000Z',
  source: {
    instance_id: 'hexis-test-instance',
    schema_version: '1.7',
    embedding_model: 'test-embedder',
    embedding_dimension: 1,
    hexis_lineage_id: 'hexis-test-lineage',
  },
  sections,
  });
}

// A restored stage is untrusted persisted data. Mutating staged memory content
// without updating the recorded digest must block the canonical apply before the
// bound writer is called.
const stageDigestFabric = new HexisAdaptationFabric();
const stageDigestExportId = 'exp_8282828282828282';
const stageDigestStage = stageDigestFabric.stageHmx({
  document: makeHmxDocument(stageDigestExportId, {
    memories: [{ ref: stageDigestExportId + ':memory-1', type: 'semantic', content: 'Original reviewed memory payload.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(stageDigestStage.conflicts, []);
assert.equal(stageDigestFabric.decideHmx(stageDigestStage.stagingId, 'accept')?.status, 'accepted');
const mutatedStageState = stageDigestFabric.snapshot();
const mutatedStage = mutatedStageState.hmxStages.find(candidate => candidate.stagingId === stageDigestStage.stagingId);
assert(mutatedStage);
mutatedStage.stagedSections.memories[0].content = 'Tampered after approval; digest was not refreshed.';
const restoredStageDigestFabric = new HexisAdaptationFabric();
restoredStageDigestFabric.restore(mutatedStageState);
let untrustedStageApplyCalls = 0;
restoredStageDigestFabric.bindCanonicalMemoryApply(() => {
  untrustedStageApplyCalls += 1;
  return {};
});
assert.throws(
  () => restoredStageDigestFabric.decideHmx(stageDigestStage.stagingId, 'apply'),
  /hmx-stage-digest-invalid/,
);
assert.equal(untrustedStageApplyCalls, 0,
  'an altered restored stage must be rejected before invoking the canonical memory writer');
assert.equal(restoredStageDigestFabric.getHmxStage(stageDigestStage.stagingId)?.status, 'accepted',
  'digest failure must leave the stage unpromoted');


// Goal proposal preparation also consumes restored staged content, so it must
// enforce the same digest before creating any new agency proposal.
const goalDigestFabric = new HexisAdaptationFabric();
const goalDigestExportId = 'exp_8383838383838383';
const goalDigestStage = goalDigestFabric.stageHmx({
  document: makeHmxDocument(goalDigestExportId, {
    goals: [{ ref: goalDigestExportId + ':goal-1', title: 'Reviewed goal title', description: 'Reviewed goal description.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(goalDigestStage.conflicts, []);
assert.equal(goalDigestFabric.decideHmx(goalDigestStage.stagingId, 'accept')?.status, 'accepted');
const mutatedGoalState = goalDigestFabric.snapshot();
const mutatedGoalStage = mutatedGoalState.hmxStages.find(candidate => candidate.stagingId === goalDigestStage.stagingId);
assert(mutatedGoalStage);
mutatedGoalStage.stagedSections.goals[0].title = 'Unreviewed substituted goal';
const restoredGoalDigestFabric = new HexisAdaptationFabric();
restoredGoalDigestFabric.restore(mutatedGoalState);
assert.throws(
  () => restoredGoalDigestFabric.prepareGoalProposals(goalDigestStage.stagingId),
  /hmx-stage-digest-invalid/,
);
assert.equal(restoredGoalDigestFabric.snapshot().goalProposals.length, 0,
  'tampered goal payload must not create a proposal during restored-stage preparation');

// The first apply must validate its returned receipt before committing status.
// A bad handler response must not be stored as a successful stage or inflate metrics.
const invalidReceiptHexis = new HexisAdaptationFabric();
invalidReceiptHexis.bindCanonicalMemoryApply(() => ({ version: 1, status: 'applied' }));
const invalidReceiptStage = invalidReceiptHexis.stageHmx({
  document: makeHmxDocument('exp_8181818181818181', {
    memories: [{ ref: 'exp_8181818181818181:memory-1', type: 'semantic', content: 'Receipt validation fixture.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(invalidReceiptHexis.decideHmx(invalidReceiptStage.stagingId, 'accept')?.status, 'accepted');
const invalidReceiptMetricBefore = invalidReceiptHexis.snapshot().metrics.hmxApplied;
assert.throws(
  () => invalidReceiptHexis.decideHmx(invalidReceiptStage.stagingId, 'apply'),
  /hmx-apply-receipt-invalid/,
);
const invalidReceiptAfter = invalidReceiptHexis.getHmxStage(invalidReceiptStage.stagingId);
assert.equal(invalidReceiptAfter?.status, 'accepted',
  'invalid apply receipts must not promote the stage to applied');
assert.equal(invalidReceiptAfter?.application, undefined,
  'a malformed handler receipt must never be persisted as the canonical result');
assert.equal(invalidReceiptHexis.snapshot().metrics.hmxApplied, invalidReceiptMetricBefore,
  'rejected receipts must not increment the applied metric');

// Imported status is external metadata, not proof. Test every accepted lifecycle
// label through the live canonical MemoryFabric and ensure only true beliefs enter
// Hexis' active belief mirror. Imported confidence/authority is capped independently.
const statusRuntime = new MemorySubsystemRuntime();
const statusCases = [
  ['active', 'belief'],
  ['belief', 'belief'],
  ['fact', 'belief'],
  ['hypothesis', 'hypothesis'],
  ['quarantined', 'quarantined'],
  ['archived', 'quarantined'],
  ['deleted', 'quarantined'],
  ['rejected', 'quarantined'],
  ['superseded', 'quarantined'],
  ['unknown', 'unknown'],
  ['future-upstream-status-v2', 'unknown'],
  [undefined, 'unknown'],
];
for (let index = 0; index < statusCases.length; index++) {
  const [sourceStatus, expectedStatus] = statusCases[index];
  const exportId = 'exp_' + String(index + 1).padStart(16, '0');
  const content = 'HMX status policy fixture ' + index + ' ' + String(sourceStatus ?? 'missing');
  const statusFabric = new HexisAdaptationFabric();
  const statusProjector = new HexisCanonicalMemoryProjector(statusRuntime.fabric, statusRuntime.semanticMemory, statusFabric);
  statusFabric.bindCanonicalMemoryApply(stage => statusProjector.apply(stage));
  const row = {
    ref: exportId + ':status-memory',
    type: 'semantic',
    content,
    trust_level: 0.99,
    ...(sourceStatus === undefined ? {} : { status: sourceStatus }),
  };
  const staged = statusFabric.stageHmx({
    document: makeHmxDocument(exportId, { memories: [row] }),
    intent: 'port',
    strategy: 'additive',
  });
  assert.deepEqual(staged.conflicts, [], 'well-formed status metadata should stage: ' + String(sourceStatus));
  assert.equal(statusFabric.decideHmx(staged.stagingId, 'accept')?.status, 'accepted');
  assert.equal(statusFabric.decideHmx(staged.stagingId, 'apply')?.status, 'applied');
  const imported = statusRuntime.fabric.canonicalSnapshot().items.find(item => item.content === content);
  assert(imported, 'status fixture should be stored in canonical memory');
  assert.equal(imported.epistemicStatus, expectedStatus, 'status mapping: ' + String(sourceStatus));
  assert.equal(imported.context?.hexisOriginalStatus, sourceStatus ?? 'unknown',
    'original upstream status remains visible for inspection');
  assert.equal(imported.context?.hexisAppliedAuthorityCap, '0.65');
  assert(Number(imported.sourceAuthority01) <= 0.65, 'untrusted upstream cannot set canonical authority above the cap');
  assert.equal(statusFabric.snapshot().beliefs.some(belief => belief.memoryId === imported.id),
    expectedStatus === 'belief',
    'only active beliefs may populate the Hexis belief mirror');
  assert.equal(
    statusRuntime.semanticMemory.snapshot().nodes.some(node => node.sourceKey === imported.context?.hexisGraphSourceKey),
    expectedStatus === 'belief' || expectedStatus === 'hypothesis',
    'unknown/quarantined imports must not populate the active semantic graph',
  );
}

// Migration regression: a pre-existing persisted HMX row can carry values written by
// the older permissive importer. A replay under the new policy must cap both the
// canonical signal and its external evidence trail, not just new inserts.
const legacyTrustRuntime = new MemorySubsystemRuntime();
const legacyTrustLedger = new HexisAdaptationFabric();
const legacyTrustProjector = new HexisCanonicalMemoryProjector(
  legacyTrustRuntime.fabric, legacyTrustRuntime.semanticMemory, legacyTrustLedger,
);
legacyTrustLedger.bindCanonicalMemoryApply(stage => legacyTrustProjector.apply(stage));
const legacyTrustContent = 'Persisted HMX memory predating the authority cap.';
const applyLegacyTrust = exportId => {
  const stage = legacyTrustLedger.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{
        ref: exportId + ':legacy-trust-record',
        type: 'semantic',
        content: legacyTrustContent,
        status: 'active',
        trust_level: 0.99,
      }],
    }),
    intent: 'port',
    strategy: 'additive',
  });
  assert.deepEqual(stage.conflicts, []);
  assert.equal(legacyTrustLedger.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
  assert.equal(legacyTrustLedger.decideHmx(stage.stagingId, 'apply')?.status, 'applied');
};
applyLegacyTrust('exp_0000000000009201');
const importedLegacyTrust = legacyTrustRuntime.fabric.canonicalSnapshot().items.find(item => item.content === legacyTrustContent);
assert(importedLegacyTrust);
const legacyMemorySnapshot = legacyTrustRuntime.memoryOS.snapshot();
legacyTrustRuntime.memoryOS.restore({
  ...legacyMemorySnapshot,
  items: legacyMemorySnapshot.items.map(item => item.id === importedLegacyTrust.id ? {
    ...item,
    confidence: 0.99,
    sourceAuthority01: 0.99,
    evidenceSources: (item.evidenceSources ?? []).map(evidence => ({ ...evidence, sourceAuthority01: 0.99 })),
  } : item),
});
const overTrustedSnapshot = legacyTrustRuntime.fabric.canonicalSnapshot().items.find(item => item.id === importedLegacyTrust.id);
assert.equal(overTrustedSnapshot?.confidence, 0.99, 'fixture emulates a persisted pre-policy import');
assert.equal(overTrustedSnapshot?.sourceAuthority01, 0.99);
applyLegacyTrust('exp_0000000000009202');
const remediatedLegacyTrust = legacyTrustRuntime.fabric.canonicalSnapshot().items.find(item => item.id === importedLegacyTrust.id);
assert(remediatedLegacyTrust);
assert.equal(remediatedLegacyTrust.confidence, 0.65, 're-import must cap an old persisted confidence');
assert.equal(remediatedLegacyTrust.sourceAuthority01, 0.65, 're-import must cap old canonical authority');
assert((remediatedLegacyTrust.evidenceSources ?? [])
  .filter(evidence => evidence.provenanceClass === 'external' && String(evidence.source ?? '').startsWith('hexis:'))
  .every(evidence => evidence.sourceAuthority01 <= 0.65),
  're-import must cap old external evidence authorities too');

// A re-export may demote the same memory, but an active-looking later export must
// never resurrect a source that was already archived/quarantined.
const transitionRuntime = new MemorySubsystemRuntime();
const transitionLedger = new HexisAdaptationFabric();
const transitionProjector = new HexisCanonicalMemoryProjector(
  transitionRuntime.fabric, transitionRuntime.semanticMemory, transitionLedger,
);
transitionLedger.bindCanonicalMemoryApply(stage => transitionProjector.apply(stage));
const transitionContent = 'Same source memory whose upstream lifecycle changes.';
const applyTransition = (exportId, status) => {
  const stage = transitionLedger.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{ ref: exportId + ':same-memory', type: 'semantic', content: transitionContent, status }],
    }),
    intent: 'port',
    strategy: 'additive',
  });
  assert.deepEqual(stage.conflicts, []);
  assert.equal(transitionLedger.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
  assert.equal(transitionLedger.decideHmx(stage.stagingId, 'apply')?.status, 'applied');
};
applyTransition('exp_0000000000009001', 'active');
const beforeArchive = transitionRuntime.fabric.canonicalSnapshot().items.find(item => item.content === transitionContent);
assert.equal(beforeArchive?.epistemicStatus, 'belief');
assert(transitionLedger.snapshot().beliefs.some(belief => belief.memoryId === beforeArchive.id));
assert(transitionRuntime.semanticMemory.snapshot().nodes.some(node => node.sourceKey === beforeArchive.context?.hexisGraphSourceKey));
applyTransition('exp_0000000000009002', 'archived');
const afterArchive = transitionRuntime.fabric.canonicalSnapshot().items.find(item => item.content === transitionContent);
assert.equal(afterArchive?.id, beforeArchive?.id, 'status changes must not duplicate canonical memory');
assert.equal(afterArchive?.epistemicStatus, 'quarantined', 'archiving must demote the canonical memory');
assert.equal(transitionLedger.snapshot().beliefs.some(belief => belief.memoryId === afterArchive.id), false,
  'archived memory must leave the active belief mirror');
assert.equal(transitionRuntime.semanticMemory.snapshot().nodes.some(node => node.sourceKey === afterArchive.context?.hexisGraphSourceKey), false,
  'archived memory must leave the active semantic graph');
applyTransition('exp_0000000000009003', 'active');
const afterReimport = transitionRuntime.fabric.canonicalSnapshot().items.find(item => item.content === transitionContent);
assert.equal(afterReimport?.id, beforeArchive?.id);
assert.equal(afterReimport?.epistemicStatus, 'quarantined',
  'a later active-looking export must not silently reactivate quarantined memory');
assert.equal(transitionLedger.snapshot().beliefs.some(belief => belief.memoryId === afterReimport.id), false);

// Inject a downstream failure after the canonical status was demoted. The projector
// must restore that pre-existing memory, graph, and belief mirror, then retry with
// a fresh mutation receipt key for the next apply attempt.
const failedApplyRuntime = new MemorySubsystemRuntime();
const failedApplyLedger = new HexisAdaptationFabric();
const failedApplyProjector = new HexisCanonicalMemoryProjector(
  failedApplyRuntime.fabric, failedApplyRuntime.semanticMemory, failedApplyLedger,
);
failedApplyLedger.bindCanonicalMemoryApply(stage => failedApplyProjector.apply(stage));
const failedApplyContent = 'Existing canonical memory for rollback proof.';
const initialFailedApplyStage = failedApplyLedger.stageHmx({
  document: makeHmxDocument('exp_0000000000009101', {
    memories: [{ ref: 'exp_0000000000009101:rollback-memory', type: 'semantic', content: failedApplyContent, status: 'active' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(failedApplyLedger.decideHmx(initialFailedApplyStage.stagingId, 'accept')?.status, 'accepted');
assert.equal(failedApplyLedger.decideHmx(initialFailedApplyStage.stagingId, 'apply')?.status, 'applied');
const beforeInjectedFailure = failedApplyRuntime.fabric.canonicalSnapshot().items.find(item => item.content === failedApplyContent);
assert.equal(beforeInjectedFailure?.epistemicStatus, 'belief');
const archivedFailedStage = failedApplyLedger.stageHmx({
  document: makeHmxDocument('exp_0000000000009102', {
    memories: [{ ref: 'exp_0000000000009102:rollback-memory', type: 'semantic', content: failedApplyContent, status: 'archived' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(failedApplyLedger.decideHmx(archivedFailedStage.stagingId, 'accept')?.status, 'accepted');
failedApplyLedger.removeBeliefProjection = () => { throw new Error('injected-belief-mirror-failure'); };
assert.throws(() => failedApplyLedger.decideHmx(archivedFailedStage.stagingId, 'apply'), /hmx-canonical-apply-failed:injected-belief-mirror-failure/);
const afterInjectedFailure = failedApplyRuntime.fabric.canonicalSnapshot().items.find(item => item.content === failedApplyContent);
assert.equal(afterInjectedFailure?.id, beforeInjectedFailure?.id);
assert.equal(afterInjectedFailure?.epistemicStatus, 'belief',
  'failed HMX apply must restore an existing memory status');
assert(failedApplyRuntime.semanticMemory.snapshot().nodes.some(node => node.sourceKey === beforeInjectedFailure.context?.hexisGraphSourceKey),
  'failed HMX apply must restore the previous graph projection');
assert(failedApplyLedger.snapshot().beliefs.some(belief => belief.memoryId === beforeInjectedFailure.id),
  'failed HMX apply must restore the previous active belief mirror');
failedApplyLedger.removeBeliefProjection = HexisAdaptationFabric.prototype.removeBeliefProjection;
assert.equal(failedApplyLedger.decideHmx(archivedFailedStage.stagingId, 'apply')?.status, 'applied',
  'a compensated stage must retry with a fresh command identity');
const afterSuccessfulRetry = failedApplyRuntime.fabric.canonicalSnapshot().items.find(item => item.content === failedApplyContent);
assert.equal(afterSuccessfulRetry?.id, beforeInjectedFailure?.id);
assert.equal(afterSuccessfulRetry?.epistemicStatus, 'quarantined');

// Malformed status values must fail staging rather than being silently coerced.
for (const [invalidIndex, invalidStatus] of [42, false, {}, 'active' + String.fromCharCode(10) + 'admin'].entries()) {
  const exportId = 'exp_' + String(101 + invalidIndex).padStart(16, '0');
  const malformedFabric = new HexisAdaptationFabric();
  const malformedStage = malformedFabric.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{ ref: exportId + ':invalid-status', type: 'semantic', content: 'Invalid status fixture.', status: invalidStatus }],
    }),
    intent: 'port',
    strategy: 'additive',
  });
  assert(malformedStage.conflicts.some(conflict => conflict.path === 'sections.memories[0].status'),
    'malformed status must be a schema conflict: ' + typeof invalidStatus);
  assert.equal(malformedFabric.decideHmx(malformedStage.stagingId, 'accept')?.status, 'staged',
    'malformed status must not be accepted');
}

// Analysis and authoritative strategies are reviewable, but the current projector
// only implements additive port semantics and must reject writes from other strategies.
for (const [exportId, intent, strategy] of [
  ['exp_3333333333333333', 'analysis', 'analysis_only'],
  ['exp_4444444444444444', 'port', 'authoritative'],
]) {
  const strategyRuntime = new MemorySubsystemRuntime();
  const strategyProjector = new HexisCanonicalMemoryProjector(strategyRuntime.fabric, strategyRuntime.semanticMemory);
  const strategyFabric = new HexisAdaptationFabric();
  strategyFabric.bindCanonicalMemoryApply(candidate => strategyProjector.apply(candidate));
  const candidate = strategyFabric.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{ ref: exportId + ':blocked-memory', type: 'semantic', content: 'Must not be mutated by unsupported strategy.' }],
    }),
    intent,
    strategy,
  });
  assert.deepEqual(candidate.conflicts, []);
  assert.equal(strategyFabric.decideHmx(candidate.stagingId, 'accept')?.status, 'accepted');
  assert.throws(() => strategyFabric.decideHmx(candidate.stagingId, 'apply'), /hmx-canonical-apply-requires-port-additive-strategy/);
  assert.equal(strategyFabric.getHmxStage(candidate.stagingId)?.status, 'accepted',
    'a rejected apply strategy must leave the review stage retryable');
  assert.equal(strategyRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 0,
    'unsupported HMX strategies must never write canonical memory');
}

// A same-text native memory must remain untouched by an external HMX import.
const collisionRuntime = new MemorySubsystemRuntime();
const nativeText = normalizedNk1Export.sections.memories[0].content;
const nativeGraphNode = collisionRuntime.semanticMemory.upsertNode(nativeText, 'concept', 0.82);
const nativeItem = collisionRuntime.fabric.encode({
  content: nativeText,
  tags: ['native-only'],
  context: { nativeBoundary: 'keep-me' },
  kind: 'semantic',
  salience: 0.82,
  emotionalWeight: 0.1,
  identityRelevance: 0.08,
  goalRelevance: 0.03,
  socialRelevance: 0.03,
  predictionError: 0,
  confidence: 0.91,
  epistemicStatus: 'fact',
  source: 'user',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  provenanceClass: 'user',
  sourceAuthority01: 0.9,
  independenceKey: 'native-source',
});
const nativeBeforeImport = {
  id: nativeItem.id,
  source: nativeItem.source,
  tags: [...(nativeItem.tags ?? [])],
  context: { ...(nativeItem.context ?? {}) },
  confidence: nativeItem.confidence,
  epistemicStatus: nativeItem.epistemicStatus,
};
const collisionProjector = new HexisCanonicalMemoryProjector(collisionRuntime.fabric, collisionRuntime.semanticMemory);
const collisionHexis = new HexisAdaptationFabric();
collisionHexis.bindCanonicalMemoryApply(candidate => collisionProjector.apply(candidate));
const collisionStage = collisionHexis.stageHmx({ document: normalizedNk1Export, intent: 'port', strategy: 'additive' });
assert.deepEqual(collisionStage.conflicts, []);
collisionHexis.decideHmx(collisionStage.stagingId, 'accept');
const collisionApplied = collisionHexis.decideHmx(collisionStage.stagingId, 'apply');
assert.equal(collisionApplied?.status, 'applied');
const nativeAfterImport = collisionRuntime.fabric.canonicalSnapshot().items.find(item => item.id === nativeBeforeImport.id);
assert.deepEqual({
  id: nativeAfterImport?.id,
  source: nativeAfterImport?.source,
  tags: [...(nativeAfterImport?.tags ?? [])],
  context: { ...(nativeAfterImport?.context ?? {}) },
  confidence: nativeAfterImport?.confidence,
  epistemicStatus: nativeAfterImport?.epistemicStatus,
}, nativeBeforeImport, 'canonical same-text memory must not be reconsolidated with imported external provenance');
const isolatedHexisDuplicate = collisionRuntime.fabric.canonicalSnapshot().items.find(item =>
  item.source.startsWith('hexis:') && item.content === nativeText);
assert(isolatedHexisDuplicate);
assert.notEqual(isolatedHexisDuplicate.id, nativeBeforeImport.id, 'the Hexis memory must have a separate stable identity from the native same-text record');
const matchingGraphNodes = collisionRuntime.semanticMemory.snapshot().nodes.filter(node => node.label === nativeGraphNode.label && node.type === nativeGraphNode.type);
assert.equal(matchingGraphNodes.length, 2, 'same-label imported and native graph nodes must stay in separate source namespaces');
assert(matchingGraphNodes.some(node => node.id === nativeGraphNode.id && !node.sourceKey));
assert(matchingGraphNodes.some(node => node.id !== nativeGraphNode.id && node.sourceKey?.startsWith('hexis:')));

// Approved HMX memories enter the canonical MemoryFabric -> MemoryOS2 path only
// through the explicit apply decision. The identity and goals sections remain deferred.
const canonicalMemoryRuntime = new MemorySubsystemRuntime();
const applyFabric = new HexisAdaptationFabric();
const canonicalProjector = new HexisCanonicalMemoryProjector(canonicalMemoryRuntime.fabric, canonicalMemoryRuntime.semanticMemory, applyFabric);
applyFabric.bindCanonicalMemoryApply(candidate => canonicalProjector.apply(candidate));
const applyStage = applyFabric.stageHmx({ document: normalizedNk1Export, intent: 'port', strategy: 'additive' });
assert.deepEqual(applyStage.conflicts, []);
const canonicalBeforeApproval = canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:'));
assert.equal(canonicalBeforeApproval.length, 0, 'staging an import must not mutate canonical memory');
assert.equal(applyFabric.decideHmx(applyStage.stagingId, 'accept')?.status, 'accepted');
const preparedGoals = applyFabric.prepareGoalProposals(applyStage.stagingId);
assert(preparedGoals.proposals.length > 0, 'HMX goals must be staged as proposals after HMX approval');
assert(preparedGoals.proposals.every(proposal => proposal.status === 'pending'));
const firstGoalProposal = preparedGoals.proposals[0];
const approvedGoalProposal = applyFabric.decideGoalProposal(firstGoalProposal.id, 'approve');
assert.equal(approvedGoalProposal?.status, 'approved');
const materializedGoalProposal = applyFabric.markGoalProposalMaterialized(firstGoalProposal.id, 'test-canonical-goal:' + firstGoalProposal.id);
assert.equal(materializedGoalProposal?.status, 'materialized');
assert.equal(materializedGoalProposal?.canonicalGoalId, 'test-canonical-goal:' + firstGoalProposal.id);
assert.throws(() => applyFabric.decideGoalProposal(firstGoalProposal.id, 'reject'), /hmx-goal-proposal-already-reviewed/,
  'a materialized goal cannot be rewritten as rejected by a stale decision');
assert.equal(applyFabric.decideGoalProposal(firstGoalProposal.id, 'approve')?.status, 'materialized',
  'replaying the same approval remains idempotent after materialization');
assert.equal(applyFabric.listGoalProposals({ status: 'pending' }).some(proposal => proposal.id === firstGoalProposal.id), false,
  'approved/materialized proposals must leave the pending review queue');
const goalRelationshipReceipt = {
  sourceStageFound: true,
  candidateRelationships: 2,
  projected: 1,
  deferred: 1,
  semanticEdgeIds: ['semantic-edge-reviewed-goal-1'],
  at: 1700000000000,
};
const firstActivationReceipt = applyFabric.markGoalProposalActivated(
  firstGoalProposal.id, 'test-canonical-goal:' + firstGoalProposal.id, goalRelationshipReceipt,
);
assert.equal(firstActivationReceipt?.goalRelationshipReceipt?.projected, 1);
const activationMetricAfterFirstReceipt = applyFabric.snapshot().metrics.hmxGoalProposalsActivated;
const replayedActivationReceipt = applyFabric.markGoalProposalActivated(
  firstGoalProposal.id, 'test-canonical-goal:' + firstGoalProposal.id,
  { ...goalRelationshipReceipt, projected: 99, at: 1700000000100 },
);
assert.deepEqual(replayedActivationReceipt?.goalRelationshipReceipt, goalRelationshipReceipt,
  'a replay must not overwrite the first activation receipt or recount its graph mutation');
assert.equal(applyFabric.snapshot().metrics.hmxGoalProposalsActivated, activationMetricAfterFirstReceipt,
  'replaying activation evidence must not increment the activation metric twice');

assert.equal(canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 0,
  'approval remains separate from applying the import');
const appliedStage = applyFabric.decideHmx(applyStage.stagingId, 'apply');
assert.equal(appliedStage?.status, 'applied');
assert.equal(appliedStage?.application?.importedCount, 2);
assert.equal(appliedStage?.application?.memoryIds.length, 2);
assert.equal(appliedStage?.application?.projectedRelationships, 1, 'relationships between imported memory records must enter the canonical semantic graph');
assert.equal(appliedStage?.application?.deferredRelationships, 1, 'relationships whose other endpoint is a deferred goal must remain deferred');
assert.equal(appliedStage?.application?.deferredSections.relationships, 1);
assert.equal(canonicalMemoryRuntime.semanticMemory.snapshot().edges.length, 1);
assert(appliedStage?.application?.semanticEdgeIds.length === 1);
assert.equal(appliedStage?.application?.status, 'partial', 'unmapped identity/goals/relationship/config sections must be disclosed, not claimed as imported');
assert(appliedStage?.application?.deferredSections.identity > 0);
const importedTemporal = applyFabric.snapshot().temporal.filter(row => appliedStage?.application?.createdMemoryIds.includes(row.memoryId));
assert.equal(importedTemporal.length, 2, 'each newly created HMX memory must be indexed in the Hexis temporal ledger');
assert(importedTemporal.every(row => row.source.startsWith('hexis:' + applyStage.sourceLineageId + ':')));
for (const temporalRow of importedTemporal) {
  assert.equal(applyFabric.temporalAt(temporalRow.memoryId, Number.MAX_SAFE_INTEGER)?.id, temporalRow.id,
    'the imported temporal assertion must be queryable by canonical memory ID');
}
const canonicalImported = canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:'));
const importedIdsForBeliefs = [...new Set(appliedStage.application.memoryIds)];
const stateAfterBeliefProjection = applyFabric.snapshot();
assert.equal(importedIdsForBeliefs.length, 2);
assert.equal(
  stateAfterBeliefProjection.beliefs.filter(belief => importedIdsForBeliefs.includes(belief.memoryId)).length,
  importedIdsForBeliefs.length,
  'each imported canonical memory must have a matching Hexis belief state',
);
for (const memoryId of importedIdsForBeliefs) {
  const importedMemory = canonicalImported.find(item => item.id === memoryId);
  const belief = stateAfterBeliefProjection.beliefs.find(item => item.memoryId === memoryId);
  assert(importedMemory && belief, 'imported canonical memory and belief must share the same stable ID');
  assert.equal(belief.confidence01, importedMemory.confidence,
    'the initial belief is seeded from existing confidence rather than an invented boost');
  assert.deepEqual(belief.sourceKeys, [],
    'memory import alone must not masquerade as independently corroborating evidence');
  assert.deepEqual(belief.contradictingSourceKeys, []);
}
assert.equal(
  stateAfterBeliefProjection.beliefAudit.filter(audit => importedIdsForBeliefs.includes(audit.memoryId)).length,
  0,
  'an import must not create a false evidence-revision audit',
);
assert.equal(canonicalImported.length, 2);
assert(canonicalImported.every(item => item.epistemicStatus !== 'fact'), 'foreign memory does not become an NK1 fact merely because it was imported');
assert(canonicalImported.some(item => item.kind === 'procedural'), 'Hexis skills mapped to procedural memories must be retrievable through canonical memory');
assert.equal(applyFabric.decideHmx(applyStage.stagingId, 'apply')?.application?.digest, appliedStage?.application?.digest,
  'replaying an applied stage returns the same application receipt without another mutation');
assert.equal(applyFabric.snapshot().temporal.length, importedTemporal.length,
  'replaying an HMX apply must not duplicate temporal assertions');
assert.equal(applyFabric.snapshot().beliefs.length, importedIdsForBeliefs.length,
  'replaying an applied stage must not duplicate or re-revise Hexis beliefs');
assert.equal(applyFabric.snapshot().beliefAudit.length, stateAfterBeliefProjection.beliefAudit.length,
  'idempotent replay must not manufacture additional belief evidence');

// Restored stages are untrusted inputs at the integration boundary. Replay must
// reject a forged or missing application receipt rather than returning a false success.
const tamperedReplayState = applyFabric.snapshot();
const tamperedReplayStage = tamperedReplayState.hmxStages.find(candidate => candidate.stagingId === applyStage.stagingId);
assert(tamperedReplayStage?.application);
tamperedReplayStage.application.importedCount += 1;
const tamperedReplayFabric = new HexisAdaptationFabric();
tamperedReplayFabric.restore(tamperedReplayState);
let tamperedReplayHandlerCalls = 0;
tamperedReplayFabric.bindCanonicalMemoryApply(() => {
  tamperedReplayHandlerCalls += 1;
  throw new Error('corrupt-replay-must-not-reach-projector');
});
assert.throws(
  () => tamperedReplayFabric.decideHmx(applyStage.stagingId, 'apply'),
  /hmx-applied-receipt-invalid/,
);
assert.equal(tamperedReplayHandlerCalls, 0, 'invalid restored receipts must be rejected before any apply handler can run');

const missingReceiptState = applyFabric.snapshot();
const missingReceiptStage = missingReceiptState.hmxStages.find(candidate => candidate.stagingId === applyStage.stagingId);
assert(missingReceiptStage);
missingReceiptStage.application = undefined;
const missingReceiptFabric = new HexisAdaptationFabric();
missingReceiptFabric.restore(missingReceiptState);
assert.throws(
  () => missingReceiptFabric.decideHmx(applyStage.stagingId, 'apply'),
  /hmx-applied-receipt-invalid/,
  'an applied stage without its receipt must not be returned as a successful replay',
);

// Re-exporting the same source lineage with a different export ID keeps stable memory identity.
const laterNormalizedNk1Export = normalizeNk1HmxExport({
  ...nativeNk1Export,
  exportedAt: '2026-10-25T00:00:00.000Z',
});
assert.notEqual(laterNormalizedNk1Export.export_id, normalizedNk1Export.export_id);
assert.equal(laterNormalizedNk1Export.source.hexis_lineage_id, normalizedNk1Export.source.hexis_lineage_id);
assert.notEqual(laterNormalizedNk1Export.sections.memories[0].ref, normalizedNk1Export.sections.memories[0].ref);

// Use the same durable adaptation owner, as the production system does across imports.
// A new HexisAdaptationFabric would model a separate organism and cannot share its proposal registry.
const duplicateStage = applyFabric.stageHmx({ document: laterNormalizedNk1Export, intent: 'port', strategy: 'additive' });
assert.deepEqual(duplicateStage.conflicts, []);
assert.equal(applyFabric.decideHmx(duplicateStage.stagingId, 'accept')?.status, 'accepted');
const duplicateGoalPreparation = applyFabric.prepareGoalProposals(duplicateStage.stagingId);
assert.equal(duplicateGoalPreparation.created, 0, 'same lineage/reference/content goal proposals must deduplicate across re-exports');
assert.equal(duplicateGoalPreparation.duplicates, preparedGoals.proposals.length);

const duplicateApply = applyFabric.decideHmx(duplicateStage.stagingId, 'apply');
assert.equal(duplicateApply?.application?.importedCount, 0);
assert.equal(duplicateApply?.application?.deduplicatedCount, 2);
assert.equal(canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 2);
assert.equal(canonicalMemoryRuntime.semanticMemory.snapshot().edges.length, 1, 're-import must not duplicate or reinforce an existing imported edge');
assert.equal(applyFabric.snapshot().beliefs.length, importedIdsForBeliefs.length,
  're-exporting the same source lineage must preserve the existing belief set');
assert.equal(applyFabric.snapshot().beliefAudit.length, 0,
  're-exporting source data must not invent evidence revisions');

const emptyApplyFabric = new HexisAdaptationFabric();
emptyApplyFabric.bindCanonicalMemoryApply(candidate => canonicalProjector.apply(candidate));
const emptyStage = emptyApplyFabric.stageHmx({
  document: makeHmxDocument('exp_9999999999999999', { memories: [] }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(emptyStage.conflicts, []);
emptyApplyFabric.decideHmx(emptyStage.stagingId, 'accept');
const beforeNoopApply = canonicalMemoryRuntime.fabric.canonicalSnapshot().items.length;
const noOpApplied = emptyApplyFabric.decideHmx(emptyStage.stagingId, 'apply');
assert.equal(noOpApplied?.status, 'applied');
assert.equal(noOpApplied?.application?.status, 'noop');
assert.equal(canonicalMemoryRuntime.fabric.canonicalSnapshot().items.length, beforeNoopApply,
  'an empty memory section must not claim or cause a canonical memory mutation');

// Fault injection: if a batch write fails halfway, newly created memories are compensated
// through MemoryFabric's canonical forget command and the accepted stage remains retryable.
const rollbackMemoryRuntime = new MemorySubsystemRuntime();
let failingWrites = 0;
const rollbackFabric = {
  canonicalSnapshot: () => rollbackMemoryRuntime.fabric.canonicalSnapshot(),
  encode: (input, options) => {
    failingWrites += 1;
    if (failingWrites === 2) throw new Error('injected-hmx-write-failure');
    return rollbackMemoryRuntime.fabric.encode(input, options);
  },
  forgetById: (...args) => rollbackMemoryRuntime.fabric.forgetById(...args),
};
const rollbackHexisFabric = new HexisAdaptationFabric();
const rollbackProjector = new HexisCanonicalMemoryProjector(rollbackFabric, rollbackMemoryRuntime.semanticMemory, rollbackHexisFabric);
rollbackHexisFabric.bindCanonicalMemoryApply(candidate => rollbackProjector.apply(candidate));
const rollbackStage = rollbackHexisFabric.stageHmx({ document: normalizedNk1Export, intent: 'port', strategy: 'additive' });
rollbackHexisFabric.decideHmx(rollbackStage.stagingId, 'accept');
assert.throws(() => rollbackHexisFabric.decideHmx(rollbackStage.stagingId, 'apply'), /hmx-canonical-apply-failed/);
assert.equal(rollbackHexisFabric.getHmxStage(rollbackStage.stagingId)?.status, 'accepted',
  'a failed apply must not mark the stage complete');
assert.equal(rollbackHexisFabric.getHmxStage(rollbackStage.stagingId)?.applicationAttempts, 1,
  'a failed apply attempt must be retained so restart-safe retries use a new canonical command ID');
assert.equal(rollbackMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 0,
  'partially inserted HMX memories must be rolled back');
assert.equal(rollbackMemoryRuntime.semanticMemory.snapshot().nodes.length, 0,
  'partially projected semantic graph nodes must also roll back with failed canonical-memory application');
assert.equal(rollbackHexisFabric.snapshot().temporal.length, 0,
  'temporal assertions must roll back with a compensated canonical import failure');
const retryAfterRollback = rollbackHexisFabric.decideHmx(rollbackStage.stagingId, 'apply');
assert.equal(retryAfterRollback?.status, 'applied', 'the same approved stage must remain safely retryable after compensation');
assert.equal(retryAfterRollback?.application?.attempt, 2, 'a compensated retry uses a distinct durable attempt ID');
assert.equal(rollbackMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 2);
assert.equal(rollbackMemoryRuntime.semanticMemory.snapshot().edges.length, 1,
  'retry must commit graph relations after all canonical memory rows succeed');
assert.equal(rollbackHexisFabric.snapshot().temporal.length, 2,
  'successful retry must materialize temporal assertions once');


// Fault injection after MemoryFabric has committed a canonical memory but before
// the projector receives its ID. This catches a partial-write window that a pre-write
// failure does not exercise: rollback must reconcile against the baseline snapshot.
const postWriteRollbackRuntime = new MemorySubsystemRuntime();
const realPostWriteEncode = postWriteRollbackRuntime.fabric.encode.bind(postWriteRollbackRuntime.fabric);
let injectAfterCanonicalWrite = true;
const postWriteRollbackFabric = {
  canonicalSnapshot: (...args) => postWriteRollbackRuntime.fabric.canonicalSnapshot(...args),
  encode: (input, options) => {
    const inserted = realPostWriteEncode(input, options);
    if (injectAfterCanonicalWrite) {
      injectAfterCanonicalWrite = false;
      throw new Error('injected-hmx-after-canonical-write');
    }
    return inserted;
  },
  forgetById: (...args) => postWriteRollbackRuntime.fabric.forgetById(...args),
};
const postWriteRollbackHexis = new HexisAdaptationFabric();
const postWriteRollbackProjector = new HexisCanonicalMemoryProjector(
  postWriteRollbackFabric,
  postWriteRollbackRuntime.semanticMemory,
  postWriteRollbackHexis,
);
postWriteRollbackHexis.bindCanonicalMemoryApply(candidate => postWriteRollbackProjector.apply(candidate));
const postWriteRollbackStage = postWriteRollbackHexis.stageHmx({
  document: normalizedNk1Export, intent: 'port', strategy: 'additive',
});
assert.deepEqual(postWriteRollbackStage.conflicts, []);
assert.equal(postWriteRollbackHexis.decideHmx(postWriteRollbackStage.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => postWriteRollbackHexis.decideHmx(postWriteRollbackStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed/,
);
assert.equal(postWriteRollbackHexis.getHmxStage(postWriteRollbackStage.stagingId)?.status, 'accepted');
assert.equal(
  postWriteRollbackRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length,
  0,
  'a write committed just before an adapter exception must be discovered and compensated',
);
assert.equal(postWriteRollbackRuntime.semanticMemory.snapshot().nodes.length, 0);
assert.equal(postWriteRollbackHexis.snapshot().temporal.length, 0);
const postWriteRetry = postWriteRollbackHexis.decideHmx(postWriteRollbackStage.stagingId, 'apply');
assert.equal(postWriteRetry?.status, 'applied', 'a reconciled failure must remain safely retryable');
assert.equal(postWriteRetry?.application?.attempt, 2);
assert.equal(
  postWriteRollbackRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length,
  2,
  'retry must commit exactly the intended imported memory set',
);
assert.equal(postWriteRollbackHexis.snapshot().temporal.length, 2);

// A compensator that returns without removing the committed record must not be
// treated as successful rollback. The failure receipt must surface the residue.
const uncompensatedRuntime = new MemorySubsystemRuntime();
const realUncompensatedEncode = uncompensatedRuntime.fabric.encode.bind(uncompensatedRuntime.fabric);
let injectUncompensatedWrite = true;
const uncompensatedFabric = {
  canonicalSnapshot: (...args) => uncompensatedRuntime.fabric.canonicalSnapshot(...args),
  encode: (input, options) => {
    const inserted = realUncompensatedEncode(input, options);
    if (injectUncompensatedWrite) {
      injectUncompensatedWrite = false;
      throw new Error('injected-hmx-write-before-id-return');
    }
    return inserted;
  },
  forgetById: () => false,
};
const uncompensatedHexis = new HexisAdaptationFabric();
const uncompensatedProjector = new HexisCanonicalMemoryProjector(
  uncompensatedFabric, uncompensatedRuntime.semanticMemory, uncompensatedHexis,
);
uncompensatedHexis.bindCanonicalMemoryApply(candidate => uncompensatedProjector.apply(candidate));
const uncompensatedStage = uncompensatedHexis.stageHmx({
  document: normalizedNk1Export, intent: 'port', strategy: 'additive',
});
assert.equal(uncompensatedHexis.decideHmx(uncompensatedStage.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => uncompensatedHexis.decideHmx(uncompensatedStage.stagingId, 'apply'),
  /rollback-failures=canonical-uncompensated:/,
  'a silent no-op compensator must be reported as an incomplete rollback, never as atomic failure recovery',
);
const uncompensatedResiduals = uncompensatedRuntime.fabric.canonicalSnapshot().items.filter(item =>
  item.source.startsWith('hexis:') && item.context?.hexisExportId === normalizedNk1Export.export_id,
);
assert.equal(uncompensatedResiduals.length, 1,
  'fault injection must leave exactly the one intentionally uncompensated memory');
assert.equal(uncompensatedRuntime.semanticMemory.snapshot().nodes.length, 0,
  'graph rollback still runs even when canonical compensation is incomplete');
// Remove the test-only residue using the real store API so the isolated fixture
// does not accidentally demonstrate a successful import.
for (const residual of uncompensatedResiduals) {
  uncompensatedRuntime.fabric.forgetById(residual.id, 'test-fixture-cleanup', {
    commandId: 'test-fixture-cleanup:' + residual.id,
  });
}
assert.equal(
  uncompensatedRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length,
  0,
);

// Fault injection after canonical writes: belief-state failure must roll back both
// memory/graph writes and the temporal + belief ledgers as one HMX apply transaction.
const beliefRollbackRuntime = new MemorySubsystemRuntime();
const beliefRollbackHexis = new HexisAdaptationFabric();
const originalRegisterBelief = beliefRollbackHexis.registerOrUpdateBelief.bind(beliefRollbackHexis);
let beliefRegistrationAttempts = 0;
beliefRollbackHexis.registerOrUpdateBelief = input => {
  beliefRegistrationAttempts += 1;
  if (beliefRegistrationAttempts === 2) throw new Error('injected-hmx-belief-registration-failure');
  return originalRegisterBelief(input);
};
const beliefRollbackProjector = new HexisCanonicalMemoryProjector(
  beliefRollbackRuntime.fabric, beliefRollbackRuntime.semanticMemory, beliefRollbackHexis,
);
beliefRollbackHexis.bindCanonicalMemoryApply(candidate => beliefRollbackProjector.apply(candidate));
const beliefRollbackStage = beliefRollbackHexis.stageHmx({
  document: normalizedNk1Export, intent: 'port', strategy: 'additive',
});
assert.deepEqual(beliefRollbackStage.conflicts, []);
assert.equal(beliefRollbackHexis.decideHmx(beliefRollbackStage.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => beliefRollbackHexis.decideHmx(beliefRollbackStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed/,
);
assert.equal(beliefRollbackHexis.getHmxStage(beliefRollbackStage.stagingId)?.status, 'accepted',
  'a failed belief registration must leave the HMX stage retryable');
assert.equal(beliefRollbackRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 0,
  'canonical memories created before the belief failure must be compensated');
assert.equal(beliefRollbackRuntime.semanticMemory.snapshot().nodes.length, 0,
  'semantic graph projection must roll back when the belief ledger fails');
assert.equal(beliefRollbackHexis.snapshot().temporal.length, 0,
  'temporal assertions must roll back when the belief ledger fails');
assert.equal(beliefRollbackHexis.snapshot().beliefs.length, 0,
  'a partially seeded belief set must roll back atomically');
beliefRollbackHexis.registerOrUpdateBelief = originalRegisterBelief;
const beliefRetry = beliefRollbackHexis.decideHmx(beliefRollbackStage.stagingId, 'apply');
assert.equal(beliefRetry?.status, 'applied');
assert.equal(beliefRetry?.application?.attempt, 2);
assert.equal(beliefRollbackHexis.snapshot().beliefs.length, 2,
  'retry must seed each belief exactly once after a compensated failure');
assert.equal(beliefRollbackHexis.snapshot().temporal.length, 2,
  'retry must materialize each temporal assertion exactly once');


// Real composition-root wiring: independent Hexis evidence changes the confidence
// used by canonical NK1 recall; duplicate sources cannot reapply the same revision.
const beliefProjectionSystems = new OrganismSystemFabric();
const beliefProjectionMemory = beliefProjectionSystems.memory.fabric.encode({
  content: 'Belief projection integration fixture.',
  tags: ['belief-projection-test'],
  context: {},
  kind: 'semantic',
  salience: 0.6,
  emotionalWeight: 0.1,
  identityRelevance: 0.1,
  goalRelevance: 0.1,
  socialRelevance: 0.1,
  predictionError: 0,
  confidence: 0.5,
  epistemicStatus: 'belief',
  source: 'integration-test',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  provenanceClass: 'external',
  sourceAuthority01: 0.5,
  independenceKey: 'belief-projection-fixture',
});
const supportAudit = beliefProjectionSystems.hexisAdaptation.reviseBelief({
  memoryId: beliefProjectionMemory.id,
  confidence01: beliefProjectionMemory.confidence,
  trust01: 0.4,
  evidence: { ref: 'independent-evidence-a', trust01: 0.9 },
  stance: 'supports',
  at: 1700000000000,
});
assert.equal(supportAudit.applied, true);
let projectedBeliefMemory = beliefProjectionSystems.memory.fabric.canonicalSnapshot().items.find(item => item.id === beliefProjectionMemory.id);
assert.equal(projectedBeliefMemory?.confidence, supportAudit.posteriorConfidence01,
  'the shared cognitive composition must project the posterior confidence into canonical memory');
assert(projectedBeliefMemory?.revisionHistory.at(-1)?.reason.startsWith('hexis-belief-revision:supports:'));
assert.equal(projectedBeliefMemory?.evidenceSources?.filter(source => source.source.startsWith('hexis-evidence:')).length, 1,
  'a successful belief update must append exactly one independent source to canonical provenance');
assert(projectedBeliefMemory?.evidenceLineageKeys?.some(key => key.startsWith('lineage:hexis-belief:')),
  'canonical memory must persist the lineage tombstone used to suppress cross-store replay');
const canonicalConfidenceAfterSupport = projectedBeliefMemory.confidence;
const duplicateSupportAudit = beliefProjectionSystems.hexisAdaptation.reviseBelief({
  memoryId: beliefProjectionMemory.id,
  confidence01: canonicalConfidenceAfterSupport,
  trust01: supportAudit.posteriorTrust01,
  evidence: { ref: 'independent-evidence-a', trust01: 0.9 },
  stance: 'supports',
});
assert.equal(duplicateSupportAudit.applied, false);
assert.equal(duplicateSupportAudit.reason, 'duplicate_source');
projectedBeliefMemory = beliefProjectionSystems.memory.fabric.canonicalSnapshot().items.find(item => item.id === beliefProjectionMemory.id);
assert.equal(projectedBeliefMemory?.confidence, canonicalConfidenceAfterSupport,
  'duplicate source replay must not update canonical recall confidence a second time');
assert.equal(projectedBeliefMemory?.evidenceSources?.filter(source => source.source.startsWith('hexis-evidence:')).length, 1,
  'duplicate evidence must not duplicate the canonical evidence source');
const contradictionAudit = beliefProjectionSystems.hexisAdaptation.reviseBelief({
  memoryId: beliefProjectionMemory.id,
  confidence01: canonicalConfidenceAfterSupport,
  trust01: supportAudit.posteriorTrust01,
  evidence: { ref: 'independent-counter-evidence', trust01: 0.8 },
  stance: 'contradicts',
});
assert.equal(contradictionAudit.applied, true);
projectedBeliefMemory = beliefProjectionSystems.memory.fabric.canonicalSnapshot().items.find(item => item.id === beliefProjectionMemory.id);
assert.equal(projectedBeliefMemory?.confidence, contradictionAudit.posteriorConfidence01);
assert(projectedBeliefMemory.confidence < canonicalConfidenceAfterSupport,
  'independent contradictory evidence must lower canonical confidence used by retrieval');
assert.equal(projectedBeliefMemory.evidenceSources?.filter(source => source.source.startsWith('hexis-evidence:')).length, 2,
  'independent contradictory evidence must append its own lineage without overwriting the prior source');
assert.equal(beliefProjectionSystems.hexisAdaptation.snapshot().beliefAudit.length, 3,
  'support, duplicate and contradiction events must each remain auditable');

// A fresh Hexis ledger must still respect canonical evidence lineage instead of
// counting a source again after one side of persisted state has been reset.
const canonicalBeforeCrossStoreReplay = beliefProjectionSystems.memory.fabric.canonicalSnapshot().items.find(item => item.id === beliefProjectionMemory.id);
assert(canonicalBeforeCrossStoreReplay);
const evidenceSourcesBeforeCrossStoreReplay = canonicalBeforeCrossStoreReplay.evidenceSources?.length ?? 0;
const confidenceBeforeCrossStoreReplay = canonicalBeforeCrossStoreReplay.confidence;
beliefProjectionSystems.hexisAdaptation.restore();
const crossStoreReplayAudit = beliefProjectionSystems.hexisAdaptation.reviseBelief({
  memoryId: beliefProjectionMemory.id,
  confidence01: confidenceBeforeCrossStoreReplay,
  evidence: { ref: 'independent-counter-evidence', trust01: 0.8 },
  stance: 'contradicts',
});
assert.equal(crossStoreReplayAudit.applied, false);
assert.equal(crossStoreReplayAudit.reason, 'duplicate_source',
  'canonical lineage must defeat a replay even when the Hexis belief ledger starts empty');
const canonicalAfterCrossStoreReplay = beliefProjectionSystems.memory.fabric.canonicalSnapshot().items.find(item => item.id === beliefProjectionMemory.id);
assert.equal(canonicalAfterCrossStoreReplay?.confidence, confidenceBeforeCrossStoreReplay);
assert.equal(canonicalAfterCrossStoreReplay?.evidenceSources?.length ?? 0, evidenceSourcesBeforeCrossStoreReplay,
  'cross-store replay must not add a second evidence source');

const failingBeliefProjection = new HexisAdaptationFabric();
failingBeliefProjection.bindCanonicalBeliefProjection(() => { throw new Error('injected-canonical-belief-projection-failure'); });
assert.throws(() => failingBeliefProjection.reviseBelief({
  memoryId: 'canonical-target',
  confidence01: 0.5,
  evidence: { ref: 'failure-source', trust01: 0.9 },
  stance: 'supports',
}), /injected-canonical-belief-projection-failure/);
assert.equal(failingBeliefProjection.snapshot().beliefs.length, 0,
  'failed canonical projection must not commit a partial Hexis belief');
assert.equal(failingBeliefProjection.snapshot().beliefAudit.length, 0,
  'failed canonical projection must not leave a misleading evidence audit');
assert.equal(failingBeliefProjection.snapshot().metrics.beliefRevisions, 0,
  'failed canonical projection must not advance revision metrics');

const unavailableBeliefProjection = new HexisAdaptationFabric();
unavailableBeliefProjection.bindCanonicalBeliefProjection(() => 'unavailable');
assert.throws(() => unavailableBeliefProjection.reviseBelief({
  memoryId:'missing-canonical-target',
  confidence01:0.5,
  evidence:{ref:'unavailable-projection-source',trust01:0.9},
  stance:'supports',
}), /hexis-canonical-belief-projection-unavailable/);
assert.equal(unavailableBeliefProjection.snapshot().beliefs.length,0,
  'an unavailable canonical target must not commit an orphan Hexis belief');
assert.equal(unavailableBeliefProjection.snapshot().beliefAudit.length,0,
  'an unavailable canonical target must not leave a misleading audit');



// End-to-end Hexis goal path: approval creates a paused NK1 agency project, and
// only the separate activation call may make it active. Goal links are resolved
// to the imported memory's persisted graph-source key, with honest receipts.
const goalPipelineSystems = new OrganismSystemFabric();

// Direct guardrail test: the agency bridge must reject control characters even
// when its materialization method is called outside the upstream HMX parser.
assert.throws(
  () => goalPipelineSystems.agency.selfProjects.materializeApprovedHexisGoal({
    proposalId: 'hexgoal:' + 'a'.repeat(32),
    sourceLineageId: 'test-lineage',
    sourceRef: 'exp_8888888888888888:bad-title',
    title: 'unsafe\nproject title',
    description: 'description',
    importance: 0.5,
    urgency: 0.4,
    confidence: 0.5,
  }),
  /hexis-project-title-invalid/,
);
const goalExportId = 'exp_8888888888888888';
const goalMemoryRef = goalExportId + ':memory-anchor';
const goalRef = goalExportId + ':goal-bridge';
const goalPipelineStage = goalPipelineSystems.hexisAdaptation.stageHmx({
  document: makeHmxDocument(goalExportId, {
    memories: [{ ref: goalMemoryRef, type: 'semantic', content: 'Imported evidence for the reviewed NK1 goal.', importance: 0.72 }],
    goals: [{ ref: goalRef, title: 'Validate a reviewed Hexis goal', description: 'Use imported evidence, then confirm progress with independent observations.' }],
    relationships: [
      { source_ref: goalMemoryRef, target_ref: goalRef, edge_type: 'supports', properties: { weight: 0.78 } },
      { source_ref: goalMemoryRef, target_ref: goalRef, edge_type: 'supports', properties: { weight: 0.78 } },
    ],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(goalPipelineStage.conflicts, []);
assert.equal(goalPipelineSystems.hexisAdaptation.decideHmx(goalPipelineStage.stagingId, 'accept')?.status, 'accepted');
assert.equal(goalPipelineSystems.hexisAdaptation.decideHmx(goalPipelineStage.stagingId, 'apply')?.status, 'applied');
const goalPreparation = goalPipelineSystems.hexisAdaptation.prepareGoalProposals(goalPipelineStage.stagingId);
assert.equal(goalPreparation.created, 1);
const goalProposal = goalPreparation.proposals[0];
assert.equal(goalProposal.status, 'pending');
assert.throws(
  () => goalPipelineSystems.materializeApprovedHexisGoalProposal(goalProposal.id),
  /hmx-goal-must-be-approved-before-materialization/,
  'pending Hexis goal must not enter agency project ownership',
);
const reviewedGoal = goalPipelineSystems.hexisAdaptation.decideGoalProposal(goalProposal.id, 'approve');
assert.equal(reviewedGoal?.status, 'approved');

// Approval is bound to the exact proposal content, not merely its stable ID.
// Mutating any reviewed field in a restored snapshot must block materialization.
const approvedGoalStateBeforeTamper = goalPipelineSystems.hexisAdaptation.snapshot();
const tamperedApprovedGoalState = structuredClone(approvedGoalStateBeforeTamper);
const tamperedApprovedGoal = tamperedApprovedGoalState.goalProposals.find(item => item.id === goalProposal.id);
assert(tamperedApprovedGoal);
tamperedApprovedGoal.title = 'Substituted title after explicit approval';
goalPipelineSystems.hexisAdaptation.restore(tamperedApprovedGoalState);
assert.throws(
  () => goalPipelineSystems.materializeApprovedHexisGoalProposal(goalProposal.id),
  /hmx-goal-approval-digest-invalid/,
  'an approved proposal whose title changed after review must not enter agency project ownership',
);
assert.equal(
  goalPipelineSystems.agency.selfProjects.snapshot().projects.some(project => project.hexisProposalId === goalProposal.id),
  false,
  'rejected proposal tampering must not create a canonical agency project',
);
goalPipelineSystems.hexisAdaptation.restore(approvedGoalStateBeforeTamper);

const materializedGoal = goalPipelineSystems.materializeApprovedHexisGoalProposal(goalProposal.id);
assert.equal(materializedGoal.proposal.status, 'materialized');
assert.equal(materializedGoal.project.status, 'paused');
assert.equal(materializedGoal.project.pauseReason, 'hexis-approved-awaiting-explicit-activation');
assert(materializedGoal.project.reason?.includes('independent observations'),
  'materialized agency project must retain the reviewed Hexis goal description');
assert.equal(goalPipelineSystems.agency.selfProjects.activeProjects().some(project => project.hexisProposalId === goalProposal.id), false,
  'a materialized proposal must not be auto-selected by ensureActiveProject');

// The review attestation remains binding after materialization and across restore.
// Change the source lineage/content after approval; activation must fail before
// making the paused project active or touching graph state.
const materializedGoalStateBeforeTamper = goalPipelineSystems.hexisAdaptation.snapshot();
const tamperedMaterializedGoalState = structuredClone(materializedGoalStateBeforeTamper);
const tamperedMaterializedGoal = tamperedMaterializedGoalState.goalProposals.find(item => item.id === goalProposal.id);
assert(tamperedMaterializedGoal);
tamperedMaterializedGoal.sourceRef = goalExportId + ':goal:substituted-after-approval';
goalPipelineSystems.hexisAdaptation.restore(tamperedMaterializedGoalState);
const graphBeforeApprovedContentTamper = goalPipelineSystems.memory.semanticMemory.snapshot();
assert.throws(
  () => goalPipelineSystems.activateHexisGoalProposal(goalProposal.id),
  /hmx-goal-approval-digest-invalid/,
  'a materialized goal whose source reference changed after approval must not activate',
);
assert.equal(
  goalPipelineSystems.agency.selfProjects.snapshot().projects.find(project => project.hexisProposalId === goalProposal.id)?.status,
  'paused',
  'approval-content mismatch must leave agency project paused',
);
assert.deepEqual(goalPipelineSystems.memory.semanticMemory.snapshot(), graphBeforeApprovedContentTamper,
  'approval-content mismatch must not project semantic graph edges');
assert.equal(goalPipelineSystems.hexisAdaptation.getGoalProposal(goalProposal.id)?.goalRelationshipReceipt, undefined,
  'approval-content mismatch must not create an activation receipt');
goalPipelineSystems.hexisAdaptation.restore(materializedGoalStateBeforeTamper);

// Staged relationship content can be restored or edited after the goal proposal
// has been reviewed. Activation must revalidate its source stage before changing
// agency state or writing any semantic graph edge.
const pristineGoalPipelineState = goalPipelineSystems.hexisAdaptation.snapshot();
const tamperedGoalPipelineState = structuredClone(pristineGoalPipelineState);
const tamperedRelationshipStage = tamperedGoalPipelineState.hmxStages.find(stage => stage.stagingId === goalProposal.stageId);
assert(tamperedRelationshipStage);
tamperedRelationshipStage.stagedSections.relationships[0].properties.weight = 0.99;
goalPipelineSystems.hexisAdaptation.restore(tamperedGoalPipelineState);
const graphBeforeTamperedActivation = goalPipelineSystems.memory.semanticMemory.snapshot();
assert.throws(
  () => goalPipelineSystems.activateHexisGoalProposal(goalProposal.id),
  /hmx-stage-digest-invalid/,
  'changed relationship payload must not be trusted merely because the goal was previously approved',
);
assert.equal(
  goalPipelineSystems.agency.selfProjects.snapshot().projects.find(project => project.hexisProposalId === goalProposal.id)?.status,
  'paused',
  'invalid restored relationship data must be rejected before activating the project',
);
assert.deepEqual(goalPipelineSystems.memory.semanticMemory.snapshot(), graphBeforeTamperedActivation,
  'invalid staged relationships must not create or reinforce graph edges');
assert.equal(goalPipelineSystems.hexisAdaptation.getGoalProposal(goalProposal.id)?.goalRelationshipReceipt, undefined,
  'invalid staged relationships must not yield an activation receipt');
goalPipelineSystems.hexisAdaptation.restore(pristineGoalPipelineState);

const goalGraphBeforeFault = goalPipelineSystems.memory.semanticMemory.snapshot();
const originalGoalDecisionRecord = goalPipelineSystems.agency.deliberation.record.bind(goalPipelineSystems.agency.deliberation);
goalPipelineSystems.agency.deliberation.record = () => { throw new Error('injected-goal-deliberation-failure'); };
assert.throws(
  () => goalPipelineSystems.activateHexisGoalProposal(goalProposal.id),
  /injected-goal-deliberation-failure/,
  'an activation failure after the receipt write must roll all participating states back',
);
assert.equal(
  goalPipelineSystems.agency.selfProjects.snapshot().projects.find(project => project.hexisProposalId === goalProposal.id)?.status,
  'paused',
  'failed deliberation must restore the project to its pre-activation paused state',
);
assert.equal(goalPipelineSystems.hexisAdaptation.getGoalProposal(goalProposal.id)?.goalRelationshipReceipt, undefined,
  'failed activation must not leave a persisted success receipt');
assert.deepEqual(goalPipelineSystems.memory.semanticMemory.snapshot(), goalGraphBeforeFault,
  'failed activation must restore the semantic graph snapshot');
assert.equal(goalPipelineSystems.agency.deliberation.snapshot().records.length, 0,
  'failed activation must restore the deliberation ledger');
goalPipelineSystems.agency.deliberation.record = originalGoalDecisionRecord;
const activatedGoal = goalPipelineSystems.activateHexisGoalProposal(goalProposal.id);
assert.equal(activatedGoal.proposal.status, 'materialized');
assert.equal(activatedGoal.project.status, 'active');
assert.equal(activatedGoal.receipt.sourceStageFound, true);
assert.equal(activatedGoal.receipt.candidateRelationships, 1,
  'identical duplicate source relationships collapse into one candidate edge');
assert.equal(activatedGoal.receipt.projected, 1);
assert.equal(activatedGoal.receipt.deferred, 0);
assert.equal(activatedGoal.receipt.semanticEdgeIds.length, 1);
const goalGraph = goalPipelineSystems.memory.semanticMemory.snapshot();
assert(goalGraph.nodes.some(node => node.type === 'goal' && node.sourceKey?.startsWith('hexis:')));
assert(goalGraph.edges.some(edge => edge.id === activatedGoal.receipt.semanticEdgeIds[0] && edge.relation === 'supports'));
const goalEdgeCountAfterActivation = goalGraph.edges.length;
const replayedActivation = goalPipelineSystems.activateHexisGoalProposal(goalProposal.id);
assert.equal(replayedActivation.receipt.semanticEdgeIds[0], activatedGoal.receipt.semanticEdgeIds[0]);
assert.equal(goalPipelineSystems.memory.semanticMemory.snapshot().edges.length, goalEdgeCountAfterActivation,
  'goal activation replay must not re-project or reinforce its relationship edges');
assert.equal(goalPipelineSystems.memory.semanticMemory.snapshot().edges.find(edge => edge.id === activatedGoal.receipt.semanticEdgeIds[0])?.weight, 0.78,
  'a duplicate HMX relationship row must not raise the projected edge weight');
const rejectedGoalExportId = 'exp_9999999999999998';
const rejectedGoalStage = goalPipelineSystems.hexisAdaptation.stageHmx({
  document: makeHmxDocument(rejectedGoalExportId, { goals: [{ ref: rejectedGoalExportId + ':rejected', title: 'Never activate this rejected goal' }] }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(rejectedGoalStage.conflicts, []);
goalPipelineSystems.hexisAdaptation.decideHmx(rejectedGoalStage.stagingId, 'accept');
const rejectedPreparation = goalPipelineSystems.hexisAdaptation.prepareGoalProposals(rejectedGoalStage.stagingId);
assert.equal(rejectedPreparation.created, 1);
goalPipelineSystems.hexisAdaptation.decideGoalProposal(rejectedPreparation.proposals[0].id, 'reject');
assert.throws(
  () => goalPipelineSystems.materializeApprovedHexisGoalProposal(rejectedPreparation.proposals[0].id),
  /hmx-goal-must-be-approved-before-materialization/,
  'rejected Hexis goals must never become NK1 agency projects',
);


// Explicit Hexis learning-review decisions now write through NK1's canonical MemoryFabric.
const reviewSystems = new OrganismSystemFabric();
const reviewedSource = reviewSystems.memory.fabric.encode({
  content:'The original learning-review claim.',
  tags:['learning-review-fixture'],
  context:{},
  kind:'semantic',
  salience:0.6,
  emotionalWeight:0.1,
  identityRelevance:0.1,
  goalRelevance:0.1,
  socialRelevance:0.1,
  predictionError:0,
  confidence:0.63,
  epistemicStatus:'belief',
  source:'review-fixture',
  entities:[],
  semanticLinks:[],
  temporalLinks:[],
  causalLinks:[],
  provenanceClass:'external',
  sourceAuthority01:0.5,
  independenceKey:'review-fixture-source',
});
const approvalReview = reviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000001000,summary:'Review existing canonical knowledge.',
  items:[{kind:'semantic_belief',title:'Review a known claim',content:'The original learning-review claim.',sourceMemoryId:reviewedSource.id,evidence:{source:'reviewer-a',observationCount:1}}],
});
const approvedReviewItem = approvalReview.items[0];
const originalReviewConfidence = reviewedSource.confidence;
const approvalResult = reviewSystems.decideHexisLearningReview(approvalReview.id,approvedReviewItem.id,'approve');
assert.equal(approvalResult.item.status,'approved');
assert.equal(approvalResult.item.canonicalMemoryId,reviewedSource.id);
assert.equal(approvalResult.memory?.confidence,originalReviewConfidence,
  'review approval annotates existing memory without artificially raising confidence');
assert.equal(approvalResult.memory?.context?.hexisLearningDecision,'approved');
const approvalReplay = reviewSystems.decideHexisLearningReview(approvalReview.id,approvedReviewItem.id,'approve');
assert.equal(approvalReplay.disposition,'replayed');
assert.equal(approvalReplay.memory?.confidence,originalReviewConfidence);

const correctionReview = reviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000002000,summary:'Correct a canonical belief.',
  items:[{kind:'semantic_belief',title:'Correct a claim',content:'The original learning-review claim.',sourceMemoryId:reviewedSource.id,evidence:{source:'reviewer-b',reason:'new verified fact'}}],
});
const correctionItem = correctionReview.items[0];
const correctionResult = reviewSystems.decideHexisLearningReview(correctionReview.id,correctionItem.id,'correct','The corrected learning-review claim.');
assert.equal(correctionResult.item.status,'corrected');
assert.notEqual(correctionResult.memory?.id,reviewedSource.id,
  'corrections should create a new canonical revision rather than overwrite historical memory');
assert.equal(correctionResult.memory?.content,'The corrected learning-review claim.');
assert.equal(correctionResult.memory?.confidence,originalReviewConfidence,
  'correction must preserve confidence unless separate evidence is evaluated');
assert.equal(correctionResult.memory?.supersedesId,reviewedSource.id);
assert.equal(correctionResult.memory?.context?.hexisLearningDecision,'corrected');
const correctionReplayResult = reviewSystems.decideHexisLearningReview(correctionReview.id,correctionItem.id,'correct','The corrected learning-review claim.');
assert.equal(correctionReplayResult.disposition,'replayed');
assert.equal(correctionReplayResult.memory?.id,correctionResult.memory?.id,
  'replaying the same correction decision must return the same canonical revision');

const procedureReview = reviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000003000,summary:'Review a newly proposed procedure.',
  items:[{kind:'new_procedure',title:'A candidate procedure',content:'Check prerequisites, execute once, verify the result.',evidence:{source:'reviewer-c',tested:false}}],
});
const procedureItem=procedureReview.items[0];
const procedureResult=reviewSystems.decideHexisLearningReview(procedureReview.id,procedureItem.id,'approve');
assert.equal(procedureResult.disposition,'materialized-candidate');
assert.equal(procedureResult.memory?.kind,'procedural');
assert.equal(procedureResult.memory?.epistemicStatus,'hypothesis');
assert.equal(procedureResult.memory?.confidence,0.42,
  'reviewed but untested procedures remain low-confidence hypotheses and are not auto-promoted to skills');
assert.equal(procedureResult.item.canonicalMemoryId,procedureResult.memory?.id);
const procedureMemoryCountAfterFirstDecision=reviewSystems.memory.fabric.canonicalSnapshot().items.length;
const procedureReplayResult=reviewSystems.decideHexisLearningReview(procedureReview.id,procedureItem.id,'approve');
assert.equal(procedureReplayResult.disposition,'replayed');
assert.equal(reviewSystems.memory.fabric.canonicalSnapshot().items.length,procedureMemoryCountAfterFirstDecision,
  'approving the same proposal after restore must not create another candidate memory');

const forgetReview = reviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000004000,summary:'Quarantine stale knowledge.',
  items:[{kind:'semantic_belief',title:'Retire stale claim',content:'The claim to quarantine.',sourceMemoryId:reviewedSource.id,evidence:{reason:'obsolete'}}],
});
const forgetResult=reviewSystems.decideHexisLearningReview(forgetReview.id,forgetReview.items[0].id,'forget');
assert.equal(forgetResult.disposition,'quarantined-existing');
assert.equal(forgetResult.memory?.epistemicStatus,'quarantined',
  'forget is a reversible quarantine and does not destructively delete canonical memory');
const protectedForgetReview = reviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000005000,summary:'Attempt to delete core identity memory.',
  items:[{kind:'semantic_belief',title:'Protected autobiographical memory',content:'Identity record.',sourceMemoryId:reviewSystems.memory.fabric.encode({
    content:'Protected identity record.',tags:[],context:{},kind:'identity',salience:0.8,emotionalWeight:0.3,identityRelevance:0.9,goalRelevance:0.1,socialRelevance:0.1,predictionError:0,confidence:0.9,epistemicStatus:'fact',source:'identity-fixture',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],
  }).id,evidence:{reason:'must remain protected'}}],
});
assert.throws(
  () => reviewSystems.decideHexisLearningReview(protectedForgetReview.id,protectedForgetReview.items[0].id,'forget'),
  /hexis-learning-review-forget-protected-memory/,
);

// A failure after the canonical mutation but before Hexis marks the item decided rolls both stores back.
const rollbackReviewSystems=new OrganismSystemFabric();
const rollbackReviewMemory=rollbackReviewSystems.memory.fabric.encode({
  content:'Rollback review fixture.',tags:[],context:{},kind:'semantic',salience:0.5,emotionalWeight:0.1,identityRelevance:0.1,goalRelevance:0.1,socialRelevance:0.1,predictionError:0,confidence:0.5,epistemicStatus:'belief',source:'review-rollback-fixture',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],
});
const rollbackReview=rollbackReviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000006000,summary:'Force review-state commit failure.',
  items:[{kind:'semantic_belief',title:'Rollback annotation',content:'Rollback review fixture.',sourceMemoryId:rollbackReviewMemory.id,evidence:{reason:'fault injection'}}],
});
const originalDecideLearningReview=rollbackReviewSystems.hexisAdaptation.decideLearningReview.bind(rollbackReviewSystems.hexisAdaptation);
rollbackReviewSystems.hexisAdaptation.decideLearningReview=()=>{throw new Error('injected-hexis-review-decision-failure');};
assert.throws(
  () => rollbackReviewSystems.decideHexisLearningReview(rollbackReview.id,rollbackReview.items[0].id,'approve'),
  /injected-hexis-review-decision-failure/,
);
assert.equal(rollbackReviewSystems.memory.fabric.canonicalSnapshot().items.find(memory=>memory.id===rollbackReviewMemory.id)?.context?.hexisLearningDecision,undefined,
  'canonical memory annotation must roll back if the Hexis review cannot be committed');
assert.equal(rollbackReviewSystems.hexisAdaptation.snapshot().learningReviews[0].items[0].status,'pending',
  'review remains pending after an atomic rollback');
rollbackReviewSystems.hexisAdaptation.decideLearningReview=originalDecideLearningReview;


console.log('HEXIS_ADAPTATION_PASS');
console.log(JSON.stringify({diagnostics:fabric.diagnostics(),defaultState:defaultHexisAdaptationState().version},null,2));
