import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'nk-p155-'));
const sf = path.join(dir, 'organism.json');
const wf = path.join(dir, 'world.json');
try {
  const store = new FileStateStore(sf, { backupEverySaves: 4 });
  const runtime = new OrganismRuntime({
    stateFile: sf,
    worldStateFile: wf,
    stateStore: store,
    worldStateStore: new FileStateStore(wf, { backupEverySaves: 4 }),
    enableLanguage: false,
    checkpointMinIntervalMs: 60_000,
    checkpointMaxDirtyCycles: 4,
    intervalMs: 10_000,
  });
  await runtime.init();
  for (let i = 0; i < 8; i++) await runtime.step();
  const metrics = runtime.core.persistenceMetrics();
  if (!metrics || metrics.saves < 2) throw new Error(`expected coalesced but durable saves, got ${JSON.stringify(metrics)}`);
  if (metrics.saves >= 8) throw new Error(`checkpoint coalescing inactive: ${JSON.stringify(metrics)}`);
  const before = runtime.core.snapshot().state.tick;
  await runtime.flush();
  await runtime.stop();

  const restored = new OrganismRuntime({stateFile: sf, worldStateFile: wf, enableLanguage: false, intervalMs: 99_999});
  await restored.init();
  const after = restored.core.snapshot().state.tick;
  if (after !== before) throw new Error(`flush/restart mismatch ${before} -> ${after}`);
  const onDisk = await stat(sf);
  if (onDisk.size <= 0) throw new Error('state file empty');
  await restored.stop();
  const autoDir = await mkdtemp(path.join(tmpdir(), 'nk-p155-auto-'));
  try {
    const autoRuntime = new OrganismRuntime({ stateFile: path.join(autoDir, 'o.json'), worldStateFile: path.join(autoDir, 'w.json'), enableLanguage: false, autoRun: true, intervalMs: 20, checkpointMinIntervalMs: 0 });
    await autoRuntime.init();
    const autoStart = autoRuntime.core.snapshot().state.tick;
    await new Promise(r => setTimeout(r, 90));
    await autoRuntime.stop();
    if (autoRuntime.core.snapshot().state.tick <= autoStart) throw new Error('autoRun did not advance organism cycle');
  } finally { await rm(autoDir, { recursive: true, force: true }); }
  console.log(`P15.5_DEVICE_HARDENING=PASS saves=${metrics.saves} bytes=${metrics.bytesWritten}`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
