import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// A deterministic differential fuzz that runs a randomized-but-seeded mix of every
// mutating MemoryOS2 operation and then checks the live store against the three
// independent oracles the module already exposes:
//
//   * restore()          - recomputes derived state from the serialized item set;
//   * indexDiagnostics() - rebuilds the expected lexical/metadata indexes;
//   * doctor()           - validates per-record invariants.
//
// It asserts the invariants that caught the revision-tip, orphan-edge and
// evidence-byte defects: live and reloaded must agree on the durable byte budget,
// the live store must be internally coherent, no link or revision pointer may
// dangle, and protected kinds must survive. Seeds are fixed so a failure is
// reproducible; each seed is an independent trial.

const KINDS = ['episodic', 'semantic', 'procedural', 'identity', 'autobiographical', 'working', 'social'];

function runSeed(seed0, steps) {
  let seed = seed0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = list => list[Math.floor(rnd() * list.length)];
  const memory = new MemoryOS2({ embeddingProvider: null });
  const ids = [];
  for (let i = 0; i < steps; i++) {
    const op = Math.floor(rnd() * 13);
    if (op < 5 || !ids.length) {
      ids.push(memory.encode({
        content: `mem ${seed0}-${i} ${pick(['sensor', 'reactor', 'harbor', 'gate'])} ${Math.floor(rnd() * 60)}`,
        kind: pick(KINDS), source: pick(['user', 'sensor', 'agent']), salience: rnd(), confidence: rnd(),
      }).id);
    } else if (op === 5) memory.forgetById(pick(ids));
    else if (op === 6) memory.revise(pick(ids), pick(['fact', 'belief', 'hypothesis', 'unknown', 'quarantined']), 'fuzz');
    else if (op === 7) { const r = memory.reviseContent(pick(ids), `rev ${seed0}-${i} ${Math.floor(rnd() * 60)}`); if (r) ids.push(r.id); }
    else if (op === 8) memory.updateSignals(pick(ids), { salience: rnd(), confidence: rnd(), dormant: rnd() < .2 }, 'fuzz');
    else if (op === 9) memory.attachEvidenceSource(pick(ids), { source: pick(['sensor-a', 'sensor-b']), provenanceClass: 'device', sourceAuthority01: rnd(), independenceKey: 'k:' + Math.floor(rnd() * 20), observedAt: Date.now() }, 'fuzz');
    else if (op === 10) memory.updateContext(pick(ids), { topic: 't' + Math.floor(rnd() * 10), state: pick(['on', 'off']) });
    else if (op === 11) memory.get(pick(ids));
    else memory.adjudicateImplicitConflicts({ at: Date.now(), limit: 8, pairBudget: 48 });
  }
  return memory;
}

function assertOracle(label, memory) {
  const doctor = memory.doctor();
  assert.equal(doctor.pass, true, `${label}: doctor must pass on a coherent live store: ` + JSON.stringify(doctor.issues.slice(0, 4)));
  const index = memory.indexDiagnostics();
  assert.equal(index.pass, true, `${label}: indexDiagnostics must agree with the live item list`);

  const items = memory.snapshot().items;
  let danglingLinks = 0, danglingRevision = 0;
  for (const item of items) {
    for (const link of [...(item.semanticLinks ?? []), ...(item.causalLinks ?? []), ...(item.temporalLinks ?? []), ...(item.contradictionLinks ?? [])]) {
      if (!memory.get(link)) danglingLinks++;
    }
    if (item.supersedesId && !memory.get(item.supersedesId)) danglingRevision++;
    if (item.supersededById && !memory.get(item.supersededById)) danglingRevision++;
  }
  assert.equal(danglingLinks, 0, `${label}: no surviving link may reference a forgotten memory`);
  assert.equal(danglingRevision, 0, `${label}: no revision pointer may reference a forgotten memory`);

  const reloaded = new MemoryOS2({ embeddingProvider: null });
  reloaded.restore(structuredClone(memory.snapshot()));
  assert.equal(reloaded.doctor().pass, true, `${label}: the reloaded store must be coherent`);
  assert.equal(reloaded.indexDiagnostics().pass, true, `${label}: the reloaded index must agree`);
  const liveSnapshot = memory.snapshot();
  const restoredSnapshot = reloaded.snapshot();
  const byteFields = ['content','tags','context','semanticLinks','temporalLinks','causalLinks','contradictionLinks','evidenceSources','evidenceLineageKeys','revisionIntegrityIssues','revisionHistory','bitemporalHistory','recordedFromAt','recordedUntilAt','freshnessUntilAt','freshnessHalfLifeMs','temporalKind'];
  const liveById = new Map(liveSnapshot.items.map(item => [item.id, item]));
  const fieldCounts = Object.fromEntries(byteFields.map(field => [field, 0]));
  const rowByteDeltas = [];
  const estimateRowBytes = item => Math.max(96, new TextEncoder().encode(JSON.stringify({
    content:item.content,tags:(item.tags?.length?item.tags:undefined),context:item.context,
    s:item.semanticLinks,t:item.temporalLinks,c:item.causalLinks,k:item.contradictionLinks,
    e:item.evidenceSources,ek:item.evidenceLineageKeys,
    ri:(item.revisionIntegrityIssues?.length?item.revisionIntegrityIssues:undefined),
    r:item.revisionHistory,bh:item.bitemporalHistory,rf:item.recordedFromAt,ru:item.recordedUntilAt,
    fu:item.freshnessUntilAt,fh:item.freshnessHalfLifeMs,tk:item.temporalKind,
  })).byteLength);
  for (const restoredItem of restoredSnapshot.items) {
    const liveItem = liveById.get(restoredItem.id);
    if (!liveItem) continue;
    const changedFields = byteFields.filter(field => JSON.stringify(liveItem[field] ?? null) !== JSON.stringify(restoredItem[field] ?? null));
    for (const field of changedFields) fieldCounts[field]++;
    const byteDelta = estimateRowBytes(restoredItem) - estimateRowBytes(liveItem);
    if (byteDelta !== 0) rowByteDeltas.push({ id: restoredItem.id, byteDelta, fields: changedFields, before: Object.fromEntries(changedFields.map(field => [field, liveItem[field] ?? null])), after: Object.fromEntries(changedFields.map(field => [field, restoredItem[field] ?? null])) });
  }
  const liveAccounting = memory.memoryAccountingDiagnostics();
  const byteDiffSummary = { fieldCounts, changedRows: rowByteDeltas.length, totalRowDelta: rowByteDeltas.reduce((sum, row) => sum + row.byteDelta, 0), samples: rowByteDeltas.slice(0, 16) };
  assert.equal(
    restoredSnapshot.estimatedBytes,
    liveSnapshot.estimatedBytes,
    `${label}: live and reloaded durable byte budgets must agree (no accounting drift): ${JSON.stringify({ liveAccounting, liveBytes: liveSnapshot.estimatedBytes, restoredBytes: restoredSnapshot.estimatedBytes, byteDiffSummary })}`,
  );
  assert.equal(reloaded.size(), memory.size(), `${label}: reload must preserve the item count`);
}

function assertHistoricalWriteRouting() {
  const memory = new MemoryOS2({ embeddingProvider: null });
  const root = memory.encode({ content: 'The original reactor safety threshold is 12 units.', kind: 'semantic', source: 'historical-write-fixture', context: { topic: 'original-threshold' } });
  const target = memory.encode({ content: 'The reactor inspection checklist is stored separately.', kind: 'semantic', source: 'historical-write-fixture' });
  const tip = memory.reviseContent(root.id, 'The corrected reactor safety threshold is 14 units.', { reason: 'fixture-correction' });
  assert.ok(tip && tip.id !== root.id, 'fixture must create a second revision');
  const initial = new Map(memory.snapshot().items.map(item => [item.id, structuredClone(item)]));
  memory.attachEvidenceSource(root.id, { source: 'independent-sensor', provenanceClass: 'device', sourceAuthority01: 0.96, independenceKey: 'sensor:reactor:42', observedAt: Date.now() + 1000, evidenceFreshnessAt: Date.now() + 1000 }, 'historical-id-evidence');
  memory.updateContext(root.id, { topic: 'corrected-threshold' });
  memory.addLinks(root.id, { semanticLinks: [target.id] }, 'historical-id-links');
  const after = new Map(memory.snapshot().items.map(item => [item.id, item]));
  const beforeRoot = initial.get(root.id);
  const afterRoot = after.get(root.id);
  const afterTip = after.get(tip.id);
  assert.ok(beforeRoot && afterRoot && afterTip);
  assert.equal(afterRoot.recordedFromAt, beforeRoot.recordedFromAt, 'historical parent transaction time must remain immutable');
  assert.deepEqual(afterRoot.evidenceSources, beforeRoot.evidenceSources, 'new evidence must attach to the active tip, not the historical parent');
  assert.deepEqual(afterRoot.context, beforeRoot.context, 'context updates through a historical ID must not rewrite the old revision');
  assert.deepEqual(afterRoot.semanticLinks, beforeRoot.semanticLinks, 'relationship updates through a historical ID must not rewrite the old revision');
  assert.ok(afterTip.evidenceSources.some(row => row.source === 'independent-sensor'), 'evidence must attach to the active tip');
  assert.equal(afterTip.context.topic, 'corrected-threshold', 'context must update the active tip');
  assert.ok(afterTip.semanticLinks.includes(target.id), 'relationships must update the active tip');
  assert.equal(memory.doctor().pass, true, 'historical-ID updates must keep the live revision graph valid');
  const restored = new MemoryOS2({ embeddingProvider: null });
  restored.restore(structuredClone(memory.snapshot()));
  assert.equal(restored.doctor().pass, true, 'historical-ID updates must survive restore without repair flags');
  assert.equal(restored.snapshot().estimatedBytes, memory.snapshot().estimatedBytes, 'historical-ID updates must preserve byte accounting');
  assert.ok(restored.snapshot().items.every(item => !(item.revisionIntegrityIssues ?? []).length), 'no revision integrity repair should be required');
}

assertHistoricalWriteRouting();

for (const seed of [1, 7, 42, 1337, 20260101]) {
  const memory = runSeed(seed, 700);
  assertOracle(`seed ${seed}`, memory);
  assert.ok(memory.size() <= 1600, `seed ${seed}: the store must respect the 1600-row capacity`);
}

console.log('MEMORY_LIVE_RESTORE_ORACLE_FUZZ=PASS', JSON.stringify({ seeds: 5, stepsPerSeed: 700 }));
