import assert from 'node:assert/strict';
import { ContextualWorldModel, defaultContextualWorld } from '../src/organism/world/ContextualWorldModel.ts';
import { P79EmbodiedSituationModel, defaultP79 } from '../src/organism/world/P79EmbodiedSituationModel.ts';
import { P75MemoryContinuumOS, defaultP75 } from '../src/organism/developmental/P75MemoryContinuumOS.ts';
import { P47TemporalMemoryMind, defaultP47State } from '../src/organism/developmental/P47TemporalMemoryMind.ts';

/**
 * WorkPass72 — world-model and temporal-memory restore integrity. These owners
 * previously merged the persisted snapshot (and, for the world model, its nested
 * per-action models) with a bare spread, so NaN/out-of-range values and malformed
 * element rows reached live state: NaN weights produced degenerate reward
 * predictions, and a null memory node crashed ingest/reflect.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);

// --- ContextualWorldModel --------------------------------------------------
{
  const m = new ContextualWorldModel();
  const d = defaultContextualWorld();
  m.restore({
    version: 1, samples: NaN, updates: -3, calibrationError01: Infinity,
    featureNames: ['hacked'],
    models: {
      explore: { weights: [NaN, 5, -9, 'x', ...Array(8).fill(0)], bias: NaN, mean01: 9, variance01: -1, loss01: NaN, lastAt: -5, samples: -2 },
      bogus: { weights: [1] },
    },
  });
  const st = m.snapshot();
  assert.equal(st.samples, 0, 'world samples NaN -> 0');
  assert.equal(st.updates, 0, 'world negative updates -> 0');
  finite(st.calibrationError01, 'world calibrationError');
  assert.deepEqual(st.featureNames, d.featureNames, 'featureNames reset to canonical');
  assert.deepEqual(Object.keys(st.models).sort(), ['defer', 'explore', 'reflect', 'respond', 'rest', 'verify', 'wait'].sort(), 'unknown model keys dropped');
  const explore = st.models.explore;
  assert.equal(explore.weights.length, 12, 'weights padded to feature width');
  explore.weights.forEach((w, i) => { finite(w, `world weight[${i}]`); assert.ok(w >= -3 && w <= 3, 'weight bounded'); });
  finite(explore.bias, 'world bias');
  assert.ok(explore.bias >= -3 && explore.bias <= 3, 'bias bounded');
  finite(explore.mean01, 'world mean');
  finite(explore.variance01, 'world variance');
  assert.equal(explore.samples, 0, 'negative model samples -> 0');
  // A NaN bias previously produced degenerate reward; now predict is healthy.
  const pred = m.predict({ needs: { energy: .6, cognitiveLoad: .3, uncertainty: .3, novelty: .3, goalPressure: .4, socialNeed: .2, identityCoherence: .8 }, predictionError: .2, attentionBudget: .6 }, 'explore');
  finite(pred.reward01, 'world prediction reward');
  assert.ok(pred.reward01 > 0 && pred.reward01 < 1, 'reward must not collapse to a degenerate bound');
  // Hostile accessor must not throw.
  assert.doesNotThrow(() => m.restore({ get models() { throw new Error('hostile'); } }));
  // Valid round-trip preserves learned state.
  const clean = defaultContextualWorld();
  clean.models.verify.bias = .63; clean.models.verify.samples = 7; clean.samples = 7; clean.updates = 7;
  m.restore(clean);
  assert.equal(m.snapshot().models.verify.bias, .63, 'world valid snapshot keeps learned bias');
  assert.equal(m.snapshot().models.verify.samples, 7, 'world valid snapshot keeps samples');
}

// --- P79EmbodiedSituationModel ---------------------------------------------
{
  const s = new P79EmbodiedSituationModel();
  const d = defaultP79();
  s.restore({ version: 1, samples: NaN, entityCount: -2, grounding01: NaN, novelty01: Infinity, affordances01: 9, uncertainty01: -1, scene: 5, location: 7, history: [{ tick: -1, scene: 'kitchen', grounding01: NaN }, null, 'x', { tick: 2 }] });
  const st = s.snapshot();
  finite(st.grounding01, 'P79 grounding');
  assert.equal(st.grounding01, d.grounding01, 'P79 NaN grounding falls back');
  finite(st.novelty01, 'P79 novelty');
  assert.ok(st.affordances01 <= 1, 'P79 affordances clamped');
  assert.equal(st.uncertainty01, 0, 'P79 negative uncertainty clamps');
  assert.equal(st.samples, 0, 'P79 NaN samples -> 0');
  assert.equal(st.entityCount, 0, 'P79 negative entityCount -> 0');
  assert.equal(st.scene, d.scene, 'P79 non-string scene falls back');
  assert.equal(st.location, undefined, 'P79 non-string location drops');
  assert.equal(st.history.length, 1, 'P79 drops rows without a string scene');
  finite(st.history[0].grounding01, 'P79 history grounding');
  assert.doesNotThrow(() => s.restore({ get grounding01() { throw new Error('hostile'); } }));
  const valid = { version: 1, samples: 3, location: 'kitchen', scene: 'cooking', entityCount: 2, eventCount: 1, affordances01: .4, novelty01: .5, grounding01: .6, uncertainty01: .3, history: [{ tick: 5, scene: 'cooking', location: 'kitchen', grounding01: .6 }] };
  s.restore(valid);
  assert.deepEqual(s.snapshot(), valid, 'P79 valid snapshot round-trips');
}

// --- P75MemoryContinuumOS --------------------------------------------------
{
  const s = new P75MemoryContinuumOS();
  const d = defaultP75();
  s.restore({ version: 1, cycles: NaN, hotBudget: -1, warmBudget: NaN, coldBudget: Infinity, retrievalFocus: 5, consolidationCount: -2, forgottenCount: NaN, continuity01: NaN, health01: 4, recentModes: ['recent', 7, null, 'consolidation'] });
  const st = s.snapshot();
  finite(st.continuity01, 'P75 continuity');
  assert.equal(st.continuity01, d.continuity01, 'P75 NaN continuity falls back');
  finite(st.health01, 'P75 health');
  assert.equal(st.cycles, 0, 'P75 NaN cycles -> 0');
  assert.equal(st.hotBudget, 0, 'P75 negative budget -> 0');
  finite(st.coldBudget, 'P75 cold budget');
  assert.equal(st.retrievalFocus, d.retrievalFocus, 'P75 non-string focus falls back');
  assert.deepEqual(st.recentModes, ['recent', 'consolidation'], 'P75 filters non-string modes');
  assert.doesNotThrow(() => s.restore({ get continuity01() { throw new Error('hostile'); } }));
  const valid = { version: 1, cycles: 4, hotBudget: 40, warmBudget: 200, coldBudget: 900, retrievalFocus: 'semantic-relevant', consolidationCount: 2, forgottenCount: 1, continuity01: .8, health01: .7, recentModes: ['recent', 'semantic-relevant'] };
  s.restore(valid);
  assert.deepEqual(s.snapshot(), valid, 'P75 valid snapshot round-trips');
}

// --- P47TemporalMemoryMind -------------------------------------------------
{
  const s = new P47TemporalMemoryMind();
  const d = defaultP47State();
  s.restore({
    version: 1, ingestedEvents: NaN, nodes: 99, beliefs: 99, identityStability01: NaN, predictionCalibration01: 5, memoryPressure01: -1, lastCompactionAt: -5,
    nodesData: [
      { id: 'n1', kind: 'event', at: -3, summary: 'valid node', salience: NaN, confidence: Infinity, sourceIds: ['a', 5, null], links: ['b'] },
      null, 'x', { summary: 'no id' }, { id: 'n2', summary: '' },
    ],
    beliefsData: [
      { id: 'b1', proposition: 'valid belief', confidence: NaN, status: 'bogus', supportIds: ['a', 5], contradictionIds: [], updates: -2, lastUpdatedAt: NaN },
      null, { proposition: 'no id' },
    ],
  });
  const st = s.snapshot();
  finite(st.identityStability01, 'P47 identity stability');
  assert.equal(st.identityStability01, d.identityStability01, 'P47 NaN stability falls back');
  finite(st.predictionCalibration01, 'P47 calibration');
  assert.equal(st.memoryPressure01, 0, 'P47 negative pressure clamps');
  assert.equal(st.nodes, 1, 'P47 nodes reflects sanitized array length');
  assert.equal(st.beliefs, 1, 'P47 beliefs reflects sanitized array length');
  assert.equal(st.nodesData.length, 1, 'P47 drops malformed node rows');
  finite(st.nodesData[0].salience, 'P47 node salience');
  finite(st.nodesData[0].confidence, 'P47 node confidence');
  assert.deepEqual(st.nodesData[0].sourceIds, ['a'], 'P47 filters non-string source ids');
  assert.equal(st.beliefsData.length, 1, 'P47 drops malformed belief rows');
  finite(st.beliefsData[0].confidence, 'P47 belief confidence');
  assert.equal(st.beliefsData[0].status, 'active', 'P47 unknown belief status falls back');
  assert.equal(st.beliefsData[0].updates, 0, 'P47 negative updates -> 0');
  assert.doesNotThrow(() => s.restore({ get nodesData() { throw new Error('hostile'); } }));
  // ingest/reflect must not crash on a poisoned-but-sanitized store.
  assert.doesNotThrow(() => s.ingest([{ id: 'e1', type: 'observation', at: Date.now(), tick: 1, payload: { importance: .5, claim: 'the sky is blue today' } }]), 'P47 ingest after restore must not crash');
  assert.doesNotThrow(() => s.reflect(), 'P47 reflect after restore must not crash');
  finite(s.snapshot().predictionCalibration01, 'P47 calibration after reflect');
}

console.log('WORKPASS72_WORLD_MEMORY_OWNER_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['ContextualWorldModel', 'P79EmbodiedSituationModel', 'P75MemoryContinuumOS', 'P47TemporalMemoryMind'] }));
