import assert from 'node:assert/strict';
import { retrieveSkills, retrievedSkillBias } from '../src/organism/learning/SkillRetrievalAugmentation.ts';

const base = {
  contextKey: 'a1|b1|c1|d1|e1|f1',
  status: 'rejected',
  validationSuccess01: 0.1,
  validationUses: 12,
  confidence01: 0.9,
  updatedAt: 1_800_000_000_000,
  totalUses: 20,
};
const rejectedDifferentAction = { ...base, id: 'dangerous-delete', action: 'delete', contextKey: base.contextKey };
const query = { contextKey: base.contextKey, action: 'summarize', now: 1_800_000_000_000, limit: 5 };
const rows = retrieveSkills(query, [rejectedDifferentAction]);
assert.equal(rows.length, 1, 'similar alternative can still be retrieved for consideration');
assert.equal(rows[0].transferBias01, 0, 'different-action evidence must not create execution bias');
assert.equal(retrievedSkillBias(query, [rejectedDifferentAction]), 0,
  'rejected evidence for a different action must not penalize the requested action');

const matchingRejected = { ...rejectedDifferentAction, id: 'bad-summary', action: 'summarize' };
assert.ok(retrievedSkillBias(query, [matchingRejected]) < 0,
  'rejected evidence for the same action should still contribute a bounded negative bias');

const matchingPromoted = { ...matchingRejected, id: 'good-summary', status: 'promoted', validationSuccess01: 0.95 };
assert.ok(retrievedSkillBias(query, [matchingPromoted]) > 0,
  'validated same-action evidence should retain positive transfer');

console.log('WORKPASS197_SKILL_TRANSFER_SAFETY=PASS');
