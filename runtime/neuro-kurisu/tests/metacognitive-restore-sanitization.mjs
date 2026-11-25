import assert from 'node:assert/strict';
import { MetacognitiveNeuralSubstrate } from '../src/organism/cognition/MetacognitiveNeuralSubstrate.ts';

const substrate = new MetacognitiveNeuralSubstrate();
const corrupted = substrate.snapshot();
corrupted.hidden[0] = Number.NaN;
corrupted.inputWeights[0][0] = Number.NaN;
corrupted.inputWeights[0][1] = Number.POSITIVE_INFINITY;
corrupted.inputWeights[0][2] = 2;
corrupted.recurrentWeights[0][0] = -2;
corrupted.outputWeights[0][0] = Number.NEGATIVE_INFINITY;
corrupted.outputBias[0] = Number.NaN;
corrupted.lastInput[0] = Number.POSITIVE_INFINITY;
corrupted.lastOutput[0] = 2;
corrupted.lastTarget[0] = -1;
corrupted.stepCount = -5;
corrupted.learningSteps = Number.POSITIVE_INFINITY;
corrupted.calibrationError01 = 2;
corrupted.selfUncertainty01 = Number.NaN;
corrupted.introspectivePredictionError01 = -1;
corrupted.revisionReadiness01 = Number.POSITIVE_INFINITY;
corrupted.lastTick = -2;
corrupted.lastAt = Number.POSITIVE_INFINITY;

substrate.restore(corrupted);
const restored = substrate.snapshot();

assert.equal(restored.hidden[0], 0, 'non-finite hidden activation must recover to zero');
assert.equal(restored.inputWeights[0][0], 0, 'NaN input weight must recover to zero');
assert.equal(restored.inputWeights[0][1], 0, 'infinite input weight must recover to zero');
assert.equal(restored.inputWeights[0][2], 1, 'input weights must remain bounded to [-1, 1]');
assert.equal(restored.recurrentWeights[0][0], -1, 'recurrent weights must remain bounded to [-1, 1]');
assert.equal(restored.outputWeights[0][0], 0, 'non-finite output weight must recover to zero');
assert.equal(restored.outputBias[0], 0.5, 'non-finite output bias must recover to its neutral default');
assert.equal(restored.lastInput[0], 0, 'non-finite previous input must recover to zero');
assert.equal(restored.lastOutput[0], 1, 'neural outputs must remain bounded to [0, 1]');
assert.equal(restored.lastTarget[0], 0, 'paired targets must remain bounded to [0, 1]');
assert.equal(restored.stepCount, 0, 'negative step counters must reset to zero');
assert.equal(restored.learningSteps, 0, 'non-finite learning counters must reset to zero');
assert.equal(restored.calibrationError01, 1, 'calibration error must remain bounded to [0, 1]');
assert.equal(restored.selfUncertainty01, 0.5, 'non-finite self uncertainty must recover to its neutral default');
assert.equal(restored.introspectivePredictionError01, 0, 'introspective error must remain bounded to [0, 1]');
assert.equal(restored.revisionReadiness01, 0.5, 'non-finite readiness must recover to its neutral default');
assert.equal(restored.lastTick, 0, 'negative tick must reset to zero');
assert.equal(restored.lastAt, 0, 'non-finite timestamp must reset to zero');

const matrices = [restored.inputWeights, restored.recurrentWeights, restored.outputWeights];
for (const matrix of matrices) {
  for (const row of matrix) {
    for (const weight of row) {
      assert.ok(Number.isFinite(weight) && weight >= -1 && weight <= 1,
        'every restored synaptic weight must be finite and bounded');
    }
  }
}
console.log(JSON.stringify({ pass: 'metacognitive-restore-sanitization', inputDim: restored.inputDim }));
