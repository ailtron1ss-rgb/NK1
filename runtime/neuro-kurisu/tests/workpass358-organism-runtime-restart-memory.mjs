import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const MARKER = 'nk1 runtime restart causal memory marker-358 observer-8031 outcome-persisted-991';
const ENTRYPOINT = fileURLToPath(import.meta.url);

function findCanonicalMemoryRecord(coreSnapshot, marker) {
  const memoryState = coreSnapshot?.facets?.advanced?.memoryOS;
  assert.ok(memoryState && Number.isSafeInteger(memoryState.version),
    'OrganismCore snapshot must expose the canonical MemoryOS2 state under facets.advanced.memoryOS');
  assert.ok(Array.isArray(memoryState.items),
    'canonical MemoryOS2 snapshot must expose its own item collection');
  return memoryState.items.find(item =>
    item && typeof item.id === 'string' &&
    typeof item.content === 'string' &&
    typeof item.kind === 'string' &&
    item.content.includes(marker),
  ) ?? null;
}

function makeRuntime(stateFile, worldStateFile) {
  return new OrganismRuntime({
    stateFile,
    worldStateFile,
    autoRun: false,
    enableLanguage: false,
    intervalMs: 5_000,
    checkpointMinIntervalMs: 0,
    checkpointMaxDirtyCycles: 1,
    performanceProfile: 'mobile',
  });
}

async function writePhase(stateFile, worldStateFile) {
  const runtime = makeRuntime(stateFile, worldStateFile);
  let stopped = false;
  try {
    await runtime.init();
    await runtime.step(MARKER, { deliberate: true });
    await runtime.flush();
    const snapshot = runtime.core.snapshot();
    const row = findCanonicalMemoryRecord(snapshot, MARKER);
    assert.ok(row, 'the actual OrganismRuntime step must persist the marker as a canonical memory record');
    assert.ok(typeof row.id === 'string' && row.id.length > 0);
    // Exercise the same bounded Core memory-inspector query used by the HTTP
    // endpoint, not just direct inspection of the persisted state snapshot.
    const publicRecall = runtime.core.memoryInspectorSearch(MARKER, 8);
    assert.ok(publicRecall.some(item => item.id === row.id),
      'the running Core memory search must retrieve its canonical MemoryOS2 item');
    const tick = Number(runtime.core.operationalStatusSnapshot().tick);
    assert.ok(Number.isFinite(tick) && tick >= 1);
    await runtime.stop();
    stopped = true;
    console.log('WORKPASS358_WRITER=' + JSON.stringify({ tick, memoryId: row.id }));
  } finally {
    if (!stopped) await runtime.stop().catch(() => {});
  }
}

async function readPhase(stateFile, worldStateFile, expectedTick, expectedMemoryId) {
  const runtime = makeRuntime(stateFile, worldStateFile);
  let stopped = false;
  try {
    await runtime.init();
    const tick = Number(runtime.core.operationalStatusSnapshot().tick);
    assert.ok(tick >= expectedTick, 'whole-organism tick must survive a fresh-process restart');
    const snapshot = runtime.core.snapshot();
    const row = findCanonicalMemoryRecord(snapshot, MARKER);
    assert.ok(row, 'the restarted OrganismRuntime must expose the persisted canonical memory');
    assert.equal(row.id, expectedMemoryId, 'memory identity must survive the runtime process boundary');
    assert.ok(row.content.includes('outcome-persisted-991'));
    // After restart, prove the normal Core retrieval surface can still find
    // this same ID; no recursive scan or direct store lookup substitutes for recall.
    const publicRecall = runtime.core.memoryInspectorSearch(MARKER, 8);
    assert.ok(publicRecall.some(item => item.id === expectedMemoryId),
      'the restarted Core memory search must retrieve the same canonical memory ID');
    const integrity = runtime.core.persistentContinuityDiagnostics?.();
    if (integrity && typeof integrity.verified === 'boolean') {
      assert.equal(integrity.verified, true, 'organism continuity ledger must remain verified after restart');
    }
    await runtime.stop();
    stopped = true;
    console.log('WORKPASS358_READER=' + JSON.stringify({ tick, memoryId: row.id, continuityVerified: integrity?.verified ?? null }));
  } finally {
    if (!stopped) await runtime.stop().catch(() => {});
  }
}

const mode = process.argv[2];
const stateFile = process.argv[3];
const worldStateFile = process.argv[4];
if (mode === 'write') {
  await writePhase(stateFile, worldStateFile);
} else if (mode === 'read') {
  await readPhase(stateFile, worldStateFile, Number(process.argv[5]), process.argv[6]);
} else {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nk1-organism-restart-358-'));
  const statePath = path.join(dir, 'organism-state.json');
  const worldPath = path.join(dir, 'world-state.json');
  const runChild = (phase, args = []) => {
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types', ENTRYPOINT, phase, statePath, worldPath, ...args,
    ], { encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      throw new Error(
        'organism-restart-child-failed:' + phase +
        ':status=' + String(result.status) +
        ':error=' + String(result.error?.message ?? '') +
        ':stdout=' + String(result.stdout).slice(-3000) +
        ':stderr=' + String(result.stderr).slice(-6000),
      );
    }
    return result.stdout;
  };
  try {
    const writtenOutput = runChild('write');
    const writtenLine = writtenOutput.split(/\r?\n/u).find(line => line.startsWith('WORKPASS358_WRITER='));
    assert.ok(writtenLine, 'writer process must return its persisted tick and stable memory ID');
    const written = JSON.parse(writtenLine.slice('WORKPASS358_WRITER='.length));
    const readOutput = runChild('read', [String(written.tick), written.memoryId]);
    const readLine = readOutput.split(/\r?\n/u).find(line => line.startsWith('WORKPASS358_READER='));
    assert.ok(readLine, 'fresh reader process must confirm restored memory identity');
    const read = JSON.parse(readLine.slice('WORKPASS358_READER='.length));
    assert.equal(read.memoryId, written.memoryId);
    assert.ok(read.tick >= written.tick);
    console.log('WORKPASS358_FULL_ORGANISM_RESTART=PASS separate-process runtime + canonical memory');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
