import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const fabric = new CognitiveEventFabric(128);
const first = fabric.append({
  id: 'order:1', tick: 4, at: 2_000, stage: 'observation', source: 'clock-fixture',
});
const second = fabric.append({
  id: 'order:2', tick: 4, at: 1_000, stage: 'prediction', source: 'clock-fixture',
  parentIds: [first.id],
});
const third = fabric.append({
  id: 'order:3', tick: 4, at: 1_000, stage: 'appraisal', source: 'clock-fixture',
  parentIds: [first.id],
});

assert.equal(first.sequence, 1, 'the first local CEF event starts at sequence one');
assert.equal(second.sequence, 2, 'sequence must advance even when wall clock moves backwards');
assert.equal(third.sequence, 3, 'same-time events still receive a unique total order');
assert.equal(first.logicalTime, 1);
assert.equal(second.logicalTime, 2, 'child logical time must advance beyond its parent');
assert.equal(third.logicalTime, 3, 'the local Lamport clock must advance beyond the current clock');
assert.ok(second.at < first.at, 'the fixture must exercise a wall-clock rollback');

const replay = fabric.append({
  id: 'order:2', tick: 4, at: 9_999, stage: 'prediction', source: 'clock-fixture',
  parentIds: [first.id],
});
assert.equal(replay.sequence, second.sequence, 'idempotent event replay must preserve its original sequence');
assert.equal(replay.logicalTime, second.logicalTime, 'idempotent event replay must preserve its original logical time');
assert.equal(fabric.snapshot().total, 3, 'replaying an existing event must not advance the event count');

const snapshot = fabric.snapshot();
assert.equal(snapshot.sequenceWatermark, 3);
assert.equal(snapshot.logicalClock, 3);
const restored = new CognitiveEventFabric(128);
restored.restore(snapshot);
const fourth = restored.append({
  id: 'order:4', tick: 5, at: 3, stage: 'attention', source: 'after-restart',
  parentIds: [first.id],
});
assert.equal(fourth.sequence, 4, 'sequence must remain monotonic after snapshot restore');
assert.equal(fourth.logicalTime, 4, 'logical time must remain monotonic after snapshot restore');

const legacy = structuredClone(snapshot);
delete legacy.sequenceWatermark;
delete legacy.logicalClock;
for (const event of legacy.recent) {
  delete event.sequence;
  delete event.logicalTime;
}
for (const event of legacy.receiptEvents ?? []) {
  delete event.sequence;
  delete event.logicalTime;
}
const legacyRestored = new CognitiveEventFabric(128);
legacyRestored.restore(legacy);
const legacyEvents = legacyRestored.recent(128);
const legacySequences = legacyEvents.map(event => event.sequence);
assert.ok(legacySequences.every(Number.isSafeInteger), 'legacy snapshots must be upgraded to explicit event sequence values');
assert.equal(new Set(legacySequences).size, legacySequences.length, 'legacy event sequence migration must be unique');
const afterLegacy = legacyRestored.append({
  id: 'order:legacy-next', tick: 6, at: 0, stage: 'attention', source: 'legacy-after-restart',
});
assert.ok(afterLegacy.sequence > Math.max(...legacySequences),
  'new events after legacy restore must sort after every restored event');
assert.ok(afterLegacy.logicalTime > Math.max(...legacyEvents.map(event => event.logicalTime)),
  'legacy migration must seed the logical clock above restored events');

const duplicateSequence = structuredClone(snapshot);
duplicateSequence.recent[1].sequence = duplicateSequence.recent[0].sequence;
const duplicateSafe = new CognitiveEventFabric(128);
duplicateSafe.restore(duplicateSequence);
assert.equal(duplicateSafe.recent(128).length, 2,
  'a duplicate-sequence restore row must be rejected instead of creating ambiguous order');

console.log('WORKPASS642_CEF_LOGICAL_ORDER=PASS');
