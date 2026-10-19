import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const memory = new MemoryOS2({ signalFusionProfile: 'balanced' });
const item = memory.encode({
  content: 'WorkPass36 bounded revision history contract.',
  kind: 'semantic',
  source: 'memory-revision-history-workpass36',
  tags: ['memory', 'revision'],
  context: { feature: 'bounded-history' },
  salience: .6,
  emotionalWeight: .1,
  identityRelevance: .4,
  goalRelevance: .7,
  socialRelevance: .2,
  predictionError: .1,
  confidence: .8,
  epistemicStatus: 'fact',
  entities: ['WorkPass36'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
}, { clone: false });

for (let i = 0; i < 100; i++) memory.updateSignals(item.id, { salience: (i % 10) / 10 }, `revision-${i}-${'x'.repeat(300)}`);
const current = memory.get(item.id);
assert.ok(current, 'updated memory remains available');
assert.equal(current.revisionHistory.length, 64, 'history must retain at most 64 newest entries');
assert.equal(current.revisionHistory[0].reason, (`revision-99-${'x'.repeat(240)}`).slice(0, 240), 'newest revision should be first and reasons capped');
assert.equal(current.revisionHistory.at(-1).reason, (`revision-36-${'x'.repeat(240)}`).slice(0, 240), 'oldest retained entry must be the newest among the final 64 revisions');
const estimatedAfter100 = memory.snapshot().estimatedBytes;
for (let i = 100; i < 120; i++) memory.updateSignals(item.id, { salience: (i % 10) / 10 }, `revision-${i}-${'y'.repeat(300)}`);
const after120 = memory.get(item.id);
assert.equal(after120.revisionHistory.length, 64, 'history remains bounded after further updates');
assert.ok(memory.snapshot().estimatedBytes > 0, 'byte accounting includes retained revision trail');

const legacySnapshot = memory.snapshot();
legacySnapshot.items[0].revisionHistory = Array.from({ length: 150 }, (_, i) => ({
  at: i + 1,
  from: 'fact',
  to: 'fact',
  reason: `legacy-${i}-${'z'.repeat(500)}`,
}));
legacySnapshot.estimatedBytes = 1;
const restored = new MemoryOS2({ signalFusionProfile: 'balanced' });
restored.restore(legacySnapshot);
const restoredItem = restored.get(item.id);
assert.equal(restoredItem.revisionHistory.length, 64, 'restore trims oversized legacy trails');
assert.ok(restoredItem.revisionHistory.every(row => row.reason.length <= 240), 'restore caps each reason string');
assert.ok(restored.snapshot().estimatedBytes > 1, 'restore recomputes footprint instead of trusting stale estimate');
assert.equal(restored.indexDiagnostics().pass, true, 'history normalization must not corrupt memory indexes');

console.log('MEMORY_REVISION_HISTORY_BUDGET=PASS', JSON.stringify({
  maxHistory: current.revisionHistory.length,
  restoredHistory: restoredItem.revisionHistory.length,
  estimatedBytesAfter100: estimatedAfter100,
  estimatedBytesAfterRestore: restored.snapshot().estimatedBytes,
}));
