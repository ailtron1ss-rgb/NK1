import assert from 'node:assert/strict';
import { resolveCognitiveRoutingPolicy } from '../src/organism/core/CognitiveRoutingPolicy.ts';

const calm = resolveCognitiveRoutingPolicy({
  wakeMask: 0,
  interrupt: { active: false, priority01: 0.1, type: 'none', domains: [] },
}, 3);
assert.deepEqual(calm, {
  maxCounterfactualBranches: 3,
  allowMatchedCounterfactual: true,
  reason: 'resource-budget',
  interruptPriority01: 0.1,
  cognitiveCycleDelayMultiplier01: 1,
}, 'calm routing must preserve the resource allocator budget');

const active = resolveCognitiveRoutingPolicy({
  wakeMask: 8,
  interrupt: { active: true, priority01: 0.78, type: 'goal-pressure', domains: ['agency'] },
}, 3);
assert.equal(active.maxCounterfactualBranches, 1, 'active interruption can only reduce speculative branches');
assert.equal(active.allowMatchedCounterfactual, false, 'active interruption disables optional alternative projection work');
assert.equal(active.reason, 'active-interrupt');
assert.ok(active.cognitiveCycleDelayMultiplier01 < 1 && active.cognitiveCycleDelayMultiplier01 >= 0.75,
  'non-resource interrupts may advance the next cognitive cycle by at most 25%');

const critical = resolveCognitiveRoutingPolicy({
  wakeMask: 64,
  interrupt: { active: true, priority01: 0.84, type: 'thermal-critical', domains: ['governance', 'embodiment'] },
}, 3);
assert.equal(critical.maxCounterfactualBranches, 0, 'critical resource interrupts must stop optional counterfactuals');
assert.equal(critical.allowMatchedCounterfactual, false);
assert.equal(critical.reason, 'critical-interrupt');
assert.equal(critical.cognitiveCycleDelayMultiplier01, 1, 'critical resource interrupts must not accelerate CPU work');

const highPriority = resolveCognitiveRoutingPolicy({
  wakeMask: 8,
  interrupt: { active: true, priority01: 0.95, type: 'prediction-error', domains: ['agency'] },
}, 3);
assert.equal(highPriority.maxCounterfactualBranches, 0, 'a numerically critical interrupt must deny optional simulations independently of its label');
assert.ok(highPriority.cognitiveCycleDelayMultiplier01 < 1, 'urgent non-resource interrupts should advance the next cognitive cycle');
assert.equal(highPriority.allowMatchedCounterfactual, false);

const governance = resolveCognitiveRoutingPolicy({
  wakeMask: 64,
  interrupt: { active: false, priority01: 0, type: 'none', domains: [] },
}, 2);
assert.equal(governance.maxCounterfactualBranches, 1, 'governance pressure is capped without overriding the action');
assert.equal(governance.allowMatchedCounterfactual, false);
assert.equal(governance.reason, 'governance-pressure');
assert.equal(governance.cognitiveCycleDelayMultiplier01, 1);

const neverExpands = resolveCognitiveRoutingPolicy({
  wakeMask: 0,
  interrupt: { active: false, priority01: 0, type: 'none', domains: [] },
}, 99);
assert.equal(neverExpands.maxCounterfactualBranches, 3, 'routing must never expand the upstream resource budget');

const zeroBudget = resolveCognitiveRoutingPolicy({
  wakeMask: 0,
  interrupt: { active: false, priority01: 0, type: 'none', domains: [] },
}, 0);
assert.equal(zeroBudget.maxCounterfactualBranches, 0);
assert.equal(zeroBudget.allowMatchedCounterfactual, false, 'zero branch budget must disable optional alternate projections');

const invalidBudget = resolveCognitiveRoutingPolicy({
  wakeMask: 0,
  interrupt: { active: false, priority01: 0, type: 'none', domains: [] },
}, Number.NaN);
assert.equal(invalidBudget.maxCounterfactualBranches, 0, 'invalid budget input must fail closed');

const fractionalBudget = resolveCognitiveRoutingPolicy({
  wakeMask: 0,
  interrupt: { active: false, priority01: 0, type: 'none', domains: [] },
}, 2.9);
assert.equal(fractionalBudget.maxCounterfactualBranches, 2, 'fractional branch capacity must be rounded down');

console.log('Cognitive routing policy: PASS');
