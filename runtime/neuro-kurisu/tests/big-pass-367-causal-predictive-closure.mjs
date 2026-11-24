import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const ACTIONS = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const vector = (seed, context = 0) => Array.from({ length: 64 }, (_, i) => {
  const base = (((seed + 3) * (i + 5) + (context + 7) * 19) % 37) / 18 - 1;
  return Math.max(-1, Math.min(1, base));
});
const context = (preferred, utility = 0.9) => Object.fromEntries(ACTIONS.map((action) => [action, {
  worldUtility01: action === preferred ? utility : 0.25,
  worldConfidence01: action === preferred ? 0.86 : 0.32,
  worldUncertainty01: action === preferred ? 0.14 : 0.68,
  needRelief01: action === preferred ? 0.82 : 0.35,
  predictedCost01: action === preferred ? 0.18 : 0.56,
}]));
const actionL1 = (a, b) => ACTIONS.reduce((sum, action) => sum + Math.abs(a.actionProbabilities[action] - b.actionProbabilities[action]), 0);

const rows = [];
for (let seed = 1; seed <= 6; seed += 1) {
  const net = new B365UnifiedNeuroCausalCore();
  for (let tick = 1; tick <= 360; tick += 1) {
    const preferred = ACTIONS[(seed + tick * 3) % ACTIONS.length];
    const world = context(preferred, tick % 5 === 0 ? 0.96 : 0.86);
    const frame = net.step({
      tick,
      vector: vector(seed, tick % 9),
      novelty01: tick % 7 === 0 ? 0.78 : 0.24,
      uncertainty01: tick % 11 === 0 ? 0.72 : 0.24,
      predictionError01: tick % 5 === 0 ? 0.35 : 0.08,
      goalPressure01: 0.22 + (tick % 4) * 0.12,
      autonomy01: 0.62,
      actionContext: world,
      learningEnabled: true,
    });
    const reward = preferred === frame.selectedAction ? 0.92 : 0.28;
    net.learnFromOutcome({
      tick,
      action: preferred,
      reward01: reward,
      predictionError01: Math.abs(0.5 - reward),
      verified01: tick % 6 === 0 ? 1 : 0,
      externalEvidence01: tick % 9 === 0 ? 1 : 0,
      novelty01: tick % 7 === 0 ? 0.78 : 0.24,
      predictedReward01: frame.rewardPrediction01,
      predictedUtility01: frame.forecastUtilities[preferred],
      actualUtility01: reward,
      actualStateDelta01: reward > 0.5 ? 0.72 : 0.31,
      actualWorldConfidence01: 0.84,
    });
  }

  const trained = net.snapshot();
  const trainedProbe = net.step({
    tick: 361,
    vector: vector(seed, 4),
    novelty01: 0.18,
    uncertainty01: 0.20,
    predictionError01: 0.06,
    goalPressure01: 0.28,
    autonomy01: 0.70,
    actionContext: context('verify', 0.94),
    learningEnabled: false,
  });

  const externalSham = new B365UnifiedNeuroCausalCore();
  externalSham.restore(trained);
  const flatContext = Object.fromEntries(ACTIONS.map((action) => [action, {
    worldUtility01: 0.5,
    worldConfidence01: 0.2,
    worldUncertainty01: 0.8,
    needRelief01: 0.5,
    predictedCost01: 0.5,
  }]));
  const shamProbe = externalSham.step({
    tick: 361,
    vector: vector(seed, 4),
    novelty01: 0.18,
    uncertainty01: 0.20,
    predictionError01: 0.06,
    goalPressure01: 0.28,
    autonomy01: 0.70,
    actionContext: flatContext,
    learningEnabled: false,
  });
  const externalL1 = actionL1(trainedProbe, shamProbe);
  assert.ok(externalL1 > 0.006, `seed ${seed}: external predictive field did not causally change policy ${externalL1}`);

  const forecast = net.forecast('verify');
  assert.ok(forecast && forecast.samples > 20, `seed ${seed}: insufficient learned forecast samples`);
  assert.ok(forecast.confidence01 > 0.3, `seed ${seed}: forecast confidence too low ${forecast?.confidence01}`);
  assert.ok(forecast.errorMean01 < 0.55, `seed ${seed}: forecast error failed to consolidate ${forecast?.errorMean01}`);

  const fresh = new B365UnifiedNeuroCausalCore();
  const freshProbe = fresh.step({
    tick: 1,
    vector: vector(seed, 4),
    novelty01: 0.18,
    uncertainty01: 0.20,
    predictionError01: 0.06,
    goalPressure01: 0.28,
    autonomy01: 0.70,
    actionContext: flatContext,
    learningEnabled: false,
  });
  const learnedTransferL1 = actionL1(shamProbe, freshProbe);
  assert.ok(learnedTransferL1 > 0.003, `seed ${seed}: learned neural forecast did not transfer ${learnedTransferL1}`);

  const lesioned = new B365UnifiedNeuroCausalCore();
  const lesionState = structuredClone(trained);
  lesionState.forecastReadout = lesionState.forecastReadout.map((row) => row.map(() => 0));
  lesionState.forecastBias = lesionState.forecastBias.map(() => 0);
  for (const action of ACTIONS) {
    lesionState.actionForecasts[action].utility01 = 0.5;
    lesionState.actionForecasts[action].reward01 = 0.5;
    lesionState.actionForecasts[action].confidence01 = 0.05;
  }
  lesioned.restore(lesionState);
  const lesionProbe = lesioned.step({
    tick: 361,
    vector: vector(seed, 4),
    novelty01: 0.18,
    uncertainty01: 0.20,
    predictionError01: 0.06,
    goalPressure01: 0.28,
    autonomy01: 0.70,
    actionContext: context('verify', 0.94),
    learningEnabled: false,
  });
  const lesionL1 = actionL1(trainedProbe, lesionProbe);
  assert.ok(lesionL1 > 0.003, `seed ${seed}: forecast subsystem lesion too weak ${lesionL1}`);

  const restarted = new B365UnifiedNeuroCausalCore();
  restarted.restore(trained);
  const restartProbe = restarted.step({
    tick: 362,
    vector: vector(seed, 5),
    novelty01: 0.19,
    uncertainty01: 0.22,
    predictionError01: 0.07,
    goalPressure01: 0.31,
    autonomy01: 0.70,
    actionContext: context('explore', 0.91),
    learningEnabled: false,
  });
  const control = new B365UnifiedNeuroCausalCore();
  control.restore(trained);
  const controlProbe = control.step({
    tick: 362,
    vector: vector(seed, 5),
    novelty01: 0.19,
    uncertainty01: 0.22,
    predictionError01: 0.07,
    goalPressure01: 0.31,
    autonomy01: 0.70,
    actionContext: context('explore', 0.91),
    learningEnabled: false,
  });
  const restartL1 = actionL1(restartProbe, controlProbe);
  assert.ok(restartL1 < 1e-10, `seed ${seed}: restart drift ${restartL1}`);

  rows.push({
    seed,
    externalL1: Number(externalL1.toFixed(6)),
    learnedTransferL1: Number(learnedTransferL1.toFixed(6)),
    lesionL1: Number(lesionL1.toFixed(6)),
    restartL1: Number(restartL1.toFixed(12)),
    forecastSamples: forecast.samples,
    forecastConfidence: Number(forecast.confidence01.toFixed(6)),
    forecastError: Number(forecast.errorMean01.toFixed(6)),
    entropy: Number(net.diagnostics().actionEntropy01.toFixed(6)),
    modelAgreement: Number(net.diagnostics().modelAgreement01.toFixed(6)),
  });
}

console.log(JSON.stringify({
  pass: true,
  status: 'B367_CAUSAL_PREDICTIVE_CLOSURE_PASS',
  seeds: rows.length,
  minExternalL1: Math.min(...rows.map((row) => row.externalL1)),
  minTransferL1: Math.min(...rows.map((row) => row.learnedTransferL1)),
  minLesionL1: Math.min(...rows.map((row) => row.lesionL1)),
  rows,
}, null, 2));
