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

console.log('WorkPass345 CognitiveEventFabric identity: PASS');
