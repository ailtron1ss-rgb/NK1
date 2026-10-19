import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const runs=Math.max(3,Math.min(5,Number(process.env.NEURO_BENCH_RUNS||3)));
const cycles=Math.max(120,Math.min(260,Number(process.env.NEURO_BENCH_CYCLES||180)));
const avg=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const median=a=>{const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
const q=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor((b.length-1)*p))];};
const ratios=[],p95=[],p99=[],retained=[];
for(let run=0;run<runs;run++){
  const core=new OrganismCore(new MemoryStateStore(),{enableLanguage:false,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:32});
  await core.init();
  const t=[];
  for(let i=0;i<cycles;i++){
    const started=performance.now();
    await core.observe({
      text:i%17===0?`statistical run ${run} observation ${i}`:undefined,
      reward:i%23===0?.72:undefined,
      evidenceKind:i%23===0?'external':'none',
      embodiment:{bodyEnergy01:.78-((i%17)/100),thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.78,cpuLoad01:.25,ramPressure01:.22},
    });
    t.push(performance.now()-started);
  }
  const first=avg(t.slice(0,30)),last=avg(t.slice(-30));
  ratios.push(last/Math.max(.001,first)); p95.push(q(t,.95)); p99.push(q(t,.99));
  if(typeof global.gc==='function')global.gc(); retained.push(process.memoryUsage().heapUsed/1048576);
  const light=core.snapshotLight(); assert.equal(light.tick,cycles);
}
const ratioMedian=median(ratios);
const result={runs,cycles,ratios:ratios.map(x=>Number(x.toFixed(3))),medianRatio:Number(ratioMedian.toFixed(3)),spread:Number((Math.max(...ratios)-Math.min(...ratios)).toFixed(3)),medianP95:Number(median(p95).toFixed(2)),medianP99:Number(median(p99).toFixed(2)),medianRetainedHeapMB:Number(median(retained).toFixed(2)),scaling:ratioMedian<=3.5?'PASS':'WARNING'};
console.log(`LONG_HORIZON_STATISTICAL=${result.scaling}`,JSON.stringify(result));
assert.ok(Number.isFinite(ratioMedian));
