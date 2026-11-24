import assert from 'node:assert/strict';
import { B2509EmbodiedHomeostaticActionField } from '../src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts';
import { B2510DevelopmentalPersonalityCoupling } from '../src/organism/cognition/B2510DevelopmentalPersonalityCoupling.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const bu=Object.fromEntries(A.map(a=>[a,.5]));
const needs={energy:.72,cognitiveLoad:.24,uncertainty:.33,socialNeed:.2,novelty:.3,identityCoherence:.7,goalPressure:.5};
const body=()=>({bodyEnergy01:.72,cognitiveCapacity01:.8,thermalStrain01:.2,sensoryFreshness01:.8,awake:true,battery01:.8,cpuLoad01:.2,ramPressure01:.2});
const traits={curiosity:.1,truth:.1,reflection:.1,care:.1,preservation:0,persistence:.1,caution:.1,autonomy:.1,epistemic:.1,social:.1,initiative:.1,restraint:.1};
const makePInput=t=>({
  tick:t,baseUtilities:bu,b299TraitSignals:traits,b299Stability01:.7,agency01:.7,
  authorship01:.6,selfContinuity01:.75,autonomy01:.7,uncertainty01:.3,novelty01:.3,
  goalPressure01:.5,predictionError01:.1,socialNeed01:.2,verifiedHistory01:.8,
});
const makeB9Input=t=>({
  tick:t,baseUtilities:bu,needs,embodiment:body(),sensorFreshness01:.8,
  uncertainty01:.3,predictionError01:.18,goalPressure01:.5,computeBudget01:.4,
});
const b9=new B2509EmbodiedHomeostaticActionField();
const b10=new B2510DevelopmentalPersonalityCoupling();
for(let i=0;i<2000;i++){
  const o=b9.beforeDecision(makeB9Input(i));
  b9.afterOutcome({tick:i,action:o.selectedAction,nextBody:o.predictedBody,reward01:.64,verified01:1,predictionError01:.1});
  const p=b10.beforeDecision(makePInput(i));
  b10.afterOutcome({tick:i,action:p.selectedAction,reward01:.65,predictionError01:.1,verified01:1,autonomous01:.8,causalMatch01:.8,selfContinuity01:.75,goalPressure01:.5,novelty01:.3,socialNeed01:.2});
}
const start=process.hrtime.bigint();
const N=3000;
for(let i=0;i<N;i++){
  b9.beforeDecision(makeB9Input(i+3000));
  b10.beforeDecision(makePInput(i+3000));
}
const ms=Number(process.hrtime.bigint()-start)/1e6;
assert.ok(ms<2000);
console.log(JSON.stringify({pass:true,status:'B2509_B2510_MOBILE_PASS',iterations:N,totalMs:ms,perIterationMs:ms/N,b2509:b9.diagnostics(),b2510:b10.diagnostics()},null,2));
