import assert from 'node:assert/strict';
import { defaultMemoryOS2, MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryWritePolicy } from '../src/organism/system/MemoryWritePolicy.ts';

const mem = (id, content, salience = 0.7) => ({
  id, content, kind: 'episodic', createdAt: 1000, lastAccessAt: 1000, salience,
  emotionalWeight: 0.35, identityRelevance: 0.4, goalRelevance: 0.55, socialRelevance: 0.2,
  predictionError: 0.55, temperature01: 0.5, confidence: 0.8, epistemicStatus: 'hypothesis',
  source: 'test', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [],
  revisionHistory: [], dormant: false, retrievalCount: 0, semanticVector: [],
});

const build = () => {
  const os = new MemoryOS2();
  os.restore(defaultMemoryOS2());
  // The budget floor in enforceByteBudget is 16 KB, so the corpus must be large enough
  // to actually exceed it; 60 near-identical rows land around 21 KB.
  for (let i = 0; i < 60; i++) os.encode(mem(`m-${i}`, `eviction ranking record number ${i} with similar length`));
  return os;
};

// --- identical stores, identical budget: without a hook the order is by score only ---
const control = build();
const controlBytes = control.budgetDiagnostics().estimatedBytes;
const budget = Math.floor(controlBytes / 2);
const controlResult = control.enforceByteBudget({ maxBytes: budget, reason: 'control' });
assert.ok(controlResult.evicted.length >= 2, `control must evict under pressure, got ${controlResult.evicted.length}`);

// --- same store, but the policy protects m-0 and demotes m-5 ---
const treatment = build();
const protectedId = 'm-0';
const demotedId = 'm-59';
const treatmentResult = treatment.enforceByteBudget({
  maxBytes: budget,
  reason: 'treatment',
  valueAdjustment: (m) => (m.id === protectedId ? 1.5 : m.id === demotedId ? 0.5 : 1),
});
assert.ok(treatmentResult.evicted.length >= 2, 'treatment must evict under the same pressure');
assert.equal(treatmentResult.evicted[0], demotedId, `demoted memory must be evicted first, got ${treatmentResult.evicted[0]}`);
assert.equal(treatmentResult.evicted.includes(protectedId), false, 'protected memory must survive the same budget');

// --- the hook is bounded: absurd weights cannot protect or doom a memory beyond 0.5..1.5 ---
const bounded = build();
const boundedResult = bounded.enforceByteBudget({
  maxBytes: budget,
  reason: 'bounded',
  valueAdjustment: (m) => (m.id === demotedId ? Number.NaN : m.id === protectedId ? 1e9 : 0),
});
assert.equal(boundedResult.evicted.includes(protectedId), false, 'clamped max weight still protects');
assert.ok(Number.isFinite(boundedResult.usedBytes));

// --- policy weights: unknown = 1, bounds, shadow records without acting, active acts ---
{
  const shadow = new MemoryWritePolicy({ mode: 'shadow' });
  assert.equal(shadow.evictionWeight01('unknown'), 1, 'unknown memory must keep the default order');
  for (let tick = 0; tick < 6; tick++) {
    shadow.observeOutcome({ tick, id: 'stable', success01: 0.8, predictionError01: 0.05, retentionScore01: 0.6 });
    shadow.observeOutcome({ tick, id: 'noisy', success01: 0.2, predictionError01: 0.9, retentionScore01: 0.6 });
  }
  assert.equal(shadow.evictionWeight01('stable'), 1, 'shadow mode must not change the ranking');
  assert.ok(shadow.diagnostics().evictionShadowWouldAdjust > 0, 'shadow mode must record would-be adjustments');

  const active = new MemoryWritePolicy({ mode: 'active' });
  for (let tick = 0; tick < 6; tick++) {
    active.observeOutcome({ tick, id: 'stable', success01: 0.8, predictionError01: 0.05, retentionScore01: 0.6 });
    active.observeOutcome({ tick, id: 'noisy', success01: 0.2, predictionError01: 0.9, retentionScore01: 0.6 });
  }
  const stableWeight = active.evictionWeight01('stable');
  const noisyWeight = active.evictionWeight01('noisy');
  assert.ok(stableWeight > 1, `reliable memory must be protected, got ${stableWeight}`);
  assert.ok(noisyWeight < 1, `noisy memory must be demoted, got ${noisyWeight}`);
  assert.ok(stableWeight <= 1.2 && noisyWeight >= 0.85, 'weights must stay inside the declared bounds');
  assert.ok(active.diagnostics().evictionAdjusted >= 2);

  const activeAdjusted = active.diagnostics().evictionAdjusted;
  const restored = new MemoryWritePolicy({ mode: 'active' });
  restored.restore(active.snapshot());
  assert.equal(restored.diagnostics().evictionAdjusted, activeAdjusted, 'counters must survive restore');
  assert.equal(restored.evictionWeight01('stable'), stableWeight, 'weights must survive restore');

  // One write-time observation carries real but weak evidence: the effect is scaled to a third
  // instead of being ignored, because a uniform multiplier would not change eviction order.
  const single = new MemoryWritePolicy({ mode: 'active' });
  single.observeOutcome({ tick: 0, id: 'once', success01: 0.8, predictionError01: 0.05, retentionScore01: 0.6 });
  const singleWeight = single.evictionWeight01('once');
  assert.ok(singleWeight > 1 && singleWeight < stableWeight, `one observation must be weaker than six, got ${singleWeight}`);
  assert.ok(single.evictionWeight01('never-seen') === 1, 'unobserved memory must keep the default order');

  const off = new MemoryWritePolicy({ mode: 'off' });
  for (let tick = 0; tick < 6; tick++) off.observeOutcome({ tick, id: 'stable', success01: 0.8, predictionError01: 0.05, retentionScore01: 0.6 });
  assert.equal(off.evictionWeight01('stable'), 1);
  assert.equal(off.diagnostics().evictionAdjusted, 0);
}

console.log(`MEMORY_WRITE_POLICY_EVICTION=PASS ${JSON.stringify({
  controlEvicted: controlResult.evicted.length,
  treatmentEvicted: treatmentResult.evicted.length,
  firstEvicted: treatmentResult.evicted[0],
})}`);
