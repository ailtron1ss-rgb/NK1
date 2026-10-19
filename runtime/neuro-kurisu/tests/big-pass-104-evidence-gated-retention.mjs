import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';

const f=new ExperienceContinuumFabric({maxNodes:128,maxEdges:256,maxClusters:32});
const base={id:'m104',kind:'episodic',source:'runtime',content:'retention transfer interference experiment',createdAt:1,lastAccessAt:1,retrievalCount:2,salience:.86,identityRelevance:.74,goalRelevance:.84,predictionError:.72,emotionalWeight:.42,socialRelevance:.48,confidence:.82,semanticLinks:[],temporalLinks:[],causalLinks:[],epistemicStatus:'verified'};
f.observe(base,{tick:1,at:1,novelty01:.74,activeGoalIds:['goal-A'],evidenceSupport01:.82});
const r=f.reactivate('m104',1000); assert.equal(r?.tier,'hot');
const before=f.snapshot().graphNodes[0].stability01;
const unverified=f.recordReplayValidation({memoryId:'m104',retentionScore01:.99,baselineScore01:.50,delayMs:86400000,evidenceKey:'self-report',independentVerified:false,at:86401000});
assert.equal(unverified.independentVerified,false); assert.equal(f.retentionSummary().validated,0);
const delays=[1,2,4].map(d=>d*86400000);
for(const [i,delayMs] of delays.entries()){
  const v=f.recordReplayValidation({memoryId:'m104',retentionScore01:.88-i*.10,baselineScore01:.50,delayMs,evidenceKey:`holdout:m104:${d=>d}`,independentVerified:true,taskId:`task-${i}`,contextKey:`ctx-${i}`,replayEventId:r?'replay:m104:1000':undefined,at:delayMs+2000});
  assert.equal(v.independentVerified,true);
}
const snap=f.snapshot();
assert.equal(snap.version,6); assert.equal(snap.replay.validated,3); assert.equal(snap.retention.validated,3); assert.equal(snap.retention.curve.distinctDelays,3); assert.ok(snap.retention.curve.fit01>=0); assert.ok(snap.graphNodes[0].stability01>=before-0.01);
const b=f.bindMemoryToSkill({memoryId:'m104',skillId:'skill-104',variantId:'v2',confidence01:.81,independentVerified:true,evidenceKey:'holdout:skill-104',at:900000000});
assert.equal(b.independentVerified,true); assert.equal(f.snapshot().memorySkillBindings.length,1);
for(const mode of ['replay-on','replay-off','replay-on','replay-off']){
  const idx=f.snapshot().replay.experiments.length;
  const on=mode==='replay-on';
  f.recordReplayExperimentTrial({experimentId:'exp104',taskId:'task-transfer',mode,preScore01:.5,postScore01:on?.74:.58,independentVerified:true,randomized:true,contextKey:`ctx-${Math.floor(idx/2)}`,pairKey:`pair-${Math.floor(idx/2)}`,at:1000000+idx});
}
const matched=f.replayExperimentSummary('exp104','task-transfer');
assert.equal(matched.matchedPairs,2); assert.equal(matched.pairedComparable,true); assert.ok((matched.estimatedConditionDifference01??0)>.1);
f.recordReplayExperimentTrial({experimentId:'exp104',taskId:'task-transfer',mode:'replay-on',preScore01:.5,postScore01:.8,independentVerified:true,randomized:true,contextKey:'unmatched',at:2000000});
const unmatched=f.replayExperimentSummary('exp104','task-transfer');
assert.equal(unmatched.matchedPairs,2); assert.equal(unmatched.pairedComparable,true);
const unpaired=f.replayExperimentSummary('no-pair','task-transfer'); assert.equal(unpaired.pairedComparable,false); assert.equal(unpaired.evidenceGrade,'insufficient');
console.log('BIG_PASS_104_EVIDENCE_GATED_RETENTION=PASS',JSON.stringify({version:snap.version,validated:snap.retention.validated,curveFit:Number(snap.retention.curve.fit01.toFixed(3)),matchedPairs:matched.matchedPairs,conditionDifference:Number((matched.estimatedConditionDifference01??0).toFixed(3)),skillBindings:f.snapshot().memorySkillBindings.length}));
