import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const fabric = new CognitiveEventFabric(16);
const initial = fabric.snapshot();

// Malformed root payloads must be rejected before the event ledger mutates.
for (const payload of [null, [], 'not-an-object', 42, true, new Date(0), new (class PayloadClass { value = 1; })()]) {
  assert.throws(
    () => fabric.append({ id: 'event:malformed-root', tick: 1, stage: 'observation', source: 'test', payload }),
    /invalid-cognitive-event-payload/,
  );
  assert.equal(fabric.snapshot().total, initial.total, 'invalid root payload must not mutate total');
  assert.equal(fabric.getById('event:malformed-root'), null, 'invalid root payload must not create an event');
}

const valid = fabric.append({
  id: 'event:stable-payload', tick: 2, stage: 'observation', source: 'test', payload: { value: 1 },
});
const afterValid = fabric.snapshot();
assert.equal(afterValid.total, 1);
assert.deepEqual(valid.payload, { value: 1 });

// An invalid retry may not be normalized to {} and confused with a valid event.
assert.throws(
  () => fabric.append({ id: 'event:stable-payload', tick: 2, stage: 'observation', source: 'test', payload: [] }),
  /invalid-cognitive-event-payload/,
);
assert.equal(fabric.snapshot().total, afterValid.total, 'invalid retry must leave total unchanged');
assert.deepEqual(fabric.getById('event:stable-payload')?.payload, { value: 1 });

// Omitted payload remains a supported empty payload for backward compatibility.
const omitted = fabric.append({ id: 'event:omitted-payload', tick: 3, stage: 'observation', source: 'test' });
assert.deepEqual(omitted.payload, {});
console.log('Cognitive event payload envelope: PASS');
