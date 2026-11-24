import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const vector=(seed,t)=>Array.from({length:64},(_,i)=>Math.max(-1,Math.min(1,Math.sin((seed+3)*(i+5)*0.09+t*0.047))));
const ctx=(rewardBias)=>Object.fromEntries(['respond','explore','verify','rest','reflect','wait','defer'].map(a=>[a,{worldUtility01:a==='explore'?0.72:0.42+rewardBias,worldConfidence01:.78,worldUncertainty01:.18}]));

const replayOn=new B365UnifiedNeuroCausalCore();
const replayOff=new B365UnifiedNeuroCausalCore();
for(let t=1;t<=48;t++){
  const action=t%3===0?'explore':t%3===1?'verify':'reflect';
  const reward=t>48 ? (action==='explore'?.92:.12) : (action==='verify'?.75:.24);
  const input={tick:t,vector:vector(11,t),action,novelty01:t>48?.82:.31,uncertainty01:t>48?.22:.61,predictionError01:t>48?.08:.34,goalPressure01:t>48?.78:.35,autonomy01:.8,learningEnabled:true,actionContext:ctx(0)};
  replayOn.step(input); replayOff.step(input);
  replayOn.learnFromOutcome({tick:t,action,reward01:reward,predictionError01:t>48?.08:.34,verified01:1,externalEvidence01:1,novelty01:t>48?.82:.31,actualUtility01:reward,predictedReward01:replayOn.diagnostics().rewardPrediction01,predictedUtility01:replayOn.forecast(action)?.utility01,actualStateDelta01:t>48?.72:.18,actualWorldConfidence01:.82,temporalCreditEnabled:true,delayedReward01:reward});
  replayOff.learnFromOutcome({tick:t,action,reward01:reward,predictionError01:t>48?.08:.34,verified01:1,externalEvidence01:1,novelty01:t>48?.82:.31,actualUtility01:reward,predictedReward01:replayOff.diagnostics().rewardPrediction01,predictedUtility01:replayOff.forecast(action)?.utility01,actualStateDelta01:t>48?.72:.18,actualWorldConfidence01:.82,temporalCreditEnabled:true,delayedReward01:reward});
}
const before=replayOn.step({tick:73,vector:vector(11,73),novelty01:.18,uncertainty01:.2,goalPressure01:.3,autonomy01:.8,learningEnabled:false,actionContext:ctx(0)});
const rep=replayOn.replayConsolidate(32,49);
const after=replayOn.step({tick:50,vector:vector(11,74),novelty01:.18,uncertainty01:.2,goalPressure01:.3,autonomy01:.8,learningEnabled:false,actionContext:ctx(0)});
const off=replayOff.step({tick:50,vector:vector(11,74),novelty01:.18,uncertainty01:.2,goalPressure01:.3,autonomy01:.8,learningEnabled:false,actionContext:ctx(0)});
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const l1=actions.reduce((s,a)=>s+Math.abs(after.actionProbabilities[a]-off.actionProbabilities[a]),0);
assert.ok(rep.experiences>=24,`insufficient replay experiences: ${rep.experiences}`);
assert.ok(rep.updates>0,`replay made no updates: ${rep.updates}`);
assert.ok(rep.impact01>0.01,`replay impact too small: ${rep.impact01}`);
assert.ok(l1>0.01,`replay causal policy divergence too small: ${l1}`);
assert.ok(replayOn.diagnostics().replayBufferSize>=48,`replay buffer not retained: ${replayOn.diagnostics().replayBufferSize}`);

const runtimePath='/tmp/b369-replay-runtime.json';
const runtime=new OrganismRuntime({stateFile:runtimePath,stateStore:new FileStateStore(runtimePath),enableLanguage:false,autoRun:false,performanceProfile:'balanced'});
await runtime.init();
await runtime.runAutonomousCycles(6);
const beforeConsolidation=runtime.core.b365UnifiedNeuroCausalDiagnostics();
await runtime.sleepConsolidate();
const afterConsolidation=runtime.core.b365UnifiedNeuroCausalDiagnostics();
assert.ok(afterConsolidation.replayExperiences>=beforeConsolidation.replayExperiences, 'replay experience count regressed');
assert.ok(afterConsolidation.replayUpdates>beforeConsolidation.replayUpdates, 'runtime consolidation did not update B365');
const snap=runtime.core.snapshot();
const restored=new OrganismRuntime({stateFile:runtimePath,stateStore:new FileStateStore(runtimePath),enableLanguage:false,autoRun:false,performanceProfile:'balanced'});
await restored.init();
const restoredDiag=restored.core.b365UnifiedNeuroCausalDiagnostics();
assert.ok(restoredDiag.replayUpdates>=afterConsolidation.replayUpdates, `replay updates did not persist after restart: after=${afterConsolidation.replayUpdates} restored=${restoredDiag.replayUpdates}`);
console.log(JSON.stringify({pass:true,status:'B369_NEURAL_REPLAY_CONSOLIDATION_PASS',causal:{replay:rep,l1:Number(l1.toFixed(6)),beforeEntropy:before.actionProbabilities,afterEntropy:after.actionProbabilities},runtime:{before:beforeConsolidation,after:afterConsolidation,restored:restoredDiag,worldTick:snap.state.tick}},null,2));
