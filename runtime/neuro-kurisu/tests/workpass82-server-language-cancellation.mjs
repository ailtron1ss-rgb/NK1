import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { pollUntilReady } from '../scripts/server-smoke-poll.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = await mkdtemp(path.join(tmpdir(), 'nk-cancel-smoke-'));
const serverPort = 33000 + Math.floor(Math.random() * 2500);
let resolveProviderStarted;
let resolveProviderClosed;
const providerStarted = new Promise(resolve => { resolveProviderStarted = resolve; });
const providerClosed = new Promise(resolve => { resolveProviderClosed = resolve; });
let providerRequests = 0;
let providerDisconnects = 0;
const fakeProvider = createServer((req, res) => {
  providerRequests += 1;
  let body = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    assert.ok(body.includes('"messages"'), 'local provider should receive a chat-completions payload');
    resolveProviderStarted();
  });
  res.on('close', () => {
    if (!res.writableEnded) {
      providerDisconnects += 1;
      resolveProviderClosed();
    }
  });
  // Intentionally never answer. The server's upstream fetch should be aborted
  // when the HTTP chat client disconnects; its provider socket must then close.
});
await new Promise((resolve, reject) => {
  fakeProvider.once('error', reject);
  fakeProvider.listen(0, '127.0.0.1', resolve);
});
const providerPort = fakeProvider.address().port;
const env = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: String(serverPort),
  STATE_DIR: stateDir,
  LLAMA_CPP_URL: `http://127.0.0.1:${providerPort}/v1`,
  LLAMA_CPP_MODEL: 'workpass82-cancel-fixture',
  LLM_TIMEOUT_MS: '12000',
};
const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: runtimeRoot, env, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let childExit = null;
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
child.once('exit', (code, signal) => { childExit = { code, signal }; });

const withTimeout = async (promise, ms, label) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
try {
  const readiness = await pollUntilReady({
    timeoutMs: 45_000,
    intervalMs: 100,
    probeTimeoutMs: 1_000,
    isChildExited: () => childExit !== null,
    probe: async timeoutMs => {
      const response = await fetch(`http://127.0.0.1:${serverPort}/api/health`, {
        signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
      });
      if (!response.ok) return false;
      return (await response.json()).ready === true;
    },
  });
  if (!readiness.ready) throw new Error(`server readiness failed: ${JSON.stringify(readiness)}; ${output.slice(-4000)}`);

  const request = http.request({
    hostname: '127.0.0.1', port: serverPort, path: '/api/organism/chat', method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  request.on('error', () => { /* Expected when the test deliberately disconnects. */ });
  request.end(JSON.stringify({ message: 'WorkPass82 cancellation propagation probe', deliberate: false }));

  await withTimeout(providerStarted, 35_000, 'local provider request');
  assert.equal(providerRequests, 1, 'the chat request should reach the configured local provider');
  request.destroy();

  await withTimeout(providerClosed, 4_000, 'upstream provider socket cancellation');
  assert.equal(providerDisconnects, 1, 'client disconnect must abort the in-flight local provider request');
  console.log('WORKPASS82_SERVER_LANGUAGE_CANCELLATION=PASS', JSON.stringify({
    providerRequests,
    providerDisconnects,
    endToEndAbortObserved: true,
    providerTimeoutMs: 12_000,
  }));
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 1_500))]);
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 1_000))]);
  }
  await new Promise(resolve => fakeProvider.close(resolve));
  await rm(stateDir, { recursive: true, force: true });
}
