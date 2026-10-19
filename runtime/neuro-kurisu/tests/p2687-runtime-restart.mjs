import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p2687-runtime-'));
let r1=null,r2=null;
try{
  const opts={stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal(),performanceProfile:'mobile',cycleResultMode:'summary'};
  r1=new OrganismRuntime(opts); await r1.init();
  for(let i=0;i<8;i++) await r1.autonomousStep();
  const before=r1.core.experienceContinuumSummary();
  assert(before.adaptiveReplayGovernor.cycles>0);
  assert(before.adaptiveReplayGovernor.schedules>0);
  await r1.flush(); await r1.stop(); r1=null;
  r2=new OrganismRuntime(opts); await r2.init();
  const after=r2.core.experienceContinuumSummary();
  assert(after.adaptiveReplayGovernor.selected>=before.adaptiveReplayGovernor.selected);
  assert(after.replay.events.length>=before.replay.events.length);
  const diag=after.adaptiveReplayGovernor;
  assert(diag.selectionRate01>=0&&diag.selectionRate01<=1);
  console.log(JSON.stringify({pass:true,status:'P2687_RUNTIME_RESTART_PASS',before:{tick:before.replay.lastAt,selected:before.adaptiveReplayGovernor.selected,schedules:before.adaptiveReplayGovernor.schedules},after:{selected:after.adaptiveReplayGovernor.selected,schedules:after.adaptiveReplayGovernor.schedules,feedbackUpdates:diag.feedbackUpdates,meanPriority01:diag.meanPriority01}}));
} finally { await r1?.stop(); await r2?.stop(); await rm(dir,{recursive:true,force:true}); }
