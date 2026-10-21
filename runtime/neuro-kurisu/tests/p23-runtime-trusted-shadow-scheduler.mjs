import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-runtime-shadow-scheduler-'));
let runtime;
try {
  const stateFile = path.join(root, 'organism.json');
  runtime = new OrganismRuntime({
    stateFile,
    autoRun: false,
    enableLanguage: false,
    journal: { write: async () => {} },
    trustedShadowLearning: {
      enabled: true,
      intervalMs: 300_000,
      initialDelayMs: 300_000,
      runtimeVersion: 'nk1-runtime-scheduler-test',
      taskId: 'p23-runtime-smoke-task',
      taskVersion: 'v1',
      seedBase: 19,
      manifestFingerprint: 'a'.repeat(64),
      planFingerprint: 'b'.repeat(64),
      command: {
        executable: process.execPath,
        args: ['-e', "process.stdout.write(JSON.stringify({runId:process.env.NK1_LEARNING_RUN_ID,seed:process.env.NK1_LEARNING_SEED,arm:process.env.NK1_LEARNING_ARM,method:process.env.NK1_LEARNING_METHOD}))"],
        cwd: process.cwd(),
        runRoot: path.join(root, 'runs'),
        surviveDir: path.join(root, 'survive'),
        timeoutMs: 5000,
        maxOutputBytes: 4096,
      },
    },
  });

  assert.equal(runtime.trustedShadowLearningDiagnostics().enabled, true);
  assert.equal(runtime.persistenceMetrics().runtimeClocks['trusted-shadow-learning'] !== undefined, true);
  await runtime.init();

  // Exercise the same adapter that the production runtime clock calls, using a real Core,
  // the durable file registry and a real child process.
  const result = await runtime.runTrustedShadowLearningOnce();
  assert.equal(result.receipt.status, 'completed');
  assert.equal(result.receipt.exitCode, 0);
  const child = JSON.parse(result.receipt.stdout);
  assert.equal(child.runId, result.receipt.runId);
  assert.equal(child.arm, 'candidate');
  assert.equal(child.method, 'shadow');
  assert.equal(Number(child.seed), runtime.trustedShadowLearningDiagnostics().lastSeed);

  const registryPath = `${stateFile}.trusted-skill-shadow-runs.json`;
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  assert.equal(registry.runs.length, 1);
  assert.deepEqual(
    (({ runId, taskId, seed, manifestFingerprint, runtimeVersion }) =>
      ({ runId, taskId, seed, manifestFingerprint, runtimeVersion }))(registry.runs[0]),
    {
      runId: result.receipt.runId,
      taskId: 'p23-runtime-smoke-task',
      seed: Number(child.seed),
      manifestFingerprint: 'a'.repeat(64),
      runtimeVersion: 'nk1-runtime-scheduler-test',
    },
  );
  assert.equal(runtime.trustedShadowLearningDiagnostics().lastStatus, 'completed');
  assert.equal(runtime.trustedShadowLearningDiagnostics().runsStarted, 1);

  const disabled = new OrganismRuntime({
    stateFile: path.join(root, 'disabled-organism.json'),
    autoRun: false,
    enableLanguage: false,
    journal: { write: async () => {} },
  });
  assert.deepEqual(disabled.trustedShadowLearningDiagnostics(), { enabled: false });
  console.log('P23_RUNTIME_TRUSTED_SHADOW_SCHEDULER=PASS runtime-clock registration Core-owned provenance real child execution');
} finally {
  if (runtime) await runtime.stop().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
