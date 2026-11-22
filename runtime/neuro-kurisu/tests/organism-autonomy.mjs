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

  const tickBeforeAbort = r.core.operationalStatusSnapshot().tick;
  const cancelled = new AbortController();
  cancelled.abort();
  const aborted = await r.runAutonomousCycles(2, { signal: cancelled.signal });
  if (aborted.cycles !== 0 || aborted.stopReason !== 'aborted') {
    throw new Error(`pre-aborted autonomous batch must complete zero cycles: ${JSON.stringify(aborted)}`);
  }
  if (r.core.operationalStatusSnapshot().tick !== tickBeforeAbort) {
    throw new Error('pre-aborted autonomous batch must not mutate organism state');
  }
  const tickBeforeBudget = r.core.operationalStatusSnapshot().tick;
  const budgeted = await r.runAutonomousCycles(2, { maxDurationMs: 0 });
  if (budgeted.cycles !== 0 || budgeted.stopReason !== 'time-budget') {
    throw new Error(`zero-duration autonomous budget must complete zero cycles: ${JSON.stringify(budgeted)}`);
  }
  if (r.core.operationalStatusSnapshot().tick !== tickBeforeBudget) {
    throw new Error('zero-duration autonomous budget must not mutate organism state');
  }
  const batch = await r.runAutonomousCycles(2, { yieldEvery: 1 });
  if (batch.cycles !== 2 || batch.requestedCycles !== 2 || batch.stopReason !== 'completed') {
    throw new Error(`autonomous batch must report actual completed cycles: ${JSON.stringify(batch)}`);
  }
  console.log(`CLEAN_AUTONOMY=PASS ${autonomous}/80; cooperative-batch=PASS`);
  await r.stop();
} finally {await rm(dir,{recursive:true,force:true});}
