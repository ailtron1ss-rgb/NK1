import { mkdtemp } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

process.stdin?.unref?.();
const dir=await mkdtemp(path.join(tmpdir(),'nk-file-mobile-'));
const statePath=path.join(dir,'state.json');
const worldPath=path.join(dir,'world.json');
const runtime=new OrganismRuntime({
  stateFile:statePath,worldStateFile:worldPath,enableLanguage:false,
  stateStore:new FileStateStore(statePath,{backupEverySaves:32,directoryFsyncEverySaves:32}),
  worldStateStore:new FileStateStore(worldPath,{backupEverySaves:32,directoryFsyncEverySaves:32}),
  journal:new BoundedOperationalJournal(),performanceProfile:'mobile',cycleResultMode:'summary'
});
const started=performance.now();
let peakRss=0;
try{
  await runtime.init();
  for(let i=0;i<30;i++){
    await runtime.autonomousStep();
    peakRss=Math.max(peakRss,process.memoryUsage().rss);
    if((i+1)%5===0)console.log(JSON.stringify({
      tick:i+1,elapsedMs:Math.round(performance.now()-started),
      rssMb:Number((process.memoryUsage().rss/1048576).toFixed(1)),
      heapMb:Number((process.memoryUsage().heapUsed/1048576).toFixed(1)),
      state:runtime.persistenceMetrics().world
    }));
  }
  await runtime.stop();
  await new Promise(resolve=>setImmediate(resolve));
  const requests=(process._getActiveRequests?.()??[]).map(x=>x?.constructor?.name);
  if(requests.length)throw new Error(`runtime left active requests after stop: ${requests.join(',')}`);
  const handles=(process._getActiveHandles?.()??[]).map(x=>x?.constructor?.name);
  const resources=(process.getActiveResourcesInfo?.()??[]);
  console.log(JSON.stringify({
    pass:true,tick:runtime.core.operationalStatusSnapshot().tick,
    elapsedMs:Math.round(performance.now()-started),
    peakRssMb:Number((peakRss/1048576).toFixed(1)),handles,requests,resources
  }));
  // The container runner can retain stdio PipeWrap resources; runtime-owned requests are already zero.
  rmSync(dir,{recursive:true,force:true});
  process.exit(0);
}catch(error){
  try{rmSync(dir,{recursive:true,force:true});}catch{}
  throw error;
}
