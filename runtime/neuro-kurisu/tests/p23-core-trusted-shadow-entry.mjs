import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-core-shadow-entry-'));
const events = [];
try {
  // Exercise the real Core prototype method without constructing the full organism graph.
  const core = Object.create(OrganismCore.prototype);
  core.registerTrustedSkillShadowRun = async context => { events.push({ type: 'registered', context }); };
  const run = {
    runId: 'core-shadow-run-140', taskId: 'task-140', taskVersion: 'v1',
    seed: 140, manifestFingerprint: 'a'.repeat(64), arm: 'candidate', method: 'shadow',
  };
  const result = await core.runTrustedSkillShadowLearningProcess({
    runtimeVersion: 'nk1-test-runtime-140', run, planFingerprint: 'b'.repeat(64),
    command: {
      executable: process.execPath,
      args: ['-e', "process.stdout.write(JSON.stringify({runId:process.env.NK1_LEARNING_RUN_ID, arm:process.env.NK1_LEARNING_ARM, method:process.env.NK1_LEARNING_METHOD}))"],
      cwd: process.cwd(), runRoot: path.join(root, 'runs'), surviveDir: path.join(root, 'survive'),
      timeoutMs: 2000, maxOutputBytes: 4096,
    },
  });
  assert.equal(events.length, 1, 'Core must register exactly once before execution');
  assert.deepEqual(events[0].context, {
    runId: run.runId, taskId: run.taskId, seed: run.seed,
    manifestFingerprint: run.manifestFingerprint, runtimeVersion: 'nk1-test-runtime-140',
  });
  assert.equal(result.receipt.status, 'completed');
  assert.deepEqual(JSON.parse(result.receipt.stdout), { runId: run.runId, arm: 'candidate', method: 'shadow' });
  assert.equal(result.receipt.runId, run.runId);
  await assert.rejects(() => core.runTrustedSkillShadowLearningProcess({
    runtimeVersion: 'nk1-test-runtime-140',
    run: { ...run, arm: 'control', method: 'baseline' }, planFingerprint: 'b'.repeat(64),
    command: { executable: process.execPath, args: ['-e', 'process.exit(0)'], cwd: process.cwd(), runRoot: path.join(root, 'runs'), surviveDir: path.join(root, 'survive') },
  }), /only candidate\/shadow runs/);
  assert.equal(events.length, 1, 'rejected baseline must not be registered');
  console.log('P23_CORE_TRUSTED_SHADOW_ENTRY=PASS');
} finally { await rm(root, { recursive: true, force: true }); }
