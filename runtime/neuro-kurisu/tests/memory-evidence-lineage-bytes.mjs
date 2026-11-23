import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// `attachEvidenceSource` merged a new evidence source into a record and then
// corrected the durable byte budget with a `beforeBytes` captured *before* that
// merge — but `recordRevision` had already self-accounted its own revision-history
// delta in between. The correction therefore subtracted the pre-merge size twice,
// inflating `estimatedBytes` relative to the size `restore()` recomputes from the
// item set. Every evidence attachment drifted the live budget away from a reloaded
// copy, and repeated attachments compounded it.

const clone = m => structuredClone(m.snapshot());
const reload = m => { const r = new MemoryOS2({ embeddingProvider: null }); r.restore(clone(m)); return r; };

const memory = new MemoryOS2({ embeddingProvider: null });
const id = memory.encode({
  content: 'The turbine output was 42 MW.',
  kind: 'semantic',
  source: 'sensor-a',
  confidence: .7,
  epistemicStatus: 'belief',
}).id;

const source = { source: 'sensor-a', provenanceClass: 'device', sourceAuthority01: .9, independenceKey: 'device:42', observedAt: Date.now() };

// The live byte budget must equal what restore recomputes, after every attach.
for (const [label, incoming] of [
  ['first source', source],
  ['duplicate independence key', { ...source }],
  ['distinct independence key', { ...source, independenceKey: 'device:99' }],
  ['distinct source, reused key', { ...source, source: 'sensor-b', independenceKey: 'device:99' }],
]) {
  const before = memory.budgetDiagnostics().estimatedBytes;
  assert.ok(memory.attachEvidenceSource(id, incoming, label), label + ': attach must succeed');
  assert.ok(memory.budgetDiagnostics().estimatedBytes >= before, label + ': an attachment must not shrink the budget');
  assert.equal(
    memory.budgetDiagnostics().estimatedBytes,
    reload(memory).snapshot().estimatedBytes,
    label + ': the live byte budget must match a reloaded copy (no double count)',
  );
}

// Corroboration is bounded by independent lineage, not by call count: only a new
// independence key adds a source; replaying an existing key must not inflate it.
const trail = memory.evidenceTrail(id);
assert.equal(trail.independentSources, 3, 'only three distinct independence keys were ever attached');
assert.ok(trail.corroborationBonus01 <= .05, 'corroboration must stay bounded by independent lineage');

assert.equal(memory.doctor().pass, true, 'the live store must be coherent after evidence attachment');
const restored = reload(memory);
assert.equal(restored.doctor().pass, true, 'the reloaded store must be coherent after evidence attachment');
assert.equal(restored.evidenceTrail(id).independentSources, trail.independentSources, 'evidence lineage must survive a round-trip');

console.log('MEMORY_EVIDENCE_LINEAGE_BYTES=PASS', JSON.stringify({
  attachments: 4,
  independentSources: trail.independentSources,
  byteDrift: 0,
}));
