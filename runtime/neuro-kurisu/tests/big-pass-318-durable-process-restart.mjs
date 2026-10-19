import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKER = new URL('./big-pass-318-process-worker.mjs', import.meta.url);
const CONFIG = {
  performanceProfile:'mobile',
  cycleResultMode:'operational',
  enableTemporalResolutionGovernor:true,
  operationalPulseEvery:2,
  checkpointMaxDirtyCycles:1,
  checkpointMinIntervalMs:0,
};

function runWorker(phase, stateFile) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', WORKER.pathname, phase, stateFile], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, NEURO_RUNTIME_PROFILE:'mobile', NEURO_CHECKPOINT_MIN_INTERVAL_MS:'0', NEURO_CHECKPOINT_MAX_DIRTY_CYCLES:'1' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`B318 worker ${phase} exited ${result.status}:\nSTDOUT=${result.stdout}\nSTDERR=${result.stderr}`);
  }
  const lines = result.stdout.trim().split(/\n/).filter(Boolean);
  const jsonLine = [...lines].reverse().find(line => line.startsWith('B318_RESULT '));
  assert.ok(jsonLine, `B318 ${phase} worker produced no result marker`);
  return JSON.parse(jsonLine.slice('B318_RESULT '.length));
}

async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'neuro-kurisu-b318-'));
  const stateFile = join(dir, 'organism-state.json');
  try {
    const before = runWorker('write', stateFile);
    const fileStat = await stat(stateFile);
    const raw = JSON.parse(await readFile(stateFile, 'utf8'));
    assert.ok(fileStat.size > 1000, 'B318 durable state file is unexpectedly small');
    assert.ok(raw?.state?.tick >= before.tick, 'B318 state file tick is not durable');
    assert.ok(raw?.facets?.advanced, 'B318 persisted advanced facets missing');
    assert.ok(raw?.facets?.evolution, 'B318 persisted evolution facets missing');

    const after = runWorker('restart', stateFile);
    assert.equal(after.loadedTick, before.tick, 'B318 restart lost durable tick');
    assert.equal(after.loadedLearningUpdates, before.learningUpdates, 'B318 restart lost learning updates');
    assert.equal(after.loadedClosureCycles, before.closureCycles, 'B318 restart lost cognitive closure cycles');
    assert.equal(after.loadedAction, before.lastAction, 'B318 restart lost last selected action');
    assert.ok(after.resumedTick > after.loadedTick, 'B318 resumed process did not advance tick');
    assert.ok(after.resumedLearningUpdates > after.loadedLearningUpdates, 'B318 resumed process did not continue learning');
    assert.ok(after.resumedClosureCycles > after.loadedClosureCycles, 'B318 resumed process did not continue cognitive closure');
    assert.notEqual(after.processPid, before.processPid, 'B318 did not cross a real process boundary');

    const freshStore = new FileStateStore(stateFile, { backupEverySaves: 2, directoryFsyncEverySaves: 1 });
    const directLoad = await freshStore.load();
    assert.equal(directLoad.state.tick, after.resumedTick, 'B318 post-resume store load mismatch');
    assert.equal(directLoad.facets.learning.neuromodulation ? typeof directLoad.facets.learning.neuromodulation : 'missing', 'object', 'B318 neuro state missing after restart');

    const result = {
      pass:true,
      stateFileBytes:fileStat.size,
      before,
      after,
      durable:{loadedFromSameFile:true, postResumeTick:directLoad.state.tick},
      contract:{realProcessBoundary:true, durableStoreLoad:true, resumedLearning:true, resumedClosure:true},
    };
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await rm(dir, { recursive:true, force:true });
  }
}

await main();
