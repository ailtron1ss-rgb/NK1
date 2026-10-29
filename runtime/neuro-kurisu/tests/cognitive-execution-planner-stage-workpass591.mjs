import assert from 'node:assert/strict';
import { compileObservationPlan } from '../src/organism/core/ObservationPlanningStage.ts';
import { CognitiveExecutionPlanner } from '../src/organism/core/CognitiveExecutionPlanner.ts';
import { organismSystemContracts } from '../src/organism/core/OrganismSystemContract.ts';

const remainingBudget = .75;
const state = {
  tick: 41,
  at: 2_000_000_000_000,
  predictionError: .2,
  selfPredictionError: .1,
  needs: {
    energy: .9,
    cognitiveLoad: .1,
    uncertainty: .3,
    novelty: .8,
    goalPressure: .5,
    socialNeed: .2,
  },
};
const observation = {
  text: 'Verify the unexpected result and plan the next project step',
  surprise: .9,
  novelty: .9,
  externalGoal: 'investigate unexpected result',
  embodiment: {
    bodyEnergy01: .9,
    cognitiveCapacity01: .9,
    thermalStrain01: .1,
    ramPressure01: .1,
    battery01: .9,
    awake: true,
  },
};
const spine = {
  mode: 'deep',
  run: { research: true, 'world-rollout': true, shadow: true, project: true },
  cadence: { research: 1, 'world-rollout': 1, shadow: 1, project: 1 },
  reason: 'planner-stage-integration-fixture',
};
let resourceInput;
let pressureInput;
let spineInput;
let economyWritten;
let writtenPlan;
let budgetReads = 0;
const host = {
  resourceAllocator: {
    decide(input) { resourceInput = input; return { mode: 'normal', budget01: remainingBudget }; },
  },
  cognitiveResourceEconomy: {
    allocate(input) { return { ...input, totalBudget01: remainingBudget }; },
    planningSnapshot() { return { remainingBudget01: remainingBudget, allocationWritten: true }; },
  },
  cognitivePressureField: {
    compile(input) {
      pressureInput = input;
      return { domains: {}, sources: { shadowEscalation01: 0 }, informationUrgency01: 0 };
    },
  },
  cognitiveSpineScheduler: {
    decide(input) { spineInput = input; return structuredClone(spine); },
  },
  cognitiveExecutionPlanner: new CognitiveExecutionPlanner(),
  contracts: organismSystemContracts(),
  snapshotPredictionDebt() { return { meanPriority01: .2, meanError01: .2, count: 1 }; },
  snapshotGroundedWorld() { return { uncertainty01: .3, conflict01: .1, confidence01: .7 }; },
  snapshotExternalObserver() { return { unresolvedCount: 0, observations: 1, assessments: 1, contradictedCount: 0, verificationRate01: 1 }; },
  snapshotShadow() { return { ensembleDisagreement01: .1, escalations: 0, recent: [] }; },
  snapshotCognitiveField() { return { tick: state.tick, channels: [] }; },
  getBudget() { budgetReads++; return budgetReads === 1 ? { mode: 'normal', remaining01: remainingBudget } : { mode: 'protect', remaining01: .1 }; },
  writeCognitiveResourceEconomy(value) { economyWritten = structuredClone(value); },
  writeExecutionPlan(value) { writtenPlan = structuredClone(value); },
};

const result = compileObservationPlan({ state, observation, host });
const plan = result.cognitiveExecutionPlan;
const plannedCost = Object.values(plan.cost01).reduce((sum, cost) => sum + cost, 0);

assert.equal(result.cognitiveFrame.tick, state.tick + 1);
assert.equal(resourceInput.externalInput, true);
assert.equal(spineInput.externalInput, true);
assert.equal(budgetReads, 1, 'one observation plan must use one consistent budget snapshot');
assert.equal(spineInput.budgetMode, 'normal', 'spine scheduler must use the same captured budget mode');
assert.equal(spineInput.remainingBudget01, remainingBudget, 'spine scheduler must use the captured remaining budget');
assert.ok(pressureInput.predictionDebt);
assert.equal(result.cognitiveResourceAllocation.totalBudget01, remainingBudget);
assert.ok(plannedCost <= remainingBudget + 1e-9,
  'the integrated observation stage must pass the effective resource limit into planning');
assert.equal(plan.run.project, true,
  'the integrated stage should preserve affordable warm project work under budget pressure');
assert.equal(plan.run.research, false,
  'the integrated stage must not let cold research pre-empt warm work');
assert.equal(result.perceptionRefresh, plan.run.perception,
  'perception refresh must be derived from the same budgeted execution plan');
assert.deepEqual(writtenPlan, plan,
  'the exact plan returned to the caller must be the one written to canonical runtime state');
assert.deepEqual(economyWritten, { remainingBudget01: remainingBudget, allocationWritten: true });
console.log('COGNITIVE_EXECUTION_PLANNER_STAGE=PASS', JSON.stringify({
  tick: plan.tick, remainingBudget, plannedCost, run: plan.run, cost01: plan.cost01,
}));
