import assert from 'node:assert/strict';
import { MetacognitiveNeuralSubstrate } from '../src/organism/cognition/MetacognitiveNeuralSubstrate.ts';

const zeroMatrix = (rows, columns) => Array.from({ length: rows }, () => new Array(columns).fill(0));

const substrate = new MetacognitiveNeuralSubstrate();
const initial = substrate.snapshot();
initial.inputWeights = zeroMatrix(32, initial.inputDim);
initial.recurrentWeights = zeroMatrix(32, 32);
initial.outputWeights = zeroMatrix(6, 32);
initial.outputWeights[0][0] = 1;
initial.outputBias = new Array(6).fill(0);
initial.hidden = new Array(32).fill(0);
initial.lastInput = new Array(initial.inputDim).fill(0);
initial.lastOutput = new Array(6).fill(0.5);
initial.stepCount = 0;
initial.learningSteps = 0;
substrate.restore(initial);

const sample = (tick, firstFeature) => ({
  centralLatent: [firstFeature, ...new Array(11).fill(0)],
  workspace: new Array(6).fill(0),
  selfLatent: new Array(4).fill(0),
  predictionError01: 0.1,
  confidence01: 0.9,
  worldUncertainty01: 0.2,
  identityDrift01: 0.1,
  actionOutcome01: 0.8,
  tick,
  at: 1000 + tick,
});

substrate.observe(sample(1, 0));
const before = substrate.snapshot().inputWeights[0][0];
substrate.observe(sample(2, 1));
const after = substrate.snapshot().inputWeights[0][0];

assert.ok(
  after > before,
  `current sample feature must update its own input weight (before=${before}, after=${after})`,
);
console.log(JSON.stringify({ pass: 'metacognitive-gradient-alignment', before, after }));
