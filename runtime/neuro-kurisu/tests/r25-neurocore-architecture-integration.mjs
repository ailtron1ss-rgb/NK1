import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
import { B262MultiTimescaleWorldModel } from '../src/organism/cognition/B262MultiTimescaleWorldModel.ts';
import { NeuroCoreAdaptiveOperators } from '../src/organism/system/NeuroCoreAdaptiveOperators.ts';

const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const mse=(a,b)=>a.length?Math.min(1,a.reduce((s,x,i)=>s+(x-(b[i]??0))**2,0)/a.length):0;
const vec=(seed,n=24)=>Array.from({length:n},(_,i)=>clamp(Math.sin(seed*0.37+i*0.19)*0.72+Math.cos(seed*0.11+i*0.07)*0.18));
const nextState=(before,action,tick)=>before.map((v,i)=>clamp(Math.tanh(v*0.76 + Math.sin((tick+i)*0.09)*0.05 + Math.cos(i+ACTIONS.indexOf(action))*0.03)));
const reward=(state,action)=>Math.max(0,Math.min(1,0.52 + (state[0]??0)*0.12 + (state[1]??0)*0.08 + ((ACTIONS.indexOf(action)%3)-1)*0.05));

const op=new NeuroCoreAdaptiveOperators(8);
const start=op.diagnostics();
for(let i=0;i<96;i++) op.apply(0,{feature:Math.sin(i*.17),gradient:(i%9-4)*.004,surprise01:(i%5)/4,novelty01:(i%7)/6,uncertainty01:.2+(i%4)*.12,verification01:i%3===0?1:.7,stability01:.65},i%8);
const opDiag=op.diagnostics();
if(!(opDiag.updates>start.updates && Number.isFinite(opDiag.meanPreconditioner01))) throw new Error('adaptive operator did not update safely');

const b365=new B365UnifiedNeuroCausalCore();
for(let tick=1;tick<=24;tick++){
  const step=b365.step({tick,vector:Array.from({length:64},(_,i)=>Math.sin(tick*.11+i*.03)),novelty01:(tick%7)/7,uncertainty01:.25+(tick%4)*.1,predictionError01:.2+(tick%5)*.06,goalPressure01:.55,autonomy01:.7});
  b365.learnFromOutcome({tick,action:step.selectedAction,reward01:.55+(tick%3)*.12,predictionError01:.15+(tick%4)*.05,verified01:1,novelty01:(tick%5)/5,externalEvidence01:.8,actualUtility01:.6+(tick%2)*.1,actualWorldConfidence01:.75});
}
const b365Diag=b365.neuroCoreArchitectureDiagnostics();
if(!(b365Diag.updates>0 && b365Diag.meanWriteGate01>0 && b365Diag.meanEraseGate01>0)) throw new Error('B365 canonical path did not consume adaptive operators');
const snap=b365.snapshot();
const restored=new B365UnifiedNeuroCausalCore();
restored.restore(snap);
const restoredDiag=restored.neuroCoreArchitectureDiagnostics();
if(Math.abs(restoredDiag.updates-b365Diag.updates)>0) throw new Error('B365 operator state failed persistence');
const legacy={...snap,version:12}; delete legacy.neuroCoreAdaptiveOperators;
const legacyRestored=new B365UnifiedNeuroCausalCore(); legacyRestored.restore(legacy);
if(legacyRestored.neuroCoreArchitectureDiagnostics().updates<0) throw new Error('legacy B365 restore failed');

const model=new B262MultiTimescaleWorldModel();
const baseline=new B262MultiTimescaleWorldModel();
const holdout=[];
for(let ep=0;ep<180;ep++){
  const before=vec(100+ep);
  const actions=Array.from({length:8},(_,i)=>ACTIONS[(ep*3+i*2)%ACTIONS.length]);
  const states=[]; const rewards=[]; let state=before.slice();
  for(let i=0;i<8;i++){
    state=nextState(state,actions[i],ep*8+i); states.push(...state); rewards.push(reward(state,actions[i]));
    model.train(state,actions[i],state,rewards[i],ep*8+i,false);
  }
  model.trainSequence({tick:ep*8+8,before,actions,statesAfter:states,rewards01:rewards});
  if(ep>=140) holdout.push({before,actions,statesAfter:states,rewards});
}
let trainedErr=0,baselineErr=0,trainedReward=0,baselineReward=0;
for(const sample of holdout){
  const h=8;
  const pred=model.predictSequence(sample.before,sample.actions,h);
  const base=baseline.predictSequence(sample.before,sample.actions,h);
  trainedErr+=mse(pred.predictedAfter,sample.statesAfter.slice(7*24,8*24));
  baselineErr+=mse(base.predictedAfter,sample.statesAfter.slice(7*24,8*24));
  trainedReward+=pred.predictedValue01;
  baselineReward+=base.predictedValue01;
}
trainedErr/=Math.max(1,holdout.length); baselineErr/=Math.max(1,holdout.length);
trainedReward/=Math.max(1,holdout.length); baselineReward/=Math.max(1,holdout.length);
const hierarchy=model.planHierarchical(holdout[0].before,8,4);
if(!(model.diagnostics().sequenceUpdates>0 && hierarchy.steps.length===8)) throw new Error('sequence/hierarchical path did not execute');

console.log('R25_NEUROCORE_ARCHITECTURE=PASS',JSON.stringify({operator:opDiag,b365:b365Diag,restored:restoredDiag,sequenceUpdates:model.diagnostics().sequenceUpdates,trainedSequenceError01:trainedErr,baselineSequenceError01:baselineErr,sequenceImprovement01:Math.max(0,baselineErr-trainedErr),trainedPredictedValue01:trainedReward,baselinePredictedValue01:baselineReward,hierarchicalDepth:hierarchy.totalDepth,hierarchicalRefinementDepth:hierarchy.refinementDepth,hierarchicalGain01:hierarchy.planningAdvantage01}));
