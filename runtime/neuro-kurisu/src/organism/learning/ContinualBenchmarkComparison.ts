/**
 * Fair paired comparison utilities for continual-learning ablations.
 * Runs are pairable only when seed, manifest fingerprint and task set match.
 * Each run is the statistical unit: task scores are averaged within a run before
 * confidence intervals are calculated, avoiding pseudo-replication of correlated
 * tasks as if each task were an independent seed.
 */
export interface ContinualBenchmarkRun {
  method: string;
  seed: number;
  manifestFingerprint: string;
  taskScores: Record<string, number>;
  forgettingByTask: Record<string, number>;
}
export interface PairedMetric {
  /** Number of matched independent runs/seeds, not the number of task cells. */
  pairedN: number;
  baselineMean: number;
  candidateMean: number;
  meanDelta: number;
  approximate95CI: [number, number] | null;
}
export interface PairedContinualBenchmark {
  baseline: string;
  candidate: string;
  pairedN: number;
  successScore: PairedMetric;
  forgetting: PairedMetric;
  unpairedBaselineRuns: number;
  unpairedCandidateRuns: number;
}
function validateRun(run: ContinualBenchmarkRun): void {
  if (!run || typeof run.method !== 'string' || !run.method.trim()) throw new Error('method must be non-empty');
  if (!Number.isSafeInteger(run.seed) || run.seed < 0) throw new Error('seed must be a non-negative safe integer');
  if (!/^[a-f0-9]{64}$/i.test(run.manifestFingerprint)) throw new Error('manifestFingerprint must be SHA-256 hex');
  if (!run.taskScores || !run.forgettingByTask || typeof run.taskScores !== 'object' || typeof run.forgettingByTask !== 'object') throw new Error('task score maps are required');
  const scoreIds = Object.keys(run.taskScores).sort();
  const forgettingIds = Object.keys(run.forgettingByTask).sort();
  if (!scoreIds.length || JSON.stringify(scoreIds) !== JSON.stringify(forgettingIds)) throw new Error('score and forgetting task sets must match and be non-empty');
  for (const id of scoreIds) {
    if (!id.trim()) throw new Error('task IDs must be non-empty');
    const score = run.taskScores[id]!;
    const forgetting = run.forgettingByTask[id]!;
    if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error(`score for ${id} must be in [0, 1]`);
    if (!Number.isFinite(forgetting) || forgetting < 0 || forgetting > 1) throw new Error(`forgetting for ${id} must be in [0, 1]`);
  }
}
function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function tCritical95(degreesOfFreedom: number): number {
  // Two-sided 95% Student-t critical values for small paired-seed samples.
  // Above df=30 the normal approximation is adequate for this diagnostic.
  const critical = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
    2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093,
    2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  return degreesOfFreedom < critical.length ? critical[degreesOfFreedom]! : 1.96;
}
function summarize(deltas: Array<{ baseline: number; candidate: number }>): PairedMetric {
  const n = deltas.length;
  const baselineMean = mean(deltas.map(x => x.baseline));
  const candidateMean = mean(deltas.map(x => x.candidate));
  const differences = deltas.map(x => x.candidate - x.baseline);
  const meanDelta = mean(differences);
  if (n < 2) return { pairedN: n, baselineMean, candidateMean, meanDelta, approximate95CI: null };
  const variance = differences.reduce((sum, x) => sum + (x - meanDelta) ** 2, 0) / (n - 1);
  const halfWidth = tCritical95(n - 1) * Math.sqrt(variance / n);
  return { pairedN: n, baselineMean, candidateMean, meanDelta, approximate95CI: [meanDelta - halfWidth, meanDelta + halfWidth] };
}
function runMean(values: Record<string, number>): number {
  return mean(Object.values(values));
}
export function comparePairedContinualRuns(
  runs: ContinualBenchmarkRun[],
  baseline: string,
  candidate: string,
): PairedContinualBenchmark {
  if (!Array.isArray(runs) || typeof baseline !== 'string' || !baseline.trim() ||
      typeof candidate !== 'string' || !candidate.trim() || baseline === candidate) {
    throw new Error('two distinct methods and a run list are required');
  }
  const byKey = new Map<string, Map<string, ContinualBenchmarkRun>>();
  for (const run of runs) {
    validateRun(run);
    const key = JSON.stringify([run.manifestFingerprint.toLowerCase(), run.seed]);
    const pair = byKey.get(key) ?? new Map<string, ContinualBenchmarkRun>();
    if (pair.has(run.method)) throw new Error(`duplicate run for method/manifest/seed: ${run.method}/${key}`);
    pair.set(run.method, run);
    byKey.set(key, pair);
  }
  const paired: Array<{ baseline: ContinualBenchmarkRun; candidate: ContinualBenchmarkRun }> = [];
  let baselineCount = 0;
  let candidateCount = 0;
  for (const pair of byKey.values()) {
    const b = pair.get(baseline);
    const c = pair.get(candidate);
    if (b) baselineCount++;
    if (c) candidateCount++;
    if (!b || !c) continue;
    const bIds = Object.keys(b.taskScores).sort();
    const cIds = Object.keys(c.taskScores).sort();
    if (JSON.stringify(bIds) !== JSON.stringify(cIds)) throw new Error('paired runs must contain the identical task set');
    paired.push({ baseline: b, candidate: c });
  }
  // Aggregate tasks within each seed first. Confidence intervals then describe
  // between-run variation, not artificial precision from correlated task cells.
  const scores = paired.map(({ baseline: b, candidate: c }) => ({
    baseline: runMean(b.taskScores), candidate: runMean(c.taskScores),
  }));
  const forgetting = paired.map(({ baseline: b, candidate: c }) => ({
    baseline: runMean(b.forgettingByTask), candidate: runMean(c.forgettingByTask),
  }));
  return {
    baseline, candidate, pairedN: paired.length,
    successScore: summarize(scores),
    forgetting: summarize(forgetting),
    unpairedBaselineRuns: baselineCount - paired.length,
    unpairedCandidateRuns: candidateCount - paired.length,
  };
}
