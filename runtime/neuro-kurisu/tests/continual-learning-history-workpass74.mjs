import test from "node:test";
import assert from "node:assert/strict";
import { evaluateContinualLearningHistory } from "../src/learning/continual-learning-history-workpass74.mjs";

const fixture = {
  taskIds: ["memory-recall", "new-skill", "planning"],
  history: [
    [0.9, 0.2, 0.1],
    [0.7, 0.8, 0.2],
    [0.6, 0.75, 0.85]
  ]
};

test("reports average accuracy, forgetting and backward transfer from a fixed task suite", () => {
  const report = evaluateContinualLearningHistory(fixture);
  assert.equal(report.kind, "nk1.continual-learning-history-report");
  assert.equal(report.taskCount, 3);
  assert.ok(Math.abs(report.metrics.finalAverageAccuracy01 - (2.2 / 3)) < 1e-12);
  assert.ok(Math.abs(report.metrics.averageForgetting01 - 0.175) < 1e-12);
  assert.ok(Math.abs(report.metrics.averageBackwardTransfer01 - (-0.175)) < 1e-12);
  assert.equal(report.taskReports[0].forgetting01, 0.30000000000000004);
  assert.equal(report.interpretation.forwardTransferReported, false);
  assert.equal(report.interpretation.promotionAllowed, false);
});

test("reports improvement without counting it as negative forgetting", () => {
  const report = evaluateContinualLearningHistory({
    taskIds: ["A", "B"],
    history: [[0.6, 0.1], [0.8, 0.9]]
  });
  assert.equal(report.taskReports[0].forgetting01, 0);
  assert.ok(report.taskReports[0].backwardTransfer01 > 0);
});

test("enforces equal-byte memory budget and reports utilization", () => {
  const report = evaluateContinualLearningHistory({
    ...fixture, memoryBytes: 750, memoryBudgetBytes: 1000
  });
  assert.equal(report.metrics.memory.budgetUtilization01, 0.75);
  assert.equal(report.metrics.memory.withinMemoryBudget, true);
  const over = evaluateContinualLearningHistory({
    ...fixture, memoryBytes: 1001, memoryBudgetBytes: 1000
  });
  assert.equal(over.metrics.memory.withinMemoryBudget, false);
});

test("rejects missing paired resource-budget fields", () => {
  assert.throws(() => evaluateContinualLearningHistory({
    ...fixture, memoryBytes: 100
  }), /must be supplied together/);
});

test("rejects duplicate task identifiers", () => {
  assert.throws(() => evaluateContinualLearningHistory({
    taskIds: ["same", "same"], history: [[0.5, 0.1], [0.4, 0.8]]
  }), /taskIds must be unique/);
});

test("rejects incomplete task checkpoint matrices", () => {
  assert.throws(() => evaluateContinualLearningHistory({
    taskIds: ["A", "B"], history: [[0.5, 0.1]]
  }), /one checkpoint per learned task/);
  assert.throws(() => evaluateContinualLearningHistory({
    taskIds: ["A", "B"], history: [[0.5], [0.4, 0.8]]
  }), /must score every task/);
});

test("rejects out-of-range and non-finite held-out scores", () => {
  assert.throws(() => evaluateContinualLearningHistory({
    taskIds: ["A", "B"], history: [[0.5, 0.1], [1.1, 0.8]]
  }), /task scores must be in/);
  assert.throws(() => evaluateContinualLearningHistory({
    taskIds: ["A", "B"], history: [[0.5, 0.1], [Number.NaN, 0.8]]
  }), /must be a finite number/);
});

test("rejects malformed memory accounting", () => {
  assert.throws(() => evaluateContinualLearningHistory({
    ...fixture, memoryBytes: -1, memoryBudgetBytes: 100
  }), /memoryBytes must be a non-negative integer/);
  assert.throws(() => evaluateContinualLearningHistory({
    ...fixture, memoryBytes: 10, memoryBudgetBytes: 0
  }), /memoryBudgetBytes must be a positive integer/);
});

test("does not mutate the supplied evidence matrix", () => {
  const input = structuredClone(fixture);
  const before = structuredClone(input);
  evaluateContinualLearningHistory(input);
  assert.deepEqual(input, before);
});
