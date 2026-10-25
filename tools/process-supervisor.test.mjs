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

test('runCommand does not label an exact-capacity capture as truncated', async () => {
  const result = await runCommand(process.execPath, [
    '-e',
    'process.stdout.write("x".repeat(64));',
  ], { maxOutputBytes: 64, timeoutMs: 2_000 });

  assert.equal(result.code, 0);
  assert.equal(result.out, 'x'.repeat(64));
  assert.equal(result.outTruncated, false);
});

test('runCommand supports a zero-byte capture without retaining child output', async () => {
  const result = await runCommand(process.execPath, [
    '-e',
    'process.stdout.write("sensitive-output");',
  ], { maxOutputBytes: 0, timeoutMs: 2_000 });

  assert.equal(result.code, 0);
  assert.equal(result.out, '');
  assert.equal(result.outTruncated, true);
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

test('runCommand rejects unbounded and overflowing timer deadlines before spawning', () => {
  const command = process.execPath;
  const args = ['-e', 'process.exit(0)'];

  assert.throws(() => runCommand(command, args, { timeoutMs: Infinity }), /timeoutMs must be finite and non-negative/);
  assert.throws(() => runCommand(command, args, { timeoutMs: 2_147_483_648 }), /timeoutMs must be finite and non-negative/);
  assert.throws(() => runCommand(command, args, { terminationGraceMs: -1 }), /terminationGraceMs must be finite and non-negative/);
});

test('runCommand enforces a deadline and escalates an unresponsive process', async () => {
  const result = await runCommand(process.execPath, [
    '-e',
    'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);',
  ], { timeoutMs: 1_000, terminationGraceMs: 75, forceGraceMs: 150 });

  assert.equal(result.timedOut, true);
  assert.ok(result.signal !== null || result.code !== null,
    `timed-out command should have a terminal process result; signal=${result.signal} code=${result.code}`);
  assert.ok(result.terminationResult, 'timeout must report whether child cleanup completed');
  assert.equal(result.cleanupFailed, false, 'the timed-out child process group should be cleaned up');
  if (process.platform !== 'win32') assert.equal(result.signal, 'SIGKILL');
});

test('waitForHttp rejects invalid deadlines instead of becoming unbounded', async () => {
  await assert.rejects(
    waitForHttp('http://unit.test/ready', { timeoutMs: Infinity }),
    /timeoutMs must be finite and non-negative/,
  );
  await assert.rejects(
    waitForHttp('http://unit.test/ready', { intervalMs: 2_147_483_648 }),
    /intervalMs must be finite and non-negative/,
  );
  await assert.rejects(
    waitForHttp('http://unit.test/ready', { requestTimeoutMs: 0 }),
    /requestTimeoutMs must be finite and positive/,
  );
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

test('waitForHttp disposes response bodies for both failed and successful probes', async () => {
  let calls = 0;
  let cancelledBodies = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: calls > 1,
      status: calls > 1 ? 200 : 503,
      body: {
        cancel() {
          cancelledBodies += 1;
          return Promise.resolve();
        },
      },
    };
  };

  const result = await waitForHttp('http://unit.test/ready', {
    timeoutMs: 500,
    intervalMs: 1,
    requestTimeoutMs: 50,
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
  assert.equal(cancelledBodies, 2);
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
