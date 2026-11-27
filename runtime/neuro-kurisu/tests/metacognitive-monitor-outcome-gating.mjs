import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { MetaCognitiveMonitor, defaultMetaCognitiveState } from '../src/organism/cognition/MetaCognitiveMonitor.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const input = {
  confidence: 0.9,
  predictionError: 0.1,
  worldUncertainty: 0.2,
  identityDrift: 0.05,
};

const monitor = new MetaCognitiveMonitor();
const initial = monitor.snapshot();
monitor.update(input);
const decisionOnly = monitor.snapshot();
assert.equal(decisionOnly.samples, 1);
assert.equal(decisionOnly.outcomeSamples, 0,
  'missing action outcome must not become a calibration sample');
assert.equal(decisionOnly.calibrationSamples, 0);
assert.equal(decisionOnly.predictionCalibration, initial.predictionCalibration,
  'decision-time uncertainty must not alter outcome calibration');
assert.equal(decisionOnly.metacognitiveAccuracy, initial.metacognitiveAccuracy);
assert.notEqual(decisionOnly.uncertaintyAboutDecision, initial.uncertaintyAboutDecision,
  'decision uncertainty still updates before the outcome exists');

monitor.update({ ...input, outcomeSuccess: 0.9, outcomeSource: 'verified-observed' });
const verified = monitor.snapshot();
assert.equal(verified.outcomeSamples, 1);
assert.equal(verified.calibrationSamples, 1);
assert.equal(verified.simulatedOutcomeSamples, 0);
assert.ok(Math.abs(verified.predictionCalibration - 0.59) < 1e-12);
assert.ok(Math.abs(verified.metacognitiveAccuracy - 0.58) < 1e-12);

monitor.update({ ...input, outcomeSuccess: 0.1, outcomeSource: 'simulated' });
const simulated = monitor.snapshot();
assert.equal(simulated.outcomeSamples, 2);
assert.equal(simulated.calibrationSamples, 1,
  'simulator output must not be promoted into external calibration');
assert.equal(simulated.simulatedOutcomeSamples, 1);
assert.equal(simulated.predictionCalibration, verified.predictionCalibration);

monitor.update({ ...input, outcomeSuccess: 0.2, outcomeSource: 'unverified' });
const unverified = monitor.snapshot();
assert.equal(unverified.outcomeSamples, 3);
assert.equal(unverified.unverifiedOutcomeSamples, 1);
assert.equal(unverified.calibrationSamples, 1);
assert.equal(unverified.predictionCalibration, verified.predictionCalibration);

monitor.update({ ...input, outcomeSuccess: 0.5, outcomeSource: 'unknown' });
const unknown = monitor.snapshot();
assert.equal(unknown.outcomeSamples, 3,
  'unknown provenance must not create an outcome sample even when a numeric placeholder is present');
assert.equal(unknown.calibrationSamples, 1);

// Previously persisted v1 states have none of the new provenance counters.
const legacy = { ...defaultMetaCognitiveState() };
delete legacy.outcomeSamples;
delete legacy.calibrationSamples;
delete legacy.simulatedOutcomeSamples;
delete legacy.unverifiedOutcomeSamples;
const restored = new MetaCognitiveMonitor();
restored.restore(legacy);
assert.equal(restored.snapshot().outcomeSamples, 0);
assert.equal(restored.snapshot().calibrationSamples, 0);
assert.equal(restored.snapshot().simulatedOutcomeSamples, 0);
assert.equal(restored.snapshot().unverifiedOutcomeSamples, 0);

// Exercise the actual OrganismCore feedback owner: the absence of success and
// reward must remain unknown even though downstream systems keep a neutral fallback.
const directory = await mkdtemp(path.join(tmpdir(), 'nk1-metacognitive-outcome-'));
const runtime = new OrganismRuntime({
  stateFile: path.join(directory, 'state.json'),
  worldStateFile: path.join(directory, 'world.json'),
  enableLanguage: false,
  enableScientificMethod: true,
  stateStore: new MemoryStateStore(),
  worldStateStore: new MemoryStateStore(),
  journal: new BoundedOperationalJournal(),
  performanceProfile: 'mobile',
  cycleResultMode: 'summary',
});
try {
  await runtime.init();
  const beforeUnknown = runtime.core.snapshot().facets.consciousness.metacognition;
  const priorSuccess = runtime.core.snapshot().state.lastActionSuccess;
  const priorPredictionError = runtime.core.snapshot().state.predictionError;
  await runtime.core.feedback({});
  const afterUnknown = runtime.core.snapshot().facets.consciousness.metacognition;
  assert.equal(afterUnknown.outcomeSamples, beforeUnknown.outcomeSamples,
    'OrganismCore.feedback({}) must not manufacture an outcome sample');
  assert.equal(afterUnknown.calibrationSamples, beforeUnknown.calibrationSamples);
  assert.equal(afterUnknown.predictionCalibration, beforeUnknown.predictionCalibration);
  assert.equal(runtime.core.snapshot().state.lastActionSuccess, priorSuccess,
    'unknown feedback must preserve the last known action-success value');
  assert.equal(runtime.core.snapshot().state.predictionError, priorPredictionError,
    'empty feedback must not decay or rewrite prediction error without a new signal');

  await runtime.core.feedback({
    success: 0.9,
    reward: 0.75,
    learning: {
      source: 'simulation', evidence01: 0.05, verified01: 0, independent01: 0,
      consequence01: 0.1, learningScale01: 0.2, neuralUpdateScale01: 0.3,
      worldModelUpdateScale01: 0.24, memoryPromotionScale01: 0.12, identityUpdateScale01: 0.04,
    },
  });
  const afterSimulation = runtime.core.snapshot().facets.consciousness.metacognition;
  assert.equal(afterSimulation.simulatedOutcomeSamples, beforeUnknown.simulatedOutcomeSamples + 1);
  assert.equal(afterSimulation.calibrationSamples, beforeUnknown.calibrationSamples);
  assert.equal(afterSimulation.predictionCalibration, beforeUnknown.predictionCalibration);

  await runtime.core.feedback({
    success: 0.9,
    reward: 0.75,
    evidenceSource: 'device',
    learning: {
      source: 'external', evidence01: 0.95, verified01: 0.9, independent01: 0.9,
      consequence01: 0.9, learningScale01: 0.9, neuralUpdateScale01: 0.9,
      worldModelUpdateScale01: 0.9, memoryPromotionScale01: 0.9, identityUpdateScale01: 0.9,
    },
  });
  const afterVerified = runtime.core.snapshot().facets.consciousness.metacognition;
  assert.equal(afterVerified.calibrationSamples, beforeUnknown.calibrationSamples + 1,
    'only independently verified external results can change the calibration model');
} finally {
  await runtime.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true });
}


// The spine-only feedback owner must preserve unknown outcomes too. This is a
// separate runtime path from the full learning pipeline above.
{
  const core = new OrganismCore(new MemoryStateStore(), {
    spineOnly: true,
    enableLanguage: false,
    performanceProfile: 'mobile',
    cycleResultMode: 'operational',
  });
  await core.init();
  try {
    await core.observe({
      text: 'observe the current workspace before changing any state',
      novelty: 0.6,
      uncertainty: 0.45,
    }, 'operational');
    const before = core.snapshot();
    assert.ok(before.traces?.some(trace => trace.selected),
      'the fixture must exercise the selected-decision spine-only feedback path');
    await core.feedback({});
    const after = core.snapshot();
    assert.equal(after.state.lastActionSuccess, before.state.lastActionSuccess,
      'empty spine-only feedback must not invent a neutral action-success result');
    assert.equal(after.state.predictionError, before.state.predictionError,
      'empty spine-only feedback must not decay prediction error without a new outcome');
  } finally {
    await core.stop?.();
  }
}

console.log('metacognitive-monitor-outcome-gating: PASS');
