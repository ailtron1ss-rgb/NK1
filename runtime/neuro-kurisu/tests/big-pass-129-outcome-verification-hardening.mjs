import assert from 'node:assert/strict';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const service = new OutcomeVerificationService();
const liveContext = {
  toolId: '  external.write  ',
  input: { nested: { value: 1 }, operation: 'write' },
  result: { ok: true, details: { row: 3 } },
};

// Verifiers receive an isolated immutable copy; failed attempted mutation is
// fail-closed and never mutates the caller's action input/result.
let observedIsolatedContext = false;
const attemptedMutation = await service.verify(liveContext, (context) => {
  observedIsolatedContext = context !== liveContext && context.input !== liveContext.input;
  context.input.nested.value = 99;
  return { verified: true, basis: 'external-postcondition', confidence01: 0.99, observationId: 'obs-1' };
});
assert.equal(observedIsolatedContext, true);
assert.equal(attemptedMutation.verified, false);
assert.equal(liveContext.input.nested.value, 1);
assert.equal(liveContext.result.details.row, 3);

// A real independent receipt is normalized, bounded and retained.
const receipt = await service.verify(liveContext, (context) => ({
  verified: true,
  basis: 'external-postcondition',
  externalObservation: true,
  confidence01: 1.7,
  observationId: '  provider-receipt-129  ',
  expectedPostcondition: 'x'.repeat(5000),
  observedPostcondition: 'x'.repeat(5000),
  notes: ' verified externally ',
}));
assert.equal(receipt.verified, true);
assert.equal(receipt.basis, 'external-postcondition');
assert.equal(receipt.externalObservation, true);
assert.equal(receipt.confidence01, 1);
assert.equal(receipt.observationId, 'provider-receipt-129');
assert.equal(receipt.expectedPostcondition.length, 1024);
assert.equal(receipt.observedPostcondition.length, 1024);
assert.equal(receipt.notes, 'verified externally');

// External world evidence goes through the same bounded canonical normalizer as live observations.
const observedWorldContextAfter = await service.verify(liveContext, () => ({
  verified: true,
  basis: 'external-postcondition',
  externalObservation: true,
  confidence01: .8,
  observationId: 'world-observation-129',
  expectedPostcondition: 'world-context=observed',
  observedPostcondition: 'world-context=observed',
  observedWorldContextAfter: {
    tick: '17', location: ' lab '.repeat(90), energy: 4, attention: -1, uncertainty: 'bad',
    facts: Array.from({length: 220}, (_, i) => `fact-${i}`),
    events: Array.from({length: 100}, (_, i) => `event-${i}`),
    objects: Array.from({length: 160}, (_, i) => ({id:`object-${i}`,label:'sensor',value:2,visible:1,confidence01:3})),
    unexpected: 'must-not-cross-the-canonical-boundary',
  },
}));
assert.equal(observedWorldContextAfter.verified, true);
assert.equal(observedWorldContextAfter.observedWorldContextAfter.tick, 17);
assert.equal(observedWorldContextAfter.observedWorldContextAfter.energy, 1);
assert.equal(observedWorldContextAfter.observedWorldContextAfter.attention, 0);
assert.equal(observedWorldContextAfter.observedWorldContextAfter.uncertainty, 1, 'malformed uncertainty uses the safe fallback');
assert.equal(observedWorldContextAfter.observedWorldContextAfter.facts.length, 192);
assert.equal(observedWorldContextAfter.observedWorldContextAfter.events.length, 64);
assert.equal(observedWorldContextAfter.observedWorldContextAfter.objects.length, 128);
assert.equal(observedWorldContextAfter.observedWorldContextAfter.objects[0].value, 1);
assert.equal('unexpected' in observedWorldContextAfter.observedWorldContextAfter, false);
assert.ok(observedWorldContextAfter.observedWorldContextAfter.location.length <= 180);

// Whitespace IDs, missing bases and unsupported bases cannot produce success.
for (const candidate of [
  { verified: true, basis: 'external-postcondition', confidence01: 0.9, observationId: '  ' },
  { verified: true, basis: 'none', confidence01: 1, observationId: 'obs-2' },
  { verified: true, basis: 'invented-basis', confidence01: 1, observationId: 'obs-3' },
]) {
  const result = await service.verify(liveContext, () => candidate);
  assert.equal(result.verified, false);
  assert.equal(result.confidence01, 0);
  assert.equal(result.basis, 'none');
}

// Verifier errors and non-serializable live context cannot bubble into the
// action executor as false success or leave a partial verification receipt.
const thrown = await service.verify(liveContext, () => { throw new Error('token=secret'); });
assert.equal(thrown.verified, false);
assert.equal(thrown.notes, 'registered verifier failed before returning evidence');
assert.ok(!JSON.stringify(thrown).includes('secret'));
let invoked = false;
const unserializable = await service.verify({ toolId: 'x', input: { fn() {} }, result: {} }, () => {
  invoked = true;
  return { verified: true, basis: 'external-postcondition', confidence01: 1, observationId: 'x' };
});
assert.equal(invoked, false);
assert.equal(unserializable.verified, false);
assert.equal(unserializable.notes, 'verification context could not be isolated safely');

// The built-in tool-contract path remains compatible and is not mislabeled external.
const toolContract = await service.verify({ toolId: 'x', input: {}, result: { verified: true } });
assert.equal(toolContract.verified, true);
assert.equal(toolContract.basis, 'tool-contract');
assert.equal(toolContract.externalObservation, false);

// A verifier cannot relabel its own tool contract as independent world evidence.
const forgedExternalClaim = await service.verify(liveContext, () => ({
  verified: true, basis: 'tool-contract', confidence01: 1,
  externalObservation: true, observationId: 'self-asserted-ack',
}));
assert.equal(forgedExternalClaim.verified, false);
assert.equal(forgedExternalClaim.basis, 'none');
assert.equal(forgedExternalClaim.externalObservation, false);
assert.match(forgedExternalClaim.notes, /requires external-postcondition basis/);

const controlCharacterObservation = await service.verify(liveContext, () => ({
  verified: true, basis: 'external-postcondition', confidence01: .99,
  externalObservation: true, observationId: 'sensor-\u0000-id',
}));
assert.equal(controlCharacterObservation.verified, false, 'evidence IDs with control characters are not accepted');
assert.equal(controlCharacterObservation.externalObservation, false);

// Host-owned correlation IDs containing C0/C1 controls must be omitted from the
// isolated verifier context instead of being trusted or truncated into aliases.
let malformedCorrelationIdsDropped = false;
await service.verify({
  ...liveContext,
  executionId: 'execution-\u0000-id',
  decisionId: 'decision-\u009f-id',
}, (context) => {
  malformedCorrelationIdsDropped = !Object.hasOwn(context, 'executionId') && !Object.hasOwn(context, 'decisionId');
  return { verified: false, basis: 'none', confidence01: 0 };
});
assert.equal(malformedCorrelationIdsDropped, true, 'malformed execution/decision IDs must not cross the verifier boundary');

console.log('OUTCOME_VERIFICATION_CORRELATION_ID_SANITIZATION=PASS');
console.log('BIG_PASS_129_OUTCOME_VERIFICATION_HARDENING=PASS immutable-context evidence-normalization fail-closed-exception handling external-basis-enforcement');
