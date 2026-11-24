import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.25+i*.055]));
const vec=(task,t,shift=0)=>Array.from({length:64},(_,k)=>{
  const phase=[.0,1.25,2.6][task%3]+shift;
  return (.30+.04*shift)*Math.sin((k+1)*.069+t*.017+phase)+.15*Math.cos((k+7)*.043-t*.009-phase)+.05*task;
});
function run(meta=true){
  const b=new NeuralExperienceBranch(); b.setExperimentalLayerEnabled(true); if(!meta)b.setCausalPredictiveInterventionEnabled(false);
  const tasks=[];
  for(let t=0;t<240;t++){
    const sequential=t<180?(t/60|0):0;
    const interleave=t>=180?((t%4)<2?0:1):sequential;
    const task=t>=180?interleave:sequential;
    const shifted=t>=210?1.35:0;
    const sparse=t%5!==0;
    const action=task===0?'respond':task===1?'verify':'explore';
    const expected=task===0?.88:task===1?.91:.85;
    const observed=sparse?.58:expected+(t%13===0?-.09:0);
    const predErr=Math.abs(.92-observed);
    const novelty=task===2?.61:(t>=180?.49:.23);
    const uncertainty=t%17===0?.63:(t>=180?.41:.28);
    b.beforeDecision({tick:t,input:vec(task,t,shifted),baseUtilities:utilities,predictionError01:predErr,novelty01:novelty,uncertainty01:uncertainty,homeostasis01:.45,identityGap01:.12+task*.04,goalPressure01:.31+task*.05,reward01:observed,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.08+t*.006)+task*.15)});
    b.afterOutcome({tick:t+1,action,reward01:observed,predictionError01:predErr,verified01:observed>.78?1:.66,nextInput:vec(task,t+1,shifted),holdout01:sparse?0:1,goalPressure01:.31+task*.05,identityGap01:.12+task*.04});
    tasks.push(task);
  }
  const d=b.diagnostics(); const p=d.selfOptimizingContinual; const c=d.causalPredictiveIntervention;
  const capsuleScores=p.skillCapsules.map((row)=>row.reduce((s,x)=>s+x.success01,0)/row.length);
  return {b,d,p,c,capsuleScores,tasks};
}
const exp=run(true), ab=run(false);
assert.ok(exp.c.contextModels.filter(x=>x.visits>0).length>=3);
assert.ok(exp.c.contextSwitches>=2);
assert.ok(exp.p.contextSwitches>=2);
assert.ok(exp.c.highInformationOutcomes>0);
assert.ok(exp.p.replayFeedbackCount>150);
const expMean=exp.capsuleScores.reduce((a,b)=>a+b,0)/exp.capsuleScores.length;
const abMean=ab.capsuleScores.reduce((a,b)=>a+b,0)/ab.capsuleScores.length;
const activeCtx=exp.p.activeContextId;
const returnContext=exp.p.skillCapsules[activeCtx]?.reduce((s,x)=>s+x.success01,0)/(exp.p.skillCapsules[activeCtx]?.length||1);
assert.ok(returnContext>.45);
console.log(`P2742_INTERFERENCE_MATRIX=PASS outcomes=${exp.c.outcomes} causalContexts=${exp.c.contextModels.filter(x=>x.visits>0).length} causalSwitches=${exp.c.contextSwitches} `+
`metaSwitches=${exp.p.contextSwitches} highInfo=${exp.c.highInformationOutcomes} replayFeedback=${exp.p.replayFeedbackCount} `+
`returnContext=${returnContext.toFixed(4)} skillMean=${expMean.toFixed(4)} ablationSkillMean=${abMean.toFixed(4)} `+
`modelCalibration=${exp.c.modelCalibration01.toFixed(4)} counterfactualGap=${exp.c.counterfactualGap01.toFixed(4)}`);
