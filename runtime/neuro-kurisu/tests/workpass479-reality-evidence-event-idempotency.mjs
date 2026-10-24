import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStableEvidenceEventId } from '../src/organism/system/EvidenceEventIdentity.ts';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';

const identity=['organism.device.read','exec-abcdefgh','decision-17','obs-22',{sensor:'battery',input:1}];
const id=createStableEvidenceEventId('outcome',identity);
assert.match(id ?? '',/^outcome:[a-f0-9]{40}$/);
assert.equal(createStableEvidenceEventId('outcome',identity),id,'identical canonical tuples must receive identical IDs');
assert.notEqual(createStableEvidenceEventId('outcome',[...identity,'changed']),id,'changed evidence must have a distinct join key');
assert.equal(createStableEvidenceEventId('invalid namespace',identity),undefined);
const hostile={};Object.defineProperty(hostile,'secret',{enumerable:true,get(){throw new Error('getter must not run');}});
assert.equal(createStableEvidenceEventId('outcome',hostile),undefined,'hostile input must fail closed');

const ledger=new RealityEvidenceLedger(128);
const eventId='embodied:'+'a'.repeat(40)+':consequence';
const first=ledger.record({eventId,tick:5,at:100,realityClass:'device-observation',claim:'action-consequence:inspect',confidence01:.8,independenceKey:'device:sample-55',parentIds:['outcome-5']});
const replay=ledger.record({eventId,tick:5,at:999,realityClass:'device-observation',claim:'action-consequence:inspect',confidence01:.8,independenceKey:'device:sample-55',parentIds:['outcome-5']});
assert.equal(replay.id,first.id);
assert.equal(ledger.snapshot().total,1,'same event replay must not append or increment event count');
assert.equal(ledger.claimAssessment('action-consequence:inspect').promotionAllowed,true);

// A user report is useful context, but must not be misclassified as independent
// external/device confirmation for evidence promotion.
const reportedOnly=new RealityEvidenceLedger(128);
reportedOnly.record({eventId:'reported:'+'b'.repeat(40),tick:6,at:101,realityClass:'user-reported',claim:'reported-only-claim',confidence01:1,independenceKey:'user:session-1',parentIds:[]});
const reportedAssessment=reportedOnly.claimAssessment('reported-only-claim');
assert.equal(reportedAssessment.userReportedSamples,1);
assert.equal(reportedAssessment.externalSamples,0);
assert.equal(reportedAssessment.promotionAllowed,false,
  'user-reported content must not satisfy the external grounding requirement');

assert.throws(()=>ledger.record({eventId,tick:5,at:1000,realityClass:'device-observation',claim:'tampered-action-consequence',confidence01:.99,independenceKey:'device:sample-55',parentIds:['outcome-5']}),/reality-evidence-event-id-conflict/);
assert.ok(ledger.snapshot().quarantinedEventIds.includes(eventId));
assert.equal(ledger.claimAssessment('action-consequence:inspect').promotionAllowed,false,
  'conflicting reuse quarantines the event from all evidence promotion');
assert.equal(ledger.snapshot().externalCount,0,'quarantined event must not remain counted as trusted external evidence');
assert.throws(()=>ledger.record({eventId,tick:5,realityClass:'device-observation',claim:'action-consequence:inspect',confidence01:.8,independenceKey:'device:sample-55',parentIds:['outcome-5']}),/reality-evidence-event-id-quarantined/);

const restored=new RealityEvidenceLedger(128);
restored.restore(ledger.snapshot());
assert.ok(restored.snapshot().quarantinedEventIds.includes(eventId));
assert.equal(restored.claimAssessment('action-consequence:inspect').promotionAllowed,false);

// A conflicted persisted replay is quarantined during restore, even if the persisted
// quarantine list was manipulated to omit it.
const clean=new RealityEvidenceLedger(128);
clean.record({eventId,tick:8,at:200,realityClass:'device-observation',claim:'stable-claim',confidence01:.9,independenceKey:'device:lineage-8',parentIds:[]});
const forged=clean.snapshot();
forged.recent.push({...forged.recent[0],id:eventId,eventId,claim:'different-claim',confidence01:.1});
forged.quarantinedEventIds=[];
const restoreConflict=new RealityEvidenceLedger(128);
restoreConflict.restore(forged);
assert.ok(restoreConflict.snapshot().quarantinedEventIds.includes(eventId));
assert.equal(restoreConflict.recent(100).length,0,'restored conflicting event rows must not be active evidence');

// A quarantined row must not consume one of the bounded active-evidence slots.
// Put the conflicting event first (newest) so a premature capacity slice would
// evict a valid row at the tail of the restored window.
const capacity=128;
const capacityRows=Array.from({length:capacity+2},(_,index)=>({
  id:`capacity-event-${index}`,eventId:`capacity-event-${index}`,
  tick:index,at:300+index,realityClass:'device-observation',
  claim:`capacity-claim-${index}`,confidence01:.8,
  independenceKey:`device:capacity-${index}`,parentIds:[],
}));
const newestFirst=[...capacityRows].reverse();
const restoreCapacityConflict=new RealityEvidenceLedger(capacity);
restoreCapacityConflict.restore({
  version:1,total:capacityRows.length+1,externalCount:capacityRows.length,
  simulatorCount:0,independentSources:capacityRows.length,
  recent:[
    newestFirst[0],
    {...newestFirst[0],claim:'conflicting-capacity-claim',confidence01:.1},
    ...newestFirst.slice(1),
  ],
  quarantinedEventIds:[],
});
const activeAfterCapacityRestore=restoreCapacityConflict.recent(256);
assert.equal(activeAfterCapacityRestore.length,capacity,
  'restore must apply retention capacity after removing conflicting event identities');
assert.equal(activeAfterCapacityRestore.some(row=>row.eventId===newestFirst[0].eventId),false,
  'the conflicting event identity must remain quarantined');
assert.equal(activeAfterCapacityRestore.some(row=>row.eventId==='capacity-event-1'),true,
  'quarantine must not evict a valid event merely to keep an inactive conflict row');

// The live write path must release the conflicted row's capacity slot immediately,
// not wait for restore or for a later bounded-history eviction.
const runtimeCapacityLedger=new RealityEvidenceLedger(capacity);
for(let index=0;index<capacity;index++){
  runtimeCapacityLedger.record({
    eventId:`runtime-capacity-${index}`,tick:index,at:500+index,
    realityClass:'device-observation',claim:`runtime-capacity-claim-${index}`,
    confidence01:.8,independenceKey:`device:runtime-capacity-${index}`,parentIds:[],
  });
}
assert.throws(()=>runtimeCapacityLedger.record({
  eventId:`runtime-capacity-${capacity-1}`,tick:capacity-1,at:900,
  realityClass:'device-observation',claim:'runtime-conflicting-claim',
  confidence01:.1,independenceKey:`device:runtime-capacity-${capacity-1}`,parentIds:[],
}),/reality-evidence-event-id-conflict/);
runtimeCapacityLedger.record({
  eventId:'runtime-capacity-new',tick:capacity,at:901,
  realityClass:'device-observation',claim:'runtime-capacity-new-claim',
  confidence01:.8,independenceKey:'device:runtime-capacity-new',parentIds:[],
});
const activeAfterRuntimeConflict=runtimeCapacityLedger.recent(256);
assert.equal(activeAfterRuntimeConflict.length,capacity,
  'live conflict quarantine must release its slot before retention trims another event');
assert.ok(activeAfterRuntimeConflict.some(row=>row.eventId==='runtime-capacity-0'),
  'a live conflict must not evict an unrelated valid historical observation');
assert.equal(activeAfterRuntimeConflict.some(row=>row.eventId===`runtime-capacity-${capacity-1}`),false,
  'the conflicted live event identity must remain inactive');



const executorSource=readFileSync(resolve(process.cwd(),'src/organism/body/EmbodiedActionExecutor.ts'),'utf8');
const runtimeSource=readFileSync(resolve(process.cwd(),'src/organism/core/OrganismRuntime.ts'),'utf8');
assert.match(executorSource,/createStableEvidenceEventId\('embodied',\[decisionId\]\)/);
assert.match(executorSource,/const decisionId=typeof input\.decisionId==='string'/);
assert.doesNotMatch(executorSource,/createStableEvidenceEventId\('embodied',\[action,at,status/);
assert.ok(runtimeSource.includes("eventId:embodiedAction.eventId?`${embodiedAction.eventId}:action`"));
assert.ok(runtimeSource.includes("eventId:embodiedAction.eventId?`${embodiedAction.eventId}:consequence`"));

// Read limits follow normal collection semantics: zero returns no rows; invalid limits use the default.
assert.deepEqual(ledger.recent(0), []);
assert.equal(ledger.recent(-4).length, 0);
assert.equal(ledger.recent(Number.NaN).length, ledger.recent(64).length);
console.log('WORKPASS479_REALITY_EVIDENCE_EVENT_IDEMPOTENCY=PASS sameEventDedup=true conflictingPayloadQuarantine=true restoreQuarantine=true stableIdentity=true');
