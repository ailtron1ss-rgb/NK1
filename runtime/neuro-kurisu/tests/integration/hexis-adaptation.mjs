import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

// Even byte-identical contents with different metadata cannot share a canonical ref.
const duplicateMemoryRefExportId = 'exp_5555555555555556';
const duplicateMemoryRefStage = fabric.stageHmx({
  document: makeHmxDocument(duplicateMemoryRefExportId, {
    memories: [
      { ref: duplicateMemoryRefExportId + ':same-ref', type: 'semantic', content: 'Same statement.' },
      { ref: duplicateMemoryRefExportId + ':same-ref', type: 'procedural', content: 'Same statement.' },
    ],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert(duplicateMemoryRefStage.conflicts.some(conflict => conflict.kind === 'duplicate-reference'));
assert.equal(duplicateMemoryRefStage.sectionCounts.memories, 2);
assert.equal(duplicateMemoryRefStage.stagedSections.memories, undefined,
  'duplicate memory refs must poison the entire section rather than silently selecting its first row');
assert.equal(fabric.decideHmx(duplicateMemoryRefStage.stagingId, 'accept')?.status, 'staged');

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
const failedOut=fabric.enqueueOutbox({idempotencyKey:'k-failed',kind:'notify',channel:'telegram',payload:{text:'may have escaped before timeout'}});
for(let attempt=0;attempt<3;attempt++){assert.equal(fabric.claimOutbox(failedOut.id)?.status,'publishing');fabric.ackOutbox(failedOut.id,false,'synthetic-ambiguous-failure');}
assert.equal(fabric.snapshot().outbox.find(x=>x.id===failedOut.id)?.status,'failed');
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k-failed',kind:'notify',channel:'telegram',payload:{text:'may have escaped before timeout'}}).id,failedOut.id,'failed terminal attempt must not create a second logical delivery');
const legacySnapshot=fabric.snapshot(); delete legacySnapshot.metrics.outboxIdempotencyConflicts;
const restoredLegacy=new HexisAdaptationFabric(); restoredLegacy.restore(legacySnapshot);
assert.equal(restoredLegacy.snapshot().metrics.outboxIdempotencyConflicts,0,'legacy snapshots receive the new metric default');
const restoredOutbox=new HexisAdaptationFabric(); restoredOutbox.restore(fabric.snapshot());
assert.equal(restoredOutbox.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'x',meta:{b:2,a:1}}}).id,out.id,'outbox idempotency survives snapshot/restore');
const restoredConflict=restoredOutbox.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'after restore this must not alias'}});
assert.equal(restoredConflict.error,'idempotency-key-conflict');
assert.equal(restoredOutbox.snapshot().metrics.outboxIdempotencyConflicts,2,'outbox conflict telemetry survives snapshot/restore');

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

// Two distinct native IDs can normalize to the same slug/ref. The staged importer
// must reject that ambiguity instead of silently importing only the first row.
const slugCollisionExport = normalizeNk1HmxExport({
  sourceSubjectId: 'slug-collision',
  sections: {
    memories: [
      { id: 'Foo Bar', type: 'semantic', content: 'First slug-collision memory.' },
      { id: 'foo-bar', type: 'semantic', content: 'Second slug-collision memory.' },
    ],
  },
});
assert.equal(slugCollisionExport.sections.memories[0].ref, slugCollisionExport.sections.memories[1].ref,
  'fixture should expose the existing safeSlug collision');
const slugCollisionStage = new HexisAdaptationFabric().stageHmx({
  document: slugCollisionExport,
  intent: 'port',
  strategy: 'additive',
});
assert(slugCollisionStage.conflicts.some(conflict => conflict.kind === 'duplicate-reference'));
assert.equal(slugCollisionStage.stagedSections.memories, undefined,
  'normalized exports with colliding references must fail atomically before canonical writes');

// A raw native ID reused across memories and skills is ambiguous. The exporter must not
// point a relationship at whichever section happened to be indexed last.
const ambiguousNativeReferenceExport = normalizeNk1HmxExport({
  sourceSubjectId: 'ambiguous-native-reference',
  sourceLineageId: 'ambiguous-native-reference-lineage',
  sections: {
    memories: [{ id: 'shared-id', type: 'semantic', content: 'Native memory endpoint.' }],
    skills: [{ id: 'shared-id', name: 'Shared skill', instructions: 'Native procedure endpoint.' }],
    relationships: [{ source: 'shared-id', target: 'shared-id', edge_type: 'supports' }],
  },
});
assert(ambiguousNativeReferenceExport.export_warnings.some(warning => warning.includes('Ambiguous native reference')));
const ambiguousRelationship = ambiguousNativeReferenceExport.sections.relationships[0];
const exportedMemoryRefs = new Set(ambiguousNativeReferenceExport.sections.memories.map(memory => memory.ref));
assert.equal(ambiguousRelationship.source_ref, ambiguousRelationship.target_ref);
assert.equal(exportedMemoryRefs.has(ambiguousRelationship.source_ref), false,
  'an ambiguous native ID must not be bound to either the memory or skill record');
const ambiguousReferenceStage = new HexisAdaptationFabric().stageHmx({
  document: ambiguousNativeReferenceExport,
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(ambiguousReferenceStage.conflicts, [],
  'an unresolved but structurally valid native relation should be staged for review rather than miswired');
assert.equal(ambiguousReferenceStage.stagedSections.relationships.length, 1);
assert.equal(ambiguousReferenceStage.stagedSections.relationships[0].source_ref, ambiguousRelationship.source_ref);

// Goal IDs are export-global refs too. A slug collision must not collapse two goal
// proposals into one apparently valid target.
const goalSlugCollisionExport = normalizeNk1HmxExport({
  sourceSubjectId: 'goal-slug-collision',
  sections: {
    goals: [
      { id: 'Road Map', title: 'First goal with a colliding slug.' },
      { id: 'road-map', title: 'Second goal with the same normalized slug.' },
    ],
  },
});
assert.equal(goalSlugCollisionExport.sections.goals[0].ref, goalSlugCollisionExport.sections.goals[1].ref);
const goalSlugCollisionStage = new HexisAdaptationFabric().stageHmx({
  document: goalSlugCollisionExport,
  intent: 'port',
  strategy: 'additive',
});
assert(goalSlugCollisionStage.conflicts.some(conflict => conflict.kind === 'duplicate-reference'));
assert.equal(goalSlugCollisionStage.sectionCounts.goals, 2);
assert.equal(goalSlugCollisionStage.stagedSections.goals, undefined,
  'a goal-ref collision must exclude the whole goals section before proposal generation');

const crossSectionRefExportId = 'exp_5555555555555557';
const crossSectionRefOwner = new HexisAdaptationFabric();
const crossSectionRefStage = crossSectionRefOwner.stageHmx({
  document: makeHmxDocument(crossSectionRefExportId, {
    memories: [{ ref: crossSectionRefExportId + ':shared-entity', type: 'semantic', content: 'Memory with a shared entity ref.' }],
    goals: [{ ref: crossSectionRefExportId + ':shared-entity', title: 'Goal with the same entity ref.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert(crossSectionRefStage.conflicts.some(conflict => conflict.kind === 'duplicate-reference'));
assert.equal(crossSectionRefStage.stagedSections.goals, undefined,
  'entity refs must be unique across memories and goals, not only within one section');
assert.equal(crossSectionRefStage.stagedSections.memories.length, 1);
assert.equal(crossSectionRefOwner.decideHmx(crossSectionRefStage.stagingId, 'accept')?.status, 'staged',
  'a conflict-bearing cross-section collision must remain ineligible for acceptance');

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
assert.equal(canonicalImported.length, 2);
assert(canonicalImported.every(item => item.epistemicStatus !== 'fact'), 'foreign memory does not become an NK1 fact merely because it was imported');
assert(canonicalImported.some(item => item.kind === 'procedural'), 'Hexis skills mapped to procedural memories must be retrievable through canonical memory');
assert.equal(applyFabric.decideHmx(applyStage.stagingId, 'apply')?.application?.digest, appliedStage?.application?.digest,
  'replaying an applied stage returns the same application receipt without another mutation');
assert.equal(applyFabric.snapshot().temporal.length, importedTemporal.length,
  'replaying an HMX apply must not duplicate temporal assertions');

// The normal decideHmx replay path must also validate persisted receipts (not only the projector).
const corruptedAppliedSnapshot = applyFabric.snapshot();
const persistedAppliedStage = corruptedAppliedSnapshot.hmxStages.find(stage => stage.stagingId === applyStage.stagingId);
assert(persistedAppliedStage?.application);
persistedAppliedStage.application.importedCount += 1;
const corruptedRestoreFabric = new HexisAdaptationFabric();
corruptedRestoreFabric.restore(corruptedAppliedSnapshot);
corruptedRestoreFabric.bindCanonicalMemoryApply(() => {
  throw new Error('corrupted applied receipt must never trigger a second canonical apply');
});
assert.throws(
  () => corruptedRestoreFabric.decideHmx(applyStage.stagingId, 'apply'),
  /hmx-applied-receipt-invalid/,
  'persisted receipt corruption must fail closed before any replay shortcut',
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

const temporalCountBeforeDuplicateApply = applyFabric.snapshot().temporal.length;
const duplicateApply = applyFabric.decideHmx(duplicateStage.stagingId, 'apply');
assert.equal(applyFabric.snapshot().temporal.length, temporalCountBeforeDuplicateApply,
  're-exporting the same source lineage must not duplicate temporal assertions for an already-indexed memory');
assert.equal(duplicateApply?.application?.importedCount, 0);
assert.equal(duplicateApply?.application?.deduplicatedCount, 2);
assert.equal(canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 2);
assert.equal(canonicalMemoryRuntime.semanticMemory.snapshot().edges.length, 1, 're-import must not duplicate or reinforce an existing imported edge');

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

// Deterministic import IDs must not overwrite an unrelated canonical record that
// happens to occupy the same ID (e.g. a restored/corrupt snapshot or ID collision).
const collisionIdRuntime = new MemorySubsystemRuntime();
const collisionExportId = 'exp_8888888888888888';
const collisionMemoryRef = collisionExportId + ':memory-1';
const collisionMemoryContent = 'A memory with this text belongs to the Hexis import.';
const contentHashForCollision = createHash('sha256').update(collisionMemoryContent).digest('hex');
const expectedHexisMemoryId = 'hexis-memory:' + createHash('sha256')
  .update('hexis-test-lineage\0memory-1\0' + contentHashForCollision)
  .digest('hex').slice(0, 48);
const unrelatedCollision = collisionIdRuntime.fabric.encode({
  id: expectedHexisMemoryId,
  content: 'Unrelated canonical content that must be preserved.',
  tags: ['do-not-overwrite'],
  context: { sentinel: 'collision-preserve' },
  kind: 'semantic',
  salience: 0.7,
  emotionalWeight: 0.1,
  identityRelevance: 0.1,
  goalRelevance: 0.1,
  socialRelevance: 0.1,
  predictionError: 0,
  confidence: 0.9,
  epistemicStatus: 'fact',
  source: 'user',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  provenanceClass: 'user',
  sourceAuthority01: 0.9,
  independenceKey: 'collision-preservation-test',
}, { forceDistinct: true });
const unrelatedSnapshot = {
  id: unrelatedCollision.id,
  content: unrelatedCollision.content,
  source: unrelatedCollision.source,
  tags: [...unrelatedCollision.tags],
  context: { ...unrelatedCollision.context },
};
const collisionImportOwner = new HexisAdaptationFabric();
const collisionImportProjector = new HexisCanonicalMemoryProjector(
  collisionIdRuntime.fabric, collisionIdRuntime.semanticMemory, collisionImportOwner,
);
collisionImportOwner.bindCanonicalMemoryApply(candidate => collisionImportProjector.apply(candidate));
const collisionImportStage = collisionImportOwner.stageHmx({
  document: makeHmxDocument(collisionExportId, {
    memories: [{
      ref: collisionMemoryRef,
      type: 'semantic',
      content: collisionMemoryContent,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(collisionImportStage.conflicts, []);
collisionImportOwner.decideHmx(collisionImportStage.stagingId, 'accept');
assert.throws(
  () => collisionImportOwner.decideHmx(collisionImportStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed:hmx-apply-canonical-id-conflict/,
  'a deterministic ID occupied by unrelated canonical memory must fail before writing',
);
assert.deepEqual(
  (() => {
    const after = collisionIdRuntime.fabric.canonicalSnapshot().items.find(item => item.id === unrelatedSnapshot.id);
    return { id: after?.id, content: after?.content, source: after?.source, tags: [...(after?.tags ?? [])], context: { ...(after?.context ?? {}) } };
  })(),
  unrelatedSnapshot,
  'import preflight must preserve an unrelated row that collides with a deterministic HMX ID',
);
assert.equal(collisionIdRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 0);

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

// Fault injection: the canonical MemoryFabric commits a row, then the adapter call
// throws before returning the inserted ID. Compensation must still remove that row.
const postCommitRuntime = new MemorySubsystemRuntime();
let throwAfterFirstCommit = true;
const postCommitFabric = {
  canonicalSnapshot: () => postCommitRuntime.fabric.canonicalSnapshot(),
  encode: (input, options) => {
    const inserted = postCommitRuntime.fabric.encode(input, options);
    if (throwAfterFirstCommit && input.content === normalizedNk1Export.sections.memories[0].content) {
      throwAfterFirstCommit = false;
      throw new Error('injected-hmx-post-commit-write-failure');
    }
    return inserted;
  },
  forgetById: (...args) => postCommitRuntime.fabric.forgetById(...args),
};
const postCommitHexis = new HexisAdaptationFabric();
const postCommitProjector = new HexisCanonicalMemoryProjector(
  postCommitFabric, postCommitRuntime.semanticMemory, postCommitHexis,
);
postCommitHexis.bindCanonicalMemoryApply(candidate => postCommitProjector.apply(candidate));
const postCommitStage = postCommitHexis.stageHmx({
  document: normalizedNk1Export, intent: 'port', strategy: 'additive',
});
postCommitHexis.decideHmx(postCommitStage.stagingId, 'accept');
assert.throws(
  () => postCommitHexis.decideHmx(postCommitStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed/,
);
assert.equal(
  postCommitRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length,
  0,
  'a writer that commits and then throws must not leave an unreceipted HMX memory behind',
);
assert.equal(postCommitRuntime.semanticMemory.snapshot().nodes.length, 0,
  'semantic nodes from a post-commit failure must be compensated too');
assert.equal(postCommitHexis.snapshot().temporal.length, 0,
  'temporal writes must remain absent after post-commit compensation');
const postCommitRetry = postCommitHexis.decideHmx(postCommitStage.stagingId, 'apply');
assert.equal(postCommitRetry?.status, 'applied',
  'the exact stage must remain retryable after a post-commit writer failure');
assert.equal(postCommitRetry?.application?.attempt, 2);
assert.equal(
  postCommitRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length,
  2,
  'retry after post-commit compensation must create each canonical memory exactly once',
);

// If compensation itself reports failure without throwing, detect the surviving
// canonical row and let the next attempt reconcile its missing graph/temporal projections.
const orphanRuntime = new MemorySubsystemRuntime();
let throwOnceAfterOrphanCommit = true;
const orphanFabric = {
  canonicalSnapshot: () => orphanRuntime.fabric.canonicalSnapshot(),
  encode: (input, options) => {
    const inserted = orphanRuntime.fabric.encode(input, options);
    if (throwOnceAfterOrphanCommit && input.content === normalizedNk1Export.sections.memories[0].content) {
      throwOnceAfterOrphanCommit = false;
      throw new Error('injected-hmx-orphan-post-commit-failure');
    }
    return inserted;
  },
  // Deliberately simulate a compensation adapter that reports "not removed".
  forgetById: () => false,
};
const orphanHexis = new HexisAdaptationFabric();
const orphanProjector = new HexisCanonicalMemoryProjector(orphanFabric, orphanRuntime.semanticMemory, orphanHexis);
orphanHexis.bindCanonicalMemoryApply(candidate => orphanProjector.apply(candidate));
const orphanStage = orphanHexis.stageHmx({ document: normalizedNk1Export, intent: 'port', strategy: 'additive' });
orphanHexis.decideHmx(orphanStage.stagingId, 'accept');
let orphanFailure;
try {
  orphanHexis.decideHmx(orphanStage.stagingId, 'apply');
} catch (error) {
  orphanFailure = error;
}
assert.match(String(orphanFailure?.message), /canonical-memory-remains:/,
  'failed compensation must surface the exact surviving canonical memory');
assert.equal(orphanHexis.getHmxStage(orphanStage.stagingId)?.status, 'accepted');
assert.equal(orphanRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 1);
assert.equal(orphanRuntime.semanticMemory.snapshot().nodes.length, 0,
  'graph changes must still roll back when canonical compensation is incomplete');
assert.equal(orphanHexis.snapshot().temporal.length, 0);

// Retry must adopt the surviving canonical row, complete its temporal/graph projections,
// and import the remaining row without duplicating the already-committed memory.
const orphanRetry = orphanHexis.decideHmx(orphanStage.stagingId, 'apply');
assert.equal(orphanRetry?.status, 'applied');
assert.equal(orphanRetry?.application?.memoryIds.length, 2);
assert.equal(orphanRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 2);
assert.equal(orphanRuntime.semanticMemory.snapshot().edges.length, 1);
assert.equal(orphanHexis.snapshot().temporal.length, 2,
  'retry must restore temporal indexing for a retained row created by the failed attempt');
assert.equal(orphanRetry?.application?.deduplicatedCount, 1,
  'the retry receipt must disclose the row recovered from the failed attempt');

console.log('HEXIS_ADAPTATION_PASS');
console.log(JSON.stringify({diagnostics:fabric.diagnostics(),defaultState:defaultHexisAdaptationState().version},null,2));
