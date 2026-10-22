/**
 * Paired-seed learning evaluation for NK1.
 *
 * This module deliberately evaluates held-out outcomes rather than internal
 * activity counters. Baseline and candidate must use identical seed IDs.
 * It never promotes a candidate itself; it returns evidence and explicit gates.
 */

const finite = (value, label) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
};

const mean = values => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

const sampleVariance = values => {
  if (values.length < 2) return null;
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
};


function deterministicRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sortedValues, probability) {
  if (!sortedValues.length) return null;
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
}

function bootstrapPairedMeanInterval(values, { resamples = 2000, seed = 42 } = {}) {
  if (!Number.isInteger(resamples) || resamples < 1000) {
    throw new RangeError("bootstrapResamples must be an integer >= 1000");
  }
  const random = deterministicRandom(seed);
  const estimates = new Array(resamples);
  for (let iteration = 0; iteration < resamples; iteration += 1) {
    let total = 0;
    for (let sample = 0; sample < values.length; sample += 1) {
      total += values[Math.floor(random() * values.length)];
    }
    estimates[iteration] = total / values.length;
  }
  estimates.sort((a, b) => a - b);
  return [percentile(estimates, 0.025), percentile(estimates, 0.975)];
}

function cohenDForPairedDeltas(values) {
  const variance = sampleVariance(values);
  if (variance == null || variance === 0) return values.length && values.every(value => value === values[0])
    ? (values[0] === 0 ? 0 : Math.sign(values[0]) * Infinity)
    : null;
  return mean(values) / Math.sqrt(variance);
}

function validateRuns(runs, label) {
  if (!Array.isArray(runs) || runs.length < 2) {
    throw new TypeError(`${label} must contain at least two held-out runs`);
  }
  const seen = new Set();
  for (const [index, run] of runs.entries()) {
    if (!run || (typeof run.seed !== "string" && typeof run.seed !== "number")) {
      throw new TypeError(`${label}[${index}].seed is required`);
    }
    const seed = String(run.seed);
    if (seen.has(seed)) throw new Error(`${label} contains duplicate seed: ${seed}`);
    seen.add(seed);
    finite(run.reward, `${label}[${index}].reward`);
    finite(run.regret, `${label}[${index}].regret`);
    finite(run.latencyMs, `${label}[${index}].latencyMs`);
    if (run.latencyMs < 0 || run.regret < 0) throw new RangeError("latencyMs and regret must be non-negative");
    if (typeof run.success !== "boolean") throw new TypeError(`${label}[${index}].success must be boolean`);
    if (run.confidence != null) {
      const confidence = finite(run.confidence, `${label}[${index}].confidence`);
      if (confidence < 0 || confidence > 1) throw new RangeError("confidence must be in [0, 1]");
      if (typeof run.correct !== "boolean") throw new TypeError("correct must be boolean when confidence is supplied");
    }
    if (run.memoryBytes != null && finite(run.memoryBytes, "memoryBytes") < 0) {
      throw new RangeError("memoryBytes must be non-negative");
    }
  }
  return new Map(runs.map(run => [String(run.seed), run]));
}

function summarize(runs) {
  const calibrated = runs.filter(run => run.confidence != null);
  return {
    n: runs.length,
    taskSuccessRate: mean(runs.map(run => Number(run.success))),
    meanReward: mean(runs.map(run => run.reward)),
    meanRegret: mean(runs.map(run => run.regret)),
    meanLatencyMs: mean(runs.map(run => run.latencyMs)),
    meanMemoryBytes: runs.some(run => run.memoryBytes != null)
      ? mean(runs.filter(run => run.memoryBytes != null).map(run => run.memoryBytes))
      : null,
    brierScore: calibrated.length
      ? mean(calibrated.map(run => (run.confidence - Number(run.correct)) ** 2))
      : null,
    calibrationCoverage: calibrated.length / runs.length
  };
}

/**
 * Compare candidate and baseline on the same immutable holdout seed IDs.
 * Positive reward delta is better; negative regret and latency deltas are better.
 * The normal-approximation interval is reported as descriptive evidence only;
 * for small seed counts use additional seeds / a bootstrap before promotion.
 */
export function evaluatePairedLearningRuns({
  baseline,
  candidate,
  minimumRewardUplift = 0,
  maximumSuccessRateDrop = 0,
  maximumRegretIncrease = 0,
  maximumLatencyIncreaseRatio = 0.1,
  minimumSampleCount = 10,
  bootstrapResamples = 2000,
  bootstrapSeed = 42
}) {
  const baseBySeed = validateRuns(baseline, "baseline");
  const candidateBySeed = validateRuns(candidate, "candidate");
  const baseSeeds = [...baseBySeed.keys()].sort();
  const candidateSeeds = [...candidateBySeed.keys()].sort();
  if (baseSeeds.length !== candidateSeeds.length ||
      baseSeeds.some((seed, index) => seed !== candidateSeeds[index])) {
    throw new Error("baseline and candidate must use exactly the same paired holdout seeds");
  }
  if (typeof minimumRewardUplift !== "number" || !Number.isFinite(minimumRewardUplift)) {
    throw new TypeError("minimumRewardUplift must be finite");
  }
  for (const [name, value] of Object.entries({
    maximumSuccessRateDrop, maximumRegretIncrease, maximumLatencyIncreaseRatio
  })) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be a finite non-negative number`);
    }
  }
  if (!Number.isInteger(minimumSampleCount) || minimumSampleCount < 2) {
    throw new RangeError("minimumSampleCount must be an integer >= 2");
  }

  const paired = baseSeeds.map(seed => ({
    seed,
    rewardDelta: candidateBySeed.get(seed).reward - baseBySeed.get(seed).reward,
    regretDelta: candidateBySeed.get(seed).regret - baseBySeed.get(seed).regret,
    successDelta: Number(candidateBySeed.get(seed).success) - Number(baseBySeed.get(seed).success),
    latencyDelta: candidateBySeed.get(seed).latencyMs - baseBySeed.get(seed).latencyMs
  }));
  const rewardDeltas = paired.map(row => row.rewardDelta);
  const rewardMean = mean(rewardDeltas);
  const variance = sampleVariance(rewardDeltas);
  const standardError = variance == null ? null : Math.sqrt(variance / rewardDeltas.length);
  const halfWidth95 = standardError == null ? null : 1.96 * standardError;
  const rewardBootstrap95CI = bootstrapPairedMeanInterval(rewardDeltas, { resamples: bootstrapResamples, seed: bootstrapSeed });
  const rewardEffectSizeCohenD = cohenDForPairedDeltas(rewardDeltas);
  const baselineSummary = summarize(baseline);
  const candidateSummary = summarize(candidate);
  const successRateDelta = candidateSummary.taskSuccessRate - baselineSummary.taskSuccessRate;
  const regretDelta = candidateSummary.meanRegret - baselineSummary.meanRegret;
  const latencyRatio = baselineSummary.meanLatencyMs > 0
    ? candidateSummary.meanLatencyMs / baselineSummary.meanLatencyMs - 1
    : (candidateSummary.meanLatencyMs === 0 ? 0 : null);

  const gates = {
    pairedHoldoutComplete: true,
    minimumSampleCount: paired.length >= minimumSampleCount,
    rewardUpliftObserved: rewardMean >= minimumRewardUplift,
    rewardIntervalExcludesZero: rewardBootstrap95CI[0] > 0,
    taskSuccessNonInferior: successRateDelta >= -Math.abs(maximumSuccessRateDrop),
    regretNonInferior: regretDelta <= Math.abs(maximumRegretIncrease),
    latencyWithinBudget: latencyRatio != null && latencyRatio <= maximumLatencyIncreaseRatio
  };
  return {
    schemaVersion: 1,
    promotionEligible: Object.values(gates).every(Boolean),
    interpretation: "Descriptive evaluation only; no automatic model or policy promotion.",
    sampleCount: paired.length,
    baseline: baselineSummary,
    candidate: candidateSummary,
    paired: {
      rewardDeltaMean: rewardMean,
      rewardDeltaStandardError: standardError,
      rewardDeltaApprox95CI: halfWidth95 == null
        ? null
        : [rewardMean - halfWidth95, rewardMean + halfWidth95],
      rewardDeltaBootstrap95CI: rewardBootstrap95CI,
      rewardEffectSizeCohenD,
      bootstrapResamples,
      bootstrapSeed,
      successRateDelta,
      regretDelta,
      latencyRatio
    },
    gates,
    pairedSeeds: baseSeeds
  };
}
