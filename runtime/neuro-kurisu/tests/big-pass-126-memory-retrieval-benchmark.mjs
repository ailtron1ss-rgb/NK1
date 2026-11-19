import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { fingerprintMemoryRetrievalDataset, runMemoryOS2RetrievalBenchmark } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

const now = 2_000_000_000_000;
const memory = new MemoryOS2();
const encode = (id, content, extras = {}) => memory.encode({
  id, content, kind: 'semantic', source: 'benchmark-fixture', tags: ['memory-benchmark'], context: { fixture: 'workpass8' },
  salience: .6, emotionalWeight: .2, identityRelevance: .2, goalRelevance: .2, socialRelevance: .1,
  predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
  validFromAt: now - 10000, provenanceClass: 'external', sourceAuthority01: .9, observedAt: now - 1000, ...extras,
});
for (let i = 0; i < 16; i++) encode(`m${i}`, `project-elm telemetry route ${i} records status ${i % 4} latency ${i % 3}`);
encode('m-quarantine', 'project-elm telemetry route quarantined corrupted', { epistemicStatus: 'quarantined', confidence: .99 });
encode('m-expired', 'project-elm telemetry route expired record', { validUntilAt: now - 1 });
const examples = [];
for (let i = 0; i < 4; i++) examples.push({ id: `train-${i}`, query: `project elm telemetry status ${i % 4} training ${i}`, relevantIds: [`m${i}`], split: 'train' });
for (let i = 0; i < 8; i++) examples.push({ id: `holdout-${i}`, query: `project elm telemetry status ${i % 4} latency sample ${i}`, relevantIds: [`m${i}`], split: 'holdout' });
const options = {
  now, k: 5, minHoldoutQueries: 8, minimumRecallUplift01: .02, bootstrapSamples: 400, seed: 17,
  datasetProvenance: {
    datasetId: 'workpass8-synthetic-regression-fixture',
    datasetVersion: 'fixture-v1',
    sourceRef: 'runtime/neuro-kurisu/tests/big-pass-126-memory-retrieval-benchmark.mjs',
    labelingProtocol: 'Explicit hand-authored synthetic test labels; not production evidence.',
    licenseId: 'LicenseRef-NK1-Synthetic-Fixture',
    contentSha256: fingerprintMemoryRetrievalDataset(examples),
  },
};
const before = memory.snapshot();
const report = runMemoryOS2RetrievalBenchmark(before, examples, options);
const after = memory.snapshot();
assert.equal(report.schemaVersion, 6);
assert.equal(report.benchmark, 'memoryos2-retrieval-vs-bm25-baseline');
assert.equal(report.retrievalAlgorithmVersion, 'memoryos2-hybrid-v5-bilingual-concept-recall');
assert.equal(report.baselineConfigurationFingerprint.length, 64);
assert.equal(report.mode, 'offline-clone; no-live-state-mutation');
assert.equal(report.trainQueries, 4);
assert.equal(report.holdoutQueries, 8);
assert.equal(report.datasetIntegrity.validForPromotion, true);
assert.equal(report.datasetIntegrity.uniqueHoldoutQueries, 8);
assert.equal(report.datasetIntegrity.crossSplitQueryLeakageCount, 0);
assert.equal(report.datasetIntegrity.unknownRelevantMemoryIdCount, 0);
assert.equal(report.datasetIntegrity.provenanceComplete, true);
assert.equal(report.guardrails.liveMemoryMutated, false);
assert.equal(report.guardrails.holdoutUsedForTraining, false);
assert.equal(report.guardrails.splitLeakageBlocksPromotion, true);
assert.equal(report.promotion.requiresIndependentHumanOrCIReview, true);
assert.equal(report.promotion.gates.mrrConfidenceNonInferioritySupported, report.confidence.mrr01.lowerBound01 >= -.01);
assert.equal(report.promotion.gates.mrrPointEstimateNonInferior, report.deltas.mrr01 >= -.01);
assert.equal(report.baselineConfiguration.name, 'Okapi BM25', 'baseline must use corpus-scoped BM25 rather than binary token overlap');
assert.equal(report.baselineConfiguration.k1, 1.2);
assert.equal(report.baselineConfiguration.b, .75);
assert.equal(report.baselineConfiguration.documentCount, 16, 'expired/quarantined rows must not enter the current BM25 baseline');
assert.equal(report.promotion.gates.mrrConfidenceNonInferioritySupported, report.confidence.mrr01.lowerBound01 >= -.01);
assert.equal(report.promotion.allowed, false, 'small synthetic corpus is not sufficient for candidate promotion');
assert.equal(report.metrics.candidate.recallAtK01, 1, 'single-digit status/latency values must distinguish the labelled synthetic memories');
assert.equal(report.deltas.recallAtK01 >= 0, true, 'candidate retrieval must not lose the numeric-disambiguation cases to BM25');
assert.equal(report.guardrails.mrrRegressionMustBeConfidenceBounded, true);
assert.equal(report.promotion.status === 'candidate-eligible-for-separate-review', report.promotion.allowed);
assert.deepEqual(after, before, 'benchmark must not mutate the live MemoryOS2 snapshot');
assert.equal(report.metrics.candidate.quarantinedResultCount, 0);
assert.equal(report.metrics.candidate.staleResultCount, 0);
assert.equal(report.datasetFingerprint.length, 64);
assert.equal(report.corpusFingerprint.length, 64);
assert.equal(report.retrievalConfigurationFingerprint.length, 64);
assert.equal(report.corpusIntegrity.validForPromotion, true);
assert.equal(report.corpusIntegrity.duplicateIdCount, 0);
assert.equal(report.corpusIntegrity.malformedRows, 0);
assert.equal(report.confidence.recallAtK01.samples, 400);
assert.ok(report.confidence.recallAtK01.lowerBound01 <= report.confidence.recallAtK01.upperBound01);
assert.ok(report.metrics.candidate.latencyP95Ms >= 0);

// Fingerprints and paired confidence intervals must not depend on input row order.
const reordered = runMemoryOS2RetrievalBenchmark(before, [...examples].reverse(), options);
assert.equal(reordered.datasetFingerprint, report.datasetFingerprint);
assert.equal(reordered.corpusFingerprint, report.corpusFingerprint);
assert.deepEqual(reordered.confidence, report.confidence);
assert.deepEqual(reordered.deltas, report.deltas);
const reorderedCorpusInput = structuredClone(before);
reorderedCorpusInput.items.reverse();
const reorderedCorpusReport = runMemoryOS2RetrievalBenchmark(reorderedCorpusInput, examples, options);
assert.equal(reorderedCorpusReport.corpusFingerprint, report.corpusFingerprint, 'corpus fingerprint must ignore top-level row ordering');
assert.equal(reorderedCorpusReport.retrievalConfigurationFingerprint, report.retrievalConfigurationFingerprint);
assert.deepEqual(reorderedCorpusReport.deltas, report.deltas, 'retrieval quality must not depend on corpus row ordering');
const changedScoringMetadata = structuredClone(before);
changedScoringMetadata.items[0].salience = Math.min(1, changedScoringMetadata.items[0].salience + .17);
const metadataChangedReport = runMemoryOS2RetrievalBenchmark(changedScoringMetadata, examples, options);
assert.notEqual(metadataChangedReport.corpusFingerprint, report.corpusFingerprint, 'fingerprint must include ranking-relevant memory metadata');
const changedPolicy = structuredClone(before);
if (!changedPolicy.adaptiveMemoryPolicy) changedPolicy.adaptiveMemoryPolicy = { version: 2, weights: { semantic: .5, hybrid: .5, causal: .5, temporal: .5, balanced: .5 }, trials: { semantic: 0, hybrid: 0, causal: 0, temporal: 0, balanced: 0 }, reward: { semantic: 0, hybrid: 0, causal: 0, temporal: 0, balanced: 0 }, contextValue: {}, contextTrials: {}, cooldownUntil: 0, lastPolicy: 'balanced', lastContextKey: 'default' };
changedPolicy.adaptiveMemoryPolicy.weights.hybrid = .91;
const policyChangedReport = runMemoryOS2RetrievalBenchmark(changedPolicy, examples, options);
assert.equal(policyChangedReport.corpusFingerprint, report.corpusFingerprint);
assert.notEqual(policyChangedReport.retrievalConfigurationFingerprint, report.retrievalConfigurationFingerprint, 'ranking-policy state must have a separate reproducibility fingerprint');
const changedSemanticVector = structuredClone(before);
changedSemanticVector.items[0].semanticVector = [...(changedSemanticVector.items[0].semanticVector ?? []), .123];
const vectorChangedReport = runMemoryOS2RetrievalBenchmark(changedSemanticVector, examples, options);
assert.notEqual(vectorChangedReport.corpusFingerprint, report.corpusFingerprint, 'fingerprint must include semantic vector changes');

// Ambiguous corpus IDs block eligibility, even if the dataset labels happen to resolve.
const duplicateCorpus = structuredClone(before);
duplicateCorpus.items.push(structuredClone(duplicateCorpus.items[0]));
const duplicateCorpusReport = runMemoryOS2RetrievalBenchmark(duplicateCorpus, examples, options);
assert.equal(duplicateCorpusReport.corpusIntegrity.duplicateIdCount, 1);
assert.equal(duplicateCorpusReport.promotion.allowed, false);
assert.equal(duplicateCorpusReport.promotion.reason, 'corpus-integrity-failed');

// The default API-safe ceiling remains 64, while the offline runner may pass a larger bounded set.
const expandedExamples = Array.from({ length: 65 }, (_, index) => ({ id: `expanded-${index}`, query: `distinct calibration query ${index}`, relevantIds: [`m${index % 16}`], split: index < 4 ? 'train' : 'holdout' }));
const boundedReport = runMemoryOS2RetrievalBenchmark(before, expandedExamples, options);
assert.equal(boundedReport.datasetIntegrity.truncatedExamples, 1);
assert.equal(boundedReport.promotion.allowed, false);
const expandedReport = runMemoryOS2RetrievalBenchmark(before, expandedExamples, { ...options, maxExamples: 128 });
assert.equal(expandedReport.datasetIntegrity.truncatedExamples, 0);
assert.equal(expandedReport.holdoutQueries, 61);

// A normalized query present on both sides of the split is leakage and blocks eligibility.
const leaked = [...examples, { id: 'holdout-leak', query: examples[0].query.toUpperCase(), relevantIds: ['m0'], split: 'holdout' }];
const leakReport = runMemoryOS2RetrievalBenchmark(before, leaked, options);
assert.equal(leakReport.datasetIntegrity.crossSplitQueryLeakageCount, 1);
assert.equal(leakReport.datasetIntegrity.validForPromotion, false);
assert.equal(leakReport.promotion.allowed, false);
assert.equal(leakReport.promotion.reason, 'dataset-integrity-failed');

// Near-identical queries across splits are also leakage, even when one has a trivial
// trailing edit and therefore a different exact normalized fingerprint.
const nearDuplicateLeak = [
  { id: 'near-train', query: 'what is the current latency for project elm telemetry route', relevantIds: ['m0'], split: 'train' },
  { id: 'near-holdout', query: 'what is the current latency for project elm telemetry route now', relevantIds: ['m1'], split: 'holdout' },
  ...examples.filter(row => row.id !== 'train-0' && row.id !== 'holdout-0'),
];
const nearDuplicateLeakReport = runMemoryOS2RetrievalBenchmark(before, nearDuplicateLeak, options);
assert.equal(nearDuplicateLeakReport.datasetIntegrity.crossSplitQueryLeakageCount, 0, 'near-duplicate guard tests a separate condition from exact normalized duplicates');
assert.equal(nearDuplicateLeakReport.datasetIntegrity.nearDuplicateCrossSplitPairCount, 1);
assert.equal(nearDuplicateLeakReport.datasetIntegrity.validForPromotion, false);
assert.equal(nearDuplicateLeakReport.promotion.reason, 'dataset-integrity-failed');

// Unknown ground-truth IDs and absent provenance cannot be treated as valid evidence.
const unknownLabel = examples.map(row => row.id === 'holdout-0' ? { ...row, relevantIds: ['memory-that-does-not-exist'] } : row);
const unknownReport = runMemoryOS2RetrievalBenchmark(before, unknownLabel, options);
assert.equal(unknownReport.datasetIntegrity.unknownRelevantMemoryIdCount, 1);
assert.equal(unknownReport.promotion.allowed, false);
assert.equal(unknownReport.promotion.reason, 'dataset-integrity-failed');
const invalidSeed = runMemoryOS2RetrievalBenchmark(before, examples, { ...options, seed: -1 });
assert.equal(invalidSeed.experimentConfiguration.seedInputValid, false);
assert.equal(invalidSeed.promotion.allowed, false);
assert.equal(invalidSeed.promotion.reason, 'invalid-bootstrap-seed');
assert.equal(invalidSeed.guardrails.invalidSeedMayPromote, false);
const missingProvenance = runMemoryOS2RetrievalBenchmark(before, examples, { now, k: 5 });
assert.equal(missingProvenance.promotion.allowed, false);
assert.equal(missingProvenance.promotion.reason, 'dataset-provenance-incomplete');

const insufficientExamples = examples.slice(0, 3);
const insufficient = runMemoryOS2RetrievalBenchmark(before, insufficientExamples, {
  ...options,
  datasetProvenance: { ...options.datasetProvenance, contentSha256: fingerprintMemoryRetrievalDataset(insufficientExamples) },
});
assert.equal(insufficient.promotion.allowed, false);
assert.equal(insufficient.promotion.reason, 'insufficient-labelled-holdout-or-corpus');
console.log('BIG_PASS_126_MEMORY_RETRIEVAL_BENCHMARK=PASS', JSON.stringify({ corpus: report.corpusSize, train: report.trainQueries, holdout: report.holdoutQueries, recallDelta: report.deltas.recallAtK01, ci: report.confidence.recallAtK01, promotion: report.promotion.status, reason: report.promotion.reason, injectedExactLeakageProbeCount: leakReport.datasetIntegrity.crossSplitQueryLeakageCount, injectedNearDuplicateLeakageProbeCount: nearDuplicateLeakReport.datasetIntegrity.nearDuplicateCrossSplitPairCount }));
