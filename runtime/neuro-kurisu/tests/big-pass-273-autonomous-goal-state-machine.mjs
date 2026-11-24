import assert from 'node:assert/strict';
import { B273AutonomousGoalLifecycle } from '../src/organism/cognition/B273AutonomousGoalLifecycle.ts';

const input = (tick) => ({
  tick,
  autonomousAllowed: true,
  endogenousGoalVector: Array(8).fill(0),
  selfLatent: Array(16).fill(0),
  worldLatent: Array(16).fill(0),
  neuralAssembly: Array(16).fill(0),
  needs: { energy01:.8, uncertainty01:.5, novelty01:.5, goalPressure01:.5, socialNeed01:.5, autonomy01:.5, coherence01:.5 },
  traits: { curiosity:.5, caution:.5, 'truth-seeking':.5, persistence:.5, 'self-reflection':.5 },
  predictionError01:.2,
  identityContinuity01:.9,
  autobiographicalContinuity01:.9,
});

const engine = new B273AutonomousGoalLifecycle();
const first = engine.step(input(0));
assert.ok(first.goalId);
const cancelled = engine.transitionGoal(first.goalId, 'cancelled', {
  tick: 1,
  cooldownTicks: 3,
  reason: 'user-cancelled-the-unneeded-action',
});
assert.equal(cancelled.transitioned, true);
assert.equal(cancelled.goal.status, 'cancelled');

const held = engine.step(input(2));
assert.equal(held.goalId, null, 'cancelled goal fingerprint must remain suppressed during cooldown');
assert.equal(held.action, 'defer');
assert.equal(held.mode, 'cooldown');
const snapshot = engine.snapshot();
const restored = new B273AutonomousGoalLifecycle();
restored.restore(snapshot);
const afterRestart = restored.step(input(3));
assert.equal(afterRestart.goalId, null, 'cooldown must survive restart and block immediate reactivation');

const expired = restored.transitionGoal(first.goalId, 'active', { tick: 3 });
assert.equal(expired.transitioned, false, 'terminal goals cannot be reopened');
assert.equal(restored.snapshot().goals.find(g => g.id === first.goalId)?.status, 'cancelled');

const fresh = restored.step(input(4));
assert.ok(fresh.goalId, 'a fresh goal may be created after cooldown');
assert.notEqual(fresh.goalId, first.goalId, 'new goal generation must have a distinct ID');

const transitionCases = [
  ['deferred', false],
  ['blocked', false],
  ['expired', true],
  ['superseded', true],
  ['completed', true],
  ['abandoned', true],
];
for (const [status, terminal] of transitionCases) {
  const subject = new B273AutonomousGoalLifecycle();
  const selected = subject.step(input(0));
  const result = subject.transitionGoal(selected.goalId, status, {
    tick: 1,
    cooldownTicks: 2,
    reason: `lifecycle-test:${status}`,
  });
  assert.equal(result.transitioned, true, `active goal must transition to ${status}`);
  assert.equal(result.goal.status, status);
  const reactivation = subject.transitionGoal(selected.goalId, 'active', { tick: 4 });
  assert.equal(reactivation.transitioned, !terminal,
    `${status} must obey the correct terminal/non-terminal reactivation rule`);
}
console.log('B273_AUTONOMOUS_GOAL_STATE_MACHINE=PASS');
