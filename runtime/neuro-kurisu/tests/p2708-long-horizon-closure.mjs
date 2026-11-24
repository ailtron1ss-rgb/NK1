import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{cycleResultMode:'operational',performanceProfile:'mobile',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
const samples=[]; const heaps=[]; const N=250;
for(let i=0;i<N;i++){
  const t=performance.now();
  const r=await core.observeOperational({text:i%29===0?`250-cycle probe ${i}`:undefined,reward:i%41===0?.72:undefined,embodiment:{bodyEnergy01:.8,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2}});
  assert.ok(r.decision); samples.push(performance.now()-t);
  if((i+1)%25===0) heaps.push(process.memoryUsage().heapUsed/1048576);
}
const median=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]??0};
const first=median(samples.slice(60,100)); const last=median(samples.slice(-40)); const p95=median(samples.slice().sort((a,b)=>a-b).slice(-24));
const ratio=last/Math.max(first,.001); const heapGrowth=heaps.at(-1)/Math.max(heaps[2]??heaps[0]??1,1);
assert.ok(ratio<4.5,`operational 250-cycle median scaling too high: ${ratio}`);
console.log(`P2708_LONG_HORIZON_CLOSURE=PASS warmedMedianRatio=${ratio.toFixed(3)} firstMedianMs=${first.toFixed(2)} lastMedianMs=${last.toFixed(2)} p95Approx=${p95.toFixed(2)} heapGrowth=${heapGrowth.toFixed(3)}`);
process.exit(0);
