import { B1101B1350SelfDevelopmentCore } from '../src/organism/system/B1101B1350SelfDevelopmentCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const choose=o=>A.reduce((b,a)=>(o.actionBias[a]>(o.actionBias[b]??-1)?a:b),A[0]);
const inp=(tick,ctx,pe=.1,nov=.1)=>({tick,context01:ctx,baseUtilities:base,uncertainty01:pe>.5?.72:.18,predictionError01:pe,novelty01:nov,confidence01:.7,goalVector:ctx,complexity01:.3,currentAction:'wait'});
function run(){const c=new B1101B1350SelfDevelopmentCore();const contexts=[
 [.2,.8,.1,.7,.25,.75,.15,.85,.3,.7,.2,.8],
 [.8,.2,.9,.3,.75,.25,.85,.15,.7,.3,.8,.2],
 [.2,.8,.9,.3,.25,.75,.85,.15,.3,.7,.2,.8],
 [.8,.2,.1,.7,.75,.25,.15,.85,.7,.3,.8,.2],
];
 const target=(ctx)=>ctx[0]<.5?(ctx[2]>.5?'explore':'respond'):(ctx[2]>.5?'verify':'respond');
 for(let t=0;t<2400;t++){const ctx=contexts[t%contexts.length];const d=c.beforeDecision(inp(t,ctx,t%41===0?.78:.16,t%31===0?.72:.12));const a=choose(d);const r=a===target(ctx)?1:0;c.afterOutcome({tick:t,action:a,context01:ctx,nextContext01:ctx.map((x,i)=>Math.max(0,Math.min(1,.5+.94*(x-.5)+(i===0&&t>1200?.08:0)))),reward01:r,predictionError01:1-r,verified01:r?1:.5,success01:r});}
 const hold=contexts[2];let hits=0,n=400;for(let i=0;i<n;i++){const d=c.beforeDecision(inp(3000+i,hold,.08,.06));hits+=choose(d)===target(hold)?1:0;}
 const lesionKeys=['task-inference','memory-manager','adaptive-lookahead','counterfactual','world-model','schema-abstraction','curriculum','neural-plasticity','policy','verifier'];
 const lesions={};for(const k of lesionKeys)lesions[k]=c.evaluate(inp(3300,hold,.55,.5),{[k]:true}).effect01;
 const s=c.snapshot();const r=new B1101B1350SelfDevelopmentCore();r.restore(s);r.markRestart();const x=c.beforeDecision(inp(3500,hold,.2,.1));const y=r.beforeDecision(inp(3500,hold,.2,.1));
 const diag=c.diagnostics();
 console.log('B1101_B1350_COGNITIVE_PASS');
 console.log(JSON.stringify({
   holdoutAccuracy:hits/n,decisions:diag.decisions,updates:diag.updates,tasks:s.tasks.length,memories:s.memories.length,
   memoryAdds:diag.memoryAdds,memoryUpdates:diag.memoryUpdates,memoryDeletes:diag.memoryDeletes,memoryRecalls:diag.memoryRecalls,memoryRecallRows:diag.memoryRecallRows,
   schemaConsolidations:diag.schemaConsolidations,lookaheadCalls:diag.lookaheadCalls,lookaheadBranches:diag.lookaheadBranches,counterfactualCalls:diag.counterfactualCalls,
   worldUpdates:diag.worldUpdates,neuralUpdates:diag.neuralUpdates,policyUpdates:diag.policyUpdates,hiddenGeneralizations:diag.hiddenGeneralizations,
   curriculumSelections:diag.curriculumSelections,lesionEffects:lesions,restartEqual:JSON.stringify(x)===JSON.stringify(y),
   avgMemoryAbstractions:s.memories.length?s.memories.reduce((a,m)=>a+m.abstraction,0)/s.memories.length:0,lastLatencyMs:diag.lastLatencyMs
 },null,2));
}
run();
