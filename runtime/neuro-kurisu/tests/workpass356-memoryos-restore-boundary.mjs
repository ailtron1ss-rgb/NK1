import assert from 'node:assert/strict';
import { MemoryOS2, defaultMemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const memoryRow = (id, overrides = {}) => ({
  id,
  content: 'A persisted autobiographical memory: ' + id,
  contentHash: 'forged-content-hash',
  kind: 'episodic',
  createdAt: 1_700_000_000_000,
  lastAccessAt: 1_700_000_000_001,
  salience: 0.6,
  emotionalWeight: 0.2,
  identityRelevance: 0.4,
  goalRelevance: 0.3,
  socialRelevance: 0.1,
  predictionError: 0.2,
  temperature01: 0.3,
  confidence: 0.85,
  epistemicStatus: 'fact',
  source: 'restore-boundary-test',
  entities: ['memory'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  revisionHistory: [],
  dormant: false,
  retrievalCount: 3,
  semanticVector: [0.1, 0.2, 0.3],
  ...overrides,
});

const stateWith = items => ({ ...defaultMemoryOS2(), items });
const subject = new MemoryOS2();
subject.restore(stateWith([memoryRow('kept-memory')]));
const before = subject.snapshot();

assert.throws(
  () => subject.restore({ ...before, version: 8, items: [memoryRow('future-memory')] }),
  /memory-os-restore-version-unsupported/,
  'a newer persisted schema must fail before any live state is changed',
);
assert.deepEqual(subject.snapshot(), before, 'future schema rejection must leave the live memory graph untouched');

assert.throws(
  () => subject.restore([]),
  /memory-os-restore-state-must-be-a-plain-object/,
  'an array must not be mistaken for a memory state object',
);
assert.deepEqual(subject.snapshot(), before, 'malformed top-level state rejection must be non-mutating');

const legacy = stateWith([memoryRow('legacy-memory')]);
delete legacy.version;
subject.restore(legacy);
assert.equal(subject.snapshot().version, 7, 'versionless legacy snapshots should still migrate to current format');
assert.equal(subject.snapshot().items.length, 1);
assert.notEqual(subject.snapshot().items[0].contentHash, 'forged-content-hash',
  'derived content hash must be recalculated instead of trusted from the snapshot');

subject.restore(stateWith([
  memoryRow('duplicate-id'),
  memoryRow('duplicate-id', { content: 'conflicting payload with same identity' }),
  memoryRow('valid-id'),
  null,
  { ...memoryRow('bad-kind'), kind: 'untrusted-kind' },
  { ...memoryRow('control-id'), id: 'unsafe\u0000identity' },
  { ...memoryRow('overlong-content'), content: 'x'.repeat(65_537) },
]));
const recovered = subject.snapshot();
assert.deepEqual(recovered.items.map(item => item.id), ['valid-id'],
  'malformed rows and every row with a colliding identity must be removed before rebuilding indexes');
assert.equal(subject.doctor({ maxIssues: 20 }).pass, true,
  'the recovered canonical memory graph must pass its read-only integrity doctor');

subject.restore(stateWith([
  memoryRow('sanitized-fields', {
    confidence: Number.NaN,
    epistemicStatus: 'untrusted-status',
    semanticVector: [0.1, Number.NaN, 0.3],
    semanticLinks: ['valid-link', 17, null],
    dormant: 'false',
    retrievalCount: -5,
  }),
]));
const sanitized = subject.snapshot().items[0];
assert.equal(sanitized.confidence, 0, 'non-finite confidence must fail closed');
assert.equal(sanitized.epistemicStatus, 'unknown', 'unsupported epistemic labels must not become facts');
assert.deepEqual(sanitized.semanticVector, [], 'a vector containing non-finite values must not enter retrieval indexes');
assert.deepEqual(sanitized.semanticLinks, ['valid-link'], 'non-string memory links must be discarded');
assert.equal(sanitized.dormant, false, 'truthy strings must not change lifecycle state');
assert.equal(sanitized.retrievalCount, 0, 'negative access counts must be normalized');

console.log('WORKPASS356_MEMORYOS_RESTORE_BOUNDARY=PASS');
