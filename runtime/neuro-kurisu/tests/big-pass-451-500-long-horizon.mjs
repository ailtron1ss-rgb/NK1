import { B451B500MetaCognitiveDevelopmentCore } from '../src/organism/system/B451B500MetaCognitiveDevelopmentCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer']; const base=Object.fromEntries(A.map(a=>[a,.5]));
const c=i=>Array.from({length:8},(_,j)=>((i*13+j*7)%97)/96);
const core=new B451B500MetaCognitiveDevelopmentCore();
const times=[]; let checksum=0;
for(let i=0;i<1000;i++){
 const x=c(i), t=performance.now(); const o=core.beforeDecision({tick:i,context01:x,baseUtilities:base,b421Predictive:base,b421Bias:Object.fromEntries(A.map(a=>[a,0])),confidence01:.45+(i%17)/40,uncertainty01:(i%11)/11,predictionError01:(i%13)/13,novelty01:(i%9)/9,surprise01:(i%7)/7,goalVector:x,selfVector:x,memoryStrength01:.6,motivation01:.5,complexity01:(i%10)/10}); times.push(performance.now()-t); const action=A[i%7]; core.afterOutcome({tick:i,action,context01:x,nextContext01:c(i+1),reward01:((i*3)%10)/10,surprise01:(i%7)/7,verified01:i%5?1:0,success01:(i%6)/6,predictionError01:(i%13)/13}); checksum+=o.confidence01+(o.computeBudget01||0);
}
times.sort((a,b)=>a-b); const p95=times[Math.floor(times.length*.95)-1]??times.at(-1); console.log(JSON.stringify({pass:true,cycles:1000,avgMs:Number((times.reduce((a,b)=>a+b,0)/times.length).toFixed(4)),p95Ms:Number(p95.toFixed(4)),maxMs:Number(Math.max(...times).toFixed(4)),episodes:core.snapshot().episodes.length,skills:core.snapshot().skills.length,abstractions:core.snapshot().abstractions.length,checksum:Number(checksum.toFixed(4))},null,2));
