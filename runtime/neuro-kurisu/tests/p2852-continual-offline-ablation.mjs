import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const vec=(x,phase=0)=>Array.from({length:64},(_,k)=>Math.tanh(x*(0.55+((k%7)-3)*.03)+Math.sin(phase+k*.17)*.02));
const target=(mode,phase)=>mode==='A' ? (.78+.18*Math.tanh(Math.sin(phase*.31))) : mode==='B' ? (.24+.18*Math.tanh(Math.cos(phase*.27))) : (.55+.20*Math.tanh(Math.sin(phase*.13)+Math.cos(phase*.07)));

function step(branch,t,mode,doReplay){
  const phase=t+(mode==='B'?7:mode==='C'?13:0);
  const x=mode==='A'?Math.sin(phase*.31):mode==='B'?Math.cos(phase*.27):Math.sin(phase*.13)+Math.cos(phase*.07);
  const y=target(mode,phase);
  const r=branch.beforeDecision({tick:t,input:vec(x,phase),baseUtilities:actions,predictionError01:.38,novelty01:.42,uncertainty01:.28,homeostasis01:.2,identityGap01:.16,goalPressure01:.56,personalityVector:[.2,.3,.4],identityVector:[.3,.2,.1],embodied:{sensorFeatures:vec(x*.8,phase),sensors:{vision:{tick:t,values:[x,.2,-x],freshness01:1,confidence01:1,ageTicks:0,source:'vision'},audio:{tick:t,values:[x*.8,.1,-x*.4],freshness01:1,confidence01:1,ageTicks:0,source:'audio'}}}});
  branch.commitAction('verify',r.actionBias);
  branch.afterOutcome({tick:t,action:'verify',reward01:y,predictionError01:Math.abs(y-r.prediction01),verified01:y>.60?1:.25,nextInput:vec(x*.8,phase+1),identityGap01:.12,goalPressure01:.52,holdout01:0});
  if(doReplay && t%3===0) branch.replay(6);
}

function holdout(branch,start,mode,n=16){
  let error=0;
  for(let i=0;i<n;i++){
    const t=start+i;
    const phase=t+(mode==='B'?7:mode==='C'?13:0);
    const x=mode==='A'?Math.sin(phase*.31):mode==='B'?Math.cos(phase*.27):Math.sin(phase*.13)+Math.cos(phase*.07);
    const y=target(mode,phase);
    const r=branch.beforeDecision({tick:t,input:vec(x+.11,phase+.37),baseUtilities:actions,predictionError01:.35,novelty01:.30,uncertainty01:.24,homeostasis01:.2,identityGap01:.16,goalPressure01:.56});
    error+=Math.abs(y-r.prediction01);
  }
  return error/n;
}

const replay=new NeuralExperienceBranch();
const noReplay=new NeuralExperienceBranch();
for(let t=1;t<=144;t++){
  const mode=t<=36?'A':t<=72?'B':t<=108?'C':'A';
  step(replay,t,mode,true);
  step(noReplay,t,mode,false);
}
const replayHoldout=holdout(replay,145,'A',18);
const noReplayHoldout=holdout(noReplay,145,'A',18);
const replayDiag=replay.continuityMetrics();
assert(replayDiag.replayLearning.evaluated>0);
assert(replayDiag.offlineConsolidation.replaySamples>0);
assert(replayDiag.offlineConsolidation.cycles>0);
assert(replayDiag.multiTimescalePlasticity.updates>100);
assert(replayDiag.replayLearning.weightUpdates>0);

const ablation=replay.ablationMatrix({tick:300,input:vec(.3,300),baseUtilities:actions,predictionError01:.25,novelty01:.35,uncertainty01:.2,homeostasis01:.2,identityGap01:.12,goalPressure01:.5});
assert(ablation.ablations.length>=6,'ablation matrix lost required mechanisms');
assert(ablation.ablations.some(x=>x.label==='contextualActionPolicy'),'contextual policy ablation missing');
assert(ablation.ablations.some(x=>x.compositeDrop01>.01),'all ablations were functionally inert');
assert(ablation.recovery01>.95,'ablation recovery regressed');

const phaseProbe=new NeuralExperienceBranch();
const phases=new Set();
for(const t of [24,60,72,84,120]){step(phaseProbe,t,'A',true); phases.add(phaseProbe.continuityMetrics().offlineConsolidation.phase);}
assert(phases.size>=2,'offline consolidation never changed phase');

const snap=replay.snapshot();
const restored=new NeuralExperienceBranch();
restored.restore(snap);
const rd=restored.continuityMetrics();
assert.equal(rd.offlineConsolidation.replaySamples,replayDiag.offlineConsolidation.replaySamples,'offline consolidation persistence failed');
assert.equal(rd.multiTimescalePlasticity.updates,replayDiag.multiTimescalePlasticity.updates,'multiscale plasticity persistence failed');
assert(replayHoldout < .60 && noReplayHoldout < .60,'holdout error unexpectedly saturated');

console.log(JSON.stringify({
  pass:true,
  continual:{replayHoldout,noReplayHoldout,relativeGain01:Math.max(-1,Math.min(1,(noReplayHoldout-replayHoldout)/Math.max(.0001,noReplayHoldout)))},
  offline:replayDiag.offlineConsolidation,
  multiscale:replayDiag.multiTimescalePlasticity,
  replay:replayDiag.replayLearning,
  ablation,
  phases:[...phases],
  persisted:true
},null,2));
