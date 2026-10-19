import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RuntimeClosureLedger } from '../src/organism/system/RuntimeClosureLedger.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const work = await mkdtemp(path.join(tmpdir(), 'neuro-kurisu-p2685-'));
const stateFile = path.join(work, 'organism.json');
let runtime = null;
let restored = null;

try {
  const direct = new RuntimeClosureLedger();
  const directStep = direct.step({ at: Date.now(), previousTick: 0, stateTick: 1, cycleTick: 1, continuousTick: 1, processed: 1, previousProcessed: 0, continuity01: .72, action: 'observe' });
  assert.equal(directStep.status, 'PASS');
  const directDurable = direct.durable({ at: Date.now(), tick: 1, stateTick: 1, replaySignature: 'abc', continuousTick: 1, continuityProcessed: 1, memoryCount: 3 });
  assert.equal(directDurable.status, 'PASS');
  assert(direct.snapshot().lastDurableHash.length === 64);
  const invalidBounds = new RuntimeClosureLedger().step({ at: Date.now(), previousTick: 0, stateTick: 1, cycleTick: 1, continuousTick: 1, continuity01: 1.4, energy01: -0.2, uncertainty01: .4, identityContinuity01: .8, predictionError01: .1, action: 'observe' });
  assert.equal(invalidBounds.status, 'FAIL', 'bounded closure must reject values outside 0..1');

  const originalSnapshot = OrganismCore.prototype.snapshot;
  let fullSnapshotCalls = 0;
  OrganismCore.prototype.snapshot = function (...args) {
    fullSnapshotCalls += 1;
    return originalSnapshot.apply(this, args);
  };

  runtime = new OrganismRuntime({
    stateFile,
    intervalMs: 5_000,
    enableLanguage: false,
    autoRun: false,
    performanceProfile: 'mobile',
    cycleResultMode: 'summary',
  });
  await runtime.init();
  const callsAfterInit = fullSnapshotCalls;

  const before = runtime.runtimeClosureDiagnostics();
  assert.equal(before.failures, 0);
  assert.equal(before.lastStatus, 'DEGRADED');

  const result = await runtime.runAutonomousCycles(10);
  assert.equal(result.cycles, 10);
  assert.equal(result.externalCommands, 0);

  const after = runtime.runtimeClosureDiagnostics();
  assert(after.checks >= 50, `too few closure checks: ${after.checks}`);
  assert.equal(after.failures, 0, JSON.stringify(after));
  assert.equal(after.lastStatus, 'PASS');
  assert(after.lastDurableHash.length === 64, 'durable closure fingerprint missing');
  assert(fullSnapshotCalls - callsAfterInit <= 1, `autonomous hot-path invoked full core.snapshot() ${fullSnapshotCalls - callsAfterInit} times`);

  await runtime.flush();
  const raw = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.equal(raw.system?.runtimeClosure?.version, 1);
  assert(raw.system?.runtimeClosure?.lastDurableHash, 'runtime closure was not persisted');
  const persistedProcessed = raw.system?.continuousCognitiveFabric?.processed ?? 0;
  assert(persistedProcessed >= 10, `continuous fabric persisted only ${persistedProcessed}`);
  const persistedTick = raw.system?.continuousCognitiveFabric?.tick ?? 0;
  assert.equal(persistedTick, raw.state.tick);

  const priorDurableHash = raw.system.runtimeClosure.lastDurableHash;
  const priorProcessed = persistedProcessed;
  const priorTick = raw.state.tick;
  runtime.stop();
  runtime = null;

  restored = new OrganismRuntime({
    stateFile,
    intervalMs: 5_000,
    enableLanguage: false,
    autoRun: false,
    performanceProfile: 'mobile',
    cycleResultMode: 'summary',
  });
  await restored.init();
  const restoreDiag = restored.runtimeClosureDiagnostics();
  assert.equal(restoreDiag.failures, 0, JSON.stringify(restoreDiag));
  assert.notEqual(restoreDiag.lastStatus, 'FAIL');
  assert(restoreDiag.checks >= after.checks, `restore evidence regressed: ${restoreDiag.checks} < ${after.checks}`);
  assert.equal(restored.core.operationalStatusSnapshot().tick, priorTick);

  await restored.runAutonomousCycles(2);
  await restored.flush();
  const raw2 = JSON.parse(await readFile(stateFile, 'utf8'));
  const processed2 = raw2.system?.continuousCognitiveFabric?.processed ?? 0;
  const tick2 = raw2.state?.tick ?? 0;
  assert(processed2 > priorProcessed, `restored runtime failed to advance continuous fabric: ${priorProcessed} -> ${processed2}`);
  assert(tick2 > priorTick, `restored runtime failed to advance tick: ${priorTick} -> ${tick2}`);
  assert(raw2.system?.runtimeClosure?.lastDurableHash, 'post-restore durable closure missing');
  assert.notEqual(raw2.system.runtimeClosure.lastDurableHash, priorDurableHash, 'durable closure fingerprint did not change after new cycles');

  console.log(JSON.stringify({
    pass: true,
    status: 'P2685_RUNTIME_CLOSURE_PASS',
    hotPath: { fullSnapshotCallsDuringAutonomousCycles: fullSnapshotCalls - callsAfterInit, callsAfterInit },
    closure: runtime?.runtimeClosureDiagnostics?.() ?? restored.runtimeClosureDiagnostics(),
    persistence: { tickBeforeRestart: priorTick, tickAfterRestore: tick2, processedBeforeRestart: priorProcessed, processedAfterRestore: processed2 },
  }, null, 2));
} finally {
  runtime?.stop();
  restored?.stop();
  await rm(work, { recursive: true, force: true });
}
