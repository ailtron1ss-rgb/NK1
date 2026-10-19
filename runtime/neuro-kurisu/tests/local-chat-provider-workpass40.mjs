import assert from 'node:assert/strict';
import { OpenAICompatibleLocalChatProvider } from '../src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts';
import { P40ModelEcologyEngine } from '../src/organism/learning/P40ModelEcology.ts';

const calls = [];
const provider = new OpenAICompatibleLocalChatProvider({
  baseUrl: 'http://127.0.0.1:8080/v1/', model: 'kurisu-local-q4', timeoutMs: 8000,
  fetchImpl: async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
    return { ok: true, headers: { get: () => null }, text: async () => JSON.stringify({ model: 'kurisu-local-q4', choices: [{ message: { content: 'Я проверю гипотезу и сохраню причинность.' } }] }) };
  },
});
assert.equal(provider.configured(), true);
assert.equal(provider.endpoint(), 'http://127.0.0.1:8080/v1/chat/completions');
const answer = await provider.generate({ system: 'You are Kurisu.', user: 'Think carefully.', maxTokens: 128, temperature: 0.35 });
assert.equal(answer.text, 'Я проверю гипотезу и сохраню причинность.');
assert.equal(answer.backend, 'llama.cpp:kurisu-local-q4');
assert.equal(calls.length, 1);
assert.equal(calls[0].body.messages[0].role, 'system');
assert.equal(calls[0].body.messages[1].role, 'user');
assert.equal(calls[0].body.stream, false);
assert.equal(calls[0].body.max_tokens, 128);
assert.equal(calls[0].init.redirect, 'error', 'a loopback endpoint must not redirect requests to another host');

const structured = new OpenAICompatibleLocalChatProvider({ baseUrl: 'http://localhost:8080/v1', fetchImpl: async () => ({ ok: true, headers: { get: () => null }, text: async () => JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: 'Part A. ' }, { type: 'text', text: 'Part B.' }] } }] }) }) });
assert.equal((await structured.generate({ system: '', user: 'x' })).text, 'Part A. Part B.');

assert.throws(() => new OpenAICompatibleLocalChatProvider({ baseUrl: 'https://localhost:8080/v1' }), /loopback-http/);
assert.throws(() => new OpenAICompatibleLocalChatProvider({ baseUrl: 'http://example.com/v1' }), /loopback-http/);
await assert.rejects(new OpenAICompatibleLocalChatProvider({ baseUrl: 'http://127.0.0.1:8080/v1', fetchImpl: async () => ({ ok: false, status: 503, text: async () => '{}' , headers: { get: () => null } }) }).generate({ system: '', user: 'x' }), /llama\.cpp-http-503/);
await assert.rejects(new OpenAICompatibleLocalChatProvider({ baseUrl: 'http://127.0.0.1:8080/v1', fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: ' ' } }] }), headers: { get: () => null } }) }).generate({ system: '', user: 'x' }), /llama\.cpp-empty-response/);
await assert.rejects(new OpenAICompatibleLocalChatProvider({ baseUrl: 'http://127.0.0.1:8080/v1', fetchImpl: async () => ({ ok: true, headers: { get: (n) => n === 'content-length' ? String(2 * 1024 * 1024 + 1) : null }, text: async () => '{}' }) }).generate({ system: '', user: 'x' }), /response-too-large/);

let streamCancelled = false;
let streamChunk = 0;
const oversizedChunkedResponse = new OpenAICompatibleLocalChatProvider({
  baseUrl: 'http://127.0.0.1:8080/v1',
  fetchImpl: async () => ({
    ok: true,
    headers: { get: () => null },
    body: new ReadableStream({
      pull(controller) {
        if (streamChunk++ === 0) controller.enqueue(new Uint8Array(2 * 1024 * 1024));
        else if (streamChunk === 2) controller.enqueue(new Uint8Array(1));
        else controller.close();
      },
      cancel() { streamCancelled = true; },
    }),
  }),
});
await assert.rejects(oversizedChunkedResponse.generate({ system: '', user: 'x' }), /response-too-large/,
  'chunked responses without Content-Length must be bounded while streaming');
assert.equal(streamCancelled, true, 'oversized response stream must be cancelled as soon as the byte budget is exceeded');
await assert.rejects(new OpenAICompatibleLocalChatProvider({ baseUrl: 'http://127.0.0.1:8080/v1', fetchImpl: async () => ({ ok: true, headers: { get: () => null }, text: async () => 'not-json' }) }).generate({ system: '', user: 'x' }), /invalid-json/);
assert.equal(new OpenAICompatibleLocalChatProvider().configured(), false);
await assert.rejects(new OpenAICompatibleLocalChatProvider().generate({ system: '', user: 'x' }), /llama\.cpp-not-configured/);

const ecology = new P40ModelEcologyEngine();
assert.equal(ecology.profile('llama.cpp').configured, false, 'local provider must not be assumed installed');
const legacySnapshot = ecology.snapshot();
legacySnapshot.profiles = legacySnapshot.profiles.filter(profile => profile.id !== 'llama.cpp');
const restored = new P40ModelEcologyEngine();
restored.restore(legacySnapshot);
assert.equal(restored.profile('llama.cpp').configured, false, 'new provider profile is added safely to old persisted snapshots');
restored.configure('llama.cpp', true);
const selected = restored.select({ task: 'language', urgency01: 0.3, resourceRisk01: 0.95, desiredQuality01: 0.65, allowCloud: false });
assert.equal(selected, 'llama.cpp', 'configured local backend can participate in canonical model ecology');
restored.observe('llama.cpp', false, 0.9);
restored.observe('llama.cpp', false, 0.9);
assert.equal(restored.profile('llama.cpp').available, false, 'failed local endpoint enters normal provider cooldown');
console.log(JSON.stringify({ status: 'PASS', pass: 'local-chat-provider-workpass40', provider: answer.backend, selectedModel: selected, security: 'loopback-only' }));
