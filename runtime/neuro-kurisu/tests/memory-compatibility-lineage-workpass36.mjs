import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';

const coordinator = new MemorySubstrateCoordinator();
const legacyRow = {
  id: 'legacy-multi-timescale-episode-47',
  kind: 'episode',
  summary: 'Kurisu recovered a failed sensor reading after checking the physical state.',
  salience: .74,
  evidence: ['device:camera-1', 'verification:postcondition-match', 'legacy:receipt-47'],
  createdAt: 1_760_000_000_000,
  timescale: 'episodic',
  retrievalCount: 4,
  lastRetrievedAt: 1_760_000_003_000,
  confidence: .87,
  sourceEventIds: ['event-a', 'event-b', 'event-c'],
  associationIds: ['related-memory-2', 'related-memory-9'],
};
const input = coordinator.compatibilityInput(legacyRow);
assert.deepEqual(input.temporalLinks, [], 'legacy event IDs must not be injected into canonical links before resolution');
assert.deepEqual(input.semanticLinks, [], 'legacy association IDs must not be mistaken for resolved canonical links');
assert.equal(input.context.legacySourceEventIds, legacyRow.sourceEventIds.join(','), 'legacy event lineage is preserved without corrupting canonical graph edges');
assert.equal(input.context.legacyAssociationIds, legacyRow.associationIds.join(','), 'legacy associations remain traceable');
assert.equal(input.provenanceClass, 'derived', 'compatibility projection must not claim external evidence authority');
assert.equal(input.evidenceSources.length, 1, 'replayed compatibility evidence is one derived lineage, not multiple independent witnesses');
assert.equal(input.evidenceSources[0].independenceKey, `multi-timescale:${legacyRow.id}`);
assert.equal(input.observedAt, legacyRow.lastRetrievedAt, 'recency must be preserved at the adapter boundary');

const memoryOS = new MemoryOS2();
const migrated = memoryOS.encode(input, { clone: false });
const projected = coordinator.projectCompatibilityRecords(memoryOS.snapshot(), 16).find(row => row.id === migrated.id);
assert.ok(projected, 'canonical memory can be projected back to legacy readers');
assert.deepEqual(projected.sourceEventIds, legacyRow.sourceEventIds, 'source event lineage must round-trip through canonical MemoryOS2');
assert.deepEqual(projected.associationIds, legacyRow.associationIds, 'legacy associations must round-trip through canonical MemoryOS2');
assert.equal(migrated.context.originalId, legacyRow.id, 'legacy source ID remains traceable without owning a second memory identity');
assert.equal(memoryOS.indexDiagnostics().pass, true, 'lineage projection must preserve canonical memory indexes');

console.log('MEMORY_COMPATIBILITY_LINEAGE=PASS', JSON.stringify({
  migratedId: migrated.id,
  eventLinks: projected.sourceEventIds.length,
  associationLinks: projected.associationIds.length,
  canonicalAuthority: 'memoryOS2',
}));
