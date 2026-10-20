import assert from "node:assert/strict";
import { ParametricPolicyLearner } from "../src/organism/learning/ParametricPolicyLearner.ts";
import { evaluateContinualLearningHistory } from "../src/learning/continual-learning-history-workpass74.mjs";

const actions = ["respond", "explore", "verify", "rest", "reflect", "wait", "defer"];
const mkState = (energy, novelty, uncertainty, tick = 1) => ({
  version: 29, tick, at: tick,
  needs: {
    energy, cognitiveLoad: 0.3, uncertainty, socialNeed: 0.2, novelty,
    identityCoherence: 0.8, goalPressure: 0.25
  },
  predictionError: 0.2, attentionBudget: 0.8, lastAction: "none",
  lastActionSuccess: null, autonomyScore: 0.5, selfPredictionError: 0.1,
  predictedNextAction: "none", lastPredictionConfidence: 0.5, worldContextVersion: 1
});

const tasks = [
  {
    id: "energy-regulation",
    state: i => mkState(i % 2 ? 0.25 + (i % 20) / 100 : 0.7 + (i % 20) / 100, 0.1, 0.1, i),
    target: state => state.needs.energy < 0.5 ? "rest" : "respond"
  },
  {
    id: "novelty-exploration",
    state: i => mkState(0.85, i % 2 ? 0.7 + (i % 20) / 100 : 0.1 + (i % 20) / 100, 0.1, i),
    target: state => state.needs.novelty > 0.5 ? "explore" : "respond"
  },
  {
    id: "uncertainty-verification",
    state: i => mkState(0.85, 0.1, i % 2 ? 0.7 + (i % 20) / 100 : 0.1 + (i % 20) / 100, i),
    target: state => state.needs.uncertainty > 0.5 ? "verify" : "respond"
  }
];

const learner = new ParametricPolicyLearner();
const evaluateTask = task => {
  let correct = 0;
  const count = 60;
  for (let i = 0; i < count; i += 1) {
    const state = task.state(10_000 + i);
    const predicted = learner.predict(state).reduce((best, row) => row.value > best.value ? row : best);
    if (predicted.action === task.target(state)) correct += 1;
  }
  return correct / count;
};

const history = [];
let expectedUpdates = 0;
for (const task of tasks) {
  const samples = [];
  for (let i = 0; i < 180; i += 1) {
    const state = task.state(i);
    const correctAction = task.target(state);
    for (const action of actions) {
      samples.push({
        state, action, target01: action === correctAction ? 0.95 : 0.05,
        learningRate01: 0.08
      });
    }
  }
  learner.trainBatch(samples);
  expectedUpdates += samples.length;
  history.push(tasks.map(evaluateTask));
}

const report = evaluateContinualLearningHistory({
  taskIds: tasks.map(task => task.id),
  history,
  memoryBytes: Buffer.byteLength(JSON.stringify(learner.snapshot()), "utf8"),
  memoryBudgetBytes: 256 * 1024
});

assert.equal(learner.snapshot().updates, expectedUpdates);
assert.equal(history.length, tasks.length);
assert.ok(history.every(row => row.length === tasks.length));
assert.ok(history.flat().every(score => Number.isFinite(score) && score >= 0 && score <= 1));
assert.ok(report.metrics.finalAverageAccuracy01 >= 0 && report.metrics.finalAverageAccuracy01 <= 1);
assert.ok(report.metrics.averageForgetting01 >= 0 && report.metrics.averageForgetting01 <= 1);
assert.equal(report.metrics.memory.withinMemoryBudget, true);
assert.equal(report.interpretation.promotionAllowed, false);

console.log(JSON.stringify({
  ok: true,
  experiment: "parametric-policy-sequential-task-retention",
  updates: expectedUpdates,
  taskIds: report.taskReports.map(task => task.taskId),
  history,
  metrics: report.metrics,
  promotionAllowed: report.interpretation.promotionAllowed
}, null, 2));
