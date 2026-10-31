import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';
import { UnifiedLearningSubstrate } from '../src/organism/learning/UnifiedLearningSubstrate.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const f=new ExperienceContinuumFabric({maxNodes:64,maxEdges:128,maxClusters:16});
const base={id:'m105',kind:'episodic',source:'runtime',content:'controlled replay protocol retention transfer',createdAt:1,lastAccessAt:1,retrievalCount:1,salience:.82,identityRelevance:.71,goalRelevance:.83,predictionError:.68,emotionalWeight:.44,socialRelevance:.52,confidence:.84,semanticLinks:[],temporalLinks:[],causalLinks:[],epistemicStatus:'verified'};
f.observe(base,{tick:1,at:1,novelty01:.77,activeGoalIds:['goal-A'],identityContinuity01:.9,valueStability01:.88,evidenceSupport01:.84});
const proto=f.createReplayExperimentProtocol({id:'exp105',taskId:'task-target',sourceTaskId:'task-source',targetTaskId:'task-target',randomized:true,balanced:true,requiredPairs:2,contextKeys:['c1','c2','c3'],at:100});
assert.equal(proto.requiredPairs,2);
for(const pair of ['c1','c2']){
  f.recordReplayExperimentTrial({experimentId:'exp105',taskId:'task-target',mode:'replay-on',preScore01:.5,postScore01:.76,independentVerified:true,randomized:true,contextKey:pair,pairKey:`p-${pair}`,at:1000});
  f.recordReplayExperimentTrial({experimentId:'exp105',taskId:'task-target',mode:'replay-off',preScore01:.5,postScore01:.57,independentVerified:true,randomized:true,contextKey:pair,pairKey:`p-${pair}`,at:1001});
}
const gate=f.replayExperimentProtocolCheck('exp105','task-target');
assert.equal(gate.eligibleForConfirmatoryInference,true);
assert.equal(gate.matchedPairs,2);
const ledger=f.replayEvidenceLedger();
assert.ok(Array.isArray(ledger));
const u=new UnifiedLearningSubstrate();
// Transfer credit requires an in-process external postcondition receipt bound to the
// exact probe tuple; a caller boolean is a claim, not proof.
const verificationService=new OutcomeVerificationService();
for(const [i,score] of [[0,.68],[1,.72],[2,.70],[3,.75]]){
  const verificationInput={id:`tp-${i}`,sourceTaskId:'source',targetTaskId:'target',baseline01:.5,postScore01:score,holdout:true,contextKey:`ctx-${i}`,at:100+i};
  const verification=await verificationService.verify(
    {toolId:'learning.transfer-postcondition',input:verificationInput,result:{postScore01:score}},
    ()=>({verified:true,basis:'external-postcondition',confidence01:.99,externalObservation:true,observationId:`obs-tp-${i}`,expectedPostcondition:`transfer-score:${score}`,observedPostcondition:`transfer-score:${score}`})
  );
  assert.ok(u.recordTransferProbe({...verificationInput,verification}),`probe ${i} must be recorded`);
}
const tg=u.transferInferenceGate({sourceTaskId:'source',targetTaskId:'target',minHoldout:4,minDistinctContexts:4});
assert.equal(tg.eligibleForConfirmatoryInference,true);
const matrix=u.transferMatrix();
assert.equal(matrix.length,1); assert.equal(matrix[0].positive,4);
console.log('BIG_PASS_105_EXPERIMENTAL_PROTOCOL=PASS',JSON.stringify({protocolDefined:gate.protocolDefined,matchedPairs:gate.matchedPairs,conditionDifference:Number((f.replayExperimentSummary('exp105','task-target').estimatedConditionDifference01??0).toFixed(3)),transferHoldout:tg.holdoutSamples,transferMean:Number(tg.meanDelta01.toFixed(3))}));
