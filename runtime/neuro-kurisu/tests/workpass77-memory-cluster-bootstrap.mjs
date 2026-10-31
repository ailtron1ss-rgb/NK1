import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { parseLabels } from '../scripts/run-memory-retrieval-experiment.mjs';
import {
  fingerprintMemoryRetrievalDataset,
  runMemoryOS2RetrievalBenchmark,
} from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

const parserRows = parseLabels(JSON.stringify({
  id: 'parser-row',
  query: 'source clustered memory query',
  relevantIds: ['cluster-memory-0'],
  split: 'holdout',
  independenceGroupId: 'episode-parser',
}));
assert.equal(parserRows[0].independenceGroupId, 'episode-parser',
  'the real experiment CLI parser must preserve source-cluster labels');
assert.throws(() => parseLabels(JSON.stringify({
  id: 'parser-long-group',
  query: 'source clustered memory query',
  relevantIds: ['cluster-memory-0'],
  split: 'holdout',
  independenceGroupId: 'g'.repeat(121),
})), /labels-invalid-independence-group-id-line:1/,
  'overlong source-group IDs must be rejected rather than silently truncated');

const now = 2_000_000_000_000;
const memory = new MemoryOS2();
for (let index = 0; index < 16; index += 1) {
  memory.encode({
    id: 'cluster-memory-' + index,
    content: 'NK1 retrieval cluster concept ' + index + ' shared project context',
    kind: 'semantic',
    source: 'workpass77-cluster-bootstrap-fixture',
    tags: ['cluster-bootstrap'],
    context: { area: 'workpass77' },
    salience: 0.7,
    emotionalWeight: 0.1,
    identityRelevance: 0.2,
    goalRelevance: 0.3,
    socialRelevance: 0.1,
    predictionError: 0.05,
    confidence: 0.95,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
    validFromAt: now - 60_000,
    observedAt: now - 1_000,
    provenanceClass: 'external',
    sourceAuthority01: 0.9,
  });
}
const examples = [];
for (let index = 0; index < 4; index += 1) {
  examples.push({
    id: 'train-' + index,
    query: 'training concept ' + index + ' nk1 memory',
    relevantIds: ['cluster-memory-' + index],
    split: 'train',
    independenceGroupId: 'train-source-' + index,
  });
}
for (let index = 0; index < 8; index += 1) {
  examples.push({
    id: 'holdout-' + index,
    query: 'holdout concept ' + index + ' nk1 memory',
    relevantIds: ['cluster-memory-' + (index + 4)],
    split: 'holdout',
    // Two prompts derived from one source episode are one independent sampling unit.
    independenceGroupId: 'episode-' + Math.floor(index / 2),
  });
}
const provenance = {
  datasetId: 'workpass77-cluster-bootstrap',
  datasetVersion: '1',
  sourceRef: 'test-fixture-only',
  labelingProtocol: 'Deterministic fixture labels; not production evidence.',
  licenseId: 'LicenseRef-NK1-TestFixture',
  contentSha256: fingerprintMemoryRetrievalDataset(examples),
};
const report = runMemoryOS2RetrievalBenchmark(memory.snapshot(), examples, {
  now,
  k: 5,
  bootstrapSamples: 200,
  maxExamples: 512,
  datasetProvenance: provenance,
  includeQueryEvidence: true,
  seed: 29,
});

assert.equal(report.confidence.method, 'paired-cluster-bootstrap-percentile-interval',
  'confidence intervals must resample independent source groups, not correlated query rows');
assert.equal(report.confidence.recallAtK01.clusterCount, 4,
  'eight holdout prompts from four source episodes must count as four independent clusters');
assert.equal(report.confidence.mrr01.clusterCount, 4);
assert.equal(report.confidence.recallAtK01.resamplingUnit, 'independenceGroupId-or-exampleId');
assert.equal(report.datasetIntegrity.independenceGroupCount, 8);
assert.equal(report.datasetIntegrity.independenceGroupSplitLeakageCount, 0);
assert.equal(report.datasetIntegrity.validForPromotion, true,
  'well-formed group labels must not block promotion by themselves');
assert.ok(report.queryEvidence, 'query evidence must be available when explicitly requested');
assert.match(report.queryEvidence.holdout[0].independenceGroupDigest, /^[a-f0-9]{64}$/);
assert.equal(report.queryEvidence.holdout[0].independenceGroupDigest, report.queryEvidence.holdout[1].independenceGroupDigest,
  'two prompts from the same source episode must share one privacy-preserving group digest');
assert.notEqual(report.queryEvidence.holdout[0].independenceGroupDigest, report.queryEvidence.holdout[2].independenceGroupDigest,
  'different source episodes must not collapse into one evidence group');

const changedGroup = structuredClone(examples);
changedGroup[4].independenceGroupId = 'episode-renamed';
assert.notEqual(
  fingerprintMemoryRetrievalDataset(changedGroup),
  fingerprintMemoryRetrievalDataset(examples),
  'dataset fingerprints must bind independence group labels',
);

const leaked = structuredClone(examples);
leaked[0].independenceGroupId = 'cross-split-source';
leaked[4].independenceGroupId = 'cross-split-source';
const leakedFingerprint = fingerprintMemoryRetrievalDataset(leaked);
const leakedReport = runMemoryOS2RetrievalBenchmark(memory.snapshot(), leaked, {
  now,
  k: 5,
  bootstrapSamples: 200,
  maxExamples: 512,
  datasetProvenance: { ...provenance, contentSha256: leakedFingerprint },
  seed: 29,
});
assert.equal(leakedReport.datasetIntegrity.independenceGroupSplitLeakageCount, 1,
  'one source group appearing in both train and holdout must be detected');
assert.equal(leakedReport.datasetIntegrity.validForPromotion, false);
assert.equal(leakedReport.promotion.gates.datasetIntegrity, false);
assert.equal(leakedReport.promotion.allowed, false);

const oversizedGroup = structuredClone(examples);
oversizedGroup[4].independenceGroupId = 'g'.repeat(121);
const oversizedFingerprint = fingerprintMemoryRetrievalDataset(oversizedGroup);
const oversizedReport = runMemoryOS2RetrievalBenchmark(memory.snapshot(), oversizedGroup, {
  now,
  k: 5,
  bootstrapSamples: 200,
  maxExamples: 512,
  datasetProvenance: { ...provenance, contentSha256: oversizedFingerprint },
  seed: 29,
});
assert.equal(oversizedReport.datasetIntegrity.truncatedFieldRows, 1,
  'an overlong source-group identity must be reported as truncated input');
assert.equal(oversizedReport.datasetIntegrity.validForPromotion, false,
  'lossy source-group normalization must block promotion');

console.log('WORKPASS77_MEMORY_CLUSTER_BOOTSTRAP=PASS', JSON.stringify({
  clusters: report.confidence.recallAtK01.clusterCount,
  resamplingUnit: report.confidence.recallAtK01.resamplingUnit,
  splitLeakageDetected: leakedReport.datasetIntegrity.independenceGroupSplitLeakageCount,
}));
