import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store = new MemoryStateStore();
const core = new OrganismCore(store, {checkpointMinIntervalMs: 1000, checkpointMaxDirtyCycles: 16});
await core.init();
const times=[];
const heap=[];
for(let i=0;i<220;i++){
 const t=performance.now();
 await core.observe({text:i%11===0?`long horizon ${i}`:undefined,reward:i%17===0?.65:undefined,embodiment:{bodyEnergy01:.8,thermalStrain01:.2,cognitiveCapacity01:.8,awake:true,sensoryFreshness01:.8}});
 times.push(performance.now()-t);
 heap.push(process.memoryUsage().heapUsed);
}
await core.flush();
const first=times.slice(0,30).reduce((a,b)=>a+b,0)/30;
const last=times.slice(-30).reduce((a,b)=>a+b,0)/30;
const sorted=[...times].sort((a,b)=>a-b);
const percentile=(p)=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];
const state=core.snapshotLight();
const heapFirst=heap.slice(0,30).reduce((a,b)=>a+b,0)/30;
const heapLast=heap.slice(-30).reduce((a,b)=>a+b,0)/30;
const heapGrowth=((heapLast/Math.max(heapFirst,1))-1);
const ratio=last/Math.max(first,.001);
const scalingStatus = ratio > 7 || heapGrowth > 5 || percentile(.99) > Math.max(percentile(.50) * 20, 1000) ? 'FAIL' : (ratio > 3.5 || heapGrowth > 1.5 || percentile(.99) > Math.max(percentile(.50) * 8, 500)) ? 'WARNING' : 'PASS';
assert.ok(state.memoryCount < 700, `memoryCount=${state.memoryCount}`);
assert.ok(last < Math.max(first*10, 500), `long-horizon functional slowdown first=${first.toFixed(2)} last=${last.toFixed(2)}`);
console.log(JSON.stringify({
  LONG_HORIZON_FUNCTIONAL:'PASS', SCALING:scalingStatus, cycles:220,
  firstMs:first, lastMs:last, ratio, p50Ms:percentile(.50), p95Ms:percentile(.95), p99Ms:percentile(.99),
  heapFirstMB:heapFirst/1048576, heapLastMB:heapLast/1048576, heapGrowth01:heapGrowth,
  state,
}));
