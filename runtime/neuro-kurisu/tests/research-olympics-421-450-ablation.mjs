import { B421B450ResearchAccelerationCore } from '../src/organism/system/B421B450ResearchAccelerationCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const makeCtx=bin=>Array.from({length:8},(_,j)=>.15+bin*.10+j*.006);
const targetFor=bin=>A[bin];
const variants=['causal-graph','procedural-refiner','meta-router','compute-allocator','hierarchical-world','coordinated-rollout','confidence-calibrator','self-experiment'];
function evaluate(lesion={}){
 const c=new B421B450ResearchAccelerationCore();
 c.setLesions(lesion);
 for(let epoch=0;epoch<60;epoch++) for(let bin=0;bin<7;bin++){
  const x=makeCtx(bin),target=targetFor(bin);
  c.beforeDecision({tick:epoch*7+bin,context01:x,baseUtilities:base,reward01:.5,surprise01:.15,novelty01:.2,uncertainty01:.2,predictionError01:.1,goalVector:x,selfVector:x,motivation01:.55,complexity01:.3,memoryStrength01:.5});
  c.afterOutcome({tick:epoch*7+bin,action:target,context01:x,nextContext01:x,reward01:.95,surprise01:.1,verified01:1,salience01:.7,predictionError01:.1,goal01:.8,complexity01:.3,success01:.95});
 }
 let hits=0,total=0;for(let epoch=0;epoch<20;epoch++)for(let bin=0;bin<7;bin++){const x=makeCtx(bin),target=targetFor(bin);const o=c.beforeDecision({tick:700+epoch*7+bin,context01:x,baseUtilities:base,reward01:.5,surprise01:.05,novelty01:.1,uncertainty01:.1,predictionError01:.05,goalVector:x,selfVector:x,motivation01:.55,complexity01:.2,memoryStrength01:.9});const act=A.reduce((b,a)=>o.predictiveUtility[a]>o.predictiveUtility[b]?a:b,A[0]);hits+=act===target?1:0;total++;}
 return hits/total;
}
const full=evaluate();const rows=Object.fromEntries(variants.map(v=>[v, evaluate({[v]:true})]));console.log(JSON.stringify({full,lesions:rows},null,2));
