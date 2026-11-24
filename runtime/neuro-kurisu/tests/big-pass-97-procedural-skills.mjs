import assert from 'node:assert/strict';
import { ProceduralSkillLibrary } from '../src/organism/learning/ProceduralSkillLibrary.ts';

const skills = new ProceduralSkillLibrary();
for (let i = 0; i < 6; i += 1) {
  skills.observeOutcome('verify', 'truth evidence', 0.92, 0.18, undefined, {
    verified: true,
    independent: true,
    context: i % 2 === 0 ? 'truth evidence' : 'truth evidence checking',
  });
}
const snap = skills.snapshot();
const row = snap.skills.find((s) => s.id === 'verify|truth evidence');
assert.ok(row);
assert.equal(row.status, 'habit', 'validated repeated success should promote a reusable skill');
assert.ok(row.independentEvidenceUses >= 2);
assert.ok(row.validatedUses >= 2);

const transferable = skills.biasDetails('verify', 'truth evidence checking');
assert.ok(transferable.similarity01 >= 0.5);
assert.ok(transferable.bias01 > 0.5, 'similar context should receive a bounded transfer bias');

const unrelated = skills.biasDetails('verify', 'cooking recipe');
assert.equal(unrelated.sourceSkillId, null, 'unrelated context must not inherit a skill');
assert.equal(unrelated.bias01, 0.5);

const unverified = new ProceduralSkillLibrary();
for (let i = 0; i < 10; i += 1) {
  unverified.observeOutcome('explore', 'curiosity', 0.95, 0.2, undefined, {
    verified: false,
    independent: false,
    context: 'curiosity',
  });
}
assert.equal(unverified.snapshot().skills[0].status, 'candidate', 'internal repetition alone must not promote a habit');

console.log('BIG_PASS_97_PROCEDURAL_SKILLS=PASS', JSON.stringify({
  promotion: row.status,
  independentEvidenceUses: row.independentEvidenceUses,
  transferableSimilarity: transferable.similarity01,
  unrelatedBias: unrelated.bias01,
}));
