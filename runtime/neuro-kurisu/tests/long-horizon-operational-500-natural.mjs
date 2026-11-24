import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{cycleResultMode:'operational',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
const warm=60,N=500,samples=[],heap=[];
for(let i=0;i<N;i++){
 const t=performance.now();
 const r=await core.observeOperational({text:i%31===0?`500-natural ${i}`:undefined,reward:i%43===0?.73:undefined,embodiment:{bodyEnergy01:.8,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2}});
 assert.ok(r.decision); samples.push(performance.now()-t);
 if((i+1)%50===0) heap.push(process.memoryUsage().heapUsed/1048576);
}
const median=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]??0};
const first=median(samples.slice(warm+40,warm+90)); const last=median(samples.slice(-50)); const sorted=[...samples].sort((a,b)=>a-b); const p95=sorted[Math.floor(sorted.length*.95)]??0;
const heapBase=median(heap.slice(2,4)); const heapEnd=median(heap.slice(-2)); const ratio=last/Math.max(first,.001); const heapGrowth=heapEnd/Math.max(heapBase,.001);
assert.ok(ratio<4.5,`natural 500 ratio too high ${ratio}`);
assert.ok(heapGrowth<5,`natural 500 heap growth too high ${heapGrowth}`);
console.log(`LONG_HORIZON_OPERATIONAL_500_NATURAL=PASS warmedMedianRatio=${ratio.toFixed(3)} firstMedianMs=${first.toFixed(2)} lastMedianMs=${last.toFixed(2)} p95=${p95.toFixed(2)} heapGrowth=${heapGrowth.toFixed(3)} heapSeries=${heap.map(x=>x.toFixed(1)).join(',')}`);
