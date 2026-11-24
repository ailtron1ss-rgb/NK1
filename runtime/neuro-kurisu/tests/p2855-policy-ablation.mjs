import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const U=Object.fromEntries(A.map(a=>[a,.5]));
const target=ctx=>ctx%5;
const cue=(ctx,t)=>Array.from({length:64},(_,i)=>Math.max(-1,Math.min(1,Math.sin(i*.17+ctx*.91+t*.013)*.58+(i<12?ctx*.035:0))));
const pick=b=>A.reduce((best,a)=>b[a]>b[best]?a:best,A[0]);
const run=enabled=>{
  const b=new NeuralExperienceBranch();
  b.setContextualActionPolicyEnabled(enabled);
  let correct=0,total=0;
  for(let t=1;t<=180;t++){
    const ctx=t%5,v=cue(ctx,t);
    const out=b.beforeDecision({tick:t,input:v,baseUtilities:U,predictionError01:.1,novelty01:.12,uncertainty01:.15,homeostasis01:.2,identityGap01:.18,goalPressure01:.35,embodied:{sensorFeatures:v,sensorFreshness01:.96,battery01:.92,cpuLoad01:.18,ramPressure01:.16,thermalStrain01:.08}});
    const action=pick(out.actionBias);
    if(t>90){if(A.indexOf(action)===target(ctx))correct++;total++;}
    const reward=A.indexOf(action)===target(ctx)?1:.05;
    b.commitAction(action,out.actionBias);
    b.afterOutcome({tick:t,action,reward01:reward,predictionError01:.1,verified01:.95,nextInput:cue(ctx,t+1),identityGap01:.18,goalPressure01:.35,embodied:{nextFeatures:cue(ctx,t+1),sensorFreshness01:.96}});
  }
  return {accuracy01:correct/total,metrics:b.continuityMetrics().contextualActionPolicy};
};
const on=run(true),off=run(false);
assert.ok(on.metrics.updates>0);
assert.equal(off.metrics.updates,0);
assert.ok(on.accuracy01>off.accuracy01+.04,`policy ablation effect too small: on=${on.accuracy01}, off=${off.accuracy01}`);
console.log(JSON.stringify({
  policyOnAccuracy01:on.accuracy01,
  policyOffAccuracy01:off.accuracy01,
  absoluteGain01:on.accuracy01-off.accuracy01,
  policyUpdates:on.metrics.updates,
  policySelections:on.metrics.selections,
  policyConfidence01:on.metrics.confidence01,
  policyMemoryKB:on.metrics.memoryKB,
  offUpdates:off.metrics.updates
},null,2));
