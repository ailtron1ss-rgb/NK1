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

const executorSource=readFileSync(resolve(process.cwd(),'src/organism/body/EmbodiedActionExecutor.ts'),'utf8');
const runtimeSource=readFileSync(resolve(process.cwd(),'src/organism/core/OrganismRuntime.ts'),'utf8');
assert.match(executorSource,/createStableEvidenceEventId\('embodied'/);
assert.match(runtimeSource,/eventId:embodiedAction\.eventId\?\.`\$\{embodiedAction\.eventId\}:action`/);
assert.match(runtimeSource,/eventId:embodiedAction\.eventId\?\.`\$\{embodiedAction\.eventId\}:consequence`/);

console.log('WORKPASS479_REALITY_EVIDENCE_EVENT_IDEMPOTENCY=PASS sameEventDedup=true conflictingPayloadQuarantine=true restoreQuarantine=true stableIdentity=true');
