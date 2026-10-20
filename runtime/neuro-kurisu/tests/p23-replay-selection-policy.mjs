import assert from 'node:assert/strict';
import { selectReplayBatch } from '../src/organism/learning/ReplaySelectionPolicy.ts';

const make = (id, tick, contextKey, action='respond', surprise=0) => ({ id, tick, contextKey, action, surprise });
const input = Array.from({ length: 160 }, (_, i) => make(
  `trace-${i}`, i, `context-${Math.floor(i / 4) % 12}`, ['respond','verify','explore'][i % 3],
  i >= 128 ? ((i * 7) % 11) / 10 : ((i * 3) % 7) / 10,
));

for (const recentQuota of [0, 1, 16, 32, 48, 63, 64, 99]) {
  const batch = selectReplayBatch(input, { maxBatchSize: 64, recentQuota });
  assert.equal(batch.length, 64, `bounded result at recentQuota=${recentQuota}`);
  assert.equal(new Set(batch.map(x => x.id)).size, batch.length, 'selection must deduplicate trace IDs');
  assert.deepEqual(batch, [...batch].sort((a,b) => a.tick-b.tick || a.id.localeCompare(b.id)), 'output must be chronological and deterministic');
}
const balanced = selectReplayBatch(input, { maxBatchSize: 64, recentQuota: 32 });
assert.equal(balanced.filter(x => x.tick >= 128).length, 32, 'recent quota is guaranteed');
assert.ok(balanced.some(x => x.tick < 32), 'oldest history remains eligible when strata/surprise warrant it');
assert.ok(new Set(balanced.map(x => `${x.contextKey}|${x.action}`)).size >= 12, 'context/action diversity survives consolidation');
assert.deepEqual(selectReplayBatch(input, { maxBatchSize: 64, recentQuota: 32 }), balanced, 'same input/config yields same replay batch');

// Duplicate IDs must never consume capacity twice; the first chronological instance wins.
const duplicated = [...input, make('trace-159', 999, 'forged-later-copy', 'rest', 1)];
const deduplicated = selectReplayBatch(duplicated, { maxBatchSize: 64, recentQuota: 32 });
assert.equal(deduplicated.filter(x => x.id === 'trace-159').length, 1);
assert.equal(deduplicated.find(x => x.id === 'trace-159').tick, 159);
assert.deepEqual(selectReplayBatch(input.slice(0, 10), { maxBatchSize: 64, recentQuota: 32 }), input.slice(0, 10), 'small batches are returned whole in chronological order');
assert.equal(selectReplayBatch(input, { maxBatchSize: 0, recentQuota: 0 }).length, 1, 'capacity is clamped to a positive bounded value');
console.log('P23_REPLAY_SELECTION_POLICY=PASS');
