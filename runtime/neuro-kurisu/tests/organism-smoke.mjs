import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
const dir = await mkdtemp(path.join(tmpdir(), 'nk-clean-'));
try {
  const r = new OrganismRuntime({ stateFile:path.join(dir,'state.json'), worldStateFile:path.join(dir,'world.json'), enableLanguage:false, enableScientificMethod:true, stateStore:new MemoryStateStore(), worldStateStore:new MemoryStateStore(), journal:new BoundedOperationalJournal(), performanceProfile:'mobile', cycleResultMode:'summary' });
  await r.init();
  for (let i=0;i<30;i++) await r.autonomousStep();
  const s=r.core.smokeSnapshotSummary();
  if (s.tick < 30) throw new Error('tick did not advance');
  if (!s.embodimentPresent || !s.selfAuthorshipPresent) throw new Error('P2/P3 state missing');
  if (s.worldTransitions <= 0) throw new Error('world model missing');
  if (s.p52Samples < 30) throw new Error('P52 development layer missing');
  const mechanismExperiments = r.core.organismMechanismExperimentQueue();
  if (mechanismExperiments.length === 0) throw new Error('live Mechanism Serendipity hypotheses were not queued');
  if (mechanismExperiments.some(x => x.action !== 'verify' || x.status !== 'candidate' || x.epistemicStatus !== 'hypothesis' || x.verificationRequired !== true)) {
    throw new Error('mechanism queue promoted an unverified hypothesis or exposed a non-verify action');
  }
  console.log('CLEAN_ORGANISM_SMOKE=PASS');
  await r.stop();
} finally { await rm(dir,{recursive:true,force:true}); }
