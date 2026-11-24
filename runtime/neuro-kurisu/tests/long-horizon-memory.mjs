import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64,enableLanguage:false});
await core.init();
const timings=[];
for(let i=0;i<240;i++){
 const t=performance.now();
 await core.observe({text:i%19===0?`long-horizon observation ${i}`:undefined,novelty:i%13===0?.74:.29,embodiment:{bodyEnergy01:.76,cognitiveCapacity01:.84,thermalStrain01:.18,sensoryFreshness01:.89,awake:true,battery01:.78,cpuLoad01:.23,ramPressure01:.22}});
 timings.push(performance.now()-t);
}
const s=core.snapshot();
assert.ok(s.traces.length<=320);
assert.ok(s.facets.memory.eventLog.length<=768);
assert.ok(s.facets.advanced.selfGovernance.records.length<=512);
assert.ok(s.facets.advanced.selfGovernance.consequences.length<=512);
assert.ok(s.facets.advanced.p62MemoryFabric.history.length<=64);
assert.ok(s.facets.advanced.p52CounterfactualDevelopment.trajectory.length<=256);
assert.ok(s.facets.advanced.p64IntegratedOrganismDynamics.history.length<=128);
assert.ok(s.goals.length<=100);
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
console.log('LONG_HORIZON_MEMORY=PASS',JSON.stringify({cycles:240,first40Ms:Number(avg(timings.slice(0,40)).toFixed(2)),last40Ms:Number(avg(timings.slice(-40)).toFixed(2)),traces:s.traces.length,events:s.facets.memory.eventLog.length,goals:s.goals.length,selfGovernance:s.facets.advanced.selfGovernance.records.length}));
