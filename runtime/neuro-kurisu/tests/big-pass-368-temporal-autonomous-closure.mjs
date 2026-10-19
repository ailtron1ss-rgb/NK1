import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const vector=(seed,t)=>Array.from({length:64},(_,i)=>Math.max(-1,Math.min(1,Math.sin((seed+1)*(i+2)*0.13+t*0.071))));

const temporalOn = new B365UnifiedNeuroCausalCore();
const temporalOff = new B365UnifiedNeuroCausalCore();
for(let t=1;t<=90;t++){
  const on=temporalOn.step({tick:t,vector:vector(1,t),novelty01:.72,uncertainty01:.68,predictionError01:.31,goalPressure01:.61,learningEnabled:true});
  const off=temporalOff.step({tick:t,vector:vector(1,t),novelty01:.72,uncertainty01:.68,predictionError01:.31,goalPressure01:.61,learningEnabled:true});
  temporalOn.learnFromOutcome({tick:t,action:'explore',reward01:t>55?.88:.18,predictionError01:.08,verified01:1,externalEvidence01:1,temporalCreditEnabled:true,delayedReward01:t>55?.88:.18});
  temporalOff.learnFromOutcome({tick:t,action:'explore',reward01:t>55?.88:.18,predictionError01:.08,verified01:1,externalEvidence01:1,temporalCreditEnabled:false,delayedReward01:t>55?.88:.18});
}
const probeOn=temporalOn.step({tick:91,vector:vector(1,91),novelty01:.18,uncertainty01:.18,predictionError01:.05,goalPressure01:.22,learningEnabled:false});
const probeOff=temporalOff.step({tick:91,vector:vector(1,91),novelty01:.18,uncertainty01:.18,predictionError01:.05,goalPressure01:.22,learningEnabled:false});
const temporalL1=actions.reduce((sum,a)=>sum+Math.abs(probeOn.actionProbabilities[a]-probeOff.actionProbabilities[a]),0);
const diag=temporalOn.diagnostics();
assert.ok(diag.temporalUpdates>=90,`temporal updates missing: ${diag.temporalUpdates}`);
assert.ok(diag.temporalCreditMagnitude01>0.01,`temporal credit inactive: ${diag.temporalCreditMagnitude01}`);
assert.ok(temporalL1>0.01,`temporal pathway ablation too weak: ${temporalL1}`);

const on=new OrganismRuntime({stateFile:'/tmp/b368-auto-on.json',stateStore:new MemoryStateStore(),enableLanguage:false,autoRun:false,performanceProfile:'balanced'});
await on.init();
const closed=await on.runAutonomousCycles(6);
const closedDiag=on.core.b365UnifiedNeuroCausalDiagnostics();
assert.equal(closed.externalCommands,0);
assert.equal(closed.cycles,6);
assert.equal(closed.worldTicks,6);
assert.ok(closed.neuralLearningUpdates>=6,`runtime neural learning missing: ${closed.neuralLearningUpdates}`);
assert.ok(closed.temporalUpdates>=6,`runtime temporal learning missing: ${closed.temporalUpdates}`);
assert.ok(closedDiag.temporalUpdates>=6);
console.log(JSON.stringify({pass:true,status:'B368_TEMPORAL_AUTONOMOUS_CLOSURE_PASS',temporal:{l1:Number(temporalL1.toFixed(6)),updates:diag.temporalUpdates,credit:Number(diag.temporalCreditMagnitude01.toFixed(6))},autonomy:closed,diag:{learning:closedDiag.learningUpdates,temporal:closedDiag.temporalUpdates}},null,2));
