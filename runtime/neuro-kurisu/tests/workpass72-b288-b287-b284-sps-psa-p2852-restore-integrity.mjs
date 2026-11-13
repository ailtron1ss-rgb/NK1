import assert from 'node:assert/strict';
import { B288SocialPredictiveSelfOtherBrain, defaultB288State } from '../src/organism/cognition/B288SocialPredictiveSelfOtherBrain.ts';
import { B287RelationshipValueDevelopmentCore, defaultB287State } from '../src/organism/cognition/B287RelationshipValueDevelopmentCore.ts';
import { B284NeuralAutobiographicalIdentityCore, defaultB284State } from '../src/organism/cognition/B284NeuralAutobiographicalIdentityCore.ts';
import { SocialPredictiveNeuralSubstrate } from '../src/organism/cognition/SocialPredictiveNeuralSubstrate.ts';
import { PredictiveSelfAgencySubstrate } from '../src/organism/cognition/PredictiveSelfAgencySubstrate.ts';
import { P2852OfflineConsolidationController, defaultP2852OfflineConsolidation } from '../src/organism/cognition/P2852OfflineConsolidationController.ts';

/**
 * WorkPass72 — the social/identity/predictive cluster: the social-predictive
 * self-other brain, relationship-value development core, neural
 * autobiographical identity core, social-predictive neural substrate,
 * predictive self-agency substrate and offline consolidation controller. Each
 * merged a persisted snapshot with a bare spread, letting NaN/negative/hostile
 * values reach person/relation brains, identity traits, predictive weight
 * matrices and consolidation phases.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- B288SocialPredictiveSelfOtherBrain -------------------------------------
{
  const m = new B288SocialPredictiveSelfOtherBrain();
  m.restore({ version: 2, tick: -1, meanPrediction01: 9, activePersonId: 5, persons: [
    { personId: 'p1', latent: [2, 'x'], trust01: 9, interactionCount: -1, recentErrors: [NaN, -1, 'x'] },
    { latent: [1] }, 'x' ] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b288 negative tick -> 0');
  assert.equal(st.meanPrediction01, 1, 'b288 over-1 mean prediction -> 1');
  assert.equal(st.activePersonId, null, 'b288 non-string active person -> null');
  assert.equal(st.persons.length, 2, 'b288 drops non-object persons, keeps id-less object');
  assert.equal(st.persons[0].latent[0], 1, 'b288 latent clamped');
  assert.equal(st.persons[0].latent[1], 0, 'b288 non-number latent -> 0');
  assert.equal(st.persons[0].trust01, 1, 'b288 over-1 trust -> 1');
  assert.equal(st.persons[0].interactionCount, 0, 'b288 negative interactions -> 0');
  assert.equal(st.persons[0].recurrent.length, 32, 'b288 recurrent matrix rebuilt to DIM');
  assert.equal(st.persons[0].actionWeights.length, 7, 'b288 action weights row count');
  assert.ok(st.persons[0].recentErrors.every(Number.isFinite), 'b288 recent errors finite');
  assert.doesNotThrow(() => m.restore(hostile('persons')));
  m.restore(defaultB288State());
  assert.equal(m.snapshot().persons.length, 0, 'b288 empty default round-trips');
}

// --- B287RelationshipValueDevelopmentCore -----------------------------------
{
  const m = new B287RelationshipValueDevelopmentCore();
  m.restore({ version: 1, tick: -1, socialValueCoherence01: 9, relations: [
    { relationId: 'r1', latent: [2, 'x'], trust01: 9, successfulEpisodes: -1,
      relationshipValue01: { curiosity: 9 }, valueTrace: [2, 'x'],
      episodes: [{ tick: -1, action: 'bogus', reward01: 9 }, 'x'] }, 'x' ] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b287 negative tick -> 0');
  assert.equal(st.socialValueCoherence01, 1, 'b287 over-1 coherence -> 1');
  assert.equal(st.relations.length, 1, 'b287 drops non-object relations');
  assert.equal(st.relations[0].latent[0], 1, 'b287 latent clamped');
  assert.equal(st.relations[0].latent[1], 0, 'b287 non-number latent -> 0');
  assert.equal(st.relations[0].trust01, 1, 'b287 over-1 trust -> 1');
  assert.equal(st.relations[0].successfulEpisodes, 0, 'b287 negative episodes -> 0');
  assert.equal(st.relations[0].relationshipValue01.curiosity, 1, 'b287 over-1 value -> 1');
  assert.ok(typeof st.relations[0].relationshipValue01.truth === 'number', 'b287 value map rebuilt');
  assert.equal(st.relations[0].valueTrace[0], 1, 'b287 value trace clamped');
  assert.equal(st.relations[0].valueTrace[1], 0, 'b287 non-number trace -> 0');
  assert.equal(st.relations[0].recurrent.length, 32, 'b287 recurrent rebuilt to DIM');
  assert.equal(st.relations[0].episodes.length, 1, 'b287 drops non-object episodes');
  assert.equal(st.relations[0].episodes[0].action, 'respond', 'b287 unknown episode action -> first action');
  assert.doesNotThrow(() => m.restore(hostile('relations')));
  m.restore(defaultB287State());
  assert.equal(m.snapshot().relations.length, 0, 'b287 empty default round-trips');
}

// --- B284NeuralAutobiographicalIdentityCore ---------------------------------
{
  const m = new B284NeuralAutobiographicalIdentityCore();
  m.restore({ version: 1, tick: -1, valueCoherence01: 9, committedIdentityId: 5, revisionCandidateReason: 'bogus',
    identityLatent: [2, 'x'], identityWeights: [[2, NaN]], traitValues: { curiosity: 9, 'truth-seeking': NaN },
    traitInertia: { curiosity: 9 },
    episodes: [{ tick: -1, outcome01: 9, selfState: [2, 'x'] }, 'x'],
    recentAssemblies: [[2, 'x']], history: [{ tick: -1, continuity: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b284 negative tick -> 0');
  assert.equal(st.valueCoherence01, 1, 'b284 over-1 coherence -> 1');
  assert.equal(st.committedIdentityId, 'kurisu-self-core', 'b284 non-string identity id -> default');
  assert.equal(st.revisionCandidateReason, null, 'b284 unknown revision reason -> null');
  assert.equal(st.identityLatent[0], 1, 'b284 identity latent clamped');
  assert.equal(st.identityLatent[1], 0, 'b284 non-number latent -> 0');
  assert.equal(st.identityWeights.length, 24, 'b284 identity weights rebuilt to DIM');
  assert.ok(Number.isFinite(st.identityWeights[0][1]), 'b284 NaN weight -> finite fallback');
  assert.equal(st.traitValues.curiosity, 1, 'b284 over-1 trait -> 1');
  assert.equal(st.traitValues['truth-seeking'], defaultB284State().traitValues['truth-seeking'], 'b284 NaN trait -> default');
  assert.equal(st.traitInertia.curiosity, 1, 'b284 over-1 inertia -> 1');
  assert.equal(st.episodes.length, 1, 'b284 drops non-object episodes');
  assert.equal(st.episodes[0].outcome01, 1, 'b284 over-1 outcome -> 1');
  assert.equal(st.recentAssemblies[0].length, 24, 'b284 recent assembly rebuilt');
  assert.equal(st.history.length, 1, 'b284 drops non-object history');
  assert.equal(st.history[0].continuity, 1, 'b284 over-1 continuity -> 1');
  assert.doesNotThrow(() => m.restore(hostile('episodes')));
  m.restore(defaultB284State());
  assert.equal(m.snapshot().episodes.length, 0, 'b284 empty default round-trips');
}

// --- SocialPredictiveNeuralSubstrate ----------------------------------------
{
  const m = new SocialPredictiveNeuralSubstrate();
  m.restore({ version: 1, inputWeights: [[2, NaN]], recurrentWeights: 'x', bias: [2, 'x'], hidden: [-5],
    sampleCount: -1, learningRate: 9, meanPredictionError01: 9, validated: 'yes' });
  const st = m.snapshot();
  assert.equal(st.inputWeights.length, 20, 'sps input weights rebuilt to hiddenDim');
  assert.equal(st.inputWeights[0].length, 24, 'sps input weights row rebuilt to inputDim');
  assert.equal(st.inputWeights[0][0], 2, 'sps finite weight preserved');
  assert.ok(Number.isFinite(st.inputWeights[0][1]), 'sps NaN weight -> finite seeded fallback');
  assert.equal(st.recurrentWeights.length, 20, 'sps non-array recurrent -> default');
  assert.equal(st.bias.length, 20, 'sps bias rebuilt');
  assert.ok(st.bias.every(v => v >= 0 && v <= 1), 'sps bias unit-clamped');
  assert.equal(st.sampleCount, 0, 'sps negative samples -> 0');
  assert.equal(st.learningRate, .05, 'sps over-max learning rate -> .05');
  assert.equal(st.meanPredictionError01, 1, 'sps over-1 error -> 1');
  assert.equal(st.validated, false, 'sps non-boolean validated -> false');
  assert.doesNotThrow(() => m.restore(hostile('inputWeights')));
}

// --- PredictiveSelfAgencySubstrate ------------------------------------------
{
  const m = new PredictiveSelfAgencySubstrate();
  m.restore({ version: 1, selfLatent: [2, 'x'], actionRows: [[2, NaN]], actionBias: [2, 'x'],
    predictionError01: 9, lastAction: 'bogus', lastTick: -1, learningSteps: -1 });
  const st = m.snapshot();
  assert.equal(st.selfLatent[0], 1, 'psa self latent clamped');
  assert.equal(st.selfLatent[1], 0, 'psa non-number latent -> 0');
  assert.equal(st.actionRows.length, 7, 'psa action rows count');
  assert.equal(st.actionRows[0].length, 24, 'psa action row width');
  assert.equal(st.actionRows[0][0], 1, 'psa action weight clamped');
  assert.ok(Number.isFinite(st.actionRows[0][1]), 'psa NaN weight -> finite seeded fallback');
  assert.equal(st.actionBias[0], 1, 'psa bias clamped');
  assert.equal(st.actionBias[1], 0, 'psa non-number bias -> 0');
  assert.equal(st.predictionError01, 1, 'psa over-1 error -> 1');
  assert.equal(st.lastAction, 'wait', 'psa unknown action -> default');
  assert.equal(st.lastTick, 0, 'psa negative tick -> 0');
  assert.equal(st.learningSteps, 0, 'psa negative learning steps -> 0');
  assert.doesNotThrow(() => m.restore(hostile('actionRows')));
}

// --- P2852OfflineConsolidationController ------------------------------------
{
  const m = new P2852OfflineConsolidationController();
  m.restore({ version: 1, cycles: -1, utilityGain01: 9, phase: 'bogus', recentMix01: -1, phaseTicks: -1 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'p2852 negative cycles -> 0');
  assert.equal(st.utilityGain01, 1, 'p2852 over-1 gain -> 1');
  assert.equal(st.phase, 'wake', 'p2852 unknown phase -> default');
  assert.equal(st.recentMix01, 0, 'p2852 negative mix -> 0');
  assert.equal(st.phaseTicks, 0, 'p2852 negative phase ticks -> 0');
  assert.doesNotThrow(() => m.restore(hostile('cycles')));
  m.restore(defaultP2852OfflineConsolidation());
  assert.deepEqual(m.snapshot(), defaultP2852OfflineConsolidation(), 'p2852 default round-trips');
}

console.log('WORKPASS72_B288_B287_B284_SPS_PSA_P2852_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B288SocialPredictiveSelfOtherBrain', 'B287RelationshipValueDevelopmentCore', 'B284NeuralAutobiographicalIdentityCore', 'SocialPredictiveNeuralSubstrate', 'PredictiveSelfAgencySubstrate', 'P2852OfflineConsolidationController'] }));
