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
assert.ok(new Set(balanced.map(x => JSON.stringify([x.contextKey,x.action]))).size >= 12, 'context/action diversity survives consolidation');
assert.deepEqual(selectReplayBatch(input, { maxBatchSize: 64, recentQuota: 32 }), balanced, 'same input/config yields same replay batch');

// Duplicate IDs must never consume capacity twice; the first chronological instance wins.
const duplicated = [...input, make('trace-159', 999, 'forged-later-copy', 'rest', 1)];
const deduplicated = selectReplayBatch(duplicated, { maxBatchSize: 64, recentQuota: 32 });
assert.equal(deduplicated.filter(x => x.id === 'trace-159').length, 1);
assert.equal(deduplicated.find(x => x.id === 'trace-159').tick, 159);
assert.deepEqual(selectReplayBatch(input.slice(0, 10), { maxBatchSize: 64, recentQuota: 32 }), input.slice(0, 10), 'small batches are returned whole in chronological order');
assert.equal(selectReplayBatch(input, { maxBatchSize: 0, recentQuota: 0 }).length, 1, 'capacity is clamped to a positive bounded value');

// Collision regression: tuple keys keep these two strata distinct.
const collision = [
  make('c1', 1, 'alpha|beta', 'gamma', .4),
  make('c2', 2, 'alpha', 'beta|gamma', .3),
  ...Array.from({length: 8}, (_, i) => make(`f${i}`, i + 3, 'filler', 'respond', .1)),
];
const collisionBatch = selectReplayBatch(collision, { maxBatchSize: 4, recentQuota: 0 });
assert.ok(collisionBatch.some(x => x.id === 'c1') && collisionBatch.some(x => x.id === 'c2'), 'delimiter collisions must not merge distinct context/action strata');

// With an explicit finite half-life, historical surprise priority decays by age.
const temporal = [
  make('old-high', 0, 'same', 'verify', 1),
  make('new-medium', 90, 'same', 'verify', .6),
  ...Array.from({length: 8}, (_, i) => make(`other-${i}`, i + 1, `other-${i}`, 'respond', .05)),
];
const noDecay = selectReplayBatch(temporal, { maxBatchSize: 3, recentQuota: 0 });
const withDecay = selectReplayBatch(temporal, { maxBatchSize: 3, recentQuota: 0, ageHalfLifeTicks: 10 });
assert.ok(noDecay.some(x => x.id === 'old-high'), 'default preserves surprise-only ranking');
assert.ok(withDecay.some(x => x.id === 'new-medium'), 'finite half-life allows recent moderate-surprise evidence to outrank stale high surprise');
assert.deepEqual(selectReplayBatch(temporal, { maxBatchSize: 3, recentQuota: 0, ageHalfLifeTicks: 10 }), withDecay, 'age-discounted selection remains deterministic');
assert.deepEqual(selectReplayBatch(temporal, { maxBatchSize: 3, recentQuota: 0, ageHalfLifeTicks: 0 }), noDecay, 'invalid half-life falls back safely to legacy priority');


const salienceInput = [
  { id: 'high-surprise-stale', tick: 0, contextKey: 'x', action: 'repair', surprise: 1, salience: 0, novelty: 1, replayCount: 0 },
  { id: 'verified-failure', tick: 1, contextKey: 'y', action: 'repair', surprise: .1, salience: .9, novelty: 1, replayCount: 0 },
  { id: 'over-replayed', tick: 2, contextKey: 'z', action: 'repair', surprise: .1, salience: .9, novelty: 1, replayCount: 99 },
  ...Array.from({length: 4}, (_, i) => ({ id: `neutral-${i}`, tick: i + 3, contextKey: `n${i}`, action: 'respond', surprise: .01 })),
];
const salienceBatch = selectReplayBatch(salienceInput, { maxBatchSize: 2, recentQuota: 0 });
assert.ok(salienceBatch.some(x => x.id === 'verified-failure'), 'salient verified failures can outrank low-value routine traces');
assert.ok(!salienceBatch.some(x => x.id === 'over-replayed'), 'replay repetition applies diminishing returns');
const legacySignals = [make('legacy-a', 0, 'a', 'verify', 1), make('legacy-b', 1, 'b', 'verify', .6)];
assert.deepEqual(selectReplayBatch(legacySignals, { maxBatchSize: 2, recentQuota: 0 }), legacySignals,
  'callers without episodic fields retain legacy selection behavior');\n
const affectiveGoalSignals = [
  { id: 'routine', tick: 0, contextKey: 'routine', action: 'respond', surprise: .5, salience: .1, novelty: .5, replayCount: 0 },
  { id: 'high-stakes-failure', tick: 1, contextKey: 'safety', action: 'repair', surprise: .2, salience: .45, emotionalIntensity: 1, activationStrength: .9, goalPriority: 1, replayCount: 0 },
  ...Array.from({length: 5}, (_, i) => ({ id: `filler-affect-${i}`, tick: i + 2, contextKey: `filler-${i}`, action: 'respond', surprise: .05 })),
];
const affectiveBatch = selectReplayBatch(affectiveGoalSignals, { maxBatchSize: 2, recentQuota: 0 });
assert.ok(affectiveBatch.some(x => x.id === 'high-stakes-failure'),
  'affective intensity, activation and goal priority influence replay ranking');
assert.ok(!affectiveBatch.some(x => x.id === 'routine'),
  'routine traces do not displace a higher-salience goal-linked failure');


console.log('P23_REPLAY_SELECTION_POLICY=PASS');
