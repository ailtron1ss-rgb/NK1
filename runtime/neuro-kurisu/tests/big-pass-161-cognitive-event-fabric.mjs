import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

// WorkPass346: stable event IDs bind the complete causal envelope, not only stage/source/tick.
{
  const fabric=new CognitiveEventFabric(128);
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
