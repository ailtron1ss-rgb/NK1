import assert from 'node:assert/strict';
import { SelfOptimizingAutobiographicalMemory } from '../src/organism/cognition/SelfOptimizingAutobiographicalMemory.ts';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const memory=new SelfOptimizingAutobiographicalMemory();
const strategies=new Set();
let redirects=0,holdout=0;
for(let t=1;t<=1600;t++){
  const shock=t>960 && t%17<7;
  const context=Array.from({length:24},(_,i)=>Math.sin((i+1)*(t%37+1)*.071)+((i*13+t*7)%29)/28*.18);
  const identity=Array.from({length:16},(_,i)=>Math.cos((i+2)*(t%31+1)*.043));
  const before=memory.beforeDecision({tick:t,context,identityVector:identity,goalPressure01:shock?.86:.63,identityGap01:shock?.72:.24,novelty01:shock?.78:.28,uncertainty01:shock?.83:.21,predictionError01:shock?.82:.14,reward01:.55,computeBudget01:shock?.52:.85});
  strategies.add(before.selectedStrategy); if(before.redirectAction)redirects++;
  const action=before.redirectAction??A[(t*3)%A.length];
  const reward=shock?(action==='verify'?.77:.44):(action==='reflect'?.82:action==='explore'?.78:.67);
  memory.afterOutcome({tick:t,context,identityVector:identity,goalPressure01:shock?.86:.63,identityGap01:shock?.72:.24,novelty01:shock?.78:.28,uncertainty01:shock?.83:.21,reward01:reward,predictionError01:shock?.74:.16,verified01:action==='verify'?1:(t%5===0?1:.82),action,holdout01:t%11===0?1:0});
  if(t%11===0)holdout++;
}
const mm=memory.metrics();
assert(mm.memoryCount>8,'memory never accumulated useful experiences');
assert(mm.writes>20,'write selector remained dormant');
assert(mm.recalls>100,'retrieval did not become active');
assert(mm.consolidations>0,'duplicate experiences were never consolidated');
assert(mm.strategyUpdates>1000,'online strategy learning did not run');
assert(strategies.size>=4,`strategy diversity too low: ${[...strategies]}`);
assert(mm.liveRedirects>50,'live improvement never redirected risky decisions');
assert(mm.liveImprovement01>.45);
assert(mm.retrievalQuality01>.4);
assert(mm.identityWeightedRecall01>.45);
assert(mm.holdout01>.45 && holdout===mm.holdoutEvaluations);
const snap=memory.snapshot();const restored=new SelfOptimizingAutobiographicalMemory();restored.restore(snap);const rm=restored.metrics();
assert(rm.memoryCount===mm.memoryCount);assert(Math.abs(rm.strategyLearning01-mm.strategyLearning01)<1e-12);

const branch=new NeuralExperienceBranch();
for(let t=1;t<=1200;t++){
  const shock=t>720 && t%23<9;
  const input=Array.from({length:64},(_,i)=>Math.sin((i+1)*(t%43+1)*.061)*.42+((i*17+t*5)%31)/30*.12);
  const out=branch.beforeDecision({tick:t,input,baseUtilities:base,predictionError01:shock?.78:.15,novelty01:shock?.72:.24,uncertainty01:shock?.77:.26,homeostasis01:.2,identityGap01:shock?.68:.22,goalPressure01:.72,reward01:.58,personalityVector:[.76,.72,.70,.58,.82,.55,.48,.60],identityVector:Array.from({length:24},(_,i)=>Math.cos((i+4)*(t%37+1)*.041)),embodied:{sensorFeatures:input,thermalStrain01:shock?.72:.16,battery01:shock?.42:.88,cpuLoad01:shock?.66:.2,ramPressure01:shock?.62:.18,sensorFreshness01:shock?.70:.92}});
  const utilities=Object.fromEntries(A.map(a=>[a,.5+(out.actionBias[a]??0)]));
  const action=A.reduce((best,a)=>(utilities[a]>utilities[best]?a:best),A[0]);
  branch.commitAction(action,utilities);
  branch.afterOutcome({tick:t,action,reward01:shock?(action==='verify'?.79:.48):(action==='explore'?.8:action==='verify'?.82:.66),predictionError01:shock?.71:.17,verified01:action==='verify'?1:(t%5===0?1:.82),nextInput:input.map((v,i)=>Math.max(-1,Math.min(1,v+(i%4===0?.045:-.015)))),holdout01:t%17===0?1:0,identityGap01:shock?.68:.22,goalPressure01:.72,identityVector:Array.from({length:24},(_,i)=>Math.cos((i+4)*(t%37+1)*.041)),embodied:{nextFeatures:input,sensorFreshness01:shock?.70:.92}});
}
const b=branch.continuityMetrics();
assert(b.selfOptimizingMemory.memoryCount>8);
assert(b.selfOptimizingMemory.writes>50);
assert(b.selfOptimizingMemory.strategyUpdates>1000);
assert(b.selfOptimizingMemory.liveRedirects>20);
assert(b.selfOptimizingMemory.liveImprovement01>.4);
assert(b.selfOptimizingMemory.retention01>.45);
const branchSnap=branch.snapshot();const restoredBranch=new NeuralExperienceBranch();restoredBranch.restore(branchSnap);const br=restoredBranch.continuityMetrics();
assert(br.selfOptimizingMemory.memoryCount===b.selfOptimizingMemory.memoryCount);
assert(Math.abs(br.selfOptimizingMemory.strategyLearning01-b.selfOptimizingMemory.strategyLearning01)<1e-12);
console.log('P2627_2640_SELF_OPTIMIZING_AUTOBIOGRAPHICAL_PASS',JSON.stringify({
  isolated:{memoryCount:mm.memoryCount,writes:mm.writes,recalls:mm.recalls,consolidations:mm.consolidations,forgets:mm.forgets,contradictions:mm.contradictions,strategies:[...strategies],strategyLearning01:mm.strategyLearning01,liveRedirects:mm.liveRedirects,liveImprovement01:mm.liveImprovement01,retrievalQuality01:mm.retrievalQuality01,identityWeightedRecall01:mm.identityWeightedRecall01,retention01:mm.retention01,holdout01:mm.holdout01},
  branch:{cycles:1200,memoryCount:b.selfOptimizingMemory.memoryCount,writes:b.selfOptimizingMemory.writes,recalls:b.selfOptimizingMemory.recalls,consolidations:b.selfOptimizingMemory.consolidations,strategyLearning01:b.selfOptimizingMemory.strategyLearning01,liveRedirects:b.selfOptimizingMemory.liveRedirects,liveImprovement01:b.selfOptimizingMemory.liveImprovement01,retrievalQuality01:b.selfOptimizingMemory.retrievalQuality01,identityWeightedRecall01:b.selfOptimizingMemory.identityWeightedRecall01,holdout01:b.selfOptimizingMemory.holdout01,persistence:'PASS'}
},null,2));
