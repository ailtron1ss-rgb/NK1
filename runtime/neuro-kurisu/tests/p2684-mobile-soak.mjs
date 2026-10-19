import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p2684-mobile-'));
const started=performance.now(); let peakRss=0; let cycles=0;
try {
  const r=new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal(),performanceProfile:'mobile',cycleResultMode:'summary'});
  await r.init();
  for(let i=0;i<30;i++){await r.autonomousStep(); cycles++; peakRss=Math.max(peakRss,process.memoryUsage().rss);}
  const elapsedMs=performance.now()-started;
  const summary=r.core.smokeSnapshotSummary();
  if(summary.tick<30||cycles!==30) throw new Error('mobile soak did not complete 30 cycles');
  await r.stop();
  console.log(JSON.stringify({pass:true,cycles,elapsedMs:Math.round(elapsedMs),elapsedSec:Number((elapsedMs/1000).toFixed(2)),peakRssBytes:peakRss,peakRssMb:Number((peakRss/1024/1024).toFixed(1)),tick:summary.tick}));
} finally { await rm(dir,{recursive:true,force:true}); }
