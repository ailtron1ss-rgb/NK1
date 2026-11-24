import assert from 'node:assert/strict';
import { P68GoalEcology } from '../src/organism/developmental/P68GoalEcology.ts';

const makeGoal = (id, status, importance, updatedAt = 1_000) => ({
  id,
  title: id,
  reason: 'goal lifecycle boundary fixture',
  source: 'intrinsic',
  status,
  importance,
  urgency: .5,
  confidence: .8,
  progress: .1,
  createdAt: 1_000,
  updatedAt,
});

const ecology = new P68GoalEcology();
const goals = [
  makeGoal('terminal-cancelled', 'cancelled', .4, 1),
  makeGoal('terminal-expired', 'expired', .98, 2),
  makeGoal('terminal-superseded', 'superseded', .97, 3),
  makeGoal('candidate-low-importance', 'candidate', .01, 4),
  ...Array.from({ length: 12 }, (_, i) => makeGoal(`candidate-${i}`, 'candidate', .5, 10 + i)),
];

const result = ecology.tick({
  tick: 1,
  at: 1_000,
  goals,
  lastAction: 'none',
  lastSuccess: null,
  mode: 'observe',
  homeostaticPressure01: .1,
  identity01: .9,
});

assert.equal(goals.length, 15, 'P68 must retain the bounded 15-goal population');
assert.equal(goals.some(goal => goal.id === 'terminal-cancelled'), false,
  'terminal goals must be pruned before an open candidate when capacity is exceeded');
assert.equal(goals.some(goal => goal.id === 'candidate-low-importance'), true,
  'an open candidate must not be evicted while terminal records occupy the bounded population');
assert.equal(result.activeCount, 0, 'terminal/deferred candidates must not count as active goals');

const protectedGoals = [
  makeGoal('deferred', 'deferred', .9),
  makeGoal('blocked', 'blocked', .9),
  makeGoal('cancelled', 'cancelled', .9),
  makeGoal('completed', 'completed', .9),
  makeGoal('expired', 'expired', .9),
  makeGoal('superseded', 'superseded', .9),
];
ecology.tick({
  tick: 2,
  at: 1_000,
  goals: protectedGoals,
  lastAction: 'respond',
  lastSuccess: .99,
  mode: 'observe',
  homeostaticPressure01: .01,
  identity01: 1,
});
assert.deepEqual(protectedGoals.map(goal => goal.status),
  ['deferred', 'blocked', 'cancelled', 'completed', 'expired', 'superseded'],
  'P68 must never auto-reactivate or mutate deferred, blocked or terminal goals');
console.log('P68_GOAL_TERMINAL_PRUNING=PASS');
