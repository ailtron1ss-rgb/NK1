import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMemoryOS2ShadowPreview } from '../src/memoryos2-preview.mjs';

const preview = {
  itemIds: ['baseline-a', 'baseline-b'],
  rankedChannels: {
    bm25: ['baseline-a', 'shared', 'lexical'],
    vector: ['shared', 'baseline-b', 'semantic'],
  },
  currentRrfK: 60,
  currentRrfWeights: { bm25: 1, vector: 0.5 },
  diagnostics: { abstained: false, answerabilityGate: 'direct-evidence-or-typed-recall-v1', rankedBeforeGate: 4, groundedAfterGate: 3 },
};

test('MemoryOS2 preview converts ranked ID channels into a text-free RRF comparison', () => {
  const result = evaluateMemoryOS2ShadowPreview(preview, { limit: 3 });
  assert.equal(result.channelNames.length, 2);
  assert.equal(result.shadowIds[0], 'shared');
  assert.equal(result.currentRrfK, 60);
  assert.equal(result.diagnostics.groundedAfterGate, 3);
  assert.ok(!JSON.stringify(result).includes('memory text'));
});

test('canonical channel weights can be replayed without mutating the preview', () => {
  const before = JSON.stringify(preview);
  const result = evaluateMemoryOS2ShadowPreview(preview, { channelWeights: preview.currentRrfWeights });
  assert.deepEqual(result.shadowItems[0].ranks.map(row => row.channel), ['bm25', 'vector']);
  assert.equal(JSON.stringify(preview), before);
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
