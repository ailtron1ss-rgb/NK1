import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from '../src/organism/persistence/NoopOperationalJournal.ts';
const dir = await mkdtemp(path.join(tmpdir(), 'nk-clean-'));
try {
  const r = new OrganismRuntime({ stateFile:path.join(dir,'state.json'), worldStateFile:path.join(dir,'world.json'), enableLanguage:false, stateStore:new MemoryStateStore(), worldStateStore:new MemoryStateStore(), journal:new NoopOperationalJournal(), performanceProfile:'mobile', cycleResultMode:'summary' });
  await r.init();
  for (let i=0;i<30;i++) await r.autonomousStep();
  const s=r.core.smokeSnapshotSummary();
  if (s.tick < 30) throw new Error('tick did not advance');
  if (!s.embodimentPresent || !s.selfAuthorshipPresent) throw new Error('P2/P3 state missing');
  if (s.worldTransitions <= 0) throw new Error('world model missing');
  if (s.p52Samples < 30) throw new Error('P52 development layer missing');
  console.log('CLEAN_ORGANISM_SMOKE=PASS');
  await r.stop();
} finally { await rm(dir,{recursive:true,force:true}); }
