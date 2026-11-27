import assert from 'node:assert/strict';
import { MetacognitiveNeuralSubstrate } from '../src/organism/cognition/MetacognitiveNeuralSubstrate.ts';

const observation = {
  centralLatent: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, -0.1, -0.2],
  workspace: [0.11, 0.22, 0.33, 0.44, 0.55, 0.66],
  selfLatent: [0.71, 0.72, 0.73, 0.74],
  predictionError01: 0.13,
  confidence01: 0.84,
  worldUncertainty01: 0.25,
  identityDrift01: 0.36,
  actionOutcome01: 0.97,
  tick: 3,
  at: 3000,
};

const substrate = new MetacognitiveNeuralSubstrate();
substrate.observe(observation);
const state = substrate.snapshot();
assert.equal(state.inputDim, 27, 'all 27 declared neural features must have a dedicated input slot');
assert.equal(state.lastInput.length, 27);
assert.deepEqual(state.lastInput.slice(22), [0.13, 0.84, 0.25, 0.36, 0.97]);

const legacy = new MetacognitiveNeuralSubstrate().snapshot();
legacy.version = 1;
legacy.inputDim = 24;
legacy.inputWeights = legacy.inputWeights.map(row => row.slice(0, 24));
legacy.lastInput = legacy.lastInput.slice(0, 24);
legacy.lastInput[0] = 0.42;
const restored = new MetacognitiveNeuralSubstrate();
restored.restore(legacy);
const migrated = restored.snapshot();
assert.equal(migrated.version, 2, 'legacy v1 state must migrate to the expanded v2 input contract');
assert.equal(migrated.inputDim, 27);
assert.equal(migrated.lastInput.length, 27);
assert.equal(migrated.lastInput[0], 0.42);
assert.equal(migrated.lastInput[24], 0);
assert.equal(migrated.inputWeights[0].length, 27);
assert.equal(migrated.inputWeights[0][0], legacy.inputWeights[0][0],
  'legacy learned input weights must remain unchanged across the dimension migration');
assert.equal(migrated.inputWeights[0][24], 0,
  'newly introduced input weights must start at zero rather than randomizing old checkpoints');
assert.equal(migrated.inputWeights[0][26], 0);
assert.deepEqual(migrated.lastTarget, new Array(6).fill(0.5),
  'legacy checkpoints without paired targets must receive the neutral target baseline');
console.log(JSON.stringify({ pass: 'metacognitive-input-dimension', inputDim: state.inputDim, migratedVersion: migrated.version }));
