import assert from 'node:assert/strict';
import { B2524NonparametricWorldExperienceMemory, defaultB2524State } from '../src/organism/cognition/B2524NonparametricWorldExperienceMemory.ts';
import { B2526MultiscaleCausalRegimeGraph, defaultB2526State } from '../src/organism/cognition/B2526MultiscaleCausalRegimeGraph.ts';
import { B2527FactorialAblationHarness, defaultB2527State } from '../src/organism/cognition/B2527FactorialAblationHarness.ts';
import { B2529PolicyInformationGainController, defaultB2529State } from '../src/organism/cognition/B2529PolicyInformationGainController.ts';
import { B2530AutonomousExperimentScheduler, defaultB2530State } from '../src/organism/cognition/B2530AutonomousExperimentScheduler.ts';
import { B268CausalSelfExperimentLab, defaultB268CausalSelfExperimentLab } from '../src/organism/cognition/B268CausalSelfExperimentLab.ts';

/**
 * WorkPass72 — B2524..B2530 experience-memory / causal-regime / ablation /
 * policy-information / experiment-scheduler and the B268 causal self-experiment
 * lab. Each merged a persisted snapshot with a bare spread or structuredClone,
 * letting NaN reach prototypes, regime nodes/edges, ablation factors, policy
 * alternatives and committed experiment records.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- B2524NonparametricWorldExperienceMemory --------------------------------
{
  const m = new B2524NonparametricWorldExperienceMemory();
  m.restore({ version: 1, enabled: 'no', tick: -1, writes: NaN, queries: -1, hits: NaN, meanDistance01: 9, predictionConfidence01: -1, novelty01: NaN, actionBias: { respond: 9, bogus: -1 }, learningGain01: 9, lesionFraction01: 9, lastContext: [9, -1, NaN], prototypes: [{ id: -1, context: [9, -1, NaN], action: 'bogus', reward01: 9, predictionError01: -1, count: -1, success01: NaN, lastTick: -1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2524 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2524 negative tick -> 0');
  assert.equal(st.writes, 0, 'b2524 NaN writes -> 0');
  assert.equal(st.queries, 0, 'b2524 negative queries -> 0');
  assert.equal(st.meanDistance01, 1, 'b2524 over-1 distance -> 1');
  assert.equal(st.predictionConfidence01, 0, 'b2524 negative confidence -> 0');
  assert.equal(st.novelty01, .5, 'b2524 NaN novelty -> default');
  assert.equal(st.actionBias.respond, .12, 'b2524 bias clamped to .12');
  assert.equal(st.actionBias.bogus, undefined, 'b2524 drops unknown bias key');
  assert.equal(st.lesionFraction01, 1, 'b2524 over-1 lesion -> 1');
  assert.equal(st.lastContext.length, 32, 'b2524 lastContext fixed length 32');
  assert.equal(st.lastContext[0], 1, 'b2524 over-1 context -> 1');
  assert.equal(st.lastContext[2], .5, 'b2524 NaN context -> .5');
  assert.equal(st.prototypes.length, 1, 'b2524 drops non-object prototype');
  assert.equal(st.prototypes[0].id, 0, 'b2524 negative id -> 0');
  assert.equal(st.prototypes[0].context.length, 32, 'b2524 prototype context fixed length 32');
  assert.equal(st.prototypes[0].action, 'wait', 'b2524 unknown action -> wait');
  assert.equal(st.prototypes[0].reward01, 1, 'b2524 over-1 reward -> 1');
  assert.equal(st.prototypes[0].predictionError01, 0, 'b2524 negative error -> 0');
  assert.equal(st.prototypes[0].count, 0, 'b2524 negative count -> 0');
  assert.equal(st.prototypes[0].success01, 0, 'b2524 NaN success -> 0');
  assert.equal(st.prototypes[0].lastTick, 0, 'b2524 negative lastTick -> 0');
  assert.doesNotThrow(() => m.restore(hostile('prototypes')));
  const d = defaultB2524State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2524 default round-trips');
}

// --- B2526MultiscaleCausalRegimeGraph ---------------------------------------
{
  const m = new B2526MultiscaleCausalRegimeGraph();
  m.restore({ version: 1, enabled: 'no', tick: -1, observations: NaN, transitions: -1, regimeDiscoveries: NaN, regimeUncertainty01: 9, transitionConfidence01: -1, causalStrength01: NaN, shift01: 9, multiScaleAgreement01: -1, fastLearning01: NaN, slowLearning01: 9, interventions: -1, usefulInterventions: NaN, lesionFraction01: 9, currentRegime: 5, previousRegime: -1, actionBias: { respond: 9, bogus: -1 }, nodes: [{ id: -1, centroid: [9, -1, NaN], visits: -1, confidence01: 9, novelty01: -1, lastTick: -1 }, 'x'], edges: [{ from: -1, to: NaN, action: 'bogus', probability01: 9, reward01: -1, count: -1, predictionError01: NaN, causalStrength01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2526 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2526 negative tick -> 0');
  assert.equal(st.observations, 0, 'b2526 NaN observations -> 0');
  assert.equal(st.regimeUncertainty01, 1, 'b2526 over-1 -> 1');
  assert.equal(st.transitionConfidence01, 0, 'b2526 negative -> 0');
  assert.equal(st.causalStrength01, .2, 'b2526 NaN -> default');
  assert.equal(st.multiScaleAgreement01, 0, 'b2526 negative -> 0');
  assert.equal(st.currentRegime, 5, 'b2526 valid regime preserved');
  assert.equal(st.previousRegime, null, 'b2526 negative regime -> null');
  assert.equal(st.actionBias.respond, .10, 'b2526 bias clamped to .10');
  assert.equal(st.actionBias.bogus, undefined, 'b2526 drops unknown bias key');
  assert.equal(st.nodes.length, 1, 'b2526 drops non-object node');
  assert.equal(st.nodes[0].centroid.length, 32, 'b2526 node centroid fixed length 32');
  assert.equal(st.nodes[0].centroid[0], 1, 'b2526 over-1 centroid -> 1');
  assert.equal(st.nodes[0].centroid[1], 0, 'b2526 negative centroid -> 0');
  assert.equal(st.nodes[0].id, 0, 'b2526 negative node id -> 0');
  assert.equal(st.nodes[0].confidence01, 1, 'b2526 over-1 confidence -> 1');
  assert.equal(st.edges.length, 1, 'b2526 drops non-object edge');
  assert.equal(st.edges[0].from, 0, 'b2526 negative edge from -> 0');
  assert.equal(st.edges[0].to, 0, 'b2526 NaN edge to -> 0');
  assert.equal(st.edges[0].action, 'wait', 'b2526 unknown edge action -> wait');
  assert.equal(st.edges[0].probability01, 1, 'b2526 over-1 probability -> 1');
  assert.equal(st.edges[0].reward01, 0, 'b2526 negative reward -> 0');
  assert.equal(st.edges[0].predictionError01, .5, 'b2526 NaN error -> .5');
  assert.doesNotThrow(() => m.restore(hostile('edges')));
  const d = defaultB2526State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2526 default round-trips');
}

// --- B2527FactorialAblationHarness ------------------------------------------
{
  const m = new B2527FactorialAblationHarness();
  m.restore({ version: 1, enabled: 'no', tick: -1, experiments: NaN, completed: -1, lastCondition: 5, lastDelta01: 9, interactionGain01: NaN, confidence01: 9, factors: [{ id: 5, enabled: 'no', baseline01: 9, active01: -1, contribution01: 9, samples: -1 }, { id: 'ok', enabled: true, baseline01: .3, active01: .4, contribution01: NaN, samples: 2 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2527 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2527 negative tick -> 0');
  assert.equal(st.experiments, 0, 'b2527 NaN experiments -> 0');
  assert.equal(st.completed, 0, 'b2527 negative completed -> 0');
  assert.equal(st.lastCondition, 'baseline', 'b2527 non-string condition -> default');
  assert.equal(st.lastDelta01, 1, 'b2527 over-range delta -> 1');
  assert.equal(st.interactionGain01, 0, 'b2527 NaN interaction -> 0');
  assert.equal(st.confidence01, 1, 'b2527 over-1 confidence -> 1');
  assert.equal(st.factors.length, 1, 'b2527 drops id-less factor');
  assert.equal(st.factors[0].id, 'ok', 'b2527 keeps valid factor');
  assert.equal(st.factors[0].baseline01, .3, 'b2527 finite baseline preserved');
  assert.equal(st.factors[0].contribution01, 0, 'b2527 NaN contribution -> 0');
  assert.equal(st.factors[0].samples, 2, 'b2527 samples preserved');
  assert.doesNotThrow(() => m.restore(hostile('factors')));
  const d = defaultB2527State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2527 default round-trips');
}

// --- B2529PolicyInformationGainController -----------------------------------
{
  const m = new B2529PolicyInformationGainController();
  m.restore({ version: 1, enabled: 'no', tick: -1, decisions: NaN, experiments: -1, policyInformationGain01: 9, decisionDisambiguation01: -1, counterfactualValue01: NaN, calibration01: 9, selectedAction: 'bogus', lesionFraction01: 9, alternatives: [{ action: 'respond', belief01: 9, uncertainty01: -1, value01: NaN, information01: 9, count: -1, wins: NaN }, { action: 'bogus', belief01: 9 }] });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2529 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2529 negative tick -> 0');
  assert.equal(st.decisions, 0, 'b2529 NaN decisions -> 0');
  assert.equal(st.policyInformationGain01, 1, 'b2529 over-1 -> 1');
  assert.equal(st.decisionDisambiguation01, 0, 'b2529 negative -> 0');
  assert.equal(st.counterfactualValue01, .5, 'b2529 NaN -> default');
  assert.equal(st.selectedAction, null, 'b2529 unknown selectedAction -> null');
  assert.equal(st.alternatives.length, 7, 'b2529 keeps seven canonical alternatives');
  const respond = st.alternatives.find((a) => a.action === 'respond');
  assert.equal(respond.belief01, 1, 'b2529 over-1 belief -> 1');
  assert.equal(respond.uncertainty01, 0, 'b2529 negative uncertainty -> 0');
  assert.equal(respond.value01, .5, 'b2529 NaN value -> default');
  assert.equal(respond.count, 0, 'b2529 negative count -> 0');
  assert.equal(respond.wins, 0, 'b2529 NaN wins -> 0');
  assert.doesNotThrow(() => m.restore(hostile('alternatives')));
  const d = defaultB2529State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2529 default round-trips');
}

// --- B2530AutonomousExperimentScheduler -------------------------------------
{
  const m = new B2530AutonomousExperimentScheduler();
  m.restore({ version: 1, enabled: 'no', tick: -1, proposals: NaN, executed: -1, useful: NaN, value01: 9, novelty01: -1, uncertainty01: NaN, computeEfficiency01: 9, thermalGate01: -1, selectedAction: 'bogus', lastReason: 5, lesionFraction01: 9 });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2530 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2530 negative tick -> 0');
  assert.equal(st.proposals, 0, 'b2530 NaN proposals -> 0');
  assert.equal(st.executed, 0, 'b2530 negative executed -> 0');
  assert.equal(st.value01, 1, 'b2530 over-1 value -> 1');
  assert.equal(st.novelty01, 0, 'b2530 negative novelty -> 0');
  assert.equal(st.uncertainty01, .5, 'b2530 NaN uncertainty -> default');
  assert.equal(st.thermalGate01, 0, 'b2530 negative gate -> 0');
  assert.equal(st.selectedAction, null, 'b2530 unknown selectedAction -> null');
  assert.equal(st.lastReason, 'none', 'b2530 non-string reason -> default');
  assert.equal(st.lesionFraction01, 1, 'b2530 over-1 lesion -> 1');
  assert.doesNotThrow(() => m.restore(hostile('value01')));
  const d = defaultB2530State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2530 default round-trips');
}

// --- B268CausalSelfExperimentLab --------------------------------------------
{
  const m = new B268CausalSelfExperimentLab();
  m.restore({ version: 1, committed: -1, reverted: NaN, held: -1, totalTrials: NaN, successfulCommitRate01: 9, meanPairedGain01: -1, meanWinRate01: NaN, rollbackPressure01: 9, baselineShadowActive: 'no', activeHypothesisId: 5, lastDecision: 'bogus', lastTick: -1, experiments: [{ id: 'e1', hypothesis: 5, targetAction: 'bogus', baselineMeanReturn01: 9, trialMeanReturn01: -1, pairedGain01: 9, winRate01: NaN, baselineRobustness01: -1, trialRobustness01: 9, robustnessDrop01: NaN, baselineDelayedReward01: -1, trialDelayedReward01: 9, decision: 'bogus', confidence01: 9 }, { hypothesis: 'no-id' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.committed, 0, 'b268 negative committed -> 0');
  assert.equal(st.reverted, 0, 'b268 NaN reverted -> 0');
  assert.equal(st.successfulCommitRate01, 1, 'b268 over-1 rate -> 1');
  assert.equal(st.meanPairedGain01, -1, 'b268 negative gain -> signed floor -1');
  assert.equal(st.rollbackPressure01, 1, 'b268 over-1 pressure -> 1');
  assert.equal(st.baselineShadowActive, true, 'b268 non-false shadow -> true');
  assert.equal(st.activeHypothesisId, null, 'b268 non-string hypothesis id -> null');
  assert.equal(st.lastDecision, null, 'b268 unknown decision -> null');
  assert.equal(st.lastTick, 0, 'b268 negative lastTick -> 0');
  assert.equal(st.experiments.length, 1, 'b268 drops id-less experiment');
  assert.equal(st.experiments[0].id, 'e1', 'b268 keeps valid experiment');
  assert.equal(st.experiments[0].hypothesis, '', 'b268 non-string hypothesis -> empty');
  assert.equal(st.experiments[0].targetAction, 'wait', 'b268 unknown target action -> wait');
  assert.equal(st.experiments[0].baselineMeanReturn01, 1, 'b268 over-1 return -> 1');
  assert.equal(st.experiments[0].trialMeanReturn01, 0, 'b268 negative return -> 0');
  assert.equal(st.experiments[0].pairedGain01, 1, 'b268 over-range gain -> 1');
  assert.equal(st.experiments[0].winRate01, 0, 'b268 NaN win rate -> 0');
  assert.equal(st.experiments[0].decision, 'hold', 'b268 unknown decision -> hold');
  assert.equal(st.experiments[0].confidence01, 1, 'b268 over-1 confidence -> 1');
  assert.doesNotThrow(() => m.restore(hostile('experiments')));
  const d = defaultB268CausalSelfExperimentLab();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b268 default round-trips');
}

console.log('WORKPASS72_EXPERIENCEMEM_CAUSALREGIME_ABLATION_POLICYINFO_EXPERIMENTSCHED_B268_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B2524NonparametricWorldExperienceMemory', 'B2526MultiscaleCausalRegimeGraph', 'B2527FactorialAblationHarness', 'B2529PolicyInformationGainController', 'B2530AutonomousExperimentScheduler', 'B268CausalSelfExperimentLab'] }));
