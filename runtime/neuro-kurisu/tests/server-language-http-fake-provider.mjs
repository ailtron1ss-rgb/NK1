import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = await mkdtemp(path.join(tmpdir(), 'neurocore-language-http-'));
const deadlineAt = Date.now() + 120_000;
let providerRequests = 0;
let lastProviderPayload = null;
const fakeProvider = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  providerRequests += 1;
  try { lastProviderPayload = JSON.parse(raw); } catch { lastProviderPayload = null; }
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'unexpected-fake-provider-route' }));
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({
    id: 'neurocore-http-smoke',
    object: 'chat.completion',
    model: 'neurocore-http-smoke-model',
    choices: [{ index: 0, message: { role: 'assistant', content: 'FAKE_LOCAL_PROVIDER_OK' }, finish_reason: 'stop' }],
  }));
});
await new Promise((resolve, reject) => {
  fakeProvider.once('error', reject);
  fakeProvider.listen(0, '127.0.0.1', resolve);
});
const providerAddress = fakeProvider.address();
assert.ok(providerAddress && typeof providerAddress === 'object');
const providerUrl = `http://127.0.0.1:${providerAddress.port}/v1`;
const portProbe = createServer();
await new Promise((resolve, reject) => {
  portProbe.once('error', reject);
  portProbe.listen(0, '127.0.0.1', resolve);
});
const appAddress = portProbe.address();
assert.ok(appAddress && typeof appAddress === 'object');
const appPort = appAddress.port;
await new Promise(resolve => portProbe.close(resolve));

const child = spawn(process.execPath, ['--experimental-transform-types', 'src/server/server.mjs'], {
  cwd: runtimeRoot,
  env: {
    ...process.env,
    // Exercise the same bearer-token gate required for non-loopback deployments.
    HOST: '0.0.0.0',
    PORT: String(appPort),
    STATE_DIR: stateDir,
    LLAMA_CPP_URL: providerUrl,
    LLAMA_CPP_MODEL: 'neurocore-http-smoke-model',
    LLM_TIMEOUT_MS: '5000',
    NEURO_REQUEST_TIMEOUT_MS: '20000',
    NK_MEM0_ENABLED: '0',
    NK_MEM0_COGNITIVE_RECALL: '1',
    NK_MEM0_USER_ID: 'mem0-http-smoke-user',
    NEURO_API_TOKEN: 'mem0-http-smoke-only-token',
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
    if (childExit) throw new Error(`server exited before readiness: ${JSON.stringify(childExit)} ${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${appPort}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).ready === true) return;
    } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`server startup timed out: ${output}`);
}

try {
  await waitReady();

  // Route-level Mem0 contract: the second cognitive gate can be set, but the
  // primary provider gate remains off, so no cloud call or remote prompt context is allowed.
  const unauthDiagnosticsResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/memory/mem0/diagnostics`);
  const unauthDiagnostics = await unauthDiagnosticsResponse.json();
  assert.equal(unauthDiagnosticsResponse.status, 401);
  assert.equal(unauthDiagnostics.reason, 'missing-bearer-token');
  assert.equal(Object.prototype.hasOwnProperty.call(unauthDiagnostics, 'diagnostics'), false);

  const mem0DiagnosticsResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/memory/mem0/diagnostics`, {
    headers: { authorization: 'Bearer mem0-http-smoke-only-token' },
  });
  const mem0Diagnostics = await mem0DiagnosticsResponse.json();
  assert.equal(mem0DiagnosticsResponse.status, 200);
  assert.equal(mem0Diagnostics.ok, true);
  assert.equal(mem0Diagnostics.diagnostics?.enabled, false);
  assert.equal(mem0Diagnostics.diagnostics?.available, false);
  assert.equal(Object.prototype.hasOwnProperty.call(mem0Diagnostics.diagnostics ?? {}, 'apiKey'), false);

  const unauthorizedSearchResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/memory/mem0/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'the current user preference', limit: 5 }),
  });
  const unauthorizedSearch = await unauthorizedSearchResponse.json();
  assert.equal(unauthorizedSearchResponse.status, 401);
  assert.equal(unauthorizedSearch.reason, 'missing-bearer-token');
  assert.equal(Object.prototype.hasOwnProperty.call(unauthorizedSearch, 'canonical'), false);

  const mem0SearchResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/memory/mem0/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer mem0-http-smoke-only-token' },
    body: JSON.stringify({ query: 'the current user preference', limit: 5 }),
  });
  const mem0Search = await mem0SearchResponse.json();
  assert.equal(mem0SearchResponse.status, 200, `Mem0 disabled search must degrade to local memory: ${JSON.stringify(mem0Search)}`);
  assert.equal(mem0Search.ok, true);
  assert.equal(mem0Search.canonical?.source, 'MemoryOS2');
  assert.equal(mem0Search.canonical?.authoritative, true);
  assert.ok(Array.isArray(mem0Search.canonical?.memories));
  assert.deepEqual(mem0Search.externalCandidates, []);
  assert.equal(mem0Search.mem0?.status, 'disabled');
  assert.equal(mem0Search.policy?.autoPromotion, false);
  assert.equal(mem0Search.policy?.instructionExecution, false);
  assert.equal(JSON.stringify(mem0Search).includes('MEM0_API_KEY'), false);

  const unauthorizedChatResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'This unauthenticated request must be denied before provider dispatch.' }),
  });
  assert.equal(unauthorizedChatResponse.status, 401);
  assert.equal(providerRequests, 0, 'unauthenticated chat must not reach the language provider');

  assert.equal(providerRequests, 0, 'Mem0 disabled-mode route checks must not call the language provider');
  console.log('MEM0_DISABLED_HTTP_SMOKE=PASS', JSON.stringify({
    diagnosticsEnabled: mem0Diagnostics.diagnostics?.enabled,
    canonicalSource: mem0Search.canonical?.source,
    externalCandidates: mem0Search.externalCandidates.length,
    providerRequests,
  }));
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await new Promise(resolve => fakeProvider.close(resolve));
  await rm(stateDir, { recursive: true, force: true });
}
