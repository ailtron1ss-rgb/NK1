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
