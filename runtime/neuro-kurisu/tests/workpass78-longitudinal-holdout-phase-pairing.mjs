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
add('holdout','replay-off','holdout-a',day,.92,7);
add('holdout','replay-off','holdout-b',2*day,.91,8);
summary=fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(summary.holdoutMatchedPairs,2);
assert.equal(summary.matchedPairs,4);
assert.equal(summary.evidenceGrade,'confirmatory-eligible');
assert.ok(Math.abs(summary.holdoutConditionDifference01-(-.095))<1e-9,'confirmatory uplift metric must be computed only from paired holdout trials');
assert.ok(summary.conditionDifference01>0,'all-phase exploratory aggregate remains separately available');
assert.ok(Math.abs(summary.holdoutMeanRetentionOn01-.82)<1e-9);
assert.ok(Math.abs(summary.holdoutMeanRetentionOff01-.915)<1e-9);

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
assert.equal(ambiguousSummary.holdoutDistinctDelays,1,'duplicate arm cannot inflate holdout delay coverage');
assert.ok(Math.abs(ambiguousSummary.holdoutMeanRetentionOn01-.83)<1e-9,'ambiguous replay-on arm is excluded from holdout mean');
assert.ok(Math.abs(ambiguousSummary.holdoutMeanRetentionOff01-.91)<1e-9,'only the clean holdout-off arm contributes');
assert.ok(Math.abs(ambiguousSummary.holdoutConditionDifference01-(-.08))<1e-9,'only the remaining clean holdout pair contributes');
assert.equal(ambiguousSummary.evidenceGrade,'exploratory-matched');

// Unpaired holdout rows must not manufacture a second confirmatory delay.
const delayCoverage=new ExperienceContinuumFabric();
delayCoverage.createReplayExperimentProtocol({id:'holdout-delay-coverage',taskId:'memory-recall-ru-en',randomized:true,balanced:true,requiredPairs:2,contextKeys:['pair-a','pair-b','pair-c']});
const addDelay=(mode,pairKey,delayMs,score01,at)=>delayCoverage.recordLongitudinalReplayTrial({experimentId:'holdout-delay-coverage',taskId:'memory-recall-ru-en',phase:'holdout',mode,contextKey:pairKey,pairKey,delayMs,baselineScore01:.5,score01,independentVerified:true,at});
addDelay('replay-on','pair-a',day,.8,1);
addDelay('replay-off','pair-a',day,.7,2);
addDelay('replay-on','pair-b',day,.82,3);
addDelay('replay-off','pair-b',day,.72,4);
addDelay('replay-on','pair-c',2*day,.99,5);
const delayCoverageSummary=delayCoverage.longitudinalReplaySummary('holdout-delay-coverage','memory-recall-ru-en');
assert.equal(delayCoverageSummary.holdoutMatchedPairs,2);
assert.equal(delayCoverageSummary.holdoutDistinctDelays,1,'only matched clean holdout pairs establish delay coverage');
assert.equal(delayCoverageSummary.evidenceGrade,'exploratory-matched','an unpaired arm at another delay cannot make the experiment confirmatory');
console.log(JSON.stringify({ok:true,status:'LONGITUDINAL_HOLDOUT_PHASE_PAIRING_PASS',summary},null,2));
