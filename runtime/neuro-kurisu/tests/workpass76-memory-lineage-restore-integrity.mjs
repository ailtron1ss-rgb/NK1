import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const baseAt = Date.now() - 30_000;
const memory = new MemoryOS2();
const parent = memory.encode({
  content: 'The project uses the legacy Neuro-Kurisu identity.',
  kind: 'semantic',
  source: 'workpass76-lineage-test',
  tags: ['lineage'],
  context: { project: 'NK1' },
  salience: 0.8,
  emotionalWeight: 0.1,
  identityRelevance: 0.5,
  goalRelevance: 0.5,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.9,
  epistemicStatus: 'fact',
  entities: ['NK1'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: baseAt,
  observedAt: baseAt,
  provenanceClass: 'agent',
}, { clone: false });

const middle = memory.reviseContent(parent.id,
  'The project is named NeuroCore; Neuro-Kurisu is the former identity.',
  { validAt: baseAt + 10_000, reason: 'canonical identity update' });
assert.ok(middle);
const tip = memory.reviseContent(middle.id,
  'NeuroCore is the canonical NK1 project identity.',
  { validAt: baseAt + 20_000, reason: 'identity clarification' });
assert.ok(tip);

const damaged = memory.snapshot();
const damagedParent = damaged.items.find(item => item.id === parent.id);
assert.ok(damagedParent);
damagedParent.validUntilAt = null;
const restored = new MemoryOS2();
restored.restore(damaged);
assert.equal(restored.get(parent.id)?.validUntilAt, middle.validFromAt,
  'restore must reconstruct a missing interval end from a verified reciprocal successor');
assert.equal(restored.temporalAt(parent.id, Date.now())?.id, tip.id,
  'current temporal lookup must resolve to the newest verified revision');

// A one-sided edge must not be trusted as a revision relationship.
const oneSided = memory.snapshot();
const oneSidedParent = oneSided.items.find(item => item.id === parent.id);
const oneSidedChild = oneSided.items.find(item => item.id === middle.id);
assert.ok(oneSidedParent && oneSidedChild);
oneSidedParent.supersededById = 'missing-revision-id';
oneSidedChild.supersedesId = parent.id;
const oneSidedRestored = new MemoryOS2();
oneSidedRestored.restore(oneSided);
assert.equal(oneSidedRestored.get(parent.id)?.supersededById, null);
assert.equal(oneSidedRestored.get(middle.id)?.supersedesId, null);

// Cross-lineage links are invalid even when both IDs exist and pointers are reciprocal.
const crossLineage = memory.snapshot();
const crossParent = crossLineage.items.find(item => item.id === parent.id);
const crossChild = crossLineage.items.find(item => item.id === middle.id);
assert.ok(crossParent && crossChild);
crossParent.revisionGroupId = 'unrelated-lineage';
crossParent.supersededById = middle.id;
crossChild.supersedesId = parent.id;
const crossRestored = new MemoryOS2();
crossRestored.restore(crossLineage);
assert.equal(crossRestored.get(parent.id)?.supersededById, null);
assert.equal(crossRestored.get(middle.id)?.supersedesId, null);

// Duplicate IDs make references ambiguous; drop all copies, not whichever row happened to load last.
const duplicated = memory.snapshot();
duplicated.items.push(structuredClone(duplicated.items.find(item => item.id === middle.id)));
const duplicateRestored = new MemoryOS2();
duplicateRestored.restore(duplicated);
assert.equal(duplicateRestored.get(middle.id), null);
assert.equal(duplicateRestored.get(parent.id)?.supersededById, null);
const duplicateReport = duplicateRestored.doctor();
assert.equal(duplicateReport.counts.duplicateIds, 1,
  'doctor must retain evidence that restore dropped an ambiguous duplicate ID');
assert.ok(duplicateReport.issues.some(issue => issue.code === 'duplicate-memory-id-dropped'),
  'dropped duplicate IDs must be visible in the restore integrity report');
assert.equal(duplicateReport.pass, false,
  'a snapshot that required dropping ambiguous memory records must not be reported clean');

const oneSidedReport = oneSidedRestored.doctor();
assert.equal(oneSidedReport.counts.danglingRevision, 1,
  'danglingRevision must count only missing revision targets');
assert.equal(oneSidedReport.counts.invalidRevisionEdges, 2,
  'non-reciprocal edge findings must have their own diagnostic count');
assert.equal(oneSidedReport.counts.revisionRestoreFindings, 3,
  'all restore-time revision repairs must remain visible to the doctor');

// Invalid revision counters must not survive restore as ordering authority.
const invalidSequence = memory.snapshot();
const invalidTip = invalidSequence.items.find(item => item.id === tip.id);
assert.ok(invalidTip);
invalidTip.revisionSequence = Number.POSITIVE_INFINITY;
const sequenceRestored = new MemoryOS2();
sequenceRestored.restore(invalidSequence);
assert.equal(sequenceRestored.get(tip.id)?.revisionSequence, 1);

console.log('WORKPASS76_MEMORY_LINEAGE_RESTORE_INTEGRITY=PASS', JSON.stringify({
  restoredRevisionTip: restored.temporalAt(parent.id, Date.now())?.id === tip.id,
  repairedInterval: restored.get(parent.id)?.validUntilAt === middle.validFromAt,
  oneSidedEdgesCleared: oneSidedRestored.get(parent.id)?.supersededById === null &&
    oneSidedRestored.get(middle.id)?.supersedesId === null,
  crossLineageEdgesCleared: crossRestored.get(parent.id)?.supersededById === null &&
    crossRestored.get(middle.id)?.supersedesId === null,
  duplicateCopiesDropped: duplicateRestored.get(middle.id) === null,
  invalidSequenceNormalized: sequenceRestored.get(tip.id)?.revisionSequence === 1,
}));
