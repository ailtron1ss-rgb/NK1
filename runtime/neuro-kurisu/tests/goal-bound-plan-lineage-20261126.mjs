import assert from 'node:assert/strict';
import { PlanEngine, derivePlanRevisionHint } from '../src/organism/world/PlanEngine.ts';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';

const environment = new WorldEnvironment();
const rewardContract = await import('../src/organism/world/WorldEnvironment.ts');
assert.equal(typeof rewardContract.signedRewardToDisplay01, 'function',
  'the planner/runtime boundary must expose one canonical signed-reward to 0..1 conversion');
for (const [signedReward, expected01] of [
  [-1, 0], [-0.5, 0.25], [0, 0.5], [0.5, 0.75], [1, 1],
]) {
  assert.equal(rewardContract.signedRewardToDisplay01(signedReward), expected01,
    'signed reward must map linearly to the normalized outcome scale');
}
assert.equal(rewardContract.signedRewardToDisplay01(-2), 0);
assert.equal(rewardContract.signedRewardToDisplay01(2), 1);
const initialWorld = environment.snapshot();
const goal = {
  id: 'goal:research-17',
  title: 'Verify the unexpected laboratory result',
  reason: 'Resolve a high-value uncertainty before continuing',
  source: 'intrinsic',
  status: 'active',
  importance: 0.84,
  urgency: 0.72,
  confidence: 0.91,
  progress: 0.18,
  createdAt: 1_795_600_000_000,
  updatedAt: 1_795_600_100_000,
};
const context = { decisionId: 'decision:cycle-42', tick: 42 };
const engine = new PlanEngine(environment);
const plan = engine.build(goal, 'verify', 3, 3, context);

assert.ok(plan.lineage, 'a built plan must carry a decision/goal/world lineage envelope');
assert.equal(plan.lineage.version, 1);
assert.equal(plan.lineage.decisionId, context.decisionId);
assert.equal(plan.lineage.decisionTick, context.tick);
assert.equal(plan.lineage.goal.id, goal.id);
assert.match(plan.lineage.goal.fingerprint, /^[a-f0-9]{64}$/);
assert.equal(plan.lineage.world.tick, initialWorld.tick);
assert.match(plan.lineage.world.fingerprint, /^[a-f0-9]{64}$/);
assert.ok(plan.steps.length > 0);
assert.match(plan.integrityFingerprint, /^[a-f0-9]{64}$/);
assert.equal(plan.id, 'plan-' + plan.integrityFingerprint.slice(0, 24),
  'the plan identifier must be derived from its sealed actionable payload');
assert.ok(plan.steps.every(step => step.preconditions && step.expectedOutcome),
  'every step must carry explicit preconditions and expected outcome');

const sameContext = engine.validateContext(plan, goal, initialWorld, context);
assert.deepEqual(sameContext, { valid: true, reason: 'ok' });

let predictedWorld = initialWorld;
const stepWorlds = [];
for (let index = 0; index < plan.steps.length; index += 1) {
  const step = plan.steps[index];
  stepWorlds.push(predictedWorld);
  assert.equal(step.preconditions.worldTick, predictedWorld.tick);
  assert.equal(step.preconditions.location, predictedWorld.location);
  const stepValidation = engine.validateStep(plan, index, predictedWorld);
  assert.equal(stepValidation.valid, step.expectedOutcome.valid,
    'a step is usable only when its exact precondition and simulator validity both pass');
  if (!step.expectedOutcome.valid) assert.equal(stepValidation.reason, 'step-outcome-invalid');
  const projection = environment.project(step.environmentAction, predictedWorld);
  assert.equal(step.expectedOutcome.nextWorldTick, projection.next.tick);
  assert.equal(step.expectedOutcome.nextLocation, projection.next.location);
  assert.equal(step.expectedOutcome.valid, projection.valid);
  assert.ok(Number.isFinite(step.expectedOutcome.reward));
  assert.ok(Number.isFinite(step.expectedOutcome.confidence));
  predictedWorld = projection.next;
}
const validStepIndex = plan.steps.findIndex(step => step.expectedOutcome.valid);
assert.notEqual(validStepIndex, -1, 'the deterministic fixture must contain at least one valid projected step');
const validStepWorld = stepWorlds[validStepIndex];
const tamperedStepWorld = { ...validStepWorld, location: validStepWorld.location === 'tampered-location' ? 'other-location' : 'tampered-location' };
assert.equal(engine.validateStep(plan, validStepIndex, tamperedStepWorld).reason, 'step-precondition-mismatch');
const invalidOutcomePlan = {
  ...plan,
  steps: plan.steps.map((step, index) => index === validStepIndex
    ? { ...step, expectedOutcome: { ...step.expectedOutcome, valid: false } }
    : step),
};
assert.equal(engine.validateStep(invalidOutcomePlan, validStepIndex, validStepWorld).reason, 'plan-integrity-mismatch',
  'mutating an existing plan outcome must fail the plan integrity check before step admission');

const tamperedActionPlan = {
  ...plan,
  steps: plan.steps.map((step, index) => index === validStepIndex
    ? { ...step, environmentAction: step.environmentAction === 'observe' ? 'inspect' : 'observe' }
    : step),
};
assert.deepEqual(engine.validateStep(tamperedActionPlan, validStepIndex, validStepWorld),
  { valid: false, reason: 'plan-integrity-mismatch' },
  'a changed action must invalidate the plan even when the original precondition still matches');

const tamperedOutcomePlan = {
  ...plan,
  steps: plan.steps.map((step, index) => index === validStepIndex
    ? { ...step, expectedOutcome: { ...step.expectedOutcome, reward: step.expectedOutcome.reward + 0.125 } }
    : step),
};
assert.equal(engine.validateContext(tamperedOutcomePlan, goal, initialWorld, context).reason,
  'plan-integrity-mismatch',
  'a changed expected outcome must invalidate the whole plan before runtime admission');

const changedGoal = { ...goal, progress: 0.3, updatedAt: goal.updatedAt + 1 };
assert.equal(engine.validateContext(plan, changedGoal, initialWorld, context).reason, 'goal-version-mismatch');
const changedWorld = { ...initialWorld, uncertainty: Math.min(1, initialWorld.uncertainty + 0.1) };
assert.equal(engine.validateContext(plan, goal, changedWorld, context).reason, 'world-version-mismatch');
assert.equal(engine.validateContext(plan, goal, initialWorld, { ...context, decisionId: 'decision:other' }).reason,
  'decision-mismatch');
assert.equal(engine.validateContext(plan, goal, initialWorld, { ...context, tick: context.tick + 1 }).reason,
  'decision-tick-mismatch');

const fallback = engine.buildBudgetFallback(goal, 'wait', 'planning-budget-exhausted', context);
assert.ok(fallback.lineage);
assert.equal(engine.validateContext(fallback, goal, initialWorld, context).valid, true);
assert.ok(fallback.steps[0].preconditions);
assert.ok(fallback.steps[0].expectedOutcome);

assert.deepEqual(environment.snapshot(), initialWorld,
  'planning and validation are predictive only and must not commit world changes');
const legacyContextPlan = engine.build(null, 'reflect', 1, 2);
assert.equal(engine.validateContext(legacyContextPlan, null, initialWorld, {}).valid, true);


const priorOutcomeEvent = {
  id: 'outcome:cycle-42',
  tick: 42,
  stage: 'outcome',
  external: true,
  payload: {
    planId: plan.id,
    decisionId: context.decisionId,
    goalId: goal.id,
    planAccepted: true,
    realitySource: 'external',
    decisionAction: 'verify',
    decisionPredicted01: 0.9,
    actualReward01: 0.1,
    verified01: 0.95,
    independent01: 0.92,
    evidence01: 0.9,
  },
};
const priorActionEvent = {
  id: 'action:cycle-42',
  tick: 42,
  stage: 'action',
  external: false,
  payload: {
    planId: plan.id,
    decisionId: context.decisionId,
    goalId: goal.id,
    planAccepted: true,
    action: 'verify',
  },
};
const priorPlanEvent = {
  id: 'plan:cycle-42',
  tick: 42,
  stage: 'plan',
  external: false,
  payload: {
    planId: plan.id,
    decisionId: context.decisionId,
    goalId: goal.id,
    planAccepted: true,
    nextAction: plan.steps[0].environmentAction,
  },
};
const revisionHint = derivePlanRevisionHint(
  [priorOutcomeEvent, priorActionEvent, priorPlanEvent], 43, goal.id, 0.8,
);
assert.ok(revisionHint, 'a same-goal, immediately prior, independently verified high-error outcome must produce a revision hint');
assert.equal(revisionHint.previousPlanId, plan.id);
assert.equal(revisionHint.previousDecisionId, context.decisionId);
assert.equal(revisionHint.previousTick, 42);
assert.equal(revisionHint.previousAction, 'verify');
assert.equal(revisionHint.avoidFirstAction, 'inspect');
assert.ok(Math.abs(revisionHint.predictionError01 - 0.8) < 1e-12);

const revisionContext = {
  decisionId: 'decision:cycle-43',
  tick: 43,
  revisionHint,
};
const revisedPlan = engine.build(goal, 'verify', 3, 3, revisionContext);
assert.equal(revisedPlan.lineage.revision.previousPlanId, plan.id,
  'the new plan must seal its causal link to the plan that produced the verified miss');
assert.notEqual(revisedPlan.steps[0].environmentAction, revisionHint.avoidFirstAction,
  'high-error verified feedback must keep the same failed first action out of the next plan candidate');
assert.deepEqual(engine.validateContext(revisedPlan, goal, initialWorld, revisionContext),
  { valid: true, reason: 'ok' });
assert.equal(engine.validateContext(revisedPlan, goal, initialWorld, {
  decisionId: revisionContext.decisionId, tick: revisionContext.tick,
}).reason, 'revision-context-mismatch',
  'a revision-bearing plan must not validate without its exact revision evidence');

assert.equal(derivePlanRevisionHint([priorOutcomeEvent, {
  ...priorActionEvent,
  payload: { ...priorActionEvent.payload, action: 'rest' },
}, priorPlanEvent], 43, goal.id, 0.8), null,
  'an action receipt for a different executed action must not be used as the prediction-error cause');
assert.equal(derivePlanRevisionHint([priorOutcomeEvent, priorPlanEvent], 43, goal.id, 0.8), null,
  'a plan and outcome without an exact executed-action receipt cannot form a revision');

const simulatedRevisionEvent = {
  ...priorOutcomeEvent,
  external: false,
  payload: { ...priorOutcomeEvent.payload, realitySource: 'simulation' },
};
assert.equal(derivePlanRevisionHint([simulatedRevisionEvent, priorPlanEvent], 43, goal.id, 0.8), null,
  'simulated outcomes cannot drive verified-outcome revision');
assert.equal(derivePlanRevisionHint([priorOutcomeEvent, priorPlanEvent], 43, goal.id, 0.2), null,
  'low metacognitive revision readiness must retain the existing plan search');
assert.equal(derivePlanRevisionHint([{
  ...priorOutcomeEvent,
  payload: { ...priorOutcomeEvent.payload, decisionAction: 'not-an-action' },
}, priorPlanEvent], 43, goal.id, 0.8), null,
  'unknown decision actions must not be converted into environment actions');
assert.equal(derivePlanRevisionHint([priorOutcomeEvent, priorPlanEvent], 44, goal.id, 0.8), null,
  'stale outcomes must not steer a later, unrelated decision');
assert.equal(derivePlanRevisionHint([priorOutcomeEvent, priorPlanEvent], 43, 'goal:other', 0.8), null,
  'revision evidence from another goal must not steer the active goal');

console.log('GOAL_BOUND_PLAN_LINEAGE=PASS', JSON.stringify({
  decisionId: plan.lineage.decisionId,
  goalFingerprint: plan.lineage.goal.fingerprint,
  worldTick: plan.lineage.world.tick,
  steps: plan.steps.length,
  fallbackBound: fallback.lineage.decisionId === context.decisionId,
}));
