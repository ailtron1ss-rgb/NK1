import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
import assert from 'node:assert/strict';
const input=Array.from({length:64},(_,i)=>Math.sin(i*.17));
const base=Object.fromEntries(['respond','explore','verify','rest','reflect','wait','defer'].map(a=>[a,.5]));
const a=new NeuralExperienceBranch();
for(let t=1;t<=48;t++){
  a.beforeDecision({tick:t,input:input.map((x,i)=>x+Math.sin(t*.03+i*.01)*.02),baseUtilities:base,predictionError01:.2+.1*Math.abs(Math.sin(t*.04)),novelty01:.45+.25*Math.abs(Math.sin(t*.05)),uncertainty01:.32+.2*Math.abs(Math.cos(t*.03)),homeostasis01:.7,identityGap01:.2,goalPressure01:.5,reward01:t%3===0?.82:.44});
  a.commitAction(t%2?'explore':'verify',base);
  a.afterOutcome({tick:t,action:t%2?'explore':'verify',reward01:t%3===0?.82:.44,predictionError01:.2+.1*Math.abs(Math.sin(t*.04)),verified01:t%4===0?1:0,nextInput:input,holdout01:t%5===0?1:0,identityGap01:.2,goalPressure01:.5});
}
const before=a.continuityMetrics();
const snap=a.snapshot();
const b=new NeuralExperienceBranch();
b.restore(snap);
const after=b.continuityMetrics();
assert.equal(after.learnedPolicyUpdates,before.learnedPolicyUpdates);
assert.equal(after.memoryCount,before.memoryCount);
assert(Math.abs(after.antiForgetting01-before.antiForgetting01)<1e-12);
assert(after.horizonErrors.every(Number.isFinite));
console.log('B2550_NEURAL_BRANCH_RESTART_PASS',JSON.stringify({memoryCount:after.memoryCount,learnedPolicyUpdates:after.learnedPolicyUpdates,antiForgetting01:after.antiForgetting01,horizonErrors:after.horizonErrors},null,2));
