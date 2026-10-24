import assert from 'node:assert/strict';
import { P65EpistemicLedger } from '../src/organism/memory/P65EpistemicLedger.ts';

const provenanceA = {
  sourceId: 'hexis-memory:conversation-17:item-4',
  sourceKind: 'user-memory',
  capturedAt: 1_800_000_000_100,
  trustClass: 'corroborated',
  contentFingerprint: 'a'.repeat(64),
  citation: 'conversation-17:item-4',
};
const provenanceB = {
  ...provenanceA,
  sourceId: 'hexis-memory:conversation-18:item-1',
  contentFingerprint: 'b'.repeat(64),
};

const ledger = new P65EpistemicLedger();
const observationId = ledger.record({
  tick: 10, at: 1_800_000_000_100, kind: 'observation',
  content: 'A preference was mentioned in a past conversation.',
  confidence01: 0.8, source: 'user', provenance: provenanceA,
});
const inferenceId = ledger.record({
  tick: 11, at: 1_800_000_000_200, kind: 'inference',
  content: 'The preference may still apply.',
  confidence01: 0.6, source: 'organism', parentIds: [observationId],
  provenance: { ...provenanceB, trustClass: 'inferred' },
});
assert.ok(observationId);
assert.ok(inferenceId);
assert.notEqual(observationId, inferenceId);
assert.equal(ledger.snapshot().claimsData.find(c => c.id === observationId).provenance.sourceId, provenanceA.sourceId);
assert.equal(ledger.snapshot().claimsData.find(c => c.id === observationId).provenance.trustClass, 'corroborated');

const lineage = ledger.sourceLineage(inferenceId, 8);
assert.deepEqual(lineage.map(c => c.id), [inferenceId, observationId],
  'lineage should expose the current claim and its known parent claim');
assert.equal(lineage[0].provenance.sourceId, provenanceB.sourceId);
assert.equal(lineage[1].provenance.contentFingerprint, provenanceA.contentFingerprint);

const persistence = ledger.persistenceSnapshot();
const restored = new P65EpistemicLedger();
restored.restore(persistence);
assert.equal(restored.snapshot().claimsData.find(c => c.id === observationId).provenance.citation, provenanceA.citation,
  'provenance and citation labels should survive persistence and restore');

const sameSourceLedger = new P65EpistemicLedger();
const sameId = sameSourceLedger.record({
  tick: 10, at: 1_800_000_000_100, kind: 'observation',
  content: 'A preference was mentioned in a past conversation.',
  confidence01: 0.8, source: 'user', provenance: provenanceB,
});
assert.notEqual(sameId, observationId, 'different source identity/fingerprint must not collapse into the same claim');
assert.throws(() => ledger.record({
  tick: 12, at: 1_800_000_000_300, kind: 'observation',
  content: 'Invalid provenance must fail closed.',
  confidence01: 0.5, source: 'external-api',
  provenance: { sourceId: 'broken', sourceKind: 'external', capturedAt: -1, trustClass: 'verified' },
}), /invalid epistemic source provenance/);

const legacyA = new P65EpistemicLedger();
const legacyB = new P65EpistemicLedger();
const legacyInput = {
  tick: 2, at: 2_000, kind: 'belief', content: 'Legacy claims remain readable.',
  confidence01: 0.7, source: 'user',
};
assert.equal(legacyA.record(legacyInput), legacyB.record(legacyInput),
  'claims without provenance must retain deterministic legacy identity');
const legacyRestored = new P65EpistemicLedger();
legacyRestored.restore({ ...legacyA.snapshot(), claimsData: [{ ...legacyA.snapshot().claimsData[0], provenance: { sourceId: 'bad' } }] });
assert.equal(legacyRestored.snapshot().claimsData[0].provenance, undefined,
  'malformed legacy provenance must be dropped, not treated as trusted data');

console.log('OPERATION_OMEGA_HEXIS_MEMORY_PROVENANCE=PASS source fingerprinting, safe restore, bounded lineage and legacy compatibility');
