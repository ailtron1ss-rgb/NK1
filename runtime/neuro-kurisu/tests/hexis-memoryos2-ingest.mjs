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
  independenceKey: 'tool-run:independent-1',
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

const duplicate = applyReviewedHexisEvidence(memory, target.id, evidence, { reviewed: true });
assert.equal(duplicate.status, 'duplicate', 'exact evidence replay must be idempotent');
assert.equal(applyReviewedHexisEvidence(memory, 'missing-memory', evidence, { reviewed: true }).status, 'missing-target');

console.log('Hexis → MemoryOS2 reviewed ingest: PASS');
