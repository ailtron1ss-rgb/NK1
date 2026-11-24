import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMemoryOS2ShadowPreview, previewNekoHybridMemoryRanking } from '../src/memoryos2-preview.mjs';

const preview = {
  itemIds: ['baseline-a', 'baseline-b'],
  rankedChannels: {
    bm25: ['baseline-a', 'shared', 'lexical'],
    vector: ['shared', 'baseline-b', 'semantic'],
    metadata: [],
  },
  currentRrfK: 60,
  maxPerChannel: 64,
  currentRrfWeights: { bm25: 1, vector: 0.5, metadata: 0 },
  diagnostics: { abstained: false, answerabilityGate: 'direct-evidence-or-typed-recall-v1', rankedBeforeGate: 4, groundedAfterGate: 3 },
};

test('MemoryOS2 preview converts ranked ID channels into a text-free RRF comparison', () => {
  const result = evaluateMemoryOS2ShadowPreview(preview, { limit: 3 });
  assert.equal(result.channelNames.length, 3);
  assert.equal(result.shadowIds[0], 'shared');
  assert.equal(result.currentRrfK, 60);
  assert.equal(result.currentRrfWeights.metadata, 0);
  assert.equal(result.currentRrfWeights.metadata, 0);
  assert.equal(result.diagnostics.groundedAfterGate, 3);
  assert.ok(!JSON.stringify(result).includes('memory text'));
});

test('canonical channel weights can be replayed without mutating the preview', () => {
  const before = JSON.stringify(preview);
  const result = evaluateMemoryOS2ShadowPreview(preview, { channelWeights: preview.currentRrfWeights });
  assert.deepEqual(result.shadowItems[0].ranks.map(row => row.channel), ['bm25', 'vector']);
  assert.equal(JSON.stringify(preview), before);
});

test('rank export cap is carried through when evaluator options are omitted', () => {
  const ids = Array.from({ length: 65 }, (_, index) => `id-${index}`);
  const extended = { ...preview, maxPerChannel: 65, rankedChannels: { bm25: ids, vector: ids } };
  const result = evaluateMemoryOS2ShadowPreview(extended);
  assert.equal(result.diagnostics.candidatesSeen, 130);
  assert.equal(result.shadowIds.length, 8);
});

test('answerability abstention cannot be bypassed by shadow-ranked candidates', () => {
  const abstained = { ...preview, itemIds: [], rankedChannels: { bm25: ['unanswerable'] }, diagnostics: { ...preview.diagnostics, abstained: true } };
  assert.throws(() => evaluateMemoryOS2ShadowPreview(abstained), /abstained preview/);
});

test('accessors, proxies and sparse rank arrays fail closed', () => {
  const unsafe = { ...preview };
  Object.defineProperty(unsafe, 'rankedChannels', { get() { throw new Error('getter ran'); } });
  assert.throws(() => evaluateMemoryOS2ShadowPreview(unsafe), /plain data record/);
  const proxy = new Proxy(preview, { getPrototypeOf() { throw new Error('trap ran'); } });
  assert.throws(() => evaluateMemoryOS2ShadowPreview(proxy), /plain data record/);
  const sparse = { ...preview, rankedChannels: { bm25: new Array(2) } };
  assert.throws(() => evaluateMemoryOS2ShadowPreview(sparse), /dense string array|own data strings/);
});

test('optional cosine preview adds a vector rank channel but never returns memory text', async () => {
  let embeddingCalls = 0;
  const fakeMemory = {
    previewRetrieveWithRankedChannels() {
      return { ...preview, rankedChannels: { bm25: ['baseline-a', 'shared'], coverage: ['baseline-a'] } };
    },
    async previewRetrieveWithEmbeddings() {
      embeddingCalls++;
      return {
        items: [{ id: 'vector-only', content: 'private memory body must not escape' }, { id: 'shared', content: 'also private' }],
        semantic: { enabled: true, provider: 'ollama', model: 'fixture', fallbackReason: null, coverage01: .5, indexedItems: 2, corpusItems: 4 },
      };
    },
  };
  const result = await previewNekoHybridMemoryRanking(fakeMemory, 'astronomy telescope', { includeSemanticEmbeddingChannel: true });
  assert.equal(embeddingCalls, 1);
  assert.ok(result.channelNames.includes('vector'));
  assert.ok(result.shadowIds.includes('vector-only'));
  assert.equal(result.semantic.provider, 'ollama');
  assert.equal(result.semanticIncludedInShadowFusion, true);
  assert.equal(result.userFacingEligible, false);
  assert.ok(!JSON.stringify(result).includes('private memory body'));
});

test('MemoryOS2 profile replays canonical channel weights and defaults vector to one', async () => {
  const fakeMemory = {
    previewRetrieveWithRankedChannels() {
      return {
        itemIds: ['base'],
        rankedChannels: { bm25: ['base'], coverage: [], fuzzy: [], metadata: [], entity: [], relationship: [] },
        currentRrfK: 60,
        currentRrfWeights: { bm25: 1, coverage: .9, fuzzy: .6, metadata: 0, entity: .42, relationship: .32 },
        maxPerChannel: 64,
        diagnostics: { abstained: false },
      };
    },
    async previewRetrieveWithEmbeddings() {
      return { items: [{ id: 'vector' }], semantic: { enabled: true, provider: 'ollama', model: 'fixture', fallbackReason: null, coverage01: 1, indexedItems: 2, corpusItems: 2 } };
    },
  };
  const result = await previewNekoHybridMemoryRanking(fakeMemory, 'profile test', {
    includeSemanticEmbeddingChannel: true,
    useCanonicalWeights: true,
  });
  assert.equal(result.rrfProfile, 'memoryos2');
  assert.ok(result.shadowIds.includes('base'));
  assert.ok(result.shadowIds.includes('vector'));
});

test('vector-only candidates remain evaluation-only when canonical answerability abstains', async () => {
  let embeddingCalls = 0;
  const fakeMemory = {
    previewRetrieveWithRankedChannels() {
      return { itemIds: [], rankedChannels: { bm25: [], coverage: [] }, currentRrfK: 60, currentRrfWeights: {}, diagnostics: { abstained: true } };
    },
    async previewRetrieveWithEmbeddings() {
      embeddingCalls++;
      return { items: [{ id: 'exploratory-only', content: 'must not become a recall result' }], semantic: { enabled: true, provider: 'ollama', model: 'fixture', fallbackReason: null, coverage01: .25, indexedItems: 1, corpusItems: 3 } };
    },
  };
  const result = await previewNekoHybridMemoryRanking(fakeMemory, 'unsupported query', { includeSemanticEmbeddingChannel: true, semanticWeight: .7 });
  assert.equal(embeddingCalls, 1);
  assert.deepEqual(result.shadowIds, []);
  assert.deepEqual(result.exploratorySemanticIds, ['exploratory-only']);
  assert.equal(result.semanticIncludedInShadowFusion, false);
  assert.equal(result.semanticExploratoryOnly, true);
  assert.equal(result.userFacingEligible, false);
  assert.equal(result.diagnostics.abstained, true);
  assert.ok(!JSON.stringify(result).includes('must not become a recall result'));
});
