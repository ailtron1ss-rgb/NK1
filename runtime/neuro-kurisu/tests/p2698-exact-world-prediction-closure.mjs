import assert from 'node:assert/strict';
import { WorldSubsystemRuntime } from '../src/organism/core/WorldSubsystemRuntime.ts';

const runtime = new WorldSubsystemRuntime();
const prediction = runtime.predictForDecision('explore', 0.62, 0.48);
assert.ok(prediction.predictionId, 'decision-time prediction must create an exact ticket');
assert.equal(typeof prediction.utility, 'number');

const before = {
  tick: 10, location: 'home', energy: 0.82, attention: 0.78, uncertainty: 0.48,
  facts: ['baseline'], objects: [{id:'door',label:'door',location:'home',value:.4,visible:true,collected:false}], events: []
};
const after = {
  tick: 11, location: 'home', energy: 0.76, attention: 0.70, uncertainty: 0.42,
  facts: ['baseline','explored'], objects: [{id:'door',label:'door',location:'home',value:.4,visible:true,collected:false},{id:'room',label:'room',location:'home',value:.6,visible:true,collected:false}], events: ['explore']
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


// Reverse completion order for two same-action decisions must resolve each
// ensemble ticket by the canonical decision predictionId, not FIFO-by-action.
const concurrent = new WorldSubsystemRuntime();
const firstDecision = concurrent.predictForDecision('explore', 0.05, 0.4);
const secondDecision = concurrent.predictForDecision('explore', 0.95, 0.4);
assert.notEqual(firstDecision.predictionId, secondDecision.predictionId);
const frames = concurrent['canonicalPredictionFrames'];
const firstFrame = frames.get(firstDecision.predictionId);
const secondFrame = frames.get(secondDecision.predictionId);
assert.ok(firstFrame?.ensemble?.predictionId);
assert.ok(secondFrame?.ensemble?.predictionId);
const firstWorldPrediction = firstFrame.candidates.find(candidate => candidate.member === 'worldModel2');
const secondWorldPrediction = secondFrame.candidates.find(candidate => candidate.member === 'worldModel2');
assert.ok(firstWorldPrediction && secondWorldPrediction);
assert.ok(Math.abs(firstWorldPrediction.prediction01-secondWorldPrediction.prediction01) > .5,
  'test requires distinct same-action world predictions');

const concurrentBefore = {...before, tick:20};
const concurrentMiddle = {...before, tick:21, energy:.78};
const concurrentAfter = {...before, tick:22, energy:.72};
const secondResolvedFirst = concurrent.observeActionOutcome({
  action:'explore', before:concurrentBefore, after:concurrentMiddle,
  reward:secondWorldPrediction.prediction01, surprise:.02, at:Date.now(),
}, undefined, secondDecision.predictionId);
assert.equal(secondResolvedFirst.predictionBefore.predictionId,secondFrame.ensemble.predictionId,
  'second action outcome must resolve the second ensemble prediction ticket');
const pendingAfterSecond = concurrent.worldModelEnsemble.snapshot().pendingPredictions;
assert.ok(pendingAfterSecond[firstFrame.ensemble.predictionId],
  'uncompleted first prediction must remain pending');
assert.equal(pendingAfterSecond[secondFrame.ensemble.predictionId],undefined,
  'the resolved second prediction must be removed');

const firstResolvedSecond = concurrent.observeActionOutcome({
  action:'explore', before:concurrentMiddle, after:concurrentAfter,
  reward:firstWorldPrediction.prediction01, surprise:.02, at:Date.now(),
}, undefined, firstDecision.predictionId);
assert.equal(firstResolvedSecond.predictionBefore.predictionId,firstFrame.ensemble.predictionId,
  'first action outcome must resolve its own remaining ensemble prediction ticket');
assert.ok(Math.abs(concurrent.worldModelEnsemble.snapshot().members.worldModel2.lastError01) < 1e-9,
  'correct ticket resolution must leave zero residual error for exact predicted worldModel2 outcomes');

console.log(JSON.stringify({
  test:'P2698 exact world prediction closure',
  predictionId:prediction.predictionId,
  resolvedId:resolved.predictionBefore.predictionId,
  exactResolution:resolved.predictionBefore.usedStoredPrediction,
  learnedTransitions:runtime.worldModel2.snapshot().learnedTransitions,
  secondPredictionId:p2.predictionId,
  status:'PASS'
}, null, 2));
