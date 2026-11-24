import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const input=(v=.2)=>new Array(64).fill(v);

function train(branch, start, count, mode){
  for(let t=start;t<start+count;t++){
    const phase=mode==='A'?Math.sin(t*.35):mode==='B'?Math.cos(t*.29):Math.sin(t*.17)+Math.cos(t*.11);
    const reward=mode==='A' ? (phase>.15?.9:.2) : mode==='B' ? (phase>0?.2:.9) : .6+.25*Math.tanh(phase);
    const r=branch.beforeDecision({tick:t,input:input(phase*.35),baseUtilities:actions,predictionError01:.35,novelty01:.45,uncertainty01:.25,homeostasis01:.2,identityGap01:.2,goalPressure01:.55,personalityVector:[.2,.3,.4],identityVector:[.3,.2,.1],embodied:{sensorFeatures:input(phase*.25),sensors:{vision:{tick:t,values:[phase,.2,.1],freshness01:1,confidence01:1,ageTicks:0,source:'vision'},audio:{tick:t,values:[phase,.1,.2],freshness01:1,confidence01:1,ageTicks:0,source:'audio'}}}});
    branch.commitAction('verify',r.actionBias);
    branch.afterOutcome({tick:t,action:'verify',reward01:reward,predictionError01:1-reward,verified01:reward>.65?1:.2,nextInput:input(phase*.2),identityGap01:.1,goalPressure01:.5});
    if(t%2===0) branch.replay(4);
  }
}

const replay=new NeuralExperienceBranch();
train(replay,1,12,'A');
train(replay,13,12,'B');
train(replay,25,12,'A');
train(replay,37,12,'C');
train(replay,49,12,'A');
const replayMetrics=replay.continuityMetrics();
assert(replayMetrics.replayLearning.evaluated>0);
assert(replayMetrics.replayLearning.weightUpdates>0);
assert(Number.isFinite(replayMetrics.replayLearning.utilityGain01));
assert(replayMetrics.replayLearning.taskErrorAfter01 < replayMetrics.replayLearning.taskErrorBefore01, 'replay did not improve the measured holdout task error');

const lesionBranch=new NeuralExperienceBranch();
train(lesionBranch,1,8,'A');
const lesion=lesionBranch.lesion(.5);
assert(Number.isFinite(lesion.causalDrop01));
assert(Number.isFinite(lesion.behavioralDrop01));
assert(Number.isFinite(lesion.latentDrop01));
assert(lesion.recovery01>=.99);

const dev=new NeuralExperienceBranch();
const startScale=dev.continuityMetrics().developmentalPlasticity.scale01;
train(dev,1,16,'A');
const devMetrics=dev.continuityMetrics();
assert(devMetrics.developmentalPlasticity.scale01>=.70 && devMetrics.developmentalPlasticity.scale01<=1.30);
assert(devMetrics.developmentalPlasticity.scale01!==startScale);

console.log(JSON.stringify({pass:true,replay:replayMetrics.replayLearning,lesion,developmental:{before:startScale,after:devMetrics.developmentalPlasticity.scale01}},null,2));
