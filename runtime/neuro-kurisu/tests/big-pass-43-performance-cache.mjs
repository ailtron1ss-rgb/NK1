import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const store = new MemoryStateStore();
const core = new OrganismCore(store,{checkpointMinIntervalMs:5000,checkpointMaxDirtyCycles:32});
await core.init();
const samples=[];
for(let i=0;i<40;i++){
  const t=performance.now();
  await core.observeOperational({reward:i%9===0?.7:undefined,embodiment:{bodyEnergy01:.82,thermalStrain01:.16,cognitiveCapacity01:.84,sensoryFreshness01:.86,awake:true,battery01:.82,cpuLoad01:.2,ramPressure01:.18}});
  samples.push(performance.now()-t);
}
const first=samples.slice(0,10).reduce((a,b)=>a+b,0)/10;
const last=samples.slice(-10).reduce((a,b)=>a+b,0)/10;
const spine=core.cognitiveSpineScheduleSnapshot();
assert.equal(spine.lastTick,40);
assert.ok(spine.opportunities.research>0);
assert.ok(spine.skips.shadow+spine.skips.project>0,'adaptive cadence should skip some cold operations');
assert.ok(last/Math.max(first,.001)<8,'unexpected hot-path growth after cache optimization');
console.log(`BIG_PASS_43_PERFORMANCE_CACHE=PASS firstMedian=${first.toFixed(2)}ms lastMedian=${last.toFixed(2)}ms ratio=${(last/Math.max(first,.001)).toFixed(3)} spineSavings=${spine.savings01.toFixed(3)}`);
