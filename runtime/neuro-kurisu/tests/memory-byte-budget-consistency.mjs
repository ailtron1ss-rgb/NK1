import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// estimatedBytes drives the durable eviction budget, so it must always equal the
// true sum of per-item byte estimates. Restore recomputes that sum from scratch,
// so a snapshot/restore round-trip is an independent oracle: any incremental
// accounting bug (a forgotten subtraction, an untracked link edit) shows up as a
// nonzero drift here. These paths previously leaked bytes.

const recompute = (memory) => {
  const restored = new MemoryOS2({ embeddingProvider: null });
  restored.restore(structuredClone(memory.snapshot()));
  return restored.snapshot().estimatedBytes;
};
const assertConsistent = (memory, label) => {
  assert.equal(memory.snapshot().estimatedBytes, recompute(memory), `byte accounting drifted after ${label}`);
};

// 1. Forgetting a linked memory prunes surviving link arrays; the shrink must be
//    reflected in the budget or estimatedBytes stays permanently inflated.
const forgetful = new MemoryOS2({ embeddingProvider: null });
const forgetIds = [];
for (let i = 0; i < 60; i += 1) {
  forgetIds.push(forgetful.encode({ content: `subsystem memory observation about verification topic${i % 5} detail${i}`, kind: 'episodic', source: 'byte-budget', tags: ['t'] }).id);
}
assertConsistent(forgetful, 'initial encode');
for (const id of forgetIds.slice(0, 20)) assert.ok(forgetful.forgetById(id, 'byte-budget-test'));
assertConsistent(forgetful, 'forgetById with link pruning');
for (const id of forgetIds.slice(20)) forgetful.forgetById(id, 'byte-budget-test');
assert.equal(forgetful.size(), 0, 'every non-protected memory should be forgettable');
assertConsistent(forgetful, 'forget everything');

// 2. The 1600-item capacity cap silently pops the oldest record; that removal must
//    subtract its bytes exactly once.
const capacity = new MemoryOS2({ embeddingProvider: null });
for (let i = 0; i < 1700; i += 1) {
  capacity.encode({ content: `capacity topic${i % 17} word${i % 11} observation ${i}`, kind: 'episodic', source: 'byte-budget', tags: ['t'] });
}
assert.equal(capacity.size(), 1600, 'corpus stays capped at 1600');
assertConsistent(capacity, 'capacity eviction');

// 3. Encoding a contradiction grows the linked item's contradictionLinks in place.
const contradicting = new MemoryOS2({ embeddingProvider: null });
contradicting.encode({ content: 'the server is running and healthy today', kind: 'semantic', source: 'byte-budget', tags: ['t'], entities: ['server', 'health'] });
contradicting.encode({ content: 'the server is not running and healthy today', kind: 'semantic', source: 'byte-budget', tags: ['t'], entities: ['server', 'health'] });
assertConsistent(contradicting, 'contradiction link growth');

// 4. A revision forks a new record and rewrites the parent; both edits are accounted.
const revising = new MemoryOS2({ embeddingProvider: null });
const tip = revising.encode({ content: 'the deployment target is staging cluster', kind: 'semantic', source: 'byte-budget', tags: ['t'] }).id;
revising.reviseContent(tip, 'the deployment target is production cluster', { reason: 'correction' });
assertConsistent(revising, 'content revision');
revising.revise(tip, 'quarantined', 'byte-budget-test');
assertConsistent(revising, 'status revision');
revising.updateSignals(tip, { salience: .9, confidence: .2 }, 'reconsolidation');
assertConsistent(revising, 'signal update');

// 5. Adjudicating an implicit conflict grows contradictionLinks on both records.
const conflicting = new MemoryOS2();
const conflictBase = 1_000_000;
conflicting.encode({ content: 'Alice lives in Berlin', kind: 'semantic', source: 'user', tags: [], context: { subject: 'alice', attribute: 'city', value: 'berlin' }, salience: .7, confidence: .85, epistemicStatus: 'fact', entities: ['alice', 'berlin'], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: conflictBase, validUntilAt: null, observedAt: conflictBase, supersedesId: null, supersededById: null, revisionGroupId: 'g:alice-city', revisionSequence: 1 });
conflicting.encode({ content: 'Alice lives in Paris', kind: 'semantic', source: 'user', tags: [], context: { subject: 'alice', attribute: 'city', value: 'paris' }, salience: .75, confidence: .9, epistemicStatus: 'fact', entities: ['alice', 'paris'], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: conflictBase + 10_000, validUntilAt: null, observedAt: conflictBase + 10_000, supersedesId: null, supersededById: null, revisionGroupId: 'g:new', revisionSequence: 1 });
assert.equal(conflicting.adjudicateImplicitConflicts({ at: conflictBase + 10_001, limit: 16, pairBudget: 64 }).resolved, 1, 'the contradictory pair must resolve');
assertConsistent(conflicting, 'implicit conflict adjudication');

// 6. A mixed workload must still reconcile exactly.
const mixed = new MemoryOS2({ embeddingProvider: null });
const mixedIds = [];
for (let i = 0; i < 400; i += 1) {
  mixedIds.push(mixed.encode({ content: `mixed workload memory ${i % 19} about subsystem ${i}`, kind: i % 3 ? 'episodic' : 'semantic', source: 'byte-budget', tags: ['workload'] }).id);
}
for (let i = 0; i < 400; i += 5) mixed.forgetById(mixedIds[i], 'byte-budget-test');
mixed.maintain({ pressure01: .9 });
assertConsistent(mixed, 'mixed encode/forget/maintain');

console.log('MEMORY_BYTE_BUDGET_CONSISTENCY=PASS', JSON.stringify({ capacity: capacity.size(), mixed: mixed.size(), forgotten: forgetful.size() }));
