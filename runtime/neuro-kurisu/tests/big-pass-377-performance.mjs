import { performance } from 'node:perf_hooks';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const ctx=Object.fromEntries(actions.map((a,i)=>[a,{worldUtility01:.45+.05*i,worldConfidence01:.80,worldUncertainty01:.20,needRelief01:a==='verify'?.60:.40,predictedCost01:a==='explore'?.30:.22}]));
const core=new B365UnifiedNeuroCausalCore();
const goal={candidateId:'life-course-alpha',vector:[.82,.18,.62,-.10,.70,.28,.74,.46],source:'internal',novelty01:.60,confidence01:.82,internalPressure01:.80,homeostaticPressure01:.35,identityContinuity01:.90,autonomy01:.92};
const times=[];
for(let t=1;t<=1000;t++){
 const a=performance.now();
 const s=core.step({tick:t,vector:Array.from({length:64},(_,i)=>Math.sin((i+t)*.09)*.55),novelty01:.40+(t%17)/100,uncertainty01:.30+(t%13)/100,predictionError01:t%41===0?.74:.14,goalPressure01:.48,autonomy01:.90,goalAuthorship:t===1?goal:undefined,actionContext:ctx,learningEnabled:true});
 core.learnFromOutcome({tick:t,action:s.selectedAction,reward01:t%29===0?.12:.78,predictionError01:t%41===0?.76:.12,verified01:1,externalEvidence01:.90,actualUtility01:t%29===0?.20:.74,actualWorldConfidence01:.84,novelty01:.40,actualStateDelta01:.46});
 times.push(performance.now()-a);
}
times.sort((a,b)=>a-b); const q=p=>times[Math.min(times.length-1,Math.floor(times.length*p))]; const d=core.goalEcologyDiagnostics();
console.log(JSON.stringify({PASS:true,cycles:1000,p50:q(.50),p95:q(.95),p99:q(.99),max:times.at(-1),heapMiB:Math.round(process.memoryUsage().heapUsed/1024/1024*100)/100,totalSwitches:d.totalSwitches,autonomousReplans:d.autonomousReplans,autonomousCycles:d.autonomousCycles,selfContinuationCycles:d.selfContinuationCycles,completed:d.completed,successorCreations:d.successorCreations,memories:d.memories.length,lifeCourse01:d.lifeCourse01},null,2));
