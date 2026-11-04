import assert from 'node:assert/strict';
import { B280MultiAreaNeuralCircuit, defaultB280State } from '../src/organism/cognition/B280MultiAreaNeuralCircuit.ts';
import { ExternalGroundingAdaptiveController, defaultExternalGroundingAdaptiveController } from '../src/organism/cognition/ExternalGroundingAdaptiveController.ts';
import { RiskAwareRecoveryController, defaultRiskAwareRecoveryController } from '../src/organism/cognition/RiskAwareRecoveryController.ts';
import { B273AutonomousGoalLifecycle, defaultB273State } from '../src/organism/cognition/B273AutonomousGoalLifecycle.ts';
import { B277NeuralOperatorGenesis, defaultB277State } from '../src/organism/cognition/B277NeuralOperatorGenesis.ts';
import { B279NeuralAttractorAssemblies, defaultB279State } from '../src/organism/cognition/B279NeuralAttractorAssemblies.ts';

/**
 * WorkPass72 — the neural/cognition cluster: the multi-area neural circuit,
 * external grounding adaptive controller, risk-aware recovery controller,
 * autonomous goal lifecycle, neural operator genesis and neural attractor
 * assemblies. Each merged a persisted snapshot with a bare spread, letting
 * NaN/negative/hostile values reach weight matrices, area state, grounding
 * channels, risk calibration, goal/skill graphs, neural operators and attractor
 * assemblies.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- B280MultiAreaNeuralCircuit ---------------------------------------------
{
  const m = new B280MultiAreaNeuralCircuit();
  m.restore({ version: 1, tick: -1, cycles: -1, neuromodulation01: 9, crossAreaCoherence01: -1, lastAction: 'bogus',
    areas: { sensorium: { membrane: [2, 'x'], spikes: [-5], firingRate01: 9 }, memory: 'x' },
    recurrentWeights: { sensorium: [[2, NaN]], memory: 'x' },
    actionReadout: [[2, NaN]],
    lastContext: [2, 'x'], lastSpikes: [-1, 2],
    history: [{ tick: -1, action: 'bogus', reward01: 9, coherence01: -1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b280 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b280 negative cycles -> 0');
  assert.equal(st.neuromodulation01, 1, 'b280 over-1 neuromodulation -> 1');
  assert.equal(st.crossAreaCoherence01, 0, 'b280 negative coherence -> 0');
  assert.equal(st.lastAction, null, 'b280 unknown last action -> null');
  assert.equal(st.areas.sensorium.membrane[0], 1, 'b280 membrane clamped high');
  assert.equal(st.areas.sensorium.membrane[1], 0, 'b280 non-number membrane -> 0');
  assert.equal(st.areas.sensorium.spikes[0], 0, 'b280 negative spikes -> 0');
  assert.equal(st.areas.sensorium.firingRate01, 1, 'b280 over-1 firing rate -> 1');
  assert.ok(Array.isArray(st.areas.memory.membrane), 'b280 non-object area falls back to default');
  assert.equal(st.recurrentWeights.sensorium[0][0], 1, 'b280 weight clamped high');
  assert.equal(st.recurrentWeights.sensorium[0][1], 0, 'b280 NaN weight -> 0');
  assert.equal(st.recurrentWeights.memory.length, 12, 'b280 non-array weight map rebuilt');
  assert.equal(st.actionReadout.length, 7, 'b280 action readout row count');
  assert.equal(st.lastContext[0], 1, 'b280 last context clamped');
  assert.equal(st.lastSpikes[0], 0, 'b280 negative last spike -> 0');
  assert.equal(st.history.length, 1, 'b280 drops non-object history');
  assert.equal(st.history[0].action, null, 'b280 unknown history action -> null');
  assert.equal(st.history[0].tick, 0, 'b280 negative history tick -> 0');
  assert.doesNotThrow(() => m.restore(hostile('areas')));
  const d = defaultB280State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b280 default round-trips');
}

// --- ExternalGroundingAdaptiveController ------------------------------------
{
  const m = new ExternalGroundingAdaptiveController();
  m.restore({ version: 1, tick: -1, grounding01: 9, contradiction01: -1, selectedChannel: 5,
    channels: [{ id: 'c1', reliability01: 9, observations: -1, lastTick: -1 }, { reliability01: 1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'egac negative tick -> 0');
  assert.equal(st.grounding01, 1, 'egac over-1 grounding -> 1');
  assert.equal(st.contradiction01, 0, 'egac negative contradiction -> 0');
  assert.equal(st.selectedChannel, null, 'egac non-string selected channel -> null');
  assert.equal(st.channels.length, 1, 'egac drops id-less and non-object channels');
  assert.equal(st.channels[0].reliability01, 1, 'egac over-1 reliability -> 1');
  assert.equal(st.channels[0].observations, 0, 'egac negative observations -> 0');
  assert.equal(st.channels[0].lastTick, 0, 'egac negative lastTick -> 0');
  assert.doesNotThrow(() => m.restore(hostile('channels')));
  const d = defaultExternalGroundingAdaptiveController();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'egac default round-trips');
}

// --- RiskAwareRecoveryController --------------------------------------------
{
  const m = new RiskAwareRecoveryController();
  m.restore({ version: 1, tick: -1, meanRisk01: 9, recoverability01: -1, selectedRecovery: 'bogus', recoveryAttempts: -1 });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'rarc negative tick -> 0');
  assert.equal(st.meanRisk01, 1, 'rarc over-1 mean risk -> 1');
  assert.equal(st.recoverability01, 0, 'rarc negative recoverability -> 0');
  assert.equal(st.selectedRecovery, null, 'rarc non-recovery action -> null');
  assert.equal(st.recoveryAttempts, 0, 'rarc negative attempts -> 0');
  assert.doesNotThrow(() => m.restore(hostile('meanRisk01')));
  const d = defaultRiskAwareRecoveryController();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'rarc default round-trips');
}

// --- B273AutonomousGoalLifecycle --------------------------------------------
{
  const m = new B273AutonomousGoalLifecycle();
  m.restore({ version: 1, tick: -1, lifecycleMode: 'bogus', autonomy01: 9, activeGoalId: 5,
    goals: [{ id: 'g1', status: 'bogus', source: 'bogus', vector: [2, 'x'], importance01: 9, age: -1 }, { status: 'active' }, 'x'],
    skills: [{ id: 's1', actions: ['reflect', 'bogus'], support01: 9 }, { actions: ['reflect'] }, 'x'],
    goalUtilityWeights: [2, NaN], lastActionPlan: ['reflect', 'bogus'], lastAction: 'bogus',
    outcomeHistory: [{ tick: -1, action: 'bogus', reward01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b273 negative tick -> 0');
  assert.equal(st.lifecycleMode, 'incubating', 'b273 unknown mode -> default');
  assert.equal(st.autonomy01, 1, 'b273 over-1 autonomy -> 1');
  assert.equal(st.activeGoalId, null, 'b273 non-string active goal -> null');
  assert.equal(st.goals.length, 1, 'b273 drops id-less and non-object goals');
  assert.equal(st.goals[0].status, 'candidate', 'b273 unknown goal status -> candidate');
  assert.equal(st.goals[0].source, 'intrinsic', 'b273 unknown goal source -> intrinsic');
  assert.equal(st.goals[0].vector[0], 1, 'b273 goal vector clamped');
  assert.equal(st.goals[0].vector[1], 0, 'b273 non-number vector -> 0');
  assert.equal(st.goals[0].importance01, 1, 'b273 over-1 importance -> 1');
  assert.equal(st.goals[0].age, 0, 'b273 negative age -> 0');
  assert.equal(st.skills.length, 1, 'b273 drops id-less and non-object skills');
  assert.deepEqual(st.skills[0].actions, ['reflect'], 'b273 skill actions filtered');
  assert.equal(st.skills[0].support01, 1, 'b273 over-1 support -> 1');
  assert.equal(st.goalUtilityWeights[0], 1, 'b273 utility weight clamped');
  assert.equal(st.goalUtilityWeights[1], defaultB273State().goalUtilityWeights[1], 'b273 NaN utility weight -> default');
  assert.deepEqual(st.lastActionPlan, ['reflect'], 'b273 plan filtered');
  assert.equal(st.lastAction, 'reflect', 'b273 unknown last action -> reflect');
  assert.equal(st.outcomeHistory.length, 1, 'b273 drops non-object outcomes');
  assert.equal(st.outcomeHistory[0].action, 'reflect', 'b273 unknown outcome action -> reflect');
  assert.equal(st.outcomeHistory[0].reward01, 1, 'b273 over-1 reward -> 1');
  assert.doesNotThrow(() => m.restore(hostile('goals')));
  const d = defaultB273State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b273 default round-trips');
}

// --- B277NeuralOperatorGenesis ----------------------------------------------
{
  const m = new B277NeuralOperatorGenesis();
  m.restore({ version: 1, ticks: -1, neuralSparsity01: 9, lastAction: 'bogus', activeOperatorId: 5,
    lastOutput: [2, 'x'],
    operators: [{ id: 'o1', status: 'bogus', weights: [2, NaN], dendriticGate: [-5], usage: -1, bias: NaN }, { weights: [1] }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.ticks, 0, 'b277 negative ticks -> 0');
  assert.equal(st.neuralSparsity01, 1, 'b277 over-1 sparsity -> 1');
  assert.equal(st.lastAction, null, 'b277 unknown last action -> null');
  assert.equal(st.activeOperatorId, null, 'b277 non-string active operator -> null');
  assert.equal(st.lastOutput[0], 1, 'b277 last output clamped');
  assert.equal(st.lastOutput[1], 0, 'b277 non-number output -> 0');
  assert.equal(st.operators.length, 1, 'b277 drops id-less and non-object operators');
  assert.equal(st.operators[0].status, 'germinal', 'b277 unknown operator status -> germinal');
  assert.equal(st.operators[0].weights[0], 1, 'b277 weight clamped');
  assert.equal(st.operators[0].weights[1], 0, 'b277 NaN weight -> 0');
  assert.equal(st.operators[0].weights.length, 2, 'b277 weight vector preserves persisted length');
  assert.equal(st.operators[0].dendriticGate[0], -1, 'b277 gate clamped low');
  assert.equal(st.operators[0].usage, 0, 'b277 negative usage -> 0');
  assert.equal(st.operators[0].bias, 0, 'b277 NaN bias -> 0');
  assert.equal(st.operators[0].contextDecoder.length, 7, 'b277 context decoder rebuilt');
  assert.equal(st.operators[0].contextDecoder[0].length, 8, 'b277 context decoder rows padded to 8');
  assert.doesNotThrow(() => m.restore(hostile('operators')));
  const d = defaultB277State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b277 default round-trips');
}

// --- B279NeuralAttractorAssemblies ------------------------------------------
{
  const m = new B279NeuralAttractorAssemblies();
  m.restore({ version: 1, neuronCount: 999, cycles: -1, firingRate01: 9, lastAction: 'bogus',
    recurrentWeights: [[2, NaN]], thresholds: [2, 'x'], actionWeights: [[2, NaN]],
    lastInput: [2, 'x'], activeNeurons: [999, -1, 5], recentAssemblies: [[2, NaN]],
    history: [{ tick: -1, action: 'bogus', reward01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.ok(st.neuronCount >= 16 && st.neuronCount <= 32, 'b279 neuron count clamped to range');
  assert.equal(st.cycles, 0, 'b279 negative cycles -> 0');
  assert.equal(st.firingRate01, 1, 'b279 over-1 firing rate -> 1');
  assert.equal(st.lastAction, null, 'b279 unknown last action -> null');
  assert.equal(st.recurrentWeights.length, st.neuronCount, 'b279 recurrent matrix rebuilt to n');
  assert.equal(st.recurrentWeights[0][0], 1, 'b279 weight clamped');
  assert.ok(Number.isFinite(st.recurrentWeights[0][1]) && Math.abs(st.recurrentWeights[0][1]) <= 1, 'b279 NaN weight -> finite seeded fallback');
  assert.equal(st.thresholds.length, st.neuronCount, 'b279 thresholds length');
  assert.equal(st.thresholds[0], .95, 'b279 threshold clamped high');
  assert.equal(st.thresholds[1], .48, 'b279 non-number threshold -> default');
  assert.equal(st.actionWeights.length, 7, 'b279 action weight rows');
  assert.equal(st.actionWeights[0][0], 1, 'b279 action weight clamped');
  assert.equal(st.lastInput[0], 1, 'b279 last input clamped');
  assert.equal(st.lastInput[1], 0, 'b279 non-number input -> 0');
  assert.ok(st.activeNeurons.every(v => v >= 0 && v < st.neuronCount), 'b279 active neurons in range');
  assert.equal(st.recentAssemblies[0].length, st.neuronCount, 'b279 recent assembly rebuilt');
  assert.equal(st.history.length, 1, 'b279 drops non-object history');
  assert.equal(st.history[0].action, null, 'b279 unknown history action -> null');
  assert.equal(st.history[0].reward01, 1, 'b279 over-1 reward -> 1');
  assert.doesNotThrow(() => m.restore(hostile('recurrentWeights')));
  const d = defaultB279State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b279 default round-trips');
}

console.log('WORKPASS72_B280_EGAC_RARC_B273_B277_B279_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B280MultiAreaNeuralCircuit', 'ExternalGroundingAdaptiveController', 'RiskAwareRecoveryController', 'B273AutonomousGoalLifecycle', 'B277NeuralOperatorGenesis', 'B279NeuralAttractorAssemblies'] }));
