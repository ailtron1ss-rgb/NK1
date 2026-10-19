import assert from 'node:assert/strict';
import { WorldSubsystemRuntime } from '../src/organism/core/WorldSubsystemRuntime.ts';

const runtime = new WorldSubsystemRuntime();
const prediction = runtime.predictForDecision('explore', 0.62, 0.48);
assert.ok(prediction.predictionId, 'decision-time prediction must create an exact ticket');
assert.equal(typeof prediction.utility, 'number');

const before = {
  tick: 10, location: 'home', energy: 0.82, attention: 0.78, uncertainty: 0.48,
  facts: ['baseline'], objects: [{id:'door',label:'door',visible:true,collected:false}], events: []
};
const after = {
  tick: 11, location: 'home', energy: 0.76, attention: 0.70, uncertainty: 0.42,
  facts: ['baseline','explored'], objects: [{id:'door',label:'door',visible:true,collected:false},{id:'room',label:'room',visible:true,collected:false}], events: ['explore']
};

const resolved = runtime.observeActionOutcome({
  action: 'explore', before, after, reward: 0.88, surprise: 0.12, at: Date.now()
}, undefined, prediction.predictionId);

assert.equal(resolved.predictionBefore.usedStoredPrediction, true, 'outcome must resolve the pre-action ticket');
assert.equal(resolved.predictionBefore.worldModel2.predictionId, prediction.predictionId, 'WorldModel2 must resolve the exact selected prediction');
assert.equal(resolved.predictionBefore.worldModel2.resolved, true);
assert.ok(resolved.candidates.length >= 1);
assert.ok(runtime.worldModel2.snapshot().learnedTransitions >= 1);

// A second prediction for the same action must remain distinct.
const p2 = runtime.predictForDecision('explore', 0.40, 0.42);
assert.notEqual(p2.predictionId, prediction.predictionId);

console.log(JSON.stringify({
  test:'P2698 exact world prediction closure',
  predictionId:prediction.predictionId,
  resolvedId:resolved.predictionBefore.predictionId,
  exactResolution:resolved.predictionBefore.usedStoredPrediction,
  learnedTransitions:runtime.worldModel2.snapshot().learnedTransitions,
  secondPredictionId:p2.predictionId,
  status:'PASS'
}, null, 2));
