import assert from 'node:assert/strict';
import { CognitiveBudgetManager } from '../src/organism/cognition/CognitiveBudgetManager.ts';
import { B292CognitiveStateBus, defaultB292CognitiveStateBus } from '../src/organism/system/B292CognitiveStateBus.ts';
import { HyperPlasticNetwork } from '../src/organism/research/HyperPlasticNetwork.ts';
import { HyperPlasticRuntimeBridge } from '../src/organism/research/HyperPlasticRuntimeBridge.ts';

const baseModelFingerprint = `sha256:${'a'.repeat(64)}`;
const bus = new B292CognitiveStateBus();
bus.restore(defaultB292CognitiveStateBus());
const state = bus.snapshot();
const budget = new CognitiveBudgetManager();
const bridge = new HyperPlasticRuntimeBridge(new HyperPlasticNetwork({
  target: { layer: 'attention.query', rows: 4, cols: 4 },
  rank: 2,
  hiddenDim: 12,
  seed: 26027,
}));

const result = bridge.propose({
  state,
  taskType: 'reasoning',
  strategy: 'verify',
  confidence01: 0.86,
  baseModelFingerprint,
  budgetManager: budget,
});
assert.equal(result.status, 'shadow-candidate');
assert.equal(result.reason, 'generated');
assert.equal(result.adapter.schema, 'nk1-lora-v1');
assert.ok(result.budgetSpent01 > 0);
assert.equal(budget.snapshot().operationCount, 1,
  'one generated shadow candidate must consume exactly one research budget operation');
assert.equal(budget.ledgerSnapshot().length, 1);
assert.equal(budget.ledgerSnapshot()[0].accepted, true);
assert.equal(bridge.snapshot().proposals, 1);
assert.equal(bridge.snapshot().lastStatus, 'shadow-candidate');

const deferBudget = new CognitiveBudgetManager();
deferBudget.restore({ ...deferBudget.snapshot(), mode: 'defer', remaining01: 0.8 });
const deferred = bridge.propose({
  state,
  taskType: 'reasoning',
  strategy: 'verify',
  confidence01: 0.8,
  baseModelFingerprint,
  budgetManager: deferBudget,
});
assert.deepEqual(deferred, {
  status: 'blocked',
  reason: 'budget-mode-blocked:defer',
  adapter: null,
  budgetSpent01: 0,
  remainingBudget01: 0.8,
});
assert.equal(deferBudget.snapshot().operationCount, 0);

const scarceBudget = new CognitiveBudgetManager();
scarceBudget.restore({ ...scarceBudget.snapshot(), remaining01: 0.1, available01: 0.1 });
const scarce = bridge.propose({
  state,
  taskType: 'reasoning',
  strategy: 'verify',
  confidence01: 0.8,
  baseModelFingerprint,
  budgetManager: scarceBudget,
});
assert.equal(scarce.status, 'blocked');
assert.equal(scarce.reason, 'resource-budget-below-floor');
assert.equal(scarceBudget.snapshot().operationCount, 0);

const unstableState = { ...state, readiness01: 0.1 };
const unstableBudget = new CognitiveBudgetManager();
const unstable = bridge.propose({
  state: unstableState,
  taskType: 'reasoning',
  strategy: 'verify',
  confidence01: 0.8,
  baseModelFingerprint,
  budgetManager: unstableBudget,
});
assert.equal(unstable.status, 'blocked');
assert.equal(unstable.reason, 'cognitive-state-not-ready');
assert.equal(unstableBudget.snapshot().operationCount, 0);

const invalidConfidence = bridge.propose({
  state,
  taskType: 'reasoning',
  strategy: 'verify',
  confidence01: Number.NaN,
  baseModelFingerprint,
  budgetManager: new CognitiveBudgetManager(),
});
assert.equal(invalidConfidence.status, 'blocked');
assert.equal(invalidConfidence.reason, 'cognitive-context-invalid');

console.log('OME26_RUNTIME_BUDGET_BRIDGE=PASS', JSON.stringify({
  generated: bridge.snapshot().proposals,
  blocked: bridge.snapshot().blocked,
  budgetRejected: bridge.snapshot().budgetRejected,
  oneSpendPerProposal: true,
  liveActivation: false,
}));
