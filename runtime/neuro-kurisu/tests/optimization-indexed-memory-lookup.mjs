import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const memory = new MemoryOS2({ embeddingProvider: null });
memory.encode({
  id: 'optimization-peek-cold-row',
  content: 'A canonical cold memory for indexed lookup regression.',
  kind: 'semantic',
  source: 'optimization-indexed-memory-lookup',
  tags: ['optimization'],
  context: { suite: 'indexed-lookup' },
  salience: 0.7,
  emotionalWeight: 0.1,
  identityRelevance: 0.2,
  goalRelevance: 0.2,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 1000,
  observedAt: now - 500,
});

const coldSnapshot = memory.snapshot();
const stored = coldSnapshot.items.find(row => row.id === 'optimization-peek-cold-row');
assert.ok(stored, 'fixture must exist');
stored.semanticVector = [];
stored.residencyTier = 'cold';
memory.restore(coldSnapshot);

const before = memory.snapshot();
const preview = memory.peek('optimization-peek-cold-row');
assert.ok(preview, 'indexed lookup must find the canonical row');
assert.equal(preview.semanticVector.length, 0, 'peek must not materialize a cold vector');
assert.equal(preview.residencyTier, 'cold', 'peek must not promote a cold row');
assert.equal(memory.peek('missing-optimization-row'), null, 'missing IDs return null');

// The lookup is a detached copy: callers cannot mutate the canonical record through it.
preview.content = 'caller-side mutation';
preview.context.suite = 'caller-side mutation';
assert.deepEqual(memory.snapshot(), before, 'peek must be read-only and return a detached copy');

// Mutation APIs still resolve the canonical row through the same ID index.
const updated = memory.updateSignals('optimization-peek-cold-row', { salience: 0.81 }, 'indexed-lookup-test');
assert.equal(updated?.salience, 0.81, 'indexed signal update must reach the canonical row');
assert.equal(memory.peek('optimization-peek-cold-row')?.salience, 0.81);

console.log('OPTIMIZATION_INDEXED_MEMORY_LOOKUP=PASS', JSON.stringify({
  peekIsReadOnly: true,
  coldVectorMaterialized: memory.peek('optimization-peek-cold-row')?.semanticVector.length !== 0,
  indexedSignalUpdate: updated?.salience,
}));
