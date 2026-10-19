import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.27+i*.052]));
const vec=(task,t)=>Array.from({length:64},(_,k)=>{
  const phase=[.0,.73,1.61,2.47,3.19][task%5];
  return .37*Math.sin((k+1)*.063+t*.015+phase)+.19*Math.cos((k+5)*.041-t*.008-phase)+.055*task;
});
const identity=(task,t)=>Array.from({length:16},(_,k)=>Math.sin(k*.087+t*.009)+task*.17);

function run(enabled=true,meta=true){
  const b=new NeuralExperienceBranch();
  b.setExperimentalLayerEnabled(enabled);
  if(enabled && !meta)b.setSelfOptimizingContinualEnabled(false);
  for(let t=0;t<300;t++){
    const task=t<60?0:t<120?1:t<180?2:t<240?3:((t/15)|0)%5;
    const low=t%23===0||t%47===0;
    b.beforeDecision({tick:t,input:vec(task,t),baseUtilities:utilities,
      predictionError01:task===2?.34:task===4?.46:.19+.04*(task%2),novelty01:task===4?.71:task===3?.56:.22+.07*(task%3),
      uncertainty01:task===2?.49:low?.67:.28,homeostasis01:.44,identityGap01:.13+task*.025,goalPressure01:.31+task*.05,
      reward01:.56,identityVector:identity(task,t),embodied:{cpuLoad01:low?.95:.34,ramPressure01:low?.90:.28,battery01:low?.16:.84,sensorFreshness01:.94}
    });
    const action=task===2?'verify':task===3?'explore':task===4?'reflect':task===1?'respond':'respond';
    const reward=(task===0&&action==='respond')?.88:(task===1&&action==='respond')?.82:(task===2&&action==='verify')?.91:(task===3&&action==='explore')?.84:(task===4&&action==='reflect')?.86:.62;
    b.afterOutcome({tick:t+1,action,reward01:reward,predictionError01:1-reward,verified01:reward>.79?1:.74,nextInput:vec(task,t+1),holdout01:t%9===0?1:0,goalPressure01:.31+task*.05,identityGap01:.13+task*.025,identityVector:identity(task,t+1)});
  }
  for(let t=300;t<380;t++)b.microTick({tick:t,input:vec(t%5,t),action:t%3===0?'verify':t%2?'explore':'respond',reward01:.71,predictionError01:.26,verified01:.88,novelty01:.33,uncertainty01:.35,goalPressure01:.43,identityGap01:.17,worldConfidence01:.69,selfContinuity01:.83});
  return {b,d:b.diagnostics()};
}

const exp=run(true,true),p2724Only=run(true,false),ctl=run(false,false),m=exp.d.selfOptimizingContinual;
assert.equal(exp.d.version,25);
assert.ok(m.outcomes>=300);
assert.ok(m.contextVisits.filter(x=>x>0).length>=3,'meta contexts remained collapsed');
assert.ok(m.contextSwitches>=2,'meta boundary detector did not react to shifts');
assert.ok(m.fastLearning01>=.35 && m.fastLearning01<=.94);
assert.ok(m.metaLearning01>=.06 && m.metaLearning01<=.34);
assert.ok(m.ensembleDisagreement01>=0 && m.ensembleDisagreement01<=1);
assert.ok(m.replayFeedbackCount>100,'replay meta-controller received too little feedback');
assert.ok(m.replayArms.every(a=>a.pulls>0),'one or more replay arms never explored');
assert.ok(m.replayEntropy01>.70,'meta replay policy collapsed');
assert.ok(m.consolidations>0,'slow consolidation remained inert');
assert.ok(m.modelCalibration01>.45,'model calibration collapsed');
assert.ok(m.counterfactualGap01>=0,'counterfactual gap invalid');
const expMass=exp.d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
const ctlMass=ctl.d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
const p2724Mass=p2724Only.d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
assert.ok(Math.abs(expMass-ctlMass)>.01,'P2734 did not alter neural trajectory');
assert.ok(Math.abs(expMass-p2724Mass)>.0001,'P2734 ablation did not separate from P2724-only path');
const snap=exp.b.diagnostics();const resumed=new NeuralExperienceBranch();resumed.restore(snap);const rd=resumed.diagnostics();
assert.equal(rd.version,25);
assert.equal(rd.selfOptimizingContinual.outcomes,m.outcomes);
assert.ok(rd.selfOptimizingContinual.replayMix01.every((x,i)=>Math.abs(x-m.replayMix01[i])<1e-12));
assert.equal(rd.selfOptimizingContinual.consolidations,m.consolidations);

console.log(`P2734_SELF_OPTIMIZING_CONTINUAL=PASS outcomes=${m.outcomes} contexts=${m.contextVisits.filter(x=>x>0).length} switches=${m.contextSwitches} `+
`fast=${m.fastLearning01.toFixed(4)} meta=${m.metaLearning01.toFixed(4)} info=${m.informationValue01.toFixed(4)} ensemble=${m.ensembleDisagreement01.toFixed(4)} `+
`replayFeedback=${m.replayFeedbackCount} replayMix=${m.replayMix01.map(x=>x.toFixed(3)).join(',')} entropy=${m.replayEntropy01.toFixed(4)} `+
`consolidations=${m.consolidations} consGain=${m.consolidationGain01.toFixed(4)} regret=${m.counterfactualGap01.toFixed(4)} `+
`calibration=${m.modelCalibration01.toFixed(4)} trajectoryDiff=${Math.abs(expMass-ctlMass).toFixed(4)} p2724OnlyDiff=${Math.abs(expMass-p2724Mass).toFixed(4)} restartOutcomes=${rd.selfOptimizingContinual.outcomes}`);
