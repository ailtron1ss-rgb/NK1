import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nk161-'));
const stateFile=path.join(dir,'organism.json');
const worldStateFile=path.join(dir,'world.json');
const make=()=>new OrganismRuntime({stateFile,worldStateFile,enableLanguage:false,autoRun:false,intervalMs:100000});
const first=make();
await first.init();
const before=first.cognitiveEventFabricSnapshot();
for(const text of ['investigate an unknown signal','compare two explanations','revise the hypothesis','consolidate the result']) await first.step(text,{deliberate:true});
await first.flush();
const mid=first.cognitiveEventFabricSnapshot();
assert.ok(mid);
assert.ok(mid.total>=24,'each operational step should create a full causal chain');
assert.ok(mid.cycleCoverage01>=0.99,'operational cycles should have observation/prediction/action/outcome');
assert.ok(mid.lineageIntegrity01>=0.99,'causal parent lineage should remain intact in the buffer');
assert.equal(mid.danglingParentLinks,0);
assert.ok(mid.recent.some(e=>e.stage==='learning'));
assert.ok(mid.recent.some(e=>e.stage==='self-update'));
const second=make();
await second.init();
const resumed=second.cognitiveEventFabricSnapshot();
assert.ok(resumed);
assert.ok(resumed.total>=mid.total,'cognitive event total must survive restart');
assert.ok(resumed.buffered>=Math.min(mid.buffered,128));
assert.equal(resumed.danglingParentLinks,0);

const envelopeFabric=new CognitiveEventFabric(128);
const canonicalEnvelope={
  id:'cef:test:stable-envelope',
  tick:7,
  at:700,
  stage:'tool-outcome',
  source:'action-gateway-outcome',
  parentIds:['decision-7','execution-7'],
  external:true,
  confidence01:0.85,
  payload:{success:true,nested:{detail:'verified',status:'executed'}},
};
const acceptedEnvelope=envelopeFabric.append(canonicalEnvelope);
const envelopeTotal=envelopeFabric.snapshot().total;
const reorderedPayloadReplay=envelopeFabric.append({
  ...canonicalEnvelope,
  payload:{nested:{status:'executed',detail:'verified'},success:true},
});
assert.equal(reorderedPayloadReplay.id,acceptedEnvelope.id,'canonical JSON key ordering must preserve an exact replay');
assert.equal(envelopeFabric.snapshot().total,envelopeTotal,'exact replay must not append a second event');

const conflictingEnvelopes=[
  {...canonicalEnvelope,at:701},
  {...canonicalEnvelope,tick:8},
  {...canonicalEnvelope,stage:'tool-action'},
  {...canonicalEnvelope,source:'different-source'},
  {...canonicalEnvelope,parentIds:['execution-7','decision-7']},
  {...canonicalEnvelope,parentIds:['decision-7']},
  {...canonicalEnvelope,external:false},
  {...canonicalEnvelope,confidence01:0.1},
  {...canonicalEnvelope,payload:{success:false,nested:{detail:'verified',status:'executed'}}},
];
for(const conflicting of conflictingEnvelopes){
  assert.throws(
    ()=>envelopeFabric.append(conflicting),
    /cognitive-event-id-conflict/,
    'reusing an ID with a changed causal envelope must fail closed',
  );
  assert.equal(envelopeFabric.snapshot().total,envelopeTotal,'conflicting replay must not mutate the event ledger');
}

const timestampOmittedReplay={...canonicalEnvelope,id:'cef:test:omitted-timestamp',at:undefined};
const firstTimestampOmitted=envelopeFabric.append(timestampOmittedReplay);
const totalAfterTimestampOmitted=envelopeFabric.snapshot().total;
const replayTimestampOmitted=envelopeFabric.append(timestampOmittedReplay);
assert.equal(replayTimestampOmitted.at,firstTimestampOmitted.at,'an omitted timestamp reuses the original logical event time');
assert.equal(envelopeFabric.snapshot().total,totalAfterTimestampOmitted,'timestamp-free retry remains idempotent');

const callerOwnedPayload={nested:{value:'original'}};
const detachedResult=envelopeFabric.append({
  id:'cef:test:detached-payload',tick:9,at:900,stage:'tool-evidence',source:'evidence-test',
  parentIds:[],external:false,confidence01:0.7,payload:callerOwnedPayload,
});
callerOwnedPayload.nested.value='caller-mutated';
detachedResult.payload.nested.value='returned-object-mutated';
assert.equal(envelopeFabric.recent(128).find(event=>event.id==='cef:test:detached-payload')?.payload.nested.value,'original',
  'caller-owned and returned nested objects cannot mutate the stored causal record');

let nestedGetterCalls=0;
const nestedAccessor={};
Object.defineProperty(nestedAccessor,'secret',{enumerable:true,get(){nestedGetterCalls++;return 'must-not-run';}});
const accessorEvent=envelopeFabric.append({
  id:'cef:test:accessor-payload',tick:10,at:1000,stage:'tool-evidence',source:'accessor-test',
  parentIds:[],external:false,confidence01:0.6,payload:{nested:nestedAccessor},
});
assert.equal(nestedGetterCalls,0,'nested accessors are omitted without executing caller-controlled code');
assert.deepEqual(accessorEvent.payload,{nested:{}});

let arrayGetterCalls=0;
const accessorArray=[];
Object.defineProperty(accessorArray,'0',{enumerable:true,configurable:true,get(){arrayGetterCalls++;return 'must-not-run';}});
accessorArray.length=1;
const arrayAccessorEvent=envelopeFabric.append({
  id:'cef:test:array-accessor-payload',tick:10,at:1001,stage:'tool-evidence',source:'array-accessor-test',
  parentIds:[],external:false,confidence01:0.6,payload:{items:accessorArray},
});
assert.equal(arrayGetterCalls,0,'array-index accessors are omitted without executing caller-controlled code');
assert.deepEqual(arrayAccessorEvent.payload,{items:[null]});

const storedTotalBeforeCycle=envelopeFabric.snapshot().total;
const cyclicPayload={}; cyclicPayload.self=cyclicPayload;
assert.throws(()=>envelopeFabric.append({
  id:'cef:test:cyclic-payload',tick:11,at:1100,stage:'tool-evidence',source:'cycle-test',
  parentIds:[],external:false,confidence01:0.5,payload:cyclicPayload,
}),/circular/);
assert.equal(envelopeFabric.snapshot().total,storedTotalBeforeCycle,'invalid cyclic payload fails before mutating the ledger');
assert.equal(envelopeFabric.recent(128).some(event=>event.id==='cef:test:cyclic-payload'),false);

console.log(JSON.stringify({pass:161,before:before?.total??0,after:mid,resumed:{total:resumed.total,buffered:resumed.buffered,lineageIntegrity01:resumed.lineageIntegrity01}},null,2));
first.stop(); second.stop();
fs.rmSync(dir,{recursive:true,force:true});
