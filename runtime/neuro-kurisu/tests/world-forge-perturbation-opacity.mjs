import assert from 'node:assert/strict';
import { WorldForge } from '../src/organism/developmental/WorldForge.ts';

const forge=new WorldForge({maxCasesPerBatch:256});
const easy=forge.generate({split:'train',seed:20261117,count:1,difficulty01:.2})[0];
const hard=forge.generate({split:'train',seed:20261117,count:1,difficulty01:.9})[0];

assert.ok(easy&&hard);
assert.notEqual(easy.id,hard.id,'scenario identity must bind difficulty; different difficulty must not overwrite an active evaluator key');
assert.equal(Object.hasOwn(easy,'disturbances'),false,'public scenarios must not expose the hidden perturbation schedule');
assert.equal(Object.hasOwn(hard,'disturbances'),false,'public scenarios must not expose the hidden perturbation schedule');
assert.equal(Object.hasOwn(easy,'seedFingerprint'),false,'public scenarios must not disclose seed-derived fingerprints');

const observed={resource:false,route:false,noise:false,deadline:false};
const batch=forge.generate({split:'validation',seed:99173,count:256,difficulty01:.9});
for(const scenario of batch){
  let state=forge.startScenario(scenario);
  assert.ok(state);
  while(state.status==='active'){
    const before=state;
    const result=forge.step(state,{action:'wait'});
    assert.equal(result.accepted,true);
    state=result.state;
    if(state.resourcesRemaining<before.resourcesRemaining)observed.resource=true;
    if(state.blockedTargets.length>before.blockedTargets.length)observed.route=true;
    if(state.noise01>before.noise01)observed.noise=true;
    if(state.remainingSteps<before.remainingSteps-1)observed.deadline=true;
  }
}
for(const key of Object.keys(observed))assert.equal(observed[key],true,`the opaque simulator must eventually exercise ${key} perturbation`);
console.log('World Forge hidden perturbation schedule and identity collision regressions passed');
