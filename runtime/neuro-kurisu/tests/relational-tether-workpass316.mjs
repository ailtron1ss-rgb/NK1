import assert from 'node:assert/strict';
import { SocialMindKernel } from '../src/organism/cognition/SocialMindKernel.ts';

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
