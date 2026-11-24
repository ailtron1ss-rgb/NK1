import assert from 'node:assert/strict';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
function run(mix){
  const b=new NeuralExperienceBranch();
  const d=defaultNeuralExperienceBranch();
  d.onlineCreditMix01=mix;
  b.restore(d);
  for(let tick=1;tick<=64;tick++){
    const action=tick%3===0?'verify':'explore';
    const reward=tick%5===0?.92:(tick%4===0?.28:.46);
    const error=tick%5===0?.08:(tick%4===0?.72:.38);
    b.beforeDecision({tick,input:new Array(64).fill(tick%7===0?.82:.12),baseUtilities:actions,predictionError01:error,novelty01:tick%6===0?.75:.25,uncertainty01:tick%9===0?.8:.35,homeostasis01:.25,identityGap01:.2,goalPressure01:.55,reward01:.5,identityVector:new Array(24).fill(.2)});
    b.commitAction(action,actions);
    b.afterOutcome({tick,action,reward01:reward,predictionError01:error,verified01:tick%5===0?1:0,nextInput:new Array(64).fill(tick%2===0?.2:.08),identityGap01:.15,goalPressure01:.55,identityVector:new Array(24).fill(.25)});
  }
  return b;
}

const baseline=run(0);
const synthesized=run(.65);
const bs=baseline.snapshot();
const ss=synthesized.snapshot();
assert.equal(ss. version,25);
assert.equal(ss.onlineCreditUpdates,64);
assert(ss.creditModelResidual01>=0 && ss.creditModelResidual01<=1);
assert(ss.creditAgreement01>=0 && ss.creditAgreement01<=1);
assert(ss.creditTraceNorm01>=0 && ss.creditTraceNorm01<=1);
assert(ss.edgeWeights.flat().every(Number.isFinite));
let diff=0;
for(let i=0;i<ss.edgeWeights.length;i++)for(let q=0;q<ss.edgeWeights[i].length;q++)diff+=Math.abs(ss.edgeWeights[i][q]-bs.edgeWeights[i][q]);
assert(diff>1e-4,'online-credit mix must alter learning trajectory');
console.log(`P2706_ONLINE_CREDIT_SYNTHESIS=PASS diff=${diff.toFixed(5)} baseline=${bs.creditBaseline01.toFixed(4)} residual=${ss.creditModelResidual01.toFixed(4)} agreement=${ss.creditAgreement01.toFixed(4)} trace=${ss.creditTraceNorm01.toFixed(4)}`);
