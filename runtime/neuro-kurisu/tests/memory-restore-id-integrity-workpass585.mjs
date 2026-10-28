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
assert.equal(restored.size(), 2, 'only unique, well-formed identities may enter canonical memory state');
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
const normalize = memory => memory.snapshot().items
  .map(item => ({ id: item.id, content: item.content, salience: item.salience }))
  .sort((a, b) => a.id.localeCompare(b.id));
assert.deepEqual(normalize(reverseRestore), normalize(restored),
  'same-identity duplicate selection must be stable under snapshot row permutation');

console.log('MEMORY_RESTORE_ID_INTEGRITY=PASS', JSON.stringify(report));
