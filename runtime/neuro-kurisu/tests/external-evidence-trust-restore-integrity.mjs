import assert from 'node:assert/strict';
import { ExternalEvidenceTrustEngine } from '../src/organism/system/ExternalEvidenceTrust.ts';

const now=Date.now();
const forged={
  version:1,
  records:[
    {id:'forged-unknown',claimKey:'claim:unknown',source:'mystery-agent',sourceClass:'os',independenceKey:'fake-device',confidence01:1,trust01:1,corroborations:999,independentSources:99,contradictions:0,status:'corroborated',firstSeenAt:now,lastSeenAt:now,evidenceIds:['evt-unknown']},
    {id:'forged-simulator',claimKey:'claim:sim',source:'simulated-world-environment',sourceClass:'device',independenceKey:'fake-sensor',confidence01:1,trust01:1,corroborations:999,independentSources:99,contradictions:0,status:'corroborated',firstSeenAt:now,lastSeenAt:now},
    {id:'invalid',claimKey:'',source:'device',independenceKey:'',confidence01:1,trust01:1,corroborations:1,independentSources:1,contradictions:0,status:'candidate',firstSeenAt:now,lastSeenAt:now},
    {id:'forged-overconfidence',claimKey:'claim:overconfident',source:'device',independenceKey:'camera-forged',confidence01:9,trust01:1,corroborations:999,independentSources:9,contradictions:0,status:'candidate',firstSeenAt:now,lastSeenAt:now,evidenceIds:['forged-confidence-event']},
  ],
};
const restored=new ExternalEvidenceTrustEngine();
restored.restore(forged);
const state=restored.snapshot();
assert.equal(state.records.length,2,'malformed persisted rows must be discarded');
assert.ok(!state.records.some(row=>row.id==='forged-overconfidence'),
  'out-of-range persisted confidence must be rejected rather than clamped to certainty');
assert.equal(state.records.find(row=>row.id==='forged-unknown').sourceClass,'unknown','source class must be re-derived from source identity');
assert.equal(state.records.find(row=>row.id==='forged-unknown').status,'candidate','unknown provenance cannot restore as corroborated');
assert.equal(state.records.find(row=>row.id==='forged-simulator').sourceClass,'simulator');
assert.equal(state.records.find(row=>row.id==='forged-simulator').status,'candidate','simulator evidence cannot restore as corroborated');
assert.ok(state.records.every(row=>row.trust01<1),'persisted trust scores must be recomputed');
assert.equal(state.records.find(row=>row.id==='forged-unknown').corroborations, 1,
  'one unique bounded event receipt must restore one corroboration observation');
assert.equal(state.records.find(row=>row.id==='forged-simulator').corroborations, 0,
  'a record without an event receipt must not regain corroboration from persisted aggregate counters');
assert.ok(state.records.every(row=>row.corroborations===(row.evidenceIds?.length??0)),
  'persisted corroboration counters must be rebuilt from bounded event receipts, not trusted');
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


const simulatorCannotElevateOs=new ExternalEvidenceTrustEngine();
simulatorCannotElevateOs.observe({claimKey:'claim:sim-first',source:'simulated-world-environment',independenceKey:'sim-first',confidence01:1,at:now,evidenceId:'sim-first-event'});
const osAfterSimulator=simulatorCannotElevateOs.observe({claimKey:'claim:sim-first',source:'os',independenceKey:'host-os',confidence01:.99,at:now+1,evidenceId:'host-os-event'});
assert.equal(osAfterSimulator.status,'candidate',
  'a simulator must not be counted as the second independent source for a high-trust OS witness');
assert.equal(simulatorCannotElevateOs.independenceCount('claim:sim-first'),1);

const duplicateReceiptRestore=new ExternalEvidenceTrustEngine();
duplicateReceiptRestore.restore({version:1,records:[
  {id:'dup-device',claimKey:'claim:duplicate',source:'device',independenceKey:'camera-a',confidence01:1,trust01:1,corroborations:999,independentSources:2,contradictions:0,status:'corroborated',firstSeenAt:now,lastSeenAt:now,evidenceIds:['same-event-id']},
  {id:'dup-os',claimKey:'claim:duplicate',source:'os',independenceKey:'host-b',confidence01:1,trust01:1,corroborations:999,independentSources:2,contradictions:0,status:'corroborated',firstSeenAt:now,lastSeenAt:now,evidenceIds:['same-event-id']},
]});
assert.equal(duplicateReceiptRestore.snapshot().acceptedCount,0,
  'one persisted event receipt cannot be replayed across two source identities');
assert.equal(duplicateReceiptRestore.independenceCount('claim:duplicate'),2,
  'source identity count remains diagnostic, but duplicate receipts cannot promote the records');
assert.ok(duplicateReceiptRestore.snapshot().records.every(row=>row.corroborations===0),
  'duplicate receipts must be removed from every claimant');

const receiptlessRestore=new ExternalEvidenceTrustEngine();
receiptlessRestore.restore({version:1,records:[
  {id:'receiptless-device',claimKey:'claim:receiptless',source:'device',independenceKey:'camera-r',confidence01:1,trust01:1,corroborations:999,independentSources:2,contradictions:0,status:'corroborated',firstSeenAt:now,lastSeenAt:now},
  {id:'receiptless-os',claimKey:'claim:receiptless',source:'os',independenceKey:'host-r',confidence01:1,trust01:1,corroborations:999,independentSources:2,contradictions:0,status:'corroborated',firstSeenAt:now,lastSeenAt:now},
]});
assert.equal(receiptlessRestore.snapshot().acceptedCount,0,
  'persisted aggregate counters without durable event receipts cannot restore corroboration');
assert.ok(receiptlessRestore.snapshot().records.every(row=>row.corroborations===0));


const receiptlessLive = new ExternalEvidenceTrustEngine();
const receiptlessFirst = receiptlessLive.observe({
  claimKey:'claim:receiptless-live',source:'device',independenceKey:'camera-no-receipt',
  confidence01:.99,at:now,
});
const receiptlessSecond = receiptlessLive.observe({
  claimKey:'claim:receiptless-live',source:'web',independenceKey:'publisher-no-receipt',
  confidence01:.99,at:now+1,
});
assert.equal(receiptlessFirst.status,'candidate');
assert.equal(receiptlessSecond.status,'candidate',
  'distinct source labels without exact event receipts cannot corroborate a claim');
assert.equal(receiptlessLive.snapshot().acceptedCount,0);
assert.equal(receiptlessLive.independenceCount('claim:receiptless-live'),0,
  'receiptless sources must not be counted as independent witnesses');
assert.equal(receiptlessLive.scoreClaim('claim:receiptless-live'),0,
  'receiptless source claims must not contribute a positive evidence score');


const hostileTrust = new ExternalEvidenceTrustEngine();
let trustGetterCalls = 0;
const getterTrustSnapshot = { version:1, records:[] };
Object.defineProperty(getterTrustSnapshot, 'records', {
  enumerable: true,
  get() { trustGetterCalls += 1; return []; },
});
assert.throws(() => hostileTrust.restore(getterTrustSnapshot), /inert-snapshot-invalid/,
  'an accessor-backed evidence snapshot must fail closed');
assert.equal(trustGetterCalls, 0, 'evidence restore must never execute getters');

let nestedTrustGetterCalls = 0;
const hostileEvidenceRow = {
  id:'hostile-row', claimKey:'claim:hostile', source:'device', independenceKey:'device-a',
  confidence01:.9, trust01:.9, firstSeenAt:now, lastSeenAt:now, status:'candidate',
};
Object.defineProperty(hostileEvidenceRow, 'source', {
  enumerable: true,
  get() { nestedTrustGetterCalls += 1; return 'os'; },
});
assert.throws(() => hostileTrust.restore({ version:1, records:[hostileEvidenceRow] }), /inert-snapshot-invalid/);
assert.equal(nestedTrustGetterCalls, 0, 'nested evidence accessors must never execute');

let trustProxyTrapCalls = 0;
const proxyTrustSnapshot = new Proxy({ version:1, records:[] }, {
  getPrototypeOf() { trustProxyTrapCalls += 1; throw new Error('proxy trap must not run'); },
});
assert.throws(() => hostileTrust.restore(proxyTrustSnapshot), /inert-snapshot-invalid/);
assert.equal(trustProxyTrapCalls, 0, 'proxy-backed evidence snapshots must be rejected without invoking traps');


const liveInvalidNumbers = new ExternalEvidenceTrustEngine();
const invalidConfidence = liveInvalidNumbers.observe({
  claimKey:'claim:live-invalid-confidence',source:'device',independenceKey:'camera-invalid-confidence',
  confidence01:9,at:now,evidenceId:'invalid-confidence-event',
});
assert.equal(invalidConfidence.confidence01, .5,
  'out-of-range live confidence must fall back conservatively rather than saturating at one');
const invalidContradiction = liveInvalidNumbers.observe({
  claimKey:'claim:live-invalid-contradiction',source:'device',independenceKey:'camera-invalid-contradiction',
  confidence01:.7,contradiction01:9,at:now,evidenceId:'invalid-contradiction-event',
});
assert.equal(invalidContradiction.contradictions, 0,
  'out-of-range contradiction input must not manufacture conflict evidence');

console.log('EXTERNAL_EVIDENCE_TRUST_RESTORE_INTEGRITY=PASS hostile=3');

