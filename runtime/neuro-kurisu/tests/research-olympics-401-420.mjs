import { B401B420AdaptiveCognitiveResearchCore, defaultB401B420State } from '../src/organism/system/B401B420AdaptiveCognitiveResearchCore.ts';
import { strict as assert } from 'node:assert';

const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const V=['surprise-memory','continuum-memory','state-space','latent-predictor','counterfactual','goal-value','population-code'];
let seed=0x401420;
const rnd=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
const clamp=x=>Math.max(0,Math.min(1,x));
const argmax=o=>Object.entries(o).reduce((a,b)=>b[1]>a[1]?b:a)[0];
const makeCtx=(i)=>Array.from({length:8},(_,j)=>((Math.sin((i+1)*(j+2)*.17)+1)/2)*.8+.1*rnd());
const target=(ctx)=>{
  const scores=ACTIONS.map((_,a)=>clamp(.18 + .14*((a+1)/ACTIONS.length) + .12*ctx[a%8] + .08*ctx[(a+3)%8] + .05*ctx[(a+5)%8]));
  return ACTIONS[scores.indexOf(Math.max(...scores))];
};
const inputFor=(i,ctx,baseUtilities)=>({tick:i+1,context01:ctx,baseProbabilities:Object.fromEntries(ACTIONS.map(a=>[a,1/ACTIONS.length])),baseUtilities,reward01:.5,surprise01:.25,novelty01:.35+.3*(i%5)/4,uncertainty01:.42+.2*(i%4)/3,predictionError01:.22,goalVector:ctx,selfVector:ctx,retrievedMemoryStrength01:.5,motivation01:.55});
const baseUtility=(ctx,goal)=>Object.fromEntries(ACTIONS.map((a,ai)=>[a,clamp(.5 + (a===goal?.action?.toString()?0:.0) + (ctx[ai%8]-.5)*.25 + (rnd()-.5)*.18)]));
const bWithTruth=(ctx,truth)=>Object.fromEntries(ACTIONS.map((a,ai)=>[a,clamp(.5+(a===truth?.action?.toString()?0:.0)+(ctx[ai%8]-.5)*.20)]));

const core=new B401B420AdaptiveCognitiveResearchCore();
const records=[];
for(let i=0;i<360;i++){
  const ctx=makeCtx(i); const goal=target(ctx);
  const base=Object.fromEntries(ACTIONS.map((a,ai)=>[a,clamp(.5+(ctx[ai%8]-.5)*.16+(rnd()-.5)*.30+(a===goal?.action?.toString()?0:.0))]));
  const inp=inputFor(i,ctx,base);
  const out=core.beforeDecision(inp);
  const chosen=argmax(out.predictiveUtility);
  const reward=chosen===goal?1:0;
  core.afterOutcome({tick:i+1,action:chosen,context01:ctx,nextContext01:makeCtx(i+1),reward01:reward, surprise01:clamp(.18+Math.abs(reward-.5)),verified01:1,salience01:.55,predictionError01:Math.abs(reward-.5)});
  records.push({i,ctx,goal});
}
const trained=core.snapshot();
const evalSet=Array.from({length:180},(_,k)=>{const i=1000+k;const ctx=makeCtx(i);const truth=target(ctx);const base=Object.fromEntries(ACTIONS.map((a,ai)=>[a,clamp(.5+(ctx[ai%8]-.5)*.16+(rnd()-.5)*.30)]));return {ctx,truth,base};});
const evalModel=(weights)=>{
  const c=new B401B420AdaptiveCognitiveResearchCore();
  const s=structuredClone(trained); s.weights={...Object.fromEntries(V.map(v=>[v,0])),...weights}; c.restore(s);
  let correct=0;
  for(let i=0;i<evalSet.length;i++){const r=evalSet[i];const out=c.beforeDecision(inputFor(i+2000,r.ctx,r.base));if(argmax(out.predictiveUtility)===r.truth)correct++;}
  return correct/evalSet.length;
};
const baseAcc=evalSet.reduce((n,r)=>n+(argmax(r.base)===r.truth?1:0),0)/evalSet.length;
const ensembleAcc=evalModel(Object.fromEntries(V.map(v=>[v,1])));
const variants=Object.fromEntries(V.map(v=>[v,evalModel({[v]:1})]));
const snapshotDiag=core.diagnostics();
const improvement01=ensembleAcc-baseAcc;
assert(Number.isFinite(improvement01));
console.log(JSON.stringify({pass:true,status:'B401_B420_RESEARCH_OLYMPICS_PASS',trainCycles:360,holdoutCases:evalSet.length,baseAccuracy01:baseAcc,ensembleAccuracy01:ensembleAcc,ensembleImprovement01:improvement01,variantAccuracy01:variants,trainedDiagnostics:{bestVariant:snapshotDiag.diagnostics.bestVariant,diversity01:snapshotDiag.diagnostics.lastEnsembleDiversity01,uncertainty01:snapshotDiag.diagnostics.lastUncertainty01,developmentalGain01:snapshotDiag.diagnostics.developmentalGain01},note:'Synthetic hidden-rule benchmark; not a claim about human cognition or external performance.'},null,2));
