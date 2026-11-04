import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { fingerprintMemoryRetrievalDataset } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';
import { runMemoryOS2RetrievalExperiment } from '../src/organism/memory/MemoryRetrievalExperiment.ts';
import { previewNekoHybridMemoryRanking } from '../../../integrations/neko-memory-shadow/src/memoryos2-preview.mjs';

const memory = new MemoryOS2({ embeddingProvider: null });
const examples = [];
const encode = content => ({
  content, kind: 'episodic', source: 'independent-holdout-fixture',
  tags: [], context: {}, salience: .9, emotionalWeight: .1,
  identityRelevance: .1, goalRelevance: .1, socialRelevance: .1,
  predictionError: .05, confidence: .95, epistemicStatus: 'fact',
  entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [],
});
for (const language of ['en', 'ru']) {
  const words = language === 'en' ? ['astronomy', 'telescope', 'memory', 'fact'] : ['астрономия', 'телескоп', 'память', 'факт'];
  for (const split of ['train', 'holdout']) {
    const count = split === 'train' ? 4 : 8;
    for (let index = 0; index < count; index += 1) {
      const query = [...words, language, split, String(index)].join(' ');
      const item = memory.encode(encode(query));
      examples.push({
        id: `${language}-${split}-${index}`, query, relevantIds: [item.id], split,
        language, independenceGroupId: `${language}-${split}-source-${index}`,
      });
    }
  }
  for (let index = 0; index < 2; index += 1) {
    examples.push({
      id: `${language}-unanswerable-${index}`,
      query: language === 'en' ? `quantum chromodynamics absent ${index}` : `квантовая хромодинамика отсутствует ${index}`,
      relevantIds: [], split: 'holdout', answerable: false, language,
      independenceGroupId: `${language}-unanswerable-source-${index}`,
    });
  }
}

const snapshot = memory.snapshot();
const shadowMemory = new MemoryOS2({ embeddingProvider: null });
shadowMemory.restore(structuredClone(snapshot));
const itemById = new Map(snapshot.items.map(item => [item.id, item]));
const shadowByQuery = new Map();
for (const query of new Set(examples.map(example => example.query))) {
  const result = await previewNekoHybridMemoryRanking(shadowMemory, query, {
    limit: 1,
    maxPerChannel: 64,
    includeSemanticEmbeddingChannel: false,
    useCanonicalWeights: false,
  });
  shadowByQuery.set(query, result.shadowIds.map(id => itemById.get(id)).filter(Boolean));
}
let injectedCandidateCalls = 0;
const report = runMemoryOS2RetrievalExperiment(snapshot, examples, {
  now: Date.now(),
  k: 1,
  seeds: [11, 29, 47, 71, 101],
  bootstrapSamples: 200,
  minHoldoutQueries: 20,
  minUnanswerableHoldoutQueries: 4,
  minLanguageTrainQueries: 4,
  minLanguageAnswerableHoldoutQueries: 8,
  minLanguageUnanswerableHoldoutQueries: 2,
  includeQueryEvidence: true,
  evidenceHashSalt: 'a'.repeat(64),
  datasetProvenance: {
    datasetId: 'nk1-shadow-candidate-fixture',
    datasetVersion: '1',
    sourceRef: 'synthetic://ci-fixture',
    labelingProtocol: 'deterministic fixture labels',
    licenseId: 'LicenseRef-NK1-Synthetic-Fixture',
    contentSha256: fingerprintMemoryRetrievalDataset(examples),
  },
  candidateStrategy: 'neko-shadow-rrf',
  candidateRrfProfile: 'equal',
  candidateVectorEnabled: false,
  candidateRetriever: (query, limit) => { injectedCandidateCalls++; return (shadowByQuery.get(query) ?? []).slice(0, limit); },
});

assert.ok(report.metrics.baseline.recallAtK01 > .5, 'BM25 baseline should retrieve every exact bilingual fixture');
assert.ok(report.metrics.candidate.recallAtK01 > .5,
  'the actual MemoryOS2 shadow RRF arm must preserve bilingual exact-match recall');
assert.equal(report.metrics.candidate.unsupportedRetrievalRate01, 0,
  'unanswerable holdout queries must remain abstentions');
assert.ok(report.metrics.candidate.falseAbstentionRate01 < .1);
assert.ok(injectedCandidateCalls >= examples.length * 5, 'paired benchmark must invoke the injected shadow candidate arm for every example and seed');
assert.equal(report.candidateStrategy, 'neko-shadow-rrf');
assert.ok(report.queryEvidence.holdout.filter(row => row.answerable).every(row => row.candidateRankedMemory.length > 0),
  'the existing Inspect evidence export must contain the real shadow arm for answerable holdout rows');
assert.ok(report.queryEvidence.holdout.filter(row => !row.answerable).every(row => row.candidateRankedMemory.length === 0),
  'the Inspect evidence export must preserve abstention for unanswerable holdout rows');
assert.equal(report.promotion.allowed, false, 'synthetic CI evidence must never authorize promotion');

console.log(JSON.stringify({
  status: 'PASS',
  suite: 'neko-memory-holdout-shadow-evaluation',
  pairedSeeds: report.seedCount,
  shadowRecallAtK01: report.runs[0].candidateHoldout.recallAtK01,
  inspectEvidenceRows: report.queryEvidence.holdout.length,
  syntheticPromotionBlocked: report.promotion.allowed === false,
}));
