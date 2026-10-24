import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommand, spawnManaged, terminateChildren, waitForHttp } from './process-supervisor.mjs';

test('runCommand preserves command exit status and stdout/stderr', async () => {
  const result = await runCommand(process.execPath, [
    '-e',
    'process.stdout.write("ready"); process.stderr.write("diagnostic"); process.exitCode = 7;',
  ], { timeoutMs: 2_000 });

  assert.equal(result.code, 7);
  assert.equal(result.timedOut, false);
  assert.equal(result.error, null);
  assert.equal(result.out, 'ready');
  assert.equal(result.err, 'diagnostic');
  assert.equal(result.outTruncated, false);
  assert.equal(result.errTruncated, false);
});

test('runCommand bounds output while preserving the newest diagnostic tail', async () => {
  const result = await runCommand(process.execPath, [
    '-e',
    'process.stdout.write("0123456789".repeat(100));',
  ], { maxOutputBytes: 64, timeoutMs: 2_000 });

  assert.equal(result.code, 0);
  assert.equal(result.out.length, 64);
  assert.equal(result.out, ('0123456789'.repeat(100)).slice(-64));
  assert.equal(result.outTruncated, true);
});

test('runCommand can stream live output while keeping a bounded diagnostic tail', async () => {
  const observed = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = function (chunk, ...args) {
    observed.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    return Reflect.apply(originalWrite, this, [chunk, ...args]);
  };

  let result;
  try {
    result = await runCommand(process.execPath, [
      '-e',
      'process.stdout.write("streamed-live-output");',
    ], { timeoutMs: 2_000, maxOutputBytes: 8, streamOutput: true });
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.equal(result.code, 0);
  assert.equal(result.out, 'live-output'.slice(-8));
  assert.equal(result.outTruncated, true);
  assert.ok(observed.join('').includes('streamed-live-output'));
});

test('runCommand reports executable startup failures instead of hanging', async () => {
  const missingExecutable = process.platform === 'win32'
    ? 'Z:\\nk1-missing-executable.exe'
    : '/nk1-missing-executable';
  const result = await runCommand(missingExecutable, [], { timeoutMs: 500 });

  assert.equal(result.code, null);
  assert.match(result.error ?? '', /ENOENT|not found|cannot find/i);
  assert.equal(result.timedOut, false);
});

test('runCommand enforces a deadline and escalates an unresponsive process', async () => {
  const result = await runCommand(process.execPath, [
    '-e',
    'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);',
  ], { timeoutMs: 1_000, terminationGraceMs: 75, forceGraceMs: 150 });

  assert.equal(result.timedOut, true);
  assert.ok(result.signal !== null || result.code !== null,
    `timed-out command should have a terminal process result; signal=${result.signal} code=${result.code}`);
  if (process.platform !== 'win32') assert.equal(result.signal, 'SIGKILL');
});

test('waitForHttp waits for readiness without a fixed startup sleep', async () => {
  let calls = 0;
  const result = await waitForHttp('http://unit.test/ready', {
    timeoutMs: 500,
    intervalMs: 1,
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) throw new Error('server not ready');
      return { ok: true, status: 200 };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(calls, 3);
});

test('waitForHttp returns a bounded, actionable readiness failure', async () => {
  const result = await waitForHttp('http://unit.test/ready', {
    timeoutMs: 8,
    intervalMs: 1,
    requestTimeoutMs: 2,
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, null);
  assert.equal(result.error, 'HTTP 503');
});

test('terminateChildren escalates a SIGTERM-resistant process group', async () => {
  const child = spawnManaged(process.execPath, [
    '-e',
    'process.on("SIGTERM", () => {}); process.stdout.write("ready"); setInterval(() => {}, 1000);',
  ], { stdio: ['ignore', 'pipe', 'ignore'] });
  child.on('error', () => {});
  child.stdout.setEncoding('utf8');
  await new Promise((resolveReady, rejectReady) => {
    child.stdout.on('data', (chunk) => {
      if (chunk.includes('ready')) resolveReady();
    });
    child.once('error', rejectReady);
  });

  const [result] = await terminateChildren([child], { graceMs: 150, forceGraceMs: 150 });
  assert.equal(result.stopped, true);
  if (process.platform !== 'win32') {
    assert.equal(result.forced, true);
    assert.equal(child.signalCode, 'SIGKILL');
  }
});
