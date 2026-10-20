import assert from 'node:assert/strict';
import { selectReplayBatch } from '../src/organism/learning/ReplaySelectionPolicy.ts';

// Algorithm-level proxy benchmark: it measures selection properties, not task success.
const CAPACITY = 64;
const actions = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const traces = Array.from({ length: 160 }, (_, i) => {
  const contextKey = [
    Math.floor(i / 4) % 4,
    Math.floor(i / 16) % 4,
    Math.floor(i / 32) % 4,
    Math.floor(i / 8) % 4,
    Math.floor(i / 64) % 3,
    (i * 3) % 4,
  ].join('|');
  const surprise = i >= 128 ? ((i * 7) % 11) / 10 : ((i * 3) % 7) / 10;
  return { id: `trace-${i}`, tick: i, contextKey, action: actions[(i + Math.floor(i / 24)) % actions.length], surprise };
});
const stratum = t => JSON.stringify([t.contextKey, t.action]);
const bySurprise = (a, b) => b.surprise - a.surprise || a.tick - b.tick || a.id.localeCompare(b.id);
const metrics = (batch, guaranteedRecentFloor) => ({
  size: batch.length,
  guaranteedRecent: batch.filter(t => t.tick >= guaranteedRecentFloor).length,
  postShift: batch.filter(t => t.tick >= 128).length,
  historical: batch.filter(t => t.tick < 128).length,
  oldest32: batch.filter(t => t.tick < 32).length,
  strata: new Set(batch.map(stratum)).size,
  surpriseMean: batch.reduce((sum, t) => sum + t.surprise, 0) / Math.max(1, batch.length),
  duplicateIds: batch.length - new Set(batch.map(t => t.id)).size,
});
const recentOnly = traces.slice(-CAPACITY);
const surpriseOnly = [...traces].sort(bySurprise).slice(0, CAPACITY);
const quotas = [16, 32, 48];
const balanced = Object.fromEntries(quotas.map(recentQuota => [
  `recentQuota${recentQuota}`,
  metrics(selectReplayBatch(traces, { maxBatchSize: CAPACITY, recentQuota }), traces.length - recentQuota),
]));
const ageHalfLives = [Number.POSITIVE_INFINITY, 1000, 100, 10];
const ageAware = Object.fromEntries(ageHalfLives.map(ageHalfLifeTicks => [
  Number.isFinite(ageHalfLifeTicks) ? `halfLife${ageHalfLifeTicks}` : 'halfLifeInfinite',
  metrics(selectReplayBatch(traces, { maxBatchSize: CAPACITY, recentQuota: 32, ageHalfLifeTicks }), traces.length - 32),
]));
const results = { recentOnly: metrics(recentOnly, 96), surpriseOnly: metrics(surpriseOnly, 96), balanced, ageAware };
for (const recentQuota of quotas) {
  const row = results.balanced[`recentQuota${recentQuota}`];
  assert.equal(row.size, CAPACITY, `quota ${recentQuota}: respect hard capacity`);
  assert.equal(row.duplicateIds, 0, `quota ${recentQuota}: no duplicate trace IDs`);
  assert.equal(row.guaranteedRecent, recentQuota, `quota ${recentQuota}: exact guaranteed-recent window`);
  assert.ok(row.historical > 0, `quota ${recentQuota}: retain pre-shift evidence`);
  assert.ok(row.strata >= 20, `quota ${recentQuota}: preserve broad context/action strata`);
}
assert.equal(results.surpriseOnly.size, CAPACITY);
for (const [name, row] of Object.entries(results.ageAware)) {
  assert.equal(row.size, CAPACITY, `${name}: respect hard capacity`);
  assert.equal(row.duplicateIds, 0, `${name}: no duplicate trace IDs`);
  assert.equal(row.guaranteedRecent, 32, `${name}: preserve same recent quota`);
  assert.ok(row.historical > 0, `${name}: retain historical samples`);
}
console.log('P23_REPLAY_STRATEGY_BENCHMARK=PASS');
console.log(JSON.stringify(results, null, 2));
