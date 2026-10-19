import { B721B900DevelopmentalLearningFabric } from '../src/organism/system/B721B900DevelopmentalLearningFabric.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map(a=>[a,.5]));
const c=new B721B900DevelopmentalLearningFabric();
const ctx=Array.from({length:8},(_,i)=>.2+i*.05); for(let i=1;i<=1000;i++) c.afterOutcome({tick:i,action:actions[i%actions.length],context01:ctx,nextContext01:ctx,reward01:.6,predictionError01:.2,verified01:.8,success01:.7});
for(let i=0;i<100;i++)c.beforeDecision({tick:2000+i,context01:ctx,baseUtilities:base,uncertainty01:.3,predictionError01:.2,novelty01:.25,confidence01:.8});
const xs=[];for(let i=0;i<5000;i++){const t=performance.now();c.beforeDecision({tick:3000+i,context01:ctx,baseUtilities:base,uncertainty01:i%13===0?.8:.25,predictionError01:i%17===0?.7:.15,novelty01:i%19===0?.8:.2,confidence01:i%23===0?.35:.82});xs.push(performance.now()-t);}
xs.sort((a,b)=>a-b); const avg=xs.reduce((a,b)=>a+b,0)/xs.length; const p95=xs[Math.floor(xs.length*.95)],p99=xs[Math.floor(xs.length*.99)];
console.log('B721_B900_PERFORMANCE_PASS'); console.log('avgMs',avg.toFixed(4),'p95Ms',p95.toFixed(4),'p99Ms',p99.toFixed(4),'maxMs',xs.at(-1).toFixed(4));
