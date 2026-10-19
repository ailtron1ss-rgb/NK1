import assert from 'node:assert/strict';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions={respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5};
function run(experimental){
  const b=new NeuralExperienceBranch();
  const d=defaultNeuralExperienceBranch();
  d.onlineCreditMix01=.72;
  b.restore(d);
  b.setExperimentalLayerEnabled(experimental);
  // Cue -> long silent interval -> delayed verified outcome. The benchmark
  // isolates whether the cascade retains a usable eligibility signal across delay.
  for(let tick=1;tick<=48;tick++){
    const cue=tick===1||tick===25;
    const action=cue?'explore':'wait';
    const x=new Array(64).fill(cue?.88:.03);
    const error=cue?.18:.42;
    b.beforeDecision({tick,input:x,baseUtilities:actions,predictionError01:error,novelty01:cue?.72:.08,uncertainty01:cue?.70:.30,homeostasis01:.25,identityGap01:.2,goalPressure01:.55,reward01:.5,identityVector:new Array(24).fill(.2)});
    b.commitAction(action,actions);
    const delayed=tick===24||tick===48;
    b.afterOutcome({tick,action,reward01:delayed?.95:.48,predictionError01:delayed?.05:.42,verified01:delayed?1:0,nextInput:new Array(64).fill(delayed?.76:.04),identityGap01:.15,goalPressure01:.55,identityVector:new Array(24).fill(.25)});
  }
  return b;
}
const control=run(false), experimental=run(true);
const c=control.snapshot(), e=experimental.snapshot();
assert.equal(e. version,25);
assert.equal(e.experimentalLayerEnabled,true);
assert(e.cascadeCreditUpdates>0);
assert(e.cascadeCreditNorm01>=0 && e.cascadeCreditNorm01<=1);
assert(e.astroGateMean01>=.2 && e.astroGateMean01<=1);
assert(e.adaptiveCreditMix01>=.35 && e.adaptiveCreditMix01<=.92);
assert(e.edgeWeights.flat().every(Number.isFinite));
assert(e.cascadeEligibilityMid.flat().every(Number.isFinite));
assert(e.cascadeEligibilitySlow.flat().every(Number.isFinite));
let diff=0;
for(let i=0;i<e.edgeWeights.length;i++)for(let q=0;q<e.edgeWeights[i].length;q++)diff+=Math.abs(e.edgeWeights[i][q]-c.edgeWeights[i][q]);
assert(diff>1e-5,'experimental cascade must causally alter learning trajectory');
console.log(`P2707_CASCADE_EXPERIMENTAL_LAYER=PASS diff=${diff.toFixed(5)} adaptiveMix=${e.adaptiveCreditMix01.toFixed(4)} astro=${e.astroGateMean01.toFixed(4)} cascadeNorm=${e.cascadeCreditNorm01.toFixed(4)}`);
