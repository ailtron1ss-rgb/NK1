import assert from 'node:assert/strict';
import { OpenAICompatibleLocalChatProvider } from '../src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts';

const schema = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['answer', 'wait'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['intent', 'confidence'],
  additionalProperties: false,
};
const calls = [];
const provider = new OpenAICompatibleLocalChatProvider({
  baseUrl: 'http://127.0.0.1:8080/v1',
  model: 'nk1-local-test',
  fetchImpl: async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)), redirect: init.redirect });
    return new Response(JSON.stringify({
      model: 'nk1-local-test',
      choices: [{ message: { content: '{"intent":"wait","confidence":0.91}' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});

const result = await provider.generate({
  system: 'Return a structured decision.',
  user: 'Choose whether to wait.',
  responseFormat: { type: 'json_object', schema },
});

assert.deepEqual(result.structuredOutput, { intent: 'wait', confidence: 0.91 });
assert.equal(calls.length, 1);
assert.deepEqual(calls[0].body.response_format, { type: 'json_object', schema });
assert.equal(calls[0].body.stream, false);
assert.equal(calls[0].redirect, 'error');

// Legacy text requests preserve the original transport contract.
{
  const legacyCalls = [];
  const legacy = new OpenAICompatibleLocalChatProvider({
    baseUrl: 'http://localhost:8080/v1',
    fetchImpl: async (_url, init) => {
      legacyCalls.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'plain text answer' } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const answer = await legacy.generate({ system: '', user: 'hello' });
  assert.equal(answer.text, 'plain text answer');
  assert.equal(answer.structuredOutput, undefined);
  assert.equal(Object.hasOwn(legacyCalls[0], 'response_format'), false);
}

// Invalid schema data is rejected before reaching the local model transport.
{
  let getterCalls = 0;
  const unsafeSchema = {};
  Object.defineProperty(unsafeSchema, 'type', {
    enumerable: true,
    get() { getterCalls += 1; throw new Error('schema-getter-executed'); },
  });
  let transportCalls = 0;
  const guarded = new OpenAICompatibleLocalChatProvider({
    baseUrl: 'http://127.0.0.1:8080/v1',
    fetchImpl: async () => {
      transportCalls += 1;
      throw new Error('transport-must-not-run');
    },
  });
  await assert.rejects(
    guarded.generate({ system: '', user: '', responseFormat: { type: 'json_object', schema: unsafeSchema } }),
    /llama.cpp-invalid-response-schema/,
  );
  assert.equal(getterCalls, 0, 'schema accessors must not execute during validation');
  assert.equal(transportCalls, 0, 'invalid schema must be rejected before network I/O');
}

// A server that violates JSON mode must not leak malformed structured output downstream.
{
  const malformed = new OpenAICompatibleLocalChatProvider({
    baseUrl: 'http://127.0.0.1:8080/v1',
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'not-json' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  await assert.rejects(
    malformed.generate({ system: '', user: '', responseFormat: { type: 'json_object' } }),
    /llama.cpp-invalid-structured-json/,
  );
}

console.log('llama.cpp schema-constrained JSON output: PASS');
