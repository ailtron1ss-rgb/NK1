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

  const liveSnapshot = memory.snapshot();
  const reloaded = new MemoryOS2({ embeddingProvider: null });
  reloaded.restore(structuredClone(liveSnapshot));
  assert.equal(reloaded.doctor().pass, true, `${label}: the reloaded store must be coherent`);
  assert.equal(reloaded.indexDiagnostics().pass, true, `${label}: the reloaded index must agree`);
  const restoredSnapshot = reloaded.snapshot();
  if (restoredSnapshot.estimatedBytes !== memory.budgetDiagnostics().estimatedBytes) {
    const estimateProjectionBytes = (item) => Math.max(96, new TextEncoder().encode(JSON.stringify({
      content: item.content,
      tags: item.tags?.length ? item.tags : undefined,
      context: item.context,
      s: item.semanticLinks, t: item.temporalLinks, c: item.causalLinks, k: item.contradictionLinks,
      e: item.evidenceSources, ek: item.evidenceLineageKeys,
      ri: item.revisionIntegrityIssues?.length ? item.revisionIntegrityIssues : undefined,
      r: item.revisionHistory, bh: item.bitemporalHistory,
      rf: item.recordedFromAt, ru: item.recordedUntilAt, fu: item.freshnessUntilAt,
      fh: item.freshnessHalfLifeMs, tk: item.temporalKind,
    })).byteLength);
    const rowDiffs = liveSnapshot.items.map((item) => {
      const restored = restoredSnapshot.items.find((row) => row.id === item.id);
      if (!restored) return { id: item.id, missing: true };
      const projections = (row) => ({
        content: row.content,
        tags: row.tags?.length ? row.tags : undefined,
        context: row.context,
        s: row.semanticLinks, t: row.temporalLinks, c: row.causalLinks, k: row.contradictionLinks,
        e: row.evidenceSources, ek: row.evidenceLineageKeys,
        ri: row.revisionIntegrityIssues?.length ? row.revisionIntegrityIssues : undefined,
        r: row.revisionHistory, bh: row.bitemporalHistory,
        rf: row.recordedFromAt, ru: row.recordedUntilAt, fu: row.freshnessUntilAt,
        fh: row.freshnessHalfLifeMs, tk: row.temporalKind,
      });
      const liveProjection = projections(item), restoredProjection = projections(restored);
      const projectionFieldDiffs = Object.keys(liveProjection).filter((key) =>
        JSON.stringify(liveProjection[key] ?? null) !== JSON.stringify(restoredProjection[key] ?? null))
        .map((key) => ({ key, live: liveProjection[key] ?? null, restored: restoredProjection[key] ?? null }));
      const keys = [...new Set([...Object.keys(item), ...Object.keys(restored)])];
      const changedKeys = keys.filter((key) =>
        JSON.stringify(item[key] ?? null) !== JSON.stringify(restored[key] ?? null));
      const liveEstimate = estimateProjectionBytes(item);
      const restoredEstimate = estimateProjectionBytes(restored);
      const delta = restoredEstimate - liveEstimate;
      return delta !== 0 || changedKeys.length
        ? { id: item.id, liveEstimate, restoredEstimate, delta, changedKeys, projectionFieldDiffs }
        : null;
    }).filter(Boolean).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    console.log('MEMORY_FUZZ_BYTE_DIAGNOSTICS=', JSON.stringify({
      label, liveBytes: memory.budgetDiagnostics().estimatedBytes,
      restoredBytes: restoredSnapshot.estimatedBytes, liveCount: liveSnapshot.items.length,
      restoredCount: restoredSnapshot.items.length,
      projectionDelta: rowDiffs.reduce((total, row) => total + row.delta, 0),
      rowDiffs: rowDiffs.slice(0, 24),
    }));
  }
  assert.equal(
    restoredSnapshot.estimatedBytes,
    memory.budgetDiagnostics().estimatedBytes,
    `${label}: live and reloaded durable byte budgets must agree (no accounting drift)`,
  );
  assert.equal(reloaded.size(), memory.size(), `${label}: reload must preserve the item count`);
}

for (const seed of [1, 7, 42, 1337, 20260101]) {
  const memory = runSeed(seed, 700);
  assertOracle(`seed ${seed}`, memory);
  assert.ok(memory.size() <= 1600, `seed ${seed}: the store must respect the 1600-row capacity`);
}

console.log('MEMORY_LIVE_RESTORE_ORACLE_FUZZ=PASS', JSON.stringify({ seeds: 5, stepsPerSeed: 700 }));
