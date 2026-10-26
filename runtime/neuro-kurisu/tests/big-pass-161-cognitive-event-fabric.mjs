import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

// WorkPass346: stable event IDs bind the complete causal envelope, not only stage/source/tick.
{
  const fabric=new CognitiveEventFabric(128);
  assert.equal(new CognitiveEventFabric(Number.NaN).snapshot().capacity,512,
    'NaN capacity must fall back to the bounded default');
  assert.equal(new CognitiveEventFabric(Number.POSITIVE_INFINITY).snapshot().capacity,512,
    'infinite capacity must fall back to the bounded default');
  const base={
    id:'cef:test:event-identity-1',
    tick:7,
    at:700,
    stage:'tool-outcome',
    source:'workpass346-regression',
    parentIds:['decision-7','execution-7'],
    external:true,
    confidence01:0.85,
    payload:{ok:true,outcome:{status:'executed'}},
  };
  const first=fabric.append(base);
  const initialTotal=fabric.snapshot().total;
  assert.throws(()=>fabric.append({...base,id:'cef:test:control\ncharacter'}),/invalid-cognitive-event-id/,
    'control characters in supplied event IDs must be rejected');
  assert.equal(fabric.snapshot().total,initialTotal);

  const invalidClocks=[
    {id:'cef:test:tick-nan',tick:Number.NaN,at:701,error:/invalid-cognitive-event-tick/},
    {id:'cef:test:tick-negative',tick:-1,at:701,error:/invalid-cognitive-event-tick/},
    {id:'cef:test:tick-fractional',tick:7.5,at:701,error:/invalid-cognitive-event-tick/},
    {id:'cef:test:tick-unsafe',tick:Number.MAX_SAFE_INTEGER+1,at:701,error:/invalid-cognitive-event-tick/},
    {id:'cef:test:at-nan',tick:7,at:Number.NaN,error:/invalid-cognitive-event-timestamp/},
    {id:'cef:test:at-infinite',tick:7,at:Number.POSITIVE_INFINITY,error:/invalid-cognitive-event-timestamp/},
    {id:'cef:test:at-negative',tick:7,at:-1,error:/invalid-cognitive-event-timestamp/},
  ];
  for(const invalid of invalidClocks){
    assert.throws(()=>fabric.append({...base,id:invalid.id,tick:invalid.tick,at:invalid.at}),invalid.error,
      'invalid event clocks must fail before mutating the ledger');
    assert.equal(fabric.snapshot().total,initialTotal);
    assert.equal(fabric.getById(invalid.id),null);
  }

  const keyOrderReplay=fabric.append({...base,payload:{outcome:{status:'executed'},ok:true}});
  assert.equal(keyOrderReplay.id,first.id,'key-order-equivalent JSON should replay idempotently');
  assert.equal(fabric.snapshot().total,initialTotal,'exact replay must not append another event');

  const conflicts=[
    {...base,payload:{ok:false,outcome:{status:'executed'}}},
    {...base,parentIds:['execution-7','decision-7']},
    {...base,parentIds:['decision-7']},
    {...base,external:false},
    {...base,confidence01:0.2},
    {...base,at:701},
    {...base,stage:'tool-action'},
    {...base,source:'different-source'},
    {...base,tick:8},
  ];
  for(const conflicting of conflicts) {
    assert.throws(()=>fabric.append(conflicting),/cognitive-event-id-conflict/,
      'the same ID with a different causal envelope must fail closed');
    assert.equal(fabric.snapshot().total,initialTotal,'conflicting replay must not mutate the ledger');
    assert.deepEqual(fabric.getById(base.id)?.payload,base.payload,'conflict must preserve original payload');
  }

  // Omitted timestamp on replay reuses the stored logical event time.
  const withoutAt={id:'cef:test:event-identity-no-at',tick:8,stage:'observation',source:'no-at',
    parentIds:[],external:false,confidence01:0.5,payload:{nested:{value:1}}};
  const firstWithoutAt=fabric.append(withoutAt);
  const totalBeforeTimestampReplay=fabric.snapshot().total;
  const replayWithoutAt=fabric.append({...withoutAt,payload:{nested:{value:1}}});
  assert.equal(replayWithoutAt.at,firstWithoutAt.at);
  assert.equal(fabric.snapshot().total,totalBeforeTimestampReplay);

  // Neither caller-owned nor returned nested objects may mutate an accepted event.
  const callerPayload={nested:{value:'original'}};
  const stored=fabric.append({...base,id:'cef:test:detached-payload',tick:9,at:900,payload:callerPayload});
  callerPayload.nested.value='caller-mutated';
  (stored.payload.nested).value='return-mutated';
  const fetched=fabric.getById('cef:test:detached-payload');
  assert.equal(fetched?.payload.nested.value,'original');
  if(fetched) (fetched.payload.nested).value='lookup-mutated';
  assert.equal(fabric.getById('cef:test:detached-payload')?.payload.nested.value,'original');

  // Invalid payloads are rejected before any event is appended.
  const cyclicPayload={}; cyclicPayload.self=cyclicPayload;
  const beforeInvalidPayload=fabric.snapshot().total;
  assert.throws(()=>fabric.append({...base,id:'cef:test:cyclic',tick:10,payload:cyclicPayload}),/circular-cognitive-event-payload/);
  assert.equal(fabric.snapshot().total,beforeInvalidPayload);
  assert.equal(fabric.getById('cef:test:cyclic'),null);

  let getterExecuted=false;
  const accessorPayload={};
  Object.defineProperty(accessorPayload,'secret',{enumerable:true,get(){getterExecuted=true;throw new Error('must-not-run');}});
  const safeAccessorEvent=fabric.append({...base,id:'cef:test:accessor',tick:11,payload:accessorPayload});
  assert.equal(getterExecuted,false,'accessor payloads must not execute getters');
  assert.deepEqual(safeAccessorEvent.payload,{});
  assert.equal(fabric.getById('cef:test:accessor')?.payload.secret,undefined);

  let arrayGetterExecuted=false;
  const accessorArray=[];
  Object.defineProperty(accessorArray,'0',{enumerable:true,configurable:true,get(){arrayGetterExecuted=true;throw new Error('array getter must not run');}});
  accessorArray.length=1;
  const safeArrayEvent=fabric.append({...base,id:'cef:test:array-accessor',tick:12,at:1201,payload:{items:accessorArray}});
  assert.equal(arrayGetterExecuted,false,'array index accessors must not execute while cloning');
  assert.deepEqual(safeArrayEvent.payload,{items:[null]});

  let overriddenDateCalls=0;
  const inputDate=new Date('2026-01-02T03:04:05.000Z');
  inputDate.getTime=()=>{overriddenDateCalls++;throw new Error('overridden Date method must not run');};
  const dateEvent=fabric.append({...base,id:'cef:test:date-override',tick:13,at:1202,payload:{capturedAt:inputDate}});
  assert.equal(overriddenDateCalls,0,'Date normalization must use the built-in date slot');
  assert.equal(dateEvent.payload.capturedAt,'2026-01-02T03:04:05.000Z');

  const tooDeep={value:true};
  let deepCursor=tooDeep;
  for(let index=0;index<40;index++) { deepCursor.next={}; deepCursor=deepCursor.next; }
  const beforeDeepPayload=fabric.snapshot().total;
  assert.throws(()=>fabric.append({...base,id:'cef:test:depth-limit',tick:14,payload:tooDeep}),/cognitive-event-payload-depth-limit/);
  assert.equal(fabric.snapshot().total,beforeDeepPayload);

  const oversizedArray=new Array(16385);
  const beforeOversizedArray=fabric.snapshot().total;
  assert.throws(()=>fabric.append({...base,id:'cef:test:array-limit',tick:15,payload:{items:oversizedArray}}),/cognitive-event-payload-array-limit/);
  assert.equal(fabric.snapshot().total,beforeOversizedArray);

  const oversizedObject={};
  for(let index=0;index<8193;index++) oversizedObject[`k${index}`]=index;
  const beforeOversizedObject=fabric.snapshot().total;
  assert.throws(()=>fabric.append({...base,id:'cef:test:key-limit',tick:16,payload:oversizedObject}),/cognitive-event-payload-key-limit/);
  assert.equal(fabric.snapshot().total,beforeOversizedObject);

  const tooManyNodes={};
  for(let branchIndex=0;branchIndex<3;branchIndex++) tooManyNodes[`branch-${branchIndex}`]=new Array(6000).fill(0);
  const beforeNodeLimit=fabric.snapshot().total;
  assert.throws(()=>fabric.append({...base,id:'cef:test:node-limit',tick:17,payload:tooManyNodes}),/cognitive-event-payload-node-limit/);
  assert.equal(fabric.snapshot().total,beforeNodeLimit);

  // Malformed persisted evidence must not prevent recovery of healthy events.
  const malformedPayload={}; malformedPayload.self=malformedPayload;
  const restoreProbe=new CognitiveEventFabric(128);
  const healthyRestoredRow={id:'cef:test:malformed-restored',tick:21,at:2100,stage:'observation',
    source:'restore-probe-good',parentIds:[],external:false,confidence01:0.8,payload:{safe:true}};
  assert.doesNotThrow(()=>restoreProbe.restore({
    total:2,buffered:2,
    recent:[
      {...healthyRestoredRow,source:'restore-probe-corrupt',payload:malformedPayload},
      healthyRestoredRow,
    ],
  }));
  assert.equal(restoreProbe.getById('cef:test:malformed-restored')?.payload.safe,true,
    'a malformed persisted row must not reserve its ID and shadow a later healthy row');

  // Receipt replay remains conflict-safe after persistence drops the bounded replay index.
  const receiptFabric=new CognitiveEventFabric(128);
  const receiptInput={
    tick:12,executionId:'receipt-execution-12',toolId:'filesystem.write',decisionId:'decision-12',
    ok:true,verified:true,outcomeClass:'success',confidence01:0.9,verificationBasis:'external-postcondition',
    externalObservation:true,observationId:'observation-12',
    expectedPostcondition:'report.json exists and has expected digest',
    observedPostcondition:'report.json exists and digest matches',
    observationIntegrated:true,at:1200,
  };
  const receiptResult=receiptFabric.appendToolReceiptTrace(receiptInput);
  assert.equal(receiptResult.replayed,false);
  const receiptSnapshot=receiptFabric.snapshot();
  const receiptEvidence=receiptSnapshot.recent.find(event=>event.id===receiptResult.evidenceEventId);
  assert.ok(receiptEvidence);
  assert.equal(receiptEvidence.payload.expectedPostconditionHash?.length,64);
  assert.equal(receiptEvidence.payload.observedPostconditionHash?.length,64);
  assert.equal(JSON.stringify(receiptEvidence.payload).includes(receiptInput.expectedPostcondition),false,
    'raw postcondition text must not be stored in the causal ledger');

  const indexlessSnapshot={...receiptSnapshot,receiptProjectionIndex:[]};
  const restoredReceiptFabric=new CognitiveEventFabric(128);
  restoredReceiptFabric.restore(indexlessSnapshot);
  const restoredTotal=restoredReceiptFabric.snapshot().total;
  assert.throws(
    ()=>restoredReceiptFabric.appendToolReceiptTrace({
      ...receiptInput,
      expectedPostcondition:'a different condition that is also non-empty',
    }),
    /tool-receipt-execution-id-conflict/,
    'the event evidence itself must preserve postcondition identity when the bounded index is absent',
  );
  assert.equal(restoredReceiptFabric.snapshot().total,restoredTotal,
    'a conflicting restored receipt must not append additional causal events');
  const restoredExactReplay=restoredReceiptFabric.appendToolReceiptTrace(receiptInput);
  assert.equal(restoredExactReplay.replayed,true,'an exact receipt replay remains idempotent after restore');
  assert.equal(restoredReceiptFabric.snapshot().total,restoredTotal);
}

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
console.log(JSON.stringify({pass:161,before:before?.total??0,after:mid,resumed:{total:resumed.total,buffered:resumed.buffered,lineageIntegrity01:resumed.lineageIntegrity01}},null,2));
first.stop(); second.stop();
fs.rmSync(dir,{recursive:true,force:true});
