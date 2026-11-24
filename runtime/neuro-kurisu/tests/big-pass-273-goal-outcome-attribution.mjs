import assert from 'node:assert/strict';
import { B273AutonomousGoalLifecycle } from '../src/organism/cognition/B273AutonomousGoalLifecycle.ts';

const input = (tick, overrides = {}) => ({
  tick,
  autonomousAllowed: true,
  endogenousGoalVector: Array(8).fill(0),
  selfLatent: Array(16).fill(0),
  worldLatent: Array(16).fill(0),
  neuralAssembly: Array(16).fill(0),
  needs: { energy01:.8, uncertainty01:.5, novelty01:.5, goalPressure01:.5, socialNeed01:.5, autonomy01:.7, coherence01:.9 },
  traits: { curiosity:.6, caution:.5, 'truth-seeking':.7, persistence:.7, 'self-reflection':.6 },
  predictionError01:.2,
  identityContinuity01:.9,
  autobiographicalContinuity01:.9,
  ...overrides,
});

const denied = new B273AutonomousGoalLifecycle();
const blocked = denied.step(input(1, {
  autonomousAllowed: false,
  endogenousGoalVector: Array(8).fill(.95),
  selfLatent: Array(16).fill(.9),
  worldLatent: Array(16).fill(.9),
  neuralAssembly: Array(16).fill(.9),
}));
assert.equal(blocked.goalId, null,
  'a rejected canonical goal-admission decision must not create an endogenous B273 goal');
assert.equal(blocked.action, 'defer');
assert.equal(denied.diagnostics().goalCreations, 0,
  'rejected external/admission-blocked inputs must not create intrinsic goal candidates');

const engine = new B273AutonomousGoalLifecycle();
const selected = engine.step(input(2));
assert.ok(selected.goalId, 'an admitted internal decision must own a B273 goal');
const before = engine.snapshot();
const unadmitted = engine.learnFromOutcome({
  goalId: selected.goalId,
  decisionAutonomous: false,
  tick: 3,
  action: selected.action,
  plan: selected.plan,
  reward01: 1,
  predictionError01: 0,
  independentGain01: 1,
  personalityAlignment01: 1,
  externalEvidence01: 1,
});
assert.equal(unadmitted.accepted, false,
  'an externally requested decision must not update intrinsic B273 goal progress');
assert.deepEqual(engine.snapshot(), before,
  'rejected decision attribution must be side-effect free');

const unrelated = engine.learnFromOutcome({
  goalId: 'not-the-selected-goal',
  decisionAutonomous: true,
  tick: 4,
  action: selected.action,
  plan: selected.plan,
  reward01: 1,
  predictionError01: 0,
  independentGain01: 1,
  personalityAlignment01: 1,
  externalEvidence01: 1,
});
assert.equal(unrelated.accepted, false,
  'an outcome for a different decision goal must not train the current B273 goal');
assert.deepEqual(engine.snapshot(), before,
  'a mismatched goal ID must not alter goal attempts, progress, history or skills');

const credited = engine.learnFromOutcome({
  goalId: selected.goalId,
  decisionAutonomous: true,
  tick: 5,
  action: selected.action,
  plan: selected.plan,
  reward01: 1,
  predictionError01: 0,
  independentGain01: 1,
  personalityAlignment01: 1,
  externalEvidence01: 1,
});
assert.equal(credited.accepted, true,
  'the exact internally admitted decision may train its matching B273 goal');
assert.equal(engine.snapshot().goals.find(g => g.id === selected.goalId)?.attempts, 1);

console.log('B273_GOAL_OUTCOME_ATTRIBUTION=PASS');
