import assert from 'node:assert/strict';
import { TheInventionLoop } from '../src/organism/research/TheInventionLoop.ts';

let now = 1000;
let seq = 0;
const loop = new TheInventionLoop(() => now++, () => `inv-${++seq}`);
const protocol = { question: 'Does the candidate improve retrieval?', hypothesis: 'The candidate improves recall without harming precision.', successCriteria: 'Effect >= 0.1 on preregistered metric.', testFingerprint: 'sha256:fixed-test-v1', baseline: 0.5, minEffect: 0.1 };
const p = loop.propose(protocol);
assert.equal(p.stage, 'proposed');
assert.throws(() => loop.recordOutcome(p.id, { kind: 'primary', verifierId: 'v1', environmentId: 'e1', testFingerprint: protocol.testFingerprint, observed: .7, effect01: .2 }), /outcome-kind-not-allowed/);
loop.design(p.id);
loop.prototype(p.id, 'candidate://isolated-prototype');
loop.recordOutcome(p.id, { kind: 'primary', verifierId: 'v1', environmentId: 'e1', testFingerprint: protocol.testFingerprint, observed: .7, effect01: .2 });
assert.equal(loop.snapshot().records[0].stage, 'tested');
assert.throws(() => loop.critique(p.id, { reviewerId: 'v1' }), /reviewer-must-be-independent/);
loop.critique(p.id, { reviewerId: 'reviewer-2', blockers: [], limitations: ['Small initial sample'] });
assert.equal(loop.snapshot().records[0].stage, 'critiqued');
assert.throws(() => loop.recordOutcome(p.id, { kind: 'replication', verifierId: 'v1', environmentId: 'e1', testFingerprint: protocol.testFingerprint, observed: .7, effect01: .2 }), /replication-not-independent/);
loop.recordOutcome(p.id, { kind: 'replication', verifierId: 'v2', environmentId: 'e2', testFingerprint: protocol.testFingerprint, observed: .68, effect01: .18 });
assert.equal(loop.snapshot().records[0].stage, 'replicated');
assert.throws(() => loop.recordOutcome(p.id, { kind: 'holdout', verifierId: 'v2', environmentId: 'e3', testFingerprint: protocol.testFingerprint, observed: .66, effect01: .16 }), /holdout-must-be-independent/);\nloop.recordOutcome(p.id, { kind: 'holdout', verifierId: 'v3', environmentId: 'e3', testFingerprint: protocol.testFingerprint, observed: .66, effect01: .16 });
assert.equal(loop.snapshot().records[0].stage, 'accepted');
assert.equal(loop.metrics().accepted, 1);
assert.throws(() => loop.reject(p.id, 'late-reject'), /invention-closed/);

const bad = loop.propose({ ...protocol, testFingerprint: 'sha256:fixed-test-v2' });
loop.design(bad.id); loop.prototype(bad.id, 'candidate://bad');
loop.recordOutcome(bad.id, { kind: 'primary', verifierId: 'v1', environmentId: 'e1', testFingerprint: 'sha256:fixed-test-v2', observed: .51, effect01: .01 });
assert.equal(loop.snapshot().records.find(r => r.id === bad.id).stage, 'rejected');

const restored = new TheInventionLoop(() => now++, () => 'unused');
restored.restore(loop.snapshot());
assert.equal(restored.snapshot().records.length, 2);
assert.equal(restored.metrics().accepted, 1);
assert.throws(() => loop.propose({ ...protocol, minEffect: 2 }), /invalid-preregistration/);
console.log('THE_INVENTION_LOOP_LIFECYCLE=PASS');
