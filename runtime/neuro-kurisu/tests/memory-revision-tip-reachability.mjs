import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// Two related revision-graph defects around forgetting a successor:
//
// 1. `forgetById` cleared a predecessor's `supersededById` but left its
//    `validUntilAt` closed at the now-gone successor's start, so the surviving
//    tip was unreachable in every temporal mode for the whole gap since.
// 2. `reviseContent` picked its parent as the node with `validUntilAt==null`,
//    which missed that reopened tip and fell back to the caller's (historical)
//    id. Revising then overwrote that node's existing `supersededById`, orphaning
//    the live successor and leaving a non-reciprocal edge that restore reports as
//    `invalid-supersedes-edge` — the live graph diverged from a reloaded copy.

const clone = m => structuredClone(m.snapshot());
const restoreDoctor = m => { const r = new MemoryOS2({ embeddingProvider: null }); r.restore(clone(m)); return r; };

// --- Defect 1: forgetting the tip's successor reopens the predecessor window.
const a = new MemoryOS2({ embeddingProvider: null });
const rootId = a.encode({ content: 'The reactor output reading was nominal.', kind: 'semantic', source: 'sensor' }).id;
const midId = a.reviseContent(rootId, 'The reactor output reading was elevated.').id;
const tipId = a.reviseContent(midId, 'The reactor output reading was critical.').id;
const now = Date.now();
assert.ok(a.get(midId).validUntilAt != null, 'the middle revision must be closed while the tip exists');
assert.equal(a.temporalAt(midId, now)?.id, tipId, 'the newest revision is the tip resolved at the current time');

assert.equal(a.forgetById(tipId), true, 'the unprotected tip must be forgettable');
const reopened = a.get(midId);
assert.equal(reopened.supersededById, null, 'the surviving revision must become the tip again');
assert.equal(reopened.validUntilAt, null, 'the surviving tip window must reopen so it is reachable again');
assert.equal(a.temporalAt(midId, Date.now())?.id, midId, 'the surviving tip must be reachable in current mode after the successor is forgotten');

// --- Defect 2: revising from a historical id extends the real tip, not an orphan.
const extended = a.reviseContent(rootId, 'The reactor output reading is nominal again.');
assert.ok(extended, 'a correction against a historical id must produce a revision');
const chain = a.temporalChain(rootId);
assert.equal(chain.length, 3, 'the chain must stay linear: root, surviving revision, new revision');
const tips = chain.filter(x => x.supersededById == null);
assert.equal(tips.length, 1, 'exactly one revision may be the live tip');
assert.equal(tips[0].id, extended.id, 'the new revision must be the single live tip');

// The live graph and a reloaded copy must agree: no orphaned edge, no byte drift.
assert.equal(a.indexDiagnostics().pass, true, 'the live index must be coherent');
const restored = restoreDoctor(a);
assert.equal(restored.doctor().pass, true, 'restore must not repair a non-reciprocal revision edge');
assert.equal(restored.indexDiagnostics().pass, true, 'restore must not repair an index mismatch');
assert.equal(restored.snapshot().estimatedBytes, a.budgetDiagnostics().estimatedBytes, 'live and reloaded byte accounting must agree');

// --- Defect 1 (reachability): a forgotten successor must not strand the fact.
const b = new MemoryOS2({ embeddingProvider: null });
const p = b.encode({ content: 'The harbor gate was open at dawn.', kind: 'semantic', source: 'user' }).id;
const q = b.reviseContent(p, 'The harbor gate was locked at dawn.').id;
b.forgetById(q);
assert.equal(b.temporalAt(p, Date.now())?.id, p, 'forgetting the successor must leave the predecessor recallable');
assert.equal(restoreDoctor(b).doctor().pass, true, 'the reopened chain must survive a round-trip');

console.log('MEMORY_REVISION_TIP_REACHABILITY=PASS', JSON.stringify({
  reopenedWindow: true,
  singleTip: true,
  noOrphanEdge: true,
  predecessorRecallable: true,
  byteDrift: 0,
}));
