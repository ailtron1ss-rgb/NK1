/**
 * Fair, paired replay-strategy comparison for continual learning.
 *
 * Strategies must share the same held-out seed IDs and declared memory budget.
 * This reports evidence only: it never chooses or promotes a strategy.
 */
import { evaluatePairedLearningRuns } from "./paired-holdout-evaluation-workpass71.mjs";

const finite = (value, label) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
};
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

function validateStrategy(strategy, index) {
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) {
    throw new TypeError(`strategies[${index}] must be an object`);
  }
  if (typeof strategy.id !== "string" || !strategy.id.trim()) {
    throw new TypeError(`strategies[${index}].id must be non-empty`);
  }
  if (!Number.isInteger(strategy.memoryBudgetBytes) || strategy.memoryBudgetBytes <= 0) {
    throw new RangeError(`strategies[${index}].memoryBudgetBytes must be a positive integer`);
  }
  if (!Array.isArray(strategy.runs) || strategy.runs.length < 2) {
    throw new TypeError(`strategies[${index}].runs must contain at least two paired runs`);
  }
  const seen = new Set();
  for (const [runIndex, run] of strategy.runs.entries()) {
    if (!run || (typeof run.seed !== "string" && typeof run.seed !== "number")) {
      throw new TypeError(`strategies[${index}].runs[${runIndex}].seed is required`);
    }
    const seed = String(run.seed);
    if (seen.has(seed)) throw new Error(`strategy ${strategy.id} contains duplicate seed ${seed}`);
    seen.add(seed);
    if (run.retentionScore != null) {
      const score = finite(run.retentionScore, "retentionScore");
      if (score < 0 || score > 1) throw new RangeError("retentionScore must be in [0, 1]");
    }
    if (run.transferScore != null) {
      const score = finite(run.transferScore, "transferScore");
      if (score < 0 || score > 1) throw new RangeError("transferScore must be in [0, 1]");
    }
    if (run.memoryBytes != null && (!Number.isInteger(run.memoryBytes) || run.memoryBytes < 0)) {
      throw new RangeError("memoryBytes must be a non-negative integer when supplied");
    }
  }
  return strategy;
}

function summarizeAuxiliary(runs, key) {
  const values = runs.filter(run => run[key] != null).map(run => finite(run[key], key));
  return { n: values.length, mean: mean(values) };
}

/** @param {{strategies:Array<{id:string,memoryBudgetBytes:number,runs:Array<object>}>}} input */
export function compareReplayStrategies(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("input must be an object");
  }
  if (!Array.isArray(input.strategies) || input.strategies.length < 2) {
    throw new TypeError("strategies must contain a baseline and at least one candidate");
  }
  const strategies = input.strategies.map(validateStrategy);
  const ids = strategies.map(strategy => strategy.id);
  if (new Set(ids).size !== ids.length) throw new Error("strategy IDs must be unique");
  const baseline = strategies[0];
  if (strategies.some(strategy => strategy.memoryBudgetBytes !== baseline.memoryBudgetBytes)) {
    throw new Error("all strategies must use the same declared memory budget");
  }
  const expectedSeeds = baseline.runs.map(run => String(run.seed)).sort();
  const budget = baseline.memoryBudgetBytes;
  const comparisons = strategies.slice(1).map(candidate => {
    const candidateSeeds = candidate.runs.map(run => String(run.seed)).sort();
    if (candidateSeeds.length !== expectedSeeds.length ||
        candidateSeeds.some((seed, index) => seed !== expectedSeeds[index])) {
      throw new Error(`strategy ${candidate.id} must use exactly the baseline holdout seeds`);
    }
    const baselineBySeed = new Map(baseline.runs.map(run => [String(run.seed), run]));
    const candidateBySeed = new Map(candidate.runs.map(run => [String(run.seed), run]));
    const paired = expectedSeeds.map(seed => {
      const a = baselineBySeed.get(seed);
      const b = candidateBySeed.get(seed);
      return {
        seed,
        rewardDelta: finite(b.reward, "candidate.reward") - finite(a.reward, "baseline.reward"),
        retentionDelta: b.retentionScore == null || a.retentionScore == null
          ? null : finite(b.retentionScore, "candidate.retentionScore") - finite(a.retentionScore, "baseline.retentionScore"),
        transferDelta: b.transferScore == null || a.transferScore == null
          ? null : finite(b.transferScore, "candidate.transferScore") - finite(a.transferScore, "baseline.transferScore")
      };
    });
    const common = {
      baselineStrategyId: baseline.id,
      candidateStrategyId: candidate.id,
      sampleCount: paired.length,
      declaredMemoryBudgetBytes: budget,
      baselineMemory: summarizeAuxiliary(baseline.runs, "memoryBytes"),
      candidateMemory: summarizeAuxiliary(candidate.runs, "memoryBytes"),
      candidateWithinBudgetForEveryRun: candidate.runs.every(run => run.memoryBytes == null || run.memoryBytes <= budget),
      pairedMeanRewardDelta: mean(paired.map(row => row.rewardDelta)),
      pairedMeanRetentionDelta: mean(paired.filter(row => row.retentionDelta != null).map(row => row.retentionDelta)),
      pairedMeanTransferDelta: mean(paired.filter(row => row.transferDelta != null).map(row => row.transferDelta)),
      paired
    };
    const holdout = evaluatePairedLearningRuns({
      baseline: baseline.runs.map(({ retentionScore, transferScore, ...run }) => run),
      candidate: candidate.runs.map(({ retentionScore, transferScore, ...run }) => run),
      minimumSampleCount: 10
    });
    return { ...common, holdoutGates: holdout.gates, promotionEligible: false };
  });
  return {
    schemaVersion: 1,
    kind: "nk1.replay-strategy-comparison-report",
    baselineStrategyId: baseline.id,
    strategyIds: ids,
    sharedHoldoutSeedCount: expectedSeeds.length,
    sharedMemoryBudgetBytes: budget,
    comparisons,
    interpretation: {
      fairComparisonRequires: [
        "same held-out seed IDs and task suite",
        "same declared memory budget",
        "report measured bytes and latency, not only accuracy",
        "repeat across task orders and independent seed sets before making a policy change"
      ],
      replayIsNotAssumedBeneficial: true,
      automaticStrategySelection: false,
      promotionAllowed: false
    }
  };
}
