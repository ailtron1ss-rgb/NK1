import assert from 'node:assert/strict';
import { WorldForge } from '../src/organism/developmental/WorldForge.ts';

const forge=new WorldForge({maxCasesPerBatch:64});
const scenarios=forge.generate({split:'train',seed:20261117,count:64,difficulty01:.8});
const byKind=new Map();
for(const scenario of scenarios){
  for(const disturbance of [...scenario.disturbances].sort((a,b)=>a.atStep-b.atStep)) if(!byKind.has(disturbance.kind))byKind.set(disturbance.kind,{scenario,disturbance});
}
for(const kind of ['resource-shock','route-block','signal-noise','deadline-shift'])assert.ok(byKind.has(kind),`seeded batch must cover disturbance kind ${kind}`);

for(const [kind,{scenario,disturbance}] of byKind){
  let state=forge.startScenario(scenario);
  assert.ok(state,`known scenario should start: ${scenario.id}`);
  let before=state;
  while(state.tick<disturbance.atStep){
    before=state;
    const transition=forge.step(state,{action:'wait'});
    assert.equal(transition.accepted,true);
    state=transition.state;
  }
  assert.ok(state.events.length>before.events.length,`${kind} must become an observable world event`);
  if(kind==='resource-shock')assert.ok(state.resourcesRemaining<before.resourcesRemaining);
  if(kind==='route-block')assert.ok(state.blockedTargets.length>before.blockedTargets.length);
  if(kind==='signal-noise')assert.ok(state.noise01>before.noise01);
  if(kind==='deadline-shift')assert.ok(state.remainingSteps<before.remainingSteps-1);
  assert.equal(state.syntheticOnly,true);
}

const scenario=scenarios[0];
let state=forge.startScenario(scenario);
const first=forge.step(state,{action:'observe'});
assert.equal(first.accepted,true);
const replay=forge.step(state,{action:'wait'});
assert.equal(replay.accepted,false,'a stale state snapshot must not fork or rewind a simulation');
const tampered={...first.state,resourcesRemaining:999999};
const next=forge.step(tampered,{action:'collect',cost:.1});
assert.ok(next.state.resourcesRemaining<999999,'step must use evaluator-owned canonical state, not caller-mutated fields');
assert.equal(next.state.syntheticOnly,true);
assert.equal(forge.startScenario({...scenario,id:'unknown-scenario'}),null,'unknown scenarios must not start a simulation');
console.log('World Forge dynamic transitions and session integrity passed');
