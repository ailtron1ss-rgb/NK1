import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = await mkdtemp(path.join(tmpdir(), 'neurocore-language-http-'));
const captureAdapterPath = path.join(runtimeRoot, 'tests', `.tmp-neural-jit-capture-adapter-${process.pid}.mjs`);
await writeFile(captureAdapterPath, `export async function createNeuralJitLocalCaptureAdapter({ provider, model, stateDirectory }) {
  if (!provider.configured() || !model || !stateDirectory) throw new Error('fixture-local-provider-not-ready');
  let captureCalls = 0;
  return {
    captureLocalInference: async ({ traceContext, response, evaluateCandidateShadow }) => {
      captureCalls += 1;
      if (typeof evaluateCandidateShadow !== 'function' || evaluateCandidateShadow('0'.repeat(64), []) !== null) throw new Error('shadow-branch-hook-not-fail-closed');
      if (captureCalls === 2) throw new Error('fixture-instrumentation-temporary-failure');
      return { captureHandle: 'opaque-fixture-capture', decisionId: traceContext.decisionId, backend: response.backend };
    },
    bindVerifiedOutcome: async () => null,
    verifyCapture: () => false,
  };
}
`);
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
    NEURO_NEURAL_JIT_CAPTURE_ADAPTER_MODULE: path.relative(runtimeRoot, captureAdapterPath),
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

  const unauthNeuralJit = await fetch(`http://127.0.0.1:${appPort}/api/organism/learning/neural-jit`);
  assert.equal(unauthNeuralJit.status, 401, 'Neural JIT diagnostics must use the common API bearer-auth policy');
  const neuralJitBeforeResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/learning/neural-jit`, { headers: authHeaders });
  const neuralJitBefore = await neuralJitBeforeResponse.json();
  assert.equal(neuralJitBeforeResponse.status, 200);
  assert.equal(neuralJitBefore.neuralJit?.localCaptureAdapterConfigured, true);
  assert.equal(neuralJitBefore.neuralJit?.activationCaptureAuthorityConfigured, true);
  assert.equal(neuralJitBefore.neuralJit?.liveInferenceEnabled, false);

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
  assert.equal(providerRequests, 1, 'one chat request should reach the local provider exactly once');
  assert.equal(lastProviderPayload?.model, 'neurocore-http-smoke-model', 'configured model identity must reach the provider');
  assert.ok(Array.isArray(lastProviderPayload?.messages) && lastProviderPayload.messages.some(message => message.role === 'user' && message.content.includes('configured local model')), 'user prompt must reach the local provider');
  assert.equal(lastProviderPayload?.stream, false, 'smoke provider request should use the bounded non-streaming response path');
  assert.equal(Object.prototype.hasOwnProperty.call(body.language ?? {}, 'neuralJitCapture'), false,
    'opaque activation handles must never escape through the user-facing language response');
  const neuralJitAfterResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/learning/neural-jit`, { headers: authHeaders });
  const neuralJitAfter = await neuralJitAfterResponse.json();
  assert.equal(neuralJitAfterResponse.status, 200);
  assert.equal(neuralJitAfter.neuralJit?.localCaptureAdapterConfigured, true);
  assert.equal(neuralJitAfter.neuralJit?.pendingCaptureCount, 1,
    'the opted-in local model adapter must capture an opaque pending activation handle from the actual llama.cpp response');
  assert.equal(neuralJitAfter.neuralJit?.acceptedTraces, 0,
    'capture alone must not create a learning trace before a verified ActionGateway outcome');
  const compileResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/learning/neural-jit/compile`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders },
    body: JSON.stringify({ taskFamily: 'language-response', modelFingerprint: 'a'.repeat(64) }),
  });
  const compileResult = await compileResponse.json();
  assert.equal(compileResponse.status, 409, 'a pending capture without a verified outcome must not compile into a candidate');
  assert.equal(compileResult.candidate, null);
  const secondChatResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer mem0-http-smoke-only-token' },
    body: JSON.stringify({ message: 'A transient local activation instrumentation error must not degrade ordinary inference.' }),
    signal: AbortSignal.timeout(Math.max(1000, deadlineAt - Date.now())),
  });
  const secondChat = await secondChatResponse.json();
  assert.equal(secondChatResponse.status, 200);
  assert.equal(secondChat.language?.text, 'FAKE_LOCAL_PROVIDER_OK');
  assert.equal(secondChat.language?.preferredBackend, 'llama.cpp',
    'a shadow capture failure must not count as an inference failure or open the local backend circuit breaker');
  assert.equal(providerRequests, 2);
  const afterCaptureFailureResponse = await fetch(`http://127.0.0.1:${appPort}/api/organism/learning/neural-jit`, { headers: authHeaders });
  const afterCaptureFailure = await afterCaptureFailureResponse.json();
  assert.equal(afterCaptureFailure.neuralJit?.pendingCaptureCount, 1,
    'a failed capture attempt must not create a synthetic activation token');
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
  await rm(captureAdapterPath, { force: true });
}
