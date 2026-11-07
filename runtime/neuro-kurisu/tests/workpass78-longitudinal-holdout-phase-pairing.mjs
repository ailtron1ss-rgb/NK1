import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const verifier=new OutcomeVerificationService();
let receiptSequence=0;
async function verifyExact(input,label){
  return verifier.verify({
    toolId:'workpass78-independent-replay-verifier',
    input,
    result:{ok:true,observationId:label},
  },()=>({
    verified:true,
    basis:'external-postcondition',
    confidence01:1,
    externalObservation:true,
    observationId:label,
    expectedPostcondition:'independent replay measurement recorded',
    observedPostcondition:'independent replay measurement recorded',
  }));
}

const fabric=new ExperienceContinuumFabric();
const protocolInput={
  id:'holdout-phase-isolation',
  taskId:'memory-recall-ru-en',
  randomized:true,
  balanced:true,
  requiredPairs:2,
  contextKeys:['ru-holdout-a','ru-holdout-b','ru-holdout-c','ru-holdout-d','ru-holdout-e'],
};
const protocolVerification=await verifyExact({...protocolInput,requiredPairs:5},'workpass78-protocol');
const protocol=fabric.createReplayExperimentProtocol({
  ...protocolInput,
  verification:protocolVerification,
});
assert.equal(protocol.requiredPairs,5,'confirmatory protocol floor cannot be lowered below five paired samples');
assert.equal(protocol.randomized,true,'protocol randomization must be verifier-authenticated');
assert.equal(protocol.balanced,true,'protocol balance must be verifier-authenticated');

const add=async(phase,mode,pairKey,delayMs,score01,at)=>{
  const input={
    experimentId:'holdout-phase-isolation',
    taskId:'memory-recall-ru-en',
    phase,mode,contextKey:pairKey,pairKey,delayMs,
    baselineScore01:.5,score01,
  };
  const verification=await verifyExact(input,`workpass78-trial-${++receiptSequence}`);
  return fabric.recordLongitudinalReplayTrial({
    ...input,
    independentVerified:true, // deprecated: this value is deliberately non-authoritative
    verification,
    at,
  });
};
const day=86400000;

// Acquisition pairs may improve the exploratory aggregate, but cannot make
// a two-pair holdout confirmatory.
await add('acquisition','replay-on','train-a',day,.8,1);
await add('acquisition','replay-off','train-a',day,.5,2);
await add('acquisition','replay-on','train-b',2*day,.82,3);
await add('acquisition','replay-off','train-b',2*day,.49,4);
await add('holdout','replay-on','holdout-a',day,.81,5);
await add('holdout','replay-off','holdout-a',day,.92,6);
await add('holdout','replay-on','holdout-b',2*day,.83,7);
await add('holdout','replay-off','holdout-b',2*day,.91,8);
let summary=fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(summary.matchedPairs,4);
assert.equal(summary.holdoutMatchedPairs,2);
assert.equal(summary.evidenceGrade,'exploratory-matched','two matched holdout pairs are below the five-pair confirmatory floor');

// Three more independently verified pairs meet the minimum pair count.
// The measured holdout effect is deliberately negative: confirmatory eligibility
// is about evidence quality, not whether the result is favorable.
await add('holdout','replay-on','holdout-c',day,.82,9);
await add('holdout','replay-off','holdout-c',day,.90,10);
await add('holdout','replay-on','holdout-d',2*day,.84,11);
await add('holdout','replay-off','holdout-d',2*day,.89,12);
await add('holdout','replay-on','holdout-e',day,.80,13);
await add('holdout','replay-off','holdout-e',day,.93,14);
summary=fabric.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(summary.holdoutMatchedPairs,5);
assert.equal(summary.matchedPairs,7);
assert.equal(summary.holdoutDistinctDelays,2);
assert.equal(summary.evidenceGrade,'confirmatory-eligible');
assert.ok(Math.abs(summary.holdoutConditionDifference01-(-.09))<1e-9);
assert.ok(summary.conditionDifference01>0,'acquisition uplift remains descriptive and must not mask negative holdout performance');
assert.ok(Math.abs(summary.holdoutMeanRetentionOn01-.82)<1e-9);
assert.ok(Math.abs(summary.holdoutMeanRetentionOff01-.91)<1e-9);

// A snapshot preserves the historical rows but not the process-local verifier
// authority. Restart must downgrade claims until signed durable receipts exist
// and have been re-authenticated in the new process.
const cleanSnapshot=fabric.snapshot();
const restored=new ExperienceContinuumFabric();
restored.restore(cleanSnapshot);
const restoredSummary=restored.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(restoredSummary.totalTrials,14);
assert.equal(restoredSummary.verifiedTrials,0);
assert.equal(restoredSummary.matchedPairs,0);
assert.equal(restoredSummary.holdoutMatchedPairs,0);
assert.equal(restoredSummary.evidenceGrade,'insufficient');

// Tampered/legacy restore data cannot regain authority by editing boolean fields.
const hostileSnapshot=structuredClone(cleanSnapshot);
hostileSnapshot.replay.longitudinal=hostileSnapshot.replay.longitudinal.map(row=>({
  ...row,independentVerified:true,
}));
hostileSnapshot.replay.protocols=hostileSnapshot.replay.protocols.map(row=>({
  ...row,randomized:true,balanced:true,
}));
const hostileRestore=new ExperienceContinuumFabric();
hostileRestore.restore(hostileSnapshot);
const hostileSummary=hostileRestore.longitudinalReplaySummary('holdout-phase-isolation','memory-recall-ru-en');
assert.equal(hostileSummary.totalTrials,14);
assert.equal(hostileSummary.verifiedTrials,0);
assert.equal(hostileSummary.holdoutMatchedPairs,0);
assert.equal(hostileSummary.evidenceGrade,'insufficient');

// Five verified pairs at one delay plus an unpaired second-delay arm must
// remain exploratory: delay coverage comes from matched holdout pairs only.
const delayCoverage=new ExperienceContinuumFabric();
const delayProtocolInput={
  id:'holdout-delay-coverage',
  taskId:'memory-recall-ru-en',
  randomized:true,
  balanced:true,
  requiredPairs:2,
  contextKeys:['pair-a','pair-b','pair-c','pair-d','pair-e'],
};
const delayProtocolVerification=await verifyExact({...delayProtocolInput,requiredPairs:5},'workpass78-delay-protocol');
const delayProtocol=delayCoverage.createReplayExperimentProtocol({
  ...delayProtocolInput,
  verification:delayProtocolVerification,
});
assert.equal(delayProtocol.requiredPairs,5);
const addDelay=async(mode,pairKey,delayMs,score01,at)=>{
  const input={
    experimentId:'holdout-delay-coverage',
    taskId:'memory-recall-ru-en',
    phase:'holdout',
    mode,contextKey:pairKey,pairKey,delayMs,
    baselineScore01:.5,score01,
  };
  const verification=await verifyExact(input,`workpass78-delay-${++receiptSequence}`);
  return delayCoverage.recordLongitudinalReplayTrial({
    ...input,independentVerified:true,verification,at,
  });
};
for(let i=0;i<5;i++){
  const key=`pair-${String.fromCharCode(97+i)}`;
  await addDelay('replay-on',key,day,.8+i*.01,20+i*2);
  await addDelay('replay-off',key,day,.7+i*.01,21+i*2);
}
await addDelay('replay-on','unpaired-second-delay',2*day,.99,40);
const delayCoverageSummary=delayCoverage.longitudinalReplaySummary('holdout-delay-coverage','memory-recall-ru-en');
assert.equal(delayCoverageSummary.holdoutMatchedPairs,5);
assert.equal(delayCoverageSummary.holdoutDistinctDelays,1,'only matched clean holdout pairs establish delay coverage');
assert.equal(delayCoverageSummary.evidenceGrade,'exploratory-matched','an unpaired arm at another delay cannot make the experiment confirmatory');

console.log(JSON.stringify({
  ok:true,
  status:'LONGITUDINAL_HOLDOUT_PHASE_PAIRING_PASS',
  summary,
  restored:{totalTrials:restoredSummary.totalTrials,verifiedTrials:restoredSummary.verifiedTrials,evidenceGrade:restoredSummary.evidenceGrade},
  delayCoverage:{matchedPairs:delayCoverageSummary.holdoutMatchedPairs,distinctDelays:delayCoverageSummary.holdoutDistinctDelays,evidenceGrade:delayCoverageSummary.evidenceGrade}
},null,2));
