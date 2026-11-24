import assert from 'node:assert/strict';
import { RuntimeEvidenceBus } from '../src/organism/system/RuntimeEvidenceBus.ts';

// Stable IDs across equivalent event sequences; no random suffixes.
const left = new RuntimeEvidenceBus(128);
const right = new RuntimeEvidenceBus(128);
const a = left.publish({ tick: 4, at: 40, kind: 'observation', source: '  sensor  ', external01: true, payload: { value: 1 } });
const b = right.publish({ tick: 4, at: 40, kind: 'observation', source: '  sensor  ', external01: true, payload: { value: 1 } });
assert.equal(a.id, b.id);
assert.equal(a.source, 'sensor');

// Event and payload references are detached from bus state.
const inputPayload = { nested: { count: 1 }, values: [1, 2] };
const action = left.publish({ tick: 5, kind: 'action', source: 'executor', parentIds: [a.id, a.id, ' ', 7], payload: inputPayload });
inputPayload.nested.count = 99;
a.payload.value = 99;
const readBack = left.recent(10);
const storedAction = readBack.find((event) => event.id === action.id);
assert.equal(storedAction.payload.nested.count, 1);
assert.equal(readBack.find((event) => event.id === a.id).payload.value, 1);
assert.deepEqual(storedAction.parentIds, [a.id]);

// Unbounded payloads are safely projected into a bounded, serializable value.
const huge = 'x'.repeat(20_000);
const deeplyNested = { one: { two: { three: { four: { five: 'too-deep' } } } } };
const large = left.publish({
  tick: 6, kind: 'outcome', source: 'provider', payload: {
    huge,
    deeplyNested,
    list: Array.from({ length: 100 }, (_, i) => i),
    unsupported: () => 'not serializable',
    nan: Number.NaN,
  },
});
assert.equal(large.payloadTruncated, true);
assert.ok(JSON.stringify(large.payload).length < 18_000);
assert.ok(!JSON.stringify(large.payload).includes('too-deep'));
assert.equal(large.payload.nan, null);
assert.equal(large.payload.unsupported, null);
let accessorExecuted = false;
const accessorPayload = {};
Object.defineProperty(accessorPayload, 'secret', { enumerable: true, get() { accessorExecuted = true; throw new Error('must not execute'); } });
const accessorEvent = left.publish({ tick: 6, kind: 'resource', source: 'fixture', payload: accessorPayload });
assert.equal(accessorExecuted, false);
assert.equal(accessorEvent.payloadTruncated, true);
assert.equal(Object.hasOwn(accessorEvent.payload, 'secret'), false);

// Reject malformed causal anchors rather than silently manufacturing evidence.
assert.throws(() => left.publish({ tick: Number.NaN, kind: 'action', source: 'x' }), /tick/);
assert.throws(() => left.publish({ tick: -1, kind: 'action', source: 'x' }), /tick/);
assert.throws(() => left.publish({ tick: 7, kind: 'not-a-kind', source: 'x' }), /kind/);

// Lifetime counters survive a snapshot with a smaller recent projection, while
// buffered metrics separately describe the actual retained window.
const many = new RuntimeEvidenceBus(128);
for (let i = 1; i <= 130; i += 1) {
  many.publish({ tick: i, at: i, kind: i % 2 ? 'observation' : 'prediction', source: 'fixture', external01: i % 3 === 0 });
}
const snapshot = many.snapshot();
assert.equal(snapshot.total, 130);
assert.equal(snapshot.recent.length, 48);
assert.equal(Object.values(snapshot.byKind).reduce((sum, n) => sum + n, 0), 130);
const restored = new RuntimeEvidenceBus(128);
restored.restore(snapshot);
const restoredMetrics = restored.metrics();
assert.equal(restoredMetrics.total, 130);
assert.equal(restoredMetrics.buffered, 48);
assert.equal(Object.values(restoredMetrics.byKind).reduce((sum, n) => sum + n, 0), 130);
assert.equal(Object.values(restoredMetrics.bufferedByKind).reduce((sum, n) => sum + n, 0), 48);
const next = restored.publish({ tick: 131, at: 131, kind: 'outcome', source: 'fixture' });
assert.equal(next.id, 'reb:131:131:outcome');
assert.ok(!restored.recent(256).some((event) => event.id === next.id && event.tick !== 131));

// Corrupt/legacy snapshots are normalized and duplicate IDs are not replayed twice.
const corrupt = new RuntimeEvidenceBus(128);
corrupt.restore({
  version: 2,
  total: -100,
  externalCount: 9000,
  byKind: { observation: 999 },
  recent: [
    { id: 'legacy-event-1', at: 1, tick: 1, kind: 'observation', source: 'old', confidence01: 2, external01: true, parentIds: ['x', 'x', ''], payload: { safe: true } },
    { id: 'legacy-event-1', at: 2, tick: 2, kind: 'action', source: 'duplicate', confidence01: 0.8, external01: false, parentIds: [], payload: {} },
    { id: 'bad-event', at: 3, tick: 3, kind: 'made-up', source: 'bad', confidence01: 0.5, external01: false, parentIds: [], payload: {} },
    null,
  ],
});
const repaired = corrupt.snapshot();
assert.equal(repaired.total, 1);
assert.equal(repaired.externalCount, 1);
assert.equal(repaired.byKind.observation, 1);
assert.equal(repaired.recent.length, 1);
assert.equal(repaired.recent[0].confidence01, 1);
assert.deepEqual(repaired.recent[0].parentIds, ['x']);

// Non-finite constructor capacity must not poison buffer slice/capacity math.
const EVIDENCE_KIND_FIXTURE = (i) => i % 3 === 0 ? 'observation' : i % 3 === 1 ? 'action' : 'outcome';
const invalidCapacity = new RuntimeEvidenceBus(Number.NaN);
assert.equal(invalidCapacity.metrics().capacity, 384);
invalidCapacity.publish({ tick: 1, kind: 'goal', source: 'test' });
assert.equal(invalidCapacity.metrics().buffered, 1);
const upperClamp = new RuntimeEvidenceBus(999_999);
assert.equal(upperClamp.metrics().capacity, 4096);
const lowerClamp = new RuntimeEvidenceBus(1);
assert.equal(lowerClamp.metrics().capacity, 128);

// Long runs keep bounded memory, monotonic identities and consistent lifetime stats.
const endurance = new RuntimeEvidenceBus(128);
const ids = new Set();
for (let i = 0; i < 5000; i += 1) {
  const event = endurance.publish({ tick: i, at: i, kind: EVIDENCE_KIND_FIXTURE(i), source: 'endurance', external01: i % 11 === 0, payload: { index: i } });
  assert.equal(ids.has(event.id), false);
  ids.add(event.id);
}
const enduranceMetrics = endurance.metrics();
assert.equal(enduranceMetrics.total, 5000);
assert.equal(enduranceMetrics.buffered, 128);
assert.equal(Object.values(enduranceMetrics.byKind).reduce((sum, n) => sum + n, 0), 5000);
assert.equal(Object.values(enduranceMetrics.bufferedByKind).reduce((sum, n) => sum + n, 0), 128);

console.log('BIG_PASS_128_RUNTIME_EVIDENCE_BUS_RELIABILITY=PASS stable-id payload-bounds restore-counters corrupt-state-normalization');
