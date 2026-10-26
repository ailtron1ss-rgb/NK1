import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
const dir = await mkdtemp(path.join(tmpdir(), 'nk-clean-'));
try {
  const r = new OrganismRuntime({ stateFile:path.join(dir,'state.json'), worldStateFile:path.join(dir,'world.json'), enableLanguage:false, stateStore:new MemoryStateStore(), worldStateStore:new MemoryStateStore(), journal:new BoundedOperationalJournal(), performanceProfile:'mobile', cycleResultMode:'summary' });
  await r.init();
  for (let i=0;i<30;i++) await r.autonomousStep();
  const s=r.core.smokeSnapshotSummary();
  if (s.tick < 30) throw new Error('tick did not advance');
  if (!s.embodimentPresent || !s.selfAuthorshipPresent) throw new Error('P2/P3 state missing');
  if (s.worldTransitions <= 0) throw new Error('world model missing');
  if (s.p52Samples < 30) throw new Error('P52 development layer missing');
  const substrate=r.unifiedCognitiveSubstrateSnapshot();
  if (substrate.cycles < 30 || substrate.lastTick < 30) throw new Error('unified cognitive substrate did not integrate live runtime cycles');
  if (!Number.isFinite(substrate.coupling.actionReadiness01)) throw new Error('unified substrate coupling is not finite');
  await r.stop();
  const restarted = new OrganismRuntime({ stateFile:path.join(dir,'state.json'), worldStateFile:path.join(dir,'world.json'), enableLanguage:false, stateStore:new MemoryStateStore(), worldStateStore:new MemoryStateStore(), journal:new BoundedOperationalJournal(), performanceProfile:'mobile', cycleResultMode:'summary' });
  await restarted.init();
  const restoredSubstrate = restarted.unifiedCognitiveSubstrateSnapshot();
  if (restoredSubstrate.cycles < 30 || restoredSubstrate.lastTick < substrate.lastTick) throw new Error('unified cognitive substrate did not survive restart');
  await restarted.stop();
  console.log('CLEAN_ORGANISM_SMOKE=PASS');
} finally { await rm(dir,{recursive:true,force:true}); }
