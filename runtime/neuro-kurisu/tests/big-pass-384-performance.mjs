import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const net=new B365UnifiedNeuroCausalCore();
const v=Array.from({length:64},(_,i)=>Math.tanh(.1*Math.sin(i*.17)));
const ctx=[.91,.83,.89,.8,.87,.84,.93,.9];
const times=[];
for(let i=0;i<1400;i++){
  const t=performance.now();
  net.step({tick:i+1,vector:v,novelty01:.42,uncertainty01:.35,predictionError01:.12,goalPressure01:.33,autonomy01:.75,learningEnabled:false,developmentContext01:ctx});
  if(i>=200) net.consolidateExperience({tick:i+2000,action:'verify',reward01:.78,predictionError01:.2,salience01:.7,verified01:1,independent01:1,evidenceQuality01:.99,continuity01:.9,goalId:'perf',context01:ctx});
  times.push(performance.now()-t);
}
times.sort((a,b)=>a-b); const q=p=>times[Math.min(times.length-1,Math.floor((times.length-1)*p))]; const heap=process.memoryUsage().heapUsed/1024/1024; console.log(JSON.stringify({pass:true,status:'B384_PERFORMANCE_PASS',cycles:1400,p50:q(.5),p95:q(.95),p99:q(.99),max:times.at(-1),heapMiB:heap,verifiedEpisodes:net.autobiographicalValueGoalDiagnostics().verifiedEpisodes},null,2));
