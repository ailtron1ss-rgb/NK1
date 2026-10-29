import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';
import { migratePersistedOrganism } from '../src/organism/persistence/StateMigrations.ts';

// NK1 cognitive unified-ownership regression contract.
// Locks in the fixes that made the cognitive cycle share one canonical owner for
// reality evidence and survive duplicate feedback, restart, and migration.

// 1. RealityEvidenceLedger.mergeFrom must union, not replace, distinct writers.
{
  const ledger = new RealityEvidenceLedger(384);
  ledger.record({ tick: 1, realityClass: 'device-observation', claim: 'runtime-observation', independenceKey: 'k1' });
  ledger.mergeFrom({ version: 1, total: 1, recent: [{ id: 'core:1', tick: 1, at: 1, realityClass: 'user-reported', claim: 'core-observation', confidence01: 0.9, independenceKey: 'k2', parentIds: [] }] });
  const snap = ledger.snapshot();
  assert.equal(snap.recent.length, 2, 'merge must preserve both writers, not replace');
  assert.ok(snap.recent.some(row => row.claim === 'runtime-observation'), 'runtime writer survives merge');
  assert.ok(snap.recent.some(row => row.claim === 'core-observation'), 'core writer survives merge');
  // Idempotent: merging the same projection twice must not duplicate records.
  ledger.mergeFrom(snap);
  assert.equal(ledger.snapshot().recent.length, 2, 'merge must deduplicate by immutable id');
}


// Restore must reject malformed records and deduplicate immutable IDs.
{
  const restored = new RealityEvidenceLedger();
  const valid = { id: 'restore:one', tick: 7, at: 700, realityClass: 'external-observation', claim: 'valid', confidence01: 0.8, independenceKey: 'sensor-A', parentIds: ['parent-1'] };
  restored.restore({ version: 1, total: 9, externalCount: 0, simulatorCount: 0, independentSources: 0, recent: [
    valid,
    { ...valid },
    { ...valid, id: 'restore:bad-tick', tick: -1 },
    { ...valid, id: 'restore:bad-class', realityClass: 'untrusted-invented-class' },
    { ...valid, id: 'restore:bad-time', at: Number.NaN },
    null,
  ] });
  const restoredSnapshot = restored.snapshot();
  assert.equal(restoredSnapshot.recent.length, 1, 'restore accepts only valid, unique evidence records');
  assert.equal(restoredSnapshot.total, 9, 'restore preserves a valid cumulative total without trusting malformed rows');
  assert.equal(restoredSnapshot.externalCount, 1, 'external counts are recalculated from canonical records');
}

// 2. Migration must preserve runtime-namespaced cognitive slots across reload.
{
  const migrated = migratePersistedOrganism({ system: { runtimeCognitiveEventFabric: { version: 1, total: 7 }, runtimeCognitiveResourceEconomy: { version: 1, cycles: 4 }, runtimeUnifiedCognitiveCycle: { version: 1, cycles: 3 } } });
  assert.ok(migrated.system.runtimeCognitiveEventFabric, 'migration preserves runtime fabric slot');
  assert.ok(migrated.system.runtimeCognitiveResourceEconomy, 'migration preserves runtime economy slot');
  assert.ok(migrated.system.runtimeUnifiedCognitiveCycle, 'migration preserves runtime cycle slot');
}

// 3. End-to-end runtime: duplicate feedback must not abort learning, and the
//    canonical cycle/fabric/economy must survive a real restart round-trip.
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nk1-cog-regress-'));
  const stateFile = path.join(dir, 'organism.json');
  const worldStateFile = path.join(dir, 'world.json');
  const make = () => new OrganismRuntime({ stateFile, worldStateFile, stateStore: new FileStateStore(stateFile), enableLanguage: false, intervalMs: 60000 });
  const rt = make();
  await rt.init();
  await rt.step('first observation');
  // A repeated feedback for an already-closed tick previously threw and aborted
  // the rest of the learning/consolidation path; it must now be a bounded,
  // recorded no-op rather than a crash.
  await rt.core.feedback({ success: 0.6, reward: 0.2, surprise: 0.3, evidenceSource: 'user' });
  await rt.core.feedback({ success: 0.6, reward: 0.2, surprise: 0.3, evidenceSource: 'user' });
  const cycleBefore = rt.unifiedCognitiveCycleSnapshot().cycles;
  const fabricBefore = rt.cognitiveEventFabricSnapshot().total;
  const econBefore = rt.cognitiveResourceEconomySnapshot().cycles;
  const ledgerBefore = rt.realityEvidenceLedgerSnapshot();
  assert.ok(cycleBefore >= 1, 'at least one cognitive cycle must have been verified');
  assert.ok(ledgerBefore.recent.length >= 1, 'canonical ledger must retain runtime + core evidence');

  await rt.core.flush();
  await rt.stop();

  const rt2 = make();
  await rt2.init();
  assert.equal(rt2.unifiedCognitiveCycleSnapshot().cycles, cycleBefore, 'cycle counter survives restart');
  assert.equal(rt2.cognitiveEventFabricSnapshot().total, fabricBefore, 'fabric total survives restart');
  assert.equal(rt2.cognitiveResourceEconomySnapshot().cycles, econBefore, 'economy cycles survive restart');
  assert.equal(rt2.realityEvidenceLedgerSnapshot().recent.length, ledgerBefore.recent.length, 'reality ledger survives restart');
  await rt2.stop();
}

// 4. The architecture map must resolve every component path from the repository
//    root, independent of process.cwd().
{
  const { buildCognitiveArchitectureSnapshot, validateCognitiveArchitecture } = await import('../src/organism/core/CognitiveArchitectureMap.ts');
  const report = validateCognitiveArchitecture();
  assert.equal(report.ok, true, 'cognitive architecture map must validate');
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
  const missing = buildCognitiveArchitectureSnapshot().subsystems
    .flatMap(s => s.components)
    .filter(component => !fs.existsSync(path.join(root, component)));
  assert.deepEqual(missing, [], `unresolved architecture components: ${missing.join(', ')}`);
}


{
  const coreSource = fs.readFileSync(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
  assert.match(coreSource, /unifiedCognitiveSubstrate\\.actionBias\\(candidate\\.action\\)/, 'unified substrate must affect governed action scoring');
  assert.match(coreSource, /lastClosedCognitiveCycleTick/, 'same-tick cycle close must have a guard');
  assert.match(coreSource, /recordRealityEvidence\\(input:/, 'Core must expose the canonical evidence write path');
}

console.log('NK1_COGNITIVE_UNIFIED_OWNERSHIP_REGRESSION=PASS');
