import assert from 'node:assert/strict';
import test from 'node:test';
import { AuroraPredictiveKernel } from '../src/organism/world/AuroraPredictiveKernel.ts';

const cleanWorld = {
  revision: 8,
  evidenceClass: 'observed',
  evidenceConfidence01: 0.94,
  uncertainty01: 0.08,
  conflict01: 0.02,
  unresolved01: 0.03,
  modelDisagreement01: 0.04,
  predictionError01: 0.05,
};

const strongPrediction = {
  action: 'respond',
  utility01: 0.82,
  confidence01: 0.91,
  uncertainty01: 0.08,
};

function kernel() {
  return new AuroraPredictiveKernel();
}

test('selects an affordable observation when world uncertainty and disagreement are high', () => {
  const result = kernel().evaluate({
    prediction: strongPrediction,
    worldSignal: {
      ...cleanWorld,
      evidenceClass: 'mixed',
      evidenceConfidence01: 0.48,
      uncertainty01: 0.82,
      conflict01: 0.76,
      unresolved01: 0.61,
      modelDisagreement01: 0.72,
      predictionError01: 0.44,
    },
    budget: { attention01: 0.8, energy01: 0.8, privacyTolerance01: 0.2, maxObservationCost01: 0.6 },
    observations: [
      { id: 'camera-recheck', kind: 'observe', informationGain01: 0.92, cost01: 0.18, privacyRisk01: 0.08, latencyCost01: 0.12, interruptCost01: 0.04 },
    ],
  });

  assert.equal(result.directive, 'observe');
  assert.equal(result.selectedObservationId, 'camera-recheck');
  assert.ok(result.epistemicPressure01 > 0.7);
  assert.ok(result.riskPenalty01 <= 0.07);
});

test('asks only when the question is useful and within privacy and interruption budgets', () => {
  const result = kernel().evaluate({
    prediction: strongPrediction,
    worldSignal: { ...cleanWorld, uncertainty01: 0.74, evidenceConfidence01: 0.35 },
    budget: { attention01: 0.9, energy01: 0.7, privacyTolerance01: 0.12, maxObservationCost01: 0.5 },
    observations: [
      { id: 'user-clarification', kind: 'ask', informationGain01: 0.94, cost01: 0.22, privacyRisk01: 0.06, latencyCost01: 0.08, interruptCost01: 0.08 },
    ],
  });

  assert.equal(result.directive, 'ask');
  assert.equal(result.selectedObservationId, 'user-clarification');
});

test('fails closed when every sensing option exceeds cost or privacy limits', () => {
  const result = kernel().evaluate({
    prediction: strongPrediction,
    worldSignal: { ...cleanWorld, evidenceClass: 'unknown', evidenceConfidence01: 0, uncertainty01: 0.9 },
    budget: { attention01: 0.2, energy01: 0.2, privacyTolerance01: 0.05, maxObservationCost01: 0.1 },
    observations: [
      { id: 'expensive-camera', kind: 'observe', informationGain01: 1, cost01: 0.9, privacyRisk01: 0.7, latencyCost01: 0.2, interruptCost01: 0.1 },
    ],
  });

  assert.equal(result.directive, 'wait');
  assert.equal(result.selectedObservationId, null);
});

test('acts on well-grounded low-risk predictions and recommends a longer planning horizon', () => {
  const result = kernel().evaluate({ prediction: strongPrediction, worldSignal: cleanWorld });

  assert.equal(result.directive, 'act');
  assert.ok(result.effectiveConfidence01 > 0.8);
  assert.ok(result.recommendedHorizon >= 9);
  assert.ok(result.adjustedUtility01 <= strongPrediction.utility01);
});

test('adds a bounded verification bias when model disagreement is elevated', () => {
  const result = kernel().evaluate({
    prediction: { ...strongPrediction, action: 'verify' },
    worldSignal: { ...cleanWorld, modelDisagreement01: 0.9, predictionError01: 0.6 },
  });

  assert.ok(result.verificationBias01 > 0);
  assert.ok(result.verificationBias01 <= 0.05);
  assert.ok(result.attentionFocus.includes('prediction'));
});

test('restore clamps malformed counters and bounds the recent directive ledger', () => {
  const instance = kernel();
  instance.restore({ version: 1, decisions: -5, acted: 999999999999, observed: Number.NaN, recentDirectives: ['act', 'evil', 'wait', ...Array(60).fill('abstain')] });
  const state = instance.snapshot();

  assert.equal(state.decisions, 0);
  assert.equal(state.acted, 1000000);
  assert.equal(state.observed, 0);
  assert.ok(state.recentDirectives.length <= 32);
  assert.ok(!state.recentDirectives.includes('evil'));
});

test('invalid forecast values return an abstention without allowing NaN propagation', () => {
  const result = kernel().evaluate({
    prediction: { action: 'respond', utility01: Number.NaN, confidence01: 1.2, uncertainty01: -1 },
    worldSignal: cleanWorld,
  });

  assert.equal(result.directive, 'abstain');
  assert.ok(Number.isFinite(result.adjustedUtility01));
  assert.ok(Number.isFinite(result.effectiveConfidence01));
});