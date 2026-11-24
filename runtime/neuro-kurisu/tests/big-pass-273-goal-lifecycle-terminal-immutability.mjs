import assert from 'node:assert/strict';
import { B273AutonomousGoalLifecycle } from '../src/organism/cognition/B273AutonomousGoalLifecycle.ts';

const engine = new B273AutonomousGoalLifecycle();
const input = (tick) => ({
  tick,
  endogenousGoalVector: Array(8).fill(0),
  selfLatent: Array(16).fill(0),
  worldLatent: Array(16).fill(0),
  neuralAssembly: Array(16).fill(0),
  needs: {
    energy01: .8,
    uncertainty01: .5,
    novelty01: .5,
    goalPressure01: .5,
    socialNeed01: .5,
    autonomy01: .5,
    coherence01: .5,
  },
  traits: { curiosity: .5, caution: .5, 'truth-seeking': .5, persistence: .5, 'self-reflection': .5 },
  predictionError01: .2,
  identityContinuity01: .9,
  autobiographicalContinuity01: .9,
});

const first = engine.step(input(0));
const completedGoalId = first.goalId;
assert.ok(completedGoalId, 'B273 must create an initial internal goal');

let outcome;
for (let tick = 1; tick <= 10; tick += 1) {
  outcome = engine.learnFromOutcome({
    tick,
    action: first.action,
    plan: first.plan,
    reward01: 1,
    predictionError01: 0,
    independentGain01: 1,
    personalityAlignment01: 1,
    externalEvidence01: 1,
  });
  if (outcome.completed) break;
}
assert.equal(outcome?.completed, true, 'strong independently evidenced progress must complete the goal');
assert.equal(engine.snapshot().goals.find(goal => goal.id === completedGoalId)?.status, 'completed');

const heldByCooldown = engine.step(input(11));
assert.equal(heldByCooldown.goalId, null, 'a completed goal fingerprint must not immediately reopen');
assert.equal(heldByCooldown.action, 'defer');
assert.equal(heldByCooldown.mode, 'cooldown');
let snapshot = engine.snapshot();
assert.equal(snapshot.goals.find(goal => goal.id === completedGoalId)?.status, 'completed',
  'terminal completed goals must not be reopened by goal synthesis');
assert.equal(snapshot.goals.filter(goal => goal.id === completedGoalId).length, 1,
  'goal generations must not create duplicate IDs when a prior goal is terminal');
assert.equal(snapshot.goals.filter(goal => goal.status === 'active').length, 0,
  'a cooldown hold must not leave a stale active-goal owner');

const restored = new B273AutonomousGoalLifecycle();
restored.restore(snapshot);
assert.deepEqual(restored.snapshot(), snapshot, 'goal lifecycle must survive snapshot/restore without reopening terminal goals');
const newGeneration = restored.step(input(12));
assert.ok(newGeneration.goalId, 'a new goal generation may be admitted after cooldown');
assert.notEqual(newGeneration.goalId, completedGoalId);
snapshot = restored.snapshot();
assert.equal(snapshot.goals.find(goal => goal.id === completedGoalId)?.status, 'completed');
assert.equal(snapshot.goals.filter(goal => goal.status === 'active').length, 1,
  'after cooldown, exactly one new goal owns the lifecycle');

console.log('B273_GOAL_LIFECYCLE_TERMINAL_IMMUTABILITY=PASS');
