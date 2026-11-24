import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { verifyDecisionSemanticEvidence } from '../src/organism/system/DecisionSemanticEvidence.ts';

const cfg={performanceProfile:'mobile',cycleResultMode:'operational',checkpointMaxDirtyCycles:64,checkpointMinIntervalMs:60000};
const store=new MemoryStateStore();
const core=new OrganismCore(store,cfg);await core.init();
const times=[];
for(let i=0;i<256;i++){
  const t=performance.now();
  await core.observe({text:i%32===0?`long horizon checkpoint ${i}`:undefined,reward:i%17===0?.65:undefined,surprise:i%13===0?.24:.04,novelty:.35+(i%7)*.03,embodiment:{bodyEnergy01:.8-(i%19)*.006,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.88,awake:true,battery01:.78,cpuLoad01:.2,ramPressure01:.22}},'operational');
  times.push(performance.now()-t);
}
// Use the durable store as the restart boundary. Calling core.snapshot() here would add a full deep-clone cost to the long-horizon measurement and obscure the runtime hot-path result.
await core.flush();
const snap=await store.load();
assert.ok(snap);
assert.equal(snap.state.tick,256);
assert.ok(snap.traces.length>=8);
assert.ok(snap.traces.every(t=>verifyDecisionSemanticEvidence(t).pass));
const first=times.slice(0,32).reduce((a,b)=>a+b,0)/32;
const last=times.slice(-32).reduce((a,b)=>a+b,0)/32;
assert.ok(last<Math.max(10*first,500),`slowdown first=${first} last=${last}`);
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),cfg);await restored.init();
await restored.observe({novelty:.42,embodiment:{bodyEnergy01:.76,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.9,awake:true,battery01:.77,cpuLoad01:.21,ramPressure01:.22}},'operational');
const rs=restored.consolidationInputSnapshot();
const status=restored.operationalStatusSnapshot();
assert.ok(status.tick>=257);
assert.ok(rs.traces.length>=1);
assert.ok(verifyDecisionSemanticEvidence(rs.traces[0]).pass);
console.log(JSON.stringify({pass:true,cycles:256,restartedTick:status.tick,firstMs:first,lastMs:last,ratio:last/Math.max(first,.001),memoryCount:status.memoryCount}));
process.exit(0);
