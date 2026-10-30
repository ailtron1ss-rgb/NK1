import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { runMemoryOS2RetrievalBenchmark } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

const now = Date.now();
const memory = new MemoryOS2();
const rows = [
  ['en-train-1', 'The hippocampus stores episodic memories and temporal context.'],
  ['en-train-2', 'A local language model answers questions through a bounded provider.'],
  ['en-train-3', 'Causal learning compares predicted outcomes with observed outcomes.'],
  ['en-train-4', 'Memory consolidation preserves important experiences across sleep.'],
  ['ru-holdout-1', 'Гиппокамп помогает сохранять эпизодические воспоминания и временной контекст.'],
  ['ru-holdout-2', 'Локальная языковая модель отвечает через ограниченный программный интерфейс.'],
  ['ru-holdout-3', 'Причинное обучение сравнивает предсказанные результаты с наблюдаемыми.'],
  ['ru-holdout-4', 'Консолидация памяти сохраняет важный опыт во время сна.'],
  ['en-holdout-5', 'Uncertainty calibration checks whether confidence matches observed accuracy.'],
  ['ru-holdout-6', 'Калибровка неопределённости проверяет соответствие уверенности точности.'],
  ['en-holdout-7', 'A checkpoint restores durable state after a process restart.'],
  ['ru-holdout-8', 'Контрольная точка восстанавливает сохранённое состояние после перезапуска процесса.'],
];
const ids = new Map();
for (const [key, content] of rows) {
  const item = memory.encode({
    content, kind: 'semantic', source: 'workpass83-fixed-fixture', tags: ['workpass83'],
    context: {}, salience: .7, emotionalWeight: .1, identityRelevance: .1,
    goalRelevance: .1, socialRelevance: .1, predictionError: .1, confidence: .9,
    epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [],
    causalLinks: [], contradictionLinks: [], validFromAt: now - 60_000,
    observedAt: now - 60_000, provenanceClass: 'agent',
  }, { clone: false });
  ids.set(key, item.id);
}
const examples = [
  { id: 'train-en-1', query: 'hippocampus episodic memories temporal context', relevantIds: [ids.get('en-train-1')], split: 'train' },
  { id: 'train-en-2', query: 'local language model bounded provider', relevantIds: [ids.get('en-train-2')], split: 'train' },
  { id: 'train-en-3', query: 'causal learning observed outcomes', relevantIds: [ids.get('en-train-3')], split: 'train' },
  { id: 'train-en-4', query: 'memory consolidation sleep experiences', relevantIds: [ids.get('en-train-4')], split: 'train' },
  { id: 'holdout-ru-1', query: 'гиппокамп эпизодические воспоминания временной контекст', relevantIds: [ids.get('ru-holdout-1')], split: 'holdout' },
  { id: 'holdout-ru-2', query: 'локальная языковая модель программный интерфейс', relevantIds: [ids.get('ru-holdout-2')], split: 'holdout' },
  { id: 'holdout-ru-3', query: 'причинное обучение предсказанные наблюдаемые результаты', relevantIds: [ids.get('ru-holdout-3')], split: 'holdout' },
  { id: 'holdout-ru-4', query: 'консолидация памяти важный опыт сон', relevantIds: [ids.get('ru-holdout-4')], split: 'holdout' },
  { id: 'holdout-en-5', query: 'uncertainty calibration confidence observed accuracy', relevantIds: [ids.get('en-holdout-5')], split: 'holdout' },
  { id: 'holdout-ru-6', query: 'калибровка неопределённости уверенность точность', relevantIds: [ids.get('ru-holdout-6')], split: 'holdout' },
  { id: 'holdout-en-7', query: 'checkpoint durable state process restart', relevantIds: [ids.get('en-holdout-7')], split: 'holdout' },
  { id: 'holdout-ru-8', query: 'контрольная точка состояние перезапуск процесса', relevantIds: [ids.get('ru-holdout-8')], split: 'holdout' },
  { id: 'abstain-en-9', query: 'xenolith quasar tetrad unfound archive', relevantIds: [], split: 'holdout', answerable: false },
  { id: 'abstain-ru-10', query: 'кварк ксенолит вымышленный архив отсутствующий', relevantIds: [], split: 'holdout', answerable: false },
];
const provenanceBase = {
  datasetId: 'nk1-workpass83-synthetic-fixture',
  datasetVersion: '1',
  sourceRef: 'repository:test-fixture',
  labelingProtocol: 'Each query is paired with the single document whose fixed source text contains the query concepts; synthetic test only, not external evidence.',
  licenseId: 'LicenseRef-NK1-Synthetic-Fixture',
};
const before = JSON.stringify(memory.snapshot());
const fingerprintProbe = runMemoryOS2RetrievalBenchmark(memory.snapshot(), examples, {
  now, k: 3, minHoldoutQueries: 8, bootstrapSamples: 200, seed: 83,
  datasetProvenance: provenanceBase, maxExamples: 64,
});
const provenance = { ...provenanceBase, contentSha256: fingerprintProbe.datasetFingerprint };
const report = runMemoryOS2RetrievalBenchmark(memory.snapshot(), examples, {
  now, k: 3, minHoldoutQueries: 8, bootstrapSamples: 200, seed: 83,
  datasetProvenance: provenance, maxExamples: 64,
});
assert.equal(JSON.stringify(memory.snapshot()), before, 'benchmark must not mutate the live memory owner');
assert.equal(report.benchmark, 'memoryos2-retrieval-vs-bm25-baseline');
assert.equal(report.metrics.baseline.queries, 10);
assert.equal(report.metrics.candidate.queries, 10);
assert.equal(report.metrics.baseline.answerableQueries, 8);
assert.equal(report.metrics.candidate.unanswerableQueries, 2);
assert.ok(Number.isFinite(report.metrics.candidate.unsupportedRetrievalRate01));
assert.ok(Number.isFinite(report.metrics.candidate.falseAbstentionRate01));
assert.equal(report.datasetIntegrity.validForPromotion, true, 'fixed fixture should pass dataset integrity checks');
assert.equal(report.corpusIntegrity.validForPromotion, true);
assert.equal(report.promotion.requiresIndependentHumanOrCIReview, true);
assert.equal(report.promotion.minimumUnanswerableHoldoutQueries, 4);
assert.equal(report.promotion.gates.sufficientUnanswerableEvidence, false,
  'two unanswerable examples are too few to authorize an abstention promotion claim');
assert.equal(report.promotion.reason, 'insufficient-unanswerable-holdout',
  'insufficient abstention evidence must have an explicit fail-closed reason');
assert.equal(report.guardrails.liveMemoryMutated, false);
assert.ok(Number.isFinite(report.metrics.baseline.recallAtK01));
assert.ok(Number.isFinite(report.metrics.candidate.mrr01));
assert.equal(report.promotion.status, report.promotion.allowed ? 'candidate-eligible-for-separate-review' : 'not-promoted',
  'promotion status must faithfully reflect all gates; this fixture is not independent scientific evidence');
assert.equal(report.schemaVersion, 8, 'metric and conversation-cluster shape changes must advance the report schema');
assert.equal(report.confidence.unsupportedRetrievalRate01.samples, 200,
  'unsupported retrieval must be evaluated with the configured paired bootstrap');
assert.ok(Number.isFinite(report.confidence.unsupportedRetrievalRate01.upperBound01),
  'abstention confidence interval must be finite');
assert.equal(report.promotion.gates.abstentionConfidenceNonInferioritySupported,
  report.confidence.unsupportedRetrievalRate01.upperBound01 <= report.promotion.maximumUnsupportedRetrievalRegression01,
  'promotion gate must match the upper confidence bound and explicit tolerance');
assert.equal(report.datasetProvenance.datasetId, 'nk1-workpass83-synthetic-fixture');
assert.equal(report.datasetProvenance.contentHashValid, true, 'provenance hash must bind to the exact canonical dataset');
const badHashReport = runMemoryOS2RetrievalBenchmark(memory.snapshot(), examples, {
  now, k: 3, minHoldoutQueries: 8, bootstrapSamples: 200, seed: 83,
  datasetProvenance: { ...provenance, contentSha256: '0'.repeat(64) }, maxExamples: 64,
});
assert.equal(badHashReport.datasetProvenance.contentHashValid, false);
assert.equal(badHashReport.promotion.allowed, false, 'a mismatched dataset content hash must block promotion');
assert.equal(badHashReport.promotion.reason, 'dataset-provenance-incomplete');

const leaked = [...examples, { ...examples[0], id: 'leaked-copy', split: 'holdout' }];
const leakReport = runMemoryOS2RetrievalBenchmark(memory.snapshot(), leaked, {
  now, k: 3, minHoldoutQueries: 8, bootstrapSamples: 200, seed: 83,
  datasetProvenance: provenance, maxExamples: 64,
});
assert.equal(leakReport.datasetIntegrity.validForPromotion, false,
  'duplicated normalized query across train/holdout must block promotion');
assert.equal(leakReport.promotion.allowed, false);

const overlongLabels = [...examples, {
  id: 'holdout-too-many-labels',
  query: 'a deliberately bounded query whose labels must not be silently truncated',
  relevantIds: Array.from({ length: 25 }, (_, index) => index === 0 ? ids.get('en-train-1') : `unknown-label-${index}`),
  split: 'holdout',
}];
const truncatedLabelReport = runMemoryOS2RetrievalBenchmark(memory.snapshot(), overlongLabels, {
  now, k: 3, minHoldoutQueries: 8, bootstrapSamples: 200, seed: 83,
  datasetProvenance: provenance, maxExamples: 64,
});
assert.equal(truncatedLabelReport.datasetIntegrity.truncatedFieldRows, 1,
  'source rows with clipped labels must be reported rather than silently normalized');
assert.equal(truncatedLabelReport.datasetIntegrity.validForPromotion, false,
  'silently truncated label sets must block candidate promotion');
assert.equal(truncatedLabelReport.promotion.allowed, false,
  'a clipped label set must never authorize promotion');

console.log('WORKPASS83_RETRIEVAL_BENCHMARK_TRUTH=PASS', JSON.stringify({
  corpus: report.corpusSize,
  trainQueries: report.trainQueries,
  holdoutQueries: report.holdoutQueries,
  answerableQueries: report.metrics.candidate.answerableQueries,
  unanswerableQueries: report.metrics.candidate.unanswerableQueries,
  candidateUnsupportedRetrievalRate: report.metrics.candidate.unsupportedRetrievalRate01,
  candidateFalseAbstentionRate: report.metrics.candidate.falseAbstentionRate01,
  baselineRecallAt3: report.metrics.baseline.recallAtK01,
  candidateRecallAt3: report.metrics.candidate.recallAtK01,
  baselineMRR: report.metrics.baseline.mrr01,
  candidateMRR: report.metrics.candidate.mrr01,
  liveMemoryMutated: report.guardrails.liveMemoryMutated,
  tinyFixturePromotionAllowed: report.promotion.allowed,
  promotionDecisionConsistent: report.promotion.status === (report.promotion.allowed ? 'candidate-eligible-for-separate-review' : 'not-promoted'),
  abstentionConfidenceBound: report.confidence.unsupportedRetrievalRate01.upperBound01,
  abstentionConfidenceGate: report.promotion.gates.abstentionConfidenceNonInferioritySupported,
  crossSplitLeakageBlocksPromotion: !leakReport.datasetIntegrity.validForPromotion,
  syntheticFixtureIsNotExternalEvidence: true,
}));
