import assert from 'node:assert/strict';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const sensors=(vision,audio)=>({
  vision:{tick:1,values:vision,freshness01:1,confidence01:1,ageTicks:0,source:'vision'},
  audio:{tick:1,values:audio,freshness01:1,confidence01:1,ageTicks:0,source:'audio'},
});
const base={tick:1,input:new Array(64).fill(.2),baseUtilities:actions,predictionError01:.2,novelty01:.4,uncertainty01:.2,homeostasis01:.2,identityGap01:.2,goalPressure01:.6,personalityVector:[.2,.3,.4],identityVector:[.3,.2,.1]};

const aligned=new NeuralExperienceBranch();
let alignedResult;
for(let t=1;t<=12;t++){
  alignedResult=aligned.beforeDecision({...base,tick:t,embodied:{sensorFeatures:new Array(64).fill(.2),sensors:sensors([1,.8,.6,.4],[1,.8,.6,.4])}});
  aligned.commitAction('verify',alignedResult.actionBias);
  aligned.afterOutcome({tick:t,action:'verify',reward01:.9,predictionError01:.1,verified01:1,nextInput:new Array(64).fill(.25),identityGap01:.1,goalPressure01:.5});
  aligned.replay(4);
}
const am=aligned.continuityMetrics();
assert(am.crossModal.updates>=12,'cross-modal binding did not run');
assert(am.replayLearning.weightUpdates>0,'replay did not update weights');
assert(am.replayLearning.signedCredit01!==0,'replay signed credit remained inert');

const mismatch=new NeuralExperienceBranch();
for(let t=1;t<=12;t++){
  const r=mismatch.beforeDecision({...base,tick:t,embodied:{sensorFeatures:new Array(64).fill(.2),sensors:sensors([1,1,1,1],[-1,-1,-1,-1])}});
  mismatch.commitAction('verify',r.actionBias);
  mismatch.afterOutcome({tick:t,action:'verify',reward01:.4,predictionError01:.7,verified01:.2,nextInput:new Array(64).fill(-.2),identityGap01:.5,goalPressure01:.4});
}
const mm=mismatch.continuityMetrics();
assert(am.crossModal.agreement01>mm.crossModal.agreement01,'aligned modalities were not distinguished from contradictory modalities');

const snap=aligned.snapshot();
const restored=new NeuralExperienceBranch();
restored.restore(snap);
const restoredDiag=restored.continuityMetrics();
assert.equal(restoredDiag.crossModal.updates,am.crossModal.updates,'cross-modal state did not persist');
assert.equal(restoredDiag.replayLearning.weightUpdates,am.replayLearning.weightUpdates,'replay learning counters did not persist');

console.log(JSON.stringify({
  pass:true,
  aligned:{crossModal:am.crossModal,replay:am.replayLearning},
  mismatch:{crossModal:mm.crossModal},
  persisted:true,
},null,2));
