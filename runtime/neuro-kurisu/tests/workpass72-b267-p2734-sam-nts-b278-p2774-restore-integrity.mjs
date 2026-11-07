import assert from 'node:assert/strict';
import { B267AdaptiveRegimeController, defaultB267AdaptiveRegimeController } from '../src/organism/cognition/B267AdaptiveRegimeController.ts';
import { P2734SelfOptimizingContinualController, defaultP2734SelfOptimizingContinual } from '../src/organism/cognition/P2734SelfOptimizingContinualController.ts';
import { SelfOptimizingAutobiographicalMemory, defaultSelfOptimizingAutobiographicalMemory } from '../src/organism/cognition/SelfOptimizingAutobiographicalMemory.ts';
import { NeuralTemporalSubstrate, defaultNeuralTemporalSubstrate } from '../src/organism/cognition/NeuralTemporalSubstrate.ts';
import { B278NeuralPrimitiveGenesis, defaultB278State } from '../src/organism/cognition/B278NeuralPrimitiveGenesis.ts';
import { P2774ModelTimeReplayConsolidator } from '../src/organism/cognition/P2774ModelTimeReplayConsolidator.ts';

/**
 * WorkPass72 — the cognition cluster: adaptive regime controller, self
 * optimizing continual controller, self optimizing autobiographical memory,
 * neural temporal substrate, neural primitive genesis and the model-time replay
 * consolidator. Each merged a persisted snapshot with a bare spread, letting
 * NaN reach regime statistics, context prototypes and skill capsules, memory
 * arms and records, membrane/weight matrices, learned primitives and replay
 * traces.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });
const ACTIONS = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];

// --- B267AdaptiveRegimeController -------------------------------------------
{
  const m = new B267AdaptiveRegimeController();
  m.restore({ version: 1, mode: 'bogus', cusum01: 9, recovery01: -1, observationsCount: -1, lastAction: 'bogus', lastTick: NaN,
    observations: [{ action: 'respond', surprise01: 9, context: [9, 'x'] }, { action: 'bogus' }, 'x'],
    shifts: [{ action: 'respond', mode: 'verify', shift01: -1 }, { action: 'bogus' }, 'x'],
    verificationHistory: [9, -1, 'x'] });
  const st = m.snapshot();
  assert.equal(st.mode, 'exploit', 'b267 unknown mode -> exploit');
  assert.equal(st.cusum01, 1, 'b267 over-1 cusum -> 1');
  assert.equal(st.recovery01, 0, 'b267 negative recovery -> 0');
  assert.equal(st.observationsCount, 0, 'b267 negative observation count -> 0');
  assert.equal(st.lastAction, null, 'b267 unknown last action -> null');
  assert.equal(st.lastTick, 0, 'b267 NaN last tick -> 0');
  assert.equal(st.observations.length, 1, 'b267 drops action-less observation');
  assert.equal(st.observations[0].surprise01, 1, 'b267 over-1 surprise -> 1');
  assert.deepEqual(st.observations[0].context, [1, 0], 'b267 signed context clamped');
  assert.equal(st.shifts.length, 1, 'b267 drops malformed shift');
  assert.equal(st.shifts[0].shift01, 0, 'b267 negative shift -> 0');
  assert.deepEqual(st.verificationHistory, [1, 0, 0], 'b267 verification history clamped');
  assert.doesNotThrow(() => m.restore(hostile('observations')));
  const d = defaultB267AdaptiveRegimeController();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b267 default round-trips');
}

// --- P2734SelfOptimizingContinualController ---------------------------------
{
  const m = new P2734SelfOptimizingContinualController();
  m.restore({ version: 1, tick: -1, activeContextId: 999, selectedReplayArm: 99, enabled: 'yes',
    contextPrototype: [[9, 'x']], contextVisits: [-1], lastContextVector: [NaN],
    actionCalibration: [{ samples: -1, prediction01: 9, signedError01: 9 }, {}],
    skillCapsules: [[{ visits: -1, success01: 9, centroid: [9] }]],
    replayArms: [{ pulls: -1, meanUtility01: 9 }],
    replayMix01: [-1, 'x'], consolidationQueue: [-1, 5] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'p2734 negative tick -> 0');
  assert.equal(st.activeContextId, 5, 'p2734 active context clamped to max');
  assert.equal(st.selectedReplayArm, 0, 'p2734 out-of-range arm -> default');
  assert.equal(st.enabled, true, 'p2734 only explicit false disables');
  assert.equal(st.contextPrototype.length, 6, 'p2734 context prototype rows fixed');
  assert.equal(st.contextPrototype[0].length, 16, 'p2734 context prototype cols fixed');
  assert.equal(st.contextPrototype[0][0], 9, 'p2734 prototype finite value preserved');
  assert.equal(st.contextPrototype[0][1], 0, 'p2734 prototype non-finite -> 0');
  assert.equal(st.contextVisits[0], 0, 'p2734 negative context visit -> 0');
  assert.equal(st.lastContextVector[0], 0, 'p2734 NaN last vector -> 0');
  assert.equal(st.actionCalibration.length, 7, 'p2734 calibration covers all actions');
  assert.equal(st.actionCalibration[0].samples, 0, 'p2734 negative samples -> 0');
  assert.equal(st.actionCalibration[0].prediction01, 1, 'p2734 over-1 prediction -> 1');
  assert.equal(st.actionCalibration[0].signedError01, 1, 'p2734 over-1 signed error -> 1');
  assert.equal(st.skillCapsules.length, 6, 'p2734 capsules cover all contexts');
  assert.equal(st.skillCapsules[0][0].visits, 0, 'p2734 negative capsule visits -> 0');
  assert.equal(st.skillCapsules[0][0].centroid.length, 8, 'p2734 capsule centroid fixed');
  assert.equal(st.replayArms.length, 4, 'p2734 replay arms fixed');
  assert.equal(st.replayArms[0].pulls, 0, 'p2734 negative arm pulls -> 0');
  assert.ok(Math.abs(st.replayMix01.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'p2734 replay mix normalized');
  assert.equal(st.consolidationQueue[0], 0, 'p2734 negative queue entry -> 0');
  assert.doesNotThrow(() => m.restore(hostile('contextPrototype')));
  const d = defaultP2734SelfOptimizingContinual(6);
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p2734 default round-trips');
}

// --- SelfOptimizingAutobiographicalMemory -----------------------------------
{
  const m = new SelfOptimizingAutobiographicalMemory();
  m.restore({ version: 1, tick: -1, selectedStrategy: 'bogus', selectedRedirect: 'bogus', selectedMemoryId: 5, memoryUtility01: 9,
    armCounts: [-1, 'x'], armValues: [9, NaN],
    memories: [{ tick: -1, goalPressure01: 9, novelty01: -1, action: 'bogus', context: [9], writes: -1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'sam negative tick -> 0');
  assert.equal(st.selectedStrategy, 'retrieve', 'sam unknown strategy -> default');
  assert.equal(st.selectedRedirect, null, 'sam unknown redirect -> null');
  assert.equal(st.selectedMemoryId, null, 'sam non-string memory id -> null');
  assert.equal(st.memoryUtility01, 1, 'sam over-1 utility -> 1');
  assert.equal(st.armCounts.length, 7, 'sam arm counts fixed length');
  assert.equal(st.armCounts[0], 0, 'sam negative arm count -> 0');
  assert.equal(st.armValues[0], 1, 'sam over-1 arm value -> 1');
  assert.equal(st.armValues[1], .5, 'sam NaN arm value -> .5');
  assert.equal(st.memories.length, 1, 'sam keeps object memory, drops string');
  assert.equal(st.memories[0].tick, 0, 'sam negative memory tick -> 0');
  assert.equal(st.memories[0].goalPressure01, 1, 'sam over-1 memory pressure -> 1');
  assert.equal(st.memories[0].novelty01, 0, 'sam negative memory novelty -> 0');
  assert.equal(st.memories[0].action, null, 'sam unknown memory action -> null');
  assert.equal(st.memories[0].context.length, 24, 'sam memory context fixed');
  assert.equal(st.memories[0].writes, 1, 'sam memory writes floor 1');
  assert.doesNotThrow(() => m.restore(hostile('memories')));
  const d = defaultSelfOptimizingAutobiographicalMemory();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'sam default round-trips');
}

// --- NeuralTemporalSubstrate -------------------------------------------------
{
  const m = new NeuralTemporalSubstrate();
  m.restore({ version: 1, tick: -1, neurons: 4, inputDim: 2, plasticity01: 9, sparsity01: -1, meanWeightAbs01: NaN,
    membrane: [9, 'x'], spikes: [NaN], thresholds: [9], adaptation: [-1],
    recurrentTargets: [[9, 'x']], recurrentWeights: [[NaN]], inputWeights: [[9]], eligibility: [[-1]],
    preTrace: [9], postTrace: [NaN], slowTrace: [-1], predictionReadout: [9],
    learningUpdates: -1, spikeCount: NaN, lastReward01: 9 });
  const st = m.snapshot();
  assert.equal(st.neurons, 32, 'nts neuron count is canonical, not caller-supplied');
  assert.equal(st.inputDim, 64, 'nts input dim canonical');
  assert.equal(st.fanIn, 6, 'nts fan-in canonical');
  assert.equal(st.tick, 0, 'nts negative tick -> 0');
  assert.equal(st.plasticity01, 1, 'nts over-1 plasticity -> 1');
  assert.equal(st.sparsity01, 0, 'nts negative sparsity -> 0');
  assert.equal(st.meanWeightAbs01, .05, 'nts NaN mean weight -> .05 default');
  assert.equal(st.membrane.length, 32, 'nts membrane fixed length');
  assert.equal(st.membrane[0], 9, 'nts finite membrane preserved');
  assert.equal(st.membrane[1], 0, 'nts non-finite membrane -> 0');
  assert.equal(st.spikes[0], 0, 'nts NaN spike -> 0');
  assert.equal(st.thresholds[0], 9, 'nts finite threshold preserved');
  assert.equal(st.adaptation[0], -1, 'nts signed adaptation preserved');
  assert.equal(st.recurrentWeights[0].length, 6, 'nts recurrent weights cols fixed');
  assert.equal(st.inputWeights[0].length, 64, 'nts input weights cols fixed');
  assert.equal(st.recurrentWeights[0][0], 0, 'nts NaN weight -> 0');
  assert.equal(st.learningUpdates, 0, 'nts negative updates -> 0');
  assert.equal(st.spikeCount, 0, 'nts NaN spike count -> 0');
  assert.equal(st.lastReward01, 1, 'nts over-1 reward -> 1');
  assert.doesNotThrow(() => m.restore(hostile('membrane')));
  const d = defaultNeuralTemporalSubstrate();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'nts default round-trips');
}

// --- B278NeuralPrimitiveGenesis ---------------------------------------------
{
  const m = new B278NeuralPrimitiveGenesis();
  m.restore({ version: 1, ticks: -1, lastAction: 'bogus', autonomy01: 9, compositionCoherence01: -1, lastGain01: 9,
    activePrimitiveIds: [5, 'p1', ''],
    lastInternalVector: [NaN, 9],
    primitives: [{ id: 'p1', transform: [9, 'x'], contextActionProjection: [[9]], status: 'bogus', bias: 9, usage: -1, parentOperatorId: 5 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.ticks, 0, 'b278 negative ticks -> 0');
  assert.equal(st.lastAction, null, 'b278 unknown last action -> null');
  assert.equal(st.autonomy01, 1, 'b278 over-1 autonomy -> 1');
  assert.equal(st.compositionCoherence01, 0, 'b278 negative coherence -> 0');
  assert.equal(st.lastGain01, 1, 'b278 over-1 gain -> 1');
  assert.deepEqual(st.activePrimitiveIds, ['p1'], 'b278 keeps only non-empty string ids');
  assert.equal(st.lastInternalVector.length, 12, 'b278 internal vector fixed');
  assert.equal(st.lastInternalVector[0], 0, 'b278 NaN internal vector -> 0');
  assert.equal(st.primitives.length, 2, 'b278 maps every primitive row through sanitizer');
  const p = st.primitives[0];
  assert.equal(p.transform.length, 24, 'b278 transform fixed');
  assert.equal(p.transform[0], 9, 'b278 finite transform preserved');
  assert.equal(p.transform[1], 0, 'b278 non-finite transform -> 0');
  assert.equal(p.contextActionProjection.length, 7, 'b278 capsule rows fixed');
  assert.equal(p.contextActionProjection[0].length, 8, 'b278 capsule cols fixed');
  assert.equal(p.contextActionProjection[0][0], 9, 'b278 finite capsule preserved');
  assert.equal(p.status, 'germinal', 'b278 unknown status -> germinal');
  assert.equal(p.bias, 1, 'b278 over-1 bias -> 1');
  assert.equal(p.usage, 0, 'b278 negative usage -> 0');
  assert.equal(p.parentOperatorId, null, 'b278 non-string parent -> null');
  assert.doesNotThrow(() => m.restore(hostile('primitives')));
  const d = defaultB278State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b278 default round-trips');
}

// --- P2774ModelTimeReplayConsolidator ---------------------------------------
{
  const m = new P2774ModelTimeReplayConsolidator();
  const d = new P2774ModelTimeReplayConsolidator().snapshot();
  m.restore({ version: 1, tick: -1, enabled: 'yes', replayBudget01: 9, forgettingRisk01: -1, modelTimeDelta01: NaN,
    contextRecurrence: [-1, 'x'], actionRecurrence: [[9, 'x']], contextSemantic: [[NaN]], contextSemanticConfidence: [9, -1],
    traces: [{ tick: -1, contextId: 999, actionIndex: 99, reward01: 9, novelty01: -1, latent: [NaN, 9], modelTimeStamp: -1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'p2774 negative tick -> 0');
  assert.equal(st.enabled, true, 'p2774 only explicit false disables');
  assert.equal(st.replayBudget01, 1, 'p2774 over-1 budget -> 1');
  assert.equal(st.forgettingRisk01, 0, 'p2774 negative forgetting risk -> 0');
  assert.equal(st.modelTimeDelta01, 0, 'p2774 NaN model time delta -> default 0');
  assert.equal(st.contextRecurrence.length, 8, 'p2774 context recurrence fixed');
  assert.equal(st.contextRecurrence[0], 0, 'p2774 negative recurrence -> 0');
  assert.equal(st.actionRecurrence.length, 8, 'p2774 action recurrence rows fixed');
  assert.equal(st.actionRecurrence[0].length, 7, 'p2774 action recurrence cols fixed');
  assert.equal(st.actionRecurrence[0][0], 9, 'p2774 finite recurrence preserved');
  assert.equal(st.contextSemantic[0].length, 8, 'p2774 semantic cols fixed');
  assert.equal(st.contextSemantic[0][0], 0, 'p2774 NaN semantic -> 0');
  assert.equal(st.contextSemanticConfidence[0], 1, 'p2774 over-1 confidence -> 1');
  assert.equal(st.contextSemanticConfidence[1], 0, 'p2774 negative confidence -> 0');
  assert.equal(st.traces.length, 1, 'p2774 keeps object trace, drops string');
  assert.equal(st.traces[0].tick, 0, 'p2774 negative trace tick -> 0');
  assert.equal(st.traces[0].contextId, 7, 'p2774 trace context clamped');
  assert.equal(st.traces[0].actionIndex, 6, 'p2774 trace action clamped');
  assert.equal(st.traces[0].reward01, 1, 'p2774 over-1 trace reward -> 1');
  assert.equal(st.traces[0].novelty01, 0, 'p2774 negative trace novelty -> 0');
  assert.equal(st.traces[0].latent.length, 8, 'p2774 trace latent fixed');
  assert.equal(st.traces[0].latent[0], 0, 'p2774 NaN trace latent -> 0');
  assert.equal(st.traces[0].latent[1], 9, 'p2774 finite trace latent preserved');
  assert.doesNotThrow(() => m.restore(hostile('traces')));
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p2774 default round-trips');
}

console.log('WORKPASS72_B267_P2734_SAM_NTS_B278_P2774_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B267AdaptiveRegimeController', 'P2734SelfOptimizingContinualController', 'SelfOptimizingAutobiographicalMemory', 'NeuralTemporalSubstrate', 'B278NeuralPrimitiveGenesis', 'P2774ModelTimeReplayConsolidator'] }));
