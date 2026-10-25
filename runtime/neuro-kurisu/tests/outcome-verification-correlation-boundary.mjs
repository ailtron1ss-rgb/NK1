import assert from 'node:assert/strict';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const service = new OutcomeVerificationService();
let observedContext;
const verifier = async context => {
  observedContext = context;
  return { verified: true, basis: 'tool-contract', confidence01: 0.9, externalObservation: false };
};

const valid = await service.verify({
  toolId: 'fixture.correlation-boundary',
  input: { value: 1 },
  result: { ok: true },
  executionId: 'exec-123456789',
  decisionId: 'decision-123',
}, verifier);
assert.equal(valid.verified, true, 'well-formed tool-contract evidence remains usable');
assert.equal(observedContext.executionId, 'exec-123456789', 'valid execution identity must survive context isolation');
assert.equal(observedContext.decisionId, 'decision-123', 'valid decision identity must survive context isolation');

const normalized = await service.verify({
  toolId: 'fixture.correlation-boundary',
  input: { value: 1.5 },
  result: { ok: true },
  executionId: 'ｅｘｅｃ-１２３４５６７８９',
  decisionId: 'ｄｅｃｉｓｉｏｎ-１２３',
}, verifier);
assert.equal(normalized.verified, true);
assert.equal(observedContext.executionId, 'exec-123456789',
  'NFKC normalization must happen before validating the execution identifier');
assert.equal(observedContext.decisionId, 'decision-123',
  'NFKC normalization must produce a canonical decision identity');

const badDecision = await service.verify({
  toolId: 'fixture.correlation-boundary',
  input: { value: 2 },
  result: { ok: true },
  executionId: 'exec-123456789',
  decisionId: 'decision-\u0000-injected',
}, verifier);
assert.equal(badDecision.verified, true, 'invalid optional correlation metadata must not corrupt safe verification');
assert.equal(Object.hasOwn(observedContext, 'decisionId'), false,
  'a decision ID containing a control character must be omitted instead of propagated');

const badExecution = await service.verify({
  toolId: 'fixture.correlation-boundary',
  input: { value: 3 },
  result: { ok: true },
  executionId: 'exec-123456789\u001b',
  decisionId: 'decision-safe',
}, verifier);
assert.equal(badExecution.verified, true, 'invalid execution metadata does not invalidate independent tool-contract checks');
assert.equal(Object.hasOwn(observedContext, 'executionId'), false,
  'an execution ID containing a control character must be omitted instead of propagated');
assert.equal(observedContext.decisionId, 'decision-safe');

const oversized = await service.verify({
  toolId: 'fixture.correlation-boundary',
  input: { value: 4 },
  result: { ok: true },
  executionId: 'exec-' + 'a'.repeat(110),
  decisionId: 'd'.repeat(181),
}, verifier);
assert.equal(oversized.verified, true, 'oversized optional metadata must not break independent tool-contract verification');
assert.equal(Object.hasOwn(observedContext, 'executionId'), false, 'oversized execution identifiers must be omitted');
assert.equal(Object.hasOwn(observedContext, 'decisionId'), false, 'oversized decision identifiers must be omitted');

console.log('OUTCOME_VERIFICATION_CORRELATION_BOUNDARY=PASS validIdsPreserved=true controlBearingIdsDropped=true oversizedIdsDropped=true');
