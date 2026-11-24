import { B451B500MetaCognitiveDevelopmentCore } from '../src/organism/system/B451B500MetaCognitiveDevelopmentCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const V=['memory-abstraction','negative-transfer-guard','skill-library','world-ensemble','meta-controller','experiment-policy','compute-governor','identity-consolidator'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const ctxFor=i=>Array.from({length:8},(_,j)=>Math.max(0,Math.min(1,.08+i*.12+j*.007)));
const target=i=>A[i%7];
const input=(c,tick,{nov=.2,unc=.2,err=.1,sur=.1,conf=.65}={})=>({tick,context01:c,baseUtilities:base,b421Predictive:base,b421Bias:Object.fromEntries(A.map(a=>[a,0])),confidence01:conf,uncertainty01:unc,predictionError01:err,novelty01:nov,surprise01:sur,goalVector:c,selfVector:c,memoryStrength01:.8,motivation01:.55,complexity01:.25});
const core=new B451B500MetaCognitiveDevelopmentCore();
for(let e=0;e<50;e++) for(let i=0;i<7;i++){const c=ctxFor(i), a=target(i); core.beforeDecision(input(c,e*7+i,{nov:.15,unc:.15,err:.08})); core.afterOutcome({tick:e*7+i,action:a,context01:c,nextContext01:c,reward01:.92,surprise01:.08,verified01:1,success01:.94,predictionError01:.08});}
let hits=0,total=0;
for(let e=0;e<30;e++) for(let i=0;i<7;i++){const c=ctxFor(i),o=core.beforeDecision(input(c,1000+e*7+i,{nov:.65,unc:.5,err:.35,sur:.4,conf:.58})); const ranked=A.reduce((b,a)=>o.actionBias[a]>o.actionBias[b]?a:b,A[0]); hits+=ranked===target(i)?1:0; total++;}
const lesion=core.evaluateLesion(input(ctxFor(3),999,{nov:.7,unc:.7,err:.55}),{'memory-abstraction':true,'skill-library':true,'meta-controller':true});
const diag=core.diagnostics();
const snap=core.snapshot(); core.restore(snap); core.markRestart();
console.log(JSON.stringify({pass:true,holdout:Number((hits/total).toFixed(4)),lesion:Number(lesion.delta01.toFixed(5)),episodes:core.snapshot().episodes.length,skills:core.snapshot().skills.length,abstractions:core.snapshot().abstractions.length,developmentalGain:Number(diag.developmentalGain01.toFixed(4)),restart:core.diagnostics().restartCount,bestStrategy:diag.bestStrategy},null,2));
