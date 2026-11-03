import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { runMemoryOS2RetrievalBenchmark } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

// Synthetic contract test for the bilingual concept bridge. It is NOT independent
// evidence: it exists to stop the cross-lingual grounding path from silently
// regressing to the zero-recall behaviour it replaced. The baseline (Okapi BM25)
// shares no tokens across languages, so any recall here comes from the concept
// bridge and the answerability gate that must accept it.
const now = 2_000_000_000_000;
const encode = (memory, id, content) => memory.encode({
  id, content, kind: 'semantic', source: 'cross-lingual-bridge-fixture', tags: ['contract-test'],
  context: { area: 'test' }, salience: .6, emotionalWeight: .2, identityRelevance: .2,
  goalRelevance: .2, socialRelevance: .1, predictionError: .1, confidence: .9,
  epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [],
  contradictionLinks: [], validFromAt: now - 10_000, observedAt: now - 1_000,
  provenanceClass: 'external', sourceAuthority01: .9,
});
const provenance = {
  datasetId: 'cross-lingual-bridge-contract', datasetVersion: '1',
  sourceRef: 'synthetic-contract-fixture', labelingProtocol: 'hand-authored contract labels',
  licenseId: 'LicenseRef-NK1-TestFixture',
};

// A Russian memory corpus queried in English.
const russian = new MemoryOS2();
encode(russian, 'ru-interest', 'пользователь интересуется квантовой физикой и любит долгие обсуждения');
encode(russian, 'ru-goal', 'незавершенная цель: закончить анализ памяти до конца недели');
encode(russian, 'ru-emotion', 'я чувствую раздражение когда задача повторяется без прогресса');
encode(russian, 'ru-skill', 'навык калибровки уверенности улучшился за последнюю практику');
encode(russian, 'ru-noise', 'резервный генератор запускается при потере питания в подвале');
const russianSnapshot = russian.snapshot();

const enToRu = [
  { id: 't0', split: 'train', query: 'what is the user interested in', relevantIds: ['ru-interest'] },
  { id: 't1', split: 'train', query: 'what is my unfinished goal', relevantIds: ['ru-goal'] },
  { id: 'h0', split: 'holdout', query: 'what makes me feel frustrated', relevantIds: ['ru-emotion'] },
  { id: 'h1', split: 'holdout', query: 'has my confidence calibration skill improved', relevantIds: ['ru-skill'] },
];
const enReport = runMemoryOS2RetrievalBenchmark(russianSnapshot, enToRu, {
  now, k: 5, bootstrapSamples: 200, maxExamples: 512, datasetProvenance: provenance,
});
assert.equal(enReport.metrics.baseline.recallAtK01, 0, 'BM25 baseline shares no tokens across languages');
assert.equal(enReport.metrics.candidate.recallAtK01, 1, 'the concept bridge must ground every cross-lingual query');
assert.ok(enReport.deltas.recallAtK01 > 0, 'cross-lingual recallDelta must be positive');
assert.ok(enReport.deltas.mrr01 > 0, 'cross-lingual MRR must not regress');

// The mirror direction: an English memory corpus queried in Russian.
const english = new MemoryOS2();
encode(english, 'en-interest', 'the user is interested in quantum physics and enjoys long discussions');
encode(english, 'en-goal', 'unfinished goal: finish the memory analysis by the end of the week');
encode(english, 'en-emotion', 'i feel irritation when a task repeats without progress');
encode(english, 'en-skill', 'the skill of confidence calibration improved over the last practice');
const englishSnapshot = english.snapshot();
const ruToEn = [
  { id: 't0', split: 'train', query: 'чем интересуется пользователь', relevantIds: ['en-interest'] },
  { id: 't1', split: 'train', query: 'какая незавершенная цель', relevantIds: ['en-goal'] },
  { id: 'h0', split: 'holdout', query: 'что вызывает раздражение', relevantIds: ['en-emotion'] },
  { id: 'h1', split: 'holdout', query: 'улучшился ли навык калибровки', relevantIds: ['en-skill'] },
];
const ruReport = runMemoryOS2RetrievalBenchmark(englishSnapshot, ruToEn, {
  now, k: 5, bootstrapSamples: 200, maxExamples: 512, datasetProvenance: provenance,
});
assert.equal(ruReport.metrics.baseline.recallAtK01, 0, 'BM25 baseline shares no tokens across languages');
assert.equal(ruReport.metrics.candidate.recallAtK01, 1, 'RU->EN cross-lingual recall must be complete');

// The bridge must not become a recall-everything channel. A query whose concept is
// absent from the corpus still abstains rather than returning an unrelated memory.
const absent = russian.retrieve('which avatar gesture conveys embodiment', 8, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.deepEqual(absent, [], 'a concept absent from the corpus must still abstain');
assert.equal(russian.retrievalDiagnostics().abstained, true);

// A focused concept query returns only the memories that express that concept,
// not the whole corpus.
const focused = russian.retrieve('what is my goal', 8, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(focused.length, 1, 'a single-concept query must not pull unrelated memories into the result');
assert.equal(focused[0].id, 'ru-goal');


// The concept posting index must follow the canonical memory lifecycle. A forgotten
// record must not leave a stale posting behind, including when the same ID is reused.
const lifecycle = new MemoryOS2();
encode(lifecycle, 'reused-concept-id', 'пользователь интересуется квантовой физикой');
assert.equal(lifecycle.indexDiagnostics().conceptIndexMismatch, 0,
  'newly indexed concept postings must match the active memory corpus');
assert.equal(lifecycle.forgetById('reused-concept-id', 'concept-index-integrity'), true);
assert.equal(lifecycle.indexDiagnostics().conceptIndexMismatch, 0,
  'forgetting a memory must remove all of its concept postings');
encode(lifecycle, 'reused-concept-id', 'резервный генератор работает при потере питания');
assert.equal(lifecycle.indexDiagnostics().conceptIndexMismatch, 0,
  'reusing a forgotten ID must not retain the previous concept associations');
const lifecycleRestored = new MemoryOS2();
lifecycleRestored.restore(lifecycle.snapshot());
assert.equal(lifecycleRestored.indexDiagnostics().conceptIndexMismatch, 0,
  'snapshot restoration must rebuild concept postings only from live records');
assert.equal(lifecycleRestored.indexDiagnostics().pass, true,
  'all retrieval indexes must remain consistent after forget, reuse and restore');

console.log('MEMORY_RETRIEVAL_CROSS_LINGUAL_BRIDGE=PASS', JSON.stringify({
  enToRuRecallDelta: enReport.deltas.recallAtK01,
  ruToEnRecallDelta: ruReport.deltas.recallAtK01,
  abstentionPreserved: true,
  focusedRecallSize: focused.length,
}));
