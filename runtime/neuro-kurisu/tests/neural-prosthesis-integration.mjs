import assert from 'node:assert/strict';
import { NeuralProsthesisChatProvider } from '../src/organism/integration/local/NeuralProsthesisChatProvider.ts';
import { P40ModelEcologyEngine } from '../src/organism/learning/P40ModelEcology.ts';

const calls = [];
const provider = new NeuralProsthesisChatProvider({
  baseUrl: 'http://127.0.0.1:8091/v1/',
  model: 'kurisu-transformer-local',
  adapterId: 'kurisu-reasoning-v1',
  timeoutMs: 8000,
  fetchImpl: async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({
        model: 'kurisu-transformer-local',
        choices: [{ message: { content: 'Я проверю гипотезу, не изменяя базовую модель.' } }],
      }),
    };
  },
});

assert.equal(provider.configured(), true);
assert.equal(provider.endpoint(), 'http://127.0.0.1:8091/v1/chat/completions');
const answer = await provider.generate({
  system: 'You are Neuro Kurisu.',
  user: 'Explain the safety boundary.',
  maxTokens: 160,
  temperature: 0.2,
});
assert.match(answer.backend, /^neural-prosthesis:/);
assert.equal(answer.text, 'Я проверю гипотезу, не изменяя базовую модель.');
assert.equal(calls.length, 1);
assert.equal(calls[0].body.model, 'kurisu-transformer-local');
assert.equal(calls[0].body.adapter_id, 'kurisu-reasoning-v1');
assert.equal(calls[0].body.stream, false);
assert.equal(calls[0].body.max_tokens, 160);
assert.equal(calls[0].init.redirect, 'error');

assert.throws(() => new NeuralProsthesisChatProvider({ baseUrl: 'https://127.0.0.1:8091/v1' }), /loopback-http/);
assert.throws(() => new NeuralProsthesisChatProvider({ baseUrl: 'http://example.com:8091/v1' }), /loopback-http/);
assert.equal(new NeuralProsthesisChatProvider().configured(), false);
await assert.rejects(
  new NeuralProsthesisChatProvider().generate({ system: '', user: 'hello' }),
  /not-configured/,
);
await assert.rejects(
  new NeuralProsthesisChatProvider({
    baseUrl: 'http://127.0.0.1:8091/v1',
    fetchImpl: async () => ({ ok: false, status: 503, headers: { get: () => null }, text: async () => '{}' }),
  }).generate({ system: '', user: 'hello' }),
  /http-503/,
);

const ecology = new P40ModelEcologyEngine();
const profile = ecology.profile('neural-prosthesis');
assert.ok(profile, 'P40 must know the optional neural-prosthesis backend');
assert.equal(profile.configured, false, 'the optional backend must be disabled by default');
ecology.configure('neural-prosthesis', true);
const selected = ecology.select({
  task: 'language',
  urgency01: 0.8,
  resourceRisk01: 0.2,
  desiredQuality01: 0.9,
  allowCloud: false,
});
assert.equal(selected, 'neural-prosthesis', 'P40 must be able to select the configured local residual backend');

const aborted = new AbortController();
aborted.abort();
await assert.rejects(
  provider.generate({ system: '', user: 'hello', signal: aborted.signal }),
  /aborted/,
);

console.log(JSON.stringify({
  status: 'PASS',
  pass: 'neural-prosthesis-transformer-residual',
  backend: answer.backend,
  ecologySelection: selected,
  adapter: calls[0].body.adapter_id,
  safety: 'loopback-only; opt-in',
}));
