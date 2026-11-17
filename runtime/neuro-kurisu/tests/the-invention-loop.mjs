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
  minSuccessRate: 0.8,
  primarySeed: 17,
  replicationSeeds: [18, 19, 20, 21, 22],
  holdoutSeeds: [23, 24, 25, 26, 27],
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
  seed: 18,
  attempt: 1,
  runId: 'run-replication-18',
  verifierId: 'verifier-replication',
  environmentId: 'environment-replication-18',
  testFingerprint: protocol.testFingerprint,
  evidenceRef: 'artifact://replication/18.json',
  evidenceSha256: sha('b'),
  observed: 94,
};
const holdoutInput = {
  kind: 'holdout',
  authority: 'independent-verifier',
  seed: 23,
  attempt: 1,
  runId: 'run-holdout-23',
  verifierId: 'verifier-holdout',
  environmentId: 'environment-holdout-23',
  testFingerprint: protocol.testFingerprint,
  evidenceRef: 'artifact://holdout/23.json',
  evidenceSha256: sha('c'),
  observed: 92,
};

const p = loop.propose(protocol);
assert.equal(p.stage, 'proposed');
assert.throws(() => loop.propose({ ...protocol, verifierPlan: { ...protocol.verifierPlan, holdout: 'verifier-primary' } }), /invalid-preregistration/);
assert.throws(() => loop.propose({ ...protocol, metricScale: 0 }), /invalid-preregistration/);
assert.throws(() => loop.propose({ ...protocol, replicationSeeds: [1, 1, 2, 3, 4] }), /invalid-preregistration/);
assert.throws(() => loop.propose({ ...protocol, holdoutSeeds: [17, 23, 24, 25, 26] }), /invalid-preregistration/);
assert.throws(() => loop.recordOutcome(p.id, primaryInput), /outcome-kind-not-allowed-at-stage/);
loop.design(p.id);
assert.throws(() => loop.prototype(p.id, 'candidate://missing-digest'), /invalid-prototype/);
loop.prototype(p.id, { reference: 'candidate://isolated-prototype', sha256: sha('d') });

// A caller-supplied effect must never override the preregistered metric calculation.
assert.throws(() => loop.recordOutcome(p.id, { ...primaryInput, authority: 'self-report' }), /outcome-not-authoritative:self-report-not-authoritative/);
assert.throws(() => loop.recordOutcome(p.id, { ...primaryInput, attempt: 2 }), /attempt-must-be-one/);
const primary = loop.recordOutcome(p.id, { ...primaryInput, effect01: 1 });
assert.equal(primary.stage, 'tested');
assert.equal(primary.outcomes[0].effect01, 0.2);
assert.equal(primary.outcomes[0].passed, true);
assert.equal(primary.outcomes[0].authority, 'independent-verifier');
assert.equal(primary.outcomes[0].seed, 17);
assert.equal(primary.outcomes[0].attempt, 1);
assert.throws(() => loop.recordOutcome(p.id, { ...replicationInput, runId: 'run-primary-001' }), /duplicate-run/);
assert.throws(() => loop.recordOutcome(p.id, { ...replicationInput, evidenceSha256: 'not-a-sha256' }), /invalid-outcome/);
assert.throws(() => loop.critique(p.id, { reviewerId: 'unregistered-reviewer', reviewRef: 'review://primary', reviewSha256: sha('e') }), /reviewer-plan-mismatch/);
loop.critique(p.id, {
  reviewerId: protocol.verifierPlan.critique,
  reviewRef: 'review://independent-review',
  reviewSha256: sha('e'),
  blockers: [],
  limitations: ['Initial sample is deliberately small'],
});
assert.equal(loop.snapshot().records[0].stage, 'critiqued');
assert.throws(() => loop.recordOutcome(p.id, { ...replicationInput, verifierId: 'verifier-primary' }), /verifier-plan-mismatch/);
const replicationRuns = [
  [18, 97], [19, 97], [20, 101], [21, 97], [22, 96],
];
for (let index = 0; index < replicationRuns.length; index += 1) {
  const [seed, observed] = replicationRuns[index];
  const result = loop.recordOutcome(p.id, {
    ...replicationInput,
    seed,
    runId: `run-replication-${seed}`,
    environmentId: `environment-replication-${seed}`,
    evidenceRef: `artifact://replication/${seed}.json`,
    evidenceSha256: sha(String(seed)),
    observed,
  });
  assert.equal(result.stage, index === 4 ? 'replicated' : 'replicating');
}
assert.throws(() => loop.recordOutcome(p.id, { ...replicationInput, seed: 18, runId: 'run-replication-duplicate', evidenceRef: 'artifact://replication/duplicate.json' }), /duplicate-seed/);
assert.throws(() => loop.recordOutcome(p.id, {
  ...holdoutInput,
  environmentId: 'environment-replication-18',
  runId: 'run-holdout-bad',
}), /holdout-must-be-independent/);
const holdoutRuns = [
  [23, 96], [24, 97], [25, 105], [26, 96], [27, 96],
];
for (let index = 0; index < holdoutRuns.length; index += 1) {
  const [seed, observed] = holdoutRuns[index];
  const result = loop.recordOutcome(p.id, {
    ...holdoutInput,
    seed,
    runId: `run-holdout-${seed}`,
    environmentId: `environment-holdout-${seed}`,
    evidenceRef: `artifact://holdout/${seed}.json`,
    evidenceSha256: sha(String(seed + 20)),
    observed,
  });
  assert.equal(result.stage, index === 4 ? 'accepted' : 'holdingout');
}
assert.equal(loop.metrics().accepted, 1);
assert.equal(loop.metrics().auditVerifiedRecords, 1);
assert.throws(() => loop.reject(p.id, 'late-reject'), /invention-closed/);

// A worse result must be rejected even if an untrusted caller tries to claim effect01=1.
const worse = loop.propose({ ...protocol, testFingerprint: sha('8') });
loop.design(worse.id);
loop.prototype(worse.id, { reference: 'candidate://worse', sha256: sha('f') });
const rejected = loop.recordOutcome(worse.id, {
  ...primaryInput,
  runId: 'run-worse-001',
  testFingerprint: sha('8'),
  evidenceRef: 'artifact://worse/result.json',
  evidenceSha256: sha('1'),
  observed: 105,
  effect01: 1,
});
assert.equal(rejected.stage, 'rejected');
assert.equal(rejected.outcomes[0].effect01, 0);
assert.equal(rejected.outcomes[0].passed, false);

// A receipt cannot be recycled by a different invention, even under a new run ID.
const reuse = loop.propose(protocol);
loop.design(reuse.id);
loop.prototype(reuse.id, { reference: 'candidate://reused-receipt', sha256: sha('2') });
assert.throws(() => loop.recordOutcome(reuse.id, {
  ...primaryInput,
  runId: 'run-reused-evidence-001',
  environmentId: 'environment-reused',
}), /duplicate-run-or-evidence-across-inventions/);
assert.equal(loop.snapshot().records.find(record => record.id === reuse.id).outcomes.length, 0);

// A complete replication cohort still fails when fewer than the preregistered
// fraction of seeds clear the gate, even when its mean effect is positive.
const weakProtocol = {
  ...protocol,
  testFingerprint: sha('7'),
  primarySeed: 37,
  replicationSeeds: [38, 39, 40, 41, 42],
  holdoutSeeds: [43, 44, 45, 46, 47],
};
const weak = loop.propose(weakProtocol);
loop.design(weak.id);
loop.prototype(weak.id, { reference: 'candidate://weak-replication', sha256: sha('3') });
loop.recordOutcome(weak.id, {
  ...primaryInput,
  seed: 37,
  runId: 'run-weak-primary',
  environmentId: 'environment-weak-primary',
  testFingerprint: sha('7'),
  evidenceRef: 'artifact://weak/primary.json',
  evidenceSha256: sha('4'),
});
loop.critique(weak.id, {
  reviewerId: weakProtocol.verifierPlan.critique,
  reviewRef: 'review://weak',
  reviewSha256: sha('5'),
});
let weakResult;
for (const [seed, observed] of [[38, 96], [39, 96], [40, 96], [41, 103], [42, 103]]) {
  weakResult = loop.recordOutcome(weak.id, {
    ...replicationInput,
    seed,
    runId: 'run-weak-replication-' + seed,
    environmentId: 'environment-weak-replication-' + seed,
    testFingerprint: sha('7'),
    evidenceRef: 'artifact://weak/replication/' + seed + '.json',
    evidenceSha256: sha(String(seed)),
    observed,
  });
}
assert.equal(weakResult.stage, 'rejected');
assert.equal(weakResult.phaseSummaries.replication.successRate01, 0.6);
assert.equal(weakResult.phaseSummaries.replication.passed, false);

// Restoring altered records must quarantine them instead of trusting the mutable cache.
const tampered = loop.snapshot();
tampered.records[2].protocol.baseline = 50;
tampered.accepted = 999;
const restored = new TheInventionLoop(() => now++, () => 'unused');
restored.restore(tampered);
assert.equal(restored.metrics().accepted, 0);
assert.equal(restored.metrics().quarantinedRecords, 1);
assert.equal(restored.metrics().auditVerifiedRecords, 2);

console.log('THE_INVENTION_LOOP_LIFECYCLE=PASS preregistered-seeds+verified-ledger+audit-chain');
