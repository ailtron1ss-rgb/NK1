import { hyperPlasticBudgetPortFromCore, HyperPlasticRuntimeBridge } from '../src/organism/research/HyperPlasticRuntimeBridge.ts';
import assert from 'node:assert/strict';
import { CognitiveBudgetManager } from '../src/organism/cognition/CognitiveBudgetManager.ts';
import { B292CognitiveStateBus, defaultB292CognitiveStateBus } from '../src/organism/system/B292CognitiveStateBus.ts';
import { HyperPlasticNetwork } from '../src/organism/research/HyperPlasticNetwork.ts';

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


const duplicateTickBudget = new CognitiveBudgetManager();
const duplicateTick = bridge.propose({
  state,
  taskType: 'reasoning',
  strategy: 'verify',
  confidence01: 0.86,
  baseModelFingerprint,
  budgetManager: duplicateTickBudget,
});
assert.equal(duplicateTick.status, 'blocked');
assert.equal(duplicateTick.reason, 'duplicate-tick');
assert.equal(duplicateTickBudget.snapshot().operationCount, 0,
  'a single B292 tick must never spend the same research budget twice');

const invalidFingerprintBudget = new CognitiveBudgetManager();
const invalidFingerprintBridge = new HyperPlasticRuntimeBridge(new HyperPlasticNetwork({
  target: { layer: 'attention.query', rows: 4, cols: 4 }, rank: 2, hiddenDim: 12, seed: 26029,
}));
const invalidFingerprint = invalidFingerprintBridge.propose({
  state: { ...state, tick: 10 },
  taskType: 'reasoning',
  strategy: 'verify',
  confidence01: 0.86,
  baseModelFingerprint: 'fixture-not-a-sha256-model-id',
  budgetManager: invalidFingerprintBudget,
});
assert.equal(invalidFingerprint.status, 'blocked');
assert.equal(invalidFingerprint.reason, 'base-model-fingerprint-invalid');
assert.equal(invalidFingerprintBudget.snapshot().operationCount, 0,
  'invalid model identity must be rejected before charging the canonical budget');

const deferredStrategyBudget = new CognitiveBudgetManager();
const deferredStrategy = new HyperPlasticRuntimeBridge(new HyperPlasticNetwork({
  target: { layer: 'attention.query', rows: 4, cols: 4 }, rank: 2, hiddenDim: 12, seed: 26030,
})).propose({
  state: { ...state, tick: 12 },
  taskType: 'planning',
  strategy: 'defer',
  confidence01: 0.8,
  baseModelFingerprint,
  budgetManager: deferredStrategyBudget,
});
assert.equal(deferredStrategy.status, 'blocked');
assert.equal(deferredStrategy.reason, 'strategy-deferred');
assert.equal(deferredStrategyBudget.snapshot().operationCount, 0,
  'a deferred strategy must not generate or charge a plasticity candidate');

const deferBudget = new CognitiveBudgetManager();
deferBudget.restore({ ...deferBudget.snapshot(), mode: 'defer', remaining01: 0.8 });
const deferred = bridge.propose({
  state: { ...state, tick: 1 },
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
  state: { ...state, tick: 2 },
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
  state: { ...unstableState, tick: 3 },
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
  state: { ...state, tick: 4 },
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

const authorityCalls = [];
const fakeCoreBudgetAuthority = {
  cognitiveBudgetOperationalSnapshot() {
    authorityCalls.push(['snapshot']);
    return { mode: 'shallow', remaining01: 0.8, available01: 0.8, estimatedCost01: 0, expectedInformationGain01: 0, rationale: 'fixture', updatedAt: 0, spent01: 0, operationCount: 0, informationGainRealized01: 0 };
  },
  cognitiveBudgetEstimateCost(operation, context) { authorityCalls.push(['estimate', operation, context]); return 0.1; },
  cognitiveBudgetCanSpend(operation, cost) { authorityCalls.push(['canSpend', operation, cost]); return true; },
  cognitiveBudgetSpend(operation, cost, gain, reason) {
    authorityCalls.push(['spend', operation, cost, gain, reason]);
    return { accepted: true, spent01: cost, remaining01: 0.7, reason: 'budget-accepted' };
  },
};
const coreOwnedBudgetPort = hyperPlasticBudgetPortFromCore(fakeCoreBudgetAuthority);
const coreBridge = new HyperPlasticRuntimeBridge(new HyperPlasticNetwork({
  target: { layer: 'attention.query', rows: 4, cols: 4 }, rank: 2, hiddenDim: 12, seed: 26028,
}));
const coreOwnedProposal = coreBridge.propose({
  state, taskType: 'reasoning', strategy: 'verify', confidence01: 0.86,
  baseModelFingerprint, budgetManager: coreOwnedBudgetPort,
});
assert.equal(coreOwnedProposal.status, 'shadow-candidate');
assert.ok(authorityCalls.some(call => call[0] === 'estimate' && call[1] === 'research'));
assert.ok(authorityCalls.some(call => call[0] === 'canSpend' && call[1] === 'research'));
assert.ok(authorityCalls.some(call => call[0] === 'spend' && call[1] === 'research' && call[4] === 'ome26-hyper-plastic-shadow'));
assert.equal(authorityCalls.filter(call => call[0] === 'spend').length, 1,
  'Core-owned adapter must debit exactly once through the canonical budget method');
console.log('OME26_CORE_BUDGET_PORT=PASS', JSON.stringify({calls:authorityCalls.map(x=>x[0]),singleOwner:true}));
