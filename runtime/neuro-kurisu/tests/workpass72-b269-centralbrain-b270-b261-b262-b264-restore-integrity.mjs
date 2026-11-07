import assert from 'node:assert/strict';
import { B269SpikingPlasticNeuralSubstrate, defaultB269SpikingPlastic } from '../src/organism/cognition/B269SpikingPlasticNeuralSubstrate.ts';
import { CentralBrainSubstrate } from '../src/organism/cognition/CentralBrainSubstrate.ts';
import { B270NeuralGerminalOrganism, defaultB270NeuralGerminalOrganism } from '../src/organism/cognition/B270NeuralGerminalOrganism.ts';
import { B261UnifiedWorldModel, defaultB261UnifiedWorldModel } from '../src/organism/cognition/B261UnifiedWorldModel.ts';
import { B262MultiTimescaleWorldModel, defaultB262MultiTimescaleWorldModel } from '../src/organism/cognition/B262MultiTimescaleWorldModel.ts';
import { B264CausalPolicyLearning, defaultB264CausalPolicyLearning } from '../src/organism/cognition/B264CausalPolicyLearning.ts';

/**
 * WorkPass72 — neural-substrate / world-model cluster: the spiking plastic
 * neural substrate, central brain substrate, neural germinal organism, unified
 * world model, multi-timescale world model and causal policy learner. Each
 * merged a persisted snapshot with a bare spread, letting NaN/negative/hostile
 * values reach neuron membranes, synaptic lists, identity traits, world
 * transition weights, timescale weight tensors and policy rows.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- B269SpikingPlasticNeuralSubstrate --------------------------------------
{
  const m = new B269SpikingPlasticNeuralSubstrate();
  m.restore({ version: 1, neuronCount: 999, cycles: -1, membrane: [2, 'x'], threshold: [9, 'x'],
    synapses: [{ pre: 9999, post: -3, weight: 9, usage01: 9, age: -1 }, 'x'],
    actionBias: [[2, 'x']], lastAction: 'bogus', plasticity01: 9,
    history: [{ tick: -1, action: 'bogus', spikes: -1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.neuronCount, 64, 'b269 neuronCount capped to 64');
  assert.equal(st.cycles, 0, 'b269 negative cycles -> 0');
  assert.equal(st.membrane.length, 64, 'b269 membrane rebuilt to neuronCount');
  assert.equal(st.membrane[0], 1, 'b269 over-1 membrane -> 1');
  assert.equal(st.membrane[1], 0, 'b269 non-number membrane -> 0');
  assert.equal(st.threshold[0], .9, 'b269 over-max threshold -> .9');
  assert.equal(st.synapses.length, 1, 'b269 drops non-object synapses');
  assert.equal(st.synapses[0].pre, 63, 'b269 synapse pre clamped to neuronCount-1');
  assert.equal(st.synapses[0].post, 0, 'b269 synapse post clamped >= 0');
  assert.equal(st.synapses[0].weight, 1, 'b269 synapse weight clamped');
  assert.equal(st.synapses[0].age, 0, 'b269 synapse age floored');
  assert.equal(st.actionBias.length, 7, 'b269 action bias row count');
  assert.equal(st.actionBias[0].length, 64, 'b269 action bias rebuilt to neuronCount');
  assert.equal(st.lastAction, null, 'b269 unknown last action -> null');
  assert.equal(st.plasticity01, 1, 'b269 over-1 plasticity -> 1');
  assert.equal(st.history.length, 1, 'b269 drops non-object history');
  assert.equal(st.history[0].action, null, 'b269 unknown history action -> null');
  assert.doesNotThrow(() => m.restore(hostile('synapses')));
  m.restore(defaultB269SpikingPlastic());
  assert.equal(m.snapshot().synapses.length > 0, true, 'b269 default round-trips');
}

// --- CentralBrainSubstrate --------------------------------------------------
{
  const m = new CentralBrainSubstrate();
  m.restore({ version: 1, hidden: [2, 'x'], recurrentWeights: [[2, NaN]], stepCount: -1,
    predictionError01: 9, qualityGate: { validated: 'yes', minPredictionSamples: -1, reason: 5 } });
  const st = m.snapshot();
  assert.equal(st.hidden.length, 64, 'cb hidden rebuilt to hiddenDim');
  assert.equal(st.hidden[0], 1, 'cb over-1 hidden -> 1');
  assert.equal(st.hidden[1], 0, 'cb non-number hidden -> 0');
  assert.equal(st.recurrentWeights.length, 64, 'cb recurrent rebuilt');
  assert.ok(Number.isFinite(st.recurrentWeights[0][1]), 'cb NaN weight -> finite fallback');
  assert.equal(st.inputWeights.length, 64, 'cb input weights rebuilt');
  assert.equal(st.outputWeights.length, 48, 'cb output weights rebuilt to inputDim');
  assert.equal(st.stepCount, 0, 'cb negative stepCount -> 0');
  assert.equal(st.predictionError01, 1, 'cb over-1 prediction error -> 1');
  assert.equal(st.qualityGate.validated, false, 'cb non-boolean validated -> false');
  assert.equal(st.qualityGate.minPredictionSamples, 0, 'cb negative min samples -> 0');
  assert.equal(typeof st.qualityGate.reason, 'string', 'cb non-string reason -> default');
  assert.doesNotThrow(() => m.restore(hostile('qualityGate')));
}

// --- B270NeuralGerminalOrganism ---------------------------------------------
{
  const m = new B270NeuralGerminalOrganism();
  m.restore({ version: 1, tick: -1, traitValues: { curiosity: 9 }, traitEvidence: { curiosity: 9 },
    needs: { novelty01: 9, energy01: -1 }, selfLatent: [2, 'x'], agency01: 9,
    lastAction: 'bogus', proposedAction: 'bogus',
    neuralEmbryos: [{ id: 5, activation01: 9 }, 'x'],
    history: [{ tick: -1, action: 'bogus', reward01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b270 negative tick -> 0');
  assert.equal(st.traitValues.curiosity, 1, 'b270 over-1 trait -> 1');
  assert.ok(typeof st.traitValues.caution === 'number', 'b270 traits rebuilt');
  assert.equal(st.traitEvidence.curiosity, 1, 'b270 over-1 evidence -> 1');
  assert.equal(st.needs.novelty01, 1, 'b270 over-1 need -> 1');
  assert.equal(st.needs.energy01, 0, 'b270 negative need -> 0');
  assert.equal(st.selfLatent.length, 16, 'b270 self latent rebuilt');
  assert.equal(st.selfLatent[0], 1, 'b270 over-1 latent -> 1');
  assert.equal(st.selfLatent[1], 0, 'b270 non-number latent -> 0');
  assert.equal(st.agency01, 1, 'b270 over-1 agency -> 1');
  assert.equal(st.lastAction, null, 'b270 unknown last action -> null');
  assert.equal(st.proposedAction, 'wait', 'b270 unknown proposed action -> default');
  assert.equal(st.neuralEmbryos.length, 2, 'b270 keeps id-less embryo object');
  assert.equal(st.neuralEmbryos[0].activation01, 1, 'b270 over-1 embryo activation -> 1');
  assert.equal(typeof st.neuralEmbryos[0].id, 'string', 'b270 non-string embryo id -> fallback');
  assert.equal(st.history.length, 1, 'b270 drops non-object history');
  assert.equal(st.history[0].action, null, 'b270 unknown history action -> null');
  assert.doesNotThrow(() => m.restore(hostile('neuralEmbryos')));
  m.restore(defaultB270NeuralGerminalOrganism());
  assert.equal(m.snapshot().neuralEmbryos.length, 12, 'b270 default round-trips');
}

// --- B261UnifiedWorldModel --------------------------------------------------
{
  const m = new B261UnifiedWorldModel();
  m.restore({ version: 3, steps: -1, hidden: [2, 'x'], transitionWeights: [[2, NaN]],
    rewardBias: 9, actionEmbeddings: [[2, 'x']], lastAction: 'bogus', uncertainty01: 9,
    episodes: [{ tick: -1, action: 'bogus', before: [2, 'x'], actualReward01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.steps, 0, 'b261 negative steps -> 0');
  assert.equal(st.hidden.length, 24, 'b261 hidden rebuilt to DIM');
  assert.equal(st.hidden[0], 1, 'b261 over-1 hidden -> 1');
  assert.ok(Number.isFinite(st.hidden[1]), 'b261 non-number hidden -> finite seeded fallback');
  assert.equal(st.transitionWeights.length, 24, 'b261 transition weights rebuilt');
  assert.ok(Number.isFinite(st.transitionWeights[0][1]), 'b261 NaN weight -> finite seeded fallback');
  assert.equal(st.actionEmbeddings.length, 7, 'b261 action embeddings row count');
  assert.equal(st.actionEmbeddings[0].length, 24, 'b261 action embedding rebuilt');
  assert.equal(st.rewardBias, 1, 'b261 over-1 reward bias -> 1');
  assert.equal(st.lastAction, null, 'b261 unknown last action -> null');
  assert.equal(st.uncertainty01, 1, 'b261 over-1 uncertainty -> 1');
  assert.equal(st.episodes.length, 1, 'b261 drops non-object episodes');
  assert.equal(st.episodes[0].action, 'wait', 'b261 unknown episode action -> default');
  assert.equal(st.episodes[0].before.length, 24, 'b261 episode before rebuilt');
  assert.doesNotThrow(() => m.restore(hostile('episodes')));
  m.restore(defaultB261UnifiedWorldModel());
  assert.equal(m.snapshot().episodes.length, 0, 'b261 empty default round-trips');
}

// --- B262MultiTimescaleWorldModel -------------------------------------------
{
  const m = new B262MultiTimescaleWorldModel();
  m.restore({ version: 2, steps: -1, shortWeights: [[2, NaN]], sequenceWeights: [[[2, NaN]]],
    sequenceBias: [[2, 'x']], shortError01: 9, episodes: [{ tick: -1, action: 'bogus', before: [2, 'x'] }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.steps, 0, 'b262 negative steps -> 0');
  assert.equal(st.shortWeights.length, 24, 'b262 short weights rebuilt');
  assert.ok(Number.isFinite(st.shortWeights[0][1]), 'b262 NaN weight -> finite seeded fallback');
  assert.equal(st.sequenceWeights.length, 4, 'b262 sequence weight tensors rebuilt');
  assert.equal(st.sequenceWeights[0].length, 24, 'b262 sequence weight matrix rebuilt');
  assert.equal(st.sequenceBias.length, 4, 'b262 sequence bias rows rebuilt');
  assert.equal(st.sequenceBias[0].length, 24, 'b262 sequence bias vector rebuilt');
  assert.equal(st.shortError01, 1, 'b262 over-1 short error -> 1');
  assert.equal(st.episodes.length, 1, 'b262 drops non-object episodes');
  assert.equal(st.episodes[0].action, 'wait', 'b262 unknown episode action -> default');
  assert.doesNotThrow(() => m.restore(hostile('sequenceWeights')));
  m.restore(defaultB262MultiTimescaleWorldModel());
  assert.equal(m.snapshot().episodes.length, 0, 'b262 empty default round-trips');
}

// --- B264CausalPolicyLearning -----------------------------------------------
{
  const m = new B264CausalPolicyLearning();
  m.restore({ version: 1, decisions: -1, actionValue: [9, 'x'], actionCounts: [-1],
    contextWeights: [[2, NaN]], lastChosen: 'bogus', meanRegret01: 9,
    rows: [{ tick: -1, action: 'bogus', context: [2, 'x'], reward01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.decisions, 0, 'b264 negative decisions -> 0');
  assert.equal(st.actionValue.length, 7, 'b264 action value row count');
  assert.equal(st.actionValue[0], 1, 'b264 over-1 action value -> 1');
  assert.ok(Number.isFinite(st.actionValue[1]), 'b264 non-number action value -> default');
  assert.equal(st.actionCounts[0], 0, 'b264 negative action count -> 0');
  assert.equal(st.contextWeights.length, 7, 'b264 context weights row count');
  assert.equal(st.contextWeights[0].length, 16, 'b264 context weights rebuilt to dimension');
  assert.ok(Number.isFinite(st.contextWeights[0][1]), 'b264 NaN weight -> finite fallback');
  assert.equal(st.lastChosen, null, 'b264 unknown last chosen -> null');
  assert.equal(st.meanRegret01, 1, 'b264 over-1 mean regret -> 1');
  assert.equal(st.rows.length, 1, 'b264 drops non-object rows');
  assert.equal(st.rows[0].action, 'wait', 'b264 unknown row action -> default');
  assert.equal(st.rows[0].context.length, 16, 'b264 row context rebuilt');
  assert.doesNotThrow(() => m.restore(hostile('rows')));
  m.restore(defaultB264CausalPolicyLearning());
  assert.equal(m.snapshot().rows.length, 0, 'b264 empty default round-trips');
}

console.log('WORKPASS72_B269_CENTRALBRIAN_B270_B261_B262_B264_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B269SpikingPlasticNeuralSubstrate', 'CentralBrainSubstrate', 'B270NeuralGerminalOrganism', 'B261UnifiedWorldModel', 'B262MultiTimescaleWorldModel', 'B264CausalPolicyLearning'] }));
