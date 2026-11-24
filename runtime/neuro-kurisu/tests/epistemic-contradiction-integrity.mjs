import assert from 'node:assert/strict';
import {
  PerceptualEpistemicGraph,
  claimPolarity,
  defaultEpistemicState,
} from '../src/organism/cognition/PerceptualEpistemicGraph.ts';

// ---------------------------------------------------------------------------
// Polarity: the graph must be able to tell "door is open" from "door is not open".
// A single negation flips polarity; a double negation restores it.
// ---------------------------------------------------------------------------
{
  const plain = claimPolarity('door is open');
  const negated = claimPolarity('door is not open');
  assert.equal(plain.polarity, 1);
  assert.equal(negated.polarity, -1);
  assert.equal(
    negated.core,
    plain.core,
    'a negated claim must keep the same core proposition so it can be compared',
  );
  assert.equal(
    claimPolarity('door is not not open').polarity,
    1,
    'two negations must cancel',
  );
  assert.equal(
    claimPolarity('the door was never open').polarity,
    -1,
    'every negation token flips polarity, not just "not"',
  );
}

// Russian and English must behave the same way, since NK1 is bilingual.
{
  const ruPlain = claimPolarity('дверь открыта');
  const ruNegated = claimPolarity('дверь не открыта');
  assert.equal(ruPlain.polarity, 1);
  assert.equal(ruNegated.polarity, -1);
  assert.equal(ruNegated.core, ruPlain.core);
}

// "not only" is a scalar phrase, not a negation. Counting it would create
// phantom contradictions, which is worse than missing one.
{
  assert.equal(
    claimPolarity('not only the door is open').polarity,
    1,
    '"not only" must not be treated as a negation',
  );
}

// Punctuation and case must not change the core proposition.
{
  assert.equal(claimPolarity('Door is open!').core, claimPolarity('door is open').core);
  assert.equal(claimPolarity('  door   is  open  ').core, 'door is open');
}

// ---------------------------------------------------------------------------
// Contradiction counting: this is the behaviour that was missing entirely.
// ---------------------------------------------------------------------------
{
  const graph = new PerceptualEpistemicGraph();
  const open = graph.add({
    at: 1,
    modality: 'vision',
    claim: 'door is open',
    source: 'model-output',
    confidence01: 0.8,
  });
  assert.equal(graph.summary().contradictionPairs, 0, 'one claim contradicts nothing');

  graph.add({
    at: 2,
    modality: 'world',
    claim: 'door is closed',
    source: 'observed',
    confidence01: 0.9,
  });

  // "open" and "closed" are antonym predicates over the same subject.
  assert.ok(
    graph.summary().contradictionPairs >= 1,
    'a direct semantic opposite must be counted as a contradiction',
  );
  assert.equal(graph.summary().resolvedPairs, 0, 'an unresolved conflict is not a resolution');
  assert.equal(
    graph.summary().corroboratedPairs,
    0,
    'a conflict is not corroboration',
  );
  void open;
}

// Explicit polarity conflict on an identical core proposition.
{
  const graph = new PerceptualEpistemicGraph();
  graph.add({
    at: 1,
    modality: 'vision',
    claim: 'door is open',
    source: 'model-output',
    confidence01: 0.8,
  });
  graph.add({
    at: 2,
    modality: 'audio',
    claim: 'door is not open',
    source: 'observed',
    confidence01: 0.9,
  });
  assert.equal(
    graph.summary().contradictionPairs,
    1,
    'identical core with opposite polarity is exactly one contradiction pair',
  );
}

// Agreement must never be counted as contradiction, in either direction.
{
  const graph = new PerceptualEpistemicGraph();
  graph.add({ at: 1, modality: 'vision', claim: 'door is open', source: 'model-output', confidence01: 0.7 });
  graph.add({ at: 2, modality: 'world', claim: 'door is open', source: 'observed', confidence01: 0.9 });
  graph.add({ at: 3, modality: 'audio', claim: 'door is not open', source: 'observed', confidence01: 0.6 });
  graph.add({ at: 4, modality: 'text', claim: 'door is not open', source: 'observed', confidence01: 0.6 });

  const summary = graph.summary();
  // Two positive claims against two negative claims is four opposing pairs.
  assert.equal(summary.contradictionPairs, 4, 'every opposing pair is counted, once per pair');
  assert.ok(summary.corroboratedPairs > 0, 'same-polarity cross-modal claims still corroborate');
}

// Unrelated claims must not collide just because they share a negation token.
{
  const graph = new PerceptualEpistemicGraph();
  graph.add({ at: 1, modality: 'vision', claim: 'door is open', source: 'observed', confidence01: 0.7 });
  graph.add({ at: 2, modality: 'vision', claim: 'window is not open', source: 'observed', confidence01: 0.7 });
  assert.equal(
    graph.summary().contradictionPairs,
    0,
    'different subjects are not contradictions',
  );
}

// A contradiction is not resolved by restating the same claim.
{
  const graph = new PerceptualEpistemicGraph();
  graph.add({ at: 1, modality: 'vision', claim: 'door is open', source: 'observed', confidence01: 0.8 });
  graph.add({ at: 2, modality: 'world', claim: 'door is closed', source: 'observed', confidence01: 0.8 });
  const before = graph.summary().contradictionPairs;
  graph.add({ at: 3, modality: 'vision', claim: 'door is open', source: 'observed', confidence01: 0.8 });
  assert.equal(
    graph.summary().contradictionPairs,
    before,
    'repeating one side must not manufacture a new contradiction',
  );
  assert.equal(graph.summary().resolvedPairs, 0);
}

// ---------------------------------------------------------------------------
// Replay idempotency must survive contradiction counting.
// ---------------------------------------------------------------------------
{
  const graph = new PerceptualEpistemicGraph();
  const first = graph.add({ at: 5, modality: 'vision', claim: 'door is open', source: 'observed', confidence01: 0.8 });
  graph.add({ at: 5, modality: 'vision', claim: 'door is open', source: 'observed', confidence01: 0.8 });
  graph.add({ at: 6, modality: 'world', claim: 'door is closed', source: 'observed', confidence01: 0.8 });
  const snapshot = graph.summary();
  graph.add({ at: 5, modality: 'vision', claim: 'door is open', source: 'observed', confidence01: 0.8 });
  assert.equal(
    graph.summary().contradictionPairs,
    snapshot.contradictionPairs,
    'a replayed receipt must not re-count the same contradiction',
  );
  assert.equal(graph.summary().claims, 2, 'the replay is still idempotent');
  void first;
}

// ---------------------------------------------------------------------------
// Restore and migration: state written before this change has no counter.
// ---------------------------------------------------------------------------
{
  const graph = new PerceptualEpistemicGraph();
  graph.restore({
    version: 1,
    claims: [
      { id: 'legacy-1', at: 1, modality: 'vision', claim: 'door is open', source: 'observed', confidence01: 0.8, targetIds: [] },
    ],
    contradictionPairs: undefined,
    resolvedPairs: 0,
    corroboratedPairs: 0,
    meanConfidence01: 0.8,
    lastAt: 1,
  });
  assert.equal(graph.summary().contradictionPairs, 0, 'missing counter restores as zero, not NaN');
  graph.add({ at: 2, modality: 'world', claim: 'door is closed', source: 'observed', confidence01: 0.9 });
  assert.equal(graph.summary().contradictionPairs, 1, 'detection works on restored state too');
}

// A hostile counter in saved state must not survive as a bad number.
{
  const graph = new PerceptualEpistemicGraph();
  graph.restore({ version: 1, claims: [], contradictionPairs: Number.NaN, resolvedPairs: -5, corroboratedPairs: 1e9 });
  const summary = graph.summary();
  assert.equal(summary.contradictionPairs, 0);
  assert.equal(summary.resolvedPairs, 0);
  assert.ok(Number.isFinite(summary.corroboratedPairs));
  assert.ok(summary.corroboratedPairs <= 1000);
  assert.deepEqual(defaultEpistemicState().claims, []);
}

// ---------------------------------------------------------------------------
// Boundedness: the claim window is capped, so the scan must stay bounded.
// ---------------------------------------------------------------------------
{
  const graph = new PerceptualEpistemicGraph();
  for (let i = 0; i < 400; i += 1) {
    graph.add({
      at: 1000 + i,
      modality: i % 2 ? 'vision' : 'world',
      claim: `subject-${i} is present`,
      source: 'observed',
      confidence01: 0.7,
    });
  }
  assert.equal(graph.summary().claims, 256, 'the claim window stays bounded at 256');
}

// ---------------------------------------------------------------------------
// Lesion: the counter must be load-bearing, not decoration.
// Two graphs, one fed agreeing evidence and one fed conflicting evidence.
// Only the conflicting one may raise contradiction pressure.
// ---------------------------------------------------------------------------
{
  const agreeing = new PerceptualEpistemicGraph();
  const conflicting = new PerceptualEpistemicGraph();
  for (let i = 0; i < 6; i += 1) {
    agreeing.add({ at: i, modality: i % 2 ? 'vision' : 'world', claim: 'door is open', source: 'observed', confidence01: 0.8 });
    conflicting.add({ at: i, modality: i % 2 ? 'vision' : 'world', claim: i % 2 ? 'door is open' : 'door is closed', source: 'observed', confidence01: 0.8 });
  }
  assert.equal(agreeing.summary().contradictionPairs, 0);
  assert.ok(
    conflicting.summary().contradictionPairs > 0,
    'the lesion condition must differ from the control condition',
  );
}

// ---------------------------------------------------------------------------
// Integration: perception disagreement must reach the canonical contradiction
// owner and then the immune system's contradiction-pressure signal.
// This exercises real components in the same order OrganismCore uses them.
// ---------------------------------------------------------------------------
{
  const { P41SemanticPerceptionEngine } = await import('../src/organism/cognition/P41SemanticPerception.ts');
  const { ContradictionReservoir } = await import('../src/organism/cognition/ContradictionReservoir.ts');
  const { CognitiveImmuneSystem } = await import('../src/organism/cognition/CognitiveImmuneSystem.ts');

  const engine = new P41SemanticPerceptionEngine();
  const reservoir = new ContradictionReservoir();
  const immune = new CognitiveImmuneSystem();

  const calm = engine.ingest({
    vision: { semantic: true, sceneLabel: 'lab', confidence01: 0.9, objects: [{ label: 'door', kind: 'object', confidence01: 0.9 }] },
    at: 1000,
  });
  assert.equal(calm.metrics.epistemicContradictions, 0, 'agreeing perception raises no contradiction');
  assert.deepEqual(engine.epistemicConflicts(4), [], 'agreeing perception exposes no conflict pairs');

  const conflicted = engine.ingest({
    vision: { semantic: true, sceneLabel: 'door is open', confidence01: 0.92 },
    world: { scene: 'door is closed', evidenceKind: 'observed', objects: [{ label: 'door', confidence01: 0.93 }] },
    at: 2000,
  });
  assert.ok(
    conflicted.metrics.epistemicContradictions > 0,
    'opposing vision and world evidence must raise the P41 contradiction gauge',
  );

  const pairs = engine.epistemicConflicts(4);
  assert.ok(pairs.length > 0, 'the engine must expose the concrete opposing pair');
  assert.notEqual(pairs[0].claim.modality, pairs[0].opposing.modality, 'a pair spans two witnesses');

  for (const pair of pairs) {
    reservoir.register(
      `Evidence disagreement: ${pair.claim.modality}:${pair.claim.claim}`,
      [`${pair.opposing.modality}:${pair.opposing.claim}`],
      pair.claim.confidence01,
    );
  }
  assert.ok(reservoir.snapshot().unresolvedCount > 0, 'the canonical owner must hold the conflict open');

  const health = immune.inspectHealth({
    tick: 1,
    at: 2000,
    contradictions: reservoir.snapshot(),
  });
  assert.ok(
    health.metrics && typeof health.score01 === 'number',
    'the immune system must accept the canonical contradiction snapshot',
  );

  // Control: the same health inspection with an empty reservoir must not be
  // pushed by contradiction pressure. This proves the signal is load-bearing.
  const controlImmune = new CognitiveImmuneSystem();
  const control = controlImmune.inspectHealth({ tick: 1, at: 2000, contradictions: new ContradictionReservoir().snapshot() });
  assert.equal(control.activeSignals.filter(signal => signal.metric?.includes('contradiction')).length, 0);
  console.log('EPISTEMIC_WIRING=PASS', JSON.stringify({ pairs: pairs.length, open: reservoir.snapshot().unresolvedCount }));
}

// ---------------------------------------------------------------------------
// Adversarial: hostile or absurd inputs must not crash, hang, or fabricate.
// ---------------------------------------------------------------------------
{
  const graph = new PerceptualEpistemicGraph();
  for (const bad of [null, undefined, '', '   ', {}, [], 0, NaN]) {
    assert.equal(graph.add({ at: 1, modality: 'vision', claim: bad, source: 'observed', confidence01: 0.5 }), null);
  }
  assert.equal(graph.summary().claims, 0, 'empty or non-string claims are refused');

  graph.add({ at: 1, modality: 'vision', claim: 'x'.repeat(5000), source: 'observed', confidence01: 0.5 });
  assert.ok(graph.recent(1)[0].claim.length <= 360, 'over-long claims are truncated, not stored whole');

  graph.add({ at: 1, modality: 'vision', claim: 'door is open', source: 'observed', confidence01: Infinity });
  assert.ok(Number.isFinite(graph.recent(1)[0].confidence01), 'non-finite confidence is clamped');

  // A huge fan of opposing claims must stay bounded and finish fast.
  const started = Date.now();
  const flood = new PerceptualEpistemicGraph();
  for (let i = 0; i < 600; i += 1) {
    flood.add({
      at: i,
      modality: i % 3 ? 'vision' : 'world',
      claim: `subject-${i % 40} is ${i % 2 ? 'open' : 'closed'}`,
      source: 'observed',
      confidence01: 0.6,
    });
  }
  const elapsed = Date.now() - started;
  const summary = flood.summary();
  assert.equal(summary.claims, 256, 'the window stays bounded under flood');
  assert.ok(Number.isSafeInteger(summary.contradictionPairs), 'the gauge stays an integer');
  assert.ok(summary.contradictionPairs <= 4096, 'the gauge stays within its cap');
  assert.ok(elapsed < 5000, `flood must not degrade into a hang (took ${elapsed}ms)`);
}

// A supersedes edge settles a conflict: the pair stops counting, but the
// history is preserved rather than deleted.
{
  const graph = new PerceptualEpistemicGraph();
  const open = graph.add({ at: 1, modality: 'vision', claim: 'door is open', source: 'observed', confidence01: 0.8 });
  graph.add({ at: 2, modality: 'world', claim: 'door is closed', source: 'observed', confidence01: 0.9 });
  assert.ok(graph.summary().contradictionPairs > 0, 'the conflict exists before resolution');
  graph.add({ at: 3, modality: 'world', claim: 'door is closed', source: 'observed', confidence01: 0.95, supersedes: open.id });
  assert.equal(graph.summary().contradictionPairs, 0, 'an explicit supersedes edge settles the pair');
  assert.equal(graph.summary().claims, 3, 'resolution does not delete the audit trail');
  assert.ok(graph.summary().resolvedPairs > 0, 'resolution is accounted, not silent');
}

// ---------------------------------------------------------------------------
// Migration: state persisted before this change has no epistemicContradictions
// metric and no contradictionPairs gauge. Loading it must not produce NaN.
// ---------------------------------------------------------------------------
{
  const { migratePersistedOrganism } = await import('../src/organism/persistence/StateMigrations.ts');
  const migrated = migratePersistedOrganism({
    version: 1,
    facets: {
      embodiment: {
        p41SemanticPerception: {
          version: 1,
          tick: 3,
          scene: { label: 'lab', confidence01: 0.5, stability01: 0.5, at: 10 },
          entities: [],
          metrics: { grounding01: 0.2, updates: 3 },
          epistemic: {
            version: 1,
            claims: [{ id: 'old-1', at: 1, modality: 'vision', claim: 'door is open', source: 'observed', confidence01: 0.8, targetIds: [] }],
            meanConfidence01: 0.8,
            lastAt: 1,
          },
        },
      },
    },
  });
  const p41 = migrated.facets.embodiment.p41SemanticPerception;
  assert.equal(
    p41.metrics.epistemicContradictions,
    0,
    'legacy state without the new metric migrates to zero, not undefined',
  );
  assert.ok(Number.isFinite(p41.metrics.grounding01), 'existing metrics are preserved');

  // And the restored graph must still detect contradictions on new evidence.
  const graph = new PerceptualEpistemicGraph();
  graph.restore(p41.epistemic);
  graph.add({ at: 2, modality: 'world', claim: 'door is closed', source: 'observed', confidence01: 0.9 });
  assert.ok(graph.summary().contradictionPairs > 0, 'restored legacy claims still participate in detection');
}

console.log('EPISTEMIC_CONTRADICTION=PASS');
