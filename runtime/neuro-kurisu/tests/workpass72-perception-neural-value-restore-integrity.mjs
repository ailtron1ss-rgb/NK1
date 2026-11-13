import assert from 'node:assert/strict';
import { MultimodalPerception, defaultMultimodalState } from '../src/organism/body/MultimodalPerception.ts';
import { B2506NeuralBottleneckEscalator, defaultB2506State } from '../src/organism/cognition/B2506NeuralBottleneckEscalator.ts';
import { B2507ConsolidationScheduler, defaultB2507State } from '../src/organism/cognition/B2507ConsolidationScheduler.ts';
import { B2508AdaptiveNeuralComputeGovernor, defaultB2508State } from '../src/organism/cognition/B2508AdaptiveNeuralComputeGovernor.ts';
import { B265IndependentPolicyEvaluator, defaultB265IndependentPolicyEvaluator } from '../src/organism/cognition/B265IndependentPolicyEvaluator.ts';
import { B266HiddenTaskGeneralization, defaultB266HiddenTaskGeneralization } from '../src/organism/cognition/B266HiddenTaskGeneralization.ts';
import { BoundedRecurrentStateSubstrate } from '../src/organism/cognition/BoundedRecurrentStateSubstrate.ts';
import { P74IntegratedOrganismKernel, defaultP74 } from '../src/organism/cognition/P74IntegratedOrganismKernel.ts';
import { ValuePlasticity, DEFAULT_ADAPTIVE_VALUES } from '../src/organism/cognition/ValuePlasticity.ts';

/**
 * WorkPass72 — perception / neural-compute / generalisation / value restore
 * integrity. Each owner merged a persisted snapshot with a bare spread, letting
 * NaN reach modality reliability, neural-authority scalars, consolidation
 * pressure, policy-evaluation metrics, hidden-family gains and identity values.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);
const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- MultimodalPerception ---------------------------------------------------
{
  const m = new MultimodalPerception();
  m.restore({ version: 1, events: NaN, fused: -1, lastFusionAt: -1, lastConfidence: 9, lastSalience: -1, modalities: { text: -1, vision: NaN, bogus: 1 }, recent: [{ modality: 'text', at: -1, summary: 5, confidence: 9, salience: -1, evidence: ['e', 5] }, { modality: 'bogus' }], visionCaptures: -1, speechTurns: NaN, fusionConflicts: -1 });
  const st = m.snapshot();
  assert.equal(st.events, 0, 'perception NaN events -> 0');
  assert.equal(st.fused, 0, 'perception negative fused -> 0');
  assert.equal(st.lastFusionAt, 0, 'perception negative lastFusionAt -> 0');
  assert.equal(st.lastConfidence, 1, 'perception over-1 confidence -> 1');
  assert.equal(st.lastSalience, 0, 'perception negative salience -> 0');
  assert.equal(st.modalities.text, 0, 'perception negative modality count -> 0');
  assert.equal(st.modalities.vision, 0, 'perception NaN modality count -> 0');
  assert.equal(st.recent.length, 1, 'perception drops unknown-modality observation');
  assert.equal(st.recent[0].at, 0, 'perception negative observation at -> 0');
  assert.equal(st.recent[0].summary, '', 'perception non-string summary -> empty');
  assert.deepEqual(st.recent[0].evidence, ['e'], 'perception drops non-string evidence');
  assert.equal(st.speechTurns, 0, 'perception NaN speechTurns -> 0');
  assert.doesNotThrow(() => m.restore(hostile('modalities')));
  const mDefault = defaultMultimodalState();

  m.restore(mDefault);
  assert.deepEqual(m.snapshot(), mDefault, 'perception default round-trips');
}

// --- B2506NeuralBottleneckEscalator -----------------------------------------
{
  const b = new B2506NeuralBottleneckEscalator();
  b.restore({ version: 1, enabled: true, tick: -1, cycles: NaN, authority01: 9, reliability01: -1, causalEvidence01: NaN, consensus01: 9, conflict01: -1, failure01: NaN, escalations: -1, deescalations: NaN, lastComposite: [9, -1, NaN], lastBase: [9], lastSelectedPrediction01: NaN, lastSelectedAction: 'bogus', mode: 'bogus' });
  const st = b.snapshot();
  assert.equal(st.tick, 0, 'b2506 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b2506 NaN cycles -> 0');
  assert.equal(st.authority01, 1, 'b2506 over-1 authority -> 1');
  assert.equal(st.reliability01, 0, 'b2506 negative reliability -> 0');
  assert.equal(st.causalEvidence01, .5, 'b2506 NaN causalEvidence -> midpoint');
  assert.equal(st.escalations, 0, 'b2506 negative escalations -> 0');
  assert.equal(st.lastComposite.length, 7, 'b2506 composite renormalised to action count');
  assert.equal(st.lastComposite[0], 1, 'b2506 over-1 composite -> 1');
  assert.equal(st.lastComposite[1], 0, 'b2506 negative composite -> 0');
  assert.equal(st.lastComposite[2], .5, 'b2506 NaN composite -> midpoint');
  assert.equal(st.lastBase.length, 7, 'b2506 base renormalised');
  assert.equal(st.lastSelectedAction, 'wait', 'b2506 unknown action -> default');
  assert.equal(st.mode, 'guarded', 'b2506 unknown mode -> default');
  assert.doesNotThrow(() => b.restore(hostile('lastComposite')));
  const bDefault = defaultB2506State();

  b.restore(bDefault);
  assert.deepEqual(b.snapshot(), bDefault, 'b2506 default round-trips');
}

// --- B2507ConsolidationScheduler --------------------------------------------
{
  const b = new B2507ConsolidationScheduler();
  b.restore({ version: 1, enabled: true, tick: -1, awakeCycles: -1, replayCycles: NaN, deepCycles: -1, budget: 3, mode: 'bogus', sleepPressure01: 9, consolidationPressure01: -1, lastReason: 5 });
  const st = b.snapshot();
  assert.equal(st.tick, 0, 'b2507 negative tick -> 0');
  assert.equal(st.awakeCycles, 0, 'b2507 negative awakeCycles -> 0');
  assert.equal(st.replayCycles, 0, 'b2507 NaN replayCycles -> 0');
  assert.equal(st.deepCycles, 0, 'b2507 negative deepCycles -> 0');
  assert.equal(st.budget, 1, 'b2507 invalid budget -> default');
  assert.equal(st.mode, 'awake', 'b2507 unknown mode -> default');
  assert.equal(st.sleepPressure01, 1, 'b2507 over-1 pressure -> 1');
  assert.equal(st.consolidationPressure01, 0, 'b2507 negative pressure -> 0');
  assert.equal(st.lastReason, 'startup', 'b2507 non-string reason -> default');
  assert.doesNotThrow(() => b.restore(hostile('budget')));
  const bDefault = defaultB2507State();

  b.restore(bDefault);
  assert.deepEqual(b.snapshot(), bDefault, 'b2507 default round-trips');
}

// --- B2508AdaptiveNeuralComputeGovernor -------------------------------------
{
  const b = new B2508AdaptiveNeuralComputeGovernor();
  b.restore({ version: 1, enabled: true, tick: -1, cycles: NaN, mode: 'bogus', computeBudget01: 9, horizon: 9, skipFactor: -1, thermalGuard01: NaN, energyGuard01: 9, uncertaintyDemand01: -1, predictionDemand01: NaN });
  const st = b.snapshot();
  assert.equal(st.tick, 0, 'b2508 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b2508 NaN cycles -> 0');
  assert.equal(st.mode, 'balanced', 'b2508 unknown mode -> default');
  assert.equal(st.computeBudget01, 1, 'b2508 over-1 budget -> 1');
  assert.equal(st.horizon, 3, 'b2508 invalid horizon -> default');
  assert.equal(st.skipFactor, 0, 'b2508 negative skipFactor -> 0');
  assert.equal(st.thermalGuard01, .5, 'b2508 NaN thermal guard -> midpoint');
  assert.equal(st.energyGuard01, 1, 'b2508 over-1 energy guard -> 1');
  assert.equal(st.uncertaintyDemand01, 0, 'b2508 negative demand -> 0');
  assert.doesNotThrow(() => b.restore(hostile('horizon')));
  const bDefault = defaultB2508State();

  b.restore(bDefault);
  assert.deepEqual(b.snapshot(), bDefault, 'b2508 default round-trips');
}

// --- B265IndependentPolicyEvaluator -----------------------------------------
{
  const b = new B265IndependentPolicyEvaluator();
  b.restore({ version: 1, episodes: [{ taskId: 't1', steps: [{ step: -1, action: 'bogus' }, { step: 1, action: 'wait', context: [9, -1, NaN], reward01: 9, state: [1], nextState: [] }], policyReturn01: 9, baselineReturn01: -1, randomReturn01: NaN, regret01: 9, evaluatorScore01: NaN }, { steps: [] }], evaluations: -1, steps: NaN, heldoutEpisodes: -1, policyReturn01: NaN, baselineReturn01: 9, randomReturn01: -1, advantage01: NaN, heldoutAdvantage01: 9, longHorizonGain01: -1, evaluatorAgreement01: NaN, counterfactualGain01: 9, calibration01: NaN, lastTaskId: 5, lastTick: -1 });
  const st = b.snapshot();
  assert.equal(st.episodes.length, 1, 'b265 drops episode without taskId');
  assert.equal(st.episodes[0].steps.length, 1, 'b265 drops step with unknown action');
  assert.equal(st.episodes[0].steps[0].step, 1, 'b265 keeps valid step');
  assert.deepEqual(st.episodes[0].steps[0].context, [1, 0, 0], 'b265 clamps context vector');
  assert.equal(st.episodes[0].steps[0].reward01, 1, 'b265 over-1 reward -> 1');
  assert.equal(st.episodes[0].policyReturn01, 1, 'b265 over-1 return -> 1');
  assert.equal(st.episodes[0].baselineReturn01, 0, 'b265 negative return -> 0');
  assert.equal(st.episodes[0].randomReturn01, 0, 'b265 NaN return -> 0');
  assert.equal(st.evaluations, 0, 'b265 negative evaluations -> 0');
  assert.equal(st.steps, 0, 'b265 NaN steps -> 0');
  assert.equal(st.policyReturn01, .5, 'b265 NaN metric -> default');
  assert.equal(st.baselineReturn01, 1, 'b265 over-1 metric -> 1');
  assert.equal(st.advantage01, 0, 'b265 NaN advantage -> default');
  assert.equal(st.lastTaskId, null, 'b265 non-string lastTaskId -> null');
  assert.equal(st.lastTick, 0, 'b265 negative lastTick -> 0');
  assert.doesNotThrow(() => b.restore(hostile('episodes')));
  const bDefault = defaultB265IndependentPolicyEvaluator();

  b.restore(bDefault);
  assert.deepEqual(b.snapshot(), bDefault, 'b265 default round-trips');
}

// --- B266HiddenTaskGeneralization -------------------------------------------
{
  const b = new B266HiddenTaskGeneralization();
  b.restore({ version: 1, families: [{ id: 'f1', seed: -1, horizon: 0, rewardDelay: NaN, drift: 9, adversarial: 1, difficulty: -1 }, { seed: 1 }], episodes: [{ familyId: 'f1', heldout: 1, return01: 9, baseline01: -1, random01: NaN, advantage01: 9, delayedReward01: -1, interventionGap01: NaN, robustness01: 9, steps: -1 }, { heldout: true }], trainEpisodes: -1, holdoutEpisodes: NaN, longHorizonGain01: 9, delayedRewardGain01: -1, hiddenFamilyGain01: NaN, robustness01: 9, catastrophicShift01: -1, calibration01: NaN, lastFamilyId: 5, lastTick: -1 });
  const st = b.snapshot();
  assert.equal(st.families.length, 1, 'b266 drops family without id');
  assert.equal(st.families[0].seed, 0, 'b266 negative seed -> 0');
  assert.equal(st.families[0].horizon, 1, 'b266 zero horizon -> 1');
  assert.equal(st.families[0].drift, 1, 'b266 over-1 drift -> 1');
  assert.equal(st.families[0].difficulty, 0, 'b266 negative difficulty -> 0');
  assert.equal(st.episodes.length, 1, 'b266 drops episode without familyId');
  assert.equal(st.episodes[0].return01, 1, 'b266 over-1 return -> 1');
  assert.equal(st.episodes[0].baseline01, 0, 'b266 negative baseline -> 0');
  assert.equal(st.episodes[0].steps, 0, 'b266 negative steps -> 0');
  assert.equal(st.trainEpisodes, 0, 'b266 negative trainEpisodes -> 0');
  assert.equal(st.holdoutEpisodes, 0, 'b266 NaN holdoutEpisodes -> 0');
  assert.equal(st.longHorizonGain01, 1, 'b266 over-1 gain -> 1');
  assert.equal(st.hiddenFamilyGain01, 0, 'b266 NaN gain -> default');
  assert.equal(st.lastFamilyId, null, 'b266 non-string lastFamilyId -> null');
  assert.doesNotThrow(() => b.restore(hostile('families')));
  const bDefault = defaultB266HiddenTaskGeneralization();

  b.restore(bDefault);
  assert.deepEqual(b.snapshot(), bDefault, 'b266 default round-trips');
}

// --- BoundedRecurrentStateSubstrate -----------------------------------------
{
  const b = new BoundedRecurrentStateSubstrate(4, 'test');
  b.restore({ version: 1, dimension: 99, updates: -1, resets: NaN, spectralProxy01: 9, state: [9, -9, NaN, .5], lastInput: [NaN], leak01: -1, gain01: 9, bounded01: NaN });
  const st = b.snapshot();
  assert.equal(st.dimension, 4, 'recurrent keeps constructor dimension');
  assert.equal(st.updates, 0, 'recurrent negative updates -> 0');
  assert.equal(st.resets, 0, 'recurrent NaN resets -> 0');
  assert.equal(st.spectralProxy01, 1, 'recurrent over-1 spectral -> 1');
  assert.deepEqual(st.state, [1, -1, 0, .5], 'recurrent clamps state to [-1,1]');
  assert.deepEqual(st.lastInput, [0, 0, 0, 0], 'recurrent pads and clamps lastInput');
  assert.equal(st.leak01, 0, 'recurrent negative leak -> 0');
  assert.equal(st.gain01, 1, 'recurrent over-1 gain -> 1');
  assert.equal(st.bounded01, 1, 'recurrent NaN bounded -> default');
  assert.doesNotThrow(() => b.restore(hostile('state')));
}

// --- P74IntegratedOrganismKernel --------------------------------------------
{
  const p = new P74IntegratedOrganismKernel();
  p.restore({ version: 1, ticks: -1, mode: 'bogus', modeStreak: NaN, lastMode: 'bogus', integration01: 9, attentionBudget01: -1, selfWorld01: NaN, epistemic01: 9, developmental01: -1, modeCounts: { observe: -1, engage: NaN, bogus: 5 }, recentModes: ['observe', 'bogus'], recentActions: ['a', 5], lastReasons: ['r', 5], lastAt: -1 });
  const st = p.snapshot();
  assert.equal(st.ticks, 0, 'p74 negative ticks -> 0');
  assert.equal(st.mode, 'observe', 'p74 unknown mode -> default');
  assert.equal(st.modeStreak, 0, 'p74 NaN modeStreak -> 0');
  assert.equal(st.lastMode, null, 'p74 unknown lastMode -> null');
  assert.equal(st.integration01, 1, 'p74 over-1 integration -> 1');
  assert.equal(st.attentionBudget01, 0, 'p74 negative attention -> 0');
  assert.equal(st.selfWorld01, .7, 'p74 NaN selfWorld -> default');
  assert.equal(st.modeCounts.observe, 0, 'p74 negative mode count -> 0');
  assert.equal(st.modeCounts.engage, 0, 'p74 NaN mode count -> 0');
  assert.equal(st.modeCounts.bogus, undefined, 'p74 drops unknown mode key');
  assert.deepEqual(st.recentModes, ['observe'], 'p74 drops unknown recent mode');
  assert.deepEqual(st.recentActions, ['a'], 'p74 drops non-string recent action');
  assert.deepEqual(st.lastReasons, ['r'], 'p74 drops non-string reason');
  assert.equal(st.lastAt, 0, 'p74 negative lastAt -> 0');
  assert.doesNotThrow(() => p.restore(hostile('modeCounts')));
  const pDefault = defaultP74();

  p.restore(pDefault);
  assert.deepEqual(p.snapshot(), pDefault, 'p74 default round-trips');
}

// --- ValuePlasticity --------------------------------------------------------
{
  const v = new ValuePlasticity();
  v.restore({ curiosity: NaN, truth: 9, autonomy: -1, evidence: 0, care: 5, responsibility: 0.02, social: 0.6, updatedAt: -1, plasticityBudget: 9 });
  const st = v.snapshot();
  assert.equal(st.curiosity, .9, 'value NaN curiosity -> default');
  assert.equal(st.truth, 1, 'value over-1 truth -> 1');
  assert.equal(st.autonomy, .1, 'value negative autonomy -> floor');
  assert.equal(st.evidence, .1, 'value below-floor evidence -> floor');
  assert.equal(st.care, 1, 'value over-1 care -> 1');
  assert.equal(st.responsibility, .1, 'value below-floor responsibility -> floor');
  assert.equal(st.social, .6, 'value in-range social preserved');
  assert.equal(st.updatedAt, 0, 'value negative updatedAt -> 0');
  assert.equal(st.plasticityBudget, 1, 'value over-1 plasticityBudget -> 1');
  finite(st.truth, 'value truth');
  assert.doesNotThrow(() => v.restore(hostile('curiosity')));
  v.restore(DEFAULT_ADAPTIVE_VALUES);
  assert.deepEqual(v.snapshot(), { ...DEFAULT_ADAPTIVE_VALUES }, 'value default round-trips');
}

console.log('WORKPASS72_PERCEPTION_NEURAL_VALUE_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['MultimodalPerception', 'B2506NeuralBottleneckEscalator', 'B2507ConsolidationScheduler', 'B2508AdaptiveNeuralComputeGovernor', 'B265IndependentPolicyEvaluator', 'B266HiddenTaskGeneralization', 'BoundedRecurrentStateSubstrate', 'P74IntegratedOrganismKernel', 'ValuePlasticity'] }));
