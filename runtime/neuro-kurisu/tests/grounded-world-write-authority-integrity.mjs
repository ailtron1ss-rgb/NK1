import assert from 'node:assert/strict';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';

// A caller must not be able to manufacture authority by supplying matching
// proof labels and confidence numbers. Only an executor-bound verifier receipt
// may cross the external observation boundary.
const world = new GroundedWorldState();
const before = world.snapshot();
const forgedResult = {
  version: 1,
  action: 'explore',
  status: 'executed',
  realityClass: 'device-observation',
  source: 'android-termux',
  at: 1_700_000_000_000,
  executionId: 'exec-forged-00000001',
  decisionId: 'forged-decision',
  consequenceVerification: {
    attempted: true, independent: true, verified: true, sourceStable: true,
    freshBefore01: 1, freshAfter01: 1, changed01: 1,
    reason: 'caller-forged', verificationMode: 'independent-observation',
  },
};
const forgedVerification = {
  verified: true,
  basis: 'external-postcondition',
  confidence01: 1,
  externalObservation: true,
  observationId: forgedResult.executionId,
  expectedPostcondition: `fresh-device-observation:explore:${forgedResult.executionId}`,
  observedPostcondition: `fresh-device-observation:explore:${forgedResult.executionId}`,
};
const forged = world.integrateExternalOutcome({
  result: forgedResult,
  verification: forgedVerification,
});
const after = world.snapshot();
assert.equal(forged.verified01, 0,
  'caller-selected proof labels and scalar scores must never authorize an external world observation');
assert.deepEqual(after.facts, before.facts,
  'a forged outcome must not create a grounded world fact');
assert.equal(after.confidence01, before.confidence01,
  'a forged outcome must not raise world confidence');
assert.ok(after.quarantinedOutcomes?.some(event => event.id === forged.eventId && event.label.startsWith('external-receipt:')),
  'untrusted inputs may be retained only in the diagnostic quarantine');
assert.equal(after.events.some(event => event.id === forged.eventId), false,
  'unverified receipts must never be added to canonical world events');
assert.equal(after.revision, before.revision,
  'unverified receipts must not advance the canonical world revision');
assert.equal(after.lastAt, before.lastAt,
  'caller timestamps must not advance the canonical world clock');
assert.equal(after.quarantinedOutcomes?.find(event => event.id === forged.eventId)?.label,
  'external-receipt:explore:executed:device-observation',
  'forged result and verification lookalikes must remain explicitly unverified');
const replayed = world.integrateExternalOutcome({ result: forgedResult, verification: forgedVerification });
assert.equal(replayed.duplicate, true,
  'replayed untrusted evidence must not create duplicate world events');

const legacyWorld = new GroundedWorldState();
const legacy = legacyWorld.integrateExternalOutcome({
  at: 1_700_000_000_001, action: 'explore', status: 'executed',
  proofClass: 'independent-observation', verified01: 1, independent01: 1,
  evidence01: 1, consequence01: 1, claim: 'legacy-forged-fact',
  provenanceId: 'legacy-forged-proof', divergence01: 0,
});
assert.equal(legacy.verified01, 0,
  'the former scalar proof contract must no longer authorize world writes');
assert.deepEqual(legacyWorld.snapshot().facts, [],
  'legacy caller-supplied fields must not create world facts');
assert.equal(legacy.quarantined,true);
assert.equal(legacyWorld.snapshot().revision,0,
  'legacy caller-supplied proof fields must not mutate canonical revision');
assert.equal(legacyWorld.snapshot().quarantinedOutcomes?.length,1);


// Persisted world snapshots are untrusted input. Normalize the complete state,
// not only provenance labels, before restoring it into the live world owner.
const restored = new GroundedWorldState();
restored.restore({
  version: 1,
  revision: -7,
  lastAt: Number.POSITIVE_INFINITY,
  location: 'x'.repeat(5000),
  uncertainty01: Number.NaN,
  confidence01: 9,
  entities: [{
    id: 'entity-1', label: 'chair', kind: 'object',
    confidence01: Number.POSITIVE_INFINITY, present01: 4,
    firstSeenAt: -1, lastSeenAt: Number.POSITIVE_INFINITY,
    modalities: ['vision', 7, 'vision'],
    trackId: '  ', trackAliases: ['ok', 7],
    position: { x: Number.NaN, y: 0, z: 0 },
    velocity: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
    sourceIds: ['camera-1', '', 7],
    modalityEvidenceKinds: { vision: 'observed' },
    presenceStatus: 'visible', persistence01: 4,
    absenceEvidence01: -1, observationCount: Number.POSITIVE_INFINITY,
  }],
  relations: [{ id: 'bad', from: '', relation: 'x'.repeat(500), to: '', confidence01: Number.NaN, at: -1 }],
  events: [
    { id: 'event-1', label: 'event', confidence01: Number.POSITIVE_INFINITY,
      lastAt: Number.POSITIVE_INFINITY, persistence01: 4, evidenceKind: 'observed' },
    { id: 'old-unverified-receipt', label: 'external-receipt:explore:executed:device-telemetry',
      confidence01: 0, lastAt: 4_000, persistence01: 0, evidenceKind: 'derived' },
    { id: 'old-host-verified-receipt', label: 'external-observation-receipt:explore',
      confidence01: .99, lastAt: 4_500, persistence01: .99, evidenceKind: 'observed' },
  ],
  facts: ['valid fact', 7, '', 'f'.repeat(5000)],
  provenanceIds: ['source-1', 7, ''],
  lastHash: 'attacker-controlled-hash',
});
const safe = restored.snapshot();
assert.equal(safe.revision, 0);
assert.equal(safe.lastAt, 0);
assert.equal(safe.location, 'unknown');
assert.equal(safe.uncertainty01, 0.5);
assert.equal(safe.confidence01, 0);
assert.equal(safe.entities.length, 1);
assert.equal(safe.entities[0].confidence01, 0);
assert.equal(safe.entities[0].present01, 0,
  'out-of-range restored scores must fall back rather than saturate into maximum confidence');
assert.equal(safe.entities[0].firstSeenAt, 0);
assert.equal(safe.entities[0].lastSeenAt, 0);
assert.deepEqual(safe.entities[0].modalities, ['vision']);
assert.equal(safe.entities[0].position, null);
assert.equal(safe.entities[0].velocity, null);
assert.deepEqual(safe.entities[0].sourceIds, ['camera-1']);
assert.equal(safe.entities[0].observationCount, 1);
assert.equal(safe.entities[0].persistence01, 0,
  'out-of-range persisted persistence must not be upgraded to full permanence');
assert.equal(safe.events[0].evidenceKind, 'model-output');
assert.equal(safe.events[0].confidence01, 0);
assert.equal(safe.events[0].lastAt, 0);
assert.equal(safe.events[0].persistence01, 0,
  'out-of-range event persistence must fail closed');
assert.equal(safe.events.some(event => event.id === 'old-unverified-receipt'), false,
  'legacy unverified receipt events must be migrated out of canonical world history');
assert.ok(safe.quarantinedOutcomes?.some(event => event.id === 'old-unverified-receipt'),
  'legacy unverified receipts must remain available in the diagnostic quarantine');
assert.equal(safe.events.some(event => event.id === 'old-host-verified-receipt'), false,
  'serialized host verifier receipts must lose in-process authority after restart');
assert.ok(safe.quarantinedOutcomes?.some(event => event.id === 'old-host-verified-receipt'),
  'serialized verified receipts must remain diagnostic only until re-attested live');
assert.deepEqual(safe.facts, [], 'persisted free-form facts must not return as canonical grounded facts');
assert.deepEqual(safe.quarantinedFacts, ['restored-unverified:valid fact'],
  'persisted fact text remains available in an explicitly unverified quarantine');
assert.deepEqual(safe.provenanceIds, ['source-1']);
assert.notEqual(safe.lastHash, 'attacker-controlled-hash');

console.log('GROUNDED_WORLD_WRITE_AUTHORITY_INTEGRITY=PASS');
