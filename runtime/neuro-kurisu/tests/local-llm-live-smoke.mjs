import assert from 'node:assert/strict';
import { OpenAICompatibleLocalChatProvider } from '../src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts';

const baseUrl = String(process.env.LLAMA_CPP_SMOKE_URL ?? '').trim();
if (!baseUrl) {
  console.log('LOCAL_LLM_LIVE_SMOKE=SKIP', JSON.stringify({ reason: 'set LLAMA_CPP_SMOKE_URL to an explicitly chosen loopback llama.cpp /v1 endpoint', requiresNetwork: false, modelDownload: false }));
  process.exit(0);
}

const model = String(process.env.LLAMA_CPP_SMOKE_MODEL ?? 'local-model').slice(0, 160);
const timeoutMs = Math.max(1000, Math.min(120_000, Number(process.env.LLAMA_CPP_SMOKE_TIMEOUT_MS ?? 30_000)));
const requestedRuns = Math.floor(Number(process.env.LLAMA_CPP_SMOKE_RUNS ?? 3));
const runs = Math.max(1, Math.min(5, Number.isFinite(requestedRuns) ? requestedRuns : 3));
const prompt = String(process.env.LLAMA_CPP_SMOKE_PROMPT ?? 'Reply with a short greeting and one sentence explaining what a local language model does.').slice(0, 2000);
const provider = new OpenAICompatibleLocalChatProvider({ baseUrl, model, timeoutMs });
assert.equal(provider.configured(), true);
const samples = [];
for (let index = 0; index < runs; index += 1) {
  const response = await provider.generate({
    system: 'You are a local inference smoke-test model. Answer briefly and do not claim external access.',
    user: prompt,
    maxTokens: 96,
    temperature: 0.1,
  });
  assert.ok(response.text.length > 0, `empty output on run ${index + 1}`);
  assert.ok(response.backend.startsWith('llama.cpp:'), 'provider must identify the actual local backend');
  assert.ok(Number.isFinite(response.latencyMs) && response.latencyMs >= 0, 'latency must be finite and non-negative');
  samples.push({ run: index + 1, backend: response.backend, latencyMs: response.latencyMs, outputChars: response.text.length });
}
const sorted = samples.map(row => row.latencyMs).sort((a, b) => a - b);
const percentile = p => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
console.log('LOCAL_LLM_LIVE_SMOKE=PASS', JSON.stringify({
  endpoint: provider.endpoint(),
  requestedModel: model,
  actualBackend: samples.at(-1)?.backend,
  runs,
  coldFirstLatencyMs: samples[0]?.latencyMs,
  warmMedianLatencyMs: percentile(0.5),
  p95LatencyMs: percentile(0.95),
  samples,
  promptLogged: false,
  outputTextLogged: false,
  limitations: ['small smoke sample, not a benchmark', 'does not establish answer quality or learning'],
}));
