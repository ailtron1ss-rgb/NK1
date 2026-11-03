import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// An explicit id encoded twice with *different* content used to create two rows
// sharing one id. itemIndex could then resolve the id to only one of them, and a
// snapshot/restore round-trip dropped both as an ambiguous duplicate: silent live
// corruption followed by total loss of the record. Re-observation now gets a
// distinct id (same-content re-encode still merges), mirroring the existing
// stable-id collision handling.

const memory = new MemoryOS2({ embeddingProvider: null });
const first = memory.encode({ id: 'deployment-target', content: 'The deployment target is the staging cluster.', kind: 'semantic', source: 'ops' });
const second = memory.encode({ id: 'deployment-target', content: 'The deployment target is the production cluster.', kind: 'semantic', source: 'ops' });

const snapshot = memory.snapshot();
const shared = snapshot.items.filter(item => item.id === 'deployment-target');
assert.equal(shared.length, 1, 'a re-used explicit id must not create duplicate-id rows');
assert.notEqual(second.id, first.id, 'differing content under a reused id must get a distinct id');
assert.equal(snapshot.items.length, 2, 'both observations are retained as separate records');

// The live indexes must agree with the row list.
assert.ok(memory.indexDiagnostics().pass, 'live indexes must stay consistent');
assert.equal(memory.doctor().pass, true, 'the live state must report no integrity issue');

// A snapshot/restore round-trip is the independent oracle: no row may be dropped.
const restored = new MemoryOS2({ embeddingProvider: null });
restored.restore(structuredClone(snapshot));
assert.equal(restored.restoreDiagnostics().duplicateIdsResolved, 0, 'restore must not have to resolve duplicates');
assert.equal(restored.size(), 2, 'both records survive restore');
assert.ok(restored.get(first.id), 'the original record survives');
assert.ok(restored.get(second.id), 'the re-observed record survives');

// Re-encoding identical content under the same id still merges rather than forks.
const merged = memory.encode({ id: 'deployment-target', content: 'The deployment target is the staging cluster.', kind: 'semantic', source: 'ops' });
assert.equal(merged.id, first.id, 'identical content under the same id must still merge');
assert.equal(memory.size(), 2, 'a same-content re-encode must not add a row');

console.log('MEMORY_DUPLICATE_ID_WRITE_GUARD=PASS', JSON.stringify({
  sharedIdRows: shared.length,
  distinctIds: first.id !== second.id,
  restoreDropped: restored.restoreDiagnostics().duplicateIdsResolved,
  sameContentMerged: merged.id === first.id,
}));
