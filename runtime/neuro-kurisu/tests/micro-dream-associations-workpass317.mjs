import assert from 'node:assert/strict';
import { MicroDreamEngine } from '../src/organism/developmental/MicroDreamEngine.ts';

const memories = [
  {
    id: 'memory-oscillator',
    content: 'Quantum oscillator calibration drift affects coherence readings in the sensor network.',
    confidence01: .88,
    salience01: .8,
    semanticLinks: [],
    entities: ['quantum oscillator'],
  },
  {
    id: 'memory-memory-writes',
    content: 'Calibration drift across quantum memory writes alters oscillator coherence.',
    confidence01: .82,
    salience01: .72,
    semanticLinks: [],
    entities: ['quantum memory'],
  },
  {
    id: 'memory-audio',
    content: 'Calibration drift during audio amplifier harmonic analysis changes output distortion.',
    confidence01: .75,
    salience01: .5,
    semanticLinks: [],
    entities: ['audio amplifier'],
  },
];
const original = structuredClone(memories);
const first = new MicroDreamEngine();
const result = first.dreamAssociations(memories, 'workpass317-seed', {
  at: 1_000,
  uncertainty01: .6,
  memoryEvidence01: .8,
  novelty01: .75,
});
assert.ok(result.generated > 0, 'dream pass should produce candidate cross-memory links');
assert.ok(result.generated <= 3, 'dream pass must keep candidate generation bounded');
assert.equal(first.snapshot().associationCandidates, result.generated);
assert.ok(result.candidates.every(d => d.kind === 'association' && d.validationStatus === 'candidate'),
  'dreamed links must remain explicitly unvalidated hypotheses');
assert.ok(result.candidates.every(d => d.sourceMemoryIds?.length === 2 && d.sharedTerms && d.sharedTerms.length >= 2),
  'each candidate must expose bounded source IDs and the shared-term explanation');
assert.ok(result.candidates.every(d => d.confidence >= 0 && d.confidence <= 1));
assert.deepEqual(memories, original, 'dreaming must not mutate the source memory records');
assert.ok(result.candidates.every(d => !d.simulation.includes('validated:')),
  'candidate generation must not imply independent verification or promotion');

const repeated = first.dreamAssociations(memories, 'workpass317-next-tick', {
  at: 2_000,
  uncertainty01: .6,
  memoryEvidence01: .8,
  novelty01: .75,
});
assert.equal(repeated.generated, 0, 'identical memory pairs should not be re-emitted during the cooldown');
assert.ok(repeated.deduplicated > 0, 'repeated candidates should be counted rather than silently duplicated');
assert.equal(first.diagnostics().deduplicatedAssociations, repeated.deduplicated);

const restored = new MicroDreamEngine();
restored.restore(first.snapshot());
const afterRestore = restored.dreamAssociations(memories, 'workpass317-after-restore', {
  at: 3_000,
  uncertainty01: .6,
  memoryEvidence01: .8,
  novelty01: .75,
});
assert.equal(afterRestore.generated, 0, 'association cooldown should survive restart');
assert.ok(afterRestore.deduplicated > 0);

const independentlyGenerated = new MicroDreamEngine();
const deterministic = independentlyGenerated.dreamAssociations(memories, 'workpass317-seed', {
  at: 1_000,
  uncertainty01: .6,
  memoryEvidence01: .8,
  novelty01: .75,
});
assert.deepEqual(
  deterministic.candidates.map(d => ({ id: d.id, sourceMemoryIds: d.sourceMemoryIds, sharedTerms: d.sharedTerms })),
  result.candidates.map(d => ({ id: d.id, sourceMemoryIds: d.sourceMemoryIds, sharedTerms: d.sharedTerms })),
  'fixed memory input and seed should yield deterministic association hypotheses',
);

const alreadyLinked = memories.map(m => ({ ...m, semanticLinks: [...m.semanticLinks] }));
alreadyLinked[0].semanticLinks = ['memory-memory-writes'];
const linkedKernel = new MicroDreamEngine();
const linkedResult = linkedKernel.dreamAssociations(alreadyLinked.slice(0, 2), 'linked-pair', { at: 5_000 });
assert.equal(linkedResult.generated, 0, 'already-linked memory pairs must not be proposed as new associations');

console.log('WORKPASS317_MICRO_DREAM_ASSOCIATIONS=PASS', JSON.stringify({
  generated: result.generated,
  deduplicated: repeated.deduplicated,
  sample: result.candidates[0] ? {
    ids: result.candidates[0].sourceMemoryIds,
    sharedTerms: result.candidates[0].sharedTerms,
    confidence: result.candidates[0].confidence,
    validationStatus: result.candidates[0].validationStatus,
  } : null,
}));
