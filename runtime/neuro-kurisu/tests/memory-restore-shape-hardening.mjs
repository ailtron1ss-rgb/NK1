import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const source = new MemoryOS2({ embeddingProvider: null });
const seed = source.encode({
  id: 'shape-seed',
  content: 'The durable cache status for REF-228 is GREEN.',
  kind: 'semantic',
  source: 'device-observation',
  tags: ['cache', 'status'],
  context: { topic: 'cache status', device: 'REF-228' },
  salience: .8,
  emotionalWeight: .1,
  identityRelevance: .1,
  goalRelevance: .4,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .95,
  epistemicStatus: 'fact',
  entities: ['REF-228'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 10_000,
  observedAt: now - 2_000,
  provenanceClass: 'device',
  sourceAuthority01: .95,
});
const base = source.snapshot();
const seedRow = base.items.find(row => row.id === seed.id);
assert(seedRow);

const repairable = {
  ...structuredClone(seedRow),
  id: '  normalized-row  ',
  content: 'The durable cache status for REF-228 is GREEN.',
  contentHash: 'stale-content-hash',
  source: '',
  createdAt: 'not-a-timestamp',
  lastAccessAt: Number.NaN,
  salience: 'not-a-score',
  emotionalWeight: Number.POSITIVE_INFINITY,
  confidence: Number.NaN,
  epistemicStatus: 'not-a-valid-status',
  tags: ['cache', 42, null, ' status '],
  context: { topic: 'cache status', broken: 42, device: 'REF-228' },
  entities: [42, 'REF-228'],
  semanticLinks: [false, 'missing-link'],
  temporalLinks: null,
  causalLinks: ['cause-1', 7],
  contradictionLinks: [],
  semanticVector: [1, Number.NaN, 3],
  revisionHistory: [{ at: 'invalid', from: 'made-up', to: 'fact' }],
  revisionSequence: '0',
  retrievalCount: '-9',
  dormant: 'false',
};

const malformed = [
  { id: 'invalid-content-object', content: { text: 'not a memory string' }, kind: 'semantic' },
  { id: 'invalid-kind', content: 'Content exists but the memory kind is unknown.', kind: 'not-a-memory-kind' },
  { id: '   ', content: 'A blank ID cannot identify a canonical memory.', kind: 'semantic' },
  { id: 'x'.repeat(161), content: 'An oversized ID must not be indexed.', kind: 'semantic' },
  { id: 'empty-content', content: '   ', kind: 'semantic' },
];

const restored = new MemoryOS2({ embeddingProvider: null });
restored.restore({ ...structuredClone(base), items: [repairable, ...malformed] });
const rows = restored.snapshot().items;
assert.equal(rows.length, 1, 'only the valid, repairable memory should remain');
const row = rows[0];

assert.equal(row.id, 'normalized-row', 'IDs are trimmed and bounded');
assert.equal(row.content, 'The durable cache status for REF-228 is GREEN.');
assert.notEqual(row.contentHash, 'stale-content-hash', 'content hash must be rebound to restored content');
assert.equal(row.source, 'unknown', 'missing source uses a conservative provenance label');
assert.equal(row.epistemicStatus, 'unknown', 'unrecognized epistemic states fail closed');
assert.equal(row.confidence, .5, 'invalid confidence must not become a trusted fact');
assert.equal(row.salience, .5, 'invalid salience uses a bounded default');
assert.equal(row.dormant, false, 'string booleans must not be treated as true/false by coercion');
assert.equal(row.retrievalCount, 0, 'negative counters are clamped');
assert.equal(row.revisionSequence, 1, 'invalid revision sequence is normalized');
assert.deepEqual(row.tags, ['cache', 'status']);
assert.deepEqual(row.entities, ['REF-228']);
assert.deepEqual(row.semanticLinks, ['missing-link']);
assert.deepEqual(row.causalLinks, ['cause-1']);
assert.deepEqual(row.context, { topic: 'cache status', device: 'REF-228' });
assert.deepEqual(row.semanticVector, [], 'invalid derived vectors are discarded for lazy rebuild');
assert.equal(Number.isFinite(row.createdAt), true);
assert.equal(Number.isFinite(row.lastAccessAt), true);
assert.equal(row.revisionHistory.length, 0, 'invalid revision history entries are dropped');

// Invalid expiry metadata must not make a historical row appear current.
const expiring = {
  ...structuredClone(seedRow),
  id: 'invalid-expiry-row',
  content: 'The old cache setting for REF-228 was AMBER.',
  validUntilAt: 'not-a-timestamp',
  validFromAt: now - 5_000,
};
const expiryMemory = new MemoryOS2({ embeddingProvider: null });
expiryMemory.restore({ ...structuredClone(base), items: [expiring] });
const expiredRow = expiryMemory.snapshot().items[0];
assert.equal(expiredRow.validUntilAt, expiredRow.validFromAt,
  'a corrupt expiry must fail closed as an empty validity interval');
assert.equal(
  expiryMemory.retrieve('What was the old cache setting for REF-228?', 4, 0, 0, { temporalMode: 'current' }).length,
  0,
  'a row with malformed expiry must not become current',
);

const diagnostics = restored.restoreDiagnostics();
assert.equal(diagnostics.sourceRows, 6);
assert.equal(diagnostics.acceptedRows, 1);
assert.equal(diagnostics.invalidRowsDropped, 5);
const doctor = restored.doctor();
assert.equal(doctor.pass, false, 'memory doctor must expose data loss during restore');
assert.ok(doctor.issues.some(issue => issue.code === 'restore-invalid-rows-dropped'));
assert.equal(doctor.restore.invalidRowsDropped, 5);

const recalled = restored.retrieve(
  'What is the durable cache status for REF-228?',
  4,
  0,
  0,
  { temporalMode: 'current' },
);
assert.equal(recalled[0]?.id, 'normalized-row', 'normalized legacy records remain retrievable');
assert.match(recalled[0]?.content ?? '', /GREEN/, 'restored factual content remains intact');

console.log('MEMORY_RESTORE_SHAPE_HARDENING=PASS', JSON.stringify({
  sourceRows: diagnostics.sourceRows,
  acceptedRows: diagnostics.acceptedRows,
  invalidRowsDropped: diagnostics.invalidRowsDropped,
  staleHashRebound: true,
  invalidVectorDiscarded: true,
  malformedStatusDowngraded: true,
  normalizedRowStillRetrievable: true,
}));
