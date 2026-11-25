import assert from 'node:assert/strict';
import { ExternalEvidenceTrustEngine } from '../src/organism/system/ExternalEvidenceTrust.ts';

const now=Date.now();
const forged={
  version:1,
  records:[
    {id:'forged-unknown',claimKey:'claim:unknown',source:'mystery-agent',sourceClass:'os',independenceKey:'fake-device',confidence01:1,trust01:1,corroborations:999,independentSources:99,contradictions:0,status:'corroborated',firstSeenAt:now,lastSeenAt:now,evidenceIds:['evt-unknown']},
    {id:'forged-simulator',claimKey:'claim:sim',source:'simulated-world-environment',sourceClass:'device',independenceKey:'fake-sensor',confidence01:1,trust01:1,corroborations:999,independentSources:99,contradictions:0,status:'corroborated',firstSeenAt:now,lastSeenAt:now},
    {id:'invalid',claimKey:'',source:'device',independenceKey:'',confidence01:1,trust01:1,corroborations:1,independentSources:1,contradictions:0,status:'candidate',firstSeenAt:now,lastSeenAt:now},
  ],
};
const restored=new ExternalEvidenceTrustEngine();
restored.restore(forged);
const state=restored.snapshot();
assert.equal(state.records.length,2,'malformed persisted rows must be discarded');
assert.equal(state.records.find(row=>row.id==='forged-unknown').sourceClass,'unknown','source class must be re-derived from source identity');
assert.equal(state.records.find(row=>row.id==='forged-unknown').status,'candidate','unknown provenance cannot restore as corroborated');
assert.equal(state.records.find(row=>row.id==='forged-simulator').sourceClass,'simulator');
assert.equal(state.records.find(row=>row.id==='forged-simulator').status,'candidate','simulator evidence cannot restore as corroborated');
assert.ok(state.records.every(row=>row.trust01<1),'persisted trust scores must be recomputed');
assert.equal(state.acceptedCount,0);
assert.equal(state.meanTrust01,state.records.reduce((sum,row)=>sum+row.trust01,0)/2);

const valid=new ExternalEvidenceTrustEngine();
const first=valid.observe({claimKey:'claim:real',source:'device',independenceKey:'camera-a',confidence01:.95,at:now,evidenceId:'device-event-1'});
assert.equal(first.status,'candidate');
const second=valid.observe({claimKey:'claim:real',source:'web',independenceKey:'publisher-b',confidence01:.95,at:now+1,evidenceId:'web-event-1'});
assert.equal(second.status,'corroborated','two eligible independent sources should still corroborate');
const roundTrip=new ExternalEvidenceTrustEngine();
roundTrip.restore(valid.snapshot());
assert.equal(roundTrip.snapshot().acceptedCount,2,'both independent corroborating source records must survive a sanitized restore');
assert.equal(roundTrip.independenceCount('claim:real'),2,'restored corroboration must retain two independent source identities');
assert.ok(roundTrip.scoreClaim('claim:real')>.8,'the restored claim score must reflect independent corroboration');

const freshness=new ExternalEvidenceTrustEngine();
const newer=freshness.observe({claimKey:'claim:freshness',source:'device',independenceKey:'camera-fresh',confidence01:.8,at:now+2_000});
const delayed=freshness.observe({claimKey:'claim:freshness',source:'device',independenceKey:'camera-fresh',confidence01:.7,at:now-60_000});
assert.equal(delayed.lastSeenAt,newer.lastSeenAt,'delayed evidence must not move freshness backwards');
const future=freshness.observe({claimKey:'claim:future',source:'device',independenceKey:'camera-future',confidence01:.8,at:now+30*24*60*60*1000});
assert.ok(future.lastSeenAt<=Date.now()+5*60*1000,'far-future timestamps must be bounded');
const invalidTime=freshness.observe({claimKey:'claim:invalid-time',source:'device',independenceKey:'camera-invalid',confidence01:.8,at:-1});
assert.ok(invalidTime.lastSeenAt>=now-1_000,'negative timestamps must not create ancient evidence');

console.log('EXTERNAL_EVIDENCE_TRUST_RESTORE_INTEGRITY=PASS');
