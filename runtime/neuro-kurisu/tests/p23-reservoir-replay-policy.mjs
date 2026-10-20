import assert from 'node:assert/strict';
import { selectReservoirBatch } from '../src/organism/learning/ReservoirReplayPolicy.ts';

const make = (id, tick, contextKey = 'ctx', action = 'respond', surprise = 0) => ({ id, tick, contextKey, action, surprise });
const input = Array.from({ length: 1000 }, (_, i) => make(`trace-${i}`, i, `ctx-${i % 9}`, ['respond', 'verify', 'explore'][i % 3], (i % 11) / 10));

for (const capacity of [0, 1, 16, 64, 512, 900]) {
  const batch = selectReservoirBatch(input, { capacity, seed: 42 });
  assert.equal(batch.length, Math.min(512, capacity, input.length));
  assert.equal(new Set(batch.map(x => x.id)).size, batch.length);
  assert.deepEqual(batch, [...batch].sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id)));
}
const a = selectReservoirBatch(input, { capacity: 64, seed: 42 });
assert.deepEqual(selectReservoirBatch(input, { capacity: 64, seed: 42 }), a, 'same seed must reproduce exact sample');
assert.notDeepEqual(selectReservoirBatch(input, { capacity: 64, seed: 43 }).map(x => x.id), a.map(x => x.id), 'different seeds should normally produce different samples');
assert.deepEqual(selectReservoirBatch(input, { capacity: 64, seed: 42 }), a, 'sampling must not mutate input');
assert.equal(selectReservoirBatch(input, { capacity: 64, seed: 42 }).length, 64);

const dupes = [make('a', 1), make('b', 2), make('a', 3, 'forged'), make('c', 4)];
const unique = selectReservoirBatch(dupes, { capacity: 10, seed: 7 });
assert.equal(unique.length, 3, 'duplicate IDs must not overweight an experience');
assert.equal(unique.find(x => x.id === 'a').tick, 1, 'first occurrence wins');
assert.deepEqual(selectReservoirBatch(input, { capacity: 64, seed: 42.9 }), selectReservoirBatch(input, { capacity: 64, seed: 42 }), 'seed normalization is stable');
assert.deepEqual(selectReservoirBatch(input, { capacity: 64, seed: NaN }), selectReservoirBatch(input, { capacity: 64, seed: 1 }), 'non-finite seed falls back deterministically');

 // Statistical sanity check across independent seeds: Algorithm R should not
 // systematically favor early or late stream positions. This is a guardrail,
 // not a proof of uniformity or a task-learning result.
const frequencyRuns = 400;
const frequencyCapacity = 10;
const frequencyInput = Array.from({ length: 100 }, (_, i) => make(`uniform-${i}`, i));
const inclusionCounts = new Array(frequencyInput.length).fill(0);
for (let seed = 1; seed <= frequencyRuns; seed++) {
  for (const item of selectReservoirBatch(frequencyInput, { capacity: frequencyCapacity, seed })) {
    inclusionCounts[Number(item.id.slice('uniform-'.length))] += 1;
  }
}
const expectedInclusions = frequencyRuns * frequencyCapacity / frequencyInput.length;
const maxDeviation = Math.max(...inclusionCounts.map(count => Math.abs(count - expectedInclusions)));
assert.ok(maxDeviation < expectedInclusions * 0.45,
  `reservoir inclusion frequencies should not show a large positional bias (max deviation ${maxDeviation})`);
assert.ok(inclusionCounts.slice(0, 20).reduce((sum, x) => sum + x, 0) > 0);
assert.ok(inclusionCounts.slice(-20).reduce((sum, x) => sum + x, 0) > 0);

console.log('P23_RESERVOIR_REPLAY_POLICY=PASS');
