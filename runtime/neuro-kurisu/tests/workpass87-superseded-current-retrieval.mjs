import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const memory = new MemoryOS2();
const parent = memory.encode({
  content: 'The previous project codename Neuro-Kurisu is an obsolete identity reference.',
  kind: 'semantic',
  source: 'workpass87-superseded-current-retrieval',
  tags: ['workpass87'],
  context: {},
  salience: 0.8,
  emotionalWeight: 0.1,
  identityRelevance: 0.4,
  goalRelevance: 0.3,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 10_000,
  validUntilAt: null,
  observedAt: now - 10_000,
  provenanceClass: 'agent',
}, { clone: false });

const replacement = memory.reviseContent(parent.id,
  'The canonical project identity is NeuroCore; Neuro-Kurisu is a superseded name.',
  { validAt: now - 5_000, reason: 'canonical identity correction' });
assert.ok(replacement, 'revision should produce a replacement memory');
assert.notEqual(replacement.id, parent.id);

const damagedSnapshot = memory.snapshot();
const damagedParent = damagedSnapshot.items.find(item => item.id === parent.id);
assert.ok(damagedParent, 'parent revision must exist in the snapshot');
// Simulate a damaged/legacy snapshot whose supersession pointer survived but whose
// validity interval end was lost. Current answers must not revive this obsolete fact.
damagedParent.validUntilAt = null;
damagedParent.supersededById = replacement.id;

const restored = new MemoryOS2();
restored.restore(damagedSnapshot);
const before = restored.implicitConflictDiagnostics().staleRetrievalsAvoided;
const currentHits = restored.retrieve(
  'previous project codename Neuro-Kurisu obsolete identity reference',
  8, 0, 0, { temporalMode: 'current' }, true,
);
assert.equal(currentHits.some(item => item.id === parent.id), false,
  'current retrieval must suppress a superseded record with a missing validity end');
assert.ok(restored.implicitConflictDiagnostics().staleRetrievalsAvoided > before,
  'suppressed damaged superseded records must be observable in diagnostics');

const archiveHits = restored.retrieve(
  'previous project codename Neuro-Kurisu obsolete identity reference',
  8, 0, 0, { temporalMode: 'all' }, true,
);
assert.ok(archiveHits.some(item => item.id === parent.id),
  'explicit archival retrieval must retain inspectability of historical revisions');

console.log('WORKPASS87_SUPERSEDED_CURRENT_RETRIEVAL=PASS', JSON.stringify({
  currentReturnedSupersededRecord: currentHits.some(item => item.id === parent.id),
  archivalContainsHistoricalRecord: archiveHits.some(item => item.id === parent.id),
  staleSuppressionCounterDelta: restored.implicitConflictDiagnostics().staleRetrievalsAvoided - before,
}));
