import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const context=(phase)=>Object.fromEntries(actions.map((a,i)=>[a,{worldUtility01:phase==='holdout'?.68-.06*i:.32+.07*i,worldConfidence01:.86,worldUncertainty01:phase==='holdout'?.34:.16,needRelief01:.5,predictedCost01:phase==='holdout'?.2:.3}]));
const vector=(seed,holdout=false)=>Array.from({length:64},(_,i)=>Math.tanh(Math.sin((seed+i)*(holdout?.41:.17))*.9));
function runSelf(enabled=true){
 const c=new B365UnifiedNeuroCausalCore(); c.setSelfModelEnabled(enabled);
 for(let t=1;t<=180;t++){
  c.step({tick:t,vector:vector(t),novelty01:.25+.35*(t%10)/9,uncertainty01:.2+.25*(t%7)/6,predictionError01:.2+.2*(t%8)/7,goalPressure01:.5,autonomy01:.82,actionContext:context('train')});
  c.learnFromOutcome({tick:t,action:c.snapshot().lastAction,reward01:.55+.3*Math.sin(t*.19),predictionError01:.18+.18*(t%6)/5,verified01:1,externalEvidence01:.95,actualUtility01:.5+.25*Math.cos(t*.11),actualWorldConfidence01:.9,novelty01:.32});
 }
 const before=c.selfModelDiagnostics();
 for(let t=181;t<=300;t++){
  c.step({tick:t,vector:vector(t,true),novelty01:.6,uncertainty01:.55,predictionError01:.38,goalPressure01:.58,autonomy01:.82,actionContext:context('holdout')});
  c.learnFromOutcome({tick:t,action:c.snapshot().lastAction,reward01:.25+.25*((t%9)/8),predictionError01:.3+.15*((t%5)/4),verified01:1,externalEvidence01:.9,actualUtility01:.2+.4*((t%11)/10),actualWorldConfidence01:.82,novelty01:.65});
 }
 return {c,train:before,holdout:c.selfModelDiagnostics()};
}
const on=runSelf(true),off=runSelf(false);
assert(on.holdout.verifiedTransitions>on.train.verifiedTransitions);
assert(on.holdout.selfConsolidations>on.train.selfConsolidations);
assert(on.holdout.counterfactualChecks===300*7);
assert(on.holdout.autobiographicalEpisodes.length===64);
assert(off.holdout.verifiedTransitions===0);
const pOn=on.c.actionProbabilities(),pOff=off.c.actionProbabilities();
const l1=actions.reduce((s,a)=>s+Math.abs(pOn[a]-pOff[a]),0);
assert(l1>.01);
// Evidence gate: verified01 without external evidence must not create autobiographical transition.
const gated=new B365UnifiedNeuroCausalCore();
gated.step({tick:1,vector:vector(1),novelty01:.4,uncertainty01:.3,predictionError01:.2,goalPressure01:.5,autonomy01:.8,actionContext:context('train')});
gated.learnFromOutcome({tick:1,action:gated.snapshot().lastAction,reward01:.9,predictionError01:.1,verified01:1,externalEvidence01:0,actualUtility01:.9,actualWorldConfidence01:.9});
assert.equal(gated.selfModelDiagnostics().verifiedTransitions,0);
assert(gated.selfModelDiagnostics().rejectedTransitions>0);
console.log(JSON.stringify({PASS:true,trainVerified:on.train.verifiedTransitions,holdoutVerified:on.holdout.verifiedTransitions,trainConsolidations:on.train.selfConsolidations,holdoutConsolidations:on.holdout.selfConsolidations,holdoutChecks:on.holdout.counterfactualChecks,policyHoldoutL1:l1,offVerified:off.holdout.verifiedTransitions,gateRejected:gated.selfModelDiagnostics().rejectedTransitions},null,2));
