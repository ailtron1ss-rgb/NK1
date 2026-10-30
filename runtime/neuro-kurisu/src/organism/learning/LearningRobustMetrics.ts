import { isSafeLearningIdentity, snapshotPlainData } from './LearningTrustBoundary.ts';
import { bootstrapMeanConfidenceInterval, type BootstrapMeanInterval } from './PairedSeedConfidence.ts';

export interface LearningRobustMetricDimension {
  baselineTaskBalancedIqm: number;
  candidateTaskBalancedIqm: number;
  taskBalancedIqmDelta: number;
  baselineTaskBalancedMedian: number;
  candidateTaskBalancedMedian: number;
  taskBalancedMedianDelta: number;
  /** With a fixed score ceiling of 1, lower values mean less distance to the ceiling. */
  baselineTaskBalancedOptimalityGap: number;
  candidateTaskBalancedOptimalityGap: number;
  /** Negative deltas indicate the candidate moved closer to the fixed score ceiling. */
  taskBalancedOptimalityGapDelta: number;
  /** Equal task weighting; within each task, a tied paired seed contributes 0.5. */
  pairedProbabilityOfImprovement: number;
  /** Percentile bootstrap over task-level candidate-minus-baseline means; null with <2 tasks. */
  taskBalancedMeanDeltaBootstrapInterval: BootstrapMeanInterval | null;
}

export interface LearningRobustMetricSummary {
  schemaVersion: 2;
  /** These descriptive statistics never authorize skill promotion. */
  diagnosticOnly: true;
  taskCount: number;
  matchedTrialCount: number;
  taskSuccess: LearningRobustMetricDimension;
  skillQuality: LearningRobustMetricDimension;
  trajectoryQuality: LearningRobustMetricDimension;
}

type MetricKey = 'taskSuccess' | 'skillQuality' | 'trajectoryQuality';
type ScoreMap = Record<MetricKey, number>;
interface MatchedScore {
  taskId: string;
  trialId: string;
  baseline: ScoreMap;
  candidate: ScoreMap;
}

function roundMetric(value: number): number {
  if (!Number.isFinite(value)) throw new Error('learning-robust-metrics-non-finite-result');
  return Number(value.toFixed(6));
}

function stableBootstrapSeed(metric: MetricKey, taskIds: readonly string[]): number {
  // FNV-1a over canonical task identities yields a reproducible stream without
  // allocating one potentially large concatenated string.
  let hash = 2166136261;
  const update = (value: string) => {
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 0;
    hash = Math.imul(hash, 16777619);
  };
  update(metric);
  for (const taskId of taskIds) update(taskId);
  return hash >>> 0;
}

function scoreInUnitInterval(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Task-balanced interquartile mean of task-level averages. */
function interquartileMean(values: readonly number[]): number {
  if (values.length === 0) throw new Error('learning-robust-metrics-empty-values');
  const sorted = [...values].sort((a, b) => a - b);
  // Integrate the empirical quantile function over [25%, 75%]. Fractional
  // boundary weights make the result deterministic for any sample count.
  const from = sorted.length * 0.25;
  const to = sorted.length * 0.75;
  let weightedSum = 0;
  for (let index = 0; index < sorted.length; index++) {
    const overlap = Math.max(0, Math.min(index + 1, to) - Math.max(index, from));
    weightedSum += sorted[index] * overlap;
  }
  return weightedSum / (to - from);
}

/** Median of task-level means; unlike pooled rows it gives each task one vote. */
function taskMedian(values: readonly number[]): number {
  if (values.length === 0) throw new Error('learning-robust-metrics-empty-values');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** RLiable-inspired optimality gap for the validated [0, 1] score scale. */
function taskBalancedOptimalityGap(taskMeans: readonly number[]): number {
  if (taskMeans.length === 0) throw new Error('learning-robust-metrics-empty-values');
  return 1 - taskMeans.reduce((sum, value) => sum + value, 0) / taskMeans.length;
}

function reportScore(raw: unknown): { taskId: string; trialId: string; score: ScoreMap } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('learning-robust-metrics-report-invalid');
  }
  const report = raw as Record<string, unknown>;
  const taskId = report.taskId;
  const trialId = report.trialId;
  if (!isSafeLearningIdentity(taskId, 256) || !isSafeLearningIdentity(trialId, 256)) {
    throw new Error('learning-robust-metrics-identity-invalid');
  }
  const taskSuccess = report.taskSuccess;
  const skillQuality = report.skillQuality;
  const trajectoryQuality = report.trajectoryQuality;
  if (!taskSuccess || typeof taskSuccess !== 'object' || Array.isArray(taskSuccess) ||
      !skillQuality || typeof skillQuality !== 'object' || Array.isArray(skillQuality) ||
      !trajectoryQuality || typeof trajectoryQuality !== 'object' || Array.isArray(trajectoryQuality)) {
    throw new Error('learning-robust-metrics-dimension-missing');
  }
  const score = {
    taskSuccess: (taskSuccess as Record<string, unknown>).passRate,
    skillQuality: (skillQuality as Record<string, unknown>).aggregate,
    trajectoryQuality: (trajectoryQuality as Record<string, unknown>).aggregate,
  };
  if (!scoreInUnitInterval(score.taskSuccess) ||
      !scoreInUnitInterval(score.skillQuality) ||
      !scoreInUnitInterval(score.trajectoryQuality)) {
    throw new Error('learning-robust-metrics-score-invalid');
  }
  return { taskId, trialId, score: score as ScoreMap };
}

function indexReports(rawReports: unknown, label: string): Map<string, ReturnType<typeof reportScore>> {
  let detached: unknown;
  try { detached = snapshotPlainData(rawReports); }
  catch { throw new Error(`learning-robust-metrics-${label}-data-boundary-rejected`); }
  if (!Array.isArray(detached) || detached.length === 0) {
    throw new Error(`learning-robust-metrics-${label}-reports-empty`);
  }
  const indexed = new Map<string, ReturnType<typeof reportScore>>();
  for (const raw of detached) {
    const report = reportScore(raw);
    const key = JSON.stringify([report.taskId, report.trialId]);
    if (indexed.has(key)) throw new Error(`learning-robust-metrics-${label}-duplicate-trial`);
    indexed.set(key, report);
  }
  return indexed;
}

function summarizeDimension(
  rowsByTask: ReadonlyMap<string, readonly MatchedScore[]>,
  key: MetricKey,
  taskIds: readonly string[],
): LearningRobustMetricDimension {
  const baselineTaskMeans: number[] = [];
  const candidateTaskMeans: number[] = [];
  const taskImprovementProbabilities: number[] = [];

  for (const taskId of taskIds) {
    const taskRows = rowsByTask.get(taskId);
    if (!taskRows || taskRows.length === 0) throw new Error('learning-robust-metrics-task-group-empty');
    const baselineMean = taskRows.reduce((sum, row) => sum + row.baseline[key], 0) / taskRows.length;
    const candidateMean = taskRows.reduce((sum, row) => sum + row.candidate[key], 0) / taskRows.length;
    const pairwiseWins = taskRows.reduce((sum, row) => {
      if (row.candidate[key] > row.baseline[key]) return sum + 1;
      if (row.candidate[key] < row.baseline[key]) return sum;
      return sum + 0.5;
    }, 0);
    baselineTaskMeans.push(baselineMean);
    candidateTaskMeans.push(candidateMean);
    taskImprovementProbabilities.push(pairwiseWins / taskRows.length);
  }

  const baselineIqm = interquartileMean(baselineTaskMeans);
  const candidateIqm = interquartileMean(candidateTaskMeans);
  const baselineMedian = taskMedian(baselineTaskMeans);
  const candidateMedian = taskMedian(candidateTaskMeans);
  const baselineGap = taskBalancedOptimalityGap(baselineTaskMeans);
  const candidateGap = taskBalancedOptimalityGap(candidateTaskMeans);
  const probability = taskImprovementProbabilities.reduce((sum, value) => sum + value, 0) /
    taskImprovementProbabilities.length;
  // Resample tasks—not individual repeated trials—so one task with many seeds
  // cannot masquerade as many independent units. This interval is descriptive
  // only and intentionally does not participate in candidate promotion.
  const taskBalancedMeanDeltaBootstrapInterval = taskIds.length < 2 ? null :
    bootstrapMeanConfidenceInterval(
      candidateTaskMeans.map((value, index) => value - baselineTaskMeans[index]),
      { confidenceLevel: 0.95, resamples: 2000, seed: stableBootstrapSeed(key, taskIds) },
    );
  return {
    baselineTaskBalancedIqm: roundMetric(baselineIqm),
    candidateTaskBalancedIqm: roundMetric(candidateIqm),
    taskBalancedIqmDelta: roundMetric(candidateIqm - baselineIqm),
    baselineTaskBalancedMedian: roundMetric(baselineMedian),
    candidateTaskBalancedMedian: roundMetric(candidateMedian),
    taskBalancedMedianDelta: roundMetric(candidateMedian - baselineMedian),
    baselineTaskBalancedOptimalityGap: roundMetric(baselineGap),
    candidateTaskBalancedOptimalityGap: roundMetric(candidateGap),
    taskBalancedOptimalityGapDelta: roundMetric(candidateGap - baselineGap),
    pairedProbabilityOfImprovement: roundMetric(probability),
    taskBalancedMeanDeltaBootstrapInterval,
  };
}

/**
 * Read-only RLiable-inspired diagnostics for already paired, independently
 * evaluated trials. IQM is computed over per-task seed averages (equal task
 * weighting); improvement probability averages paired seed wins/ties by task.
 * These are not confidence intervals and must never be used as promotion authority.
 */
export function summarizeLearningRobustMetrics(
  baselineReports: unknown,
  candidateReports: unknown,
): LearningRobustMetricSummary {
  const baseline = indexReports(baselineReports, 'baseline');
  const candidate = indexReports(candidateReports, 'candidate');
  if (baseline.size !== candidate.size || baseline.size === 0) {
    throw new Error('learning-robust-metrics-trial-count-mismatch');
  }

  const rows: MatchedScore[] = [];
  for (const [key, left] of baseline) {
    const right = candidate.get(key);
    if (!right || left.taskId !== right.taskId || left.trialId !== right.trialId) {
      throw new Error('learning-robust-metrics-pair-mismatch');
    }
    rows.push({
      taskId: left.taskId,
      trialId: left.trialId,
      baseline: left.score,
      candidate: right.score,
    });
  }
  const taskIds = [...new Set(rows.map(row => row.taskId))].sort();
  if (taskIds.length === 0) throw new Error('learning-robust-metrics-task-count-empty');

  // Group once and reuse across every score dimension. The previous repeated
  // rows.filter(...) was O(tasks × trials) per dimension and became quadratic
  // as task coverage grew.
  const mutableRowsByTask = new Map<string, MatchedScore[]>();
  for (const row of rows) {
    const taskRows = mutableRowsByTask.get(row.taskId) ?? [];
    taskRows.push(row);
    mutableRowsByTask.set(row.taskId, taskRows);
  }
  // Canonicalize summation order as well as task order. Floating-point addition
  // is not associative; stable trial ordering prevents permuted input rows from
  // changing the last rounded decimal of task means.
  for (const taskRows of mutableRowsByTask.values()) {
    taskRows.sort((a, b) => a.trialId < b.trialId ? -1 : a.trialId > b.trialId ? 1 : 0);
  }
  const rowsByTask: ReadonlyMap<string, readonly MatchedScore[]> = mutableRowsByTask;

  return {
    schemaVersion: 2,
    diagnosticOnly: true,
    taskCount: taskIds.length,
    matchedTrialCount: rows.length,
    taskSuccess: summarizeDimension(rowsByTask, 'taskSuccess', taskIds),
    skillQuality: summarizeDimension(rowsByTask, 'skillQuality', taskIds),
    trajectoryQuality: summarizeDimension(rowsByTask, 'trajectoryQuality', taskIds),
  };
}
