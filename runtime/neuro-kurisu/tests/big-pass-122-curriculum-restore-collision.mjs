import assert from 'node:assert/strict';
import { PersonalCurriculumEngine } from '../src/organism/learning/PersonalCurriculumEngine.ts';

const goal = {
  id: 'restore-collision-goal',
  title: 'Preserve consistent learning history',
  reason: 'Exercise persisted curriculum identity reconciliation',
  source: 'intrinsic',
  status: 'active',
  importance: 0.8,
  urgency: 0.6,
  confidence: 0.7,
  progress: 0.2,
  createdAt: 1,
  updatedAt: 1,
};
const source = new PersonalCurriculumEngine();
source.observeOutcome({
  goal, outcome01: 0.8, verified: true, contextKey: 'context-a',
  causal01: 0.7, social01: 0.4, identity01: 0.8, retention01: 0.7, transfer01: 0.5, at: 1000,
});
const validState = source.snapshot();
assert.equal(validState.threads.length, 1);

const duplicateId = structuredClone(validState);
duplicateId.threads = [
  { ...validState.threads[0], title: 'conflicting row A' },
  { ...validState.threads[0], title: 'conflicting row B', priority01: 0.99 },
];
const restoredId = new PersonalCurriculumEngine();
restoredId.restore(duplicateId);
assert.equal(restoredId.snapshot().threads.length, 0,
  'conflicting rows sharing an ID must all be quarantined, independent of array order');

const duplicateFamily = structuredClone(validState);
duplicateFamily.threads = [
  { ...validState.threads[0], id: 'curriculum-row-a' },
  { ...validState.threads[0], id: 'curriculum-row-b', priority01: 0.99 },
];
const restoredFamily = new PersonalCurriculumEngine();
restoredFamily.restore(duplicateFamily);
assert.equal(restoredFamily.snapshot().threads.length, 0,
  'conflicting rows sharing a family must all be quarantined, independent of array order');

const ranking = new PersonalCurriculumEngine();
assert.throws(() => ranking.rankGoals({
  goals: [goal], identity01: Number.NaN, social01: 0.2, novelty01: 0.3, uncertainty01: 0.4,
}), /personal-curriculum-goal-ranking-score-invalid/);
assert.equal(ranking.snapshot().focusGoalId, null, 'invalid ranking input must not mutate focus');

assert.throws(() => ranking.rankGoals({
  goals: [goal, { ...goal, title: goal.title + ' duplicate row' }],
  identity01: 0.2, social01: 0.2, novelty01: 0.3, uncertainty01: 0.4,
}), /personal-curriculum-goal-ranking-goal-invalid/);
assert.equal(ranking.snapshot().focusGoalId, null, 'duplicate goal identity must not select a focus');

const nonActive = ranking.rankGoals({
  goals: [{ ...goal, status: 'candidate' }, { ...goal, id: 'paused-goal', status: 'paused' }],
  identity01: 0.2, social01: 0.2, novelty01: 0.3, uncertainty01: 0.4,
});
assert.deepEqual(nonActive, [], 'canonical non-active goal statuses must be accepted but not ranked');
assert.equal(ranking.snapshot().focusGoalId, null);


let rankGetterCalls = 0;
const hostileGoal = { ...goal };
Object.defineProperty(hostileGoal, 'importance', {
  enumerable: true,
  get() { rankGetterCalls++; return 1; },
});
assert.throws(() => ranking.rankGoals({
  goals: [hostileGoal], identity01: 0.2, social01: 0.2, novelty01: 0.3, uncertainty01: 0.4,
}), /personal-curriculum-goal-ranking-data-boundary-rejected/);
assert.equal(rankGetterCalls, 0, 'ranking boundary must not execute input getters');
assert.equal(ranking.snapshot().focusGoalId, null);
const tieEngine = new PersonalCurriculumEngine();
const goalA = { ...goal, id: 'goal-a', title: 'Equal priority goal A' };
const goalZ = { ...goal, id: 'goal-z', title: 'Equal priority goal Z' };
const rankingArgs = {
  goals: [goalZ, goalA], identity01: 0.3, social01: 0.3, novelty01: 0.3, uncertainty01: 0.3,
};
const forwardRank = tieEngine.rankGoals(rankingArgs).map(row => row.goalId);
const reverseRank = tieEngine.rankGoals({ ...rankingArgs, goals: [goalA, goalZ] }).map(row => row.goalId);
assert.deepEqual(forwardRank, ['goal-a', 'goal-z'], 'equal scores use stable goal identity as tie-break');
assert.deepEqual(reverseRank, forwardRank, 'curriculum focus order must not depend on input insertion order');
console.log('BIG_PASS_122_CURRICULUM_RESTORE_COLLISION=PASS');
