import assert from 'node:assert/strict';
import { LocalSmallModelHub } from '../src/server/LocalSmallModelHub.mjs';
import { LocalLanguageBackendPolicy } from '../src/server/local-language-backend-policy.mjs';

let now = 1_000;
const clock = () => now;
const sent = { classifier: [], emotion: [], embeddings: [] };
const languagePolicy = new LocalLanguageBackendPolicy({ baseCooldownMs: 100, maxCooldownMs: 400 });
const languageProvider = {
  model: 'tiny-chat-q4',
  configured: () => true,
};
const embeddingProvider = {
  providerId: 'ollama:http://127.0.0.1:11434:embeddinggemma',
  modelId: 'embeddinggemma',
  async embedBatch(texts) {
    sent.embeddings.push(...texts);
    return texts.map((_, index) => [1, index + 1, 0]);
  },
  diagnostics() {
    return { configured: true, provider: 'ollama', model: 'embeddinggemma', endpoint: 'http://127.0.0.1:11434', cacheEntries: 2 };
  },
};
const classifierProvider = {
  model: 'tiny-classifier-q4',
  configured: () => true,
  async generate(request) {
    sent.classifier.push(request);
    return { text: JSON.stringify({ label: 'technical', confidence: 0.92 }), backend: 'llama.cpp:tiny-classifier-q4' };
  },
};
const emotionProvider = {
  model: 'tiny-affect-q4',
  configured: () => true,
  async generate(request) {
    sent.emotion.push(request);
    return { text: JSON.stringify({ emotion: 'curiosity', valence: 0.4, arousal: 0.6, confidence: 0.81 }), backend: 'llama.cpp:tiny-affect-q4' };
  },
};

const hub = new LocalSmallModelHub({
  languageProvider, embeddingProvider, classifierProvider, emotionProvider,
  languagePolicy, clock,
});
assert.equal(hub.selectLanguage({ localLlamaConfigured: true, ecologyPreferredBackend: 'gemini' }), 'llama.cpp');
hub.observeLanguage({ backend: 'gemini:remote-model', failures: ['llama.cpp:timeout'], latencyMs: 40, success: true });
assert.equal(hub.selectLanguage({ localLlamaConfigured: true, ecologyPreferredBackend: 'kobold' }), 'kobold',
  'the shared router must honor the local language circuit breaker');
now += 101;
assert.equal(hub.selectLanguage({ localLlamaConfigured: true, ecologyPreferredBackend: 'gemini' }), 'llama.cpp',
  'the local language route should resume at the cooldown deadline');
hub.observeLanguage({ backend: 'llama.cpp:tiny-chat-q4', failures: [], latencyMs: 12, success: true });

const classified = await hub.classifyText(
  'Please investigate the runtime; contact me at alice@example.com and api_key=super_secret_value_123',
  ['question', 'technical', 'request', 'other'],
);
assert.deepEqual(
  { label: classified.label, confidence: classified.confidence },
  { label: 'technical', confidence: 0.92 },
);
const classifierWire = JSON.stringify(sent.classifier);
assert.equal(classifierWire.includes('alice@example.com'), false, 'email should be removed before local model input');
assert.equal(classifierWire.includes('super_secret_value_123'), false, 'credential-like values should be removed before model input');
assert.ok(classifierWire.includes('REDACTED_EMAIL'));
assert.ok(classifierWire.includes('REDACTED_CREDENTIAL'));
assert.equal(classified.model, 'llama.cpp:tiny-classifier-q4');

const affect = await hub.analyzeEmotion('I am delighted by this discovery!');
assert.deepEqual(
  { emotion: affect.emotion, valence: affect.valence, arousal: affect.arousal, confidence: affect.confidence },
  { emotion: 'curiosity', valence: 0.4, arousal: 0.6, confidence: 0.81 },
);

const vectors = await hub.embedBatch(['memory about science', 'memory about sarcasm']);
assert.equal(vectors.length, 2);
assert.equal(vectors[0].length, 3);
assert.equal(sent.embeddings.length, 2);
await assert.rejects(() => hub.embedBatch(Array.from({ length: 33 }, (_, i) => `text ${i}`)), /batch-limit/);

const signals = await hub.deriveContextSignals('A short safe sentence');
assert.equal(signals.intent.label, 'technical');
assert.equal(signals.affect.emotion, 'curiosity');

const before = hub.snapshot();
assert.equal(before.localFirst, true);
assert.equal(before.models.length, 4);
assert.equal(before.models.find((row) => row.id === 'local-embeddings').state, 'observed-healthy');
assert.equal(before.metrics.classification.successes, 2);
assert.equal(before.metrics.emotion.successes, 2);
assert.equal(before.metrics.embeddings.successes, 1);
assert.ok(before.recentDecisions.length <= 32);
assert.equal(JSON.stringify(before).includes('super_secret_value_123'), false);
assert.equal(JSON.stringify(before).includes('alice@example.com'), false);
assert.equal(JSON.stringify(before).includes('A short safe sentence'), false, 'diagnostics must not retain prompts');

const offHub = new LocalSmallModelHub({ languagePolicy, clock, enableContextSignals: false });
assert.equal(await offHub.deriveContextSignals('Do not run auxiliary inference'), null);
assert.equal(offHub.snapshot().contextSignalsEnabled, false);

const invalidEmotionHub = new LocalSmallModelHub({
  emotionProvider: { configured: () => true, model: 'bad-fixture', async generate() {
    return { text: JSON.stringify({ emotion: 'made-up', valence: 8, arousal: -1, confidence: 2 }) };
  } },
  clock,
});
await assert.rejects(() => invalidEmotionHub.analyzeEmotion('test'), /schema-mismatch/);
assert.equal(invalidEmotionHub.snapshot().metrics.emotion.failures, 1);
assert.equal(invalidEmotionHub.snapshot().metrics.emotion.lastFailureCode, 'inference-failed');

console.log('LOCAL_SMALL_MODEL_HUB=PASS', JSON.stringify({
  languageRouting: true,
  specialistSchemas: true,
  embeddingBatchBound: true,
  promptRedaction: true,
  telemetryRedactsPrompts: true,
  contextSignals: true,
  malformedOutputRejected: true,
}));
