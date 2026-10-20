import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePairedLearningRuns } from "../src/learning/paired-holdout-evaluation-workpass71.mjs";

const run = (seed, reward, overrides = {}) => ({
  seed, reward, regret: 1 - reward, success: reward >= 0.7,
  confidence: 0.8, correct: reward >= 0.7, latencyMs: 100,
  memoryBytes: 1024, ...overrides
});

test("paired holdout detects stable reward uplift without promoting on tiny samples", () => {
  const baseline = [1, 2, 3, 4].map(seed => run(seed, 0.6));
  const candidate = [1, 2, 3, 4].map(seed => run(seed, 0.8));
  const result = evaluatePairedLearningRuns({ baseline, candidate });
  assert.equal(result.sampleCount, 4);
  assert.equal(result.paired.rewardDeltaMean, 0.2);
  assert.equal(result.gates.rewardUpliftObserved, true);
  assert.equal(result.gates.minimumSampleCount, false);
  assert.equal(result.promotionEligible, false);
});

test("rejects unmatched holdout seeds instead of comparing unlike samples", () => {
  assert.throws(() => evaluatePairedLearningRuns({
    baseline: [run(1, 0.5), run(2, 0.6)],
    candidate: [run(1, 0.6), run(3, 0.7)]
  }), /exactly the same paired holdout seeds/);
});

test("rejects duplicate seed IDs and invalid confidence values", () => {
  assert.throws(() => evaluatePairedLearningRuns({
    baseline: [run(1, 0.5), run(1, 0.6)],
    candidate: [run(1, 0.6), run(2, 0.7)]
  }), /duplicate seed/);
  assert.throws(() => evaluatePairedLearningRuns({
    baseline: [run(1, 0.5, { confidence: 1.2 }), run(2, 0.6)],
    candidate: [run(1, 0.6), run(2, 0.7)]
  }), /confidence must be in/);
});

test("reports task-success, regret, latency and calibration changes", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => run(i, 0.5, { success: false, confidence: 0.4, correct: false }));
  const candidate = Array.from({ length: 12 }, (_, i) => run(i, 0.8, { success: true, confidence: 0.9, correct: true, latencyMs: 105 }));
  const result = evaluatePairedLearningRuns({ baseline, candidate });
  assert.equal(result.gates.minimumSampleCount, true);
  assert.equal(result.paired.successRateDelta, 1);
  assert.ok(result.paired.regretDelta < 0);
  assert.equal(result.candidate.calibrationCoverage, 1);
  assert.ok(result.candidate.brierScore < result.baseline.brierScore);
  assert.equal(result.paired.latencyRatio, 0.05);
});

test("refuses promotion when reward improves but success regresses", () => {
  const baseline = Array.from({ length: 12 }, (_, i) => run(i, 0.5, { success: true }));
  const candidate = Array.from({ length: 12 }, (_, i) => run(i, 0.7, { success: false }));
  const result = evaluatePairedLearningRuns({ baseline, candidate });
  assert.equal(result.gates.rewardUpliftObserved, true);
  assert.equal(result.gates.taskSuccessNonInferior, false);
  assert.equal(result.promotionEligible, false);
});
