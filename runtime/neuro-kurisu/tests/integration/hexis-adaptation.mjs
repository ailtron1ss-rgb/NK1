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

 // Backfilled valid-time records must be inserted into chronological order, even if they arrive late.
 const temporal = new HexisAdaptationFabric();
 const late = temporal.recordTemporalAssertion({
   memoryId: 'mem-out-of-order', summary: 'late', confidence01: .9,
   validFrom: 3000, source: 'test', value: 'late',
 });
 temporal.recordTemporalAssertion({
   memoryId: 'mem-out-of-order', summary: 'early', confidence01: .7,
   validFrom: 1000, source: 'test', value: 'early',
 });
 temporal.recordTemporalAssertion({
   memoryId: 'mem-out-of-order', summary: 'middle', confidence01: .8,
   validFrom: 2000, source: 'test', value: 'middle',
 });
 assert.equal(temporal.temporalAt('mem-out-of-order', 999), null);
 assert.equal(temporal.temporalAt('mem-out-of-order', 1000)?.summary, 'early');
 assert.equal(temporal.temporalAt('mem-out-of-order', 1999)?.summary, 'early');
 assert.equal(temporal.temporalAt('mem-out-of-order', 2000)?.summary, 'middle');
 assert.equal(temporal.temporalAt('mem-out-of-order', 2999)?.summary, 'middle');
 assert.equal(temporal.temporalAt('mem-out-of-order', 3000)?.summary, 'late');
 assert.equal(temporal.temporalAt('mem-out-of-order', 3500)?.summary, 'late');
 assert.equal(temporal.temporalAt('mem-out-of-order', Number.POSITIVE_INFINITY), null);

 const ordered = temporal.snapshot().temporal
   .filter(row => row.memoryId === 'mem-out-of-order')
   .sort((a, b) => a.validFrom - b.validFrom);
 assert.deepEqual(ordered.map(row => [row.summary, row.validUntil]), [
   ['early', 2000], ['middle', 3000], ['late', null],
 ]);
 assert.equal(ordered[0]?.supersedesId, undefined);
 assert.equal(ordered[1]?.supersedesId, ordered[0]?.id);
 assert.equal(ordered[2]?.supersedesId, ordered[1]?.id);

 const idempotentBackfill = temporal.recordTemporalAssertion({
   memoryId: 'mem-out-of-order', summary: 'late', confidence01: .9,
   validFrom: 3000, source: 'test', value: 'late',
 });
 assert.equal(idempotentBackfill.id, late.id, 'identical valid-time assertions are idempotent');
 assert.equal(temporal.snapshot().temporal.filter(row => row.memoryId === 'mem-out-of-order').length, 3);
 assert.throws(() => temporal.recordTemporalAssertion({
   memoryId: 'mem-out-of-order', summary: 'conflicting same-time value', confidence01: .9,
   validFrom: 3000, source: 'test', value: 'different',
 }), /temporal_valid_from_conflict/);
 assert.throws(() => temporal.recordTemporalAssertion({
   memoryId: 'mem-out-of-order', summary: 'invalid time', confidence01: .5,
   validFrom: Number.NaN, source: 'test', value: 'invalid',
 }), /temporal_valid_from_must_be_finite/);
 assert.equal(temporal.temporalAt('mem-out-of-order', 3500)?.summary, 'late',
   'invalid temporal input must not corrupt the existing timeline');

// Restoring a legacy snapshot must discard invalid timestamps and re-establish non-overlapping intervals.
const restoredTemporal = new HexisAdaptationFabric();
restoredTemporal.restore({
  temporal: [
    { id: 'legacy-late', memoryId: 'legacy-memory', valueHash: 'hash-late', summary: 'legacy late', confidence01: .8, validFrom: 3000, validUntil: null, source: 'test', at: 3 },
    { id: 'legacy-invalid', memoryId: 'legacy-memory', valueHash: 'hash-invalid', summary: 'legacy invalid', confidence01: .5, validFrom: Number.NaN, validUntil: null, source: 'test', at: 4 },
    { id: 'legacy-early', memoryId: 'legacy-memory', valueHash: 'hash-early', summary: 'legacy early', confidence01: .6, validFrom: 1000, validUntil: 99999, source: 'test', at: 1 },
  ],
});
assert.equal(restoredTemporal.snapshot().temporal.length, 2, 'invalid legacy timestamps are dropped on restore');
assert.equal(restoredTemporal.temporalAt('legacy-memory', 2000)?.summary, 'legacy early');
assert.equal(restoredTemporal.temporalAt('legacy-memory', 3500)?.summary, 'legacy late');
const restoredTimeline = restoredTemporal.snapshot().temporal
  .filter(row => row.memoryId === 'legacy-memory')
  .sort((a, b) => a.validFrom - b.validFrom);
assert.deepEqual(restoredTimeline.map(row => [row.summary, row.validUntil]), [
  ['legacy early', 3000], ['legacy late', null],
]);
assert.throws(() => temporal.recordTemporalAssertion({
  memoryId: '', summary: 'blank ID', confidence01: .5, validFrom: 4000,
}), /temporal_memory_id_required/);
assert.throws(() => temporal.recordTemporalAssertion({
  memoryId: 'mem-out-of-order', summary: '   ', confidence01: .5, validFrom: 4000,
}), /temporal_summary_required/);
assert.throws(() => temporal.recordTemporalAssertion({
  memoryId: 'mem-out-of-order', summary: 'blank timestamp', confidence01: .5, validFrom: '  ',
}), /temporal_valid_from_must_be_finite/);

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
console.log('HEXIS_ADAPTATION_PASS');
console.log(JSON.stringify({diagnostics:fabric.diagnostics(),defaultState:defaultHexisAdaptationState().version},null,2));
