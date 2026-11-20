import assert from 'node:assert/strict';
import { WorldForge } from '../src/organism/developmental/WorldForge.ts';

const forge=new WorldForge({maxCasesPerBatch:64});
const scenarios=forge.generate({split:'train',seed:20261117,count:64,difficulty01:.8});
const observed={resource:false,route:false,noise:false,deadline:false};
for(const scenario of scenarios){
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
    assert.equal(result.eventsApplied>=0,true);
  }
}
for(const key of Object.keys(observed))assert.equal(observed[key],true,`batch must exercise hidden ${key} perturbation without exposing its schedule`);

const scenario=scenarios[0];
let state=forge.startScenario(scenario);
const first=forge.step(state,{action:'observe'});
assert.equal(first.accepted,true);
const replay=forge.step(state,{action:'wait'});
assert.equal(replay.accepted,false,'a stale state snapshot must not fork or rewind a simulation');
const tampered={...first.state,resourcesRemaining:999999};
const next=forge.step(tampered,{action:'collect'});
assert.ok(next.state.resourcesRemaining<999999,'step must use evaluator-owned canonical state, not caller-mutated fields');
assert.equal(next.state.syntheticOnly,true);
assert.equal(forge.startScenario({...scenario,id:'unknown-scenario'}),null,'unknown scenarios must not start a simulation');
console.log('World Forge dynamic transitions and session integrity passed');
