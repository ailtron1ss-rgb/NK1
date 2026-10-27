import assert from 'node:assert/strict';
import { adaptHexisEvidence } from '../src/organism/integration/HexisEvidenceBridge.ts';

const base = {
  beliefId: 'belief-17',
  evidenceId: 'evidence-42',
  contentHash: 'sha256:abc123',
  sourceRef: 'conversation:session-9',
  sourceKind: 'user_testimony',
  stance: 'refutes',
  observedAt: 1_798_000_000_000,
  independenceKey: 'user:session-9',
  authority01: 0.8,
  confidenceBefore: 0.91,
  confidenceAfter: 0.31,
};

const proposal = adaptHexisEvidence(base);
assert.equal(proposal.schema, 'nk1.hexis-evidence-proposal.v1');
assert.equal(proposal.stance, 'refutes', 'contradictory evidence must retain its polarity');
assert.equal(proposal.source.provenanceClass, 'user');
assert.equal(proposal.source.independenceKey, 'user:session-9');
assert.equal(proposal.upstreamConfidence.before, 0.91);
assert.equal(proposal.upstreamConfidence.after, 0.31);
assert.equal(proposal.confidenceMutationApplied, false, 'upstream confidence must never overwrite NK1 confidence');
assert.equal(proposal.requiresIndependentReview, true);

const bounded = adaptHexisEvidence({ ...base, authority01: 8, confidenceBefore: -1, confidenceAfter: 3 });
assert.equal(bounded.source.sourceAuthority01, 1);
assert.equal(bounded.upstreamConfidence.before, 0);
assert.equal(bounded.upstreamConfidence.after, 1);

assert.throws(() => adaptHexisEvidence({ ...base, evidenceId: ' ' }), /evidenceId/);
assert.throws(() => adaptHexisEvidence({ ...base, observedAt: Number.NaN }), /observedAt/);
assert.throws(() => adaptHexisEvidence({ ...base, stance: 'supports-and-refutes' }), /stance/);
assert.throws(() => adaptHexisEvidence({ ...base, independenceKey: '' }), /independenceKey/);

const sameOriginCopy = adaptHexisEvidence({ ...base, evidenceId: 'evidence-copy' });
assert.equal(sameOriginCopy.source.independenceKey, proposal.source.independenceKey,
  'copied evidence remains in the same independence group');

console.log('Hexis evidence bridge contract: PASS');
