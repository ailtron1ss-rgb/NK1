import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
const dir=await mkdtemp(path.join(tmpdir(),'nk-auto-'));
try {
  const r=new OrganismRuntime({stateFile:path.join(dir,'s.json'),worldStateFile:path.join(dir,'w.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal(),performanceProfile:'mobile',checkpointMaxDirtyCycles:12});
  await r.init(); let autonomous=0;
  for(let i=0;i<80;i++){const x=await r.step(); if(x.cycle.decision.selected?.action && x.cycle.decision.selected.action!=='wait') autonomous++;}
  if(autonomous<5) throw new Error(`autonomy too low: ${autonomous}`);
  console.log(`CLEAN_AUTONOMY=PASS ${autonomous}/80`);
  await r.stop();
} finally {await rm(dir,{recursive:true,force:true});}
