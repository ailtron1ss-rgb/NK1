import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.33+i*.045]));
const vector=(task,t)=>Array.from({length:64},(_,k)=> task===0
  ? Math.sin((k+2)*.07+t*.021)*.42
  : Math.cos((k+5)*.061+t*.019)*.40+Math.sin(k*.12)*.08);
const score=(bias,action)=>bias[action]-Math.max(...actions.filter(a=>a!==action).map(a=>bias[a]));

const train=(experimental)=>{
  const b=new NeuralExperienceBranch(); b.setExperimentalLayerEnabled(experimental); b.setSelfNormalizationStrength(experimental?.45:0);
  let preA=0,preB=0,postA=0,postB=0,interleave=0;
  const decision=(task,tick)=>b.beforeDecision({tick,input:vector(task,tick),baseUtilities:utilities,predictionError01:task?.24:.18,novelty01:task?.52:.25,uncertainty01:task?.38:.19,homeostasis01:.45,identityGap01:task?.30:.18,goalPressure01:task?.47:.35,reward01:.6,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.13+tick*.01)+task*.15)});
  for(let t=0;t<64;t++){const r=decision(0,t);if(t>=48)preA+=score(r.actionBias,'respond');b.afterOutcome({tick:t+1,action:'respond',reward01:.82,predictionError01:.12,verified01:1,nextInput:vector(0,t+1),holdout01:t%2===0?1:0,goalPressure01:.35,identityGap01:.18});}
  for(let t=0;t<64;t++){const r=decision(1,100+t);if(t>=48)preB+=score(r.actionBias,'explore');b.afterOutcome({tick:65+t,action:'explore',reward01:.80,predictionError01:.14,verified01:1,nextInput:vector(1,t+1),holdout01:t%2===0?1:0,goalPressure01:.47,identityGap01:.30});}
  for(let t=0;t<24;t++){postA+=score(decision(0,220+t).actionBias,'respond');postB+=score(decision(1,260+t).actionBias,'explore');}
  for(let t=0;t<32;t++){const task=t%2;const r=decision(task,320+t);interleave+=score(r.actionBias,task?'explore':'respond');b.afterOutcome({tick:313+t,action:task?'explore':'respond',reward01:.78,predictionError01:.20,verified01:.9,nextInput:vector(task,t+1),goalPressure01:task?.47:.35,identityGap01:task?.30:.18});}
  const d=b.diagnostics();
  return {preA:preA/16,preB:preB/16,postA:postA/24,postB:postB/24,forgettingA:Math.max(0,preA/16-postA/24),forgettingB:Math.max(0,preB/16-postB/24),interleave:interleave/32,taskShift:d.deepIntegration.taskShift01,interference:d.deepIntegration.interference01,protected:d.deepIntegration.protectedMass01,delayConsensus:d.deepIntegration.delayConsensus01,phase:d.deepIntegration.phase,trajectory:d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0)};
};
const exp=train(true),ctl=train(false);
for(const r of [exp,ctl]) for(const [k,v] of Object.entries(r)) if(typeof v==='number') assert.ok(Number.isFinite(v),`nonfinite ${k}`);
assert.ok(exp.protected>.15);
assert.ok(exp.taskShift>=0 && exp.taskShift<=1);
assert.ok(Math.abs(exp.trajectory-ctl.trajectory)>.01);
console.log(`P2716_CONTINUAL_BATTERY=PASS expForgetA=${exp.forgettingA.toFixed(4)} ctlForgetA=${ctl.forgettingA.toFixed(4)} expForgetB=${exp.forgettingB.toFixed(4)} ctlForgetB=${ctl.forgettingB.toFixed(4)} interleave=${exp.interleave.toFixed(4)} shift=${exp.taskShift.toFixed(4)} interference=${exp.interference.toFixed(4)} protected=${exp.protected.toFixed(4)} phase=${exp.phase} delayConsensus=${exp.delayConsensus.toFixed(4)} trajectoryDiff=${Math.abs(exp.trajectory-ctl.trajectory).toFixed(4)}`);
