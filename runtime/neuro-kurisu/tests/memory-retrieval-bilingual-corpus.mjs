import assert from 'node:assert/strict';
import { runMemoryOS2RetrievalBenchmark } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';
import { benchmarkOptions, buildBilingualCorpus } from './fixtures/memory-retrieval-bilingual-corpus.mjs';

// The instrument's language contract is the part no single-language fixture ever exercised:
// per-language minimums for train rows, answerable holdout rows, unanswerable holdout rows and
// independence groups. A corpus that quietly speaks one language cannot claim a bilingual result.
const { memory, examples, provenance } = buildBilingualCorpus();
const snapshot = memory.snapshot();
const report = runMemoryOS2RetrievalBenchmark(snapshot, examples, { ...benchmarkOptions(), datasetProvenance: provenance });

assert.equal(report.mode, 'offline-clone; no-live-state-mutation');
assert.equal(report.guardrails.liveMemoryMutated, false, 'the benchmark must not touch live state');
assert.equal(report.datasetIntegrity.validForPromotion, true, 'a curated fixture with complete labels and provenance must pass the dataset gate');
assert.equal(report.datasetIntegrity.crossSplitQueryLeakageCount, 0, 'train and holdout queries must not repeat');
assert.equal(report.datasetIntegrity.nearDuplicateCrossSplitPairCount, 0, 'train and holdout queries must not be near-duplicates');
assert.equal(report.datasetIntegrity.independenceGroupSplitLeakageCount, 0, 'one source group must not straddle train and holdout');
assert.equal(report.datasetIntegrity.unknownRelevantMemoryIdCount, 0, 'every label must resolve to a record in the corpus');
assert.equal(report.datasetIntegrity.languageAnnotationComplete, true);
assert.equal(report.corpusIntegrity.validForPromotion, true, 'the corpus must be free of duplicate ids and malformed rows');

assert.equal(report.trainQueries, 8);
assert.equal(report.holdoutQueries, 20);
for (const language of ['ru', 'en']) {
    const slice = report.languageStratification.slices[language];
    assert.ok(slice, `${language} slice must be reported`);
    assert.equal(slice.trainQueries, 4, `${language} must carry its own train rows`);
    assert.equal(slice.answerableHoldoutQueries, 8, `${language} must carry 8 answerable holdout rows`);
    assert.equal(slice.unanswerableHoldoutQueries, 2, `${language} must carry 2 unanswerable holdout rows`);
    assert.equal(slice.independentAnswerableHoldoutGroups, 8, `${language} holdout rows must be independent groups`);
    assert.equal(slice.gates.sufficientTrainQueries, true);
    assert.equal(slice.gates.sufficientAnswerableHoldoutQueries, true);
    assert.equal(slice.gates.sufficientUnanswerableHoldoutQueries, true);
    assert.equal(slice.gates.sufficientIndependentAnswerableHoldoutGroups, true);
    assert.equal(slice.gates.sufficientIndependentUnanswerableHoldoutGroups, true);
    assert.equal(slice.metrics.candidate.quarantinedResultCount, 0);
    assert.equal(slice.metrics.candidate.staleResultCount, 0);
    assert.equal(slice.metrics.candidate.dormantResultCount, 0);
    assert.equal(slice.metrics.candidate.futureResultCount, 0);
}
assert.equal(report.languageStratification.gates.bothRequiredLanguagesPresent, true);
assert.equal(report.languageStratification.gates.sufficientTrainQueriesPerLanguage, true);
assert.equal(report.languageStratification.gates.sufficientAnswerableHoldoutPerLanguage, true);
assert.equal(report.languageStratification.gates.sufficientUnanswerableHoldoutPerLanguage, true);
assert.equal(report.languageStratification.gates.sufficientIndependentAnswerableHoldoutGroupsPerLanguage, true);
assert.equal(report.languageStratification.gates.sufficientIndependentUnanswerableHoldoutGroupsPerLanguage, true);

console.log(`MEMORY_RETRIEVAL_BILINGUAL_CORPUS=PASS ${JSON.stringify({
    // Only the dataset fingerprint is printed: the corpus fingerprint hashes the live memory
    // snapshot, whose internal decay clocks move, so it differs run to run by construction.
    datasetFingerprint: report.datasetFingerprint.slice(0, 12),
    candidate: {
        recallAtK01: report.metrics.candidate.recallAtK01,
        mrr01: Number(report.metrics.candidate.mrr01.toFixed(4)),
        correctAbstentionRate01: Number(report.metrics.candidate.correctAbstentionRate01.toFixed(4)),
        unsupportedRetrievalRate01: Number(report.metrics.candidate.unsupportedRetrievalRate01.toFixed(4)),
    },
    baseline: {
        recallAtK01: report.metrics.baseline.recallAtK01,
        mrr01: Number(report.metrics.baseline.mrr01.toFixed(4)),
    },
    deltas: report.deltas,
    languages: Object.fromEntries(['ru', 'en'].map((language) => [language, {
        candidateRecallAtK01: report.languageStratification.slices[language].metrics.candidate.recallAtK01,
        candidateMrr01: Number(report.languageStratification.slices[language].metrics.candidate.mrr01.toFixed(4)),
        sliceEligible: report.languageStratification.slices[language].eligible,
    }])),
    promotionAllowed: report.promotion.allowed,
    promotionStatus: report.promotion.status,
})}`);
