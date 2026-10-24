import assert from 'node:assert/strict';
import { deriveInnerImperative } from '../src/organism/cognition/InnerImperativeController.ts';

const omittedState = deriveInnerImperative({
  tick: 1,
  hasExternalRequest: false,
  spontaneous: false,
  proposedAction: 'reflect',
  predictionError01: 0.1,
});
assert.equal(omittedState.selectedAction, 'reflect');
assert.equal(omittedState.resourceState.awake, false);
assert.equal(omittedState.resourceState.energy01, 0.5, 'missing runtime fields use the established conservative default');
assert.equal(omittedState.resourceState.bodyEnergy01, 0.5);
assert.equal(omittedState.resourceState.cognitiveCapacity01, 0.5);
assert.equal(omittedState.resourceState.thermalStrain01, 0.5);

const partialState = deriveInnerImperative({
  tick: 2,
  hasExternalRequest: false,
  spontaneous: true,
  proposedAction: 'explore',
  needs: { energy01: 0.8, novelty01: 0.9 },
  embodiment: { awake: true, bodyEnergy01: 0.75 },
  predictionError01: 0.1,
});
assert.equal(partialState.selectedAction, 'explore');
assert.equal(partialState.resourceState.energy01, 0.8);
assert.equal(partialState.resourceState.bodyEnergy01, 0.75);
assert.equal(partialState.resourceState.cognitiveLoad01, 0.5);
assert.equal(partialState.resourceState.cognitiveCapacity01, 0.5);
console.log('WORKPASS338_INNER_IMPERATIVE_INPUT_NORMALIZATION=PASS safeDefaults=true partialState=true');
