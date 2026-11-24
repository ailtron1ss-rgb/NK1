import assert from 'node:assert/strict';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const variants=[
  ['A-baseline',0,false,false],
  ['B-online',.65,false,false],
  ['C-cascade',.65,true,false],
  ['D-cascade-replay',.65,true,true],
  ['E-cascade-high',.85,true,true],
  ['F-cascade-low',.35,true,true],
];
function run([name,mix,experimental,replay]){
  const b=new NeuralExperienceBranch();
  const d=defaultNeuralExperienceBranch(); d.onlineCreditMix01=mix; b.restore(d); b.setExperimentalLayerEnabled(experimental);
  for(let tick=1;tick<=96;tick++){
    const phase=tick%24;
    const cue=phase===1||phase===2||phase===13;
    const action=phase%5===0?'verify':(cue?'explore':'wait');
    const novelty=cue?.72:(phase===7?.55:.10);
    const uncertainty=cue?.68:(phase===17?.74:.28);
    const delayed=(phase===12||phase===24);
    const reward=delayed?.94:(phase===6?.22:(cue?.56:.46));
    const error=1-reward;
    b.beforeDecision({tick,input:new Array(64).fill(cue?.82:(phase===7?.31:.04)),baseUtilities:actions,predictionError01:error,novelty01:novelty,uncertainty01:uncertainty,homeostasis01:.24,identityGap01:.2,goalPressure01:.58,reward01:.5,holdout01:tick>48&&tick%3===0?1:0,identityVector:new Array(24).fill(.2)});
    b.commitAction(action,actions);
    b.afterOutcome({tick,action,reward01:reward,predictionError01:error,verified01:delayed?1:(action==='verify'&&phase%4===0?1:0),nextInput:new Array(64).fill(delayed?.71:(cue?.12:.05)),identityGap01:.15,goalPressure01:.58,holdout01:tick>48&&tick%3===0?1:0,identityVector:new Array(24).fill(.25)});
    if(replay && tick%8===0)b.replay(8);
  }
  const s=b.snapshot();
  const weightAbs=s.edgeWeights.flat().reduce((a,v)=>a+Math.abs(v),0);
  return {name,s,weightAbs,weightMean:weightAbs/(s.neurons*12)};
}
const rows=variants.map(run);
const base=rows[0];
for(const r of rows){
  assert(r.s.edgeWeights.flat().every(Number.isFinite));
  assert(r.s.cascadeEligibilityMid.flat().every(Number.isFinite));
  assert(r.s.cascadeEligibilitySlow.flat().every(Number.isFinite));
  assert(r.s.astroGate.every(Number.isFinite));
  assert(r.s.generalization01>=0 && r.s.generalization01<=1);
  assert(r.s.adaptiveCreditMix01>=.35 && r.s.adaptiveCreditMix01<=.92);
}
const out=rows.map(r=>({
  variant:r.name,
  deltaWeightL1:+r.s.edgeWeights.flat().reduce((sum,w,i)=>sum+Math.abs(w-base.s.edgeWeights.flat()[i]??0),0).toFixed(5),
  meanAbsWeight:+r.weightMean.toFixed(5),
  generalization:+r.s.generalization01.toFixed(4),
  replayDiversity:+r.s.replayDiversity01.toFixed(4),
  adaptiveMix:+r.s.adaptiveCreditMix01.toFixed(4),
  astroGate:+r.s.astroGateMean01.toFixed(4),
  longDelayCredit:+r.s.longDelayCredit01.toFixed(4),
  cascadeUpdates:r.s.cascadeCreditUpdates
}));
console.log('P2707_FACTORIAL_LEARNING_BENCHMARK=PASS');
console.log(JSON.stringify(out,null,2));
