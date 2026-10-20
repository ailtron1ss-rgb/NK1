/**
 * Fair paired comparison utilities for continual-learning ablations.
 * Runs are pairable only when seed, manifest fingerprint and task set match.
 * Deltas are candidate minus baseline; no missing cells are silently imputed.
 */
export interface ContinualBenchmarkRun {
  method: string;
  seed: number;
  manifestFingerprint: string;
  taskScores: Record<string, number>;
  forgettingByTask: Record<string, number>;
}
export interface PairedMetric {
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
function summarize(deltas: Array<{ baseline: number; candidate: number }>): PairedMetric {
  const n = deltas.length;
  const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const baselineMean = mean(deltas.map(x => x.baseline));
  const candidateMean = mean(deltas.map(x => x.candidate));
  const differences = deltas.map(x => x.candidate - x.baseline);
  const meanDelta = mean(differences);
  if (n < 2) return { pairedN: n, baselineMean, candidateMean, meanDelta, approximate95CI: null };
  const variance = differences.reduce((sum, x) => sum + (x - meanDelta) ** 2, 0) / (n - 1);
  const halfWidth = 1.96 * Math.sqrt(variance / n);
  return { pairedN: n, baselineMean, candidateMean, meanDelta, approximate95CI: [meanDelta - halfWidth, meanDelta + halfWidth] };
}
export function comparePairedContinualRuns(
  runs: ContinualBenchmarkRun[],
  baseline: string,
  candidate: string,
): PairedContinualBenchmark {
  if (!Array.isArray(runs) || !baseline.trim() || !candidate.trim() || baseline === candidate) throw new Error('two distinct methods and a run list are required');
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
  const scores = paired.flatMap(({ baseline: b, candidate: c }) => Object.keys(b.taskScores).map(taskId => ({
    baseline: b.taskScores[taskId]!, candidate: c.taskScores[taskId]!,
  })));
  const forgetting = paired.flatMap(({ baseline: b, candidate: c }) => Object.keys(b.forgettingByTask).map(taskId => ({
    baseline: b.forgettingByTask[taskId]!, candidate: c.forgettingByTask[taskId]!,
  })));
  return {
    baseline, candidate, pairedN: paired.length,
    successScore: summarize(scores),
    forgetting: summarize(forgetting),
    unpairedBaselineRuns: baselineCount - paired.length,
    unpairedCandidateRuns: candidateCount - paired.length,
  };
}
