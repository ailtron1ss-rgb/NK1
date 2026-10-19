import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.30+i*.06]));
const vector=(task,t)=>Array.from({length:64},(_,k)=>task===0?Math.sin((k+2)*.09+t*.025)*.4:Math.cos((k+5)*.07+t*.031)*.4);
const train=(experimental)=>{
  const b=new NeuralExperienceBranch(); b.setExperimentalLayerEnabled(experimental); b.setSelfNormalizationStrength(experimental?.45:0);
  const evalTask=(task,tick)=>{const r=b.beforeDecision({tick,input:vector(task,tick),baseUtilities:utilities,predictionError01:.22,novelty01:.28,uncertainty01:.22,homeostasis01:.45,identityGap01:.2,goalPressure01:.4,reward01:.6});return r.actionBias;};
  const score=(bias,action)=>bias[action]-Math.max(...actions.filter(a=>a!==action).map(a=>bias[a]));
  let preA=0,preB=0;
  for(let t=0;t<48;t++){const action='respond';const bias=evalTask(0,t);if(t>=40)preA+=score(bias,action);b.afterOutcome({tick:t+1,action,reward01:.82,predictionError01:.12,verified01:1,nextInput:vector(0,t+1),holdout01:t%2===0?1:0,goalPressure01:.4,identityGap01:.2});}
  for(let t=0;t<48;t++){const action='explore';const bias=evalTask(1,100+t);if(t>=40)preB+=score(bias,action);b.afterOutcome({tick:49+t,action,reward01:.82,predictionError01:.14,verified01:1,nextInput:vector(1,t+1),holdout01:t%2===0?1:0,goalPressure01:.45,identityGap01:.2});}
  let postA=0,postB=0;
  for(let t=0;t<12;t++){postA+=score(evalTask(0,200+t),'respond');postB+=score(evalTask(1,300+t),'explore');}
  const d=b.diagnostics();
  return {preA:preA/8,preB:preB/8,postA:postA/12,postB:postB/12,forgettingA:Math.max(0,(preA/8)-(postA/12)),generalization:d.generalization01,normalization:d.deepLearningCoupler.normalizationUpdates,trajectory:d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0)};
};
const exp=train(true),ctl=train(false);
for(const r of [exp,ctl]) for(const k of Object.keys(r)) assert.ok(Number.isFinite(r[k]),`nonfinite ${k}`);
assert.ok(exp.normalization>0);
assert.ok(Math.abs(exp.trajectory-ctl.trajectory)>.01);
assert.ok(exp.forgettingA>=0 && ctl.forgettingA>=0);
console.log(`P2708_CONTINUAL_FACTORIAL=PASS expForgettingA=${exp.forgettingA.toFixed(4)} ctlForgettingA=${ctl.forgettingA.toFixed(4)} expGeneralization=${exp.generalization.toFixed(4)} ctlGeneralization=${ctl.generalization.toFixed(4)} trajectoryDiff=${Math.abs(exp.trajectory-ctl.trajectory).toFixed(4)}`);
