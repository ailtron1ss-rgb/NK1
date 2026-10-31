import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const memory = new MemoryOS2({ embeddingProvider: null });
const seed = memory.encode({
  id: 'duplicate-identity', content: 'The older version of the NK1 identity is retired.',
  kind: 'semantic', source: 'user-observation', confidence: .9, epistemicStatus: 'fact',
  validFromAt: 1000, observedAt: 1000,
});
const snapshot = memory.snapshot();
const original = snapshot.items.find(row => row.id === seed.id);
assert.ok(original);
const duplicate = structuredClone(original);

for (const rows of [[original, duplicate], [duplicate, original]]) {
  const restored = new MemoryOS2({ embeddingProvider: null });
  restored.restore({ ...structuredClone(snapshot), items: structuredClone(rows) });
  assert.equal(restored.get(seed.id), null,
    'all copies of a duplicate ID must be dropped; selecting either payload would make references ambiguous');
  const diagnostics = restored.restoreDiagnostics();
  assert.equal(diagnostics.sourceRows, 2);
  assert.equal(diagnostics.acceptedRows, 0);
  assert.equal(diagnostics.duplicateIdsResolved, 1,
    'duplicate ID groups are counted independently of snapshot order');
  const report = restored.doctor();
  assert.equal(report.pass, true, 'the normalized state is safe after dropping ambiguous rows');
  assert.equal(report.counts.duplicateIds, 1);
  assert.ok(report.issues.some(issue => issue.code === 'duplicate-memory-id-dropped'));
  assert.equal(restored.retrieve('NK1 identity', 5).length, 0,
    'ambiguous duplicate identity data must not enter recall');
}

console.log('MEMORY_RESTORE_DUPLICATE_IDENTITY=PASS');
