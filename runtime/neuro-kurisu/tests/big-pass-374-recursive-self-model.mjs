import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const vec=(seed)=>Array.from({length:64},(_,i)=>Math.sin((seed+i)*.17)*.8);
const ctx=()=>Object.fromEntries(actions.map((a,i)=>[a,{worldUtility01:.30+.08*i,worldConfidence01:.88,worldUncertainty01:.12,needRelief01:.55,predictedCost01:.25}]));
const run=(enabled=true,cycles=240)=>{
  const core=new B365UnifiedNeuroCausalCore(); core.setSelfModelEnabled(enabled);
  for(let t=1;t<=cycles;t++){
    core.step({tick:t,vector:vec(t%13),novelty01:.35+.45*((t%11)/10),uncertainty01:.25+.55*((t%7)/6),predictionError01:.15+.65*((t%9)/8),goalPressure01:.45+.35*((t%5)/4),autonomy01:.8,actionContext:ctx()});
    core.learnFromOutcome({tick:t,action:core.snapshot().lastAction,reward01:.15+.7*((t%17)/16),predictionError01:.2+.45*((t%8)/7),verified01:1,externalEvidence01:.95,actualUtility01:.2+.65*((t%13)/12),actualWorldConfidence01:.9,novelty01:.5});
  }
  return core;
};
const on=run(true); const onDiag=on.selfModelDiagnostics();
assert.equal(onDiag.rejectedTransitions,0);
assert(onDiag.verifiedTransitions>150,'verified self transitions should be substantial');
assert(onDiag.autobiographicalEpisodes.length<=64);
assert(onDiag.counterfactualChecks>=240*actions.length);
assert(onDiag.agency01>.55);
assert(onDiag.selfPredictionError01<.55);
assert(onDiag.selfConsolidations>=7,'self biography must be consolidated repeatedly');
assert(onDiag.consolidatedEpisodes>=80);
const snap=on.snapshot(); const restored=new B365UnifiedNeuroCausalCore(); restored.restore(snap);
assert.deepEqual(restored.selfModelDiagnostics().stableSelf,onDiag.stableSelf,'self identity must persist across restart');
assert.equal(restored.selfModelDiagnostics().verifiedTransitions,onDiag.verifiedTransitions);
assert.equal(restored.selfModelDiagnostics().selfConsolidations,onDiag.selfConsolidations);
const off=run(false); const offDiag=off.selfModelDiagnostics();
assert.equal(offDiag.verifiedTransitions,0);
const p1=on.actionProbabilities(),p0=off.actionProbabilities();
const l1=actions.reduce((sum,a)=>sum+Math.abs((p1[a]??0)-(p0[a]??0)),0);
assert(l1>0.015,'self-model lesion should causally alter policy');
console.log(JSON.stringify({PASS:true,verifiedTransitions:onDiag.verifiedTransitions,rejectedTransitions:onDiag.rejectedTransitions,counterfactualChecks:onDiag.counterfactualChecks,agency01:onDiag.agency01,continuity01:onDiag.continuity01,selfPredictionError01:onDiag.selfPredictionError01,episodes:onDiag.autobiographicalEpisodes.length,policyL1:l1,persistence:true},null,2));
