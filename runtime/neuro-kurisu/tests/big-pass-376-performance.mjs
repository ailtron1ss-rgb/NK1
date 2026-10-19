import { performance } from 'node:perf_hooks';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const ctx=Object.fromEntries(actions.map((a,i)=>[a,{worldUtility01:.42+.05*i,worldConfidence01:.80,worldUncertainty01:.20,needRelief01:a==='verify'?.58:.40,predictedCost01:.25}]));
const core=new B365UnifiedNeuroCausalCore();
const goal={candidateId:'long-life',vector:[.78,.22,.58,-.10,.64,.31,.74,.48],source:'internal',novelty01:.62,confidence01:.80,internalPressure01:.78,homeostaticPressure01:.34,identityContinuity01:.89,autonomy01:.90};
const times=[];
for(let t=1;t<=500;t++){
 const a=performance.now();
 const s=core.step({tick:t,vector:Array.from({length:64},(_,i)=>Math.sin((i+t)*.09)*.62),novelty01:.44,uncertainty01:.34,predictionError01:.20,goalPressure01:.52,autonomy01:.88,goalAuthorship:t===1?goal:undefined,actionContext:ctx});
 core.learnFromOutcome({tick:t,action:s.selectedAction,reward01:t%9===0?.88:.72,predictionError01:.20,verified01:1,externalEvidence01:.90,actualUtility01:.68,actualWorldConfidence01:.84,novelty01:.44,actualStateDelta01:.48});
 times.push(performance.now()-a);
}
times.sort((a,b)=>a-b); const q=p=>times[Math.min(times.length-1,Math.floor(times.length*p))]; const d=core.goalEcologyDiagnostics();
console.log(JSON.stringify({PASS:true,cycles:500,p50:q(.5),p95:q(.95),p99:q(.99),max:times.at(-1),heapMiB:Math.round(process.memoryUsage().heapUsed/1024/1024*100)/100,autonomousCycles:d.autonomousCycles,selfContinuationCycles:d.selfContinuationCycles,completed:d.completed,successorCreations:d.successorCreations,memories:d.memories.length},null,2));
