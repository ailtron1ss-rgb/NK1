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


// Reverse completion order for two outstanding same-action decisions must
// resolve each ensemble ticket by the caller's exact canonical decision ID.
const concurrent = new WorldSubsystemRuntime();
const firstDecision = concurrent.predictForDecision('explore', 0.05, 0.4);
const secondDecision = concurrent.predictForDecision('explore', 0.95, 0.4);
assert.notEqual(firstDecision.predictionId, secondDecision.predictionId);
const concurrentController = concurrent.worldModelEnsemble;
const ticketRows = Object.values(concurrentController.snapshot().pendingPredictions)
  .filter(ticket => ticket.action === 'explore')
  .sort((a,b) => Number(a.predictionId.split('-').at(-1)) - Number(b.predictionId.split('-').at(-1)));
assert.equal(ticketRows.length,2);
const [firstTicket,secondTicket] = ticketRows;

const concurrentBefore = {
  tick:20, location:'ticket-lab', energy:.82, attention:.75, uncertainty:.4,
  facts:[], objects:[], events:[],
};
const concurrentMiddle = {...concurrentBefore,tick:21,energy:.78};
const concurrentAfter = {...concurrentBefore,tick:22,energy:.74};
const secondResolvedFirst = concurrent.observeActionOutcome({
  action:'explore',before:concurrentBefore,after:concurrentMiddle,
  reward:.91,surprise:.05,at:Date.now(),
},undefined,secondDecision.predictionId);
assert.equal(secondResolvedFirst.predictionBefore.predictionId,secondTicket.predictionId,
  'second action outcome must resolve the second ensemble prediction ticket');
let pending = concurrentController.snapshot().pendingPredictions;
assert.ok(pending[firstTicket.predictionId],
  'uncompleted first prediction must remain pending');
assert.equal(pending[secondTicket.predictionId],undefined,
  'the resolved second prediction must be removed');

const firstResolvedSecond = concurrent.observeActionOutcome({
  action:'explore',before:concurrentMiddle,after:concurrentAfter,
  reward:.09,surprise:.05,at:Date.now(),
},undefined,firstDecision.predictionId);
assert.equal(firstResolvedSecond.predictionBefore.predictionId,firstTicket.predictionId,
  'first action outcome must resolve its own remaining ensemble prediction ticket');
pending = concurrentController.snapshot().pendingPredictions;
assert.equal(Object.values(pending).filter(ticket => ticket.action === 'explore').length,0,
  'both same-action tickets must be closed independently');

console.log(JSON.stringify({
  test:'P2698 exact world prediction closure',
  predictionId:prediction.predictionId,
  resolvedId:resolved.predictionBefore.predictionId,
  exactResolution:resolved.predictionBefore.usedStoredPrediction,
  learnedTransitions:runtime.worldModel2.snapshot().learnedTransitions,
  secondPredictionId:p2.predictionId,
  status:'PASS'
}, null, 2));
