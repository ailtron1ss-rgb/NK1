import assert from 'node:assert/strict';
import { TheInventionLoop } from '../src/organism/research/TheInventionLoop.ts';

const sha = (letter) => letter.repeat(64);
let now = 1000;
let sequence = 0;
const loop = new TheInventionLoop(() => now++, () => `inv-${++sequence}`);
const protocol = {
  question: 'Does the candidate reduce retrieval latency?',
  hypothesis: 'The candidate reduces p95 latency without reducing recall.',
  successCriteria: 'At least 10% improvement against the preregistered baseline.',
  testFingerprint: sha('9'),
  baseline: 100,
  metricScale: 20,
  minEffect: 0.1,
  lowerIsBetter: true,
  verifierPlan: {
    primary: 'verifier-primary',
    critique: 'reviewer-independent',
    replication: 'verifier-replication',
    holdout: 'verifier-holdout',
  },
};
const primaryInput = {
  kind: 'primary',
  authority: 'independent-verifier',
  seed: 17,
  attempt: 1,
  runId: 'run-primary-001',
  verifierId: 'verifier-primary',
  environmentId: 'environment-primary',
  testFingerprint: protocol.testFingerprint,
  evidenceRef: 'artifact://primary/result.json',
  evidenceSha256: sha('a'),
  observed: 96,
};
const replicationInput = {
  kind: 'replication',
  authority: 'independent-verifier',
  seed: 17,
  attempt: 1,
  runId: 'run-replication-001',
  verifierId: 'verifier-replication',
  environmentId: 'environment-replication',
  testFingerprint: protocol.testFingerprint,
  evidenceRef: 'artifact://replication/result.json',
  evidenceSha256: sha('b'),
  observed: 94,
};
const holdoutInput = {
  kind: 'holdout',
  authority: 'independent-verifier',
  seed: 17,
  attempt: 1,
  runId: 'run-holdout-001',
  verifierId: 'verifier-holdout',
  environmentId: 'environment-holdout',
  testFingerprint: protocol.testFingerprint,
  evidenceRef: 'artifact://holdout/result.json',
  evidenceSha256: sha('c'),
  observed: 92,
};

const p = loop.propose(protocol);
assert.equal(p.stage, 'proposed');
assert.throws(() => loop.propose({ ...protocol, verifierPlan: { ...protocol.verifierPlan, holdout: 'verifier-primary' } }), /invalid-preregistration/);
assert.throws(() => loop.propose({ ...protocol, metricScale: 0 }), /invalid-preregistration/);
assert.throws(() => loop.recordOutcome(p.id, primaryInput), /outcome-kind-not-allowed-at-stage/);
loop.design(p.id);
assert.throws(() => loop.prototype(p.id, 'candidate://missing-digest'), /invalid-prototype/);
loop.prototype(p.id, { reference: 'candidate://isolated-prototype', sha256: sha('d') });

// A caller-supplied effect must never override the preregistered metric calculation.
assert.throws(() => loop.recordOutcome(p.id, { ...primaryInput, authority: 'self-report' }), /outcome-not-authoritative:self-report-not-authoritative/);
const primary = loop.recordOutcome(p.id, { ...primaryInput, effect01: 1 });
assert.equal(primary.stage, 'tested');
assert.equal(primary.outcomes[0].effect01, 0.2);
assert.equal(primary.outcomes[0].passed, true);
assert.throws(() => loop.recordOutcome(p.id, { ...replicationInput, runId: 'run-primary-001' }), /duplicate-run/);
assert.throws(() => loop.recordOutcome(p.id, { ...replicationInput, evidenceSha256: 'not-a-sha256' }), /invalid-outcome/);
assert.throws(() => loop.critique(p.id, { reviewerId: 'verifier-primary', reviewRef: 'review://primary', reviewSha256: sha('e') }), /reviewer-must-be-independent/);
loop.critique(p.id, {
  reviewerId: protocol.verifierPlan.critique,
  reviewRef: 'review://independent-review',
  reviewSha256: sha('e'),
  blockers: [],
  limitations: ['Initial sample is deliberately small'],
});
assert.equal(loop.snapshot().records[0].stage, 'critiqued');
assert.throws(() => loop.recordOutcome(p.id, { ...replicationInput, verifierId: 'verifier-primary' }), /verifier-plan-mismatch/);
loop.recordOutcome(p.id, replicationInput);
assert.equal(loop.snapshot().records[0].stage, 'replicated');
assert.throws(() => loop.recordOutcome(p.id, {
  ...holdoutInput,
  verifierId: 'verifier-replication',
  runId: 'run-holdout-bad',
}), /holdout-must-be-independent/);
loop.recordOutcome(p.id, holdoutInput);
assert.equal(loop.snapshot().records[0].stage, 'accepted');
assert.equal(loop.metrics().accepted, 1);
assert.equal(loop.metrics().auditVerifiedRecords, 1);
assert.throws(() => loop.reject(p.id, 'late-reject'), /invention-closed/);

// A worse result must be rejected even if an untrusted caller tries to claim effect01=1.
const worse = loop.propose({ ...protocol, testFingerprint: 'sha256:worse-result-manifest-v1' });
loop.design(worse.id);
loop.prototype(worse.id, { reference: 'candidate://worse', sha256: sha('f') });
const rejected = loop.recordOutcome(worse.id, {
  ...primaryInput,
  runId: 'run-worse-001',
  testFingerprint: 'sha256:worse-result-manifest-v1',
  evidenceRef: 'artifact://worse/result.json',
  evidenceSha256: sha('1'),
  observed: 105,
  effect01: 1,
});
assert.equal(rejected.stage, 'rejected');
assert.equal(rejected.outcomes[0].effect01, 0);
assert.equal(rejected.outcomes[0].passed, false);

// Restoring altered records must quarantine them instead of trusting the mutable cache.
const tampered = loop.snapshot();
tampered.records[1].protocol.baseline = 50;
tampered.accepted = 999;
const restored = new TheInventionLoop(() => now++, () => 'unused');
restored.restore(tampered);
assert.equal(restored.metrics().accepted, 0);
assert.equal(restored.metrics().quarantinedRecords, 1);
assert.equal(restored.metrics().auditVerifiedRecords, 1);

console.log('THE_INVENTION_LOOP_LIFECYCLE=PASS authoritative-evidence=required');
