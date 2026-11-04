import assert from 'node:assert/strict';
import { scoreSocialRepetition } from '../src/organism/system/SocialRepetitionPolicy.ts';

const now = 1_800_000_000_000;
const hour = 60 * 60 * 1000;
const documents = Array.from({ length: 16 }, (_, index) => ({
  at: now - (16 - index) * hour,
  text: index >= 12
    ? `The project discussion returned to neural memory and replay planning ${index}`
    : `The project discussion considered a different engineering issue ${index}`,
}));

const repeated = scoreSocialRepetition(
  'Could we revisit the project neural memory replay planning from another angle?',
  documents,
  now,
);
const fresh = scoreSocialRepetition(
  'Could we explore acoustic embodiment calibration from another angle?',
  documents,
  now,
);
assert.ok(repeated.total > fresh.total, 'recent rare-topic terms should carry more repetition weight than a fresh topic');
assert.ok(repeated.perTerm.neural > repeated.perTerm.project, 'background-common terms should have lower IDF than rare repeated topic terms');

const idle = scoreSocialRepetition(
  'Could we revisit neural memory replay planning?',
  documents.map((item) => ({ ...item, at: now - 5 * 24 * hour })),
  now,
);
assert.equal(idle.total, 0, 'expired foreground history must not cause an idle repetition deadlock');

const futureOnly = scoreSocialRepetition(
  'Could we revisit neural memory replay planning?',
  documents.map((item) => ({ ...item, at: now + hour })),
  now,
);
assert.equal(futureOnly.total, 0, 'future-dated outputs must never influence current selection');
assert.equal(scoreSocialRepetition('', documents, now).total, 0, 'empty drafts score zero');

console.log('SOCIAL_REPETITION_POLICY=PASS');
