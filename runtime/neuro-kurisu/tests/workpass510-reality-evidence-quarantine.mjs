import assert from 'node:assert/strict';
import { RealityEvidenceLedger, realityEvidenceEventId } from '../src/organism/system/RealityEvidenceLedger.ts';

const eventId = realityEvidenceEventId('wp510-action-receipt', 'action-consequence', 'device:postcondition');
const ledger = new RealityEvidenceLedger();
const firstInput = {
  tick: 19, at: 1_800_000_000_000, eventId,
  realityClass: 'device-observation',
  claim: 'device verified intended postcondition',
  confidence01: 0.91,
  independenceKey: 'device:postcondition-verifier',
  parentIds: ['decision:wp510'],
};
const first = ledger.record(firstInput);
const replay = ledger.record({ ...firstInput, at: firstInput.at + 5000 });
assert.deepEqual(replay, first,
  'same event/payload retries remain idempotent even if processing time differs');
assert.equal(ledger.snapshot().total, 1);

assert.throws(() => ledger.record({
  ...firstInput, at: firstInput.at + 6000, claim: 'conflicting postcondition',
}), /reality-evidence-event-identity-conflict/);
assert.equal(ledger.recent(8).length, 0,
  'event identity conflict must hide the prior record from active evidence views');
assert.equal(ledger.snapshot().externalCount, 0,
  'quarantined evidence must not count as independent external confirmation');
assert.throws(() => ledger.record(firstInput), /reality-evidence-event-id-quarantined/,
  'later retries cannot revive an identity that was previously disputed');
assert.equal(ledger.claimAssessment(firstInput.claim).externalSamples, 0,
  'quarantined evidence must not contribute to claim assessment');

const snapshot = ledger.snapshot();
assert.ok(snapshot.quarantinedEventIds?.includes(eventId));
const restored = new RealityEvidenceLedger();
restored.restore(snapshot);
assert.ok(restored.snapshot().quarantinedEventIds?.includes(eventId),
  'quarantine state must survive persistence and restart');
assert.equal(restored.recent(8).length, 0);
assert.throws(() => restored.record(firstInput), /reality-evidence-event-id-quarantined/);

const reported = new RealityEvidenceLedger();
reported.record({
  tick: 19, at: 1_800_000_000_000,
  eventId: realityEvidenceEventId('wp510-user-report', 'user-report', 'memory-claim'),
  realityClass: 'user-reported',
  claim: 'the user says the device activated',
  confidence01: 0.99,
  independenceKey: 'user:statement',
});
const assessment = reported.claimAssessment('the user says the device activated');
assert.equal(assessment.userReportedSamples, 1);
assert.equal(assessment.externalSamples, 0,
  'a user report must not be counted as independent device/external observation');
assert.equal(reported.snapshot().externalCount, 0);

assert.throws(() => reported.record({
  tick: 20, at: 1_800_000_000_000,
  eventId: 'bad\nidentity',
  realityClass: 'device-observation', claim: 'bad identity',
  confidence01: 0.8, independenceKey: 'device:bad',
}), /reality-evidence-input-invalid/,
  'control-bearing event IDs must be rejected at ingress');

console.log('WORKPASS510_REALITY_EVIDENCE_QUARANTINE=PASS');
