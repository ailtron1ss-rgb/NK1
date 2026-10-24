import assert from 'node:assert/strict';
import { HexisAdaptationFabric, defaultHexisAdaptationState } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';
import { normalizeNk1HmxExport } from '../../src/organism/integration/hexis/Nk1HmxExportAdapter.mjs';

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
    relationships: [{ id: 'rel-1', sourceId: 'mem-1', targetId: 'goal-1', edgeType: 'supports' }],
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

const fabric = new HexisAdaptationFabric();
assert.equal(fabric.snapshot().version, 1);

const makeHmxDocument = (exportId, sections) => ({
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

const stage = fabric.stageHmx({document:makeHmxDocument('exp_0123456789abcdef',{memories:[{id:'m'}],goals:[{id:'g'}]}),intent:'port',strategy:'additive'});
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
