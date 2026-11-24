import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{cycleResultMode:'operational',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
const samples=[]; const heap=[]; const N=1000;
for(let i=0;i<N;i++){
  const t=performance.now();
  const r=await core.observeOperational({
    text:i%31===0?`1000-cycle probe ${i}`:undefined,
    reward:i%43===0?.73:undefined,
    embodiment:{bodyEnergy01:.8,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2}
  });
  assert.ok(r.decision);
  samples.push(performance.now()-t);
  if((i+1)%50===0) heap.push(process.memoryUsage().heapUsed/1048576);
}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const warm=samples.slice(300,350), last=samples.slice(-50);
const first=avg(warm); const final=avg(last);
const sorted=[...samples].sort((a,b)=>a-b); const p95=sorted[Math.floor(sorted.length*.95)-1]??sorted.at(-1);
const memoryCount=core.snapshotLight().memoryCount;
assert.ok(final/Math.max(first,.001)<5,`operational 1000-cycle steady-state scaling too high: ${first.toFixed(2)} -> ${final.toFixed(2)}`);
assert.ok(p95<120,`operational 1000-cycle p95 too high: ${p95.toFixed(2)}ms`);
assert.ok(memoryCount<=280,`canonical memory grew too far: ${memoryCount}`);
console.log(`LONG_HORIZON_OPERATIONAL_1000=PASS ratio=${(final/Math.max(first,.001)).toFixed(3)} steadyWarmMs=${first.toFixed(2)} lastMs=${final.toFixed(2)} p95=${p95.toFixed(2)} heapFirst=${heap[2].toFixed(2)} heapLast=${heap.at(-1).toFixed(2)} memory=${memoryCount}`);
