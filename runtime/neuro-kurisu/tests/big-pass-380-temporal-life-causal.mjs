import assert from 'node:assert/strict';
import { B380TemporalLifeIntegrator } from '../src/organism/system/B380TemporalLifeIntegrator.ts';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const actionContext=Object.fromEntries(actions.map(action=>[action,{worldUtility01:action==='rest'?.35:.62,worldConfidence01:.8,worldUncertainty01:.2,needRelief01:action==='rest'?.75:.35,predictedCost01:action==='rest'?.08:.18}]));
const vector=Array.from({length:64},(_,i)=>Math.tanh(.17*Math.sin(i*.31)+.09*Math.cos(i*.13)));

const onTemporal=new B380TemporalLifeIntegrator();
let last=null;
for(let tick=1;tick<=2400;tick++){
  const highStress=tick%37===0 || tick%101<3;
  const signals=onTemporal.begin({tick,at:tick*1000,awake:tick%211!==0,energy01:highStress?.28:.76,thermal01:highStress?.68:.22,capacity01:highStress?.46:.82,uncertainty01:highStress?.74:.24,predictionError01:highStress?.78:.18,novelty01:tick%17===0?.72:.24,goalPressure01:tick%23===0?.72:.22,identity01:.91,actionPressure01:.3,recoveryDebt01:highStress?.65:.08,recoveryMode:highStress?'probe':'normal'});
  last=onTemporal.close({tick,at:tick*1000,action:tick%3===0?'explore':'rest',goalId:tick%5===0?'goal-a':'goal-b',reward01:highStress?.38:.78,success01:highStress?.55:.92,surprise01:highStress?.72:.16,predictionError01:highStress?.75:.14,physicalVerified01:tick%29===0?1:0,independent01:tick%29===0?1:0,evidenceQuality01:tick%29===0?.98:.22,recoveryEvent01:highStress?1:0,sleepBoundary01:tick%211===0?1:0,external01:tick%53===0?1:0});
}
const diag=onTemporal.diagnostics();
assert.equal(diag.state.metrics.completed,2400);
assert.ok(diag.state.metrics.recoveryEvents>20);
assert.ok(diag.state.metrics.consolidations>0);
assert.ok(diag.state.tokens.length<=256);
assert.ok(diag.state.metrics.influence01>0.1);
const restarted=new B380TemporalLifeIntegrator(); restarted.restore(diag.state); assert.deepEqual(restarted.snapshot(),diag.state);

function runNet(temporalMode){
  const net=new B365UnifiedNeuroCausalCore();
  for(let t=1;t<=420;t++){
    const high=t%31===0;
    const temporal=temporalMode==='on'?onTemporal.snapshot().lastSignals:{temporalRegulation01:.5,homeostaticPressure01:0.2,consolidationPressure01:0.05,experienceSalience01:0.1,continuity01:.8,sleepPressure01:.05,resourceUrgency01:.08,learningGate01:0};
    net.step({tick:t,vector,novelty01:high?.68:.24,uncertainty01:high?.7:.25,predictionError01:high?.72:.16,goalPressure01:high?.65:.2,autonomy01:.72,actionContext,learningEnabled:false,temporalLife:temporal});
  }
  return net.step({tick:421,vector,novelty01:.42,uncertainty01:.39,predictionError01:.2,goalPressure01:.3,autonomy01:.72,actionContext,learningEnabled:false,temporalLife:temporalMode==='on'?onTemporal.snapshot().lastSignals:{learningGate01:0,temporalRegulation01:.5,homeostaticPressure01:.2,consolidationPressure01:.05,experienceSalience01:.1,continuity01:.8,sleepPressure01:.05,resourceUrgency01:.08}});
}
const on=runNet('on');
const off=runNet('off');
const divergence=actions.reduce((sum,a)=>sum+Math.abs((on.actionProbabilities[a]??0)-(off.actionProbabilities[a]??0)),0);
assert.ok(divergence>0.002,`temporal policy divergence too small: ${divergence}`);

console.log(JSON.stringify({pass:true,status:'B380_TEMPORAL_LIFE_CAUSAL_PASS',longHorizon:{cycles:2400,recoveryEvents:diag.state.metrics.recoveryEvents,consolidations:diag.state.metrics.consolidations,influence01:diag.state.metrics.influence01,meanSalience01:diag.state.metrics.meanSalience01,meanContinuity01:diag.state.metrics.meanContinuity01,tokens:diag.state.tokens.length},policyDivergenceL1:divergence,restartEqual:true,lastMode:diag.state.mode,lastToken:last?.id??null},null,2));
