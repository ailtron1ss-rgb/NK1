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
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'fake-provider-method-not-allowed' }));
    return;
  }
  if (req.url === '/v1/embeddings') {
    const data = Array.isArray(lastProviderPayload?.input)
      ? lastProviderPayload.input.map((_, index) => ({ index, embedding: [1, index + 1, 0] }))
      : [];
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ object: 'list', data, model: lastProviderPayload?.model || 'smoke-embedding-model' }));
    return;
  }
  if (req.url !== '/v1/chat/completions') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'unexpected-fake-provider-route' }));
    return;
  }
  const systemPrompt = String(lastProviderPayload?.messages?.find(message => message.role === 'system')?.content || '');
  const reply = systemPrompt.includes('small local text classifier')
    ? JSON.stringify({ label: 'technical', confidence: 0.91 })
    : systemPrompt.includes('local, fallible affect-signal estimator')
      ? JSON.stringify({ emotion: 'curiosity', valence: 0.4, arousal: 0.6, confidence: 0.82 })
      : 'FAKE_LOCAL_PROVIDER_OK';
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({
    id: 'neurocore-http-smoke',
    object: 'chat.completion',
    model: lastProviderPayload?.model || 'neurocore-http-smoke-model',
    choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
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

const child = spawn(process.execPath, ['--import', path.join(runtimeRoot, 'scripts/register-typescript-loader.mjs'), 'src/server/server.mjs'], {
  cwd: runtimeRoot,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(appPort),
    STATE_DIR: stateDir,
    LLAMA_CPP_URL: providerUrl,
    LLAMA_CPP_MODEL: 'neurocore-http-smoke-model',
    NK_LOCAL_CLASSIFIER_URL: providerUrl,
    NK_LOCAL_CLASSIFIER_MODEL: 'tiny-classifier-smoke',
    NK_LOCAL_EMOTION_URL: providerUrl,
    NK_LOCAL_EMOTION_MODEL: 'tiny-affect-smoke',
    NK_LOCAL_CONTEXT_SIGNALS_ENABLED: '0',
    NK_EMBEDDINGS_ENABLED: '1',
    NK_EMBEDDINGS_PROVIDER: 'openai-compatible',
    NK_EMBEDDINGS_BASE_URL: providerUrl,
    NK_EMBEDDINGS_MODEL: 'smoke-embedding-model',
    LLM_TIMEOUT_MS: '5000',
    NK_LOCAL_SPECIALIST_TIMEOUT_MS: '1500',
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
  const response = await fetch(`http://127.0.0.1:${appPort}/api/organism/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

  const diagnosticsResponse = await fetch(`http://127.0.0.1:${appPort}/api/local-models`);
  const diagnosticsBody = await diagnosticsResponse.json();
  assert.equal(diagnosticsResponse.status, 200, 'the live server must expose local-model diagnostics');
  assert.equal(diagnosticsBody.ok, true);
  assert.equal(diagnosticsBody.hub?.localFirst, true);
  assert.equal(diagnosticsBody.hub?.models?.find(model => model.id === 'local-classifier')?.configured, true);
  assert.equal(diagnosticsBody.hub?.models?.find(model => model.id === 'local-emotion')?.configured, true);
  assert.equal(diagnosticsBody.hub?.models?.find(model => model.id === 'local-embeddings')?.configured, true);
  assert.equal(diagnosticsBody.hub?.models?.find(model => model.id === 'local-embeddings')?.provider, 'openai-compatible');

  const classifyResponse = await fetch(`http://127.0.0.1:${appPort}/api/local-models/classify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Please inspect this runtime path.' }),
  });
  const classifyBody = await classifyResponse.json();
  assert.equal(classifyResponse.status, 200, `classification route failed: ${JSON.stringify(classifyBody)}`);
  assert.equal(classifyBody.result?.label, 'technical');
  assert.equal(classifyBody.result?.confidence, 0.91);

  const emotionResponse = await fetch(`http://127.0.0.1:${appPort}/api/local-models/emotion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'I am excited by this idea.' }),
  });
  const emotionBody = await emotionResponse.json();
  assert.equal(emotionResponse.status, 200, `emotion route failed: ${JSON.stringify(emotionBody)}`);
  assert.equal(emotionBody.result?.emotion, 'curiosity');
  assert.match(emotionBody.caveat, /uncertain estimate/i);

  const embeddingsResponse = await fetch(`http://127.0.0.1:${appPort}/api/local-models/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texts: ['memory about science', 'memory about sarcasm'] }),
  });
  const embeddingsBody = await embeddingsResponse.json();
  assert.equal(embeddingsResponse.status, 200, `embedding route failed: ${JSON.stringify(embeddingsBody)}`);
  assert.equal(embeddingsBody.provider, 'openai-compatible');
  assert.equal(embeddingsBody.dimensions, 3);
  assert.equal(embeddingsBody.vectors.length, 2);
  assert.deepEqual(embeddingsBody.vectors[0], [1, 1, 0]);

  const invalidBatchResponse = await fetch(`http://127.0.0.1:${appPort}/api/local-models/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texts: Array.from({ length: 33 }, (_, index) => `text ${index}`) }),
  });
  assert.equal(invalidBatchResponse.status, 400, 'oversized embedding batches should be rejected before inference');

  console.log('SERVER_LOCAL_SMALL_MODEL_HTTP=PASS', JSON.stringify({
    diagnostics: true,
    classification: classifyBody.result.label,
    affect: emotionBody.result.emotion,
    embeddings: embeddingsBody.vectors.length,
    invalidBatchRejected: invalidBatchResponse.status === 400,
  }));
  console.log('SERVER_LANGUAGE_HTTP_FAKE_PROVIDER=PASS', JSON.stringify({
    status: response.status,
    backend: body.language.backend,
    preferredBackend: body.language.preferredBackend,
    latencyMs: body.language.latencyMs,
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
