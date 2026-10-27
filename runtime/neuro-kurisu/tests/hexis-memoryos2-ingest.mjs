import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { applyReviewedHexisEvidence } from '../src/organism/integration/HexisEvidenceIngest.ts';

const memory = new MemoryOS2({ embeddingProvider: null });
const target = memory.encode({
  content: 'NK1 memory contract remains under review',
  kind: 'semantic',
  source: 'user:session-1',
  salience: 0.6,
  emotionalWeight: 0.2,
  identityRelevance: 0.3,
  goalRelevance: 0.4,
  socialRelevance: 0.1,
  predictionError: 0.2,
  confidence: 0.7,
  epistemicStatus: 'belief',
  entities: ['NK1', 'memory'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
}, { clone: false });

const evidence = {
  beliefId: target.id,
  evidenceId: 'hex-evidence-1',
  contentHash: 'sha256:reviewed-content',
  sourceRef: 'tool:independent-check',
  sourceKind: 'tool_receipt',
  stance: 'refutes',
  observedAt: 1_798_000_000_000,
  independenceKey: 'TOOL-RUN:INDEPENDENT-1',
  authority01: 0.9,
  confidenceBefore: 0.8,
  confidenceAfter: 0.2,
};

const pending = applyReviewedHexisEvidence(memory, target.id, evidence, { reviewed: false });
assert.equal(pending.status, 'review-required');
assert.equal(memory.get(target.id)?.evidenceSources?.some(row => row.source.includes('hex-evidence-1')), false,
  'unreviewed evidence must not mutate canonical memory');

const recorded = applyReviewedHexisEvidence(memory, target.id, evidence, { reviewed: true });
assert.equal(recorded.status, 'recorded');
assert.equal(recorded.stance, 'refutes');
assert.equal(memory.get(target.id)?.confidence, 0.7,
  'upstream confidence deltas must not overwrite NK1 confidence');
assert.equal(memory.get(target.id)?.context?.hexisLastEvidenceStance, 'refutes');
assert.equal(memory.get(target.id)?.evidenceSources?.some(row => row.source.includes('hex-evidence-1')), true);
assert.equal(memory.get(target.id)?.evidenceLineageKeys?.includes('lineage:tool-run:independent-1'), true,
  'the canonical replay guard must persist the normalized independent lineage');

// A different event ID from the same upstream origin must not count as independent corroboration.
const sameLineageCopy = {
  ...evidence,
  evidenceId: 'hex-evidence-2',
  sourceRef: 'tool:second-wrapper-for-same-run',
  independenceKey: 'tool-run:independent-1',
};
const sourcesBeforeSameLineageReplay = memory.get(target.id)?.evidenceSources?.length ?? 0;
const sameLineageResult = applyReviewedHexisEvidence(memory, target.id, sameLineageCopy, { reviewed: true });
assert.equal(sameLineageResult.status, 'duplicate',
  'different event IDs from one independenceKey must not count as independent evidence');
assert.equal(memory.get(target.id)?.evidenceSources?.length ?? 0, sourcesBeforeSameLineageReplay,
  'same-lineage replay must not append another evidence source');

// A shorter evidence ID must not collide with a longer ID sharing its prefix.
const longerId = {
  ...evidence,
  evidenceId: 'hex-evidence-10',
  independenceKey: 'tool-run:independent-10',
};
const longerRecorded = applyReviewedHexisEvidence(memory, target.id, longerId, { reviewed: true });
assert.equal(longerRecorded.status, 'recorded');
const shorterTarget = memory.encode({
  content: 'Separate target for evidence ID prefix regression',
  kind: 'semantic', source: 'test:prefix-regression', salience: 0.5,
  emotionalWeight: 0, identityRelevance: 0, goalRelevance: 0,
  socialRelevance: 0, predictionError: 0, confidence: 0.6,
  epistemicStatus: 'belief', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [],
}, { clone: false });
memory.updateSignals(shorterTarget.id, {
  evidenceSources: [{
    source: 'hexis:tool:prior#hex-evidence-10', provenanceClass: 'external',
    sourceAuthority01: 0.9, independenceKey: 'tool-run:prior',
    observedAt: evidence.observedAt, evidenceFreshnessAt: evidence.observedAt,
  }],
}, 'test-prefix-regression');
const shorter = applyReviewedHexisEvidence(memory, shorterTarget.id, evidence, { reviewed: true });
assert.equal(shorter.status, 'recorded', 'hex-evidence-1 is not a replay of hex-evidence-10');

const duplicate = applyReviewedHexisEvidence(memory, target.id, evidence, { reviewed: true });
assert.equal(duplicate.status, 'duplicate', 'exact evidence replay must be idempotent');
assert.equal(applyReviewedHexisEvidence(memory, 'missing-memory', evidence, { reviewed: true }).status, 'missing-target');

console.log('Hexis → MemoryOS2 reviewed ingest: PASS');
