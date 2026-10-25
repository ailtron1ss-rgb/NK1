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
}, 'calm routing must preserve the resource allocator budget');

const active = resolveCognitiveRoutingPolicy({
  wakeMask: 8,
  interrupt: { active: true, priority01: 0.78, type: 'goal-pressure', domains: ['agency'] },
}, 3);
assert.equal(active.maxCounterfactualBranches, 1, 'active interruption can only reduce speculative branches');
assert.equal(active.allowMatchedCounterfactual, false, 'active interruption disables optional alternative projection work');
assert.equal(active.reason, 'active-interrupt');

const critical = resolveCognitiveRoutingPolicy({
  wakeMask: 64,
  interrupt: { active: true, priority01: 0.84, type: 'thermal-critical', domains: ['governance', 'embodiment'] },
}, 3);
assert.equal(critical.maxCounterfactualBranches, 0, 'critical resource interrupts must stop optional counterfactuals');
assert.equal(critical.allowMatchedCounterfactual, false);
assert.equal(critical.reason, 'critical-interrupt');

const governance = resolveCognitiveRoutingPolicy({
  wakeMask: 64,
  interrupt: { active: false, priority01: 0, type: 'none', domains: [] },
}, 2);
assert.equal(governance.maxCounterfactualBranches, 1, 'governance pressure is capped without overriding the action');
assert.equal(governance.allowMatchedCounterfactual, false);
assert.equal(governance.reason, 'governance-pressure');

const neverExpands = resolveCognitiveRoutingPolicy({
  wakeMask: 0,
  interrupt: { active: false, priority01: 0, type: 'none', domains: [] },
}, 99);
assert.equal(neverExpands.maxCounterfactualBranches, 3, 'routing must never expand the upstream resource budget');

const invalidBudget = resolveCognitiveRoutingPolicy({
  wakeMask: 0,
  interrupt: { active: false, priority01: 0, type: 'none', domains: [] },
}, Number.NaN);
assert.equal(invalidBudget.maxCounterfactualBranches, 0, 'invalid budget input must fail closed');

console.log('Cognitive routing policy: PASS');
