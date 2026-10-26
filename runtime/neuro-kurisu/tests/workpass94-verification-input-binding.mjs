import assert from 'node:assert/strict';
import {
  OutcomeVerificationService,
  assessExternalPostcondition,
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
  assert.equal(context.executionId, undefined, 'embedded C0 control must be rejected');
  assert.equal(context.decisionId, undefined, 'embedded C1 control must be rejected');
  return { verified: false, basis: 'none', confidence01: 0 };
});
assert.equal(invalidCorrelationContext.verified, false);

const boundaryControlContext = await service.verify({
  toolId: 'device.set-state',
  input,
  result: { accepted: true },
  executionId: '\nexec-12345678-valid',
  decisionId: 'decision-12345678-valid\t',
}, async (context) => {
  assert.equal(context.executionId, undefined, 'leading LF must be rejected before trim');
  assert.equal(context.decisionId, undefined, 'trailing TAB must be rejected before trim');
  return { verified: false, basis: 'none', confidence01: 0 };
});
assert.equal(boundaryControlContext.verified, false);

const validCorrelationContext = await service.verify({
  toolId: 'device.set-state',
  input,
  result: { accepted: true },
  executionId: 'exec-12345678-valid',
  decisionId: 'decision-12345678-valid',
}, async (context) => {
  assert.equal(context.executionId, 'exec-12345678-valid');
  assert.equal(context.decisionId, 'decision-12345678-valid');
  return { verified: false, basis: 'none', confidence01: 0 };
});
assert.equal(validCorrelationContext.verified, false,
  'valid correlation IDs do not independently authorize verification');

for (const [label, observationId] of [
  ['embedded-C0', 'observation-\u0001-id'],
  ['embedded-C1', 'observation-\u009f-id'],
  ['leading-TAB', '\tobservation-id'],
  ['trailing-LF', 'observation-id\n'],
  ['overlong', 'o'.repeat(181)],
]) {
  const invalidEvidence = await service.verify({
    toolId: 'device.set-state',
    input,
    result: { accepted: true },
  }, async () => ({
    verified: true,
    basis: 'external-postcondition',
    externalObservation: true,
    observationId,
    expectedPostcondition: 'relay-main=on',
    observedPostcondition: 'relay-main=on',
    confidence01: 0.99,
  }));
  assert.notEqual(invalidEvidence.verified, true,
    label + ': malformed observation IDs must not produce trusted verification');
  assert.notEqual(invalidEvidence.basis, 'external-postcondition',
    label + ': malformed observation IDs must not preserve external-evidence authority');
}

assert.equal(assessExternalPostcondition({
  verified: true,
  basis: 'external-postcondition',
  externalObservation: true,
  observationId: 'observation-\u009f-id',
  expectedPostcondition: 'relay-main=on',
  observedPostcondition: 'relay-main=on',
}), 'unknown', 'the public assessor must fail closed on C1 controls too');

assert.equal(assessExternalPostcondition({
  verified: true,
  basis: 'external-postcondition',
  externalObservation: true,
  observationId: 'valid-observation',
  expectedPostcondition: '\nrelay-main=on',
  observedPostcondition: 'relay-main=on',
}), 'unknown', 'the public assessor must reject boundary controls before trimming');

const overlongPostcondition = await service.verify({
  toolId: 'device.set-state',
  input,
  result: { accepted: true },
}, async () => ({
  verified: true,
  basis: 'external-postcondition',
  externalObservation: true,
  observationId: 'readback-overlong-postcondition',
  expectedPostcondition: 'x'.repeat(1024) + 'expected-tail',
  observedPostcondition: 'x'.repeat(1024) + 'observed-tail',
  confidence01: 0.99,
}));
assert.notEqual(overlongPostcondition.verified, true,
  'different postconditions beyond the size limit must not collide after truncation');
assert.notEqual(overlongPostcondition.basis, 'external-postcondition',
  'overlong postconditions must not retain an authoritative evidence basis');
assert.equal(assessExternalPostcondition({
  verified: true,
  basis: 'external-postcondition',
  externalObservation: true,
  observationId: 'readback-overlong-assessment',
  expectedPostcondition: 'x'.repeat(1024) + 'expected-tail',
  observedPostcondition: 'x'.repeat(1024) + 'observed-tail',
}), 'unknown', 'the public assessor must reject overlong postcondition text');

const maxLengthPostcondition = await service.verify({
  toolId: 'device.set-state',
  input,
  result: { accepted: true },
}, async () => ({
  verified: true,
  basis: 'external-postcondition',
  externalObservation: true,
  observationId: 'readback-max-length',
  expectedPostcondition: 'x'.repeat(1024),
  observedPostcondition: 'x'.repeat(1024),
  confidence01: 0.99,
}));
assert.equal(maxLengthPostcondition.verified, true,
  'a valid postcondition exactly at the documented length limit remains supported');

console.log('WORKPASS94_VERIFICATION_INPUT_BINDING=PASS exact-structural-match partial-input-rejected nested-change-rejected copied-token-rejected malformed-input-rejected');
