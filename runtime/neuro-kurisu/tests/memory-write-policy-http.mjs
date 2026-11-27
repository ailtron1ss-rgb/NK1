import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = await mkdtemp(path.join(tmpdir(), 'neurocore-write-policy-http-'));
const deadlineAt = Date.now() + 120_000;
const token = 'nk1-write-policy-http-token';
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const address = probe.address();
assert.ok(address && typeof address === 'object');
const port = address.port;
await new Promise(resolve => probe.close(resolve));

const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: runtimeRoot,
  env: {
    ...process.env, HOST: '0.0.0.0', PORT: String(port), STATE_DIR: stateDir,
    NEURO_API_TOKEN: token, NK_MEM0_ENABLED: '0',
    LLM_TIMEOUT_MS: '5000', NEURO_REQUEST_TIMEOUT_MS: '20000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let childExit = null;
const append = chunk => { output = (output + String(chunk)).slice(-12000); };
child.stdout.on('data', append);
child.stderr.on('data', append);
child.once('exit', (code, signal) => { childExit = { code, signal }; });

async function waitReady() {
  while (Date.now() < deadlineAt) {
    if (childExit) throw new Error('server exited before readiness: ' + JSON.stringify(childExit) + ' ' + output);
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).ready === true) return;
    } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('server startup timed out: ' + output);
}

try {
  await waitReady();
  const unauthorized = await fetch('http://127.0.0.1:' + port + '/api/organism/memory/write-policy', { signal: AbortSignal.timeout(15000) });
  assert.equal(unauthorized.status, 401, 'diagnostics must not be public');

  const response = await fetch('http://127.0.0.1:' + port + '/api/organism/memory/write-policy', {
    headers: { authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);
  assert.equal(body.readOnly, true, 'the endpoint must be explicitly read-only');
  assert.equal(body.diagnostics.mode, 'shadow', 'default mode is shadow');
  assert.equal(body.diagnostics.hippo.order, 8);
  assert.ok(body.diagnostics.deepWork.threshold01 > 0);
  assert.ok(body.diagnostics.fastSlow.minimumUpdates >= 1);
  assert.ok(Array.isArray(body.diagnostics.recent));
  console.log(`MEMORY_WRITE_POLICY_HTTP=PASS ${JSON.stringify({ mode: body.diagnostics.mode, decisions: body.diagnostics.decisions })}`);
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => { if (childExit) return resolve(); child.once('exit', resolve); setTimeout(resolve, 5000); });
  await rm(stateDir, { recursive: true, force: true });
}
