import assert from 'node:assert/strict';
import { CognitiveResourceEconomy } from '../src/organism/system/CognitiveResourceEconomy.ts';

const economy = new CognitiveResourceEconomy();
const defaults = economy.snapshot();
assert.equal(defaults.version, 1);
assert.equal(defaults.cycles, 0);
assert.equal(defaults.totalBudget01, 0.82);
assert.equal(defaults.scarcity01, 0.18);

economy.restore({
  version: 1,
  cycles: Infinity,
  totalBudget01: NaN,
  attentionBudget01: '0.7',
  simulationBudget01: 2,
  learningBudget01: -1,
  memoryBudget01: 0.6,
  externalInteractionBudget01: 0.4,
  predictionDebt01: Infinity,
  scarcity01: NaN,
  lastMode: 'authoritarian',
  performancePressure01: -5,
  lastAt: Infinity,
  lastTick: 3.5,
  extraKey: true,
});
const restored = economy.snapshot();
assert.equal(restored.cycles, 0);
assert.equal(restored.totalBudget01, defaults.totalBudget01);
assert.equal(restored.attentionBudget01, defaults.attentionBudget01);
assert.equal(restored.simulationBudget01, 1);
assert.equal(restored.learningBudget01, 0);
assert.equal(restored.memoryBudget01, 0.6);
assert.equal(restored.externalInteractionBudget01, 0.4);
assert.equal(restored.predictionDebt01, 0);
assert.equal(restored.scarcity01, defaults.scarcity01);
assert.equal(restored.lastMode, defaults.lastMode);
assert.equal(restored.performancePressure01, 0);
assert.equal(restored.lastAt, 0);
assert.equal(restored.lastTick, -1);
assert.equal('extraKey' in restored, false);

const beforeUnsupported = economy.snapshot();
assert.throws(() => economy.restore({ version: 2 }), /unsupported cognitive-resource-economy state version/);
assert.deepEqual(economy.snapshot(), beforeUnsupported, 'unsupported schema must not partially mutate live state');

const allocation = economy.allocate({ tick: NaN, at: Infinity, energy01: NaN, cognitiveLoad01: 0.2, uncertainty01: 0.4, novelty01: 0.7, thermalStrain01: 0.1, ramPressure01: 0.2 });
assert.equal(economy.snapshot().lastTick, 0, 'invalid ticks must normalize to a non-negative integer');
assert.ok(Number.isFinite(economy.snapshot().lastAt) && economy.snapshot().lastAt >= 0);
assert.ok(Number.isFinite(allocation.totalBudget01) && allocation.totalBudget01 >= 0 && allocation.totalBudget01 <= 1);
for (const key of ['attention01','simulation01','learning01','memory01','externalInteraction01','scarcity01']) {
  assert.ok(Number.isFinite(allocation[key]) && allocation[key] >= 0 && allocation[key] <= 1, key + ' must remain bounded');
}

economy.restore({ version: 1, cycles: Number.MAX_SAFE_INTEGER, lastTick: Number.MAX_SAFE_INTEGER, totalBudget01: 0.5 });
economy.allocate({ tick: Number.MAX_SAFE_INTEGER + 1, at: Date.now(), energy01: 0.8 });
assert.equal(economy.snapshot().cycles, Number.MAX_SAFE_INTEGER, 'cycle counter must saturate safely');
assert.equal(economy.snapshot().lastTick, Number.MAX_SAFE_INTEGER, 'tick must remain within safe integer range');

const copy = economy.snapshot();
copy.cycles = 1;
assert.equal(economy.snapshot().cycles, Number.MAX_SAFE_INTEGER, 'snapshot must not expose mutable live state');

console.log('WorkPass322 cognitive resource restore hardening: PASS');
