import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{cycleResultMode:'operational',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
const samples=[]; const heap=[]; const N=500;
for(let i=0;i<N;i++){
  const t=performance.now();
  const r=await core.observeOperational({text:i%31===0?`500-cycle probe ${i}`:undefined,reward:i%43===0?.73:undefined,embodiment:{bodyEnergy01:.8,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2}});
  assert.ok(r.decision);
  const dt=performance.now()-t;
  samples.push(dt); if((i+1)%25===0) heap.push(process.memoryUsage().heapUsed/1048576);
}
const median=(a)=>{const b=[...a].sort((x,y)=>x-y);const m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
const first=median(samples.slice(300,350)); const last=median(samples.slice(-50));
const sorted=[...samples].sort((a,b)=>a-b);
const p95=sorted[Math.floor(sorted.length*.95)-1]??sorted.at(-1);
assert.ok(heap.length>=8);
assert.ok(last/Math.max(first,.001)<5,`operational 500-cycle steady-state scaling too high: ${first.toFixed(2)} -> ${last.toFixed(2)}`);
console.log(`LONG_HORIZON_OPERATIONAL_500=PASS ratio=${(last/Math.max(first,.001)).toFixed(3)} firstMs=${first.toFixed(2)} lastMs=${last.toFixed(2)} p95=${p95.toFixed(2)} heapFirst=${heap[0].toFixed(2)} heapLast=${heap.at(-1).toFixed(2)}`);
