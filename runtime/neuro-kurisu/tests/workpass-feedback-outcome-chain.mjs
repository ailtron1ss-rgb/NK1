import assert from 'node:assert/strict';
import { OutcomeVerificationService, isTrustedDecisionLinkedExternalPostcondition } from '../src/organism/system/OutcomeVerificationService.ts';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';
import { OutcomeCognitionFabric } from '../src/organism/system/OutcomeCognitionFabric.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const expected = {
  toolId: 'device.set-state',
  input: { device: 'front-door', state: 'open', request: { source: 'autonomous-cycle', generation: 3 } },
  executionId: 'exec-0123456789abcdef',
  decisionId: 'decision:trace-42',
};
const service = new OutcomeVerificationService();
const verification = await service.verify({
  ...expected,
  result: { accepted: true, observationId: 'obs-door-17' },
}, async context => {
  assert.equal(context.toolId, expected.toolId);
  assert.equal(context.executionId, expected.executionId);
  assert.equal(context.decisionId, expected.decisionId);
  assert.deepEqual(context.input, expected.input);
  return {
    verified: true,
    basis: 'external-postcondition',
    confidence01: 0.96,
    externalObservation: true,
    observationId: 'obs-door-17',
    expectedPostcondition: 'door=open',
    observedPostcondition: 'door=open',
  };
});
assert.equal(isTrustedDecisionLinkedExternalPostcondition(verification, expected), true);
assert.match(verification.evidenceEventId ?? '', /^outcome:[a-f0-9]{40}$/);
assert.equal(
  isTrustedDecisionLinkedExternalPostcondition(verification, { ...expected, input: { device: 'front-door', state: 'closed' } }),
  false,
  'a trusted event ID must not authorize a partial or changed action input',
);
assert.equal(
  isTrustedDecisionLinkedExternalPostcondition(verification, { ...expected, decisionId: 'decision:other-trace' }),
  false,
  'a trusted event ID cannot be rebound to a different decision',
);

const sameTupleService = new OutcomeVerificationService();
const sameTuple = await sameTupleService.verify({
  ...expected,
  result: { accepted: true, observationId: 'obs-door-17' },
}, async () => ({
  verified: true, basis: 'external-postcondition', confidence01: 0.96,
  externalObservation: true, observationId: 'obs-door-17',
  expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
}));
assert.equal(sameTuple.evidenceEventId, verification.evidenceEventId, 'same tuple must produce a reproducible identity');
const changedDecision = await sameTupleService.verify({
  ...expected, decisionId: 'decision:other-trace', result: { accepted: true },
}, async () => ({
  verified: true, basis: 'external-postcondition', confidence01: 0.96,
  externalObservation: true, observationId: 'obs-door-17',
  expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
}));
assert.notEqual(changedDecision.evidenceEventId, verification.evidenceEventId, 'different decision must produce a different identity');
const unlinked = await sameTupleService.verify({
  toolId: expected.toolId, input: expected.input, result: { accepted: true, observationId: 'obs-no-ticket' },
}, async () => ({
  verified: true, basis: 'external-postcondition', confidence01: 0.96,
  externalObservation: true, observationId: 'obs-no-ticket',
  expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
}));
assert.equal(unlinked.evidenceEventId, undefined, 'external observations without both host-owned tickets do not get a join ID');

const authorizeSourceRegistration = source =>
  source.id === 'door.sensor.front' &&
  source.sourceClass === 'device' &&
  source.channel === 'sensor' &&
  source.independenceKey === 'sensor:front-door';
const system = new OrganismSystemFabric({ authorizeSourceRegistration });
const ledger = system.governance.realityEvidenceLedger;
const research = system.research;
assert.equal(research.realityEvidenceLedger, ledger, 'the observer and governance use one canonical reality-evidence ledger');
const source = {
  id: 'door.sensor.front',
  sourceClass: 'device',
  channel: 'sensor',
  independenceKey: 'sensor:front-door',
};
research.externalObserver.registerSource(source);
const eventInput = {
  sourceId: source.id,
  sourceClass: source.sourceClass,
  channel: source.channel,
  independenceKey: source.independenceKey,
  claimKey: 'front-door-state',
  observedPostcondition: 'door=open',
  facts: ['door=open'],
  confidence01: verification.confidence01,
  observedAt: 1_798_000_000_000,
  actionRef: expected.executionId,
  tool: expected.toolId,
  tick: 7,
  decisionId: expected.decisionId,
  evidenceEventId: verification.evidenceEventId,
  metadata: { verificationBasis: verification.basis, observationId: verification.observationId },
};
const observed = research.externalObserver.observe(eventInput);
assert.equal(observed.evidenceEventId, verification.evidenceEventId);
assert.equal(ledger.findByEventId(verification.evidenceEventId)?.eventId, verification.evidenceEventId,
  'observer output must be written into the same canonical ledger');

// Preserve the same verifier evidence identity in the cognitive outcome projection.
const outcomeCognition = new OutcomeCognitionFabric();
const originalProjection = outcomeCognition.project({
  tick: 7, tool: expected.toolId, ok: true, verification,
  executionId: expected.executionId, outcomeClass: 'executed-verified',
});
assert.equal(originalProjection.verifiedExternal, true);
const outcomeInput = {
  tick: 7, executionId: expected.executionId, tool: expected.toolId,
  observationId: observed.id, evidenceEventId: verification.evidenceEventId,
  verified: true, confidence01: 0.96,
  expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
  assessment: 'match', sourceId: source.id, sourceClass: 'device',
  independenceKey: source.independenceKey,
};
const resolvedOutcome = outcomeCognition.resolveExternalObservation(outcomeInput);
assert.equal(resolvedOutcome.resolved, true);
assert.equal(resolvedOutcome.record.externalObservations?.[0]?.evidenceEventId, verification.evidenceEventId,
  'the cognitive outcome projection must retain the exact evidence event ID');
const replayedOutcome = outcomeCognition.resolveExternalObservation(outcomeInput);
assert.equal(replayedOutcome.resolved, true);
assert.equal(replayedOutcome.replayed, true, 'same outcome evidence must replay idempotently');
const conflictingOutcome = outcomeCognition.resolveExternalObservation({
  ...outcomeInput, evidenceEventId: `outcome:${'a'.repeat(40)}`,
});
assert.equal(conflictingOutcome.resolved, false, 'same observation cannot be rebound to a different verifier identity');
assert.equal(conflictingOutcome.reason, 'observation-replay-conflict');
const malformedOutcome = outcomeCognition.resolveExternalObservation({
  ...outcomeInput, evidenceEventId: 'forged:identity',
});
assert.equal(malformedOutcome.resolved, false, 'malformed evidence identities cannot be accepted by outcome projection');
assert.equal(malformedOutcome.reason, 'evidence-event-id-invalid');
const malformedPersistedOutcome = new OutcomeCognitionFabric();
malformedPersistedOutcome.restore({
  version: 1,
  records: [{
    at: 1, tick: 1, tool: expected.toolId, ok: true, verified: true,
    basis: 'external-postcondition', confidence01: 0.96, observationId: observed.id,
    externalObservation: true, executionId: expected.executionId,
    externalObservations: [{
      observationId: observed.id, evidenceEventId: 'forged:identity', verified: true,
      confidence01: 0.96, at: 1, expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
    }],
  }],
  projectionIndex: [], evidenceRevisions: [],
});
assert.equal(malformedPersistedOutcome.snapshot().records.length, 0,
  'persisted outcome projections with forged evidence identity must be discarded');

// Carry the same verifier-owned identity into a receipt-indexed causal event trace.
const cef = new CognitiveEventFabric();
cef.append({
  id: expected.decisionId, tick: 7, stage: 'goal', source: 'decision-trace',
  external: false, confidence01: 1, payload: { decisionId: expected.decisionId },
});
const receiptTrace = cef.appendToolReceiptTrace({
  tick: 7, executionId: expected.executionId, toolId: expected.toolId,
  decisionId: expected.decisionId, ok: true, verified: true,
  outcomeClass: 'executed-verified', confidence01: 0.96,
  verificationBasis: 'external-postcondition', externalObservation: true,
  observationId: observed.id, expectedPostcondition: 'door=open',
  observedPostcondition: 'door=open', observationIntegrated: true,
});
assert.equal(receiptTrace.replayed, false);
const cefInput = {
  tick: 7, executionId: expected.executionId, toolId: expected.toolId,
  observationId: observed.id, evidenceEventId: verification.evidenceEventId,
  verified: true, confidence01: 0.96, sourceId: source.id,
  sourceClass: source.sourceClass, channel: source.channel, independenceKey: source.independenceKey,
  expectedPostcondition: 'door=open', observedPostcondition: 'door=open',
};
const cefFirst = cef.appendToolExternalObservation(cefInput);
assert.equal(cefFirst.resolved, true);
const cefSnapshot = cef.snapshot();
const cefEvidence = cefSnapshot.recent.find(event => event.id === cefFirst.eventId);
assert.equal(cefEvidence?.stage, 'external-evidence');
assert.equal(cefEvidence?.payload.evidenceEventId, verification.evidenceEventId,
  'CEF must retain the exact verifier identity, not only the observer ID');
const cefRef = cefSnapshot.receiptProjectionIndex?.find(entry => entry.executionId === expected.executionId)?.externalObservations?.find(ref => ref.observationId === observed.id);
assert.equal(cefRef?.evidenceEventId, verification.evidenceEventId,
  'the bounded CEF receipt index must retain the verifier identity');

const restoredCef = new CognitiveEventFabric();
restoredCef.restore(cefSnapshot);
const restoredCefRef = restoredCef.snapshot().receiptProjectionIndex?.find(entry => entry.executionId === expected.executionId)?.externalObservations?.find(ref => ref.observationId === observed.id);
assert.equal(restoredCefRef?.evidenceEventId, verification.evidenceEventId,
  'CEF restore must preserve the external evidence identity only when it matches the event payload');
const restoredCefEvent = restoredCef.snapshot().recent.find(event => event.id === cefFirst.eventId);
assert.equal(restoredCefEvent?.payload.evidenceEventId, verification.evidenceEventId);
const cefReplay = restoredCef.appendToolExternalObservation(cefInput);
assert.equal(cefReplay.resolved, true);
assert.equal(cefReplay.replayed, true, 're-delivery after restore must remain idempotent');
assert.equal(cefReplay.eventId, cefFirst.eventId);
assert.throws(() => restoredCef.appendToolExternalObservation({
  ...cefInput, evidenceEventId: `outcome:${'b'.repeat(40)}`,
}), /external-observation-projection-conflict/,
  'CEF must reject rebinding an observation to another verifier identity');
const invalidCef = restoredCef.appendToolExternalObservation({
  ...cefInput, observationId: 'obs-invalid-event-id', evidenceEventId: 'forged:identity',
});
assert.equal(invalidCef.resolved, false);
assert.equal(invalidCef.reason, 'evidence-event-id-invalid');

const coreRuntime = (await import('node:fs')).readFileSync(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
assert.match(coreRuntime, /appendToolExternalObservation\(\{[\s\S]{0,350}evidenceEventId: observation\.evidenceEventId/,
  'Core must pass the verifier identity into CEF projection');

const totalAfterFirst = ledger.snapshot().total;
const replayed = research.externalObserver.observe(eventInput);
assert.equal(replayed.id, observed.id);
assert.equal(ledger.snapshot().total, totalAfterFirst, 'replayed verifier identity must not inflate the ledger');
assert.throws(() => research.externalObserver.observe({
  ...eventInput, observedPostcondition: 'door=closed', facts: ['door=closed'],
}), /external-observer-evidence-event-identity-conflict/,
  'a stable verifier identity cannot be reused for a contradictory payload');
assert.equal(ledger.snapshot().total, totalAfterFirst, 'a conflicted observation must not create evidence');

const subsystemSnapshot = research.snapshot();
const restored = new OrganismSystemFabric({ authorizeSourceRegistration });
restored.restoreFromPersisted({
  system: {
    externalObserver: subsystemSnapshot.externalObserver,
    realityEvidenceLedger: subsystemSnapshot.realityEvidenceLedger,
  },
});
assert.equal(restored.research.realityEvidenceLedger, restored.governance.realityEvidenceLedger);
assert.equal(restored.governance.realityEvidenceLedger.snapshot().total, totalAfterFirst,
  'observer replay after restoration must not inflate the canonical evidence ledger');
assert.equal(restored.governance.realityEvidenceLedger.findByEventId(verification.evidenceEventId)?.claim, 'door=open');

const core = (await import('node:fs')).readFileSync(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
assert.match(core, /isDeclaredObservationSource\(\{/,
  'Core must authorize source registration through the ActionGateway registry');
assert.match(core, /actionInput\?: Record<string, unknown>/);
assert.match(core, /evidenceEventId\?: string/);
assert.match(core, /evidenceEventId,/);
assert.match(core, /external-observation-evidence-event-identity-not-verifier-bound/,
  'the public Core boundary must reject a caller-supplied verifier identity without the original verifier binding');
assert.match(core, /isTrustedDecisionLinkedExternalPostcondition\(binding\.verification/,
  'event identity acceptance must be rechecked against the exact verifier-owned object');

const { OrganismCore } = await import('../src/organism/core/OrganismCore.ts');
const publicBoundary = Object.create(OrganismCore.prototype);
Object.defineProperty(publicBoundary, 'ready', { value: true, configurable: true });
Object.defineProperty(publicBoundary, 'evidenceResearchSubsystem', {
  value: { externalObserver: {} }, configurable: true,
});
await assert.rejects(
  OrganismCore.prototype.ingestExternalObservation.call(publicBoundary, {
    sourceId: source.id, sourceClass: source.sourceClass, channel: source.channel,
    independenceKey: source.independenceKey, claimKey: 'caller-forged-claim',
    observedPostcondition: 'door=open', confidence01: 0.99, actionRef: expected.executionId,
    decisionId: expected.decisionId, evidenceEventId: verification.evidenceEventId,
  }, { checkpoint: false }),
  /external-observation-evidence-event-identity-not-verifier-bound/,
  'public ingestion must reject an ID copied from a valid receipt when the original verifier object is not bound',
);
console.log('NK1_FEEDBACK_OUTCOME_CHAIN=PASS verifierBoundId=true actionDecisionInputBound=true stableReplay=true sharedLedgerOwner=true conflictRejected=true restoreNoInflation=true');
