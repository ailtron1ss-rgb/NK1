import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runLearningProcess, readLearningExecutionReceipt } from '../src/organism/learning/LearningProcessSupervisor.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-learning-supervisor-'));
const run = {
  runId: 'run-001',
  manifestFingerprint: 'a'.repeat(64),
  taskId: 'task-1',
  taskVersion: 'v1',
  seed: 7,
  arm: 'R(2)',
  method: 'reset-v1',
};
const base = {
  executable: process.execPath,
  args: ['-e', 'process.stdout.write(JSON.stringify({runId:process.env.NK1_LEARNING_RUN_ID,seed:process.env.NK1_LEARNING_SEED}))'],
  cwd: process.cwd(),
  runRoot: path.join(root, 'runs'),
  surviveDir: path.join(root, 'survive', 'R2'),
  timeoutMs: 2_000,
  maxOutputBytes: 4096,
};
try {
  const success = await runLearningProcess(run, 'b'.repeat(64), base);
  assert.equal(success.receipt.status, 'completed');
  assert.equal(success.receipt.exitCode, 0);
  assert.equal(JSON.parse(success.receipt.stdout).runId, run.runId);
  assert.equal(JSON.parse(success.receipt.stdout).seed, String(run.seed));
  assert.equal(success.receipt.surviveDirectory, path.resolve(base.surviveDir));
  assert.equal((await readLearningExecutionReceipt(success.receiptPath)).executionId, success.receipt.executionId);

  const failed = await runLearningProcess(run, 'b'.repeat(64), { ...base, args: ['-e', 'process.exit(9)'] });
  assert.equal(failed.receipt.status, 'failed');
  assert.equal(failed.receipt.exitCode, 9);

  const timed = await runLearningProcess(run, 'b'.repeat(64), {
    ...base, timeoutMs: 40, args: ['-e', 'setInterval(()=>{},1000)'],
  });
  assert.equal(timed.receipt.status, 'timed-out');
  assert.equal(timed.receipt.signal, 'SIGKILL');

  const cancellation = new AbortController();
  const running = runLearningProcess(run, 'b'.repeat(64), {
    ...base, signal: cancellation.signal, timeoutMs: 2_000,
    args: ['-e', 'setInterval(()=>{},1000)'],
  });
  setTimeout(() => cancellation.abort(new Error('test cancellation')), 40);
  const cancelled = await running;
  assert.equal(cancelled.receipt.status, 'cancelled');
  assert.equal(cancelled.receipt.signal, 'SIGKILL');

  const preCancelled = new AbortController();
  preCancelled.abort();
  await assert.rejects(
    () => runLearningProcess(run, 'b'.repeat(64), { ...base, signal: preCancelled.signal }),
    /cancelled before spawn/,
  );

  // A timed-out parent must not leave a same-process-group descendant running.
  // The descendant would create a marker after the supervisor has returned if it survived.
  const descendantMarker = path.join(root, 'descendant-survived.txt');
  const descendantPayload = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(descendantMarker)}, 'alive'), 300)`;
  const descendantScript = `const { spawn } = require('node:child_process'); spawn(process.execPath, ['-e', ${JSON.stringify(descendantPayload)}], { stdio: 'ignore' }); setInterval(() => {}, 1000);`;
  const treeTimed = await runLearningProcess(run, 'b'.repeat(64), {
    ...base, timeoutMs: 80, args: ['-e', descendantScript],
  });
  assert.equal(treeTimed.receipt.status, 'timed-out');
  await new Promise(resolve => setTimeout(resolve, 400));
  await assert.rejects(() => readFile(descendantMarker, 'utf8'), error => error.code === 'ENOENT');

  const capped = await runLearningProcess(run, 'b'.repeat(64), {
    ...base, maxOutputBytes: 32, args: ['-e', "process.stdout.write('x'.repeat(10000))"],
  });
  assert.equal(capped.receipt.status, 'output-limit');
  assert.equal(capped.receipt.outputTruncated, true);
  assert.ok(capped.receipt.stdoutBytes > capped.receipt.stdout.length);

  await assert.rejects(() => runLearningProcess(run, 'not-a-fingerprint', base), /plan fingerprint/);
  await assert.rejects(() => runLearningProcess({ ...run, seed: -1 }, 'b'.repeat(64), base), /invalid scheduled/);
  const tamperedPath = path.join(root, 'tampered.json');
  await writeFile(tamperedPath, JSON.stringify({ ...success.receipt, planFingerprint: 'wrong' }));
  await assert.rejects(() => readLearningExecutionReceipt(tamperedPath), /receipt fields/);
  const stored = JSON.parse(await readFile(success.receiptPath, 'utf8'));
  assert.equal(stored.runId, run.runId);
  console.log('P23_LEARNING_PROCESS_SUPERVISOR=PASS');
} finally {
  await rm(root, { recursive: true, force: true });
}
