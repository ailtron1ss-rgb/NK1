import assert from 'node:assert/strict';
import { CognitiveResearchBattery } from '../src/organism/learning/CognitiveResearchBattery.ts';

const b=new CognitiveResearchBattery();
const p=b.createProtocol({id:'rb107',hypothesisKey:'replay-retention',taskIds:['task-A'],contextKeys:['c1','c2'],delaysMs:[86400000,3*86400000,7*86400000],requiredMatchedPairs:4,requiredHoldout:4,randomized:true,balanced:true,blinded:true,evaluatorVersion:'eval-1',seed:17,release:'34.81.0',stateSchema:116,at:100});
assert.equal(p.preregistrationHash,p.capsule.protocolHash);
let at=1000;
for(const [i,delay] of [1,3,7,1].entries()){
  const context=i%2?'c2':'c1'; const pair='pair'+i;
  const on=.72+i*.01, off=.51+i*.005;
  b.recordTrial({id:`on-${i}`,protocolId:'rb107',taskId:'task-A',phase:'test',condition:'replay-on',contextKey:context,pairKey:pair,delayMs:delay*86400000,baselineScore01:.5,score01:on,independentVerified:true,holdout:i===3,evaluatorVersion:'eval-1',baselineEstablishedAt:at,outcomeRecordedAt:at+10,at});
  b.recordTrial({id:`off-${i}`,protocolId:'rb107',taskId:'task-A',phase:'test',condition:'replay-off',contextKey:context,pairKey:pair,delayMs:delay*86400000,baselineScore01:.5,score01:off,independentVerified:true,holdout:i===3,evaluatorVersion:'eval-1',baselineEstablishedAt:at,outcomeRecordedAt:at+11,at:at+1});
  at+=100;
}
for(let i=0;i<4;i++) b.recordTrial({id:`h-on-${i}`,protocolId:'rb107',taskId:'task-A',phase:'holdout',condition:'replay-on',contextKey:i%2?'c2':'c1',pairKey:`h${i}`,delayMs:7*86400000,baselineScore01:.5,score01:.68,independentVerified:true,holdout:true,evaluatorVersion:'eval-1',baselineEstablishedAt:at,outcomeRecordedAt:at+10,at});
for(let i=0;i<4;i++) b.recordTrial({id:`h-off-${i}`,protocolId:'rb107',taskId:'task-A',phase:'holdout',condition:'replay-off',contextKey:i%2?'c2':'c1',pairKey:`h${i}`,delayMs:7*86400000,baselineScore01:.5,score01:.55,independentVerified:true,holdout:true,evaluatorVersion:'eval-1',baselineEstablishedAt:at,outcomeRecordedAt:at+11,at:at+1});
const a=b.analyze('rb107','task-A');
assert.equal(a.claimStatus,'confirmatory-eligible'); assert.equal(a.matchedPairs,8); assert.equal(a.holdoutTrials,8); assert.ok((a.meanDifference01??0)>.1); assert.ok((a.ci95High01??0)>(a.ci95Low01??0));
const pdup=b.createProtocol({id:'rb107',hypothesisKey:'wrong',taskIds:['wrong'],contextKeys:['wrong'],delaysMs:[1,2],requiredMatchedPairs:4,requiredHoldout:4,randomized:false,balanced:false,blinded:false,evaluatorVersion:'eval-1',seed:999,release:'wrong',stateSchema:1,at:900});
assert.equal(pdup.preregistrationHash,p.preregistrationHash);
const rpt=b.claimReport('replay-retention'); assert.equal(rpt.status,'confirmatory-eligible');
console.log('BIG_PASS_107_COGNITIVE_RESEARCH_BATTERY=PASS',JSON.stringify({version:b.snapshot().version,protocolHash:p.preregistrationHash,matchedPairs:a.matchedPairs,holdout:a.holdoutTrials,quality:Number(a.dataQuality01.toFixed(2)),meanDifference:Number((a.meanDifference01??0).toFixed(3)),ci:[Number((a.ci95Low01??0).toFixed(3)),Number((a.ci95High01??0).toFixed(3))],claim:rpt.status,counters:b.snapshot().counters}));
