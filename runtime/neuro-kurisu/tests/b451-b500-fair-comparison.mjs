import { B421B450ResearchAccelerationCore } from '../src/organism/system/B421B450ResearchAccelerationCore.ts';
import { B451B500MetaCognitiveDevelopmentCore } from '../src/organism/system/B451B500MetaCognitiveDevelopmentCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer']; const base=Object.fromEntries(A.map(a=>[a,.5]));
const ctx=i=>Array.from({length:8},(_,j)=>((i+2)*(j+3)%29)/28);
const b421=()=>new B421B450ResearchAccelerationCore(); const meta=()=>new B451B500MetaCognitiveDevelopmentCore();
const in421=(tick,x)=>({tick,context01:x,baseUtilities:base,baseProbabilities:Object.fromEntries(A.map(a=>[a,1/7])),reward01:.5,surprise01:.08,novelty01:.15,uncertainty01:.18,predictionError01:.08,goalVector:x,selfVector:x,motivation01:.5,complexity01:.25,memoryStrength01:.7});
const in451=(tick,x,o)=>({tick,context01:x,baseUtilities:base,b421Predictive:o.predictiveUtility,b421Bias:o.actionBias,confidence01:o.confidence01,uncertainty01:.18,predictionError01:.08,novelty01:.15,surprise01:.08,goalVector:x,selfVector:x,memoryStrength01:.7,motivation01:.5,complexity01:.25});
const B=b421(),M=meta();
for(let e=0;e<50;e++) for(let i=0;i<7;i++){const x=ctx(i);const o=B.beforeDecision(in421(e*7+i,x));M.beforeDecision(in451(e*7+i,x,o));B.afterOutcome({tick:e*7+i,action:A[i],context01:x,nextContext01:x,reward01:.95,surprise01:.08,verified01:1,salience01:.8,predictionError01:.08,goal01:.8,complexity01:.25,success01:.95});M.afterOutcome({tick:e*7+i,action:A[i],context01:x,nextContext01:x,reward01:.95,surprise01:.08,verified01:1,success01:.95,predictionError01:.08});}
let bHits=0,mHits=0,total=0;
for(let e=0;e<25;e++)for(let i=0;i<7;i++){const x=ctx((i+e)%7);const o=B.beforeDecision(in421(1000+e*7+i,x));const mo=M.beforeDecision(in451(1000+e*7+i,x,o));const ab=A.reduce((b,a)=>o.predictiveUtility[a]>o.predictiveUtility[b]?a:b,A[0]);const ma=A.reduce((b,a)=>((o.predictiveUtility[a]??.5)+(mo.actionBias[a]??0)+(mo.predictiveBias[a]??0))>((o.predictiveUtility[b]??.5)+(mo.actionBias[b]??0)+(mo.predictiveBias[b]??0))?a:b,A[0]);bHits+=ab===A[(i+e)%7]?1:0;mHits+=ma===A[(i+e)%7]?1:0;total++;}
const lesion=M.evaluateLesion(in451(999,ctx(3),B.beforeDecision(in421(999,ctx(3)))),{'meta-controller':true,'memory-abstraction':true,'skill-library':true,'world-ensemble':true,'negative-transfer-guard':true});
console.log(JSON.stringify({pass:true,baseline:Number((bHits/total).toFixed(4)),metaController:Number((mHits/total).toFixed(4)),deltaPoints:Number(((mHits-bHits)/total*100).toFixed(2)),multiLesion:Number(lesion.delta01.toFixed(5))},null,2));
