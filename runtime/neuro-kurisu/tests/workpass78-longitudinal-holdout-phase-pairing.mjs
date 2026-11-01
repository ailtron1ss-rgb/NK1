import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';

const fabric=new ExperienceContinuumFabric();
const protocol=fabric.createReplayExperimentProtocol({
  id:'holdout-phase-isolation',taskId:'memory-recall-ru-en',
  randomized:true,balanced:true,requiredPairs:2,
  contextKeys:['ru-holdout-a','ru-holdout-b','ru-holdout-c','ru-holdout-d','ru-holdout-e']
});
assert.equal(protocol.requiredPairs,5,'confirmatory protocol floor cannot be lowered below five paired samples');

const add=(phase,mode,pairKey,delayMs,score01,at)=>fabric.recordLongitudinalReplayTrial({
  experimentId:'holdout-phase-isolation',taskId:'memory-recall-ru-en',
  phase,mode,contextKey:pairKey,pairKey,delayMs,
  baselineScore01:.5,score01,independentVerified:true,at
});
const day=86400000;

// Acquisition pairs may improve the exploratory aggregate, but cannot make
// a two-pair holdout confirmatory.
add('acquisition','replay-on','train-a',day,.8,1);
add('acquisition','replay-off','train-a',day,.5,2);
add('acquisition','replay-on','train-b',2*day,.82,3);
add('acquisition','replay-off','train-b',2*day,.49,4);
add('holdout','replay-on','holdout-a',day,.81,5);
add('holdout','replay-off','holdout-a',day,.92,6);
add('holdout','replay-on','holdout-b',2*day,.83,7);
add('holdout','replay-off','holdout-b',2*day,.91,8);
let summary=fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(summary.matchedPairs,4);
assert.equal(summary.holdoutMatchedPairs,2);
assert.equal(summary.evidenceGrade,'exploratory-matched','two matched holdout pairs are below the five-pair confirmatory floor');

// Three more independently verified pairs meet the minimum pair count.
// The measured holdout effect is deliberately negative: confirmatory eligibility
// is about evidence quality, not whether the result is favorable.
add('holdout','replay-on','holdout-c',day,.82,9);
add('holdout','replay-off','holdout-c',day,.90,10);
add('holdout','replay-on','holdout-d',2*day,.84,11);
add('holdout','replay-off','holdout-d',2*day,.89,12);
add('holdout','replay-on','holdout-e',day,.80,13);
add('holdout','replay-off','holdout-e',day,.93,14);
summary=fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(summary.holdoutMatchedPairs,5);
assert.equal(summary.matchedPairs,7);
assert.equal(summary.holdoutDistinctDelays,2);
assert.equal(summary.evidenceGrade,'confirmatory-eligible');
assert.ok(Math.abs(summary.holdoutConditionDifference01-(-.09))<1e-9);
assert.ok(summary.conditionDifference01>0,'acquisition uplift remains descriptive and must not mask negative holdout performance');
assert.ok(Math.abs(summary.holdoutMeanRetentionOn01-.82)<1e-9);
assert.ok(Math.abs(summary.holdoutMeanRetentionOff01-.91)<1e-9);

const cleanSnapshot=fabric.snapshot();
const restored=new ExperienceContinuumFabric();
restored.restore(cleanSnapshot);
summary=restored.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.deepEqual(summary,fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en'));

// Corrupt/legacy restore data with duplicate arms is ambiguous, not last-write-wins.
const ambiguousSnapshot=structuredClone(cleanSnapshot);
const duplicate={...ambiguousSnapshot.replay.longitudinal.find(row=>row.phase==='holdout'&&row.mode==='replay-on'&&row.pairKey==='holdout-a'),id:'duplicate-holdout-arm',at:15,score01:.99};
ambiguousSnapshot.replay.longitudinal.push(duplicate);
const ambiguous=new ExperienceContinuumFabric();
ambiguous.restore(ambiguousSnapshot);
const ambiguousSummary=ambiguous.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(ambiguousSummary.holdoutMatchedPairs,4,'duplicate arm invalidates only its pair');
assert.equal(ambiguousSummary.holdoutDistinctDelays,2);
assert.equal(ambiguousSummary.evidenceGrade,'exploratory-matched','four clean pairs cannot pass the five-pair floor');
assert.ok(Math.abs(ambiguousSummary.holdoutMeanRetentionOn01-.8225)<1e-9,'ambiguous replay-on arm is excluded from holdout mean');
assert.ok(Math.abs(ambiguousSummary.holdoutMeanRetentionOff01-.9075)<1e-9,'only clean holdout-off arms contribute');
assert.ok(Math.abs(ambiguousSummary.holdoutConditionDifference01-(-.085))<1e-9);

// Five pairs at one delay plus an unpaired second-delay arm must remain exploratory.
const delayCoverage=new ExperienceContinuumFabric();
const delayProtocol=delayCoverage.createReplayExperimentProtocol({id:'holdout-delay-coverage',taskId:'memory-recall-ru-en',randomized:true,balanced:true,requiredPairs:2,contextKeys:['pair-a','pair-b','pair-c','pair-d','pair-e']});
assert.equal(delayProtocol.requiredPairs,5);
const addDelay=(mode,pairKey,delayMs,score01,at)=>delayCoverage.recordLongitudinalReplayTrial({experimentId:'holdout-delay-coverage',taskId:'memory-recall-ru-en',phase:'holdout',mode,contextKey:pairKey,pairKey,delayMs,baselineScore01:.5,score01,independentVerified:true,at});
for(let i=0;i<5;i++){
  const key=`pair-${String.fromCharCode(97+i)}`;
  addDelay('replay-on',key,day,.8+i*.01,20+i*2);
  addDelay('replay-off',key,day,.7+i*.01,21+i*2);
}
addDelay('replay-on','unpaired-second-delay',2*day,.99,40);
const delayCoverageSummary=delayCoverage.longitudinalReplaySummary('holdout-delay-coverage','memory-recall-ru-en');
assert.equal(delayCoverageSummary.holdoutMatchedPairs,5);
assert.equal(delayCoverageSummary.holdoutDistinctDelays,1,'only matched clean holdout pairs establish delay coverage');
assert.equal(delayCoverageSummary.evidenceGrade,'exploratory-matched','an unpaired arm at another delay cannot make the experiment confirmatory');
console.log(JSON.stringify({ok:true,status:'LONGITUDINAL_HOLDOUT_PHASE_PAIRING_PASS',summary},null,2));
