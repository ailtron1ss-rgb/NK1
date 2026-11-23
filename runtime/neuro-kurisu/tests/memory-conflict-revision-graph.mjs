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

if (liveSnap.estimatedBytes !== reloadedSnap.estimatedBytes) {
  const fields = ['content', 'tags', 'context', 'semanticLinks', 'temporalLinks', 'causalLinks',
    'contradictionLinks', 'evidenceSources', 'evidenceLineageKeys', 'revisionIntegrityIssues',
    'revisionHistory', 'bitemporalHistory', 'recordedFromAt', 'recordedUntilAt',
    'freshnessUntilAt', 'freshnessHalfLifeMs', 'temporalKind'];
  const rowDiffs = liveSnap.items.map((row) => {
    const restored = reloadedSnap.items.find((item) => item.id === row.id);
    if (!restored) return { id: row.id, missing: true };
    const changed = Object.fromEntries(fields
      .filter((field) => JSON.stringify(row[field] ?? null) !== JSON.stringify(restored[field] ?? null))
      .map((field) => [field, { live: row[field] ?? null, restored: restored[field] ?? null }]));
    return Object.keys(changed).length ? { id: row.id, changed } : null;
  }).filter(Boolean);
  console.log('MEMORY_CONFLICT_BYTE_DIAGNOSTICS=', JSON.stringify({
    liveBytes: liveSnap.estimatedBytes, restoredBytes: reloadedSnap.estimatedBytes,
    liveRows: liveSnap.items.length, restoredRows: reloadedSnap.items.length, rowDiffs,
  }));
}
assert.equal(liveSnap.estimatedBytes, reloadedSnap.estimatedBytes, 'byte budget must survive a reload');
assert.equal(liveSnap.items.length, reloadedSnap.items.length, 'row count must survive a reload');

let graphDiffs = 0;
let integrityDiffs = 0;
const graphDiffDetails = [];
for (const liveItem of liveSnap.items) {
  const reloadedItem = reloadedSnap.items.find((item) => item.id === liveItem.id);
  assert.ok(reloadedItem, 'every live row must reload');
  const changed = {};
  for (const field of GRAPH_FIELDS) {
    if (liveItem[field] !== reloadedItem[field]) {
      graphDiffs += 1;
      changed[field] = { live: liveItem[field] ?? null, restored: reloadedItem[field] ?? null };
    }
  }
  if (Object.keys(changed).length) graphDiffDetails.push({ id: liveItem.id, changed });
  if (JSON.stringify(liveItem.revisionIntegrityIssues ?? []) !== JSON.stringify(reloadedItem.revisionIntegrityIssues ?? [])) integrityDiffs += 1;
}
if (graphDiffs || integrityDiffs) console.log('MEMORY_CONFLICT_GRAPH_DIAGNOSTICS=', JSON.stringify({ graphDiffs, integrityDiffs, graphDiffDetails }));

assert.equal(graphDiffs, 0, 'the live revision graph must equal the reloaded revision graph');
assert.equal(integrityDiffs, 0, 'live rows must not carry a graph the reloaded copy rejects');
assert.equal(live.indexDiagnostics().pass, true, 'derived indexes stay coherent through adjudication');
console.log('MEMORY_CONFLICT_REVISION_GRAPH=PASS', JSON.stringify({ resolved: result.resolved, graphDiffs, integrityDiffs }));
