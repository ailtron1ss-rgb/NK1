import assert from 'node:assert/strict';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const fixedEmbedding = Array.from({ length: 24 }, (_, index) => index === 0 ? 1 : 0);

function memoryRecord(id, summary, overrides = {}) {
  return {
    id,
    kind: 'episode',
    summary,
    salience: 0.5,
    evidence: [],
    createdAt: 2_000_000_000_000,
    timescale: 'episodic',
    retrievalCount: 0,
    lastRetrievedAt: 0,
    confidence: 0.8,
    sourceEventIds: [],
    embedding: [...fixedEmbedding],
    ...overrides,
  };
}

// Replacing a compatibility projection must invalidate the old lexical tokens.
// This is observable in ranking because both records have identical non-lexical
// signals and vectors; insertion order intentionally favors the distractor.
{
  const memory = new MultiTimescaleMemory();
  const target = memoryRecord('memory-a', 'old quasar navigation record');
  const distractor = memoryRecord('memory-b', 'unrelated notebook entry');
  memory.add(target);
  memory.add(distractor);
  assert.equal(memory.retrieve('quasar', 2)[0]?.id, 'memory-a');

  memory.add(memoryRecord('memory-a', 'fresh botanical observation'));
  memory.add(distractor);

  assert.equal(
    memory.retrieve('quasar', 2)[0]?.id,
    'memory-b',
    'reconsolidation must not retain stale tokens from the previous content',
  );
  assert.equal(
    memory.retrieve('botanical', 2)[0]?.id,
    'memory-a',
    'the replacement content must become searchable immediately',
  );
}

// Query and memory tokenization must share Unicode normalization and punctuation
// handling, including Russian and English tokens in one query.
{
  const memory = new MultiTimescaleMemory();
  memory.add(memoryRecord('bilingual-target', 'Результат latency измерен успешно'));
  memory.add(memoryRecord('bilingual-distractor', 'unrelated note'));
  assert.equal(
    memory.retrieve('РЕЗУЛЬТАТ, LATENCY!', 2)[0]?.id,
    'bilingual-target',
    'punctuation and case must not erase bilingual lexical matches',
  );
}

// A poisoned or dimension-mismatched compatibility vector must be replaced by a
// deterministic finite 24D fallback instead of contaminating cosine ranking.
{
  const memory = new MultiTimescaleMemory();
  memory.add(memoryRecord('bad-vector', 'stable memory content', {
    embedding: [Number.NaN, Number.POSITIVE_INFINITY, 0],
  }));
  const stored = memory.snapshot().find(row => row.id === 'bad-vector');
  assert.ok(stored);
  assert.equal(stored.embedding.length, 24, 'compatibility vectors must have the expected dimension');
  assert.ok(stored.embedding.every(Number.isFinite), 'compatibility vectors must be finite');
  const norm = Math.sqrt(stored.embedding.reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9, 'compatibility vectors must be normalized');
}

// Empty/zero-width queries should abstain rather than retrieve high-salience noise;
// caller-supplied limits must remain bounded and predictable.
{
  const memory = new MultiTimescaleMemory();
  memory.add(memoryRecord('ordinary', 'ordinary memory content'));
  assert.deepEqual(memory.retrieve('   !!!   '), []);
  assert.deepEqual(memory.retrieve('ordinary', 0), []);
  assert.ok(memory.retrieve('ordinary', 10_000).length <= 32);
}

console.log('MULTITIMESCALE_MEMORY_RETRIEVAL_INTEGRITY=PASS');

// Semantic graph restoration is a trust boundary: invalid records, duplicate IDs,
// and edges with missing endpoints or invalid weights must never enter live state.
{
  const graph = new SemanticMemoryGraph();
  graph.restore({
    nodes: [
      { id: 'node-a', label: 'Memory Core', type: 'concept', salience: 0.9, lastSeen: 100 },
      { id: 'node-b', label: 'Episodic Recall', type: 'episode', salience: 0.8, lastSeen: 101 },
      { id: 'node-c', label: 'Invalid Type', type: 'unknown', salience: 0.9, lastSeen: 102 },
      { id: 'node-b', label: 'Duplicate Identifier', type: 'place', salience: 0.9, lastSeen: 103 },
    ],
    edges: [
      { id: 'edge-valid', from: 'node-a', to: 'node-b', relation: 'supports', weight: 0.9, lastSeen: 100 },
      { id: 'edge-dangling', from: 'node-a', to: 'missing', relation: 'about', weight: 0.5, lastSeen: 100 },
      { id: 'edge-bad-weight', from: 'node-a', to: 'node-b', relation: 'supports', weight: Number.NaN, lastSeen: 100 },
      { id: 'edge-bad-relation', from: 'node-a', to: 'node-b', relation: 'unknown', weight: 0.5, lastSeen: 100 },
    ],
    updates: Number.NaN,
  });

  const state = graph.snapshot();
  assert.deepEqual(state.nodes.map(node => node.id), ['node-a', 'node-b']);
  assert.deepEqual(state.edges.map(edge => edge.id), ['edge-valid']);
  assert.equal(state.updates, 0);
  assert.throws(
    () => graph.connect('node-a', 'missing', 'about', 0.5),
    /semantic-edge-endpoint-missing/,
  );
  assert.throws(
    () => graph.connect('node-a', 'node-b', 'supports', Number.NaN),
    /semantic-edge-weight-invalid/,
  );
}

// Capacity eviction must also remove edges whose endpoints no longer exist.
{
  const graph = new SemanticMemoryGraph();
  const first = graph.upsertNode('node-0', 'concept', 0.5);
  const second = graph.upsertNode('node-1', 'concept', 0.5);
  graph.connect(first.id, second.id, 'associated', 0.5);
  for (let index = 2; index <= 1000; index++) {
    graph.upsertNode(`node-${index}`, 'concept', 0.5);
  }

  const state = graph.snapshot();
  const ids = new Set(state.nodes.map(node => node.id));
  assert.equal(state.nodes.length, 1000);
  assert.ok(state.edges.every(edge => ids.has(edge.from) && ids.has(edge.to)));
  assert.equal(state.edges.length, 0, 'evicted-node edges must be pruned');
}

// Blank graph queries must abstain; otherwise an empty substring matches every node.
{
  const graph = new SemanticMemoryGraph();
  graph.upsertNode('memory retrieval', 'concept', 0.9);
  assert.deepEqual(graph.retrieve('   !!!   '), []);
}

console.log('SEMANTIC_MEMORY_GRAPH_INTEGRITY=PASS');
