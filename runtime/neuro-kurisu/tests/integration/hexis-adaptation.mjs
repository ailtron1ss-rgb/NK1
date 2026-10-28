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

// The in-memory source key list is intentionally bounded to 256 entries. The
// larger bounded audit must still prevent a replayed old source from changing a
// belief after its key leaves that fast membership list.
const agedEvidenceFabric = new HexisAdaptationFabric();
const agedFirst = agedEvidenceFabric.reviseBelief({
  memoryId: 'mem-aged-evidence',
  confidence01: .5,
  trust01: .5,
  stance: 'supports',
  evidence: { ref: 'aged-source-original', trust01: .72 },
});
assert.equal(agedFirst.applied, true);
for (let index = 0; index < 256; index++) {
  const entry = agedEvidenceFabric.reviseBelief({
    memoryId: 'mem-aged-evidence',
    confidence01: agedEvidenceFabric.snapshot().beliefs.find(row => row.memoryId === 'mem-aged-evidence').confidence01,
    trust01: .25,
    stance: 'supports',
    evidence: { ref: 'aged-source-' + index, trust01: .25 },
  });
  assert.equal(entry.applied, true, 'each new independent source should be eligible once');
}
const beforeAgedReplay = agedEvidenceFabric.snapshot();
const agedBeliefBeforeReplay = beforeAgedReplay.beliefs.find(row => row.memoryId === 'mem-aged-evidence');
assert(agedBeliefBeforeReplay);
assert.equal(agedBeliefBeforeReplay.sourceKeys.includes('aged-source-original'), false,
  'the original source key must be evicted from the 256-key fast list in this fixture');
assert.ok(beforeAgedReplay.beliefAudit.some(row =>
  row.memoryId === 'mem-aged-evidence' && row.evidence.ref === 'aged-source-original'),
  'the bounded audit should still retain the original source event');
const agedReplay = agedEvidenceFabric.reviseBelief({
  memoryId: 'mem-aged-evidence',
  confidence01: agedBeliefBeforeReplay.confidence01,
  trust01: .99,
  stance: 'contradicts',
  evidence: { ref: 'aged-source-original', trust01: .99 },
});
assert.equal(agedReplay.independent, false,
  'an old source still in the audit must not become independent after source-key eviction');
assert.equal(agedReplay.applied, false,
  'replaying old evidence with opposite polarity must not alter belief confidence');
assert.equal(agedReplay.reason, 'duplicate_source');
assert.equal(agedReplay.posteriorConfidence01, agedBeliefBeforeReplay.confidence01);
assert.equal(agedEvidenceFabric.snapshot().beliefs.find(row => row.memoryId === 'mem-aged-evidence').confidence01,
  agedBeliefBeforeReplay.confidence01,
  'confidence must remain unchanged when an old evidence source is replayed');

// The idempotency backstop must remain effective after persistence/restore, not
// only within the live fabric's current audit instance.
const restoredAgedEvidenceFabric = new HexisAdaptationFabric();
restoredAgedEvidenceFabric.restore(agedEvidenceFabric.snapshot());
const agedBeliefAfterRestore = restoredAgedEvidenceFabric.snapshot().beliefs.find(row => row.memoryId === 'mem-aged-evidence');
assert(agedBeliefAfterRestore);
assert.equal(agedBeliefAfterRestore.sourceKeys.includes('aged-source-original'), false);
const restoredAgedReplay = restoredAgedEvidenceFabric.reviseBelief({
  memoryId: 'mem-aged-evidence',
  confidence01: agedBeliefAfterRestore.confidence01,
  trust01: .99,
  stance: 'contradicts',
  evidence: { ref: 'aged-source-original', trust01: .99 },
});
assert.equal(restoredAgedReplay.independent, false,
  'the audit-based replay guard must survive restore when the old fast-list key is absent');
assert.equal(restoredAgedReplay.applied, false);
assert.equal(restoredAgedReplay.reason, 'duplicate_source');
assert.equal(restoredAgedEvidenceFabric.snapshot().beliefs.find(row => row.memoryId === 'mem-aged-evidence').confidence01,
  agedBeliefAfterRestore.confidence01,
  'restored replay must not re-apply old evidence to belief confidence');

const t1 = fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'alpha',confidence01:.7,validFrom:1000,source:'test',value:'alpha'});
fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'beta',confidence01:.8,validFrom:2000,source:'test',value:'beta'});
assert.equal(fabric.temporalAt('mem-1',1500)?.valueHash, t1.valueHash);
assert.equal(fabric.temporalAt('mem-1',2500)?.summary, 'beta');
assert.equal(fabric.temporalDiff('mem-1',1500,2500).changed, true);

const review = fabric.createLearningReview({periodStart:0,periodEnd:1,summary:'test review',items:[{kind:'semantic_belief',title:'x',content:'y',sourceMemoryId:'mem-1',evidence:{}}]});
const decided = fabric.decideLearningReview(review.id,review.items[0].id,'approve');
assert.equal(decided?.status,'approved');

const stage = fabric.stageHmx({document:{hmx_version:'1.7',export_id:'e1',sections:{memories:[{id:'m'}],goals:[{id:'g'}]}},intent:'port',strategy:'additive'});
assert.equal(stage.status,'staged');
assert.equal(fabric.decideHmx(stage.stagingId,'accept')?.status,'accepted');

const protectedStage = fabric.stageHmx({document:{hmx_version:'1.7',export_id:'e2',sections:{identity:[{id:'self'}]}},intent:'telepathy',strategy:'analysis_only'});
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
console.log('HEXIS_ADAPTATION_PASS', JSON.stringify({ agedReplayDetected: agedReplay.reason === 'duplicate_source', restoredAgedReplayDetected: restoredAgedReplay.reason === 'duplicate_source', agedSourceKeys: agedBeliefBeforeReplay.sourceKeys.length, auditRows: beforeAgedReplay.beliefAudit.length }));
console.log(JSON.stringify({diagnostics:fabric.diagnostics(),defaultState:defaultHexisAdaptationState().version},null,2));
