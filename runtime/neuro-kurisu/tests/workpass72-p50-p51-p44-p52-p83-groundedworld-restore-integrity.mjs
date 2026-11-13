import assert from 'node:assert/strict';
import { P50CausalSelfWorldEngine, defaultP50 } from '../src/organism/world/P50CausalSelfWorldEngine.ts';
import { P51GroundedCausalWorkspace, defaultP51 } from '../src/organism/world/P51GroundedCausalWorkspace.ts';
import { P44EmbodiedPredictiveSelfWorld, defaultP44 } from '../src/organism/world/P44EmbodiedPredictiveSelfWorld.ts';
import { P52CounterfactualDevelopmentMind, defaultP52 } from '../src/organism/world/P52CounterfactualDevelopmentMind.ts';
import { P83PersistentRealityModel, defaultP83PersistentRealityModel } from '../src/organism/world/P83PersistentRealityModel.ts';
import { GroundedWorldState, defaultGroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';

/**
 * WorkPass72 — the world/perception family: P50 causal self-world engine, P51
 * grounded causal workspace, P44 embodied predictive self-world, P52
 * counterfactual development mind, P83 persistent reality model and the
 * canonical GroundedWorldState. Each merged a persisted snapshot with a bare
 * spread, letting NaN reach causal graphs, concepts/hypotheses, embodied
 * prediction vectors/weights, developmental trajectories, reality beliefs and
 * grounded entities/relations/events.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- P50CausalSelfWorldEngine -----------------------------------------------
{
  const m = new P50CausalSelfWorldEngine();
  m.restore({ version: 1, samples: -1, meanCausalError01: 9, selfWorldAlignment01: -1, counterfactuals: NaN,
    nodes: [{ id: 'n1', kind: 'bogus', label: 5, confidence01: 9, lastAt: -1 }, { label: 'x' }, 'x'],
    edges: [{ from: 'n1', to: 'n2', relation: 'bogus', strength01: 9, observations: -1, lastAt: NaN }, { from: 'n1' }, 'x'],
    counterfactualHistory: [{ id: 'c1', action: 'bogus', predictedReward01: 9, actualReward01: -1, regret01: NaN, confidence01: 9, at: -1 }, { at: 1 }, 'x'],
    lastExplanation: 5 });
  const st = m.snapshot();
  assert.equal(st.samples, 0, 'p50 negative samples -> 0');
  assert.equal(st.meanCausalError01, 1, 'p50 over-1 error -> 1');
  assert.equal(st.selfWorldAlignment01, 0, 'p50 negative alignment -> 0');
  assert.equal(st.nodes.length, 1, 'p50 drops id-less node');
  assert.equal(st.nodes[0].kind, 'world', 'p50 unknown node kind -> world');
  assert.equal(st.nodes[0].label, '', 'p50 non-string label -> empty');
  assert.equal(st.nodes[0].confidence01, 1, 'p50 over-1 confidence -> 1');
  assert.equal(st.edges.length, 1, 'p50 drops edge missing endpoint');
  assert.equal(st.edges[0].relation, 'predicts', 'p50 unknown relation -> predicts');
  assert.equal(st.edges[0].strength01, 1, 'p50 over-1 strength -> 1');
  assert.equal(st.edges[0].observations, 0, 'p50 negative observations -> 0');
  assert.equal(st.counterfactualHistory.length, 1, 'p50 drops id-less counterfactual');
  assert.equal(st.counterfactualHistory[0].action, 'wait', 'p50 unknown action -> wait');
  assert.equal(st.counterfactualHistory[0].actualReward01, 0, 'p50 negative reward -> 0');
  assert.equal(st.counterfactualHistory[0].regret01, 0, 'p50 NaN regret -> 0');
  assert.equal(st.lastExplanation, '', 'p50 non-string explanation -> empty');
  assert.doesNotThrow(() => m.restore(hostile('nodes')));
  const d = defaultP50();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p50 default round-trips');
}

// --- P51GroundedCausalWorkspace ---------------------------------------------
{
  const m = new P51GroundedCausalWorkspace();
  m.restore({ version: 1, cycles: -1, broadcasts: NaN, semanticCoverage01: 9, causalReadiness01: -1, lastFocus: 5,
    concepts: [{ id: 'c1', label: 5, kind: 'bogus', confidence01: 9, mentions: -1, lastAt: NaN, sources: [5, 's', ''] }, { label: 'x' }, 'x'],
    hypotheses: [{ id: 'h1', cause: 5, effect: 5, confidence01: 9, support: -1, contradiction: NaN, lastAt: -1 }, { cause: 'x' }, 'x'],
    branches: [{ id: 'b1', action: 5, expected01: 9, actual01: -1, regret01: NaN, horizon: -1, at: -1 }, 'x'],
    evidence: [{ id: 'e1', kind: 'bogus', subject: 5, value01: 9, confidence01: -1, at: NaN }, { subject: 'x' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'p51 negative cycles -> 0');
  assert.equal(st.broadcasts, 0, 'p51 NaN broadcasts -> 0');
  assert.equal(st.semanticCoverage01, 1, 'p51 over-1 coverage -> 1');
  assert.equal(st.causalReadiness01, 0, 'p51 negative readiness -> 0');
  assert.equal(st.lastFocus, '', 'p51 non-string focus -> empty');
  assert.equal(st.concepts.length, 1, 'p51 drops id-less concept');
  assert.equal(st.concepts[0].kind, 'concept', 'p51 unknown concept kind -> concept');
  assert.equal(st.concepts[0].mentions, 0, 'p51 negative mentions -> 0');
  assert.deepEqual(st.concepts[0].sources, ['s'], 'p51 keeps only non-empty string sources');
  assert.equal(st.hypotheses.length, 1, 'p51 drops id-less hypothesis');
  assert.equal(st.hypotheses[0].confidence01, 1, 'p51 over-1 hypothesis confidence -> 1');
  assert.equal(st.branches.length, 1, 'p51 drops id-less branch');
  assert.equal(st.branches[0].actual01, 0, 'p51 negative branch actual -> 0');
  assert.equal(st.branches[0].horizon, 0, 'p51 negative horizon -> 0');
  assert.equal(st.evidence.length, 1, 'p51 drops id-less evidence');
  assert.equal(st.evidence[0].kind, 'observation', 'p51 unknown evidence kind -> observation');
  assert.equal(st.evidence[0].value01, 1, 'p51 over-1 evidence value -> 1');
  assert.doesNotThrow(() => m.restore(hostile('concepts')));
  const d = defaultP51();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p51 default round-trips');
}

// --- P44EmbodiedPredictiveSelfWorld -----------------------------------------
{
  const m = new P44EmbodiedPredictiveSelfWorld();
  m.restore({ version: 1, samples: -1, lastAction: 'bogus', lastPrediction: [9, -1, 'x'], lastActual: [9], meanError01: 9, horizon: 99,
    rollouts: [{ actions: ['respond', 'bogus'], values: [9, -1], confidence01: 9, at: -1 }, 'x'],
    actionBias: { respond: 9, bogus: 5 }, weights: [[9, -1], 'x'], bias: [9, -1], metrics: { oneStepAccuracy01: 9, multiStepAccuracy01: -1, selfPrediction01: NaN, updates: -1 } });
  const st = m.snapshot();
  assert.equal(st.samples, 0, 'p44 negative samples -> 0');
  assert.equal(st.lastAction, 'none', 'p44 unknown last action -> none');
  assert.equal(st.lastPrediction.length, 24, 'p44 prediction fixed length 24');
  assert.equal(st.lastPrediction[0], 1, 'p44 over-1 prediction -> 1');
  assert.equal(st.lastPrediction[1], -1, 'p44 signed prediction preserved');
  assert.equal(st.meanError01, 1, 'p44 over-1 error -> 1');
  assert.equal(st.horizon, 5, 'p44 out-of-range horizon -> 5');
  assert.equal(st.rollouts.length, 1, 'p44 drops non-object rollout');
  assert.deepEqual(st.rollouts[0].actions, ['respond'], 'p44 keeps only known rollout actions');
  assert.equal(st.rollouts[0].values[0], 1, 'p44 over-1 rollout value -> 1');
  assert.deepEqual(Object.keys(st.actionBias).sort(), ['defer', 'explore', 'reflect', 'respond', 'rest', 'verify', 'wait'], 'p44 action bias covers exactly the known actions');
  assert.equal(st.actionBias.respond, 1, 'p44 over-1 action bias -> 1');
  assert.equal(st.weights.length, 7, 'p44 weight matrix fixed action count');
  assert.equal(st.weights[0].length, 24, 'p44 weight row fixed length 24');
  assert.equal(st.weights[0][0], 1, 'p44 over-1 weight -> 1');
  assert.equal(st.bias.length, 24, 'p44 bias fixed length 24');
  assert.equal(st.metrics.oneStepAccuracy01, 1, 'p44 over-1 one-step -> 1');
  assert.equal(st.metrics.multiStepAccuracy01, 0, 'p44 negative multi-step -> 0');
  assert.equal(st.metrics.selfPrediction01, .1, 'p44 NaN self prediction -> default');
  assert.equal(st.metrics.updates, 0, 'p44 negative updates -> 0');
  assert.doesNotThrow(() => m.restore(hostile('weights')));
  const d = defaultP44();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p44 default round-trips');
}

// --- P52CounterfactualDevelopmentMind ---------------------------------------
{
  const m = new P52CounterfactualDevelopmentMind();
  m.restore({ version: 1, samples: -1, causalAttribution01: 9, developmentalReadiness01: -1, lastAction: 'bogus', lastGoalId: 5, lastQuestion: 5,
    trajectory: [{ tick: -1, action: 'bogus', predictedUtility01: 9, actualUtility01: -1, predictionError01: NaN, selfPredictionError01: 9, goalId: 5, at: -1 }, 'x'],
    counterfactuals: [{ id: 'c1', tick: -1, chosen: 'bogus', alternative: 'bogus', predictedChosen01: 9, predictedAlternative01: -1, observedChosen01: 9, confidence01: NaN, unresolved: 'yes', at: -1 }, { chosen: 'respond' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.samples, 0, 'p52 negative samples -> 0');
  assert.equal(st.causalAttribution01, 1, 'p52 over-1 attribution -> 1');
  assert.equal(st.developmentalReadiness01, 0, 'p52 negative readiness -> 0');
  assert.equal(st.lastAction, 'none', 'p52 unknown last action -> none');
  assert.equal(st.lastGoalId, '', 'p52 non-string goal id -> empty');
  assert.equal(st.lastQuestion, '', 'p52 non-string question -> empty');
  assert.equal(st.trajectory.length, 1, 'p52 drops non-object trajectory row');
  assert.equal(st.trajectory[0].action, 'wait', 'p52 unknown trajectory action -> wait');
  assert.equal(st.trajectory[0].predictedUtility01, 1, 'p52 over-1 predicted utility -> 1');
  assert.equal(st.trajectory[0].predictionError01, 0, 'p52 NaN prediction error -> 0');
  assert.equal(st.trajectory[0].goalId, undefined, 'p52 non-string goal id dropped');
  assert.equal(st.counterfactuals.length, 1, 'p52 drops id-less counterfactual');
  assert.equal(st.counterfactuals[0].chosen, 'wait', 'p52 unknown chosen action -> wait');
  assert.equal(st.counterfactuals[0].observedChosen01, 1, 'p52 over-1 observed -> 1');
  assert.equal(st.counterfactuals[0].confidence01, 0, 'p52 NaN confidence -> 0');
  assert.equal(st.counterfactuals[0].unresolved, false, 'p52 truthy-string unresolved -> false');
  assert.equal(st.openCounterfactuals, 0, 'p52 open counterfactuals recomputed');
  assert.doesNotThrow(() => m.restore(hostile('trajectory')));
  const d = defaultP52();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p52 default round-trips');
}

// --- P83PersistentRealityModel ----------------------------------------------
{
  const m = new P83PersistentRealityModel();
  m.restore({ version: 1, revision: -1, lastAt: NaN, currentHash: 5, location: 5, confidence01: 9, uncertainty01: -1,
    beliefs: [{ claimKey: 'k1', status: 'bogus', confidence01: 9, firstSeenAt: -1, lastSeenAt: NaN, support01: 9, contradiction01: -1, independentSources: NaN, provenanceIds: [5, 'p', ''], predictionIds: [5] }, { status: 'unknown' }, 'x'],
    continuity: [{ id: 'e1', at: -1, kind: 'bogus', fromHash: 5, toHash: 5, magnitude01: 9, reason: 5 }, { at: 1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.revision, 0, 'p83 negative revision -> 0');
  assert.equal(st.lastAt, 0, 'p83 NaN lastAt -> 0');
  assert.equal(st.currentHash, '', 'p83 non-string hash -> empty');
  assert.equal(st.location, 'unknown', 'p83 non-string location -> default');
  assert.equal(st.confidence01, 1, 'p83 over-1 confidence -> 1');
  assert.equal(st.uncertainty01, 0, 'p83 negative uncertainty -> 0');
  assert.equal(st.beliefs.length, 1, 'p83 drops claim-less belief');
  assert.equal(st.beliefs[0].status, 'unknown', 'p83 unknown status -> unknown');
  assert.equal(st.beliefs[0].confidence01, 1, 'p83 over-1 belief confidence -> 1');
  assert.equal(st.beliefs[0].lastSeenAt, 0, 'p83 NaN lastSeenAt -> 0');
  assert.equal(st.beliefs[0].independentSources, 0, 'p83 NaN sources -> 0');
  assert.deepEqual(st.beliefs[0].provenanceIds, ['p'], 'p83 keeps only non-empty provenance ids');
  assert.equal(st.continuity.length, 1, 'p83 drops id-less continuity event');
  assert.equal(st.continuity[0].kind, 'world-change', 'p83 unknown kind -> world-change');
  assert.equal(st.continuity[0].magnitude01, 1, 'p83 over-1 magnitude -> 1');
  assert.equal(st.continuity[0].reason, '', 'p83 non-string reason -> empty');
  assert.doesNotThrow(() => m.restore(hostile('beliefs')));
  const d = defaultP83PersistentRealityModel();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p83 default round-trips');
}

// --- GroundedWorldState -----------------------------------------------------
{
  const m = new GroundedWorldState();
  m.restore({ version: 1, revision: -1, lastAt: NaN, location: 5, uncertainty01: 9, confidence01: -1,
    entities: [{ id: 'g1', label: 5, kind: 5, confidence01: 9, present01: -1, firstSeenAt: -1, lastSeenAt: NaN, modalities: [5, 'v', ''], presenceStatus: 'bogus', persistence01: 9, absenceEvidence01: -1, observationCount: 0, valueKnown: 'yes', visibilityKnown: 'yes', collectionKnown: 'yes' }, { label: 'x' }, 'x'],
    relations: [{ id: 'r1', from: 5, relation: 5, to: 5, confidence01: 9, at: -1 }, { from: 'a' }, 'x'],
    events: [{ id: 'ev1', label: 5, confidence01: 9, lastAt: -1, persistence01: 9, evidenceKind: 'bogus' }, { label: 'x' }, 'x'],
    facts: [5, 'f', ''],
    provenanceIds: [5, 'p', ''] });
  const st = m.snapshot();
  assert.equal(st.revision, 0, 'gw negative revision -> 0');
  assert.equal(st.lastAt, 0, 'gw NaN lastAt -> 0');
  assert.equal(st.location, 'unknown', 'gw non-string location -> default');
  assert.equal(st.uncertainty01, 1, 'gw over-1 uncertainty -> 1');
  assert.equal(st.confidence01, 0, 'gw negative confidence -> 0');
  assert.equal(st.entities.length, 1, 'gw drops id-less entity');
  assert.equal(st.entities[0].confidence01, 1, 'gw over-1 entity confidence -> 1');
  assert.equal(st.entities[0].present01, 0, 'gw negative present -> 0');
  assert.equal(st.entities[0].observationCount, 1, 'gw zero observation count -> 1');
  assert.equal(st.entities[0].presenceStatus, 'unknown', 'gw unknown presence -> unknown');
  assert.equal(st.entities[0].persistence01, 1, 'gw over-1 persistence -> 1');
  assert.equal(st.entities[0].valueKnown, false, 'gw truthy-string valueKnown -> false');
  assert.equal(st.relations.length, 1, 'gw drops id-less relation');
  assert.equal(st.relations[0].confidence01, 1, 'gw over-1 relation confidence -> 1');
  assert.equal(st.events.length, 1, 'gw drops id-less event');
  assert.equal(st.events[0].evidenceKind, undefined, 'gw unknown evidence kind dropped');
  assert.equal(st.events[0].persistence01, 1, 'gw over-1 event persistence -> 1');
  assert.deepEqual(st.facts, ['f'], 'gw keeps only non-empty facts');
  assert.deepEqual(st.provenanceIds, ['p'], 'gw keeps only non-empty provenance ids');
  assert.doesNotThrow(() => m.restore(hostile('entities')));
  const d = defaultGroundedWorldState();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'gw default round-trips');
}

// Real integrate() -> restore() round-trip: absent image evidence must not
// inject `imageBox: undefined` keys that break exact snapshot equality.
{
  const gw = new GroundedWorldState();
  gw.integrate({ at: 1100, base: { tick: 1, location: 'lab', energy: .8, attention: .7, uncertainty: .2, facts: ['lab-open'], objects: [{ label: 'terminal', kind: 'device', confidence01: .9, location: 'desk', visible: true }], events: ['boot'] } });
  const snap = gw.snapshot();
  const restored = new GroundedWorldState();
  restored.restore(snap);
  assert.deepEqual(restored.snapshot(), snap, 'gw real integrate/restore round-trips exactly');
}

console.log('WORKPASS72_P50_P51_P44_P52_P83_GROUNDEDWORLD_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['P50CausalSelfWorldEngine', 'P51GroundedCausalWorkspace', 'P44EmbodiedPredictiveSelfWorld', 'P52CounterfactualDevelopmentMind', 'P83PersistentRealityModel', 'GroundedWorldState'] }));
