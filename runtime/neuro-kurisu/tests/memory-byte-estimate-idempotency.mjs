import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// The durable byte budget must not change merely because a snapshot was restored.
// Restore normalizes optional list fields (tags, revisionIntegrityIssues) to [],
// while freshly encoded live items may leave them unset. estimateMemoryBytes must
// therefore serialize "missing" and "empty" identically, or every recovery shifts
// estimatedBytes and desynchronizes the eviction budget from the actual corpus.

const roundTrip = (memory) => {
  const live = memory.snapshot();
  const restored = new MemoryOS2({ embeddingProvider: null });
  restored.restore(structuredClone(live));
  return { live: live.estimatedBytes, restored: restored.snapshot().estimatedBytes };
};

// Untagged items are the common case: encode leaves tags unset, restore yields [].
const untagged = new MemoryOS2({ embeddingProvider: null });
for (let i = 0; i < 32; i += 1) {
  untagged.encode({ content: `untagged observation ${i} about subsystem verification`, kind: 'episodic', source: 'byte-estimate-idempotency' });
}
const untaggedTrip = roundTrip(untagged);
assert.equal(untaggedTrip.restored, untaggedTrip.live, 'an untagged corpus must keep the same byte estimate after restore');

// Explicitly tagged items must also round-trip without drift.
const tagged = new MemoryOS2({ embeddingProvider: null });
for (let i = 0; i < 32; i += 1) {
  tagged.encode({ content: `tagged observation ${i} about release memory`, kind: 'semantic', source: 'byte-estimate-idempotency', tags: ['release', 'memory'] });
}
const taggedTrip = roundTrip(tagged);
assert.equal(taggedTrip.restored, taggedTrip.live, 'a tagged corpus must keep the same byte estimate after restore');

// A mixed corpus (tagged and untagged) must not drift either.
const mixed = new MemoryOS2({ embeddingProvider: null });
for (let i = 0; i < 32; i += 1) {
  mixed.encode({ content: `mixed observation ${i} about subsystem memory`, kind: 'episodic', source: 'byte-estimate-idempotency', tags: i % 2 ? ['release'] : [] });
}
const mixedTrip = roundTrip(mixed);
assert.equal(mixedTrip.restored, mixedTrip.live, 'a mixed corpus must keep the same byte estimate after restore');

// A second restore must be a fixed point: repeated recovery cannot keep inflating bytes.
const twice = new MemoryOS2({ embeddingProvider: null });
twice.restore(structuredClone(untagged.snapshot()));
const second = roundTrip(twice);
assert.equal(second.restored, second.live, 'restore must be a byte-estimate fixed point');

console.log('MEMORY_BYTE_ESTIMATE_IDEMPOTENCY=PASS', JSON.stringify({ untagged: untaggedTrip, tagged: taggedTrip, mixed: mixedTrip }));
