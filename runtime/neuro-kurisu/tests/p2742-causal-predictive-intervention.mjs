import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map((a,i)=>[a,.24+i*.06]));
const vec=(task,t)=>Array.from({length:64},(_,k)=>{
  const phase=[.0,.8,1.7,2.9,4.1,5.0][task%6];
  return .31*Math.sin((k+1)*.071+t*.021+phase)+.16*Math.cos((k+3)*.039-t*.011-phase)+.045*task+.02*Math.sin(t*.07);
});
function run(mode){
  const b=new NeuralExperienceBranch();
  b.setExperimentalLayerEnabled(true);
  if(mode==='p2734') b.setCausalPredictiveInterventionEnabled(false);
  if(mode==='control') b.setExperimentalLayerEnabled(false);
  for(let t=0;t<420;t++){
    const task=t<70?0:t<140?1:t<210?2:t<280?3:t<350?4:(t%36>17?5:1);
    const highInfo=task===5||t%41===0;
    b.beforeDecision({tick:t,input:vec(task,t),baseUtilities:base,
      predictionError01:highInfo?.58:(task===2?.41:.17+.035*(task%3)),
      novelty01:highInfo?.76:(task===3?.61:.20+.08*(task%4)),
      uncertainty01:highInfo?.72:(task===2?.55:.27+.04*(task%2)),homeostasis01:.46,
      identityGap01:.11+task*.024,goalPressure01:.28+task*.047,reward01:.54,
      identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.09+t*.008)+task*.13),
      embodied:{cpuLoad01:highInfo?.91:.31,ramPressure01:highInfo?.84:.26,battery01:highInfo?.19:.82,sensorFreshness01:.95}
    });
    let action=task===2?'verify':task===3?'explore':task===4?'reflect':'respond';
    if(task===5) action=(t%2?'verify':'explore');
    const reward=(task===0&&action==='respond')?.88:(task===1&&action==='respond')?.83:(task===2&&action==='verify')?.93:(task===3&&action==='explore')?.86:(task===4&&action==='reflect')?.89:(task===5&&['verify','explore'].includes(action))?.82:.58;
    b.afterOutcome({tick:t+1,action,reward01:reward,predictionError01:1-reward,verified01:reward>.8?1:.72,nextInput:vec(task,t+1),holdout01:t%11===0?1:0,goalPressure01:.28+task*.047,identityGap01:.11+task*.024});
  }
  for(let t=420;t<520;t++) b.microTick({tick:t,input:vec(t%6,t),action:t%4===0?'verify':t%2?'explore':'respond',reward01:.73,predictionError01:.23,verified01:.9,novelty01:.38,uncertainty01:.34,goalPressure01:.44,identityGap01:.17,worldConfidence01:.75,selfContinuity01:.84});
  return {b,d:b.diagnostics()};
}

const exp=run('full'), p2734=run('p2734'), ctl=run('control');
const m=exp.d.causalPredictiveIntervention;
assert.ok(m.outcomes>=400,'P2742 did not learn outcomes');
assert.ok(m.contextModels.filter(x=>x.visits>0).length>=3,'context model collapsed');
assert.ok(m.interventionCount>20,'no epistemic interventions occurred');
assert.ok(m.highInformationOutcomes>0,'no high-information outcomes recorded');
assert.ok(m.actions.filter(a=>a.samples>0).length>=4,'too few action models received real outcomes');
assert.ok(m.modelCalibration01>.35,'model calibration collapsed');
assert.ok(m.transitionConfidence01>.05,'transition confidence never developed');
assert.ok(m.informationGain01>.15,'information gain remained inert');
assert.ok(m.replayUtility01>=0 && m.replayUtility01<=1);
assert.ok(m.planningDepth>=1 && m.planningDepth<=3);
const mass=(d)=>d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
const fullMass=mass(exp.d),p2734Mass=mass(p2734.d),ctlMass=mass(ctl.d);
assert.ok(Math.abs(fullMass-p2734Mass)>.0001,'P2742 ablation produced no neural trajectory separation');
assert.ok(Math.abs(fullMass-ctlMass)>.01,'full path did not separate from control');
const replayUsed=exp.d.selfOptimizingContinual.replayFeedbackCount;
assert.ok(replayUsed>150,'replay feedback chain weakened');
const snap=exp.b.diagnostics();
const resumed=new NeuralExperienceBranch();resumed.restore(snap);const rd=resumed.diagnostics();
assert.equal(rd.causalPredictiveIntervention.outcomes,m.outcomes);
assert.equal(rd.causalPredictiveIntervention.selectedContextId,m.selectedContextId);
assert.ok(Math.abs(rd.causalPredictiveIntervention.modelCalibration01-m.modelCalibration01)<1e-12);
console.log(`P2742_CAUSAL_PREDICTIVE_INTERVENTION=PASS outcomes=${m.outcomes} contexts=${m.contextModels.filter(x=>x.visits>0).length} switches=${m.contextSwitches} `+
`interventions=${m.interventionCount} highInfo=${m.highInformationOutcomes} info=${m.informationGain01.toFixed(4)} transConf=${m.transitionConfidence01.toFixed(4)} `+
`calibration=${m.modelCalibration01.toFixed(4)} cfGap=${m.counterfactualGap01.toFixed(4)} replayUtility=${m.replayUtility01.toFixed(4)} `+
`planningDepth=${m.planningDepth} p2742Diff=${Math.abs(fullMass-p2734Mass).toFixed(4)} ctlDiff=${Math.abs(fullMass-ctlMass).toFixed(4)} restart=${rd.causalPredictiveIntervention.outcomes}`);
