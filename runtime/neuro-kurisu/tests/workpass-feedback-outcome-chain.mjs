import assert from 'node:assert/strict';
import { OutcomeVerificationService, isTrustedDecisionLinkedExternalPostcondition } from '../src/organism/system/OutcomeVerificationService.ts';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';

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
console.log('NK1_FEEDBACK_OUTCOME_CHAIN=PASS verifierBoundId=true actionDecisionInputBound=true stableReplay=true sharedLedgerOwner=true conflictRejected=true restoreNoInflation=true');
