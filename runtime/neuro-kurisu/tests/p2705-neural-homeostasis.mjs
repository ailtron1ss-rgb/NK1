import assert from 'node:assert/strict';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
const b=new NeuralExperienceBranch();
b.restore(defaultNeuralExperienceBranch());
for(let tick=1;tick<=48;tick++){
  b.beforeDecision({tick,input:new Array(64).fill(tick%7===0?.8:.15),baseUtilities:actions,predictionError01:tick%9===0?.8:.2,novelty01:tick%5===0?.8:.35,uncertainty01:.45,homeostasis01:.3,identityGap01:.2,goalPressure01:.6,reward01:.5,identityVector:new Array(24).fill(.2),personalityVector:new Array(24).fill(.3)});
  b.commitAction(tick%3===0?'verify':'explore',actions);
  b.afterOutcome({tick,action:tick%3===0?'verify':'explore',reward01:tick%4===0?.9:.35,predictionError01:tick%4===0?.1:.55,verified01:tick%4===0?1:0,nextInput:new Array(64).fill(.2),identityGap01:.15,goalPressure01:.6,identityVector:new Array(24).fill(.25)});
}
const s=b.snapshot();
assert.equal(s. version,25);
assert(s.meanFiring01>=0 && s.meanFiring01<=1);
assert(s.eligibilityClipCount>=0);
assert(s.homeostaticScaleUpdates>0,'homeostatic scaling should have engaged');
const replayed=b.replay(8);
const postReplay=b.snapshot();
assert(replayed>0);
assert(postReplay.replayDiversity01>=0 && postReplay.replayDiversity01<=1);
assert(s.edgeWeights.flat().every(Number.isFinite));
assert(s.edgeEligibility.flat().every(v=>Number.isFinite(v) && Math.abs(v)<=2.000001));
console.log(`P2705_NEURAL_HOMEOSTASIS=PASS scaleUpdates=${s.homeostaticScaleUpdates} clips=${s.eligibilityClipCount} meanFiring=${s.meanFiring01.toFixed(4)} replayDiversity=${postReplay.replayDiversity01.toFixed(4)} replayed=${replayed}`);
