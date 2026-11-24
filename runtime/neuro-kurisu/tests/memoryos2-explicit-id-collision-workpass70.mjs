import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const input = (id, content) => ({
  id,
  content,
  kind: 'episodic',
  source: 'memoryos2-explicit-id-collision-workpass70',
  salience: .65,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: ['neurocore', 'explicit-id-collision'],
});

const memory = new MemoryOS2({ embeddingProvider: null });
const first = memory.encode(input('caller-owned-id', 'The eastern reactor is stable and available.'), { clone: false });
const second = memory.encode(input('caller-owned-id', 'The western reactor is offline and unavailable.'), { clone: false });

assert.notEqual(second.id, first.id, 'different canonical content must not reuse a caller-owned ID');
assert.equal(memory.size(), 2, 'both distinct facts must remain in the canonical corpus');
const ids = memory.snapshot({ clone: false }).items.map(row => row.id);
assert.equal(new Set(ids).size, 2, 'canonical rows must have unique IDs');
assert.equal(memory.snapshot({ clone: false }).items.find(row => row.id === first.id)?.content, first.content);

const replay = memory.encode(input('caller-owned-id', 'The western reactor is offline and unavailable.'), { clone: false });
assert.equal(replay.id, second.id, 'exact replay must reconcile to the already materialized collision resolution');
assert.equal(memory.size(), 2, 'exact replay must not append another canonical row');

const restored = new MemoryOS2({ embeddingProvider: null });
restored.restore(memory.snapshot());
assert.equal(restored.size(), 2);
assert.equal(new Set(restored.snapshot({ clone: false }).items.map(row => row.id)).size, 2);
assert.equal(restored.indexDiagnostics().pass, true);

console.log('MEMORYOS2_EXPLICIT_ID_COLLISION_WORKPASS70=PASS');
