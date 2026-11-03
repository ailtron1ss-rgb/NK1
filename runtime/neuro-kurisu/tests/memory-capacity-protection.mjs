import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// Capacity eviction must respect the same protection rules as forgetting.
// The encode fast-path used to pop the oldest row directly at the 1600-item cap,
// which silently evicted protected memories (identity/autobiographical) and left
// dangling links behind because it skipped forgetById's guards and link pruning.
// Adapted from Hexis's is_memory_protected retention guard (MIT (c) 2026 Eric
// Hartford, db/retention.sql): identity and autobiographical records are never
// discarded by automatic retention.

const ids = (memory) => new Set(memory.snapshot().items.map(item => item.id));
const danglingRefs = (memory) => {
  const present = ids(memory);
  let dangling = 0;
  for (const item of memory.snapshot().items) {
    for (const link of [
      ...(item.semanticLinks ?? []),
      ...(item.temporalLinks ?? []),
      ...(item.contradictionLinks ?? []),
      item.supersedesId,
      item.supersededById,
    ].filter(Boolean)) {
      if (!present.has(link)) dangling += 1;
    }
  }
  return dangling;
};

const memory = new MemoryOS2({ embeddingProvider: null });
const identityId = memory.encode({ content: 'I am Kurisu and my core identity is curiosity', kind: 'identity', source: 'agent' }).id;
const autobiographicalId = memory.encode({ content: 'I remember the first time I saw the ocean', kind: 'autobiographical', source: 'agent' }).id;

for (let i = 0; i < 1700; i += 1) {
  memory.encode({ content: `routine telemetry observation number ${i}`, kind: 'episodic', source: 'agent' });
}

assert.equal(memory.size(), 1600, 'the canonical corpus stays capped at 1600');
const present = ids(memory);
assert.ok(present.has(identityId), 'identity memory must survive capacity eviction');
assert.ok(present.has(autobiographicalId), 'autobiographical memory must survive capacity eviction');
assert.equal(danglingRefs(memory), 0, 'capacity eviction must not leave dangling links');

// Byte accounting must still reconcile against the independent restore oracle.
const restored = new MemoryOS2({ embeddingProvider: null });
restored.restore(structuredClone(memory.snapshot()));
assert.equal(restored.snapshot().estimatedBytes, memory.snapshot().estimatedBytes, 'capacity eviction must keep byte accounting consistent');

// Unprotected corpora keep oldest-first semantics: with no protected rows, the
// first encoded row is the one evicted.
const plain = new MemoryOS2({ embeddingProvider: null });
const oldestId = plain.encode({ content: 'the oldest unprotected observation', kind: 'episodic', source: 'plain' }).id;
for (let i = 0; i < 1700; i += 1) plain.encode({ content: `plain filler observation ${i}`, kind: 'episodic', source: 'plain' });
assert.equal(plain.size(), 1600, 'unprotected corpus stays capped');
assert.ok(!ids(plain).has(oldestId), 'the oldest unprotected row is evicted first');

console.log('MEMORY_CAPACITY_PROTECTION=PASS', JSON.stringify({
  size: memory.size(),
  identitySurvived: true,
  autobiographicalSurvived: true,
  danglingRefs: 0,
  oldestEvictedFirst: true,
}));
