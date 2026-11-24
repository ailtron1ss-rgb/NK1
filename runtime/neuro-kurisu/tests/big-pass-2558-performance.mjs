import { AdaptiveCausalMemoryPlanner } from '../src/organism/cognition/AdaptiveCausalMemoryPlanner.ts';
const p=new AdaptiveCausalMemoryPlanner();const A=['respond','explore','verify','rest','reflect','wait','defer'];const u=Object.fromEntries(A.map(a=>[a,.5]));
const start=performance.now();let checksum=0;
for(let t=1;t<=20000;t++){
 const context=Array.from({length:16},(_,i)=>Math.sin(t*.01+i*.17)*.5+.5); const latent=context.slice(0,8).map(v=>v*2-1);
 const r=p.beforeDecision({tick:t,context,latent,actionUtilities:u,forecast:[latent,latent.map(v=>v*.97),latent.map(v=>v*.92)],forecastConfidence01:.72,disagreement01:.18,epistemicValue01:.61,computeBudget01:.7,retrieved:[],novelty01:.42,uncertainty01:.31,predictionError01:.2,goalPressure01:.58});
 const a=A[t%A.length]; const n=latent.map(v=>v*.97); const o=p.afterOutcome({tick:t,context,latent,nextLatent:n,action:a,reward01:.5+((t%13===0&&a==='verify')?.25:0),predictionError01:.22,verified01:a==='verify'?1:0,retrievedMemoryIds:[],counterfactualReward:r.counterfactualReward,forecastConfidence01:r.selectedForesight01,disagreement01:.18}); checksum+=r.actionBias[a];
}
const elapsed=(performance.now()-start)/1000;const m=p.metrics();const rate=20000/Math.max(.001,elapsed);
if(rate<1500)throw new Error(`planner throughput too low ${rate}`);
if(!Number.isFinite(checksum))throw new Error('checksum invalid');
console.log('B2558_PLANNER_PERFORMANCE_PASS');console.log(JSON.stringify({cycles:20000,seconds:elapsed,cyclesPerSecond:rate,rules:m.ruleCount,traces:m.traceCount,causalComparisons:m.causalComparisons,transfer01:m.transfer01},null,2));
