import { performance } from 'node:perf_hooks';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const baseUtilities=Object.fromEntries(actions.map(a=>[a,.5]));
const input=new Array(64).fill(0).map((_,i)=>Math.sin(i*.17)*.3);
const branch=new NeuralExperienceBranch();
const before=process.memoryUsage().heapUsed;
const t0=performance.now();
for(let t=1;t<=1200;t++){
  branch.beforeDecision({tick:t,input,baseUtilities,predictionError01:.2,novelty01:(t%19)/19,uncertainty01:.25,homeostasis01:.2,identityGap01:.1,goalPressure01:.3,reward01:.5});
  branch.commitAction(actions[t%actions.length],baseUtilities);
  branch.afterOutcome({tick:t,action:actions[t%actions.length],reward01:t%3===0?1:.35,predictionError01:(t%11)/11,verified01:t%4===0?1:0,nextInput:input,identityGap01:.1,goalPressure01:.3});
  if(t%16===0) branch.replay(6);
}
const elapsed=performance.now()-t0;
const after=process.memoryUsage().heapUsed;
const d=branch.diagnostics();
const cyclesPerSec=1200/(elapsed/1000);
if(!Number.isFinite(cyclesPerSec)||d.cycles!==1200||d.learningUpdates!==1200)throw new Error('performance-benchmark-failed');
console.log('B2525_NEURAL_LEARNING_PERFORMANCE_PASS',JSON.stringify({cycles:d.cycles,elapsedMs:Number(elapsed.toFixed(2)),cyclesPerSec:Number(cyclesPerSec.toFixed(1)),heapDeltaMB:Number(((after-before)/1024/1024).toFixed(2)),computeCost01:d.computeCost01,eligibilityUpdates:d.eligibilityUpdates}));
