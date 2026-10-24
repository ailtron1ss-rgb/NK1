import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OutcomeVerificationService,
  isTrustedDecisionLinkedExternalPostcondition,
  isTrustedExternalPostconditionVerification,
} from '../src/organism/system/OutcomeVerificationService.ts';
import { OutcomeCognitionFabric } from '../src/organism/system/OutcomeCognitionFabric.ts';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';

const root = process.cwd();
const projectedEvidenceIdForObserver = value => value;
const gatewaySource = readFileSync(resolve(root, 'src/organism/system/ActionGateway.ts'), 'utf8');
const serviceSource = readFileSync(resolve(root, 'src/organism/system/OutcomeVerificationService.ts'), 'utf8');
const coreSource = readFileSync(resolve(root, 'src/organism/core/OrganismCore.ts'), 'utf8');
assert.match(gatewaySource, /decisionLinkedExternalPostcondition/);
assert.match(coreSource, /gatewayDecisionLinkedExternalPostcondition === true/);
assert.match(coreSource, /trace\.tick === trace\.stateBefore\.tick/,
  'a valid ticket alone cannot stand in for the exact persisted selected decision trace');
assert.match(coreSource, /decisionLinkedExternalPostcondition \? options\.decisionId : undefined/,
  'observations without the exact join may be ingested, but cannot claim decision/temporal credit');
assert.match(gatewaySource, /executionId,\s*\.\.\.\(?(?:typeof context\.decisionId|typeof prior\.decisionId)/,
  'gateway verification must carry the action execution and decision tickets');
assert.match(coreSource, /const trustedEventLink = Boolean\(decisionLinkedExternalPostcondition && actionInput && linkedDecisionId/,
  'event ID propagation requires the trusted decision/input binding, not just a caller string');
assert.match(coreSource, /const evidenceEventId = trustedEventLink && typeof v\.evidenceEventId === 'string' \? v\.evidenceEventId : undefined/,
  'only a freshly trusted verifier result may pass its event key into the canonical observer');
assert.match(coreSource, /this\.integrateVerifiedToolObservation\(id, result, options, false, decisionLinkedExternalPostcondition, input\)/,
  'the canonical full action input is rebound to the exact verification before the event key is admitted');
assert.match(coreSource, /this\.evidenceResearchSubsystem\.externalObserver\.snapshot\(\)/,
  'the event enters the existing canonical external-observation owner rather than a parallel evidence store');
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
assert.match(verification.evidenceEventId ?? '', /^outcome:[a-f0-9]{40}$/,
  'verified external evidence with exact gateway IDs should expose a stable shared event key');
const replayedVerification = await service.verify({
  ...expected, result: { ok: true, observationId: 'obs-1' },
}, async () => ({
  verified: true, basis: 'external-postcondition', confidence01: 0.98,
  externalObservation: true, observationId: 'obs-1',
  expectedPostcondition: 'fresh scene observed', observedPostcondition: 'fresh scene observed',
}));
assert.equal(replayedVerification.evidenceEventId, verification.evidenceEventId,
  'same exact execution/decision/input/observation produces the same cross-consumer event ID');
const alternateDecision = await service.verify({
  ...expected, decisionId: 'decision:other-trace', result: { ok: true, observationId: 'obs-1' },
}, async () => ({
  verified: true, basis: 'external-postcondition', confidence01: 0.98,
  externalObservation: true, observationId: 'obs-1',
  expectedPostcondition: 'fresh scene observed', observedPostcondition: 'fresh scene observed',
}));
assert.notEqual(alternateDecision.evidenceEventId, verification.evidenceEventId,
  'the same sensor observation cannot be rebound to another decision identity');

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
assert.equal(missingLineage.evidenceEventId, undefined,
  'an external observation without the exact host execution/decision join cannot mint a shared event ID');

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


// Exercise the real verifier-to-causal-projection seam with the verifier-minted object,
// not a hand-constructed receipt. The event key joins systems; it does not elevate trust.
const verifierToFabric = new OutcomeCognitionFabric();
const verifierProjection = verifierToFabric.project({
  tick: 11,
  tool: expected.toolId,
  ok: true,
  executionId: expected.executionId,
  verification,
});
assert.equal(verifierProjection.verificationRecord.evidenceEventId, verification.evidenceEventId,
  'the real verifier event identity must survive entry into the canonical causal outcome projection');
assert.equal(verifierProjection.verifiedExternal, true,
  'the verifier-to-projection seam should retain the independently verified external postcondition');

// Exercise the real observer's identity-based deduplication with the verifier-minted key.
// The observer remains the owner of observations; this test does not imply the ledger is
// automatically populated by every production observer call.
const crossSubsystemObserver = new ExternalObserverFabric();
const observedOnce = crossSubsystemObserver.observe({
  sourceId: 'camera-front',
  sourceClass: 'device',
  channel: 'camera',
  claimKey: 'scene:freshness',
  observedPostcondition: 'fresh scene observed',
  confidence01: 0.98,
  observedAt: 1000,
  actionRef: expected.executionId,
  tool: expected.toolId,
  tick: 11,
  independenceKey: 'observation:obs-1',
  evidenceEventId: projectedEvidenceIdForObserver(verification.evidenceEventId),
  payload: { observationId: 'obs-1', scene: 'fresh' },
});
const observedReplay = crossSubsystemObserver.observe({
  sourceId: 'camera-front',
  sourceClass: 'device',
  channel: 'camera',
  claimKey: 'scene:freshness',
  observedPostcondition: 'fresh scene observed',
  confidence01: 0.98,
  observedAt: 1000,
  actionRef: expected.executionId,
  tool: expected.toolId,
  tick: 11,
  independenceKey: 'observation:obs-1',
  evidenceEventId: projectedEvidenceIdForObserver(verification.evidenceEventId),
  payload: { observationId: 'obs-1', scene: 'fresh' },
});
assert.equal(observedReplay.id, observedOnce.id,
  'the observer must deduplicate the same verifier event on an exact replay');
assert.equal(crossSubsystemObserver.snapshot().totalObservations, 1,
  'an exact verifier-event replay must not inflate observer counts');

// Carry that same verifier-minted event identity into the canonical reality ledger.
// Replays must be idempotent across consumers; the shared ID does not manufacture trust.
const crossSubsystemLedger = new RealityEvidenceLedger();
const projectedEvidenceId = verifierProjection.verificationRecord.evidenceEventId;
assert.ok(projectedEvidenceId, 'the verified projection should expose its bounded cross-subsystem event identity');
const ledgerEvidence = crossSubsystemLedger.record({
  eventId: projectedEvidenceId,
  tick: 11,
  at: 1000,
  realityClass: 'external-observation',
  claim: 'fresh scene observed',
  confidence01: 0.98,
  independenceKey: 'observation:obs-1',
  parentIds: [expected.executionId, expected.decisionId],
});
const ledgerReplay = crossSubsystemLedger.record({
  eventId: projectedEvidenceId,
  tick: 11,
  at: 2000,
  realityClass: 'external-observation',
  claim: 'fresh scene observed',
  confidence01: 0.98,
  independenceKey: 'observation:obs-1',
  parentIds: [expected.executionId, expected.decisionId],
});
assert.equal(ledgerReplay.id, ledgerEvidence.id,
  'the verifier-to-ledger handoff must deduplicate the exact same evidence event across retries');
assert.equal(crossSubsystemLedger.snapshot().total, 1,
  'cross-subsystem retry must not inflate the reality evidence count');
assert.equal(crossSubsystemLedger.claimAssessment('fresh scene observed').promotionAllowed, true,
  'the correlated external observation should remain assessable by the existing grounding policy');

const fabric = new OutcomeCognitionFabric();
const eventKey = 'outcome:' + 'a'.repeat(40);
const projected = fabric.project({
  tick: 12,
  tool: expected.toolId,
  ok: true,
  executionId: expected.executionId,
  verification: {
    verified: true, basis: 'external-postcondition', confidence01: 0.98,
    externalObservation: true, observationId: 'obs-1',
    evidenceEventId: eventKey,
    expectedPostcondition: 'fresh scene observed',
    observedPostcondition: 'fresh scene observed',
  },
});
assert.equal(projected.verificationRecord.evidenceEventId, eventKey,
  'the canonical outcome projection must preserve the verifier event key');
const restoredFabric = new OutcomeCognitionFabric();
restoredFabric.restore(fabric.snapshot());
const replayedProjection = restoredFabric.project({
  tick: 12,
  tool: expected.toolId,
  ok: true,
  executionId: expected.executionId,
  verification: {
    verified: true, basis: 'external-postcondition', confidence01: 0.98,
    externalObservation: true, observationId: 'obs-1',
    evidenceEventId: eventKey,
    expectedPostcondition: 'fresh scene observed',
    observedPostcondition: 'fresh scene observed',
  },
});
assert.equal(replayedProjection.verificationRecord.evidenceEventId, eventKey,
  'event identity must survive snapshot/restart and exact replay');
assert.throws(() => restoredFabric.project({
  tick: 12,
  tool: expected.toolId,
  ok: true,
  executionId: expected.executionId,
  verification: {
    verified: true, basis: 'external-postcondition', confidence01: 0.98,
    externalObservation: true, observationId: 'obs-1',
    evidenceEventId: 'outcome:' + 'b'.repeat(40),
    expectedPostcondition: 'fresh scene observed',
    observedPostcondition: 'fresh scene observed',
  },
}), /outcome-execution-id-conflict/,
  'one execution cannot be rebound to a different evidence event key');
const malformedEvent = fabric.project({
  tick: 13,
  tool: expected.toolId,
  ok: true,
  executionId: 'exec-abcdef0123456789',
  verification: {
    verified: true, basis: 'external-postcondition', confidence01: 0.98,
    externalObservation: true, observationId: 'obs-2',
    evidenceEventId: 'outcome:not-a-digest',
    expectedPostcondition: 'fresh scene observed',
    observedPostcondition: 'fresh scene observed',
  },
});
assert.equal(malformedEvent.verificationRecord.evidenceEventId, undefined,
  'malformed event keys must not enter the causal projection');

console.log(JSON.stringify({
  ok: true,
  exactVerificationIdentity: true,
  correlationDimensions: ['toolId', 'exact input', 'executionId', 'decisionId'],
  replayAndMutationCases: 6,
}));
