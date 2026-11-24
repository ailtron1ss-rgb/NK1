import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';

const f=new ExperienceContinuumFabric({maxNodes:64,maxEdges:128,maxClusters:16});
const base={id:'m106',kind:'episodic',source:'runtime',content:'longitudinal replay retention transfer holdout',createdAt:1,lastAccessAt:1,retrievalCount:2,salience:.84,identityRelevance:.72,goalRelevance:.81,predictionError:.69,emotionalWeight:.43,socialRelevance:.51,confidence:.83,semanticLinks:[],temporalLinks:[],causalLinks:[],epistemicStatus:'verified'};
f.observe(base,{tick:1,at:1,novelty01:.76,activeGoalIds:['goal-long'],evidenceSupport01:.84});
f.reactivate('m106',1000);
const proto=f.createReplayExperimentProtocol({id:'exp106',taskId:'task-long',randomized:true,balanced:true,requiredPairs:2,contextKeys:['c1','c2'],at:100});
for(const [i,delay] of [1,2].entries()){
  const ms=delay*86400000;
  f.recordLongitudinalReplayTrial({experimentId:proto.id,taskId:proto.taskId,phase:'test',mode:'replay-on',contextKey:`c${i+1}`,pairKey:`p${i+1}`,delayMs:ms,baselineScore01:.5,score01:.78-i*.03,independentVerified:true,at:ms+10});
  f.recordLongitudinalReplayTrial({experimentId:proto.id,taskId:proto.taskId,phase:'test',mode:'replay-off',contextKey:`c${i+1}`,pairKey:`p${i+1}`,delayMs:ms,baselineScore01:.5,score01:.59-i*.02,independentVerified:true,at:ms+11});
}
f.recordLongitudinalReplayTrial({experimentId:proto.id,taskId:proto.taskId,phase:'holdout',mode:'replay-on',contextKey:'holdout-1',delayMs:4*86400000,baselineScore01:.5,score01:.69,independentVerified:true,at:4*86400000+20});
f.recordLongitudinalReplayTrial({experimentId:proto.id,taskId:proto.taskId,phase:'holdout',mode:'replay-off',contextKey:'holdout-2',delayMs:4*86400000,baselineScore01:.5,score01:.54,independentVerified:true,at:4*86400000+21});
const dup=f.recordLongitudinalReplayTrial({experimentId:proto.id,taskId:proto.taskId,phase:'holdout',mode:'replay-on',contextKey:'holdout-1',delayMs:4*86400000,baselineScore01:.5,score01:.10,independentVerified:true,at:999999999});
assert.equal(dup.score01,.69);
const summary=f.longitudinalReplaySummary(proto.id,proto.taskId);
assert.equal(summary.totalTrials,6); assert.equal(summary.verifiedTrials,6); assert.equal(summary.matchedPairs,2); assert.equal(summary.distinctDelays,3); assert.equal(summary.holdoutTrials,2); assert.equal(summary.evidenceGrade,'confirmatory-eligible'); assert.ok((summary.conditionDifference01??0)>.1);
const v=f.recordReplayValidation({memoryId:'m106',retentionScore01:.9,baselineScore01:.5,delayMs:86400000,evidenceKey:'same-proof',taskId:'task-long',contextKey:'c1',independentVerified:true,at:123});
const v2=f.recordReplayValidation({memoryId:'m106',retentionScore01:.1,baselineScore01:.5,delayMs:86400000,evidenceKey:'same-proof',taskId:'task-long',contextKey:'c1',independentVerified:true,at:456});
assert.equal(v2.id,v.id); assert.equal(f.snapshot().retention.validated,1);
console.log('BIG_PASS_106_LONGITUDINAL_EVIDENCE=PASS',JSON.stringify({version:f.snapshot().version,evidenceGrade:summary.evidenceGrade,matchedPairs:summary.matchedPairs,distinctDelays:summary.distinctDelays,conditionDifference:Number((summary.conditionDifference01??0).toFixed(3)),dedupeValidated:f.snapshot().retention.validated}));
