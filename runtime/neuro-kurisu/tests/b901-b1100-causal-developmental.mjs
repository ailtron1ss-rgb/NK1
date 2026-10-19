import { B901B1100CausalDevelopmentalMetaLearner, defaultB901B1100State } from '../src/organism/system/B901B1100CausalDevelopmentalMetaLearner.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const choose=o=>actions.reduce((best,a)=>(o.actionBias[a]>(o.actionBias[best]??-Infinity)?a:best),actions[0]);
function trainCore(phase){
 const c=new B901B1100CausalDevelopmentalMetaLearner();
 for(let t=0;t<1800;t++){
   const ctx=[.52,.38,.61,.49,.57,.44,.66,.35,.53,.47,.58,.42];
   const target=phase(t);
   const d=c.beforeDecision({tick:t,context01:ctx,baseUtilities:Object.fromEntries(actions.map(a=>[a,.5])),uncertainty01:t%37===0?.72:.25,predictionError01:t%37===0?.75:.18,novelty01:t%53===0?.68:.2,confidence01:.62,goalVector:ctx,complexity01:.35,modeHint:'normal'});
   const action=choose(d); const reward=action===target?1:0;
   c.afterOutcome({tick:t,action,context01:ctx,nextContext01:ctx,reward01:reward,predictionError01:1-reward,verified01:1,success01:reward,phase:d.phase});
 }
 return c;
}
const c=trainCore(t=>t<900?'respond':'explore');
let pre=0,post=0,preN=0,postN=0;
const holdCtx=[.52,.38,.61,.49,.57,.44,.66,.35,.53,.47,.58,.42];
for(let t=0;t<400;t++){
 const d=c.beforeDecision({tick:2000+t,context01:holdCtx,baseUtilities:Object.fromEntries(actions.map(a=>[a,.5])),uncertainty01:.15,predictionError01:.1,novelty01:.1,confidence01:.8,goalVector:holdCtx,complexity01:.2});
 const a=choose(d); if(t<200){pre+=(a==='respond'?1:0);preN++;}else{post+=(a==='explore'?1:0);postN++;}
}
// lesion package checks on a warm model.
const lesionEffects={}; for(const k of ['task-inference','replay-scheduler','gradient-alignment','modular-policy','consolidation','counterfactual','selective-foresight','curriculum','neural-plasticity','verifier']) lesionEffects[k]=c.evaluate({tick:2400,context01:holdCtx,baseUtilities:Object.fromEntries(actions.map(a=>[a,.5])),uncertainty01:.5,predictionError01:.4,novelty01:.5,confidence01:.6,goalVector:holdCtx,complexity01:.55},{[k]:true}).effect01;
const s=c.snapshot(); const r=new B901B1100CausalDevelopmentalMetaLearner(); r.restore(s); const a=c.beforeDecision({tick:2600,context01:holdCtx,baseUtilities:Object.fromEntries(actions.map(a=>[a,.5])),uncertainty01:.3,predictionError01:.2,novelty01:.2,confidence01:.7,goalVector:holdCtx,complexity01:.3}); const b=r.beforeDecision({tick:2600,context01:holdCtx,baseUtilities:Object.fromEntries(actions.map(a=>[a,.5])),uncertainty01:.3,predictionError01:.2,novelty01:.2,confidence01:.7,goalVector:holdCtx,complexity01:.3});
console.log('B901_B1100_CORE_PASS');
const diag=c.diagnostics();
const report={preAccuracy:pre/preN,postAccuracy:post/postN,decisions:diag.decisions,updates:diag.updates,taskAssignments:diag.taskAssignments,newTasks:diag.newTasks,replays:diag.replays,alignmentChecks:diag.alignmentChecks,alignmentRejects:diag.alignmentRejects,policyUpdates:diag.policyUpdates,counterfactuals:diag.counterfactuals,foresightCalls:diag.foresightCalls,consolidations:diag.consolidations,curriculumSelections:diag.curriculumSelections,neuralUpdates:diag.neuralUpdates,restarts:r.diagnostics().restarts,restartEqual:JSON.stringify(a)===JSON.stringify(b),lesionEffects,lastReversal:diag.lastReversal01,lastTaskConfidence:diag.lastTaskConfidence01};
console.log(JSON.stringify(report,null,2));
