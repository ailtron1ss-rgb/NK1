import assert from 'node:assert/strict';
import { CognitiveExecutionPlanner } from '../src/organism/core/CognitiveExecutionPlanner.ts';
import { organismSystemContracts } from '../src/organism/core/OrganismSystemContract.ts';

const domains = {
  self: true, world: true, memory: true, agency: true,
  embodiment: true, research: true, governance: true,
};
const frame = {
  version: 1,
  tick: 8,
  at: 2_000_000_000_000,
  externalInput: true,
  signalMask: 1,
  domains,
  dirtyDomains: { ...domains },
  attentionBudget01: .9,
  deepDemand01: .95,
  surprise01: .9,
  novelty01: .9,
  predictionError01: .9,
  uncertainty01: .9,
  goalPressure01: .9,
  energy01: .9,
  cognitiveCapacity01: .9,
  thermal01: .1,
  ramPressure01: .1,
  complexity01: .35,
  expectedInformationGain01: .9,
  wakeMask: 1,
  interrupt: { active: true, priority01: .99, type: 'urgent-input', domains: ['agency', 'memory'] },
  reason: 'aggregate-budget-regression',
};
const spine = {
  mode: 'deep',
  run: { research: true, 'world-rollout': true, shadow: true, project: true },
  cadence: { research: 1, 'world-rollout': 1, shadow: 1, project: 1 },
  reason: 'high-demand fixture',
};
const planner = new CognitiveExecutionPlanner();
const budget = .25;
const plan = planner.compile(frame, spine, budget, undefined, organismSystemContracts());
const allocated = Object.values(plan.cost01).reduce((sum, cost) => sum + cost, 0);

assert.ok(plan.stats.perception.runs > 0, 'the low-cost perception path should run first');
assert.ok(plan.stats.memory.runs > 0, 'the low-cost memory path should run before optional expensive work');
assert.ok(allocated <= budget + 1e-9,
  'aggregate operation cost must never exceed the remaining compute budget, even when forced');
assert.equal(plan.run.research, false,
  'forced/high-demand status must not bypass the aggregate budget gate for expensive research');
assert.equal(plan.stats.research.lastReason.includes('budget-exhausted'), true,
  'budget-blocked operations must record an explicit diagnostic reason');
assert.equal(plan.run['world-rollout'], true,
  'an affordable world rollout should remain eligible before the budget is exhausted');
assert.ok(Object.values(plan.run).some(Boolean), 'budget limiting should allocate useful work rather than skip every operation');
console.log('COGNITIVE_EXECUTION_PLANNER_BUDGET=PASS', JSON.stringify({ budget, allocated, run: plan.run, cost01: plan.cost01 }));
