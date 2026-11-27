import assert from 'node:assert/strict';
import { MetacognitiveNeuralSubstrate } from '../src/organism/cognition/MetacognitiveNeuralSubstrate.ts';

const substrate = new MetacognitiveNeuralSubstrate();
const prior = substrate.snapshot();
prior.stepCount = 1;
prior.learningSteps = 0;
prior.lastInput = new Array(27).fill(0);
prior.lastInput.splice(0, 6, 1, 1, 1, 1, 1, 1);
prior.lastInput[26] = 0.9;
prior.lastOutput = [1, 0, 1, 0, 1, 0];
prior.lastTarget = [0, 1, 0, 1, 0, 1];
prior.introspectivePredictionError01 = 0.5;
prior.calibrationError01 = 0.5;
substrate.restore(prior);

substrate.observe({
  centralLatent: new Array(12).fill(0),
  workspace: new Array(6).fill(0),
  selfLatent: new Array(4).fill(0),
  predictionError01: 0.1,
  confidence01: 0.4,
  worldUncertainty01: 0.2,
  identityDrift01: 0.1,
  actionOutcome01: 0.2,
  tick: 2,
  at: 2000,
});

const state = substrate.snapshot();
assert.ok(Math.abs(state.introspectivePredictionError01 - 0.52) < 1e-12,
  `introspection must compare the prior prediction with its paired target; got ${state.introspectivePredictionError01}`);
assert.ok(Math.abs(state.calibrationError01 - 0.512) < 1e-12,
  `calibration must compare the prior confidence prediction with the outcome receipt arriving at this observation; got ${state.calibrationError01}`);
console.log(JSON.stringify({
  pass: 'metacognitive-observation-alignment',
  introspectivePredictionError01: state.introspectivePredictionError01,
  calibrationError01: state.calibrationError01,
}));
