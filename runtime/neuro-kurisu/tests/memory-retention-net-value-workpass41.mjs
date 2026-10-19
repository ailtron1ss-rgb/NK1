import assert from 'node:assert/strict';
import { MemoryRetentionEconomy } from '../src/organism/system/MemoryRetentionEconomy.ts';

const inputs = {
  tick: 1,
  salience01: .02,
  identity01: 0,
  goal01: 0,
  predictionError01: .01,
  emotion01: 0,
  novelty01: 0,
  redundancy01: .95,
  storageCost01: .9,
};
const low = new MemoryRetentionEconomy().assess(inputs);
assert.equal(low.action, 'discard-candidate', 'highly redundant, costly and low-value records should not occupy the canonical memory just because the byte budget is not full');
assert.ok(low.score01 < .22);

const important = new MemoryRetentionEconomy().assess({
  ...inputs, tick: 2, salience01: .95, identity01: .95, goal01: .9,
  predictionError01: .8, emotion01: .85, novelty01: .8, redundancy01: .02,
  storageCost01: .1, provenanceConfidence01: .95,
});
assert.equal(important.action, 'retain', 'high-salience identity- and goal-relevant experience should survive retention policy');

const weakEvidence = new MemoryRetentionEconomy().assess({ ...inputs, tick: 3, provenanceConfidence01: 0 });
const strongEvidence = new MemoryRetentionEconomy().assess({ ...inputs, tick: 4, provenanceConfidence01: 1 });
assert.ok(strongEvidence.score01 > weakEvidence.score01, 'provenance must affect retention decision outside budget pressure');

const pressured = new MemoryRetentionEconomy().assess({ ...inputs, tick: 5, memoryBytesUsed: 500_000, memoryByteBudget: 524_288 });
assert.ok(pressured.budgetPressure01 > .9, "byte pressure must feed retention value-per-byte blend");
assert.equal(pressured.action, 'discard-candidate');

const roundtrip = new MemoryRetentionEconomy();
roundtrip.restore({ ...new MemoryRetentionEconomy().snapshot(), recent: [low, important, weakEvidence, strongEvidence, pressured] });
assert.equal(roundtrip.snapshot().recent.length, 5);
console.log(JSON.stringify({ pass: true, checks: 5, lowValue: low.action, identityValue: important.action, provenanceInfluencesScore: true, pressure01: pressured.budgetPressure01 }));
