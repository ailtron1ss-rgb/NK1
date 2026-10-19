import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from '../src/organism/persistence/NoopOperationalJournal.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-r12-mobile-bench-'));
const times=[]; let maxHeap=0; let maxRss=0;
try {
  const runtime=new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new NoopOperationalJournal(),performanceProfile:'mobile',cycleResultMode:'summary'});
  await runtime.init();
  const started=performance.now();
  for(let i=0;i<30;i++){
    const t=performance.now();
    await runtime.autonomousStep();
    times.push(performance.now()-t);
    const mem=process.memoryUsage();
    maxHeap=Math.max(maxHeap,mem.heapUsed/1024/1024);
    maxRss=Math.max(maxRss,mem.rss/1024/1024);
  }
  await runtime.stop();
  const sorted=[...times].sort((a,b)=>a-b);
  const p50=sorted[Math.floor((sorted.length-1)*.50)] ?? 0;
  const p95=sorted[Math.floor((sorted.length-1)*.95)] ?? 0;
  const elapsed=performance.now()-started;
  assert.ok(p95 < 1200,`p95 too high: ${p95}`);
  assert.ok(maxHeap < 180,`heap too high: ${maxHeap}`);
  assert.ok(elapsed < 60000,`elapsed too high: ${elapsed}`);
  console.log(JSON.stringify({pass:true,cycles:times.length,elapsedMs:elapsed,p50Ms:p50,p95Ms:p95,maxCycleMs:Math.max(...times),maxHeapMB:maxHeap,maxRssMB:maxRss}));
} finally {
  await rm(dir,{recursive:true,force:true});
}
