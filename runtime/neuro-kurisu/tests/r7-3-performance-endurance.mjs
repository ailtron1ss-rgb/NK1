import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const cycles=Math.max(40,Math.min(240,Number(process.env.R73_CYCLES??80)));
const meanBudgetMs=Number(process.env.R73_MEAN_BUDGET_MS??180);
const p95BudgetMs=Number(process.env.R73_P95_BUDGET_MS??320);
const postGcHeapBudgetMB=Number(process.env.R73_POST_GC_HEAP_BUDGET_MB??160);
const core=new OrganismCore(new MemoryStateStore(),{
  performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:600000,checkpointMaxDirtyCycles:256,
});
await core.init();
const times=[]; const samples=[];
for(let i=0;i<cycles;i++){
  const started=performance.now();
  await core.observe({
    text:i%8===0?`R7.3 endurance ${i}`:undefined,
    novelty:i%7===0?.72:.28,
    surprise:i%11===0?.62:.10,
    embodiment:{bodyEnergy01:.86,cognitiveCapacity01:.86,thermalStrain01:.18,battery01:.84,cpuLoad01:.20,ramPressure01:.18,sensoryFreshness01:.84,awake:true},
  });
  times.push(performance.now()-started);
  if((i+1)%10===0){
    const before=process.memoryUsage().heapUsed/1048576;
    if(typeof global.gc==='function') global.gc();
    const after=process.memoryUsage().heapUsed/1048576;
    samples.push({cycle:i+1,meanMs:times.reduce((a,b)=>a+b,0)/times.length,lastMs:times.at(-1),heapMB:before,postGcHeapMB:after});
  }
}
const sorted=[...times].sort((a,b)=>a-b);
const meanMs=times.reduce((a,b)=>a+b,0)/times.length;
const p95Ms=sorted[Math.floor((sorted.length-1)*.95)];
const maxPostGcHeapMB=Math.max(...samples.map(x=>x.postGcHeapMB));
assert.ok(meanMs<=meanBudgetMs,`mean ${meanMs.toFixed(2)}ms > budget ${meanBudgetMs}ms`);
assert.ok(p95Ms<=p95BudgetMs,`p95 ${p95Ms.toFixed(2)}ms > budget ${p95BudgetMs}ms`);
assert.ok(maxPostGcHeapMB<=postGcHeapBudgetMB,`post-GC heap ${maxPostGcHeapMB.toFixed(1)}MB > budget ${postGcHeapBudgetMB}MB`);
console.log(JSON.stringify({PASS:true,kind:'performance-endurance',profile:'mobile',cycles,meanMs,p50Ms:sorted[Math.floor((sorted.length-1)*.5)],p95Ms,lastMs:times.at(-1),maxPostGcHeapMB,samples,budgets:{meanBudgetMs,p95BudgetMs,postGcHeapBudgetMB}},null,2));
