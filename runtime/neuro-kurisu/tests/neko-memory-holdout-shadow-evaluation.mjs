import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { fingerprintMemoryRetrievalDataset, runMemoryOS2RetrievalBenchmark } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

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
const report = runMemoryOS2RetrievalBenchmark(snapshot, examples, {
  now: Date.now(),
  k: 1,
  seed: 13,
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
  candidateRetriever: () => [],
});

assert.equal(report.metrics.baseline.recallAtK01, 1, 'BM25 baseline should retrieve every exact bilingual fixture');
assert.equal(report.metrics.candidate.recallAtK01, 0,
  'the injected shadow candidate arm must be the one scored by the existing holdout benchmark');
assert.equal(report.metrics.candidate.falseAbstentionRate01, 1);
assert.equal(report.candidateStrategy, 'neko-shadow-rrf');
assert.ok(report.queryEvidence.holdout.every(row => row.candidateRankedMemory.length === 0),
  'the existing Inspect evidence export must contain the shadow arm, not canonical MemoryOS2 results');
assert.equal(report.promotion.allowed, false, 'synthetic CI evidence must never authorize promotion');

console.log(JSON.stringify({
  status: 'PASS',
  suite: 'neko-memory-holdout-shadow-evaluation',
  baselineRecallAtK01: report.metrics.baseline.recallAtK01,
  shadowRecallAtK01: report.metrics.candidate.recallAtK01,
  inspectEvidenceRows: report.queryEvidence.holdout.length,
  syntheticPromotionBlocked: report.promotion.allowed === false,
}));
