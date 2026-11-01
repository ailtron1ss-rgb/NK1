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
add('acquisition','replay-on','train-a',day,.99,1);
add('acquisition','replay-off','train-a',day,.01,2);
add('acquisition','replay-on','train-b',2*day,.98,3);
add('acquisition','replay-off','train-b',2*day,.02,4);
add('holdout','replay-on','holdout-a',day,.81,5);
add('holdout','replay-on','holdout-b',2*day,.83,6);
let summary=fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(summary.matchedPairs,2,'only acquisition pairs are matched');
assert.equal(summary.holdoutMatchedPairs,0,'holdout arms must not borrow acquisition controls');
assert.equal(summary.holdoutDistinctDelays,0,'unpaired holdout arms cannot establish confirmatory delay coverage');
assert.equal(summary.conditionDifference01,null,'unpaired holdout has no confirmatory effect estimate');
assert.equal(summary.evidenceGrade,'exploratory-matched','unpaired holdout cannot confirm uplift');

// Two independent paired holdout contexts are required for confirmatory eligibility.
add('holdout','replay-off','holdout-a',day,.72,7);
add('holdout','replay-off','holdout-b',2*day,.71,8);
summary=fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(summary.holdoutMatchedPairs,2);
assert.equal(summary.holdoutPairedComparable,true);
assert.equal(summary.holdoutDistinctDelays,2);
assert.equal(summary.matchedPairs,4);
assert.equal(summary.evidenceGrade,'confirmatory-eligible');
assert.ok(Math.abs(summary.conditionDifference01-0.105)<1e-12,'confirmatory effect must use only holdout pairs');
assert.ok(Math.abs(summary.allPhaseConditionDifference01-0.5375)<1e-12,'all-phase effect remains descriptive only');
assert.ok(Math.abs(summary.holdoutMeanRetentionOn01-0.82)<1e-12);
assert.ok(Math.abs(summary.holdoutMeanRetentionOff01-0.715)<1e-12);
assert.notEqual(summary.conditionDifference01,summary.allPhaseConditionDifference01,'acquisition outcomes must not contaminate the holdout estimate');

const cleanSnapshot=fabric.snapshot();
const restored=new ExperienceContinuumFabric();
restored.restore(cleanSnapshot);
summary=restored.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.deepEqual(summary,fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en'));

// Corrupt/legacy restore data with duplicate arms must be treated as ambiguous,
// rather than allowing the last row to overwrite the earlier evidence.
const ambiguousSnapshot=structuredClone(cleanSnapshot);
const duplicate={...ambiguousSnapshot.replay.longitudinal.find(row=>row.phase==='holdout'&&row.mode==='replay-on'&&row.pairKey==='holdout-a'),id:'duplicate-holdout-arm',at:9,score01:.99};
ambiguousSnapshot.replay.longitudinal.push(duplicate);
const ambiguous=new ExperienceContinuumFabric();
ambiguous.restore(ambiguousSnapshot);
const ambiguousSummary=ambiguous.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(ambiguousSummary.holdoutMatchedPairs,1,'duplicate arm invalidates that pair');
assert.equal(ambiguousSummary.holdoutDistinctDelays,1,'duplicate arm cannot inflate confirmatory delay coverage');
assert.ok(Math.abs(ambiguousSummary.conditionDifference01-0.12)<1e-12,'only the remaining clean holdout pair contributes');
assert.equal(ambiguousSummary.evidenceGrade,'exploratory-matched');
console.log(JSON.stringify({ok:true,status:'LONGITUDINAL_HOLDOUT_PHASE_PAIRING_PASS',summary},null,2));
