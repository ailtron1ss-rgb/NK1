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
  const build = runtime.plans.build.bind(runtime.plans);
  const fallback = runtime.plans.buildBudgetFallback.bind(runtime.plans);
  runtime.plans.build = (goal, preferred, depth, width, context) => {
    const plan = build(goal, preferred, depth, width, context);
    planCalls.push({ kind: 'beam', goal, context, plan });
    return plan;
  };
  runtime.plans.buildBudgetFallback = (goal, preferred, reason, context) => {
    const plan = fallback(goal, preferred, reason, context);
    planCalls.push({ kind: 'fallback', goal, context, plan });
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
