import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=x=>Math.max(0,Math.min(1,x));
const branch=new NeuralExperienceBranch(); branch.restore(defaultNeuralExperienceBranch());
const base=Array.from({length:64},(_,i)=>Math.sin(i*.17));
let trainCorrect=0,trainN=0,shiftCorrect=0,shiftN=0;
for(let t=1;t<=720;t++){
  const shifted=t>480;
  const phase=shifted?1.7:.0;
  const input=base.map((v,i)=>Math.tanh(v*Math.sin(t*.041+phase)+Math.cos(i*.09+t*.013)*.12));
  const target=clamp(.5+.35*Math.tanh(input[3]*1.7-input[17]*1.2+input[41]*.9));
  const f=branch.beforeDecision({tick:t,input,baseUtilities:Object.fromEntries(A.map(a=>[a,.5])),predictionError01:.18,novelty01:shifted?.65:.25,uncertainty01:shifted?.55:.25,homeostasis01:.3,identityGap01:.2,goalPressure01:.4,reward01:target});
  const pred=f.prediction01;
  if(shifted){shiftN++; if((pred>.5)===(target>.5))shiftCorrect++;} else {trainN++; if((pred>.5)===(target>.5))trainCorrect++;}
  branch.commitAction(A[t%A.length],Object.fromEntries(A.map(a=>[a,.5])));
  branch.afterOutcome({tick:t,action:A[t%A.length],reward01:target,predictionError01:Math.abs(target-pred),verified01:shifted?1:.5,nextInput:input,holdout01:shifted?1:0,identityGap01:.2,goalPressure01:.4});
  if(t%12===0)branch.replay(10);
}
const d=branch.diagnostics();
const trainAcc=trainCorrect/trainN,shiftAcc=shiftCorrect/shiftN;
if(d.contractVersion!==1) throw new Error('contract');
if(d.edgeTargets.length!==d.neurons || d.edgeTargets.some(r=>r.length!==12)) throw new Error('sparse graph');
if(d.edgeDelays.some(r=>r.some(x=>x<1||x>3))) throw new Error('delay bounds');
if(d.delayLearningUpdates<10) throw new Error('delay learning inactive');
if(d.computeCost01>.5) throw new Error('compute budget');
console.log('B2523_NEURAL_SPACE_DISTRIBUTION_SHIFT_PASS',JSON.stringify({trainAcc,shiftAcc,shiftN,delayLearningUpdates:d.delayLearningUpdates,neurons:d.neurons,edges:d.neurons*12,denseEdges:d.neurons*d.neurons,compression01:1-(d.neurons*12)/(d.neurons*d.neurons),inhibition01:d.inhibition01,coherence01:d.coherence01,computeCost01:d.computeCost01}));
