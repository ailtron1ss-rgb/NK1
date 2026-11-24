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
assert.throws(() => engine.stageVerifiedSkillCandidate(proposal, skill),
  /authentic, accepted proposal/,
  'caller-constructed public fields cannot enter the live skill lifecycle');
assert.equal(engine.skillBias(state, 'reflect'), 0, 'untrusted proposal cannot affect runtime action bias');
assert.equal(engine.topSkills().length, 0, 'untrusted proposal cannot reach the runtime resolver');
assert.equal(engine.snapshot().metrics.skillPromotions, 0, 'rejected proposal does not increment promotion metrics');
console.log('P23_LEARNING_ENGINE_VERIFIED_SKILL_LIFECYCLE=PASS');
