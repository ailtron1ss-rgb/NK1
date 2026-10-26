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

// Aggregate UTF-16 text is bounded even when every individual string is modest.
// Exactly the configured limit is accepted: four key units plus 131,068 value units.
const boundary = fabric.append({
  tick: 4,
  stage: 'observation',
  source: 'payload-budget-test',
  payload: { text: 'x'.repeat(131068) },
});
assert.equal(boundary.payload.text.length, 131068);
const beforeOversized = fabric.snapshot();

assert.throws(() => fabric.append({
  tick: 5,
  stage: 'observation',
  source: 'payload-budget-test',
  payload: { text: 'x'.repeat(131069) },
}), /cognitive-event-payload-text-limit/);
assert.deepEqual(fabric.snapshot(), beforeOversized, 'single oversized text must not mutate the ledger');

const manyStrings = Object.fromEntries(
  Array.from({ length: 140 }, (_, index) => [`field-${index}`, 'y'.repeat(1000)]),
);
assert.throws(() => fabric.append({
  tick: 6,
  stage: 'observation',
  source: 'payload-budget-test',
  payload: manyStrings,
}), /cognitive-event-payload-text-limit/);
assert.deepEqual(fabric.snapshot(), beforeOversized, 'aggregate value overflow must not mutate the ledger');

const manyLongKeys = Object.fromEntries(
  Array.from({ length: 270 }, (_, index) => [`k`.repeat(500) + String(index), 0]),
);
assert.throws(() => fabric.append({
  tick: 7,
  stage: 'observation',
  source: 'payload-budget-test',
  payload: manyLongKeys,
}), /cognitive-event-payload-text-limit/);
assert.deepEqual(fabric.snapshot(), beforeOversized, 'aggregate key overflow must not mutate the ledger');

const restoreFabric = new CognitiveEventFabric(16);
restoreFabric.restore({ recent: [{
  id: 'event:oversized-payload', tick: 1, at: 1, stage: 'observation', source: 'payload-budget-test',
  parentIds: [], external: false, confidence01: 0.5, payload: manyStrings,
}] });
assert.equal(restoreFabric.snapshot().buffered, 0, 'oversized restored payload must be skipped');
console.log('Cognitive event payload envelope: PASS');
