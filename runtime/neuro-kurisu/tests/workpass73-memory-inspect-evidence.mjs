import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { fingerprintMemoryRetrievalDataset, hmacSha256Hex } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';
import { runMemoryOS2RetrievalExperiment } from '../src/organism/memory/MemoryRetrievalExperiment.ts';

assert.equal(hmacSha256Hex('Jefe', 'what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58aeead7a2e', 'HMAC-SHA256 must match RFC 2202 test vector');

const now = 2_000_000_000_000;
const memory = new MemoryOS2();
const examples = [];
const expectedRawQueries = [];
const expectedRawIds = [];

function addMemory(id, content) {
  expectedRawIds.push(id);
  memory.encode({
    id,
    content,
    kind: 'semantic',
    source: 'workpass73-synthetic-ci-fixture',
    tags: ['workpass73'],
    context: { area: 'memory-inspect-integration-test' },
    salience: .7,
    emotionalWeight: .1,
    identityRelevance: .2,
    goalRelevance: .3,
    socialRelevance: .1,
    predictionError: .05,
    confidence: .95,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
    validFromAt: now - 60_000,
    observedAt: now - 1_000,
    provenanceClass: 'external',
    sourceAuthority01: .9,
  });
}

const answerableCount = 20;
const unanswerableCount = 8;
for (const language of ['en', 'ru']) {
  for (let index = 0; index < 4; index++) {
    const id = 'memory-' + language + '-train-' + index;
    const query = language === 'en'
      ? 'training concept ' + index + ' silver comet atlas'
      : 'обучающий концепт ' + index + ' серебряная комета атлас';
    addMemory(id, query + ' stored context for training label ' + index);
    examples.push({ id:'example-' + language + '-train-' + index, query, relevantIds:[id], split:'train', language });
    expectedRawQueries.push(query);
  }

  for (let index = 0; index < answerableCount; index++) {
    const id = 'memory-' + language + '-answerable-' + index;
    const query = language === 'en'
      ? 'holdout concept ' + index + ' amber telescope orchard'
      : 'контрольный концепт ' + index + ' янтарный телескоп сад';
    addMemory(id, query + ' immutable labelled fact ' + index);
    examples.push({ id:'example-' + language + '-answerable-' + index, query, relevantIds:[id], split:'holdout', language });
    expectedRawQueries.push(query);
  }

  for (let index = 0; index < unanswerableCount; index++) {
    const query = language === 'en'
      ? 'unanswerable query ' + index + ' lunar velvet gearbox'
      : 'безответный запрос ' + index + ' лунный бархатный редуктор';
    examples.push({
      id:'example-' + language + '-unanswerable-' + index,
      query,
      relevantIds:[],
      split:'holdout',
      answerable:false,
      language,
    });
    expectedRawQueries.push(query);
  }
}

const snapshot = memory.snapshot();
const before = structuredClone(snapshot);
const provenance = {
  datasetId: 'workpass73-memory-inspect-ci',
  datasetVersion: 'synthetic-1',
  sourceRef: 'synthetic://workpass73-ci-fixture',
  labelingProtocol: 'Synthetic contract fixture only; not independent human labels.',
  licenseId: 'LicenseRef-NK1-CI-Fixture',
  contentSha256: fingerprintMemoryRetrievalDataset(examples),
};
const experiment = runMemoryOS2RetrievalExperiment(snapshot, examples, {
  now,
  k: 5,
  seeds: [13, 29, 53, 71, 101],
  bootstrapSamples: 200,
  maxExamples: 512,
  minHoldoutQueries: 40,
  minUnanswerableHoldoutQueries: 16,
  minLanguageTrainQueries: 4,
  minLanguageAnswerableHoldoutQueries: 20,
  minLanguageUnanswerableHoldoutQueries: 8,
  datasetProvenance: provenance,
  includeQueryEvidence: true,
});

assert.equal(experiment.mode, 'offline-clone; no-live-state-mutation; no-automatic-promotion');
assert.equal(experiment.queryEvidence?.schemaVersion, 1);
assert.equal(experiment.queryEvidence?.digestAlgorithm, 'hmac-sha256-ephemeral-per-experiment');
assert.equal(experiment.queryEvidence?.train.length, 8);
assert.equal(experiment.queryEvidence?.holdout.length, 56);
assert.equal(experiment.queryEvidence?.corpusMemoryIdDigests.length, snapshot.items.length);
assert.equal(experiment.queryEvidence?.datasetFingerprint, experiment.datasetFingerprint);
assert.equal(experiment.queryEvidence?.corpusFingerprint, experiment.corpusFingerprint);
assert.match(experiment.queryEvidence?.retrievalConfigurationFingerprint ?? '', /^[a-f0-9]{64}$/);
assert.match(experiment.queryEvidence?.baselineConfigurationFingerprint ?? '', /^[a-f0-9]{64}$/);
assert.equal(experiment.determinism.retrievalQualityMetricsStableAcrossSeeds, true,
  'paired seed replay must keep the same HMAC pseudonyms and ranked trace');
assert.equal(experiment.promotion.allowed, false, 'CI sourceRef is explicitly synthetic and cannot prove memory uplift');
assert.equal(experiment.promotion.candidateAutomaticallyPromoted, false);
assert.deepEqual(snapshot, before, 'the benchmark must not mutate the supplied MemoryOS2 snapshot');

const serialized = JSON.stringify(experiment.queryEvidence);
for (const raw of [...expectedRawQueries, ...expectedRawIds, 'stored context for training label', 'immutable labelled fact']) {
  assert.equal(serialized.includes(raw), false, 'raw memory/query content leaked into Inspect evidence: ' + raw);
}
for (const row of experiment.queryEvidence.holdout) {
  assert.match(row.queryDigest, /^[a-f0-9]{64}$/);
  assert.match(row.exampleIdDigest, /^[a-f0-9]{64}$/);
  assert.ok(row.baselineRankedMemory.length <= 5);
  assert.ok(row.candidateRankedMemory.length <= 5);
  for (const item of [...row.baselineRankedMemory, ...row.candidateRankedMemory]) {
    assert.match(item.memoryIdDigest, /^[a-f0-9]{64}$/);
    assert.equal(typeof item.stale, 'boolean');
    assert.equal(typeof item.quarantined, 'boolean');
  }
}

const output = process.argv[2] || '/tmp/nk1-workpass73-memory-report.json';
writeFileSync(output, JSON.stringify(experiment, null, 2) + '\n', 'utf8');
console.log('WORKPASS73_MEMORY_INSPECT_EVIDENCE=PASS train=' + experiment.queryEvidence.train.length
  + ' holdout=' + experiment.queryEvidence.holdout.length
  + ' seeds=' + experiment.seedCount + ' rawPayloads=0');
