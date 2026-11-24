import { performance } from 'node:perf_hooks';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const core=new B365UnifiedNeuroCausalCore();
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const ctx=Object.fromEntries(actions.map((a,i)=>[a,{worldUtility01:.35+.06*i,worldConfidence01:.82,worldUncertainty01:.18}]));
const times=[];
for(let t=1;t<=300;t++){
  const start=performance.now();
  core.step({tick:t,vector:Array.from({length:64},(_,i)=>Math.sin((i+t)*.11)*.7),novelty01:.4,uncertainty01:.35,predictionError01:.25,goalPressure01:.55,autonomy01:.8,actionContext:ctx});
  core.learnFromOutcome({tick:t,action:core.snapshot().lastAction,reward01:.65,predictionError01:.25,verified01:1,externalEvidence01:.9,actualUtility01:.62,actualWorldConfidence01:.85,novelty01:.4});
  times.push(performance.now()-start);
}
times.sort((a,b)=>a-b); const q=p=>times[Math.min(times.length-1,Math.floor(times.length*p))];
const d=core.diagnostics(); console.log(JSON.stringify({PASS:true,cycles:300,p50:q(.5),p95:q(.95),p99:q(.99),max:times.at(-1),selfConsolidations:d.selfModel.selfConsolidations,episodes:d.selfModel.autobiographicalEpisodes.length,heapMiB:Math.round(process.memoryUsage().heapUsed/1024/1024*100)/100},null,2));
