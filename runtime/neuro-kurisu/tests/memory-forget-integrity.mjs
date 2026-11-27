import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// Forget is the only operation that promises a memory is gone. A store that keeps a derived
// index, a reverse link, or a restorable snapshot row around still returns it after a restart,
// which is exactly the failure mode a user cannot see from the outside.
const now = Date.now();
const target = 'm-target';

const build = () => {
    const memory = new MemoryOS2();
    const encode = (id, content, extras = {}) => memory.encode({
        id, content, kind: 'episodic', source: 'forget-fixture', tags: ['forget-integrity'],
        context: { fixture: 'forget-integrity' },
        salience: .6, emotionalWeight: .2, identityRelevance: .2, goalRelevance: .3, socialRelevance: .1,
        predictionError: .1, confidence: .9, epistemicStatus: 'fact',
        entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
        validFromAt: now - 10_000, provenanceClass: 'external', sourceAuthority01: .9, observedAt: now - 1_000,
        ...extras,
    });
    encode(target, 'vault access combination KX-VAULT-7731 rotation');
    encode('m-a', 'vault maintenance checklist rotation', { semanticLinks: [target], causalLinks: [target] });
    encode('m-b', 'unrelated grocery note about oat milk', { temporalLinks: [target] });
    encode('m-c', 'vault audit trail entry rotation', { contradictionLinks: [target] });
    encode('m-d', 'office plant watering schedule rotation');
    return memory;
};

const memory = build();
const before = memory.snapshot();
const beforeBytes = memory.budgetDiagnostics().estimatedBytes;
const beforeCount = memory.statsLight().items;

const hitsBefore = memory.retrieve('vault access combination KX-VAULT-7731', 5).map((item) => item.id);
assert.ok(hitsBefore.includes(target), `the fixture must be retrievable before forget, got ${hitsBefore.join(',')}`);

const removed = memory.forgetById(target, 'user-forget-request');
assert.equal(removed, true, 'forgiving an existing record must report success');
assert.equal(memory.forgetById(target, 'user-forget-request'), false, 'a second forget of the same id must report that nothing was removed');
assert.equal(memory.forgetById('never-existed'), false, 'forgetting an unknown id must not claim success');

const after = memory.snapshot();
const ids = after.items.map((item) => item.id);
assert.equal(ids.includes(target), false, 'the canonical store must not keep the forgotten row');
assert.equal(ids.length, beforeCount - 1, 'exactly one row must disappear');
assert.equal(memory.statsLight().items, beforeCount - 1);
assert.ok(memory.budgetDiagnostics().estimatedBytes < beforeBytes, 'byte accounting must shrink with the row');
assert.equal(memory.memoryAccountingDiagnostics().exact, true, 'byte accounting must stay exact after forget, not approximate');

const hitsAfter = memory.retrieve('vault access combination KX-VAULT-7731', 5).map((item) => item.id);
assert.equal(hitsAfter.includes(target), false, `retrieval must not return a forgotten memory, got ${hitsAfter.join(',')}`);

// Derived indexes and reverse links are the usual residue: a forgotten row that is still
// reachable through a neighbour's link list can be re-expanded by graph retrieval.
for (const row of after.items) {
    for (const field of ['semanticLinks', 'temporalLinks', 'causalLinks', 'contradictionLinks']) {
        assert.equal(
            (row[field] ?? []).includes(target),
            false,
            `${row.id}.${field} still references the forgotten memory`,
        );
    }
}

// Restart is the real test: a snapshot taken after forget must not resurrect the row.
const restarted = new MemoryOS2();
restarted.restore(structuredClone(memory.snapshot()));
assert.equal(restarted.snapshot().items.some((item) => item.id === target), false, 'restore must not resurrect a forgotten row');
assert.equal(
    restarted.retrieve('vault access combination KX-VAULT-7731', 5).map((item) => item.id).includes(target),
    false,
    'retrieval after restart must not return a forgotten row',
);
assert.equal(restarted.memoryAccountingDiagnostics().exact, true, 'restored accounting must stay exact');

// The rows that only shared a topic must survive; forget must not be contagious.
for (const id of ['m-a', 'm-b', 'm-c', 'm-d']) {
    assert.ok(restarted.snapshot().items.some((item) => item.id === id), `${id} must survive a forget of its neighbour`);
}

console.log(`MEMORY_FORGET_INTEGRITY=PASS ${JSON.stringify({
    before: { items: beforeCount, bytes: beforeBytes },
    after: { items: restarted.statsLight().items, bytes: restarted.budgetDiagnostics().estimatedBytes },
    retrievalHitsBefore: hitsBefore.length,
    retrievalHitsAfter: hitsAfter.length,
    exactAccounting: restarted.memoryAccountingDiagnostics().exact,
})}`);
