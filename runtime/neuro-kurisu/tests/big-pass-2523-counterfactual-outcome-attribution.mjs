import assert from 'node:assert/strict';
import { B2523MultiHorizonCounterfactualVerifier } from '../src/organism/cognition/B2523MultiHorizonCounterfactualVerifier.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const verifier=new B2523MultiHorizonCounterfactualVerifier();
verifier.beforeDecision({
  tick:41,
  baseUtilities:{respond:.34,explore:.78,verify:.46,rest:.55,reflect:.38,wait:.30,defer:.25},
  uncertainty01:.93,
  predictionError01:.24,
  goalPressure01:.91,
  modelConfidence01:.83,
  routerDisagreement01:.86,
  computeBudget01:.95,
  canonicalLatent:Array.from({length:24},(_,i)=>(i%7)/6),
  canonicalUncertainty01:.77,
  canonicalCoherence01:.74,
});

const before=verifier.snapshot();
assert.ok(before.selectedHorizon>=2&&before.selectedHorizon<=8,'verifier did not select a bounded future horizon');
const candidateForecast=(action)=>before.horizonValues[action][before.selectedHorizon-1];
const actualAction=actions
  .filter(action=>action!==before.lastAction)
  .sort((a,b)=>Math.abs(candidateForecast(b)-before.lastValue01)-Math.abs(candidateForecast(a)-before.lastValue01))[0];
assert.ok(actualAction,'test must choose an executed action distinct from the counterfactual leader');
assert.notEqual(actualAction,before.lastAction,'test must exercise an outcome for a non-leading counterfactual action');

const actualActionForecast=candidateForecast(actualAction);
assert.ok(Number.isFinite(actualActionForecast)&&actualActionForecast>=0&&actualActionForecast<=1);
assert.ok(Math.abs(actualActionForecast-before.lastValue01)>.005,
  'fixture must make the actual-action forecast differ from the planner-leader value');
const expectedConfidence=Math.max(0,Math.min(1,before.verificationConfidence01*.95+.6*.05));

verifier.afterOutcome({
  tick:41,
  action:actualAction,
  reward01:actualActionForecast,
  predictionError01:.8,
  verified01:0,
});
const after=verifier.snapshot();
assert.ok(Math.abs(after.verificationConfidence01-expectedConfidence)<1e-12,
  'B2523 calibrated outcome against a different action forecast instead of the executed action horizon');
assert.equal(after.learningUpdates,before.learningUpdates+1);
assert.equal(after.lastValue01,before.lastValue01,'outcome attribution must not rewrite the separately stored counterfactual leader value');
console.log(JSON.stringify({
  pass:true,
  actualAction,
  counterfactualLeader:before.lastAction,
  actualActionForecast,
  counterfactualLeaderValue:before.lastValue01,
  selectedHorizon:before.selectedHorizon,
  verificationConfidenceBefore:before.verificationConfidence01,
  verificationConfidenceAfter:after.verificationConfidence01
},null,2));
