import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { runMemoryOS2RetrievalExperiment } from '../src/organism/memory/MemoryRetrievalExperiment.ts';
import { runMemoryOS2RetrievalBenchmark } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const now = 2_000_000_000_000;
const memory = new MemoryOS2();
for (let i = 0; i < 16; i++) memory.encode({
  id: `m${i}`, content: `project fern event memory document ${i} routing status ${i % 4}`,
  kind: 'semantic', source: 'experiment-fixture', tags: ['benchmark'], context: { area: 'test' },
  salience: .6, emotionalWeight: .2, identityRelevance: .2, goalRelevance: .2, socialRelevance: .1,
  predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
  validFromAt: now - 10000, observedAt: now - 1000, provenanceClass: 'external', sourceAuthority01: .9,
});
const snapshot = memory.snapshot();
const examples = [];
for (let i = 0; i < 4; i++) examples.push({ id: `train-${i}`, query: `training query fern status ${i}`, relevantIds: [`m${i}`], split: 'train' });
for (let i = 0; i < 8; i++) examples.push({ id: `holdout-${i}`, query: `heldout query fern routing ${i}`, relevantIds: [`m${i}`], split: 'holdout' });
examples.push({ id: 'holdout-unanswerable-0', query: 'a deliberately absent memory fact', relevantIds: [], split: 'holdout', answerable: false });
const provenance = { datasetId: 'controlled-fixture', datasetVersion: '1.0', sourceRef: 'test-fixture-only', labelingProtocol: 'Hand-authored test labels; not production evidence.' };
const options = { now, k: 5, bootstrapSamples: 200, maxExamples: 512, datasetProvenance: provenance, seeds: [13, 29, 53] };
const before = structuredClone(snapshot);
const experiment = runMemoryOS2RetrievalExperiment(snapshot, examples, options);
assert.equal(experiment.schemaVersion, 1);
assert.equal(experiment.seedCount, 3);
assert.equal(experiment.holdoutQueries, 9, 'explicitly unanswerable holdout queries must survive the CLI/benchmark contract');
assert.equal(experiment.seeds.join(','), '13,29,53');
assert.equal(experiment.corpusFingerprint.length, 64);
assert.equal(experiment.retrievalConfigurationFingerprint.length, 64);
assert.equal(experiment.datasetFingerprint.length, 64);
assert.equal(experiment.determinism.retrievalQualityMetricsStableAcrossSeeds, true);
assert.equal(new Set(experiment.runs.map(row => row.candidateHoldout.unsupportedRetrievalRate01)).size, 1, 'abstention quality must be included in retrieval-metric determinism checks');
assert.equal(new Set(experiment.runs.map(row => row.candidateHoldout.correctAbstentionRate01)).size, 1, 'correct-abstention rate must remain seed invariant');
assert.equal(experiment.determinism.datasetCorpusAndRetrievalConfigurationFingerprintsStableAcrossSeeds, true);
assert.equal(experiment.sensitivity.mrrNonInferioritySupportedAcrossAllSeeds, experiment.runs.every(row => row.mrrConfidenceNonInferioritySupported));
assert.equal(experiment.runs.every(row => Array.isArray(row.failedPromotionGates)), true);
assert.equal(experiment.promotion.allowed, false, 'multi-seed experiment must never auto-promote');
assert.equal(experiment.promotion.candidateAutomaticallyPromoted, false);
assert.deepEqual(snapshot, before, 'experiment must not mutate supplied snapshot');
assert.equal(experiment.runs.length, 3);
assert.equal(new Set(experiment.runs.map(row => row.recallDelta01)).size, 1, 'retrieval point estimate should be seed invariant');
assert.throws(() => runMemoryOS2RetrievalExperiment(snapshot, examples, { ...options, seeds: [1, 1, 2] }), /at-least-3-distinct-bootstrap-seeds/);
assert.throws(() => runMemoryOS2RetrievalExperiment(snapshot, examples, { ...options, seeds: [13, -1, 29, 53] }), /experiment-seeds-must-be-positive-uint32-values/, 'invalid supplied seeds must not be silently filtered out');
assert.throws(() => runMemoryOS2RetrievalExperiment(snapshot, examples, { ...options, seeds: [13, 13, 29, 53] }), /experiment-bootstrap-seeds-must-be-distinct/, 'duplicate seeds must not be silently collapsed when enough unique seeds remain');
assert.throws(() => runMemoryOS2RetrievalExperiment(snapshot, examples, { ...options, seeds: Array.from({ length: 10 }, (_, i) => i + 1) }), /experiment-supports-at-most-9-bootstrap-seeds/, 'seed lists beyond the supported limit must not be silently truncated');

// Corpus-cap parity regression: the baseline indexes only the first 1600 rows.
// The candidate must use that exact same bounded snapshot, not retrieve from row 1601.
const overflowSnapshot = structuredClone(snapshot);
const overflowBase = structuredClone(overflowSnapshot.items[0]);
overflowSnapshot.items = [
  ...overflowSnapshot.items,
  ...Array.from({ length: 1584 }, (_, i) => ({ ...structuredClone(overflowBase), id: `overflow-filler-${i}` })),
  { ...structuredClone(overflowBase), id: 'overflow-target', content: 'outofboundneedle unique target', epistemicStatus: 'fact', dormant: false, validFromAt: now - 1000, validUntilAt: undefined },
];
assert.equal(overflowSnapshot.items.length, 1601);
const overflowReport = runMemoryOS2RetrievalBenchmark(overflowSnapshot, [
  { id: 'overflow-holdout', query: 'outofboundneedle', relevantIds: ['overflow-target'], split: 'holdout' },
], { now, k: 5, bootstrapSamples: 200, maxExamples: 64 });
assert.equal(overflowReport.corpusIntegrity.truncatedItems, 1);
assert.equal(overflowReport.corpusIntegrity.validForPromotion, false);
assert.equal(overflowReport.metrics.baseline.recallAtK01, 0);
assert.equal(overflowReport.metrics.candidate.recallAtK01, 0, 'candidate must not see memory rows omitted from the baseline corpus cap');

// Malformed-row parity regression: candidate restore used to keep a malformed row
// that the baseline explicitly filtered out. With k=1 that row could crowd out a
// labelled relevant result, making the two arms evaluate different corpora.
const malformedSnapshot = structuredClone(snapshot);
const malformedDistractor = {
  ...structuredClone(malformedSnapshot.items[0]),
  id: '',
  content: 'malformedneedle',
  epistemicStatus: 'fact',
  dormant: false,
  validFromAt: now - 1000,
  validUntilAt: null,
};
const validTarget = {
  ...structuredClone(malformedSnapshot.items[0]),
  id: 'valid-target',
  content: 'malformedneedle relevant target',
  epistemicStatus: 'fact',
  dormant: false,
  validFromAt: now - 1000,
  validUntilAt: null,
};
malformedSnapshot.items = [malformedDistractor, validTarget, ...malformedSnapshot.items.slice(1)];
const malformedReport = runMemoryOS2RetrievalBenchmark(malformedSnapshot, [
  { id: 'malformed-row-holdout', query: 'malformedneedle', relevantIds: ['valid-target'], split: 'holdout' },
], { now, k: 1, bootstrapSamples: 200, maxExamples: 64 });
assert.equal(malformedReport.corpusIntegrity.malformedRows, 1);
assert.equal(malformedReport.corpusIntegrity.validForPromotion, false);
assert.equal(malformedReport.metrics.baseline.recallAtK01, 1);
assert.equal(malformedReport.metrics.candidate.recallAtK01, 1, 'candidate and baseline must filter to the same valid corpus even when promotion is blocked');



// Duplicate corpus IDs must be surfaced as an integrity issue without inflating precision.
const duplicateSnapshot = structuredClone(snapshot);
duplicateSnapshot.items = [...duplicateSnapshot.items, structuredClone(duplicateSnapshot.items[0])];
const duplicateReport = runMemoryOS2RetrievalBenchmark(duplicateSnapshot, [
  { id: 'duplicate-id-holdout', query: 'project fern event memory document routing status', relevantIds: ['m0'], split: 'holdout' },
], { now, k: 5, bootstrapSamples: 200, maxExamples: 64 });
assert.equal(duplicateReport.corpusIntegrity.duplicateIdCount, 1);
assert.equal(duplicateReport.corpusIntegrity.validForPromotion, false);
assert.equal(duplicateReport.metrics.baseline.precisionAtK01, 0.2, 'duplicate rows for one relevant memory ID must count as one relevant result for precision');

// High-fanout query: selection must remain stable when identical memory rows are reordered.
const largeMemory = new MemoryOS2();
for (let i = 0; i < 260; i++) largeMemory.encode({
  id: `large-${String(i).padStart(3, '0')}`,
  content: `sharedproject common status category-${i % 5} ${i % 11 === 0 ? 'needle-special rare-query' : 'other-observation'} ordinal ${i}`,
  kind: 'semantic', source: 'candidate-order-regression', tags: [], context: {},
  salience: .6, emotionalWeight: .1, identityRelevance: .2, goalRelevance: .2, socialRelevance: .1,
  predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
  validFromAt: now - 10000, observedAt: now - 1000, provenanceClass: 'external', sourceAuthority01: .9,
});
const largeSnapshot = largeMemory.snapshot();
const orderedA = new MemoryOS2(); orderedA.restore(structuredClone(largeSnapshot));
const orderedB = new MemoryOS2(); orderedB.restore({ ...structuredClone(largeSnapshot), items: [...largeSnapshot.items].reverse() });
const rankedA = orderedA.retrieve('sharedproject needle-special', 12, 0, 0, { temporalMode: 'current', asOfAt: now }).map(row => row.id);
const rankedB = orderedB.retrieve('sharedproject needle-special', 12, 0, 0, { temporalMode: 'current', asOfAt: now }).map(row => row.id);
assert.deepEqual(rankedA, rankedB, 'candidate and top-k ranking must be stable under snapshot row permutation above the 192-candidate cap');
assert.equal(orderedA.retrievalDiagnostics().candidateSelection, 'idf-coverage-fuzzy-concept-rrf-stable-id');
assert.equal(orderedB.retrievalDiagnostics().candidateSelectionLimit, 192);

// Exercise the real CLI path using external snapshot, labelled JSONL and provenance files.
const temp = await mkdtemp(path.join(os.tmpdir(), 'nk-memory-experiment-'));
try {
  const snapshotPath = path.join(temp, 'snapshot.json');
  const labelsPath = path.join(temp, 'labels.jsonl');
  const provenancePath = path.join(temp, 'provenance.json');
  const reportPath = path.join(temp, 'report.json');
  await writeFile(snapshotPath, JSON.stringify(snapshot));
  const labelsSource = `${examples.map(row => JSON.stringify(row)).join('\n')}\n`;
  await writeFile(labelsPath, labelsSource);
  const rawSourceSha256 = createHash('sha256').update(Buffer.from(labelsSource, 'utf8')).digest('hex');
  await writeFile(provenancePath, JSON.stringify({ ...provenance, rawSourceSha256 }));
  const cli = spawnSync(process.execPath, ['--experimental-strip-types', path.join(root, 'scripts/run-memory-retrieval-experiment.mjs'), '--snapshot', snapshotPath, '--labels', labelsPath, '--provenance', provenancePath, '--out', reportPath, '--seeds', '13,29,53', '--k', '5', '--now', String(now)], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(cli.status, 0, `CLI failed: ${cli.stderr}\n${cli.stdout}`);
  const emitted = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.equal(emitted.seedCount, 3);
  assert.equal(emitted.input.labelRowsParsed, examples.length);
  assert.equal(emitted.input.rawLabelsSha256, rawSourceSha256);
  assert.equal(emitted.input.rawSourceSha256Verified, true, 'the supplied source-file hash must be checked before benchmarking');
  assert.equal(emitted.runs[0].candidateHoldout.unanswerableQueries, 1, 'CLI must preserve answerable:false labels and allow empty relevantIds only for them');
  assert.equal(emitted.promotion.allowed, false);
  assert.equal(emitted.runs.every(row => Array.isArray(row.failedPromotionGates) && typeof row.mrrConfidenceNonInferioritySupported === 'boolean'), true);
  assert.equal((await readdir(temp)).some(name => name.endsWith('.tmp')), false, 'successful publication must clean temporary output files');
  const badRawProvenancePath = path.join(temp, 'bad-raw-provenance.json');
  const badRawReportPath = path.join(temp, 'bad-raw-report.json');
  await writeFile(badRawProvenancePath, JSON.stringify({ ...provenance, rawSourceSha256: '0'.repeat(64) }));
  const badRawHash = spawnSync(process.execPath, ['--experimental-strip-types', path.join(root, 'scripts/run-memory-retrieval-experiment.mjs'), '--snapshot', snapshotPath, '--labels', labelsPath, '--provenance', badRawProvenancePath, '--out', badRawReportPath, '--seeds', '13,29,53'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(badRawHash.status, 2, 'a dataset whose raw artifact hash does not match provenance must fail closed');
  assert.match(badRawHash.stderr, /provenance-raw-source-sha256-mismatch/);
  assert.equal((await readdir(temp)).includes('bad-raw-report.json'), false, 'mismatched raw-source provenance must not publish a report');
  const overwrite = spawnSync(process.execPath, ['--experimental-strip-types', path.join(root, 'scripts/run-memory-retrieval-experiment.mjs'), '--snapshot', snapshotPath, '--labels', labelsPath, '--provenance', provenancePath, '--out', reportPath, '--seeds', '13,29,53', '--now', String(now)], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(overwrite.status, 2, 'CLI must not silently overwrite a report');
  assert.match(overwrite.stderr, /MEMORY_EXPERIMENT_FAILED/);
  assert.equal((await readdir(temp)).some(name => name.endsWith('.tmp')), false, 'failed exclusive publication must clean temporary output files');
  const badSeed = spawnSync(process.execPath, ['--experimental-strip-types', path.join(root, 'scripts/run-memory-retrieval-experiment.mjs'), '--snapshot', snapshotPath, '--labels', labelsPath, '--provenance', provenancePath, '--out', path.join(temp, 'bad-seed.json'), '--seeds', '13,-1,53'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(badSeed.status, 2);
  assert.match(badSeed.stderr, /seeds-must-be-3-to-9-uint32-values/);
  assert.equal((await readdir(temp)).includes('bad-seed.json'), false, 'invalid CLI seed arguments must fail before publishing a report');
} finally {
  await rm(temp, { recursive: true, force: true });
}
console.log('MEMORY_RETRIEVAL_EXPERIMENT=PASS', JSON.stringify({ seeds: experiment.seeds, corpusSize: experiment.corpusSize, train: experiment.trainQueries, holdout: experiment.holdoutQueries, deterministic: experiment.determinism.retrievalQualityMetricsStableAcrossSeeds, promotion: experiment.promotion.status }));
