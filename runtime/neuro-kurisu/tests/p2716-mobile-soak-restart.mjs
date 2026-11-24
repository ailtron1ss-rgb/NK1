import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{cycleResultMode:'operational',performanceProfile:'mobile',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
const samples=[];let last;
for(let i=0;i<320;i++){
  const t=performance.now();
  last=await core.observeOperational({text:i%37===0?`p2716 soak ${i}`:undefined,reward:i%41===0?.74:undefined,embodiment:{bodyEnergy01:.80,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.78,cpuLoad01:.24,ramPressure01:.22}});
  assert.ok(last.decision);samples.push(performance.now()-t);
}
const state=core.snapshot();
const branch=state.system?.neuralExperienceBranch;
assert.ok(state.state.tick>=320);
assert.ok(branch?.deepIntegration?.outcomes>=200,'deep integration did not receive live outcomes');
const persisted=await store.load(); assert.ok(persisted);
const restoredCore=new OrganismCore(store,{cycleResultMode:'operational',performanceProfile:'mobile',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await restoredCore.init();
const before=restoredCore.snapshot().state.tick;
const post=await restoredCore.observeOperational({reward:.68,embodiment:{bodyEnergy01:.80,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.78,cpuLoad01:.24,ramPressure01:.22}});
assert.ok(post.decision);assert.ok(restoredCore.snapshot().state.tick>=before);
const median=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]??0};
const first=median(samples.slice(80,140));const lastMed=median(samples.slice(-60));const ratio=lastMed/Math.max(first,.001);const heap=process.memoryUsage().heapUsed/1048576;
assert.ok(ratio<5.0,`mobile soak scaling too high: ${ratio}`);
console.log(`P2716_MOBILE_SOAK_RESTART=PASS ticks=${restoredCore.snapshot().state.tick} deepOutcomes=${restoredCore.snapshot().system.neuralExperienceBranch.deepIntegration.outcomes} firstMedianMs=${first.toFixed(2)} lastMedianMs=${lastMed.toFixed(2)} ratio=${ratio.toFixed(3)} heapMB=${heap.toFixed(1)} persisted=${persisted?1:0}`);
process.exit(0);
