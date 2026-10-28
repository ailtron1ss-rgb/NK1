import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const base = {
  kind: 'semantic',
  source: 'restore-integrity-fixture',
  tags: ['restore-test'],
  context: { fixture: 'memory-restore-integrity' },
  salience: .6,
  emotionalWeight: .1,
  identityRelevance: .2,
  goalRelevance: .2,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 10_000,
  validUntilAt: null,
  observedAt: now - 100,
};

const source = new MemoryOS2();
source.encode({ ...base, id: 'good-unique', content: 'unique valid memory record' });
source.encode({ ...base, id: 'same-duplicate', content: 'same canonical duplicate record' });
source.encode({ ...base, id: 'conflicting-id', content: 'first conflicting memory record' });

// Live writes must preserve the same unique-ID invariant as snapshot restore.
const beforeLiveCollision = source.snapshot();
assert.throws(
  () => source.encode({ ...base, id: 'good-unique', content: 'different content with the same explicit ID' }),
  /memory-id-conflict:good-unique/,
  'an explicit ID bound to different content must fail before changing canonical memory',
);
assert.throws(
  () => source.encode({ ...base, id: 'good-unique', content: 'different content with forceDistinct', }, { forceDistinct: true }),
  /memory-id-conflict:good-unique/,
  'forceDistinct must not allow an explicit ID to overwrite an existing identity',
);
assert.deepEqual(source.snapshot(), beforeLiveCollision,
  'rejected explicit-ID conflicts must leave live memory state and indexes unchanged');

const forcedDistinct = new MemoryOS2();
const forcedFirst = forcedDistinct.encode({ ...base, content: 'repeatable forced-distinct content' });
const forcedSecond = forcedDistinct.encode({ ...base, content: 'repeatable forced-distinct content' }, { forceDistinct: true });
assert.notEqual(forcedSecond.id, forcedFirst.id,
  'forceDistinct without an explicit ID must mint a fresh ID when the content-addressed ID is occupied');
assert.equal(new Set(forcedDistinct.snapshot().items.map(item => item.id)).size, forcedDistinct.size(),
  'forced-distinct writes must keep state.items IDs unique');

const explicitIdRepeat = new MemoryOS2();
const explicitFirst = explicitIdRepeat.encode({ ...base, id: 'stable-explicit-id', content: 'same explicit identity content' });
const explicitRepeated = explicitIdRepeat.encode({ ...base, id: 'stable-explicit-id', content: 'same explicit identity content' });
assert.equal(explicitRepeated.id, explicitFirst.id, 'replaying the same explicit identity remains idempotent');
assert.equal(explicitIdRepeat.size(), 1, 'same-ID idempotent replay must not append a duplicate row');

const initial = source.snapshot();
const good = structuredClone(initial.items.find(item => item.id === 'good-unique'));
const same = structuredClone(initial.items.find(item => item.id === 'same-duplicate'));
const conflict = structuredClone(initial.items.find(item => item.id === 'conflicting-id'));
assert.ok(good && same && conflict, 'fixture memories must be created');

const duplicateLow = { ...structuredClone(same), salience: .2 };
const duplicateHigh = { ...structuredClone(same), salience: .8 };
const conflictingSecond = {
  ...structuredClone(conflict),
  content: 'second conflicting memory record',
  contentHash: 'deliberately-conflicting-content-hash',
  semanticVector: [],
};
const blankId = { ...structuredClone(good), id: '   ', content: 'blank identifier must be dropped' };
const malformedContent = { ...structuredClone(good), id: 'non-string-content', content: 17 };

const corruptedSnapshot = {
  ...initial,
  items: [good, duplicateLow, duplicateHigh, conflict, conflictingSecond, blankId, malformedContent],
};
const restored = new MemoryOS2();
const report = restored.restore(structuredClone(corruptedSnapshot));

assert.deepEqual(report, {
  sourceItems: 7,
  consideredItems: 7,
  retainedItems: 2,
  invalidRowsDropped: 2,
  duplicateIdGroups: 2,
  collapsedDuplicateRows: 1,
  conflictingDuplicateIdGroups: 1,
  conflictingDuplicateRowsDropped: 2,
  truncatedItems: 0,
}, 'restore must report invalid, collapsed, and conflicting identity rows');
assert.deepEqual(restored.restoreIntegrityDiagnostics(), report,
  'the last restore-integrity report must remain inspectable after restore returns');
assert.equal(restored.size(), 2, 'only unique, well-formed identities may enter canonical memory state');
const restoredIndexHealth = restored.indexDiagnostics();
assert.equal(restoredIndexHealth.pass, true,
  'restored canonical indexes, including metadata postings, must stay aligned after duplicate-ID repair');
assert.equal(restoredIndexHealth.metadataIndexMismatch, 0);
const restoredItems = restored.snapshot().items;
assert.equal(new Set(restoredItems.map(item => item.id)).size, restoredItems.length,
  'restored canonical state must have unique IDs');
assert.deepEqual(restoredItems.map(item => item.id).sort(), ['good-unique', 'same-duplicate'],
  'conflicting IDs must be removed rather than arbitrarily choosing one content payload');
assert.ok(restoredItems.find(item => item.id === 'same-duplicate').salience < .5,
  'deterministic stable tie-break must select the same duplicate payload independent of input order');

const reverseRestore = new MemoryOS2();
const reverseReport = reverseRestore.restore({
  ...structuredClone(corruptedSnapshot),
  items: [...structuredClone(corruptedSnapshot.items)].reverse(),
});
assert.deepEqual(reverseReport, report, 'restore integrity accounting must not depend on snapshot row order');
assert.deepEqual(reverseRestore.restoreIntegrityDiagnostics(), reverseReport,
  'restore diagnostics accessor must expose the same integrity accounting');
const normalize = memory => memory.snapshot().items
  .map(item => ({ id: item.id, content: item.content, salience: item.salience }))
  .sort((a, b) => a.id.localeCompare(b.id));
assert.deepEqual(normalize(reverseRestore), normalize(restored),
  'same-identity duplicate selection must be stable under snapshot row permutation');

console.log('MEMORY_RESTORE_ID_INTEGRITY=PASS', JSON.stringify({
  ...report,
  uniqueRetainedIds: new Set(restoredItems.map(item => item.id)).size,
  metadataIndexMismatch: restoredIndexHealth.metadataIndexMismatch,
}));
