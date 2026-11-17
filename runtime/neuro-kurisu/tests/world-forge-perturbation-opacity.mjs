import assert from 'node:assert/strict';
import { WorldForge } from '../src/organism/developmental/WorldForge.ts';

const forge=new WorldForge({maxCasesPerBatch:256});
const easy=forge.generate({split:'train',seed:20261117,count:1,difficulty01:.2})[0];
const hard=forge.generate({split:'train',seed:20261117,count:1,difficulty01:.9})[0];

assert.ok(easy&&hard);
assert.notEqual(easy.id,hard.id,'scenario identity must bind difficulty; regenerating the same seed at a different difficulty must not overwrite an active evaluator key');
assert.equal(Object.hasOwn(easy,'disturbances'),false,'public scenarios must not expose the hidden perturbation schedule');
assert.equal(Object.hasOwn(hard,'disturbances'),false,'public scenarios must not expose the hidden perturbation schedule');

const kinds=new Set();
const batch=forge.generate({split:'validation',seed:99173,count:256,difficulty01:.9});
for(const scenario of batch){
  let state=forge.startScenario(scenario);
  assert.ok(state);
  for(let tick=0;tick<scenario.constraints.maxSteps;tick++){
    const before=state;
    const result=forge.step(state,{action:'wait'});
    assert.equal(result.accepted,true);
    state=result.state;
    for(const kind of result.appliedDisturbances){
      kinds.add(kind);
      if(kind==='resource-shock')assert.ok(state.resourcesRemaining<before.resourcesRemaining);
      if(kind==='route-block')assert.ok(state.blockedTargets.length>before.blockedTargets.length);
      if(kind==='signal-noise')assert.ok(state.noise01>before.noise01);
      if(kind==='deadline-shift')assert.ok(state.remainingSteps<before.remainingSteps-1);
    }
    if(state.status==='exhausted')break;
  }
}
for(const kind of ['resource-shock','route-block','signal-noise','deadline-shift']){
  assert.ok(kinds.has(kind),`the opaque simulator must eventually exercise ${kind}`);
}
console.log('World Forge hidden perturbation schedule and identity collision regressions passed');
