import assert from 'node:assert/strict';
import { OpenAICompatibleLocalChatProvider } from '../src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts';

const okResponse = (payload, init = {}) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'content-type': 'application/json', ...init.headers },
  ...init,
});

let capturedRequest = null;
const healthy = new OpenAICompatibleLocalChatProvider({
  baseUrl: 'http://127.0.0.1:43123/v1/',
  model: 'configured-model',
  timeoutMs: 1_000,
  fetchImpl: async (url, init) => {
    capturedRequest = { url, init, body: JSON.parse(String(init.body)) };
    return okResponse({
      model: 'served-model',
      choices: [{ message: { content: '  grounded local response  ' } }],
    });
  },
});
assert.equal(healthy.configured(), true);
assert.equal(healthy.endpoint(), 'http://127.0.0.1:43123/v1/chat/completions');
const generated = await healthy.generate({
  system: 'system instruction',
  user: 'test prompt',
  maxTokens: 99_999,
  temperature: 8,
});
assert.equal(generated.text, 'grounded local response');
assert.equal(generated.backend, 'llama.cpp:served-model');
assert.equal(generated.model, 'served-model');
assert.ok(Number.isFinite(generated.latencyMs) && generated.latencyMs >= 0);
assert.equal(capturedRequest.url, 'http://127.0.0.1:43123/v1/chat/completions');
assert.equal(capturedRequest.body.model, 'configured-model');
assert.equal(capturedRequest.body.max_tokens, 8192, 'output budget must be clamped');
assert.equal(capturedRequest.body.temperature, 2, 'temperature must be clamped');
assert.equal(capturedRequest.body.stream, false, 'the provider must use the bounded non-streaming path');
assert.equal(capturedRequest.init.redirect, 'error', 'the loopback provider must not follow redirects');
assert.ok(capturedRequest.init.signal instanceof AbortSignal, 'every provider request must have a timeout signal');

const expectFailure = async (name, fetchImpl, expected) => {
  const provider = new OpenAICompatibleLocalChatProvider({
    baseUrl: 'http://127.0.0.1:43123/v1',
    timeoutMs: 1_000,
    fetchImpl,
  });
  await assert.rejects(() => provider.generate({ system: '', user: 'failure test' }), error => {
    assert.equal(error.message, expected, name);
    return true;
  });
};
await expectFailure('HTTP status is surfaced as a provider failure',
  async () => new Response('unavailable', { status: 503 }), 'llama.cpp-http-503');
await expectFailure('malformed JSON is rejected',
  async () => new Response('{not-json', { status: 200 }), 'llama.cpp-invalid-json');
await expectFailure('empty model output is rejected',
  async () => okResponse({ choices: [{ message: { content: '   ' } }] }), 'llama.cpp-empty-response');
await expectFailure('oversized response is rejected',
  async () => new Response('x'.repeat(2 * 1024 * 1024 + 1), { status: 200 }),
  'llama.cpp-response-too-large');

let timeoutSignalObserved = false;
const timeoutProvider = new OpenAICompatibleLocalChatProvider({
  baseUrl: 'http://127.0.0.1:43123/v1',
  timeoutMs: 250,
  fetchImpl: (_url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      timeoutSignalObserved = true;
      reject(init.signal.reason ?? new Error('aborted'));
    }, { once: true });
  }),
});
await assert.rejects(() => timeoutProvider.generate({ system: '', user: 'timeout test' }));
assert.equal(timeoutSignalObserved, true, 'the request deadline must abort the provider transport');

// Caller cancellation must be composed with the provider deadline, not ignored
// or replaced by a provider-owned signal.
let cancellationSignalObserved = false;
let markTransportStarted;
const transportStarted = new Promise(resolve => { markTransportStarted = resolve; });
const callerController = new AbortController();
const cancellationProvider = new OpenAICompatibleLocalChatProvider({
  baseUrl: 'http://127.0.0.1:43123/v1',
  timeoutMs: 10_000,
  fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      cancellationSignalObserved = true;
      reject(init.signal.reason ?? new Error('aborted'));
    }, { once: true });
    markTransportStarted();
  }),
});
const cancellation = cancellationProvider.generate({ system: '', user: 'cancel test', signal: callerController.signal });
await transportStarted;
callerController.abort();
await assert.rejects(cancellation, /llama\\.cpp-request-aborted/);
assert.equal(cancellationSignalObserved, true, 'caller abort must reach the actual transport');

const alreadyAborted = new AbortController();
alreadyAborted.abort();
await assert.rejects(
  () => healthy.generate({ system: '', user: 'already cancelled', signal: alreadyAborted.signal }),
  /llama\\.cpp-request-aborted/,
);

assert.throws(() => new OpenAICompatibleLocalChatProvider({ baseUrl: 'https://127.0.0.1/v1' }),
  /llama\.cpp-endpoint-must-be-loopback-http/);
assert.throws(() => new OpenAICompatibleLocalChatProvider({ baseUrl: 'http://example.com/v1' }),
  /llama\.cpp-endpoint-must-be-loopback-http/);
assert.throws(() => new OpenAICompatibleLocalChatProvider({ baseUrl: 'http://user:pass@127.0.0.1/v1' }),
  /llama\.cpp-endpoint-must-be-loopback-http/);

console.log('WORKPASS79_LOCAL_PROVIDER_BOUNDARY=PASS', JSON.stringify({
  successPath: true,
  statusFailure: true,
  malformedJson: true,
  emptyOutput: true,
  responseByteLimit: 2 * 1024 * 1024,
  timeoutAbort: timeoutSignalObserved,
  callerCancellation: cancellationSignalObserved,
  loopbackOnly: true,
}));
