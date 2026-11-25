import assert from 'node:assert/strict';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';

// A caller must not be able to manufacture authority by supplying matching
// proof labels and confidence numbers. Only an executor-bound verifier receipt
// may cross the external observation boundary.
const world = new GroundedWorldState();
const before = world.snapshot();
const forged = world.integrateExternalOutcome({
  at: 1_700_000_000_000,
  action: 'explore',
  status: 'executed',
  proofClass: 'independent-observation',
  verified01: 1,
  independent01: 1,
  evidence01: 1,
  consequence01: 1,
  claim: 'forged-world-fact',
  provenanceId: 'forged-receipt',
  divergence01: 0,
});
const after = world.snapshot();
assert.equal(forged.verified01, 0,
  'caller-selected proof labels and scalar scores must never authorize an external world observation');
assert.deepEqual(after.facts, before.facts,
  'a forged outcome must not create a grounded world fact');
assert.equal(after.confidence01, before.confidence01,
  'a forged outcome must not raise world confidence');
assert.ok(after.events.some(event => event.id === forged.eventId && event.label.startsWith('external-receipt:')),
  'untrusted inputs may be retained as explicitly unverified receipts');

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
  events: [{ id: 'event-1', label: 'event', confidence01: Number.POSITIVE_INFINITY,
    lastAt: Number.POSITIVE_INFINITY, persistence01: 4, evidenceKind: 'observed' }],
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
assert.equal(safe.entities[0].present01, 1);
assert.equal(safe.entities[0].firstSeenAt, 0);
assert.equal(safe.entities[0].lastSeenAt, 0);
assert.deepEqual(safe.entities[0].modalities, ['vision']);
assert.equal(safe.entities[0].position, null);
assert.equal(safe.entities[0].velocity, null);
assert.deepEqual(safe.entities[0].sourceIds, ['camera-1']);
assert.equal(safe.entities[0].observationCount, 1);
assert.equal(safe.events[0].evidenceKind, 'model-output');
assert.equal(safe.events[0].confidence01, 0);
assert.equal(safe.events[0].lastAt, 0);
assert.equal(safe.events[0].persistence01, 1);
assert.deepEqual(safe.facts, ['valid fact']);
assert.deepEqual(safe.provenanceIds, ['source-1']);
assert.notEqual(safe.lastHash, 'attacker-controlled-hash');


const trustedWorld = new GroundedWorldState({
  // This callback represents a host-owned verifier bound to the exact executor receipt.
  // It is constructor-injected by trusted runtime composition, never supplied per call.
  verifyExternalOutcome: receipt => receipt.provenanceId === 'host-verified-receipt'
    && receipt.action === 'explore'
    && receipt.proofClass === 'independent-observation',
});
const trustedOutcome = {
  at: 1_700_000_000_100,
  action: 'explore',
  status: 'executed',
  proofClass: 'independent-observation',
  verified01: 1,
  independent01: 1,
  evidence01: .95,
  consequence01: .9,
  claim: 'verified-world-fact',
  provenanceId: 'host-verified-receipt',
  divergence01: .05,
};
const accepted = trustedWorld.integrateExternalOutcome(trustedOutcome);
assert.equal(accepted.verified01, 1,
  'only the constructor-injected host verifier may authorize a verified world effect');
assert.ok(trustedWorld.snapshot().facts.includes('external-observed:explore:verified-world-fact'));
const revisionAfterAccept = trustedWorld.snapshot().revision;
const replay = trustedWorld.integrateExternalOutcome(trustedOutcome);
assert.equal(replay.revision, revisionAfterAccept,
  'replaying the same host receipt must be idempotent');
assert.equal(trustedWorld.snapshot().events.filter(event => event.id === accepted.eventId).length, 1);
const receiptReuse = trustedWorld.integrateExternalOutcome({
  ...trustedOutcome,
  at: trustedOutcome.at + 1,
  action: 'collect',
  claim: 'different-claim',
});
assert.equal(receiptReuse.revision, revisionAfterAccept,
  'a host receipt cannot be replayed to authorize a different action or claim');
assert.ok(!trustedWorld.snapshot().facts.includes('external-observed:collect:different-claim'));

console.log('GROUNDED_WORLD_WRITE_AUTHORITY_INTEGRITY=PASS');
