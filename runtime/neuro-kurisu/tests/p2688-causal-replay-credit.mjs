import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const mem=(i,now)=>({
  id:`m-${i}`,content:`causal replay experience ${i} topic ${i%4}`,kind:i%7===0?'identity':i%5===0?'autobiographical':'episodic',
  createdAt:now-i*86400000,lastAccessAt:now-i*3600000,salience:.62,emotionalWeight:.4,
  identityRelevance:i%7===0?.92:.24,goalRelevance:i%3===0?.84:.42,socialRelevance:.2,
  predictionError:i%4===0?.92:.3,temperature01:.5,confidence:.8,epistemicStatus:'fact',source:'p2688-credit',
  entities:[`topic${i%4}`],semanticLinks:i?['m-'+(i-1)]:[],temporalLinks:i?['m-'+(i-1)]:[],causalLinks:i%2===0&&i?['m-'+(i-1)]:[],revisionHistory:[],dormant:false,retrievalCount:2,semanticVector:[]
});

const now=Date.now();
const fabric=new ExperienceContinuumFabric({maxNodes:384,maxEdges:1024,maxClusters:96});
for(let i=0;i<40;i++) fabric.observe(mem(i,now),{tick:i+1,at:now-i*1000,novelty01:i%4===0?.9:.32,identityContinuity01:.86,valueStability01:.82,evidenceSupport01:.78,activeGoalIds:['goal-A']});
for(let tick=1;tick<=64;tick++) fabric.tick({tick,at:now+tick*1000,pressure01:tick%11===0?.84:.62,identityContinuity01:.84,valueStability01:.82,evidenceSupport01:.78,activeGoalIds:['goal-A']});

const firstEvent=fabric.snapshot().replay.events.at(-1);
assert(firstEvent,'expected at least one replay event');
const validationAt=firstEvent.at+3*86400000;
// Causal replay credit requires a trusted external receipt bound to the exact tuple.
const validationInput={
  memoryId:firstEvent.memoryId,retentionScore01:.88,baselineScore01:.61,delayMs:3*86400000,
  transferPotential01:.79,interferenceRisk01:.08,evidenceKey:'p2688-causal-credit',
  taskId:'task-A',contextKey:'ctx-A'
};
const validationVerification=await new OutcomeVerificationService().verify(
  {toolId:'memory.retention-postcondition',input:validationInput,result:{retentionScore01:.88}},
  ()=>({verified:true,basis:'external-postcondition',confidence01:.99,externalObservation:true,observationId:'obs-p2688-causal-credit',expectedPostcondition:'retention-score:0.88',observedPostcondition:'retention-score:0.88'})
);
const validation=fabric.recordReplayValidation({
  ...validationInput,verification:validationVerification,replayEventId:firstEvent.id,at:validationAt
});
assert.equal(validation.independentVerified,true);
const summary=fabric.summary();
assert(summary.causalReplayCredit.assignments>=1);
assert(summary.causalReplayCredit.verifiedAssignments>=1);
assert(summary.causalReplayCredit.meanCredit01>0);
assert(summary.causalReplayCredit.meanEligibility01>0);
assert(summary.causalReplayCredit.meanDelayAttenuation01>0);
const ledger=fabric.causalReplayCreditLedger(16);
assert(ledger.some(x=>x.replayEventId===firstEvent.id && x.validationId===validation.id));
for(const row of ledger){for(const key of ['delayAttenuation01','cascadeShort01','cascadeMedium01','cascadeLong01','temporalMatch01','eligibility01','outcome01','credit01']) assert(row[key]>=0&&row[key]<=1);}

const snapshot=fabric.snapshot();
const restored=new ExperienceContinuumFabric();
restored.restore(snapshot);
const restoredDiag=restored.summary().causalReplayCredit;
assert.equal(restoredDiag.assignments,summary.causalReplayCredit.assignments);
assert.equal(restoredDiag.verifiedAssignments,summary.causalReplayCredit.verifiedAssignments);
assert(restored.causalReplayCreditLedger(16).length>=1);

console.log(JSON.stringify({
  pass:true,status:'P2688_CAUSAL_REPLAY_CREDIT_PASS',
  replayEvents:snapshot.replay.events.length,
  validations:snapshot.replay.validations.length,
  credit:summary.causalReplayCredit,
  ledgerTail:ledger.slice(-3)
},null,2));
