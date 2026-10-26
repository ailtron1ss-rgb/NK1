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

const nestedAccessor={safe:'nested-kept'};
Object.defineProperty(nestedAccessor,'secret',{enumerable:true,get(){
  getterCalls+=1;
  throw new Error('nested getter must never execute');
}});
const nestedAccessorNode=fabric.append(makeEvent({
  id:'cef:test:identity:nested-accessor',
  payload:{nested:nestedAccessor},
}));
assert.equal(getterCalls,0);
assert.equal(nestedAccessorNode.payload.nested.secret,undefined);

const beforeDeepPayload=fabric.snapshot().total;
const deepPayload={};
let deepCursor=deepPayload;
for(let i=0;i<40;i+=1){deepCursor.next={};deepCursor=deepCursor.next;}
assert.throws(()=>fabric.append(makeEvent({
  id:'cef:test:identity:too-deep',
  payload:deepPayload,
})),/cognitive-event-payload-depth-limit/);
assert.equal(fabric.snapshot().total,beforeDeepPayload,'oversized-depth payloads fail before ledger mutation');

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

// Identity and source values must be canonical at write time, so trim-based aliases
// cannot be accepted as replays and cannot disappear after a restart.
const beforeNonCanonical=fabric.snapshot().total;
assert.throws(
  ()=>fabric.append(makeEvent({id:' cef:test:identity:padded-id',source:'identity-test'})),
  /invalid-cognitive-event-id/,
);
assert.throws(
  ()=>fabric.append(makeEvent({id:'cef:test:identity:control-source',source:'bad\nsource'})),
  /invalid-cognitive-event-source/,
);
assert.throws(
  ()=>fabric.append(makeEvent({id:'cef:test:identity:empty-source',source:''})),
  /invalid-cognitive-event-source/,
);
assert.throws(
  ()=>fabric.append(makeEvent({id:'cef:test:identity:padded-source',source:' padded-source '})),
  /invalid-cognitive-event-source/,
);
assert.throws(
  ()=>fabric.append(makeEvent({id:'cef:test:identity:padded-parent',parentIds:[' parent:1']})),
  /invalid-cognitive-event-parent-id/,
);
assert.equal(fabric.snapshot().total,beforeNonCanonical,'non-canonical identity fields must fail before ledger mutation');

// Causal parent arrays must be dense data arrays; holes/accessors cannot create
// undefined parent references or execute caller code during normalization.
let parentGetterCalls=0;
const accessorParents=[];
Object.defineProperty(accessorParents,'0',{enumerable:true,configurable:true,get(){parentGetterCalls+=1;throw new Error('parent getter must not run');}});
accessorParents.length=1;
const beforeAccessorParents=fabric.snapshot().total;
assert.throws(
  ()=>fabric.append(makeEvent({id:'cef:test:identity:parent-accessor',parentIds:accessorParents})),
  /invalid-cognitive-event-parent-id/,
);
assert.equal(parentGetterCalls,0);
assert.equal(fabric.snapshot().total,beforeAccessorParents);

const sparseParents=Array(1);
assert.throws(
  ()=>fabric.append(makeEvent({id:'cef:test:identity:parent-hole',parentIds:sparseParents})),
  /invalid-cognitive-event-parent-id/,
);
assert.equal(fabric.snapshot().total,beforeAccessorParents);

// Identity-bearing source and parent fields reject overflow instead of aliasing.
const boundedSource='s'.repeat(120);
const boundedSourceEvent=fabric.append(makeEvent({
  id:'cef:test:identity:source-boundary',
  source:boundedSource,
}));
const afterBoundedSource=fabric.snapshot().total;
assert.equal(boundedSourceEvent.source.length,120);
assert.throws(
  ()=>fabric.append(makeEvent({id:boundedSourceEvent.id,source:boundedSource+'different-suffix'})),
  /invalid-cognitive-event-source/,
  'oversized source must be rejected instead of truncated into a matching replay',
);
assert.equal(fabric.snapshot().total,afterBoundedSource);

const boundedParent='p'.repeat(180);
const boundedParentEvent=fabric.append(makeEvent({
  id:'cef:test:identity:parent-boundary',
  parentIds:[boundedParent],
}));
const afterBoundedParent=fabric.snapshot().total;
assert.equal(boundedParentEvent.parentIds[0].length,180);
assert.throws(
  ()=>fabric.append(makeEvent({id:boundedParentEvent.id,parentIds:[boundedParent+'different-suffix']})),
  /invalid-cognitive-event-parent-id/,
  'oversized parent IDs must be rejected instead of truncated into a matching replay',
);
assert.equal(fabric.snapshot().total,afterBoundedParent);

const beforeTooManyParents=fabric.snapshot().total;
assert.throws(
  ()=>fabric.append(makeEvent({
    id:'cef:test:identity:too-many-parents',
    parentIds:Array.from({length:13},(_,index)=>`parent:${index}`),
  })),
  /invalid-cognitive-event-parent-count/,
);
assert.equal(fabric.snapshot().total,beforeTooManyParents,'parent-count overflow must not mutate the ledger');

const acceptedMaximumParents=fabric.append(makeEvent({
  id:'cef:test:identity:max-parents',
  parentIds:Array.from({length:12},(_,index)=>`parent:${index}`),
}));
assert.equal(acceptedMaximumParents.parentIds.length,12);

// Restore must skip malformed long IDs/lineage instead of truncating them to alias a later valid row.
const restoreBounds=new CognitiveEventFabric(128);
const boundedRestoreId='cef:test:restore:bounded-id';
const validAfterBadId={...makeEvent({id:boundedRestoreId}),payload:{recovered:'id'}};
const validAfterBadParent={...makeEvent({id:'cef:test:restore:bounded-parent'}),payload:{recovered:'parent'},parentIds:['parent:valid']};
const validAfterBadSource={...makeEvent({id:'cef:test:restore:bounded-source'}),payload:{recovered:'source'},source:'valid-source'};
restoreBounds.restore({
  version:1,capacity:128,total:5,buffered:5,linkedParentEvents:0,danglingParentLinks:0,
  lineageIntegrity01:1,cycleCoverage01:0,causalDensity01:0,recentTicks:0,
  recent:[
    {...validAfterBadId,id:boundedRestoreId+'x'.repeat(181)},
    validAfterBadId,
    {...validAfterBadParent,parentIds:['p'.repeat(181)]},
    validAfterBadParent,
    {...validAfterBadSource,source:'s'.repeat(121)},
    validAfterBadSource,
  ],
});
assert.equal(restoreBounds.getById(boundedRestoreId)?.payload.recovered,'id');
assert.equal(restoreBounds.getById('cef:test:restore:bounded-parent')?.payload.recovered,'parent');
assert.equal(restoreBounds.getById('cef:test:restore:bounded-source')?.payload.recovered,'source');

const nonCanonicalRestore=new CognitiveEventFabric(128);
const canonicalId='cef:test:restore:canonical-id';
const canonicalParentId='cef:test:restore:canonical-parent';
const canonicalSourceId='cef:test:restore:canonical-source';
const canonicalRows=[
  {...makeEvent({id:` ${canonicalId}`}),payload:{recovered:false}},
  {...makeEvent({id:canonicalId}),payload:{recovered:true}},
  {...makeEvent({id:canonicalParentId,parentIds:[' parent:1']}),payload:{recovered:false}},
  {...makeEvent({id:canonicalParentId,parentIds:['parent:1']}),payload:{recovered:true}},
  {...makeEvent({id:canonicalSourceId,source:'bad\nsource'}),payload:{recovered:false}},
  {...makeEvent({id:canonicalSourceId,source:'source-valid'}),payload:{recovered:true}},
  {...makeEvent({id:'cef:test:restore:empty-source',source:''}),payload:{recovered:false}},
  {...makeEvent({id:'cef:test:restore:empty-source',source:'source-valid'}),payload:{recovered:true}},
  {...makeEvent({id:'cef:test:restore:padded-source',source:' padded-source '}),payload:{recovered:false}},
  {...makeEvent({id:'cef:test:restore:padded-source',source:'source-valid'}),payload:{recovered:true}},
];
nonCanonicalRestore.restore({
  version:1,capacity:128,total:canonicalRows.length,buffered:canonicalRows.length,
  linkedParentEvents:0,danglingParentLinks:0,lineageIntegrity01:1,cycleCoverage01:0,
  causalDensity01:0,recentTicks:0,recent:canonicalRows,
});
assert.equal(nonCanonicalRestore.getById(canonicalId)?.payload.recovered,true);
assert.equal(nonCanonicalRestore.getById(canonicalParentId)?.payload.recovered,true);
assert.equal(nonCanonicalRestore.getById(canonicalSourceId)?.payload.recovered,true);
assert.equal(nonCanonicalRestore.getById('cef:test:restore:empty-source')?.payload.recovered,true);
assert.equal(nonCanonicalRestore.getById('cef:test:restore:padded-source')?.payload.recovered,true);

// Snapshot restore also ignores holes/accessors in the parent list without executing
// caller code or reserving the event ID before a later valid recovery row.
const restoreParentGetter=[];
let restoreParentGetterCalls=0;
Object.defineProperty(restoreParentGetter,'0',{enumerable:true,configurable:true,get(){restoreParentGetterCalls+=1;throw new Error('restore parent getter must not run');}});
restoreParentGetter.length=1;
const restoreParentAccessorId='cef:test:restore:parent-accessor';
const restoreSparseId='cef:test:restore:parent-hole';
const restoreAccessorFabric=new CognitiveEventFabric(128);
restoreAccessorFabric.restore({
  version:1,capacity:128,total:4,buffered:4,linkedParentEvents:0,danglingParentLinks:0,
  lineageIntegrity01:1,cycleCoverage01:0,causalDensity01:0,recentTicks:0,
  recent:[
    {...makeEvent({id:restoreParentAccessorId,parentIds:restoreParentGetter}),payload:{recovered:false}},
    {...makeEvent({id:restoreParentAccessorId,parentIds:['parent:valid']}),payload:{recovered:true}},
    {...makeEvent({id:restoreSparseId,parentIds:Array(1)}),payload:{recovered:false}},
    {...makeEvent({id:restoreSparseId,parentIds:['parent:valid']}),payload:{recovered:true}},
  ],
});
assert.equal(restoreParentGetterCalls,0);
assert.equal(restoreAccessorFabric.getById(restoreParentAccessorId)?.payload.recovered,true);
assert.equal(restoreAccessorFabric.getById(restoreSparseId)?.payload.recovered,true);

// Restore must skip malformed clock/evidence types instead of flooring/coercing them.
// Invalid rows must not reserve their IDs, so a following valid copy can be recovered.
const strictRestore=new CognitiveEventFabric(128);
const restorePairs=[
  {id:'cef:test:restore:fractional-tick',bad:{tick:7.5},good:{tick:7}},
  {id:'cef:test:restore:unsafe-tick',bad:{tick:Number.MAX_SAFE_INTEGER+1},good:{tick:7}},
  {id:'cef:test:restore:string-at',bad:{at:'700'},good:{at:700}},
  {id:'cef:test:restore:string-confidence',bad:{confidence01:'0.9'},good:{confidence01:0.9}},
  {id:'cef:test:restore:nonboolean-external',bad:{external:'false'},good:{external:false}},
  {id:'cef:test:restore:oversized-source',bad:{source:'s'.repeat(121)},good:{source:'source-valid'}},
];
const strictRestoreRows=[];
for(const pair of restorePairs){
  strictRestoreRows.push(makeEvent({id:pair.id,...pair.bad}));
  strictRestoreRows.push(makeEvent({id:pair.id,...pair.good}));
}
strictRestore.restore({
  version:1,capacity:128,total:strictRestoreRows.length,buffered:strictRestoreRows.length,
  linkedParentEvents:0,danglingParentLinks:0,lineageIntegrity01:1,cycleCoverage01:0,
  causalDensity01:0,recentTicks:0,recent:strictRestoreRows,
});
for(const pair of restorePairs){
  assert.ok(strictRestore.getById(pair.id),`valid row must recover after malformed row: ${pair.id}`);
}
assert.equal(strictRestore.getById('cef:test:restore:fractional-tick')?.tick,7);
assert.equal(strictRestore.getById('cef:test:restore:string-at')?.at,700);
assert.equal(strictRestore.getById('cef:test:restore:string-confidence')?.confidence01,0.9);
assert.equal(strictRestore.getById('cef:test:restore:nonboolean-external')?.external,false);
assert.equal(strictRestore.getById('cef:test:restore:oversized-source')?.source,'source-valid');


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
     {...validRestoreEvent,payload:malformedPayload,at:701},
     {...validRestoreEvent,at:702},
   ],
 });
 assert.equal(restoreTarget.getById('cef:test:restore-valid')?.payload.safe,true,
   'a malformed row must not reserve an ID and prevent a later valid recovery row');

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
 const receiptActionEvent=receiptSnapshot.recent.find(event=>event.id===firstReceipt.actionEventId);
 assert.ok(receiptActionEvent);
 assert.equal(receiptActionEvent.payload.decisionId,null,'an unresolved decision must not be forged into a causal parent');
 assert.equal(receiptActionEvent.payload.requestedDecisionId,'decision-12','preserve the supplied decision identity for exact replay');
 assert.equal(receiptActionEvent.payload.decisionLinked,false);
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
 assert.throws(()=>indexless.appendToolReceiptTrace({...receiptInput,decisionId:'decision-other'}),/tool-receipt-execution-id-conflict/,'an unlinked decision ID is still part of the supplied receipt identity');
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
