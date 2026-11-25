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
assert.ok(state.records.every(row=>row.corroborations===1),'persisted corroboration counters must be rebuilt from bounded event receipts, not trusted');
assert.ok(state.records.every(row=>row.contradictions===0),'persisted contradiction counters without supporting receipts must not alter restored trust');
const forgedDevice=new ExternalEvidenceTrustEngine();
forgedDevice.restore({version:1,records:[{id:'forged-device',claimKey:'claim:device',source:'device',independenceKey:'camera-a',confidence01:1,trust01:1,corroborations:999,independentSources:99,contradictions:0,status:'corroborated',firstSeenAt:now,lastSeenAt:now,evidenceIds:['only-one-event']}]});
assert.equal(forgedDevice.snapshot().records[0].corroborations,1);
assert.ok(forgedDevice.snapshot().records[0].trust01<.75,'a forged aggregate counter must not inflate a single device event into corroborated-level trust');
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

const sourceEligibility=new ExternalEvidenceTrustEngine();
const grounded=sourceEligibility.observe({claimKey:'claim:eligibility',source:'device',independenceKey:'camera-eligibility',confidence01:.99,at:now,evidenceId:'eligibility-device-event'});
const simulated=sourceEligibility.observe({claimKey:'claim:eligibility',source:'simulated-world-environment',independenceKey:'sim-run-eligibility',confidence01:1,at:now+1,evidenceId:'eligibility-sim-event'});
assert.equal(grounded.status,'candidate');
assert.equal(simulated.status,'candidate','simulator evidence must never corroborate a real source');
assert.equal(sourceEligibility.independenceCount('claim:eligibility'),1,
  'simulator must not count as an independent witness for a real-world claim');
assert.equal(sourceEligibility.scoreClaim('claim:eligibility')<.8,true,
  'simulator confidence must not inflate the score of a grounded-world claim');
const restoredEligibility=new ExternalEvidenceTrustEngine();
restoredEligibility.restore(sourceEligibility.snapshot());
assert.equal(restoredEligibility.independenceCount('claim:eligibility'),1,
  'source eligibility must be identical after restore');

const internalOnly=new ExternalEvidenceTrustEngine();
internalOnly.observe({claimKey:'claim:internal',source:'organism',independenceKey:'internal-a',confidence01:1,at:now,evidenceId:'internal-event-a'});
internalOnly.observe({claimKey:'claim:internal',source:'organism',independenceKey:'internal-b',confidence01:1,at:now+1,evidenceId:'internal-event-b'});
assert.equal(internalOnly.independenceCount('claim:internal'),0,
  'organism-generated evidence cannot independently verify its own world claim');
assert.equal(internalOnly.snapshot().acceptedCount,0);

console.log('EXTERNAL_EVIDENCE_TRUST_RESTORE_INTEGRITY=PASS');
