import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const vec=(x,phase,warp=0)=>Array.from({length:64},(_,k)=>Math.tanh(x*(.48+((k%11)-5)*.021)+Math.sin(phase*(.11+.003*(k%5))+k*.13+warp)*.035));
const target=(mode,phase)=>{
  if(mode==='A')return .22+.58*(.5+.5*Math.tanh(Math.sin(phase*.23)+.35*Math.cos(phase*.07)));
  if(mode==='B')return .68+.18*Math.tanh(Math.cos(phase*.19)-.2*Math.sin(phase*.04));
  if(mode==='C')return .48+.27*Math.tanh(Math.sin(phase*.09)+Math.cos(phase*.17)*.6);
  if(mode==='D')return .30+.48*(.5+.5*Math.tanh(Math.sin(phase*.27)+Math.sin(phase*.051)));
  return .50+.24*Math.tanh(Math.sin(phase*.137)+Math.cos(phase*.061)+Math.sin(phase*.023));
};
const spec=(mode,tick)=>{
  const offset=mode==='A'?0:mode==='B'?17:mode==='C'?31:mode==='D'?47:83;
  const phase=tick+offset;
  const x=mode==='A'?Math.sin(phase*.23):mode==='B'?Math.cos(phase*.19):mode==='C'?Math.sin(phase*.09)+Math.cos(phase*.17):mode==='D'?Math.sin(phase*.27)+Math.sin(phase*.051):Math.sin(phase*.137)+Math.cos(phase*.061)+Math.sin(phase*.023);
  return {phase,x,y:target(mode,phase)};
};

function train(branch,tick,mode,replay=true){
  const {phase,x,y}=spec(mode,tick);
  const r=branch.beforeDecision({tick,input:vec(x,phase,mode.charCodeAt(0)),baseUtilities:actions,predictionError01:.34,novelty01:mode==='D'?.52:.36,uncertainty01:mode==='D'?.33:.27,homeostasis01:.2,identityGap01:.14,goalPressure01:.54,personalityVector:[.2,.3,.4],identityVector:[.3,.2,.1],embodied:{sensorFeatures:vec(x*.72,phase,1),sensors:{vision:{tick,values:[x,.1,-x],freshness01:1,confidence01:1,ageTicks:0,source:'vision'},audio:{tick,values:[x*.7,.05,-x*.3],freshness01:1,confidence01:1,ageTicks:0,source:'audio'}}}});
  branch.commitAction('verify',r.actionBias);
  branch.afterOutcome({tick,action:'verify',reward01:y,predictionError01:Math.abs(y-r.prediction01),verified01:y>.60?1:.35,nextInput:vec(x*.8,phase+1,2),identityGap01:.10,goalPressure01:.50,holdout01:0});
  if(replay && tick%4===0) branch.replay(7);
}

function makeHoldout(mode,start,n=24){
  return Array.from({length:n},(_,i)=>{const tick=start+i,{phase,x,y}=spec(mode,tick);return {tick,input:vec(x+.13,phase+.41,5),actual01:y,baseUtilities:actions};});
}
function errSet(branch,modes,start){
  return Object.fromEntries(modes.map(m=>[m,branch.evaluateHoldout(makeHoldout(m,start))]));
}

const full=new NeuralExperienceBranch();
const noReplay=new NeuralExperienceBranch();
const noSlow=new NeuralExperienceBranch();
// This regression isolates P2853's slow-memory/replay behavior; P2854 hierarchy is
// exercised by its own benchmark and must not alter the historical P2853 signal.
full.setHierarchicalSlowMemoryEnabled(false);
noReplay.setHierarchicalSlowMemoryEnabled(false);
noSlow.setHierarchicalSlowMemoryEnabled(false);

const schedule=['A','B','C','A','D','A'];
let tick=1;
for(const mode of schedule){
  for(let i=0;i<20;i++,tick++){
    train(full,tick,mode,true);
    train(noReplay,tick,mode,false);
    train(noSlow,tick,mode,true);
    noSlow.setSlowMemoryConsolidationEnabled(false);
  }
}

const baselineA=full.evaluateHoldout(makeHoldout('A',tick));
const baselineANoReplay=noReplay.evaluateHoldout(makeHoldout('A',tick));
const transferD=full.evaluateHoldout(makeHoldout('D',tick));
const transferDNoReplay=noReplay.evaluateHoldout(makeHoldout('D',tick));
const independentH=full.evaluateHoldout(makeHoldout('H',tick));
const replayIndependentH=noReplay.evaluateHoldout(makeHoldout('H',tick));
const slowIndependentH=noSlow.evaluateHoldout(makeHoldout('H',tick));

const stateBefore=JSON.stringify(full.snapshot());
const repeated=full.evaluateHoldout(makeHoldout('H',tick+40));
const stateAfter=JSON.stringify(full.snapshot());
assert.equal(stateBefore,stateAfter,'holdout probe mutated neural state');
assert(Number.isFinite(baselineA.error01));
assert(Number.isFinite(transferD.error01));
assert(Number.isFinite(independentH.error01));
assert(full.continuityMetrics().slowMemoryConsolidation.updates>0,'slow memory controller never wrote');
assert(full.continuityMetrics().slowMemoryConsolidation.retrievals>0,'slow memory controller never retrieved');
assert(full.continuityMetrics().offlineConsolidation.cycles>0,'offline consolidation did not run');
assert(full.continuityMetrics().multiTimescalePlasticity.updates>=100,'multi-timescale learning did not run');
assert(independentH.error01<.75,'independent holdout became numerically unstable');

const fullDiag=full.continuityMetrics();
const relativeReplayGain=(replayIndependentH.error01-independentH.error01)/Math.max(.001,replayIndependentH.error01);
const slowMemoryGain=(slowIndependentH.error01-independentH.error01)/Math.max(.001,slowIndependentH.error01);
const forwardTransferGain01=(transferDNoReplay.error01-transferD.error01)/Math.max(.001,transferDNoReplay.error01);
const retentionA=baselineA.error01;
assert(forwardTransferGain01>.01,'replay lost the intended forward-transfer signal on D');
assert(slowMemoryGain>-.02,'slow-memory consolidation regressed the independent holdout by more than 2%');

console.log(JSON.stringify({
  pass:true,
  curriculum:schedule,
  holdout:{A:baselineA,A_noReplay:baselineANoReplay,D:transferD,D_noReplay:transferDNoReplay,H:independentH,H_noReplay:replayIndependentH,H_slowAblated:slowIndependentH,repeatedProbe:repeated},
  relativeReplayGain01:relativeReplayGain,
  forwardTransferGain01,
  slowMemoryGain01:slowMemoryGain,
  replay:fullDiag.replayLearning,
  slowMemory:fullDiag.slowMemoryConsolidation,
  offline:fullDiag.offlineConsolidation,
  plasticity:fullDiag.multiTimescalePlasticity,
  retentionA01:Math.max(0,1-retentionA),
  stateNonMutating:true,
},null,2));
