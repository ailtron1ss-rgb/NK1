import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  const substrate = r.unifiedCognitiveSubstrateSnapshot();
  if (substrate.cycles < 30 || substrate.lastTick < 30) throw new Error('unified cognitive substrate did not integrate live runtime cycles');
  if (!Number.isFinite(substrate.coupling.actionReadiness01)) throw new Error('unified substrate coupling is not finite');
  await r.stop();
  // Simulate a crash window where the derived sidecar persisted a future
  // tick but the canonical organism store has an older/newly recovered tick.
  // This must not make every next cycle fail its monotonic tick guard.
  const substrateSidecarPath = path.join(dir, 'state.json.cognitive-substrate.json');
  const sidecar = JSON.parse(await readFile(substrateSidecarPath, 'utf8'));
  sidecar.lastTick = Number.MAX_SAFE_INTEGER;
  await writeFile(substrateSidecarPath, JSON.stringify(sidecar), 'utf8');
  const dependencySidecarPath = path.join(dir, 'state.json.cognitive-dependencies.json');
  const dependencySidecar = JSON.parse(await readFile(dependencySidecarPath, 'utf8'));
  dependencySidecar.lastTick = Number.MAX_SAFE_INTEGER;
  await writeFile(dependencySidecarPath, JSON.stringify(dependencySidecar), 'utf8');
  const restarted = new OrganismRuntime({
    stateFile:path.join(dir,'state.json'),
    worldStateFile:path.join(dir,'world.json'),
    enableLanguage:false,
    stateStore:new MemoryStateStore(),
    worldStateStore:new MemoryStateStore(),
    journal:new BoundedOperationalJournal(),
    performanceProfile:'mobile',
    cycleResultMode:'summary',
  });
  await restarted.init();
  const restoredSubstrate = restarted.unifiedCognitiveSubstrateSnapshot();
  if (restoredSubstrate.cycles < 30 || restoredSubstrate.lastTick > substrate.lastTick) {
    throw new Error('future substrate sidecar tick was not reconciled to the canonical Core tick');
  }
  const canonicalRestartTick = restarted.core.operationalStatusSnapshot().tick;
  const restoredDependencyGraph = restarted.cognitiveDependencyGraph.diagnostics();
  if (restoredDependencyGraph.lastTick > canonicalRestartTick) {
    throw new Error('future dependency-graph sidecar tick was not reconciled to the canonical Core tick');
  }
  const resumedStep = await restarted.autonomousStep();
  const afterReconciledCycle = restarted.unifiedCognitiveSubstrateSnapshot();
  const resumedDependencyGraph = restarted.cognitiveDependencyGraph.diagnostics();
  if (resumedDependencyGraph.lastTick !== resumedStep.cycle.state.tick) {
    throw new Error('dependency graph did not resume on the canonical Core tick after recovery');
  }
  if (afterReconciledCycle.lastTick <= restoredSubstrate.lastTick || afterReconciledCycle.cycles <= restoredSubstrate.cycles) {
    throw new Error('runtime did not resume substrate integration after future-tick recovery');
  }
  await restarted.stop();

  // Unsupported/corrupted derived schema must reset only the dependency graph,
  // not abort organism initialization or the next autonomous cycle.
  const unsupportedDependencySidecar = JSON.parse(await readFile(dependencySidecarPath, 'utf8'));
  unsupportedDependencySidecar.version = 999;
  await writeFile(dependencySidecarPath, JSON.stringify(unsupportedDependencySidecar), 'utf8');
  const recoveredFromInvalidGraph = new OrganismRuntime({
    stateFile:path.join(dir,'state.json'),
    worldStateFile:path.join(dir,'world.json'),
    enableLanguage:false,
    stateStore:new MemoryStateStore(),
    worldStateStore:new MemoryStateStore(),
    journal:new BoundedOperationalJournal(),
    performanceProfile:'mobile',
    cycleResultMode:'summary',
  });
  await recoveredFromInvalidGraph.init();
  const resetGraph = recoveredFromInvalidGraph.cognitiveDependencyGraph.diagnostics();
  const recoveredCanonicalTick = recoveredFromInvalidGraph.core.operationalStatusSnapshot().tick;
  if (resetGraph.lastTick !== recoveredCanonicalTick || resetGraph.wakeMask !== 0) {
    throw new Error('unsupported derived graph schema did not reset to a safe canonical default');
  }
  const recoveryStep = await recoveredFromInvalidGraph.autonomousStep();
  if (recoveredFromInvalidGraph.cognitiveDependencyGraph.diagnostics().lastTick !== recoveryStep.cycle.state.tick) {
    throw new Error('organism did not complete a cognitive cycle after unsupported graph schema recovery');
  }
  await recoveredFromInvalidGraph.stop();
  console.log('CLEAN_ORGANISM_SMOKE=PASS');
} finally { await rm(dir,{recursive:true,force:true}); }
