import assert from 'node:assert/strict';
import { HexisAdaptationFabric, defaultHexisAdaptationState } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';
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

// A same-text native memory must remain untouched by an external HMX import.
const collisionRuntime = new MemorySubsystemRuntime();
const nativeText = normalizedNk1Export.sections.memories[0].content;
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

// Approved HMX memories enter the canonical MemoryFabric -> MemoryOS2 path only
// through the explicit apply decision. The identity and goals sections remain deferred.
const canonicalMemoryRuntime = new MemorySubsystemRuntime();
const canonicalProjector = new HexisCanonicalMemoryProjector(canonicalMemoryRuntime.fabric, canonicalMemoryRuntime.semanticMemory);
const applyFabric = new HexisAdaptationFabric();
applyFabric.bindCanonicalMemoryApply(candidate => canonicalProjector.apply(candidate));
const applyStage = applyFabric.stageHmx({ document: normalizedNk1Export, intent: 'port', strategy: 'additive' });
assert.deepEqual(applyStage.conflicts, []);
const canonicalBeforeApproval = canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:'));
assert.equal(canonicalBeforeApproval.length, 0, 'staging an import must not mutate canonical memory');
assert.equal(applyFabric.decideHmx(applyStage.stagingId, 'accept')?.status, 'accepted');
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
const canonicalImported = canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:'));
assert.equal(canonicalImported.length, 2);
assert(canonicalImported.every(item => item.epistemicStatus !== 'fact'), 'foreign memory does not become an NK1 fact merely because it was imported');
assert(canonicalImported.some(item => item.kind === 'procedural'), 'Hexis skills mapped to procedural memories must be retrievable through canonical memory');
assert.equal(applyFabric.decideHmx(applyStage.stagingId, 'apply')?.application?.digest, appliedStage?.application?.digest,
  'replaying an applied stage returns the same application receipt without another mutation');

// Re-exporting the same source lineage with a different export ID keeps stable memory identity.
const laterNormalizedNk1Export = normalizeNk1HmxExport({
  ...nativeNk1Export,
  exportedAt: '2026-10-25T00:00:00.000Z',
});
assert.notEqual(laterNormalizedNk1Export.export_id, normalizedNk1Export.export_id);
assert.equal(laterNormalizedNk1Export.source.hexis_lineage_id, normalizedNk1Export.source.hexis_lineage_id);
assert.notEqual(laterNormalizedNk1Export.sections.memories[0].ref, normalizedNk1Export.sections.memories[0].ref);

const duplicateApplyFabric = new HexisAdaptationFabric();
duplicateApplyFabric.bindCanonicalMemoryApply(candidate => canonicalProjector.apply(candidate));
const duplicateStage = duplicateApplyFabric.stageHmx({ document: laterNormalizedNk1Export, intent: 'port', strategy: 'additive' });
assert.equal(duplicateApplyFabric.decideHmx(duplicateStage.stagingId, 'accept')?.status, 'accepted');
const duplicateApply = duplicateApplyFabric.decideHmx(duplicateStage.stagingId, 'apply');
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
const rollbackProjector = new HexisCanonicalMemoryProjector(rollbackFabric, rollbackMemoryRuntime.semanticMemory);
const rollbackHexisFabric = new HexisAdaptationFabric();
rollbackHexisFabric.bindCanonicalMemoryApply(candidate => rollbackProjector.apply(candidate));
const rollbackStage = rollbackHexisFabric.stageHmx({ document: normalizedNk1Export, intent: 'port', strategy: 'additive' });
rollbackHexisFabric.decideHmx(rollbackStage.stagingId, 'accept');
assert.throws(() => rollbackHexisFabric.decideHmx(rollbackStage.stagingId, 'apply'), /hmx-canonical-apply-failed/);
assert.equal(rollbackHexisFabric.getHmxStage(rollbackStage.stagingId)?.status, 'accepted',
  'a failed apply must not mark the stage complete');
assert.equal(rollbackMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 0,
  'partially inserted HMX memories must be rolled back');
assert.equal(rollbackMemoryRuntime.semanticMemory.snapshot().nodes.length, 0,
  'partially projected semantic graph nodes must also roll back with failed canonical-memory application');
const retryAfterRollback = rollbackHexisFabric.decideHmx(rollbackStage.stagingId, 'apply');
assert.equal(retryAfterRollback?.status, 'applied', 'the same approved stage must remain safely retryable after compensation');
assert.equal(rollbackMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 2);
assert.equal(rollbackMemoryRuntime.semanticMemory.snapshot().edges.length, 1,
  'retry must commit graph relations after all canonical memory rows succeed');


const fabric = new HexisAdaptationFabric();
assert.equal(fabric.snapshot().version, 1);

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

const stage = fabric.stageHmx({document:makeHmxDocument('exp_0123456789abcdef',{memories:[{ref:'exp_0123456789abcdef:mem-1',type:'semantic',content:'HMX memory fixture.'}],goals:[{id:'g'}]}),intent:'port',strategy:'additive'});
assert.equal(stage.status,'staged');
assert.equal(fabric.decideHmx(stage.stagingId,'accept')?.status,'accepted');

const protectedStage = fabric.stageHmx({document:makeHmxDocument('exp_fedcba9876543210',{identity:[{id:'self'}]}),intent:'telepathy',strategy:'analysis_only'});
assert.equal(fabric.decideHmx(protectedStage.stagingId,'accept')?.status,'staged');

const incompleteEnvelope = makeHmxDocument('exp_aaaaaaaaaaaaaaaa', { memories: [{ id: 'missing-source-context' }] });
delete incompleteEnvelope.source.embedding_model;
const incompleteStage = fabric.stageHmx({ document: incompleteEnvelope, intent: 'port', strategy: 'additive' });
assert(incompleteStage.conflicts.some(conflict => conflict.path === 'source' && conflict.kind === 'schema'));
assert.equal(fabric.decideHmx(incompleteStage.stagingId, 'accept')?.status, 'staged',
  'an HMX envelope without required source provenance must never be accepted');

const unknownSection = fabric.stageHmx({
  document: makeHmxDocument('exp_bbbbbbbbbbbbbbbb', { memories: [], experimental_identity_v2: [{ id: 'unreviewed' }] }),
  intent: 'port',
  strategy: 'additive',
});
assert(unknownSection.conflicts.some(conflict => conflict.kind === 'unknown-section'));
assert.equal(fabric.decideHmx(unknownSection.stagingId, 'accept')?.status, 'staged',
  'unsupported future sections must be reviewed rather than silently imported');

const oversizedSection = fabric.stageHmx({
  document: makeHmxDocument('exp_cccccccccccccccc', { memories: Array.from({ length: 257 }, (_, id) => ({ id: String(id) })) }),
  intent: 'port',
  strategy: 'additive',
});
assert(oversizedSection.conflicts.some(conflict => conflict.path === 'sections.memories' && conflict.kind === 'size-limit'));
assert.equal(oversizedSection.sectionCounts.memories, 257);
assert.equal(oversizedSection.stagedSections.memories.length, 256,
  'oversized payloads are bounded in storage but cannot be accepted after truncation');

const aggregateOverflow = fabric.stageHmx({
  document: makeHmxDocument('exp_eeeeeeeeeeeeeeee', {
    memories: Array.from({ length: 256 }, (_, id) => ({ id: `m${id}` })),
    episodes: Array.from({ length: 256 }, (_, id) => ({ id: `e${id}` })),
    relationships: Array.from({ length: 256 }, (_, id) => ({ id: `r${id}` })),
    identity: Array.from({ length: 256 }, (_, id) => ({ id: `i${id}` })),
    goals: Array.from({ length: 64 }, (_, id) => ({ id: `g${id}` })),
  }),
  intent: 'port',
  strategy: 'additive',
});
assert(aggregateOverflow.conflicts.some(conflict => conflict.kind === 'size-limit'));
const stagedArrayRecords = Object.entries(aggregateOverflow.stagedSections)
  .reduce((sum, [name, records]) => sum + (Array.isArray(records) ? records.length : 0), 0);
assert(stagedArrayRecords <= 1024, 'aggregate HMX record storage must be bounded, not just flagged');
assert.equal(fabric.decideHmx(aggregateOverflow.stagingId, 'accept')?.status, 'staged');

const badIntent = fabric.stageHmx({
  document: makeHmxDocument('exp_dddddddddddddddd', { memories: [] }),
  intent: 'unbounded-autonomy',
  strategy: 'additive',
});
assert(badIntent.conflicts.some(conflict => conflict.path === 'intent'));
assert.equal(fabric.decideHmx(badIntent.stagingId, 'accept')?.status, 'staged');

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
console.log('HEXIS_ADAPTATION_PASS');
console.log(JSON.stringify({diagnostics:fabric.diagnostics(),defaultState:defaultHexisAdaptationState().version},null,2));
