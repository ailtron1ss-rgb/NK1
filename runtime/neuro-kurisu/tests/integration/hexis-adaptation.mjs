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
const materializedGoal = goalPipelineSystems.materializeApprovedHexisGoalProposal(goalProposal.id);
assert.equal(materializedGoal.proposal.status, 'materialized');
assert.equal(materializedGoal.project.status, 'paused');
assert.equal(materializedGoal.project.pauseReason, 'hexis-approved-awaiting-explicit-activation');
assert(materializedGoal.project.reason?.includes('independent observations'),
  'materialized agency project must retain the reviewed Hexis goal description');
assert.equal(goalPipelineSystems.agency.selfProjects.activeProjects().some(project => project.hexisProposalId === goalProposal.id), false,
  'a materialized proposal must not be auto-selected by ensureActiveProject');
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
