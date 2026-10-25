import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import {
  appendOutputTail,
  findAvailablePort,
  runCommand,
  waitForHttp,
} from './integration-supervisor.mjs';

test('ephemeral port allocator returns distinct usable ports', async () => {
  const first = await findAvailablePort();
  const second = await findAvailablePort({ exclude: [first] });
  assert.ok(first > 0 && first < 65536);
  assert.ok(second > 0 && second < 65536);
  assert.notEqual(first, second);
});

test('readiness probe waits for a successful HTTP response', async t => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"ok":true}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const address = server.address();
  const response = await waitForHttp(`http://127.0.0.1:${address.port}/ready`, {
    timeoutMs: 1_000,
    intervalMs: 10,
    label: 'fixture',
  });
  assert.equal(response.status, 200);
  assert.equal(response.status, 200);
});

test('readiness timeout is bounded and reports the last failure', async () => {
  const port = await findAvailablePort();
  await assert.rejects(
    waitForHttp(`http://127.0.0.1:${port}/not-listening`, {
      timeoutMs: 100,
      intervalMs: 10,
      requestTimeoutMs: 40,
      label: 'offline fixture',
    }),
    /offline fixture readiness timed out/,
  );
});

test('command supervisor captures output and returns the exit code', async () => {
  const result = await runCommand('output fixture', process.execPath, [
    '-e',
    'process.stdout.write("hello"); process.stderr.write("notice");',
  ], { timeoutMs: 2_000 });
  assert.equal(result.code, 0);
  assert.equal(result.timedOut, false);
  assert.equal(result.out, 'hello');
  assert.equal(result.err, 'notice');
  assert.equal(result.error, null);
});

test('command supervisor terminates a command that exceeds its deadline', async () => {
  const result = await runCommand('timeout fixture', process.execPath, [
    '-e',
    'setInterval(() => {}, 1000);',
  ], { timeoutMs: 100, terminateGraceMs: 100 });
  assert.equal(result.timedOut, true);
  assert.match(result.err, /exceeded 100ms/);
  assert.notEqual(result.code, 0);
});

test('captured output is bounded to its configured tail', () => {
  assert.equal(appendOutputTail('abcde', 'fgh', 4), 'efgh');
});
