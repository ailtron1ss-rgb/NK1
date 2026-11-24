import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(A.map(a=>[a,.5]));
const vector=(ctx,t)=>Array.from({length:64},(_,i)=>Math.max(-1,Math.min(1,Math.sin(ctx*.71+i*.13+t*.017)*.55+(i%7===ctx?.11:0))));
const pick=(bias)=>A.reduce((best,a)=>bias[a]>bias[best]?a:best,A[0]);
const branch=new NeuralExperienceBranch();
for(let t=1;t<=84;t++){
  const ctx=t%5;
  const input=vector(ctx,t);
  const out=branch.beforeDecision({tick:t,input,baseUtilities:utilities,predictionError01:.12,novelty01:.16,uncertainty01:.18,homeostasis01:.25,identityGap01:.18,goalPressure01:.42,embodied:{sensorFeatures:input,sensorFreshness01:.95,battery01:.9,cpuLoad01:.2,ramPressure01:.18,thermalStrain01:.1}});
  const action=pick(out.actionBias);
  branch.commitAction(action,out.actionBias);
  branch.afterOutcome({tick:t,action,reward01:.72,predictionError01:.12,verified01:.95,nextInput:vector(ctx,t+1),identityGap01:.18,goalPressure01:.42,embodied:{nextFeatures:vector(ctx,t+1),sensorFreshness01:.95}});
}
const m=branch.continuityMetrics();
assert.ok(m.contextualActionPolicy.updates>=84);
assert.ok(m.contextualActionPolicy.selections>=84);
assert.ok(m.contextualActionPolicy.confidence01>.2);
const snap=branch.snapshot();
const restored=new NeuralExperienceBranch();restored.restore(snap);
const rm=restored.continuityMetrics();
assert.deepEqual(rm.contextualActionPolicy, m.contextualActionPolicy);
console.log(JSON.stringify({
  cycles:restored.diagnostics().cycles,
  policyUpdates:rm.contextualActionPolicy.updates,
  policySelections:rm.contextualActionPolicy.selections,
  confidence01:rm.contextualActionPolicy.confidence01,
  rewardEMA01:rm.contextualActionPolicy.rewardEMA01,
  memoryKB:rm.contextualActionPolicy.memoryKB,
  persisted:true
},null,2));
