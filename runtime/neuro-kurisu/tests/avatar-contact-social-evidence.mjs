import assert from 'node:assert/strict';
import { SocialMindKernel } from '../src/organism/cognition/SocialMindKernel.ts';

const social = new SocialMindKernel();
const evidence = social.recordObservedUserAction('user', 'avatar-contact-head', 1_000, 0.72, 'interaction');
const person = social.person('user');
const snapshot = social.snapshot();

assert.equal(evidence.claim, 'user-action:avatar-contact-head');
assert.equal(evidence.source, 'interaction');
assert.equal(evidence.evidenceKind, 'observed');
assert.equal(evidence.confidence01, 0.72);
assert.equal(person?.visible01, 0, 'a UI contact must not imply that the user is visually present');
assert.equal(snapshot.evidence.some((item) => item.claim === 'person-present:user'), false,
  'interface contact must not manufacture visual-presence evidence');

const restored = new SocialMindKernel();
restored.restore(snapshot);
assert.equal(restored.person('user')?.visible01, 0);
assert.equal(restored.snapshot().evidence[0]?.claim, 'user-action:avatar-contact-head');
console.log('AVATAR_CONTACT_SOCIAL_EVIDENCE=PASS');
