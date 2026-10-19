import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-b338-core-'));
try {
  const r=new OrganismRuntime({stateFile:path.join(dir,'s.json'),worldStateFile:path.join(dir,'w.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal()});
  await r.init();
  for(let i=0;i<6;i++) await r.step();
  const d=r.core.b272EndogenousGoalDiagnostics();
  assert.ok(d.goalOutcomeMemoryEntries>=1,'real runtime world outcomes must train endogenous goal memory');
  assert.ok(d.learningUpdates>=1,'real runtime must increment endogenous goal learning updates');
  assert.ok(d.endogenousGoalRate01>=0,'diagnostics remain bounded');
  console.log(`B338_CORE_REAL_RUNTIME=PASS ticks=6 goalMemory=${d.goalOutcomeMemoryEntries} learning=${d.learningUpdates} closure=${d.learnedGoalClosure01.toFixed(3)}`);
  await r.stop();
} finally { await rm(dir,{recursive:true,force:true}); }
