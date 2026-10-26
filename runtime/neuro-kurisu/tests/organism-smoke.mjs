import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'nk-clean-'));
const stateFile = path.join(dir, 'state.json');
const worldStateFile = path.join(dir, 'world.json');
let runtime;
let runtimeStopped = false;
let restarted;
let restartedStopped = false;

const makeRuntime = () => new OrganismRuntime({
  stateFile,
  worldStateFile,
  enableLanguage: false,
  stateStore: new MemoryStateStore(),
  worldStateStore: new MemoryStateStore(),
  journal: new BoundedOperationalJournal(),
  performanceProfile: 'mobile',
  cycleResultMode: 'summary',
});

try {
  runtime = makeRuntime();
  await runtime.init();
  for (let i = 0; i < 30; i++) await runtime.autonomousStep();
  const summary = runtime.core.smokeSnapshotSummary();
  if (summary.tick < 30) throw new Error('tick did not advance');
  if (!summary.embodimentPresent || !summary.selfAuthorshipPresent) throw new Error('P2/P3 state missing');
  if (summary.worldTransitions <= 0) throw new Error('world model missing');
  if (summary.p52Samples < 30) throw new Error('P52 development layer missing');
  await runtime.stop();
  runtimeStopped = true;

  const firstSubstrate = JSON.parse(await readFile(`${stateFile}.cognitive-substrate.json`, 'utf8'));
  if (firstSubstrate.version !== 1) throw new Error('unified cognitive substrate sidecar missing/invalid');
  if (firstSubstrate.cycles < 30 || firstSubstrate.lastTick < summary.tick) {
    throw new Error('unified cognitive substrate did not persist the live runtime cycles');
  }

  // Core and world stores are deliberately fresh in-memory stores, while the
  // runtime-owned substrate sidecar survives. The derived frame must continue
  // monotonically across this restart instead of rejecting a reset Core tick.
  restarted = makeRuntime();
  await restarted.init();
  await restarted.autonomousStep();
  await restarted.stop();
  restartedStopped = true;
  const resumedSubstrate = JSON.parse(await readFile(`${stateFile}.cognitive-substrate.json`, 'utf8'));
  if (resumedSubstrate.cycles <= firstSubstrate.cycles) throw new Error('substrate cycle counter did not resume');
  if (resumedSubstrate.lastTick <= firstSubstrate.lastTick) throw new Error('substrate tick did not remain monotonic after restart');

  console.log(`CLEAN_ORGANISM_SMOKE=PASS tick=${summary.tick} substrateCycles=${resumedSubstrate.cycles} substrateTick=${resumedSubstrate.lastTick} restart=PASS`);
} finally {
  if (restarted && !restartedStopped) await restarted.stop().catch(() => {});
  if (runtime && !runtimeStopped) await runtime.stop().catch(() => {});
  await rm(dir, { recursive: true, force: true });
}
