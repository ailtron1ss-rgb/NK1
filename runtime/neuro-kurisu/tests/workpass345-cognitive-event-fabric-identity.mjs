import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const makeEvent = (overrides = {}) => ({
  id: 'cef:test:identity:1',
  tick: 7,
  at: 700,
  stage: 'observation',
  source: 'workpass345-test',
  parentIds: ['parent:1'],
  external: false,
  confidence01: 0.5,
  payload: { a: 1, nested: { value: 2 } },
  ...overrides,
});

const fabric = new CognitiveEventFabric(128);
const callerPayload = { a: 1, nested: { value: 2 } };
const created = fabric.append(makeEvent({ payload: callerPayload }));
assert.equal(fabric.snapshot().total, 1);

// Caller mutation and returned-node mutation must not rewrite stored evidence.
callerPayload.nested.value = 90;
created.payload.nested.value = 91;
assert.equal(fabric.snapshot().recent[0].payload.nested.value, 2);

// Equivalent JSON objects with different key insertion order are the same event.
const reordered = fabric.append(makeEvent({
  payload: { nested: { value: 2 }, a: 1 },
}));
assert.equal(reordered.id, created.id);
assert.equal(fabric.snapshot().total, 1);

// Missing arrival time on a retry reuses the original timestamp.
const timestampOmitted = fabric.append(makeEvent({ at: undefined }));
assert.equal(timestampOmitted.at, 700);
assert.equal(fabric.snapshot().total, 1);

// Every identity-defining envelope field must conflict before ledger mutation.
const conflicts = [
  ['tick', { tick: 8 }],
  ['at', { at: 701 }],
  ['stage', { stage: 'plan' }],
  ['source', { source: 'different-source' }],
  ['parents', { parentIds: ['parent:2'] }],
  ['external', { external: true }],
  ['confidence', { confidence01: 0.9 }],
  ['payload', { payload: { a: 1, nested: { value: 99 } } }],
];
for (const [field, change] of conflicts) {
  assert.throws(
    () => fabric.append(makeEvent(change)),
    /cognitive-event-id-conflict/,
    `changed ${field} must not be accepted as an idempotent replay`,
  );
  assert.equal(fabric.snapshot().total, 1, `changed ${field} must not mutate ledger total`);
}

// Accessor-backed top-level values are omitted without executing the getter.
let getterCalls = 0;
const accessorPayload = { safe: 'kept' };
Object.defineProperty(accessorPayload, 'secret', {
  enumerable: true,
  get() {
    getterCalls += 1;
    return 'must-not-be-read';
  },
});
const accessorNode = fabric.append(makeEvent({
  id: 'cef:test:identity:accessor',
  payload: accessorPayload,
}));
assert.equal(getterCalls, 0);
assert.equal(Object.hasOwn(accessorNode.payload, 'secret'), false);
assert.equal(accessorNode.payload.safe, 'kept');

// Unserializable/cyclic payloads must fail before the event is inserted.
const beforeInvalidPayload = fabric.snapshot().total;
const cyclic = {};
cyclic.self = cyclic;
assert.throws(() => fabric.append(makeEvent({
  id: 'cef:test:identity:cyclic',
  payload: cyclic,
})));
assert.equal(fabric.snapshot().total, beforeInvalidPayload);
assert.equal(fabric.snapshot().recent.some(event => event.id === 'cef:test:identity:cyclic'), false);


 // Event identity must cover the normalized causal envelope and reject invalid clocks.
 assert.equal(new CognitiveEventFabric(Number.NaN).snapshot().capacity,512);
 assert.equal(new CognitiveEventFabric(Number.POSITIVE_INFINITY).snapshot().capacity,512);
 const invalidClocks=[
   {id:'cef:test:bad-tick-nan',tick:Number.NaN,at:701,error:/invalid-cognitive-event-tick/},
   {id:'cef:test:bad-tick-negative',tick:-1,at:701,error:/invalid-cognitive-event-tick/},
   {id:'cef:test:bad-tick-fractional',tick:7.5,at:701,error:/invalid-cognitive-event-tick/},
   {id:'cef:test:bad-tick-unsafe',tick:Number.MAX_SAFE_INTEGER+1,at:701,error:/invalid-cognitive-event-tick/},
   {id:'cef:test:bad-at-nan',tick:7,at:Number.NaN,error:/invalid-cognitive-event-timestamp/},
   {id:'cef:test:bad-at-infinity',tick:7,at:Number.POSITIVE_INFINITY,error:/invalid-cognitive-event-timestamp/},
   {id:'cef:test:bad-at-negative',tick:7,at:-1,error:/invalid-cognitive-event-timestamp/},
 ];
 const beforeBadClocks=fabric.snapshot().total;
 for(const bad of invalidClocks){
   assert.throws(()=>fabric.append(makeEvent({id:bad.id,tick:bad.tick,at:bad.at})),bad.error);
   assert.equal(fabric.snapshot().total,beforeBadClocks);
 }
 const arrayGetter=[];
 Object.defineProperty(arrayGetter,'0',{enumerable:true,configurable:true,get(){throw new Error('array getter must not run');}});
 arrayGetter.length=1;
 const safeArray=fabric.append(makeEvent({id:'cef:test:array-accessor',payload:{items:arrayGetter}}));
 assert.deepEqual(safeArray.payload.items,[null]);

 // Confirm a restored event with a malformed payload does not discard healthy rows.
 const restoreTarget=new CognitiveEventFabric(128);
 const validRestoreEvent={...makeEvent({id:'cef:test:restore-valid'}),payload:{safe:true}};
 const malformedPayload={}; malformedPayload.self=malformedPayload;
 restoreTarget.restore({
   version:1,capacity:128,total:2,buffered:2,linkedParentEvents:0,danglingParentLinks:0,
   lineageIntegrity01:1,cycleCoverage01:0,causalDensity01:0,recentTicks:0,
   recent:[
     {...validRestoreEvent,at:700},
     {...makeEvent({id:'cef:test:restore-invalid',payload:{}}),payload:malformedPayload,at:701},
   ],
 });
 assert.equal(restoreTarget.getById('cef:test:restore-valid')?.payload.safe,true);
 assert.equal(restoreTarget.getById('cef:test:restore-invalid'),null);

 // Receipt replay must preserve exact postcondition hashes after restore without its index.
 const receiptFabric=new CognitiveEventFabric(128);
 const receiptInput={
   tick:12,executionId:'receipt-execution-12',toolId:'filesystem.write',decisionId:'decision-12',
   ok:true,verified:true,outcomeClass:'success',confidence01:0.9,verificationBasis:'external-postcondition',
   externalObservation:true,observationId:'observation-12',
   expectedPostcondition:'report.json exists and has expected digest',
   observedPostcondition:'report.json exists and digest matches',
   observationIntegrated:true,at:1200,
 };
 const firstReceipt=receiptFabric.appendToolReceiptTrace(receiptInput);
 assert.equal(firstReceipt.replayed,false);
 const receiptSnapshot=receiptFabric.snapshot();
 const evidenceEvent=receiptSnapshot.recent.find(event=>event.id===firstReceipt.evidenceEventId);
 assert.ok(evidenceEvent);
 assert.equal(evidenceEvent.payload.expectedPostconditionHash?.length,64);
 assert.equal(evidenceEvent.payload.observedPostconditionHash?.length,64);
 assert.equal(JSON.stringify(evidenceEvent.payload).includes(receiptInput.expectedPostcondition),false);
 const indexless=new CognitiveEventFabric(128);
 indexless.restore({...receiptSnapshot,receiptProjectionIndex:[]});
 const beforeReceiptConflict=indexless.snapshot().total;
 assert.throws(()=>indexless.appendToolReceiptTrace({
   ...receiptInput,expectedPostcondition:'Report.json exists and has expected digest',
 }),/tool-receipt-execution-id-conflict/,'case-sensitive postcondition changes must not collapse into the same receipt fingerprint');
 assert.equal(indexless.snapshot().total,beforeReceiptConflict);
 assert.throws(()=>indexless.appendToolReceiptTrace({
   ...receiptInput,expectedPostcondition:'a different expected state that is still nonempty',
 }),/tool-receipt-execution-id-conflict/);
 assert.equal(indexless.snapshot().total,beforeReceiptConflict);
 assert.equal(indexless.appendToolReceiptTrace(receiptInput).replayed,true);
 assert.equal(indexless.snapshot().total,beforeReceiptConflict);

 // Upgrade compatibility: an older persisted receipt without event-level hashes
 // may replay only when its retained index proves the complete original input hash.
 const legacyReceiptSnapshot={
   ...receiptSnapshot,
   recent:receiptSnapshot.recent.map(event=>{
     if(event.id!==firstReceipt.evidenceEventId)return event;
     const payload={...event.payload};
     delete payload.expectedPostconditionHash;
     delete payload.observedPostconditionHash;
     return {...event,payload};
   }),
 };
 const legacyReceiptFabric=new CognitiveEventFabric(128);
 legacyReceiptFabric.restore(legacyReceiptSnapshot);
 const legacyTotal=legacyReceiptFabric.snapshot().total;
 assert.equal(legacyReceiptFabric.appendToolReceiptTrace(receiptInput).replayed,true,
   'legacy exact replay remains valid when the persisted projection hash verifies the complete input');
 assert.equal(legacyReceiptFabric.snapshot().total,legacyTotal);

console.log('WorkPass345 CognitiveEventFabric identity: PASS');
