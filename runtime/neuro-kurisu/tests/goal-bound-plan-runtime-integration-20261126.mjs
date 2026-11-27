import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const directory = await mkdtemp(path.join(tmpdir(), 'nk1-goal-plan-lineage-'));
const runtime = new OrganismRuntime({
  stateFile: path.join(directory, 'state.json'),
  worldStateFile: path.join(directory, 'world.json'),
  enableLanguage: false,
  enableScientificMethod: true,
  stateStore: new MemoryStateStore(),
  worldStateStore: new MemoryStateStore(),
  journal: new BoundedOperationalJournal(),
  performanceProfile: 'mobile',
  cycleResultMode: 'summary',
});
const planCalls = [];
try {
  await runtime.init();
  let cycleEventInput = null;
  const eventFabric = runtime.cognitiveEventFabric;
  const recordOperationalCycle = eventFabric.recordOperationalCycle.bind(eventFabric);
  eventFabric.recordOperationalCycle = input => {
    cycleEventInput = input;
    return recordOperationalCycle(input);
  };
  const build = runtime.plans.build.bind(runtime.plans);
  const fallback = runtime.plans.buildBudgetFallback.bind(runtime.plans);
  runtime.plans.build = (goal, preferred, depth, width, context) => {
    const plan = build(goal, preferred, depth, width, context);
    const world = runtime.environment.snapshot();
    const contextCheck = runtime.plans.validateContext(plan, goal, world, context);
    const stepCheck = runtime.plans.validateStep(plan, 0, world);
    planCalls.push({ kind: 'beam', goal, context, plan, contextValid: contextCheck.valid, stepValid: stepCheck.valid, accepted: contextCheck.valid && stepCheck.valid });
    return plan;
  };
  runtime.plans.buildBudgetFallback = (goal, preferred, reason, context) => {
    const plan = fallback(goal, preferred, reason, context);
    const world = runtime.environment.snapshot();
    const contextCheck = runtime.plans.validateContext(plan, goal, world, context);
    const stepCheck = runtime.plans.validateStep(plan, 0, world);
    planCalls.push({ kind: 'fallback', goal, context, plan, contextValid: contextCheck.valid, stepValid: stepCheck.valid, accepted: contextCheck.valid && stepCheck.valid });
    return plan;
  };

  const result = await runtime.autonomousStep({ deliberate: false });
  assert.equal(planCalls.length, 1, 'one runtime cycle must compile exactly one plan or bounded fallback');
  const [call] = planCalls;
  assert.ok(result.cycle?.decision?.id, 'runtime cycle must expose the canonical decision ID');
  assert.equal(call.context?.decisionId, result.cycle.decision.id,
    'the live planner call must receive the exact decision ID returned by the same runtime cycle');
  assert.equal(call.context?.tick, result.cycle.decision.tick,
    'the live planner call must receive the exact canonical decision tick');
  assert.equal(call.plan.lineage.decisionId, result.cycle.decision.id);
  assert.equal(call.plan.lineage.decisionTick, result.cycle.decision.tick);
  assert.equal(call.plan.lineage.goal.id, call.goal?.id ?? null);
  assert.match(call.plan.lineage.world.fingerprint, /^[a-f0-9]{64}$/);
  assert.ok(call.plan.steps.length > 0);
  assert.ok(call.plan.steps.every(step => step.preconditions && step.expectedOutcome),
    'the real runtime plan must preserve step preconditions and expected outcomes');
  assert.ok(cycleEventInput, 'the real runtime must record its operational cognitive cycle');
  for (const stage of ['plan', 'action', 'outcome']) {
    assert.equal(cycleEventInput[stage].payload.planId, call.plan.id,
      'the same PlanEngine plan ID must survive the plan/action/outcome causal stages');
    assert.equal(cycleEventInput[stage].payload.goalId, call.plan.lineage.goal.id,
      'the same exact goal identity must survive the plan/action/outcome causal stages');
    assert.equal(cycleEventInput[stage].payload.planAccepted, call.accepted,
      'plan/action/outcome must agree on the combined context and step validation result');
  }
  assert.equal(cycleEventInput.plan.payload.contextValid, call.contextValid,
    'the plan event must distinguish valid root context from first-step acceptance');
  assert.equal(cycleEventInput.goal.payload.selectedGoalId, call.plan.lineage.goal.id,
    'the prior-cycle goal receipt must carry the same selected goal used by the plan');
  assert.equal(cycleEventInput.action.payload.decisionId, result.cycle.decision.id,
    'the executed-action receipt must carry the same canonical decision ID');
  assert.equal(cycleEventInput.outcome.payload.decisionId, result.cycle.decision.id,
    'the outcome receipt must carry the same canonical decision ID');
  assert.equal(cycleEventInput.outcome.payload.decisionAction, cycleEventInput.action.payload.action,
    'the outcome prediction must be attributed to the action that the embodiment path actually executed');
  const executedActionPrediction = result.cycle.decision.predictedOutcomes.find(
    candidate => candidate.action === cycleEventInput.action.payload.action,
  )?.utility;
  const expectedExecutedActionPrediction = typeof executedActionPrediction === 'number' && Number.isFinite(executedActionPrediction)
    ? Math.max(0, Math.min(1, executedActionPrediction))
    : null;
  assert.equal(cycleEventInput.outcome.payload.decisionPredicted01, expectedExecutedActionPrediction,
    'the recorded decision prediction must come from the same executed ActionKind, never the planner hypothetical');
  assert.ok(Number.isFinite(cycleEventInput.outcome.payload.actualReward01)
      && cycleEventInput.outcome.payload.actualReward01 >= 0
      && cycleEventInput.outcome.payload.actualReward01 <= 1,
    'the observed outcome used for revision must remain normalized to 0..1');
  const expectedSignedReward = call.accepted ? call.plan.steps[0].predictedReward : 0;
  const expectedReward01 = Math.max(0, Math.min(1, (expectedSignedReward + 1) / 2));
  assert.equal(cycleEventInput.prediction.payload.predicted01, expectedReward01,
    'the live runtime prediction event must normalize signed PlanEngine reward to 0..1');
  console.log('GOAL_BOUND_PLAN_RUNTIME_INTEGRATION=PASS', JSON.stringify({
    kind: call.kind,
    decisionId: call.context.decisionId,
    decisionTick: call.context.tick,
    goalId: call.plan.lineage.goal.id,
    stepCount: call.plan.steps.length,
  }));
} finally {
  await runtime.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
