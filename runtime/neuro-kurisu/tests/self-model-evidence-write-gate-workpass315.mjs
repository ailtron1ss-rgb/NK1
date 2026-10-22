import assert from 'node:assert/strict';
import { SelfModelEngine } from '../src/organism/cognition/SelfModelV2.ts';

const model = new SelfModelEngine();
const before = model.snapshot();
const ungrounded = model.learnGoalOutcome({
  action: 'explore', goalAlignment01: .9, reward01: .9, tick: 1,
});
assert.equal(ungrounded.identityUpdateAccepted, false, 'unbound outcome must not update high-level self-beliefs');
assert.equal(model.snapshot().agencyBelief, before.agencyBelief,
  'agency belief remains stable without independent evidence');
assert.equal(model.snapshot().identityCoherence, before.identityCoherence,
  'identity coherence remains stable without independent evidence');
assert.notEqual(model.snapshot().selfConsistentAction11.explore, before.selfConsistentAction11.explore,
  'action-level preference can still learn from the bounded reward');
assert.equal(model.snapshot().identityGateRejectedCount, 1);

const correlated = model.learnGoalOutcome({
  action: 'explore',
  goalAlignment01: .95,
  reward01: .95,
  tick: 2,
  evidence: {
    verified: true, independent: false, source: 'world-transition',
    evidenceRef: 'world-transition:correlated',
  },
});
assert.equal(correlated.identityUpdateAccepted, false,
  'verified but non-independent evidence cannot revise identity');
assert.equal(model.snapshot().identityGateRejectedCount, 2);

const mismatched = model.learnGoalOutcome({
  action: 'verify',
  goalAlignment01: .92,
  reward01: .92,
  tick: 3,
  evidence: {
    verified: true, independent: true, source: 'external-verification',
    evidenceRef: 'world-transition:wrong-namespace',
  },
});
assert.equal(mismatched.identityUpdateAccepted, false,
  'the receipt namespace must match its asserted source');
assert.equal(mismatched.identityUpdateReason, 'evidence-source-binding-mismatch');
assert.equal(model.snapshot().identityGateRejectedCount, 3);

const grounded = model.learnGoalOutcome({
  action: 'verify',
  goalAlignment01: .9,
  reward01: .9,
  tick: 4,
  evidence: {
    verified: true, independent: true, source: 'world-transition',
    evidenceRef: 'world-transition:trace-4:tick-4',
  },
});
assert.equal(grounded.identityUpdateAccepted, true,
  'verified independent outcome bound to a receipt may update high-level self-beliefs');
assert.equal(model.snapshot().identityGateAcceptedCount, 1);
assert.equal(model.snapshot().lastIdentityGate.reason, 'verified-independent-outcome-bound');

const restored = new SelfModelEngine();
restored.restore(model.snapshot());
assert.deepEqual(restored.snapshot(), model.snapshot(),
  'identity write-gate state survives the normal snapshot/restore path');

const legacySnapshot = { ...model.snapshot() };
delete legacySnapshot.identityGateAcceptedCount;
delete legacySnapshot.identityGateRejectedCount;
delete legacySnapshot.lastIdentityGate;
const legacyRestored = new SelfModelEngine();
legacyRestored.restore(legacySnapshot);
assert.equal(legacyRestored.snapshot().identityGateAcceptedCount, 0, 'older self-model snapshots receive safe gate defaults');
assert.equal(legacyRestored.snapshot().identityGateRejectedCount, 0, 'older self-model snapshots receive safe reject-counter defaults');
assert.equal(legacyRestored.snapshot().lastIdentityGate, null, 'malformed or absent gate diagnostics must not block restore');
console.log('WORKPASS315_SELF_MODEL_EVIDENCE_GATE=PASS', JSON.stringify({
  accepted: model.snapshot().identityGateAcceptedCount,
  rejected: model.snapshot().identityGateRejectedCount,
  lastGate: model.snapshot().lastIdentityGate,
}));
