import { B421B450ResearchAccelerationCore } from '../src/organism/system/B421B450ResearchAccelerationCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const makeCtx=bin=>Array.from({length:8},(_,j)=>.15+bin*.10+j*.006);
const targetFor=bin=>A[bin];
function run(use){
 const c=new B421B450ResearchAccelerationCore();
 for(let epoch=0;epoch<120;epoch++) for(let bin=0;bin<7;bin++){
  const x=makeCtx(bin);const target=targetFor(bin);
  if(use){
   c.beforeDecision({tick:epoch*7+bin,context01:x,baseUtilities:base,reward01:.5,surprise01:epoch<2?.7:.1,novelty01:.2,uncertainty01:epoch<2?.8:.2,predictionError01:epoch<2?.7:.1,goalVector:x,selfVector:x,motivation01:.55,complexity01:.3,memoryStrength01:.5});
   c.afterOutcome({tick:epoch*7+bin,action:target,context01:x,nextContext01:x,reward01:.95,surprise01:.1,verified01:1,salience01:.7,predictionError01:.1,goal01:.8,complexity01:.3,success01:.95});
  }
 }
 let correct=0,total=0;
 for(let epoch=0;epoch<40;epoch++) for(let bin=0;bin<7;bin++){
  const x=makeCtx(bin);const target=targetFor(bin);let action=A[0];
  if(use){const o=c.beforeDecision({tick:1000+epoch*7+bin,context01:x,baseUtilities:base,reward01:.5,surprise01:.05,novelty01:.1,uncertainty01:.1,predictionError01:.05,goalVector:x,selfVector:x,motivation01:.55,complexity01:.2,memoryStrength01:.9});action=A.reduce((best,a)=>o.predictiveUtility[a]>o.predictiveUtility[best]?a:best,A[0]);}
  correct+=action===target?1:0;total++;
 }
 return correct/total;
}
const baseline01=run(false),adaptive01=run(true);console.log(JSON.stringify({baseline01,adaptive01,delta01:adaptive01-baseline01},null,2));
