import test from "node:test";
import assert from "node:assert/strict";
import { compareReplayStrategies } from "../src/learning/replay-strategy-comparison-workpass75.mjs";

const run = (seed, reward, overrides = {}) => ({
  seed, reward, regret: 1 - reward, success: reward >= 0.7,
  confidence: 0.8, correct: reward >= 0.7, latencyMs: 100,
  memoryBytes: 512, retentionScore: 0.6, transferScore: 0.4,
  ...overrides
});
const fixture = () => ({
  strategies: [
    { id: "no-replay", memoryBudgetBytes: 4096, runs: [1, 2, 3, 4].map(seed => run(seed, 0.6)) },
    { id: "uniform-replay", memoryBudgetBytes: 4096, runs: [1, 2, 3, 4].map(seed => run(seed, 0.8, {
      retentionScore: 0.75, transferScore: 0.45, memoryBytes: 1024
    })) },
    { id: "prioritized-replay", memoryBudgetBytes: 4096, runs: [1, 2, 3, 4].map(seed => run(seed, 0.78, {
      retentionScore: 0.8, transferScore: 0.5, memoryBytes: 2048, latencyMs: 110
    })) }
  ]
});

test("compares replay strategies on paired seeds and a shared memory budget", () => {
  const report = compareReplayStrategies(fixture());
  assert.equal(report.kind, "nk1.replay-strategy-comparison-report");
  assert.equal(report.sharedHoldoutSeedCount, 4);
  assert.equal(report.sharedMemoryBudgetBytes, 4096);
  assert.equal(report.comparisons.length, 2);
  assert.ok(Math.abs(report.comparisons[0].pairedMeanRewardDelta - 0.2) < 1e-12);
  assert.ok(Math.abs(report.comparisons[0].pairedMeanRetentionDelta - 0.15) < 1e-12);
  assert.equal(report.comparisons[0].candidateWithinBudgetForEveryRun, true);
  assert.equal(report.comparisons.every(row => row.promotionEligible === false), true);
  assert.equal(report.interpretation.replayIsNotAssumedBeneficial, true);
});

test("rejects unequal seed sets instead of silently comparing different holdouts", () => {
  const input = fixture();
  input.strategies[1].runs[3] = run(99, 0.8);
  assert.throws(() => compareReplayStrategies(input), /exactly the baseline holdout seeds/);
});

test("rejects unequal memory budgets and invalid auxiliary scores", () => {
  const budgetMismatch = fixture();
  budgetMismatch.strategies[1].memoryBudgetBytes = 8192;
  assert.throws(() => compareReplayStrategies(budgetMismatch), /same declared memory budget/);
  const invalidScore = fixture();
  invalidScore.strategies[1].runs[0].retentionScore = 1.1;
  assert.throws(() => compareReplayStrategies(invalidScore), /retentionScore must be in/);
});

test("does not report a retention delta when either strategy lacks retention measurements", () => {
  const input = fixture();
  delete input.strategies[1].runs[0].retentionScore;
  const report = compareReplayStrategies(input);
  assert.equal(report.comparisons[0].paired[0].retentionDelta, null);
  assert.equal(report.comparisons[0].pairedMeanRetentionDelta, 0.15);
});
