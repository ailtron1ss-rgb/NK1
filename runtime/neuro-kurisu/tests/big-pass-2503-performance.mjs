import assert from 'node:assert/strict';
import { B2502EINeuralReplayField } from '../src/organism/cognition/B2502EINeuralReplayField.ts';
import { B2503ActionablePredictiveField } from '../src/organism/cognition/B2503ActionablePredictiveField.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const x=Array.from({length:32},(_,i)=>(i%17)/16), state=Array.from({length:24},(_,i)=>(i%11)/10);
const b2=new B2502EINeuralReplayField(),b3=new B2503ActionablePredictiveField();
for(let i=0;i<30;i++){const r=b2.beforeDecision({tick:i+1,context01:x,baseUtilities:base,uncertainty01:.35,novelty01:.4,predictionError01:.2,energy01:.7,motivation01:.5});b2.afterOutcome({tick:i+1,action:r.selectedAction,reward01:.55,predictionError01:.2,verified01:i%4===0});b3.beforeDecision({tick:i+1,state01:state,baseUtilities:base,uncertainty01:.35,predictionError01:.2,novelty01:.4,energy01:.7,goalPressure01:.5});}
const warm=20,samples=[];for(let i=0;i<warm;i++){const t0=process.hrtime.bigint();b2.beforeDecision({tick:100+i,context01:x,baseUtilities:base,uncertainty01:.35,novelty01:.4,predictionError01:.2,energy01:.7,motivation01:.5});b3.beforeDecision({tick:100+i,state01:state,baseUtilities:base,uncertainty01:.35,predictionError01:.2,novelty01:.4,energy01:.7,goalPressure01:.5});samples.push(Number(process.hrtime.bigint()-t0)/1e6);}
samples.sort((a,b)=>a-b);const p50=samples[Math.floor(samples.length*.5)],p95=samples[Math.floor(samples.length*.95)];assert.ok(p95<25);assert.ok(b2.diagnostics().cycles>0&&b3.diagnostics().cycles>0);
console.log(JSON.stringify({pass:true,status:'B2503_MOBILE_PERFORMANCE_PASS',p50Ms:+p50.toFixed(3),p95Ms:+p95.toFixed(3),maxMs:+samples.at(-1).toFixed(3),heapMiB:+(process.memoryUsage().heapUsed/1048576).toFixed(2)},null,2));
