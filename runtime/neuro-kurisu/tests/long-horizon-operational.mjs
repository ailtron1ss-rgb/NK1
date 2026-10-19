import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{cycleResultMode:'operational',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:32});
await core.init();
const times=[];
for(let i=0;i<96;i++){
  const started=performance.now();
  const result=await core.observeOperational({text:i%17===0?`operational horizon ${i}`:undefined,reward:i%23===0?.72:undefined,embodiment:{bodyEnergy01:.78,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.78,cpuLoad01:.25,ramPressure01:.22}});
  times.push(performance.now()-started);
  assert.ok(result.memories.length<=16);
  assert.equal(result.advanced,undefined);
}
await core.flush();
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const first=avg(times.slice(0,30)),last=avg(times.slice(-30));
const sorted=[...times].sort((a,b)=>a-b);
const q=p=>sorted[Math.floor((sorted.length-1)*p)];
assert.ok(last < Math.max(first*12,800));
console.log(`LONG_HORIZON_OPERATIONAL=PASS ratio=${(last/Math.max(first,.001)).toFixed(3)} firstMs=${first.toFixed(2)} lastMs=${last.toFixed(2)} p95=${q(.95).toFixed(2)} p99=${q(.99).toFixed(2)}`);
