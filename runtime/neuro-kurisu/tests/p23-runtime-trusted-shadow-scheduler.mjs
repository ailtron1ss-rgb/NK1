import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { P23TrustedShadowLearningScheduler } from '../src/organism/learning/P23TrustedShadowLearningScheduler.ts';


// Focused RuntimeClockScheduler hardening: decision failures must not run tasks,
// and failures in either decision or error-reporting must not kill the clock loop.
{
  const keepAlive = setTimeout(() => {}, 300);
  const scheduler = new (await import('../src/organism/system/RuntimeClockScheduler.ts')).RuntimeClockScheduler();
  let taskCalls = 0;
  let decisionCalls = 0;
  let reportCalls = 0;
  try {
    scheduler.register({
      id: 'reflection',
      initialDelayMs: 0,
      decide: () => { decisionCalls += 1; throw new Error('policy-unavailable'); },
      task: () => { taskCalls += 1; },
      onError: () => { reportCalls += 1; throw new Error('reporter-unavailable'); },
    });
    scheduler.start('reflection');
    await new Promise(resolve => setTimeout(resolve, 30));
    scheduler.stop();
    await scheduler.drain();
    const stats = scheduler.snapshot().reflection;
    assert.equal(taskCalls, 0, 'a failed scheduling policy must block task execution');
    assert.ok(decisionCalls >= 1);
    assert.equal(reportCalls, 1);
    assert.ok(stats.skipped >= 1);
    assert.ok(stats.failures >= 2, 'decision and reporter errors must both be observable');
    assert.throws(() => scheduler.start('cognitive'), /not registered/);
    assert.throws(() => scheduler.register({ id: 'cognitive', initialDelayMs: Number.NaN, task: () => {} }), /initialDelayMs/);
  } finally {
    scheduler.stop();
    clearTimeout(keepAlive);
  }
}
{
  const keepAlive = setTimeout(() => {}, 300);
  const { RuntimeClockScheduler } = await import('../src/organism/system/RuntimeClockScheduler.ts');
  const scheduler = new RuntimeClockScheduler();
  let decideCalls = 0;
  let taskCalls = 0;
  try {
    scheduler.register({
      id: 'cognitive',
      initialDelayMs: 0,
      decide: () => {
        decideCalls += 1;
        if (decideCalls === 1) return { delayMs: 0, reason: 'admit-once', run: true };
        throw new Error('cadence-policy-failed');
      },
      task: () => { taskCalls += 1; },
    });
    scheduler.start('cognitive');
    await new Promise(resolve => setTimeout(resolve, 35));
    scheduler.stop();
    await scheduler.drain();
    assert.equal(taskCalls, 1, 'the first valid decision may run exactly one task');
    assert.ok(decideCalls >= 2, 'scheduler must exercise guarded post-run decision');
    assert.ok(scheduler.snapshot().cognitive.failures >= 1, 'post-run decision error must be counted');
  } finally {
    scheduler.stop();
    clearTimeout(keepAlive);
  }
}

{
  const keepAlive = setTimeout(() => {}, 500);
  const { RuntimeClockScheduler } = await import('../src/organism/system/RuntimeClockScheduler.ts');
  const scheduler = new RuntimeClockScheduler();
  let active = 0;
  let maximumActive = 0;
  let executions = 0;
  scheduler.register({
    id: 'reflection',
    initialDelayMs: 0,
    decide: () => ({ delayMs: 0, reason: 'rapid-restart-regression', run: true }),
    task: async () => {
      executions += 1;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise(resolve => setTimeout(resolve, 80));
      active -= 1;
    },
  });
  try {
    scheduler.start('reflection');
    await new Promise(resolve => setTimeout(resolve, 10));
    scheduler.restart();
    await new Promise(resolve => setTimeout(resolve, 230));
    scheduler.stop();
    await scheduler.drain();
    assert.ok(executions >= 2, 'restart should eventually resume the clock');
    assert.equal(maximumActive, 1, 'restart must never overlap tasks for the same clock');
    assert.equal(active, 0, 'drain must wait until active clock work has settled');
  } finally {
    scheduler.stop();
    clearTimeout(keepAlive);
  }
}

console.log('RUNTIME_CLOCK_FAIL_CLOSED_CONTRACT=PASS');

const invalidCandidateCore = {
  async runTrustedSkillShadowLearningProcess() { throw new Error('must-not-run'); },
  async recordVerifiedSkillShadow() {},
};
assert.throws(() => new P23TrustedShadowLearningScheduler(invalidCandidateCore, {
  enabled: true,
  runtimeVersion: 'nk1-invalid-candidate-test',
  taskId: 'invalid-candidate-test',
  taskVersion: 'v1',
  candidateId: 'not-a-candidate-fingerprint',
  manifestFingerprint: 'a'.repeat(64),
  planFingerprint: 'b'.repeat(64),
  command: {
    executable: process.execPath,
    args: [],
    cwd: process.cwd(),
    runRoot: path.join(os.tmpdir(), 'nk1-invalid-candidate-runs'),
    surviveDir: path.join(os.tmpdir(), 'nk1-invalid-candidate-survive'),
  },
}), /candidateId must be a 64-hex candidate fingerprint/);

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
      candidateId: 'c'.repeat(64),
      manifestFingerprint: 'a'.repeat(64),
      planFingerprint: 'b'.repeat(64),
      command: {
        executable: process.execPath,
        args: ['-e', "process.stdout.write(JSON.stringify({runId:process.env.NK1_LEARNING_RUN_ID,seed:process.env.NK1_LEARNING_SEED,arm:process.env.NK1_LEARNING_ARM,method:process.env.NK1_LEARNING_METHOD,candidateId:process.env.NK1_SKILL_CANDIDATE_ID,observationFile:process.env.NK1_LEARNING_SIGNED_OBSERVATION_FILENAME}))"],
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
  assert.equal(child.candidateId, 'c'.repeat(64));
  assert.equal(child.observationFile, 'verified-skill-shadow-observation.json');
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
  assert.equal(runtime.trustedShadowLearningDiagnostics().lastEvidenceStatus, 'missing', 'a zero-exit child with no signed observation must not create learning evidence');
  assert.match(runtime.trustedShadowLearningDiagnostics().lastEvidenceError, /ENOENT|no such file/i);
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
