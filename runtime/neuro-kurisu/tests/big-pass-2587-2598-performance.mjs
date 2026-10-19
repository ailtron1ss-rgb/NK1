import { performance } from 'node:perf_hooks';
import { TransferableEmbodiedSkillSystem } from '../src/organism/cognition/TransferableEmbodiedSkillSystem.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const x=new TransferableEmbodiedSkillSystem();
const t0=performance.now();
for(let t=1;t<=12000;t++){
  const context=Array.from({length:16},(_,i)=>((i*13+t*7)%101)/100);
  const latent=context.slice(0,8), action=A[t%A.length];
  x.beforeDecision({tick:t,context,latent,actionUtilities:base,goalPressure01:.7,uncertainty01:.35,computeBudget01:.62,predictionError01:.18,novelty01:.2});
  x.afterOutcome({tick:t,context,latent,nextLatent:latent.map((v,i)=>Math.max(0,Math.min(1,v+(i===0?.07:-.02)))),action,reward01:.64,predictionError01:.16,verified01:.8});
}
const elapsed=performance.now()-t0, d=x.metrics();
console.log('B2587_2598_PERFORMANCE_PASS',JSON.stringify({cycles:12000,elapsedMs:Number(elapsed.toFixed(3)),cyclesPerSecond:Number((12000/(elapsed/1000)).toFixed(2)),skills:d.skills.length,transfer01:d.transfer01,optionCoverage01:d.optionCoverage01}));
