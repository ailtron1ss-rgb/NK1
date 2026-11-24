import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const original = {
  tick: 42,
  nested: { value: 7, tags: ['a', 'b'] },
  optional: undefined,
  mapLike: new Map([['x', 3]]),
  setLike: new Set(['a', 'b']),
};

const store = new MemoryStateStore({ initial: original });
const initial = await store.load();
assert.ok(initial);
assert.equal(initial.tick, 42);
assert.equal(initial.optional, undefined);
assert.equal(initial.mapLike.get('x'), 3);
assert.deepEqual([...initial.setLike], ['a', 'b']);

initial.nested.value = 99;
const isolatedInitial = await store.load();
assert.ok(isolatedInitial);
assert.equal(isolatedInitial.nested.value, 7);

original.nested.value = 1000;
await store.save(original);
original.nested.value = 2000;
const saved = await store.load();
assert.ok(saved);
assert.equal(saved.nested.value, 1000);
saved.nested.value = 3000;
const isolatedSaved = await store.load();
assert.equal(isolatedSaved.nested.value, 1000);

const metrics = store.metrics();
assert.equal(metrics.saves, 1);
assert.ok(metrics.lastPayloadBytes > 0);
assert.ok(metrics.lastSaveMs >= 0);

console.log(JSON.stringify({
  pass: true,
  payloadBytes: metrics.lastPayloadBytes,
  saveMs: Number(metrics.lastSaveMs.toFixed(3)),
}));
