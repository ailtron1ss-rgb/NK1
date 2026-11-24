import test from "node:test";
import assert from "node:assert/strict";
import { runContinualReplayAblation } from "../src/learning/continual-replay-ablation-workpass78.mjs";

test("runs paired seeds across no-replay, uniform, diversity and prioritized policies", () => {
  const report = runContinualReplayAblation({
    seeds: [11, 29],
    strategies: ["none", "uniform", "diversity", "prioritized"],
    maxBytes: 32 * 1024
  });
  assert.equal(report.kind, "nk1.continual-replay-ablation-report");
  assert.equal(report.syntheticOnly, true);
  assert.equal(report.promotionAllowed, false);
  assert.equal(report.summaries.length, 4);
  assert.ok(report.summaries.every(summary => summary.seedCount === 2));
  assert.ok(report.summaries.every(summary => summary.runs.length === 2));
  assert.ok(report.summaries.every(summary => Number.isFinite(summary.meanFinalAverageAccuracy01)));
  assert.ok(report.summaries.every(summary => Number.isFinite(summary.meanForgetting01)));
  assert.ok(report.summaries.every(summary => summary.allWithinBudget));
  for (const seed of report.seeds) {
    assert.equal(report.summaries.every(summary => summary.runs.some(run => run.seed === seed)), true);
  }
});

test("rejects single-seed or duplicate-seed experiments", () => {
  assert.throws(() => runContinualReplayAblation({ seeds: [1] }), /at least two unique integers/);
  assert.throws(() => runContinualReplayAblation({ seeds: [1, 1] }), /at least two unique integers/);
});

test("rejects unsupported or duplicate strategy sets", () => {
  assert.throws(() => runContinualReplayAblation({ strategies: ["none", "mystery"] }), /supported strategies/);
  assert.throws(() => runContinualReplayAblation({ strategies: ["none", "none"] }), /supported strategies/);
});
