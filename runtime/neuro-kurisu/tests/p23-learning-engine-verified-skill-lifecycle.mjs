import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { VersionedSkillCandidateStore, InMemorySkillStorePersistence } from '../src/organism/learning/VersionedSkillCandidateStore.ts';

const engine = new P23LearningEngine();
const store = new VersionedSkillCandidateStore(new InMemorySkillStorePersistence());
engine.configureVerifiedSkillLifecycle(store);
const state = { needs: { energy:.5, cognitiveLoad:.5, uncertainty:.5, novelty:.5, goalPressure:.5, socialNeed:.5 } };
const contextKey = 'e2|c2|u2|n2|g2|s2';
assert.equal(engine.skillBias(state, 'reflect'), 0, 'unapproved candidate does not affect runtime action bias');
assert.equal(engine.topSkills().length, 0);
const now = Date.now();
const skill = {
  id:'p23-skill-verified-test', contextKey, action:'reflect', totalUses:8, trainUses:5,
  validationUses:3, trainSuccess01:.8, validationSuccess01:.9, confidence01:.9,
  status:'candidate', createdAt:now, updatedAt:now, validationWindowStartTick:1, validationWindowEndTick:3,
};
const proposal = {
  schemaVersion:1, proposalId:'a'.repeat(64), outcomeFingerprint:'b'.repeat(64),
  gate:{accepted:true}, canActivateAutomatically:false, authenticatedEvidenceRows:20, unauthenticatedEvidenceRows:0,
};
const candidate = engine.stageVerifiedSkillCandidate(proposal, skill);
for(let i=1;i<=3;i++) engine.recordVerifiedSkillShadow(candidate.candidateId, {
  runId:'engine-shadow-'+i, evidenceFingerprint:String(i).repeat(64), passed:true, observedAt:Date.now(),
});
engine.approveVerifiedSkillCandidate(candidate.candidateId, {
  approvedBy:'reviewer', approvedAt:Date.now(), expectedActiveVersion:null,
});
assert.ok(engine.skillBias(state, 'reflect') > 0, 'only an explicitly approved active version reaches the runtime resolver');
assert.equal(engine.topSkills().length, 1);
assert.equal(engine.snapshot().metrics.skillPromotions, 1);
engine.rollbackVerifiedSkillCandidate(candidate.candidateId, 1, Date.now());
assert.equal(engine.skillBias(state, 'reflect'), 0, 'rollback immediately removes the versioned skill from action bias');
assert.equal(engine.topSkills().length, 0);
assert.equal(engine.snapshot().metrics.skillPromotions, 0);
console.log('P23_LEARNING_ENGINE_VERIFIED_SKILL_LIFECYCLE=PASS');
