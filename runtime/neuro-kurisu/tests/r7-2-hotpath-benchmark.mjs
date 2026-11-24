import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const cycles=Math.max(8, Math.min(32, Number(process.env.R72_CYCLES ?? 16)));
const core=new OrganismCore(new MemoryStateStore(), {
  performanceProfile:'mobile',
  cycleResultMode:'operational',
  checkpointMinIntervalMs:600000,
  checkpointMaxDirtyCycles:256,
});
await core.init();
const timings=[];
for(let i=0;i<cycles;i++){
  const t=performance.now();
  await core.observe({
    text:i%6===0?`R7.2 benchmark ${i}: verify uncertainty and preserve self-directed context.`:undefined,
    novelty:i%7===0?.72:.28,
    surprise:i%11===0?.62:.10,
    embodiment:{bodyEnergy01:.86,cognitiveCapacity01:.86,thermalStrain01:.18,battery01:.84,cpuLoad01:.20,ramPressure01:.18,sensoryFreshness01:.84,awake:true},
  });
  timings.push(performance.now()-t);
}
const sorted=[...timings].sort((a,b)=>a-b);
const mean=timings.reduce((a,b)=>a+b,0)/Math.max(1,timings.length);
const p50=sorted[Math.floor((sorted.length-1)*.50)];
const p95=sorted[Math.floor((sorted.length-1)*.95)];
const mem=process.memoryUsage();
console.log(JSON.stringify({PASS:true,profile:'mobile',cycles,meanMs:mean,p50Ms:p50,p95Ms:p95,lastMs:timings.at(-1),heapUsedBytes:mem.heapUsed,rssBytes:mem.rss,checkpoint:core.checkpointProfile()},null,2));
