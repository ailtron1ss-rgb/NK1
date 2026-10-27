import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OutcomeVerificationService,
  isTrustedDecisionLinkedExternalPostcondition,
  isTrustedExternalPostconditionVerification,
} from '../src/organism/system/OutcomeVerificationService.ts';

const root = process.cwd();
const gatewaySource = readFileSync(resolve(root, 'src/organism/system/ActionGateway.ts'), 'utf8');
const serviceSource = readFileSync(resolve(root, 'src/organism/system/OutcomeVerificationService.ts'), 'utf8');
const coreSource = readFileSync(resolve(root, 'src/organism/core/OrganismCore.ts'), 'utf8');
assert.match(gatewaySource, /decisionLinkedExternalPostcondition/);
assert.match(coreSource, /gatewayDecisionLinkedExternalPostcondition === true/);
assert.match(coreSource, /trace\.tick === trace\.stateBefore\.tick/,
  'a valid ticket alone cannot stand in for the exact persisted selected decision trace');
assert.match(coreSource, /decisionLinkedExternalPostcondition \? options\.decisionId : undefined/,
  'observations without the exact join may be ingested, but cannot claim decision/temporal credit');
assert.match(gatewaySource, /isTrustedDecisionLinkedExternalPostcondition\(response\.verification,\s*\{\s*toolId:\s*id,\s*input,\s*executionId:\s*response\.executionId,\s*decisionId:\s*options\.decisionId/,
  'gateway verification must bind evidence to the exact response execution and decision tickets');
assert.match(serviceSource, /trustedExternalPostconditionResults\.get\(value as object\)/,
  'correlation must be anchored to the exact verifier-minted object');

const service = new OutcomeVerificationService();
const expected = {
  toolId: 'device.observe',
  input: { camera: 'front', sample: 1 },
  executionId: 'exec-0123456789abcdef',
  decisionId: 'decision:trace-42',
};
const verification = await service.verify({
  ...expected,
  result: { ok: true, observationId: 'obs-1' },
}, async context => {
  assert.equal(context.executionId, expected.executionId);
  assert.equal(context.decisionId, expected.decisionId);
  return {
    verified: true,
    basis: 'external-postcondition',
    confidence01: 0.98,
    externalObservation: true,
    observationId: 'obs-1',
    expectedPostcondition: 'fresh scene observed',
    observedPostcondition: 'fresh scene observed',
  };
});

assert.equal(isTrustedExternalPostconditionVerification(verification, expected.input), true);
assert.equal(isTrustedDecisionLinkedExternalPostcondition(verification, expected), true);
assert.equal(isTrustedDecisionLinkedExternalPostcondition(verification, { ...expected, executionId: 'exec-ffffffffffffffff' }), false,
  'a valid observation cannot be replayed under a different execution ID');
assert.equal(isTrustedDecisionLinkedExternalPostcondition(verification, { ...expected, decisionId: 'decision:other-trace' }), false,
  'a valid observation cannot be rebound to another decision');
assert.equal(isTrustedDecisionLinkedExternalPostcondition(verification, { ...expected, toolId: 'device.write' }), false,
  'verification is bound to the canonical tool identity');
assert.equal(isTrustedDecisionLinkedExternalPostcondition(verification, { ...expected, input: { camera: 'back', sample: 1 } }), false,
  'verification is bound to the complete exact input');
assert.equal(isTrustedDecisionLinkedExternalPostcondition({ ...verification }, expected), false,
  'a copied/persisted JSON object loses its process-local verifier authority');
assert.equal(isTrustedDecisionLinkedExternalPostcondition(verification, {
  toolId: expected.toolId, input: expected.input, executionId: expected.executionId, decisionId: '',
}), false, 'missing decision lineage fails closed');

const missingLineage = await service.verify({
  toolId: expected.toolId,
  input: expected.input,
  result: { ok: true },
}, async () => ({
  verified: true,
  basis: 'external-postcondition',
  confidence01: 0.98,
  externalObservation: true,
  observationId: 'obs-2',
  expectedPostcondition: 'fresh scene observed',
  observedPostcondition: 'fresh scene observed',
}));
assert.equal(isTrustedDecisionLinkedExternalPostcondition(missingLineage, expected), false,
  'a receipt with no host action ticket must never bind itself to a decision');

const overlongDecision = 'd'.repeat(181);
const malformed = await service.verify({
  ...expected,
  decisionId: overlongDecision,
  result: { ok: true },
}, async () => ({
  verified: true,
  basis: 'external-postcondition',
  confidence01: 0.98,
  externalObservation: true,
  observationId: 'obs-3',
  expectedPostcondition: 'fresh scene observed',
  observedPostcondition: 'fresh scene observed',
}));
assert.equal(isTrustedDecisionLinkedExternalPostcondition(malformed, {
  ...expected,
  decisionId: overlongDecision.slice(0, 180),
}), false, 'truncation must not alias an overlong decision ID to a different valid ticket');

const controlBearing = await service.verify({
  ...expected,
  decisionId: 'decision:trace-42\\nforged',
  result: { ok: true },
}, async () => ({
  verified: true,
  basis: 'external-postcondition',
  confidence01: 0.98,
  externalObservation: true,
  observationId: 'obs-4',
  expectedPostcondition: 'fresh scene observed',
  observedPostcondition: 'fresh scene observed',
}));
assert.equal(isTrustedDecisionLinkedExternalPostcondition(controlBearing, {
  ...expected,
  decisionId: 'decision:trace-42',
}), false, 'control-bearing IDs must not be normalized into a valid ticket');

console.log(JSON.stringify({
  ok: true,
  exactVerificationIdentity: true,
  correlationDimensions: ['toolId', 'exact input', 'executionId', 'decisionId'],
  replayAndMutationCases: 6,
}));
