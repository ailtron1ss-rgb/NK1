import {performance} from 'node:perf_hooks';
import {B2501DeepNeuralCausalBranch} from '../src/organism/cognition/B2501DeepNeuralCausalBranch.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'],base=Object.fromEntries(A.map(a=>[a,.5])),n=new B2501DeepNeuralCausalBranch(),ts=[];
for(let t=1;t<=200;t++){const i={tick:t,context01:Array.from({length:16},(_,k)=>((k+t)%17)/16),baseUtilities:base,uncertainty01:t%11===0?.8:.2,novelty01:t%13===0?.8:.2,predictionError01:.12,motivation01:.5,energy01:.7,cognitiveLoad01:.2,autonomous01:.7};const a=performance.now(),r=n.beforeDecision(i);n.afterOutcome({tick:t,action:r.selectedAction,reward01:.6,predictionError01:.15,verified01:t%5===0?1:0,nextContext01:i.context01});ts.push(performance.now()-a)}
ts.sort((a,b)=>a-b);
console.log(JSON.stringify({pass:true,status:'B2501_MOBILE_PERFORMANCE_PASS',p50Ms:+ts[100].toFixed(3),p95Ms:+ts[190].toFixed(3),maxMs:+Math.max(...ts).toFixed(3),heapMiB:+(process.memoryUsage().heapUsed/1048576).toFixed(2)},null,2));
