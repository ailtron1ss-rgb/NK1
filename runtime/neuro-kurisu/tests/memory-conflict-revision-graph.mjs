import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// Implicit-conflict adjudication rewrites the revision graph (supersedes /
// supersededBy edges, valid-from/valid-until intervals, revision groups). Those
// rewrites must satisfy the same revision-graph invariant that restore's
// normalizer enforces, otherwise a live organism keeps an edge that a reloaded
// organism silently drops -- the graph diverges across a restart and the live
// copy never sees the integrity finding.

const GRAPH_FIELDS = ['supersedesId', 'supersededById', 'validFromAt', 'validUntilAt', 'revisionGroupId', 'revisionSequence'];

function buildCorpus() {
  // Contradictory same-subject pairs: shared content and context keys with
  // different values (high cosine + context conflict) but a *shared*
  // validFromAt. That shared timestamp is exactly what makes a supersession
  // edge invalid under the revision-graph invariant unless adjudication
  // advances the child time.
  const base = 1_000_000;
  const memory = new MemoryOS2({ embeddingProvider: null, metadataRecallEnabled: true });
  for (let k = 0; k < 8; k += 1) {
    memory.encode({
      content: `the system setting for service ${k} is alpha mode`,
      kind: 'semantic',
      source: `svc-${k}`,
      context: { subject: `service-${k}`, attribute: 'setting', value: 'alpha' },
      entities: [`service-${k}`, 'setting'],
      validFromAt: base,
      observedAt: base,
      revisionGroupId: `group-old-${k}`,
      revisionSequence: 1,
    });
    memory.encode({
      content: `the system setting for service ${k} is beta mode`,
      kind: 'semantic',
      source: `svc-${k}`,
      context: { subject: `service-${k}`, attribute: 'setting', value: 'beta' },
      entities: [`service-${k}`, 'setting'],
      validFromAt: base,
      observedAt: base + 1000 + k,
      revisionGroupId: `group-new-${k}`,
      revisionSequence: 1,
    });
  }
  return memory;
}

const live = buildCorpus();
const result = live.adjudicateImplicitConflicts({ at: 1_000_000_000, limit: 32, pairBudget: 192 });
assert.ok(result.resolved > 0, 'the corpus must resolve at least one implicit conflict');

const reloaded = new MemoryOS2({ embeddingProvider: null, metadataRecallEnabled: true });
reloaded.restore(structuredClone(live.snapshot()));
const liveSnap = live.snapshot();
const reloadedSnap = reloaded.snapshot();

assert.equal(liveSnap.estimatedBytes, reloadedSnap.estimatedBytes, 'byte budget must survive a reload');
assert.equal(liveSnap.items.length, reloadedSnap.items.length, 'row count must survive a reload');

let graphDiffs = 0;
let integrityDiffs = 0;
for (const liveItem of liveSnap.items) {
  const reloadedItem = reloadedSnap.items.find((item) => item.id === liveItem.id);
  assert.ok(reloadedItem, 'every live row must reload');
  for (const field of GRAPH_FIELDS) {
    if (liveItem[field] !== reloadedItem[field]) graphDiffs += 1;
  }
  if (JSON.stringify(liveItem.revisionIntegrityIssues ?? []) !== JSON.stringify(reloadedItem.revisionIntegrityIssues ?? [])) integrityDiffs += 1;
}

assert.equal(graphDiffs, 0, 'the live revision graph must equal the reloaded revision graph');
assert.equal(integrityDiffs, 0, 'live rows must not carry a graph the reloaded copy rejects');
assert.equal(live.indexDiagnostics().pass, true, 'derived indexes stay coherent through adjudication');
console.log('MEMORY_CONFLICT_REVISION_GRAPH=PASS', JSON.stringify({ resolved: result.resolved, graphDiffs, integrityDiffs }));

// One new observation may contradict several standalone historical observations.
// A single adjudication pass must choose one predecessor only; assigning multiple
// parents overwrites the child's supersedesId and leaves stale one-way supersededBy edges.
function assertSingleParentPerAdjudication() {
  const memory = new MemoryOS2({ embeddingProvider: null, metadataRecallEnabled: true });
  const base = 2_000_000;
  const values = ['alpha', 'beta', 'gamma'];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    memory.encode({
      content: `the thermostat target for room a is ${value} mode`,
      kind: 'semantic',
      source: 'sensor-room-a',
      context: { subject: 'room-a', attribute: 'thermostat-target', value },
      entities: ['room-a', 'thermostat', 'target'],
      validFromAt: base,
      observedAt: base + index * 1_000,
    });
  }
  const result = memory.adjudicateImplicitConflicts({ at: base + 10_000, limit: 32, pairBudget: 192 });
  const rows = memory.snapshot().items;
  const newest = rows.find(item => item.content.includes('gamma mode'));
  const predecessors = rows.filter(item => item.supersededById === newest?.id);
  assert.ok(newest?.supersedesId, 'newest conflicting observation must have one predecessor');
  assert.equal(predecessors.length, 1, 'a single adjudication pass must not assign multiple predecessors to one child');
  assert.equal(predecessors[0]?.id, newest.supersedesId, 'the chosen predecessor edge must be reciprocal');
  assert.equal(rows.filter(item => item.supersededById).length, 1, 'no stale one-way supersededBy edges may remain');
  assert.equal(result.resolved, 1, 'the new observation may resolve only one predecessor per pass');
  assert.equal(memory.doctor().pass, true, 'the fan-in fixture must remain valid in the live store');
  const restored = new MemoryOS2({ embeddingProvider: null, metadataRecallEnabled: true });
  restored.restore(structuredClone(memory.snapshot()));
  assert.equal(restored.doctor().pass, true, 'the fan-in fixture must remain valid after restore');
  assert.equal(restored.snapshot().estimatedBytes, memory.snapshot().estimatedBytes, 'fan-in adjudication must preserve byte accounting');
}

assertSingleParentPerAdjudication();
console.log('MEMORY_CONFLICT_SINGLE_PARENT=PASS');


// Transaction-time corrections may advance a historical predecessor's
// recordedFromAt beyond its successor. The immutable creation order still
// defines the revision edge, so restore must not discard that valid lineage.
function assertImmutableCreationOrderSurvivesTransactionTimeCorrection() {
  const base = 3_000_000;
  const memory = new MemoryOS2({ embeddingProvider: null, metadataRecallEnabled: true });
  const parent = memory.encode({
    content: 'the service policy was initially configured for the staging cluster',
    kind: 'semantic',
    source: 'revision-order-regression',
    observedAt: base,
    validFromAt: base,
  });
  const child = memory.encode({
    content: 'the service policy was later configured for the production cluster',
    kind: 'semantic',
    source: 'revision-order-regression',
    observedAt: base + 1_000,
    validFromAt: base + 1_000,
  });
  const snapshot = structuredClone(memory.snapshot());
  const parentRow = snapshot.items.find((item) => item.id === parent.id);
  const childRow = snapshot.items.find((item) => item.id === child.id);
  assert.ok(parentRow && childRow, 'both revision records must exist in the fixture');

  Object.assign(parentRow, {
    createdAt: base,
    observedAt: base,
    recordedFromAt: base + 3_000,
    recordedUntilAt: null,
    validFromAt: base,
    validUntilAt: base + 1_000,
    revisionGroupId: 'transaction-time-corrected-lineage',
    revisionSequence: 1,
    supersedesId: null,
    supersededById: child.id,
  });
  Object.assign(childRow, {
    createdAt: base + 1_000,
    observedAt: base + 1_000,
    recordedFromAt: base + 1_000,
    recordedUntilAt: null,
    validFromAt: base + 1_000,
    validUntilAt: null,
    revisionGroupId: 'transaction-time-corrected-lineage',
    revisionSequence: 2,
    supersedesId: parent.id,
    supersededById: null,
  });

  const restored = new MemoryOS2({ embeddingProvider: null, metadataRecallEnabled: true });
  restored.restore(snapshot);
  const rows = restored.snapshot().items;
  const restoredParent = rows.find((item) => item.id === parent.id);
  const restoredChild = rows.find((item) => item.id === child.id);
  assert.ok(restoredParent && restoredChild, 'both records must survive restore');
  assert.ok(restoredParent.createdAt < restoredChild.createdAt, 'fixture must retain immutable creation order');
  assert.ok(restoredParent.recordedFromAt > restoredChild.recordedFromAt, 'fixture must advance only the predecessor transaction time');
  assert.equal(restoredParent.supersededById, child.id, 'restore must preserve the parent-to-child edge');
  assert.equal(restoredChild.supersedesId, parent.id, 'restore must preserve the reciprocal child-to-parent edge');
  assert.equal((restoredParent.revisionIntegrityIssues ?? []).includes('invalid-supersedes-edge'), false);
  assert.equal((restoredChild.revisionIntegrityIssues ?? []).includes('invalid-supersedes-edge'), false);
  console.log('MEMORY_REVISION_IMMUTABLE_CREATION_ORDER=PASS');
}

assertImmutableCreationOrderSurvivesTransactionTimeCorrection();
