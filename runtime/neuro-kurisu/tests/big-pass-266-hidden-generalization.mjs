import assert from 'node:assert/strict';
import { B266HiddenTaskGeneralization } from '../src/organism/cognition/B266HiddenTaskGeneralization.ts';
import { B264CausalPolicyLearning } from '../src/organism/cognition/B264CausalPolicyLearning.ts';

const policy=new B264CausalPolicyLearning();
const choose=(family)=>({choose:(_state,step)=>{
  const actions=['respond','explore','verify','rest','reflect','wait','defer'];
  const preferred=family.adversarial && step%4===2?'verify':(step%3===0?'verify':step%2?'explore':'respond');
  return actions.includes(preferred)?preferred:actions[0];
}});
const g=new B266HiddenTaskGeneralization();
const res=g.evaluate([0,1,2,3,4,5,6,7].map(i=>choose({adversarial:i%2===0})),[0,1,2,3,4,5].map(i=>choose({adversarial:true})));
assert.equal(res.train.length,8); assert.equal(res.holdout.length,6);
assert.ok(res.metrics.hiddenFamilyGain01>-0.25);
assert.ok(res.metrics.longHorizonGain01>-0.25);
assert.ok(res.metrics.calibration01>=0 && res.metrics.calibration01<=1);
const stress=g.replayStress(); assert.ok(stress.episodes>=14);
const snap=g.snapshot(); const restored=new B266HiddenTaskGeneralization(); restored.restore(snap); assert.equal(restored.diagnostics().episodes,g.diagnostics().episodes); assert.equal(restored.diagnostics().families,g.diagnostics().families);
console.log(JSON.stringify({pass:true,metrics:res.metrics,stress,diagnostics:g.diagnostics()},null,2));
