import assert from 'node:assert/strict';
import { SocialMindKernel } from '../src/organism/cognition/SocialMindKernel.ts';

const aliasKernel = new SocialMindKernel();
const canonicalPerson = aliasKernel.observePerson({ id: 'camera-person-a', displayName: 'contact', at: 1000, confidence01: .9, visible01: .9, source: 'vision', position: { x: .2, y: .2, z: 1 } });
const aliasPerson = aliasKernel.observePerson({ id: 'camera-person-b', displayName: 'contact', at: 2000, confidence01: .88, visible01: .9, source: 'vision', position: { x: .21, y: .2, z: 1 } });
assert.equal(aliasPerson.id, canonicalPerson.id, 'nearby re-identification should preserve a canonical person ID');
const aliasObservation = aliasKernel.snapshot().evidence.find(e => e.observedAt === 2000);
assert.equal(aliasObservation.personId, canonicalPerson.id, 'alias observations must be filed under the canonical person ID');
const aliasIntent = aliasKernel.observeText('camera-person-b', 'Почему это работает?', 3000);
assert.equal(aliasKernel.snapshot().episodes[0].personId, canonicalPerson.id, 'alias conversation episodes must attach to the canonical person');
assert.equal(aliasKernel.snapshot().evidence.find(e => e.id === aliasIntent.evidenceIds[0]).personId, canonicalPerson.id, 'intent evidence must retain canonical ownership');
const aliasStatement = aliasKernel.recordObservedUserStatement('camera-person-b', 'Alias statement receipt', 3200, .9);
const aliasFrame = aliasKernel.reconstructUserMind({ personId: 'camera-person-b', at: 3300, observations: [{ claim: 'Alias statement receipt', confidence01: .9, evidenceIds: [aliasStatement.id] }] });
assert.equal(aliasFrame.personId, canonicalPerson.id, 'UserHarness reconstructions requested through an alias should remain canonical');
assert.equal(aliasFrame.observations[0].evidenceStatus, 'direct-observation', 'canonicalized statement receipts should continue to ground the matching observation');
assert.equal(aliasKernel.person('camera-person-b').id, canonicalPerson.id, 'alias lookups should not create a second profile');
assert.equal(aliasKernel.diagnostics().personCount, 1, 'aliases must never duplicate the canonical profile');
const tetherKernel = new SocialMindKernel();
tetherKernel.observePerson({ id: 'long-term-contact', displayName: 'contact', at: 1000, confidence01: .9, visible01: .9, source: 'interaction' });
const relationshipBeforeOutcome = tetherKernel.person('long-term-contact');
tetherKernel.recordOutcome('long-term-contact', { actualIntent: 'information', outcome01: .9, surprise01: .1, at: 2000, agentAction: 'respond' });
const relationshipAfterOutcome = tetherKernel.person('long-term-contact');
assert.ok(relationshipAfterOutcome.trust01 > relationshipBeforeOutcome.trust01, 'recordOutcome updates must persist to the canonical person state');
assert.ok(relationshipAfterOutcome.warmth01 > relationshipBeforeOutcome.warmth01, 'successful social outcomes must update the canonical warmth state');
assert.ok(relationshipAfterOutcome.relationshipStrength01 > relationshipBeforeOutcome.relationshipStrength01, 'relationship-strength updates must persist after recomputation');
const beforeSleepSnapshot = tetherKernel.snapshot();
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
const laterAt = 2000 + thirtyDaysMs;
tetherKernel.observePerson({ id: 'long-term-contact', displayName: 'contact', at: laterAt, confidence01: .9, visible01: .9, source: 'interaction' });
const fadedRelationship = tetherKernel.person('long-term-contact');
assert.ok(fadedRelationship.trust01 < relationshipAfterOutcome.trust01, 'trust should decay gradually toward neutral between sessions');
assert.ok(Math.abs(fadedRelationship.warmth01 - .5) < Math.abs(relationshipAfterOutcome.warmth01 - .5), 'warmth should decay toward neutral between sessions');
assert.ok(fadedRelationship.relationshipStrength01 < relationshipAfterOutcome.relationshipStrength01, 'the relational tether should decay with a trust-adaptive half-life');
const tetherRestored = new SocialMindKernel();
tetherRestored.restore(beforeSleepSnapshot);
tetherRestored.observePerson({ id: 'long-term-contact', displayName: 'contact', at: laterAt, confidence01: .9, visible01: .9, source: 'interaction' });
assert.deepEqual(tetherRestored.person('long-term-contact'), fadedRelationship, 'relational decay should remain deterministic across restart');

console.log('WORKPASS316_RELATIONAL_TETHER=PASS', JSON.stringify({
  before: relationshipAfterOutcome,
  after: fadedRelationship,
  restartDeterministic: true,
}));
