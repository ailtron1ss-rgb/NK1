/**
 * Paired-seed ablation runner for NK1's actual ParametricPolicyLearner.
 * Synthetic task streams are diagnostic fixtures, not evidence of real-world gains.
 */
import { ParametricPolicyLearner } from "../organism/learning/ParametricPolicyLearner.ts";
import { BoundedExperienceReplayBuffer, trainWithExperienceReplay } from "./bounded-experience-replay-workpass76.mjs";
import { evaluateContinualLearningHistory } from "./continual-learning-history-workpass74.mjs";

const ACTIONS = ["respond", "explore", "verify", "rest", "reflect", "wait", "defer"];
const STRATEGIES = ["none", "uniform", "diversity", "prioritized"];
const clamp = value => Math.max(0, Math.min(1, value));

function stateFor(taskId, index) {
  const phase = index % 20;
  const energy = taskId === "energy" ? (index % 2 ? 0.25 + phase / 100 : 0.72 + phase / 100) : 0.82;
  const novelty = taskId === "novelty" ? (index % 2 ? 0.72 + phase / 100 : 0.12 + phase / 100) : 0.12;
  const uncertainty = taskId === "uncertainty" ? (index % 2 ? 0.72 + phase / 100 : 0.12 + phase / 100) : 0.12;
  return {
    version: 29, tick: index + 1, at: index + 1,
    needs: { energy: clamp(energy), cognitiveLoad: 0.3, uncertainty: clamp(uncertainty),
      socialNeed: 0.2, novelty: clamp(novelty), identityCoherence: 0.8, goalPressure: 0.25 },
    predictionError: 0.2, attentionBudget: 0.8, lastAction: "none", lastActionSuccess: null,
    autonomyScore: 0.5, selfPredictionError: 0.1, predictedNextAction: "none",
    lastPredictionConfidence: 0.5, worldContextVersion: 1
  };
}

function targetFor(taskId, state) {
  if (taskId === "energy") return state.needs.energy < 0.5 ? "rest" : "respond";
  if (taskId === "novelty") return state.needs.novelty > 0.5 ? "explore" : "respond";
  return state.needs.uncertainty > 0.5 ? "verify" : "respond";
}

function makeBatch(taskId, start, count) {
  const samples = [];
  for (let i = start; i < start + count; i += 1) {
    const state = stateFor(taskId, i);
    const correctAction = targetFor(taskId, state);
    for (const action of ACTIONS) {
      samples.push({ state, action, target01: action === correctAction ? 0.95 : 0.05,
        learningRate01: 0.08, replayGroup: taskId + ":" + action, taskId });
    }
  }
  return samples;
}

function scoreTask(learner, taskId, seed) {
  let correct = 0;
  const count = 80;
  for (let i = 0; i < count; i += 1) {
    const state = stateFor(taskId, seed * 1000 + 10000 + i);
    const predictions = learner.predict(state);
    const best = predictions.reduce((left, right) => right.value > left.value ? right : left);
    if (best.action === targetFor(taskId, state)) correct += 1;
  }
  return correct / count;
}

function runOne(seed, strategy, options = {}) {
  const learner = new ParametricPolicyLearner();
  const buffer = strategy === "none" ? null : new BoundedExperienceReplayBuffer({
    maxBytes: options.maxBytes ?? 64 * 1024,
    strategy,
    seed,
    priorityAlpha: 0.6,
    importanceBeta: 0.4
  });
  const taskIds = ["energy", "novelty", "uncertainty"];
  const history = [];
  for (const taskId of taskIds) {
    for (let start = 0; start < 160; start += 16) {
      const incoming = makeBatch(taskId, start + seed * 37, 16);
      if (strategy === "none") learner.trainBatch(incoming);
      else trainWithExperienceReplay(learner, incoming, buffer, {
        replayRatio: 0.25,
        replayBatchSize: incoming.length,
        priorityOf: sample => Math.abs(sample.target01 - 0.5) + 0.05
      });
    }
    history.push(taskIds.map(id => scoreTask(learner, id, seed)));
  }
  const memoryBytes = Buffer.byteLength(JSON.stringify(learner.snapshot()), "utf8") + (buffer?.stats.bytesUsed ?? 0);
  const report = evaluateContinualLearningHistory({
    taskIds, history, memoryBytes,
    memoryBudgetBytes: (options.maxBytes ?? 64 * 1024) + 256 * 1024
  });
  return {
    seed, strategy, history, metrics: report.metrics,
    replayBuffer: buffer?.stats ?? { strategy: "none", size: 0, bytesUsed: 0, withinBudget: true },
    learnerUpdates: learner.snapshot().updates,
    memoryBytes
  };
}

export function runContinualReplayAblation({ seeds = [11, 29, 47], strategies = STRATEGIES, maxBytes = 64 * 1024 } = {}) {
  if (!Array.isArray(seeds) || seeds.length < 2 || seeds.some(seed => !Number.isInteger(seed)) || new Set(seeds).size !== seeds.length) {
    throw new TypeError("seeds must contain at least two unique integers");
  }
  if (!Array.isArray(strategies) || strategies.length < 2 || strategies.some(strategy => !STRATEGIES.includes(strategy)) || new Set(strategies).size !== strategies.length) {
    throw new TypeError("strategies must contain at least two unique supported strategies");
  }
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new RangeError("maxBytes must be a positive integer");
  const runs = [];
  for (const seed of seeds) for (const strategy of strategies) runs.push(runOne(seed, strategy, { maxBytes }));
  const summaries = strategies.map(strategy => {
    const selected = runs.filter(run => run.strategy === strategy);
    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      strategy,
      seedCount: selected.length,
      meanFinalAverageAccuracy01: mean(selected.map(run => run.metrics.finalAverageAccuracy01)),
      meanForgetting01: mean(selected.map(run => run.metrics.averageForgetting01)),
      meanBackwardTransfer01: mean(selected.map(run => run.metrics.averageBackwardTransfer01)),
      meanMemoryBytes: mean(selected.map(run => run.memoryBytes)),
      allWithinBudget: selected.every(run => run.replayBuffer.withinBudget),
      runs: selected
    };
  });
  return {
    kind: "nk1.continual-replay-ablation-report",
    schemaVersion: 1,
    syntheticOnly: true,
    promotionAllowed: false,
    seeds,
    strategies,
    maxReplayBytes: maxBytes,
    summaries,
    interpretation: "Compare paired seeds and task order before selecting a strategy; this synthetic experiment is not evidence of real-world improvement."
  };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  try {
    process.stdout.write(JSON.stringify(runContinualReplayAblation(), null, 2) + "\n");
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
    process.exitCode = 1;
  }
}
