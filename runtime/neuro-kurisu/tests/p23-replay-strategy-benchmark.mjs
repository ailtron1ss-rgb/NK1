import assert from 'node:assert/strict';

// Deterministic algorithm-level benchmark for the P23 bounded replay policy.
// This is a selection-quality proxy, not evidence of task-success improvement.
const CAPACITY = 64;
const RECENT_QUOTA = 32;
const levels = [0.05, 0.35, 0.65, 0.95];
const actions = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const traces = Array.from({ length: 160 }, (_, i) => {
  const context = [
    Math.floor(i / 4) % 4,
    Math.floor(i / 16) % 4,
    Math.floor(i / 32) % 4,
    Math.floor(i / 8) % 4,
    Math.floor(i / 64) % 3,
    (i * 3) % 4,
  ].join('|');
  // Deliberately make the latest segment non-stationary: surprise and action
  // frequencies shift, so a replay strategy must balance recency and retention.
  const surprise = i >= 128 ? ((i * 7) % 11) / 10 : ((i * 3) % 7) / 10;
  return {
    id: `trace-${i}`,
    tick: i,
    context,
    action: actions[(i + Math.floor(i / 24)) % actions.length],
    surprise,
  };
});
const key = t => `${t.context}|${t.action}`;
const bySurprise = (a, b) => b.surprise - a.surprise || a.tick - b.tick;
const recentOnly = traces.slice(-CAPACITY);
const surpriseOnly = traces.slice().sort(bySurprise).slice(0, CAPACITY);
const multiTimescale = (input) => {
  const ordered = input.slice().sort((a, b) => a.tick - b.tick);
  if (ordered.length <= CAPACITY) return ordered;
  const recent = ordered.slice(-RECENT_QUOTA);
  const historical = ordered.slice(0, -RECENT_QUOTA);
  const groups = new Map();
  for (const trace of historical) {
    const group = groups.get(key(trace)) ?? [];
    group.push(trace);
    groups.set(key(trace), group);
  }
  const representatives = [...groups.values()].map(group => group.slice().sort(bySurprise)[0]).sort(bySurprise);
  const selected = new Map(recent.map(trace => [trace.id, trace]));
  for (const trace of representatives) {
    if (selected.size >= CAPACITY) break;
    selected.set(trace.id, trace);
  }
  if (selected.size < CAPACITY) {
    for (const trace of historical.slice().sort(bySurprise)) {
      if (selected.size >= CAPACITY) break;
      selected.set(trace.id, trace);
    }
  }
  return [...selected.values()].sort((a, b) => a.tick - b.tick);
};
const metrics = batch => ({
  size: batch.length,
  recent32: batch.filter(t => t.tick >= 128).length,
  historical32: batch.filter(t => t.tick < 32).length,
  historical: batch.filter(t => t.tick < 128).length,
  strata: new Set(batch.map(key)).size,
  surpriseMean: batch.reduce((sum, t) => sum + t.surprise, 0) / Math.max(1, batch.length),
  duplicateIds: batch.length - new Set(batch.map(t => t.id)).size,
});
const hybrid = multiTimescale(traces);
const results = {
  recentOnly: metrics(recentOnly),
  surpriseOnly: metrics(surpriseOnly),
  multiTimescale: metrics(hybrid),
};
assert.equal(results.multiTimescale.size, CAPACITY);
assert.equal(results.multiTimescale.recent32, RECENT_QUOTA);
assert.equal(results.multiTimescale.duplicateIds, 0);
assert.ok(results.multiTimescale.historical > 0, 'hybrid replay must preserve pre-shift experience');
assert.ok(results.multiTimescale.strata >= 20, 'hybrid replay must preserve a broad set of context-action strata');
assert.ok(results.surpriseOnly.historical > 0);
console.log('P23_REPLAY_STRATEGY_BENCHMARK=PASS');
console.log(JSON.stringify(results, null, 2));
