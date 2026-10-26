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

const late = fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'late arrival',confidence01:.65,validFrom:1500,source:'test-late',value:'late'});
assert.equal(fabric.temporalAt('mem-1',1250)?.summary, 'alpha', 'earlier assertion interval must end at the next effective timestamp');
assert.equal(fabric.temporalAt('mem-1',1750)?.id, late.id, 'late-arriving assertion must be inserted into valid-time order');
assert.equal(fabric.temporalAt('mem-1',2500)?.summary, 'beta', 'late assertion must not overwrite the later version');
const temporalHistory = fabric.snapshot().temporal.filter(x => x.memoryId === 'mem-1').sort((a,b) => a.validFrom-b.validFrom);
assert.deepEqual(temporalHistory.map(x => [x.validFrom,x.validUntil]), [[1000,1500],[1500,2000],[2000,null]]);
assert.equal(temporalHistory[1].supersedesId, temporalHistory[0].id);
assert.equal(temporalHistory[2].supersedesId, temporalHistory[1].id);

const beforeTemporalReplay = fabric.snapshot().temporal.filter(x => x.memoryId === 'mem-1').length;
const replayedLate = fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'late arrival',confidence01:.65,validFrom:1500,source:'different-retry-source',value:'late'});
assert.equal(replayedLate.id, late.id, 'same semantic event at the same effective time must be idempotent');
assert.equal(fabric.snapshot().temporal.filter(x => x.memoryId === 'mem-1').length, beforeTemporalReplay);

const beforeTemporalConflict = fabric.snapshot();
assert.throws(
 () => fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'conflicting event',confidence01:.8,validFrom:1500,source:'test',value:'conflict'}),
 /temporal_assertion_timestamp_conflict/,
);
assert.deepEqual(fabric.snapshot(), beforeTemporalConflict, 'a conflicting event must not partially mutate temporal history');
assert.throws(
 () => fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'invalid time',confidence01:.5,validFrom:Number.NaN}),
 /temporal_valid_from_invalid/,
);
const restoredTemporal = new HexisAdaptationFabric();
restoredTemporal.restore(fabric.snapshot());
assert.equal(restoredTemporal.temporalAt('mem-1',1750)?.id, late.id, 'valid-time chain must survive restore');


const review = fabric.createLearningReview({periodStart:0,periodEnd:1,summary:'test review',items:[{kind:'semantic_belief',title:'x',content:'y',sourceMemoryId:'mem-1',evidence:{}}]});
const decided = fabric.decideLearningReview(review.id,review.items[0].id,'approve');
assert.equal(decided?.status,'approved');

const stage = fabric.stageHmx({document:{hmx_version:'1.7',export_id:'e1',sections:{memories:[{id:'m'}],goals:[{id:'g'}]}},intent:'port',strategy:'additive'});
assert.equal(stage.status,'staged');
assert.equal(fabric.decideHmx(stage.stagingId,'accept')?.status,'accepted');

// Approval fails closed if staged HMX bytes no longer match their recorded digest.
const modifiedStage = fabric.stageHmx({document:{hmx_version:'1.7',export_id:'e3',sections:{memories:[{content:'original memory'}]}},intent:'port',strategy:'additive'});
const modifiedSnapshot = fabric.snapshot();
const stagedRow = modifiedSnapshot.hmxStages.find(x => x.stagingId === modifiedStage.stagingId);
assert.ok(stagedRow, 'staged HMX entry must be persisted');
stagedRow.stagedSections.memories[0].content = 'content changed after validation';
const integrityGuard = new HexisAdaptationFabric();
integrityGuard.restore(modifiedSnapshot);
const integrityDecision = integrityGuard.decideHmx(modifiedStage.stagingId, 'accept');
assert.equal(integrityDecision?.status, 'rejected', 'modified staged content must not be accepted');
assert.ok(integrityDecision?.conflicts.some(x => x.kind === 'digest-mismatch'), 'rejection must expose the digest mismatch reason');

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

// Pending deliveries are obligations and must not disappear when terminal history rotates.
const pendingQueue = new HexisAdaptationFabric();
let oldestPending;
for (let i = 0; i < 520; i += 1) {
 const entry = pendingQueue.enqueueOutbox({idempotencyKey:`pending-${i}`,kind:'notify',channel:'test',payload:{i}});
 assert.ok(entry.id, 'pending outbox entry should be accepted');
 if (i === 0) oldestPending = entry;
}
assert.equal(pendingQueue.snapshot().outbox.length, 520, 'active outbox rows must survive beyond the terminal history window');
assert.equal(pendingQueue.snapshot().outbox.find(x => x.id === oldestPending.id)?.status, 'pending');
assert.equal(pendingQueue.enqueueOutbox({idempotencyKey:'pending-0',kind:'notify',channel:'test',payload:{i:0}}).id, oldestPending.id);

// A terminal row may rotate out, but its exact idempotency receipt must remain durable.
const longHorizon = new HexisAdaptationFabric();
const retired = longHorizon.enqueueOutbox({idempotencyKey:'retired-key',kind:'notify',channel:'test',payload:{message:'already sent'}});
assert.ok(retired.id);
longHorizon.claimOutbox(retired.id);
longHorizon.ackOutbox(retired.id, true);
for (let i = 0; i < 520; i += 1) {
 const entry = longHorizon.enqueueOutbox({idempotencyKey:`terminal-${i}`,kind:'notify',channel:'test',payload:{i}});
 assert.ok(entry.id);
 longHorizon.claimOutbox(entry.id);
 longHorizon.ackOutbox(entry.id, true);
}
assert.equal(longHorizon.snapshot().outbox.length, 512, 'terminal outbox rows remain bounded');
assert.equal(longHorizon.snapshot().outbox.some(x => x.id === retired.id), false, 'old terminal payload must rotate out');
const retiredReplay = longHorizon.enqueueOutbox({idempotencyKey:'retired-key',kind:'notify',channel:'test',payload:{message:'already sent'}});
assert.equal(retiredReplay.ok, false, 'same key must not create a new side effect after its row was retired');
assert.equal(retiredReplay.error, 'idempotency-key-history-expired');
assert.equal(retiredReplay.existingId, retired.id);
const retiredConflict = longHorizon.enqueueOutbox({idempotencyKey:'retired-key',kind:'notify',channel:'test',payload:{message:'different action'}});
assert.equal(retiredConflict.error, 'idempotency-key-conflict');
const longHorizonRestored = new HexisAdaptationFabric();
longHorizonRestored.restore(longHorizon.snapshot());
const restoredRetiredReplay = longHorizonRestored.enqueueOutbox({idempotencyKey:'retired-key',kind:'notify',channel:'test',payload:{message:'already sent'}});
assert.equal(restoredRetiredReplay.error, 'idempotency-key-history-expired', 'retired key guard must survive snapshot/restore');
assert.equal(longHorizonRestored.snapshot().metrics.outboxRetiredKeyReplays, 2);
assert.equal(longHorizonRestored.enqueueOutbox({idempotencyKey:'x'.repeat(257),kind:'notify',channel:'test',payload:{}}).error, 'idempotency-key-too-long');

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
