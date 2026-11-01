import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';

const fabric=new ExperienceContinuumFabric();
fabric.createReplayExperimentProtocol({
  id:'holdout-phase-isolation',taskId:'memory-recall-ru-en',
  randomized:true,balanced:true,requiredPairs:2,
  contextKeys:['ru-holdout-a','ru-holdout-b','en-holdout-a','en-holdout-b']
});
const add=(phase,mode,pairKey,delayMs,score01,at)=>fabric.recordLongitudinalReplayTrial({
  experimentId:'holdout-phase-isolation',taskId:'memory-recall-ru-en',
  phase,mode,contextKey:pairKey,pairKey,delayMs,
  baselineScore01:.5,score01,independentVerified:true,at
});
const day=86400000;
// Acquisition pairs cannot be combined with unpaired holdout arms.
add('acquisition','replay-on','train-a',day,.8,1);
add('acquisition','replay-off','train-a',day,.7,2);
add('acquisition','replay-on','train-b',2*day,.82,3);
add('acquisition','replay-off','train-b',2*day,.69,4);
add('holdout','replay-on','holdout-a',day,.81,5);
add('holdout','replay-on','holdout-b',2*day,.83,6);
let summary=fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(summary.matchedPairs,2,'only acquisition pairs are matched');
assert.equal(summary.holdoutMatchedPairs,0,'holdout arms must not borrow acquisition controls');
assert.equal(summary.evidenceGrade,'exploratory-matched','unpaired holdout cannot confirm uplift');

// Two independent paired holdout contexts are required for confirmatory eligibility.
add('holdout','replay-off','holdout-a',day,.72,7);
add('holdout','replay-off','holdout-b',2*day,.71,8);
summary=fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(summary.holdoutMatchedPairs,2);
assert.equal(summary.matchedPairs,4);
assert.equal(summary.evidenceGrade,'confirmatory-eligible');

// Duplicate arms are ambiguous: they must not silently overwrite the prior trial.
add('holdout','replay-on','holdout-a',day,.99,9);
summary=fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(summary.holdoutMatchedPairs,1,'duplicate arm invalidates that pair');
assert.equal(summary.evidenceGrade,'exploratory-matched');

const restored=new ExperienceContinuumFabric();
restored.restore(fabric.snapshot());
assert.deepEqual(restored.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en'),summary);
console.log(JSON.stringify({ok:true,status:'LONGITUDINAL_HOLDOUT_PHASE_PAIRING_PASS',summary},null,2));
