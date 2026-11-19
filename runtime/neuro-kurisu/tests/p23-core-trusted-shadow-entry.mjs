import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-core-shadow-entry-'));
try {
  const stateFile = path.join(root, 'organism.json');
  const core = new OrganismCore(new FileStateStore(stateFile), {
    checkpointMinIntervalMs: 0,
    checkpointMaxDirtyCycles: 1,
  });
  await core.init();

  const run = {
    runId: 'core-shadow-run-141', taskId: 'task-141', taskVersion: 'v1',
    seed: 141, manifestFingerprint: 'a'.repeat(64), arm: 'candidate', method: 'shadow',
  };
  const result = await core.runTrustedSkillShadowLearningProcess({
    runtimeVersion: 'nk1-test-runtime-141',
    run,
    planFingerprint: 'b'.repeat(64),
    command: {
      executable: process.execPath,
      args: ['-e', "process.stdout.write(JSON.stringify({runId:process.env.NK1_LEARNING_RUN_ID, arm:process.env.NK1_LEARNING_ARM, method:process.env.NK1_LEARNING_METHOD}))"],
      cwd: process.cwd(),
      runRoot: path.join(root, 'runs'),
      surviveDir: path.join(root, 'survive'),
      timeoutMs: 3000,
      maxOutputBytes: 4096,
    },
  });

  assert.equal(result.receipt.status, 'completed');
  assert.deepEqual(JSON.parse(result.receipt.stdout), {
    runId: run.runId, arm: 'candidate', method: 'shadow',
  });
  assert.equal(result.receipt.runId, run.runId);

  // Assert the actual Core-owned durable registry—not a test double—was written.
  const registryPath = `${stateFile}.trusted-skill-shadow-runs.json`;
  const persisted = JSON.parse(await readFile(registryPath, 'utf8'));
  assert.equal(persisted.schemaVersion, 1);
  assert.equal(persisted.revision, 1);
  assert.equal(persisted.runs.length, 1);
  assert.deepEqual(
    (({ runId, taskId, seed, manifestFingerprint, runtimeVersion }) =>
      ({ runId, taskId, seed, manifestFingerprint, runtimeVersion }))(persisted.runs[0]),
    {
      runId: run.runId, taskId: run.taskId, seed: run.seed,
      manifestFingerprint: run.manifestFingerprint, runtimeVersion: 'nk1-test-runtime-141',
    },
  );

  // A new Core instance must see the existing context and treat exact re-registration as idempotent.
  const restarted = new OrganismCore(new FileStateStore(stateFile));
  const restored = restarted.registerTrustedSkillShadowRun({
    runId: run.runId, taskId: run.taskId, seed: run.seed,
    manifestFingerprint: run.manifestFingerprint, runtimeVersion: 'nk1-test-runtime-141',
  });
  assert.equal(restored.registeredAt, persisted.runs[0].registeredAt);

  assert.throws(() => core.runTrustedSkillShadowLearningProcess({
    runtimeVersion: 'nk1-test-runtime-141',
    run: { ...run, runId: 'baseline-must-not-register', arm: 'control', method: 'baseline' },
    planFingerprint: 'b'.repeat(64),
    command: {
      executable: process.execPath, args: ['-e', 'process.exit(0)'],
      cwd: process.cwd(), runRoot: path.join(root, 'baseline-runs'),
      surviveDir: path.join(root, 'baseline-survive'),
    },
  }), /only candidate\/shadow runs/);
  assert.equal(JSON.parse(await readFile(registryPath, 'utf8')).runs.length, 1);

  // A corrupt durable registry must fail closed before the child process can create its marker.
  const brokenState = path.join(root, 'broken-organism.json');
  const brokenRegistry = `${brokenState}.trusted-skill-shadow-runs.json`;
  await writeFile(brokenRegistry, '{broken-json', 'utf8');
  const brokenCore = new OrganismCore(new FileStateStore(brokenState));
  const spawnMarker = path.join(root, 'must-not-spawn.txt');
  await assert.rejects(() => brokenCore.runTrustedSkillShadowLearningProcess({
    runtimeVersion: 'nk1-test-runtime-141',
    run: { ...run, runId: 'corrupt-registry-must-not-spawn' },
    planFingerprint: 'c'.repeat(64),
    command: {
      executable: process.execPath,
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(spawnMarker)}, 'spawned')`],
      cwd: process.cwd(), runRoot: path.join(root, 'broken-runs'),
      surviveDir: path.join(root, 'broken-survive'),
    },
  }), /corrupt|invalid/i);
  await assert.rejects(() => access(spawnMarker), { code: 'ENOENT' });

  console.log('P23_CORE_TRUSTED_SHADOW_ENTRY=PASS durable-registration restart-idempotency fail-closed-before-spawn');
} finally {
  await rm(root, { recursive: true, force: true });
}
