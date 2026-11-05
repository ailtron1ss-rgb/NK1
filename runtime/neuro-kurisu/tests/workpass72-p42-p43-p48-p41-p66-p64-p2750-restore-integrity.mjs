import assert from 'node:assert/strict';
import { P42UnifiedEmbodiedExperienceEngine as P42UnifiedEmbodiedExperience, defaultP42 } from '../src/organism/cognition/P42UnifiedEmbodiedExperience.ts';
import { P43EmbodiedImageryWorkspace, defaultP43 } from '../src/organism/cognition/P43EmbodiedImageryWorkspace.ts';
import { P48FunctionalAwarenessCore, defaultP48State } from '../src/organism/cognition/P48FunctionalAwarenessCore.ts';
import { P41NativePerceptionEngine as P41NativePerception, defaultP41NativePerception } from '../src/organism/cognition/P41NativePerception.ts';
import { P66InteroceptiveHomeostasis, defaultP66 } from '../src/organism/cognition/P66InteroceptiveHomeostasis.ts';
import { P64IntegratedOrganismDynamics, defaultP64 } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';
import { P2750UnifiedCausalWorldLoop, defaultP2750UnifiedCausalWorldLoop } from '../src/organism/cognition/P2750UnifiedCausalWorldLoop.ts';

/**
 * WorkPass72 — perception / embodiment / homeostasis cluster: unified embodied
 * experience, embodied imagery workspace, functional-awareness core, native
 * perception, interoceptive homeostasis, integrated organism dynamics and the
 * unified causal world loop. Each merged a persisted snapshot with a bare
 * spread, letting NaN/negative/hostile values reach embodied vectors, scene
 * contents, awareness indicators, sensory histories, homeostasis setpoints,
 * mode frames and causal-world bands.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- P42UnifiedEmbodiedExperience -------------------------------------------
{
  const m = new P42UnifiedEmbodiedExperience();
  m.restore({ version: 1, tick: -1, current: { scene: 5, vector: [2, 'x'], salience01: 9 },
    actionBias: { explore: 9 }, metrics: { grounding01: 9 },
    history: [{ at: -1, scene: 5, vector: [2, 'x'], salience01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'p42 negative tick -> 0');
  assert.equal(st.current.vector.length, 24, 'p42 current vector rebuilt');
  assert.equal(st.current.vector[0], 1, 'p42 over-1 vector -> 1');
  assert.equal(st.current.vector[1], .5, 'p42 non-number vector -> .5');
  assert.equal(st.current.salience01, 1, 'p42 over-1 salience -> 1');
  assert.equal(typeof st.current.scene, 'string', 'p42 non-string scene -> default');
  assert.equal(st.actionBias.explore, 1, 'p42 over-1 bias -> 1');
  assert.equal(st.metrics.grounding01, 1, 'p42 over-1 grounding -> 1');
  assert.equal(st.history.length, 1, 'p42 drops non-object history');
  assert.equal(st.history[0].vector.length, 24, 'p42 history vector rebuilt');
  assert.doesNotThrow(() => m.restore(hostile('current')));
  m.restore(defaultP42());
  assert.deepEqual(m.snapshot(), defaultP42(), 'p42 default round-trips');
}

// --- P43EmbodiedImageryWorkspace --------------------------------------------
{
  const m = new P43EmbodiedImageryWorkspace();
  m.restore({ version: 1, tick: -1, scene: { label: 5, objects: [5, 'ok'], relations: 'x' },
    activeContents: [{ id: 5, source: 'bogus', salience01: 9 }, 'x'],
    imagined: [{ action: 'bogus', expectedValue01: 9 }, 'x'],
    actionBias: { explore: 9 }, metrics: { workspaceUse01: 9 } });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'p43 negative tick -> 0');
  assert.equal(typeof st.scene.label, 'string', 'p43 non-string scene label -> default');
  assert.deepEqual(st.scene.objects, ['ok'], 'p43 scene objects string-filtered');
  assert.deepEqual(st.scene.relations, [], 'p43 non-array relations -> default');
  assert.equal(st.activeContents.length, 1, 'p43 drops non-object contents');
  assert.equal(st.activeContents[0].source, 'perception', 'p43 unknown source -> default');
  assert.equal(st.activeContents[0].salience01, 1, 'p43 over-1 salience -> 1');
  assert.equal(typeof st.activeContents[0].id, 'string', 'p43 non-string id -> default');
  assert.equal(st.imagined.length, 1, 'p43 drops non-object imagined');
  assert.equal(st.imagined[0].action, 'wait', 'p43 unknown imagined action -> default');
  assert.equal(st.imagined[0].expectedValue01, 1, 'p43 over-1 expected value -> 1');
  assert.equal(st.actionBias.explore, 1, 'p43 over-1 bias -> 1');
  assert.equal(st.metrics.workspaceUse01, 1, 'p43 over-1 metric -> 1');
  assert.doesNotThrow(() => m.restore(hostile('scene')));
  m.restore(defaultP43());
  assert.deepEqual(m.snapshot(), defaultP43(), 'p43 default round-trips');
}

// --- P48FunctionalAwarenessCore ---------------------------------------------
{
  const m = new P48FunctionalAwarenessCore();
  m.restore({ version: 1, cycles: -1, workspaceCapacity: 999, ignitionRate01: 9, lastWinnerId: 5,
    higherOrder: { selfRepresentation01: 9 }, interoception: { bodyEnergy01: 9 },
    indicators: [{ domain: 'bogus', functionalEvidence01: 9, observations: -1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'p48 negative cycles -> 0');
  assert.equal(st.workspaceCapacity, 16, 'p48 over-max capacity -> 16');
  assert.equal(st.ignitionRate01, 1, 'p48 over-1 ignition rate -> 1');
  assert.equal(st.lastWinnerId, null, 'p48 non-string winner -> null');
  assert.equal(st.higherOrder.selfRepresentation01, 1, 'p48 over-1 higher order -> 1');
  assert.equal(st.interoception.bodyEnergy01, 1, 'p48 over-1 interoception -> 1');
  assert.equal(st.indicators.length, 1, 'p48 drops non-object indicators');
  assert.equal(st.indicators[0].domain, 'global-workspace', 'p48 unknown domain -> default');
  assert.equal(st.indicators[0].functionalEvidence01, 1, 'p48 over-1 evidence -> 1');
  assert.equal(st.indicators[0].observations, 0, 'p48 negative observations -> 0');
  assert.doesNotThrow(() => m.restore(hostile('higherOrder')));
  m.restore(defaultP48State());
  assert.deepEqual(m.snapshot(), defaultP48State(), 'p48 default round-trips');
}

// --- P41NativePerception ----------------------------------------------------
{
  const m = new P41NativePerception();
  m.restore({ version: 1, frames: -1, lastAudio: { rms01: 9, sampleCount: -1 }, lastImage: 'x',
    audioHistory: [{ rms01: 9 }, 'x'], imageHistory: [{ brightness01: 9 }, 'x'],
    semanticCues: [{ id: 5, modality: 'bogus', confidence01: 9 }, 'x'],
    actionBias: { explore: 9 }, metrics: { signalStability01: 9 } });
  const st = m.snapshot();
  assert.equal(st.frames, 0, 'p41 negative frames -> 0');
  assert.equal(st.lastAudio.rms01, 1, 'p41 over-1 audio feature -> 1');
  assert.equal(st.lastAudio.sampleCount, 0, 'p41 negative sample count -> 0');
  assert.equal(st.lastImage, null, 'p41 non-object image -> null');
  assert.equal(st.audioHistory.length, 1, 'p41 drops non-object audio history');
  assert.equal(st.imageHistory.length, 1, 'p41 drops non-object image history');
  assert.equal(st.semanticCues.length, 1, 'p41 drops non-object cues');
  assert.equal(st.semanticCues[0].modality, 'audio', 'p41 unknown modality -> default');
  assert.equal(st.semanticCues[0].confidence01, 1, 'p41 over-1 confidence -> 1');
  assert.equal(st.actionBias.explore, 1, 'p41 over-1 bias -> 1');
  assert.equal(st.metrics.signalStability01, 1, 'p41 over-1 metric -> 1');
  assert.doesNotThrow(() => m.restore(hostile('audioHistory')));
  m.restore(defaultP41NativePerception());
  assert.deepEqual(m.snapshot(), defaultP41NativePerception(), 'p41 default round-trips');
}

// --- P66InteroceptiveHomeostasis --------------------------------------------
{
  const m = new P66InteroceptiveHomeostasis();
  m.restore({ version: 1, cycles: -1, modeCounts: { balance: -1 }, setpoints: { energy01: 9 },
    lastMode: 'bogus', lastPressure01: 9, recoveryDebt01: 9, stableCycles: -1,
    history: [{ at: -1, mode: 'bogus', error01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'p66 negative cycles -> 0');
  assert.equal(st.modeCounts.balance, 0, 'p66 negative mode count -> 0');
  assert.ok(typeof st.modeCounts.recover === 'number', 'p66 mode counts rebuilt');
  assert.equal(st.setpoints.energy01, 1, 'p66 over-1 setpoint -> 1');
  assert.equal(st.lastMode, 'balance', 'p66 unknown mode -> default');
  assert.equal(st.lastPressure01, 1, 'p66 over-1 pressure -> 1');
  assert.equal(st.recoveryDebt01, 1, 'p66 over-1 debt -> 1');
  assert.equal(st.stableCycles, 0, 'p66 negative stable cycles -> 0');
  assert.equal(st.history.length, 1, 'p66 drops non-object history');
  assert.equal(st.history[0].mode, 'balance', 'p66 unknown history mode -> default');
  assert.doesNotThrow(() => m.restore(hostile('modeCounts')));
  m.restore(defaultP66());
  assert.deepEqual(m.snapshot(), defaultP66(), 'p66 default round-trips');
}

// --- P64IntegratedOrganismDynamics ------------------------------------------
{
  const m = new P64IntegratedOrganismDynamics();
  m.restore({ version: 1, cycles: -1, modeCounts: { learn: -1 }, lastMode: 'bogus',
    meanIntegration01: 9, lastFrame: { mode: 'bogus', coalition: [5, 'ok'], reasons: 'x' },
    history: [{ mode: 'bogus', actionBias: { explore: 1 }, coalition: [5, 'ok'] }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'p64 negative cycles -> 0');
  assert.equal(st.modeCounts.learn, 0, 'p64 negative mode count -> 0');
  assert.ok(typeof st.modeCounts.protect === 'number', 'p64 mode counts rebuilt');
  assert.equal(st.lastMode, null, 'p64 unknown last mode -> null');
  assert.equal(st.meanIntegration01, 1, 'p64 over-1 integration -> 1');
  assert.equal(st.lastFrame.mode, 'orient', 'p64 unknown frame mode -> default');
  assert.deepEqual(st.lastFrame.coalition, ['ok'], 'p64 frame coalition string-filtered');
  assert.deepEqual(st.lastFrame.reasons, [], 'p64 non-array reasons -> default');
  assert.equal(st.history.length, 1, 'p64 drops non-object history');
  assert.equal(st.history[0].mode, 'orient', 'p64 unknown history mode -> default');
  assert.equal(st.history[0].actionBias.explore, 1, 'p64 frame bias map preserved');
  assert.doesNotThrow(() => m.restore(hostile('history')));
  m.restore(defaultP64());
  assert.deepEqual(m.snapshot(), defaultP64(), 'p64 default round-trips');
}

// --- P2750UnifiedCausalWorldLoop --------------------------------------------
{
  const m = new P2750UnifiedCausalWorldLoop();
  m.restore({ version: 1, tick: -1, activeContextId: 999, contextVisits: [-1],
    contextCentroids: [[2, 'x']], fast: { values: [2, 'x'], decay01: 9 },
    causalMatrix: [[2, NaN]], actions: [{ samples: -1, rewardMean01: 9 }],
    planningDepth: 99, predictionHorizon: -5, lastActionIndex: 99, lastReason: 5 });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'p2750 negative tick -> 0');
  assert.equal(st.activeContextId, 7, 'p2750 over-max context id clamped');
  assert.equal(st.contextCentroids.length, 8, 'p2750 context centroids rebuilt');
  assert.equal(st.contextCentroids[0][0], 1, 'p2750 over-1 centroid -> 1');
  assert.equal(st.contextVisits[0], 0, 'p2750 negative visits -> 0');
  assert.equal(st.fast.values.length, 8, 'p2750 band values rebuilt');
  assert.equal(st.fast.values[0], 1, 'p2750 over-1 band value -> 1');
  assert.equal(st.fast.decay01, .999, 'p2750 over-max decay -> .999');
  assert.equal(st.causalMatrix.length, 8, 'p2750 causal matrix rebuilt');
  assert.ok(Number.isFinite(st.causalMatrix[0][1]), 'p2750 NaN matrix -> finite fallback');
  assert.equal(st.actions.length, 7, 'p2750 action models rebuilt');
  assert.equal(st.actions[0].samples, 0, 'p2750 negative samples -> 0');
  assert.equal(st.actions[0].rewardMean01, 1, 'p2750 over-1 reward mean -> 1');
  assert.equal(st.planningDepth, 8, 'p2750 over-max planning depth -> 8');
  assert.equal(st.predictionHorizon, 1, 'p2750 negative horizon -> 1');
  assert.equal(st.lastActionIndex, 6, 'p2750 over-max action index clamped');
  assert.equal(typeof st.lastReason, 'string', 'p2750 non-string reason -> default');
  assert.doesNotThrow(() => m.restore(hostile('fast')));
  m.restore(defaultP2750UnifiedCausalWorldLoop());
  assert.deepEqual(m.snapshot(), defaultP2750UnifiedCausalWorldLoop(), 'p2750 default round-trips');
}

console.log('WORKPASS72_P42_P43_P48_P41_P66_P64_P2750_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['P42UnifiedEmbodiedExperience', 'P43EmbodiedImageryWorkspace', 'P48FunctionalAwarenessCore', 'P41NativePerception', 'P66InteroceptiveHomeostasis', 'P64IntegratedOrganismDynamics', 'P2750UnifiedCausalWorldLoop'] }));
