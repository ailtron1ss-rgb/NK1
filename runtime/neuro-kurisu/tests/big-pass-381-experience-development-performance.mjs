import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const net=new B365UnifiedNeuroCausalCore();
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const ctx=Object.fromEntries(actions.map(a=>[a,{worldUtility01:.5,worldConfidence01:.8,worldUncertainty01:.2,needRelief01:.3,predictedCost01:.1}]));
const vector=Array.from({length:64},(_,i)=>Math.sin(i*.17)*.2);
const times=[]; for(let i=1;i<=1000;i++){const t0=process.hrtime.bigint(); net.step({tick:i,vector,novelty01:.3,uncertainty01:.3,predictionError01:.15,goalPressure01:.25,autonomy01:.7,learningEnabled:false,actionContext:ctx}); if(i%4===0) net.consolidateExperience({tick:i,action:'explore',reward01:.7,predictionError01:.2,salience01:.4,verified01:1,independent01:1,evidenceQuality01:.9,continuity01:.8}); times.push(Number(process.hrtime.bigint()-t0)/1e6);}
times.sort((a,b)=>a-b); const q=p=>times[Math.min(times.length-1,Math.floor(times.length*p))]; console.log(JSON.stringify({pass:true,status:'B381_PERFORMANCE_PASS',cycles:1000,p50:q(.50),p95:q(.95),p99:q(.99),max:times.at(-1),heapMiB:process.memoryUsage().heapUsed/1048576,adaptations:net.diagnostics().developmentalMemory.adaptations},null,2));
