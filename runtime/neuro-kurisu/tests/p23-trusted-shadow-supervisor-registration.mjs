import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLearningProcess } from '../src/organism/learning/LearningProcessSupervisor.ts';

const dir = mkdtempSync(join(tmpdir(), 'nk1-trusted-supervisor-'));
try {
  const marker = join(dir, 'registered.json');
  const run = { runId: 'supervised-run-1', taskId: 'task-1', seed: 9, taskVersion: 'v1', manifestFingerprint: 'a'.repeat(64), arm: 'candidate', method: 'shadow' };
  const childCode = "const fs=require('node:fs'); if (!fs.existsSync(" + JSON.stringify(marker) + ")) process.exit(41); process.stdout.write('registered-before-spawn');";
  const command = { executable: process.execPath, args: ['-e', childCode], cwd: dir, runRoot: join(dir, 'runs'), surviveDir: join(dir, 'survive') };
  let registered = false;
  const result = await runLearningProcess(run, 'b'.repeat(64), command, {
    runtimeVersion: '35.90.0',
    register(context) {
      assert.deepEqual(context, { runId: run.runId, taskId: run.taskId, seed: run.seed, manifestFingerprint: run.manifestFingerprint, runtimeVersion: '35.90.0' });
      writeFileSync(marker, JSON.stringify(context), { flag: 'wx' }); registered = true;
    },
  });
  assert.equal(registered, true);
  assert.equal(result.receipt.status, 'completed');
  assert.match(result.receipt.stdout, /registered-before-spawn/);
  assert.deepEqual(JSON.parse(readFileSync(marker, 'utf8')), { runId: run.runId, taskId: run.taskId, seed: run.seed, manifestFingerprint: run.manifestFingerprint, runtimeVersion: '35.90.0' });
  await assert.rejects(() => runLearningProcess({ ...run, runId: 'registration-failure-run' }, 'c'.repeat(64), { ...command, runRoot: join(dir, 'failed-runs'), surviveDir: join(dir, 'failed-survive') }, { runtimeVersion: '35.90.0', register() { throw new Error('durable registry unavailable'); } }), /durable registry unavailable/);
  console.log('P23_TRUSTED_SHADOW_SUPERVISOR_REGISTRATION=PASS');
} finally { rmSync(dir, { recursive: true, force: true }); }
