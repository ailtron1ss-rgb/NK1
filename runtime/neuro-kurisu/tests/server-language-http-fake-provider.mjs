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
    usage: { prompt_tokens:84, completion_tokens:19, total_tokens:103 },
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

const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: runtimeRoot,
  env: {
    ...process.env,
    HOST: '0.0.0.0',
    PORT: String(appPort),
    STATE_DIR: stateDir,
    LLAMA_CPP_URL: providerUrl,
    NEURO_API_TOKEN: 'mem0-http-smoke-only-token',
    NK_MEM0_ENABLED: '0',
    NK_MEM0_COGNITIVE_RECALL: '1',
    NK_MEM0_USER_ID: 'mem0-http-smoke-user',
    LLAMA_CPP_MODEL: 'neurocore-http-smoke-model',
    LLAMA_CPP_NK1_TEMPLATE_CONTROLS: '1',
    LLM_TIMEOUT_MS: '5000',
    NEURO_REQUEST_TIMEOUT_MS: '20000',
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
  // A separate cognitive-recall opt-in must not override the primary provider-off gate.
  // The API auth middleware must guard both Mem0 diagnostics and search routes.
  const unauthDiagnosticsResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/memory/mem0/diagnostics`);
  const unauthDiagnostics = await unauthDiagnosticsResponse.json();
  assert.equal(unauthDiagnosticsResponse.status, 401);
  assert.equal(unauthDiagnostics.reason, 'missing-bearer-token');
  assert.equal(Object.prototype.hasOwnProperty.call(unauthDiagnostics, 'diagnostics'), false);

  const unauthBridgeDiagnosticsResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/cognition/neural-bridge/diagnostics`);
  const unauthBridgeDiagnostics = await unauthBridgeDiagnosticsResponse.json();
  assert.equal(unauthBridgeDiagnosticsResponse.status, 401,
    'neural bridge diagnostics must remain behind the existing API authorization boundary');
  assert.equal(Object.prototype.hasOwnProperty.call(unauthBridgeDiagnostics, 'diagnostics'), false);

  const authHeaders = { authorization: 'Bearer mem0-http-smoke-only-token' };
  const mem0DiagnosticsResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/memory/mem0/diagnostics`, { headers: authHeaders });
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
    headers: { 'content-type': 'application/json', ...authHeaders },
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
  assert.equal(providerRequests, 0, 'disabled Mem0 search must not call the language provider');

  const response = await fetch(`http://127.0.0.1:${appPort}/api/organism/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer mem0-http-smoke-only-token' },
    body: JSON.stringify({ message: 'Use the configured local model for this integration smoke.' }),
    signal: AbortSignal.timeout(Math.max(1000, deadlineAt - Date.now())),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `chat endpoint failed: ${JSON.stringify(body)}`);
  assert.equal(body.ok, true);
  assert.equal(body.language?.text, 'FAKE_LOCAL_PROVIDER_OK', 'HTTP chat must return the fake local provider response, not deterministic fallback');
  assert.equal(body.language?.backend, 'llama.cpp:neurocore-http-smoke-model', 'reported backend must identify the provider that actually answered');
  assert.equal(body.language?.preferredBackend, 'llama.cpp', 'configured local provider should be preferred while healthy');
  assert.ok(Number.isFinite(body.language?.latencyMs) && body.language.latencyMs >= 0, 'language invocation must report finite non-negative latency');
  assert.deepEqual(body.language?.providerUsage,{promptTokens:84,completionTokens:19,totalTokens:103},
    'llama.cpp usage counters must survive the server language adapter');
  assert.equal(providerRequests, 1, 'one chat request should reach the local provider exactly once');
  assert.equal(lastProviderPayload?.model, 'neurocore-http-smoke-model', 'configured model identity must reach the provider');
  assert.ok(Array.isArray(lastProviderPayload?.messages) && lastProviderPayload.messages.some(message => message.role === 'user' && message.content.includes('configured local model')), 'user prompt must reach the local provider');
  assert.equal(lastProviderPayload?.stream, false, 'smoke provider request should use the bounded non-streaming response path');
  assert.equal(lastProviderPayload?.chat_template_kwargs?.nk1_control_version, 2,
    'opt-in llama.cpp template controls must reach the actual chat-completions payload');
  assert.equal(lastProviderPayload?.chat_template_kwargs?.nk1_feature_schema, 'nk1-cognitive-neural-43-v2');
  assert.ok(['reflex', 'shallow', 'retrieve', 'deep', 'simulate', 'defer', 'sleep'].includes(
    lastProviderPayload?.chat_template_kwargs?.nk1_mode,
  ));
  assert.ok(Number.isSafeInteger(lastProviderPayload?.chat_template_kwargs?.nk1_neural_snapshot_version));
  assert.ok(lastProviderPayload?.chat_template_kwargs?.nk1_neural_snapshot_freshness01 >= 0
    && lastProviderPayload.chat_template_kwargs.nk1_neural_snapshot_freshness01 <= 1);

  const bridgeDiagnosticsResponse = await fetch(
    `http://127.0.0.1:${appPort}/api/organism/cognition/neural-bridge/diagnostics`,
    { headers: authHeaders },
  );
  const bridgeDiagnosticsBody = await bridgeDiagnosticsResponse.json();
  assert.equal(bridgeDiagnosticsResponse.status, 200);
  assert.equal(bridgeDiagnosticsBody.ok, true);
  assert.equal(bridgeDiagnosticsBody.readOnly, true);
  assert.equal(bridgeDiagnosticsBody.diagnostics?.enabled, true);
  assert.ok(bridgeDiagnosticsBody.diagnostics?.projected > 0);
  assert.ok(bridgeDiagnosticsBody.diagnostics?.neuralSnapshotsAvailable > 0);
  assert.equal(bridgeDiagnosticsBody.diagnostics?.lastFeatureDimensions, 43);
  assert.ok(bridgeDiagnosticsBody.diagnostics?.llamaCppTemplateKwargsSent > 0,
    'the runtime must preserve the provider receipt and count the real local-template hand-off');
  assert.ok(bridgeDiagnosticsBody.diagnostics?.providerControlReceiptsAccepted > 0);
  assert.equal(bridgeDiagnosticsBody.diagnostics?.providerControlReceiptsRejected, 0);
  assert.equal(bridgeDiagnosticsBody.diagnostics?.providerControlReceiptsDuplicate, 0);
  assert.ok(bridgeDiagnosticsBody.diagnostics?.providerUsageObservations > 0);
  assert.ok(bridgeDiagnosticsBody.diagnostics?.providerPromptTokensTotal >= 84);
  assert.ok(bridgeDiagnosticsBody.diagnostics?.providerCompletionTokensTotal >= 19);
  assert.equal(bridgeDiagnosticsBody.diagnostics?.providerUsageInvalid, 0);
  assert.match(bridgeDiagnosticsBody.diagnostics?.lastTemplateProfileFingerprint ?? '', /^[a-f0-9]{64}$/);
  assert.equal(bridgeDiagnosticsBody.diagnostics?.templateConsumptionVerified, false,
    'sending kwargs does not prove the selected Jinja template consumed them');
  assert.equal(bridgeDiagnosticsBody.diagnostics?.activationSteeringApplied, 0);
  assert.equal(bridgeDiagnosticsBody.diagnostics?.residualBlockApplied, 0);

  console.log('SERVER_LANGUAGE_HTTP_FAKE_PROVIDER=PASS', JSON.stringify({
    status: response.status,
    backend: body.language.backend,
    preferredBackend: body.language.preferredBackend,
    latencyMs: body.language.latencyMs,
    mem0Enabled: mem0Diagnostics.diagnostics?.enabled,
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
