import assert from 'node:assert/strict';
import { P65EpistemicLedger } from '../src/organism/memory/P65EpistemicLedger.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';
import { applyTrustedOutcomeToP65 } from '../src/organism/memory/P65VerifiedOutcomeBridge.ts';

const service = new OutcomeVerificationService();
const expected = {
  toolId: 'device.observe',
  input: { sensor: 'front', sample: 9 },
  executionId: 'exec-0123456789abcdef',
  decisionId: 'decision:p65-bridge-1',
};
const verification = await service.verify({
  ...expected,
  result: { observationId: 'obs-p65-1' },
}, async () => ({
  verified: true, basis: 'external-postcondition', confidence01: .9,
  externalObservation: true, observationId: 'obs-p65-1',
  expectedPostcondition: 'fresh scene observed',
  observedPostcondition: 'fresh scene observed',
}));
assert.equal(verification.evidenceEventId?.startsWith('outcome:'), true);

const p65 = new P65EpistemicLedger();
const claimId = p65.record({ tick: 1, at: 100, kind: 'belief', content: 'Fresh scene observed', confidence01: .5, source: 'organism' });
const result = applyTrustedOutcomeToP65(p65, { claimId, verification, expected, at: 200 });
assert.equal(result.accepted, true);
assert.equal(result.independentSource, true);
assert.ok(result.confidence01 > .5);
assert.equal(p65.reviseBeliefFromEvidence({
  claimId, evidenceId: verification.evidenceEventId, source: expected.toolId,
  independenceKey: 'tool:device.observe', stance: 'supports', strength01: .99, at: 201,
}).reason, 'evidence-already-applied', 'replaying a trusted receipt must not count twice');
assert.equal(applyTrustedOutcomeToP65(p65, {
  claimId, verification: { ...verification }, expected, at: 202,
}).reason, 'untrusted-decision-linked-postcondition', 'a copied JSON receipt loses process-local authority');

const wrongClaim = p65.record({ tick: 2, at: 210, kind: 'belief', content: 'A different state was observed', confidence01: .5, source: 'organism' });
assert.equal(applyTrustedOutcomeToP65(p65, { claimId: wrongClaim, verification, expected, at: 220 }).reason,
  'belief-postcondition-mismatch', 'verified evidence cannot be rebound to an unrelated belief');

const otherExpected = { ...expected, decisionId: 'decision:another-action' };
assert.equal(applyTrustedOutcomeToP65(p65, { claimId, verification, expected: otherExpected, at: 230 }).reason,
  'untrusted-decision-linked-postcondition', 'the evidence receipt is bound to the original action decision');
console.log('P65_VERIFIED_OUTCOME_BRIDGE=PASS');
