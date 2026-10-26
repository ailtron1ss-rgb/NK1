import assert from 'node:assert/strict';
import {
  OutcomeVerificationService,
  isTrustedExternalPostconditionVerification,
} from '../src/organism/system/OutcomeVerificationService.ts';

const service = new OutcomeVerificationService();
const input = {
  resource: 'relay-main',
  desired: 'on',
  options: { retry: false, mode: 'safe' },
};
const evidence = await service.verify({
  toolId: 'device.set-state',
  input,
  result: { accepted: true },
}, async () => ({
  verified: true,
  basis: 'external-postcondition',
  externalObservation: true,
  observationId: 'workpass94-readback-001',
  expectedPostcondition: 'relay-main=on',
  observedPostcondition: 'relay-main=on',
  confidence01: 0.99,
}));

assert.equal(isTrustedExternalPostconditionVerification(evidence), true,
  'the exact frozen verifier result remains trusted when no additional input binding is requested');
assert.equal(isTrustedExternalPostconditionVerification(evidence, input), true,
  'structurally identical complete action input should match even after safe cloning');
assert.equal(isTrustedExternalPostconditionVerification(evidence, structuredClone(input)), true,
  'a structurally identical deep copy must match the complete evidence-bound input');
assert.equal(isTrustedExternalPostconditionVerification(evidence, { resource: 'relay-main' }), false,
  'a partial input must not reuse evidence for an action with omitted parameters');
assert.equal(isTrustedExternalPostconditionVerification(evidence, {
  ...structuredClone(input),
  options: { retry: true, mode: 'safe' },
}), false, 'nested parameter changes must invalidate the evidence binding');
assert.equal(isTrustedExternalPostconditionVerification(evidence, {
  ...input,
  desired: 'off',
}), false, 'a different requested postcondition must invalidate the evidence binding');
assert.equal(isTrustedExternalPostconditionVerification(structuredClone(evidence), input), false,
  'copying the verifier result must not copy its private trust registration');

const circular = {};
circular.self = circular;
assert.equal(isTrustedExternalPostconditionVerification(evidence, circular), false,
  'non-serializable expected input must fail closed');

const invalidCorrelationContext = await service.verify({
  toolId: 'device.set-state',
  input,
  result: { accepted: true },
  executionId: 'exec-12345678\u0001forged',
  decisionId: 'decision-12345678\u009fforged',
}, async (context) => {
  assert.equal(context.executionId, undefined,
    'embedded C0 controls in execution IDs must be rejected, not treated as ordinary characters');
  assert.equal(context.decisionId, undefined,
    'embedded C1 controls in decision IDs must be rejected, not treated as ordinary characters');
  return { verified: false, basis: 'none', confidence01: 0 };
});
assert.equal(invalidCorrelationContext.verified, false,
  'malformed correlation identifiers must never upgrade an outcome to verified');

console.log('WORKPASS94_VERIFICATION_INPUT_BINDING=PASS exact-structural-match partial-input-rejected nested-change-rejected copied-token-rejected malformed-input-rejected');
