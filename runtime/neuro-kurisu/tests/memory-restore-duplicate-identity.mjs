import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const original = new MemoryOS2({ embeddingProvider: null });
const seed = original.encode({
  id: 'relay-kx-741',
  content: 'The current relay configuration for KX-741 is SAFE-GREEN.',
  kind: 'semantic',
  source: 'independent-observation',
  tags: ['relay', 'configuration'],
  context: { topic: 'relay configuration' },
  salience: .7,
  emotionalWeight: .1,
  identityRelevance: .1,
  goalRelevance: .6,
  socialRelevance: .1,
  predictionError: .2,
  confidence: .95,
  epistemicStatus: 'fact',
  entities: ['KX-741'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 30_000,
  validUntilAt: null,
  observedAt: now - 5_000,
  provenanceClass: 'device',
  sourceAuthority01: .95,
});
const base = original.snapshot();
const seedRow = base.items.find(row => row.id === seed.id);
assert(seedRow, 'fixture must include its canonical row');

function makeRevision(content, revisionSequence, createdAt, observedAt, validFromAt, validUntilAt) {
  return {
    ...structuredClone(seedRow),
    content,
    contentHash: undefined,
    revisionGroupId: 'relay-kx-741-history',
    revisionSequence,
    createdAt,
    lastAccessAt: createdAt,
    observedAt,
    validFromAt,
    validUntilAt,
    retrievalCount: 0,
    dormant: false,
    epistemicStatus: 'fact',
    confidence: .95,
  };
}

const retired = makeRevision(
  'The retired relay configuration for KX-741 was SAFE-RED.',
  1,
  now - 90_000,
  now - 90_000,
  now - 120_000,
  now - 60_000,
);
const current = makeRevision(
  'The current relay configuration for KX-741 is SAFE-GREEN.',
  2,
  now - 5_000,
  now - 5_000,
  now - 30_000,
  null,
);

function restore(rows) {
  const memory = new MemoryOS2({ embeddingProvider: null });
  memory.restore({ ...structuredClone(base), items: rows });
  return memory;
}

// Corrupt/imported snapshots may accidentally repeat an ID. The more recent,
// higher revision must win independent of the array order; an ID must index only
// one canonical memory row after restore.
for (const rows of [[retired, current], [current, retired]]) {
  const restored = restore(rows);
  const rowsForId = restored.snapshot().items.filter(row => row.id === seed.id);
  assert.equal(rowsForId.length, 1, 'duplicate memory IDs must collapse to one canonical row');
  assert.equal(rowsForId[0].content, current.content, 'higher revision/current memory must win deterministically');
  const diagnostics = restored.restoreDiagnostics();
  assert.equal(diagnostics.sourceRows, 2);
  assert.equal(diagnostics.acceptedRows, 1);
  assert.equal(diagnostics.duplicateIdsResolved, 1);
  assert.equal(diagnostics.identityConflictsQuarantined, 0);

  const recalled = restored.retrieve(
    'What is the current relay configuration for KX-741?',
    5,
    0,
    0,
    { temporalMode: 'current' },
  );
  assert.equal(recalled[0]?.id, seed.id, 'current identifier lookup must still work after restore');
  assert.match(recalled[0]?.content ?? '', /SAFE-GREEN/, 'recall must use the current revision, not the retired fact');
}

// Two payloads tied on temporal/revision authority cannot be resolved by snapshot
// order or confidence. Preserve a deterministic row but quarantine it so recall
// fails closed rather than presenting one disputed claim as a verified fact.
const tiedA = makeRevision(
  'The current relay configuration for KX-741 is SAFE-GREEN.',
  4, now - 5_000, now - 5_000, now - 30_000, null,
);
const tiedB = makeRevision(
  'The current relay configuration for KX-741 is SAFE-BLUE.',
  4, now - 5_000, now - 5_000, now - 30_000, null,
);
const conflicted = restore([tiedA, tiedB, null, { content: 'missing id is not a memory identity' }]);
const conflictRows = conflicted.snapshot().items.filter(row => row.id === seed.id);
assert.equal(conflictRows.length, 1);
assert.equal(conflictRows[0].epistemicStatus, 'quarantined', 'equal-authority conflicting facts must be quarantined');
assert.equal(conflictRows[0].confidence, 0, 'conflicted identity must not retain factual confidence');
assert.equal(conflicted.restoreDiagnostics().identityConflictsQuarantined, 1);
assert.equal(conflicted.restoreDiagnostics().invalidRowsDropped, 2);
assert.deepEqual(
  conflicted.retrieve('What is the current relay configuration for KX-741?', 5, 0, 0, { temporalMode: 'current' }),
  [],
  'a tied duplicate-ID conflict must not leak into current recall',
);

console.log('MEMORY_RESTORE_DUPLICATE_IDENTITY=PASS', JSON.stringify({
  duplicateIdRowsResolved: 1,
  tiedIdentityConflictsQuarantined: 1,
  invalidRowsDropped: 2,
  orderIndependentRevisionSelection: true,
  disputedFactRecallBlocked: true,
}));
