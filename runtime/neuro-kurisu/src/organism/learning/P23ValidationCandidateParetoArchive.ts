import { isSafeLearningIdentity, snapshotPlainData } from './LearningTrustBoundary.ts';
import type { SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';

export interface P23ValidationTaskVector {
  taskId: string;
  taskFamily?: string;
  trialCount: number;
  taskSuccess01: number;
  trajectoryQuality01: number;
  skillQuality01: number;
  safetyCompliance01: number;
}

/**
 * Validation-only objective matrix attached to a versioned candidate.
 * It intentionally has no holdout fields, scores, identifiers or gate feedback.
 */
export interface P23ValidationCandidateMetrics {
  schemaVersion: 1;
  trialCount: number;
  taskCount: number;
  taskSuccess01: number;
  trajectoryQuality01: number;
  skillQuality01: number;
  safetyCompliance01: number;
  tasks: P23ValidationTaskVector[];
}

const MAX_VALIDATION_TRIALS = 16_384;
const MAX_VALIDATION_TASKS = 4_096;
const OBJECTIVES = ['taskSuccess01', 'trajectoryQuality01', 'skillQuality01', 'safetyCompliance01'] as const;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isUnit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const round6 = (value: number): number => {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
};
const mean = (values: number[]): number =>
  round6(values.reduce((sum, value) => sum + value, 0) / values.length);

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function isValidP23ValidationCandidateMetrics(value: unknown): value is P23ValidationCandidateMetrics {
  if (!isRecord(value) || !exactKeys(value, [
    'schemaVersion','trialCount','taskCount','taskSuccess01','trajectoryQuality01',
    'skillQuality01','safetyCompliance01','tasks',
  ]) || value.schemaVersion !== 1 ||
      !Number.isSafeInteger(value.trialCount) || Number(value.trialCount) < 1 ||
      Number(value.trialCount) > MAX_VALIDATION_TRIALS ||
      !Number.isSafeInteger(value.taskCount) || Number(value.taskCount) < 1 ||
      Number(value.taskCount) > MAX_VALIDATION_TASKS ||
      !isUnit(value.taskSuccess01) || !isUnit(value.trajectoryQuality01) ||
      !isUnit(value.skillQuality01) || !isUnit(value.safetyCompliance01) ||
      !Array.isArray(value.tasks) || value.tasks.length !== value.taskCount) return false;

  const seen = new Set<string>();
  let trials = 0;
  for (const raw of value.tasks) {
    if (!isRecord(raw) || !(
      exactKeys(raw, ['taskId','taskFamily','trialCount','taskSuccess01','trajectoryQuality01','skillQuality01','safetyCompliance01']) ||
      exactKeys(raw, ['taskId','trialCount','taskSuccess01','trajectoryQuality01','skillQuality01','safetyCompliance01'])
    ) || !isSafeLearningIdentity(raw.taskId, 256) ||
        (raw.taskFamily !== undefined && !isSafeLearningIdentity(raw.taskFamily, 128)) ||
        !Number.isSafeInteger(raw.trialCount) || Number(raw.trialCount) < 1 ||
        !isUnit(raw.taskSuccess01) || !isUnit(raw.trajectoryQuality01) ||
        !isUnit(raw.skillQuality01) || !isUnit(raw.safetyCompliance01)) return false;
    const taskId = String(raw.taskId);
    if (seen.has(taskId)) return false;
    seen.add(taskId);
    trials += Number(raw.trialCount);
    if (trials > MAX_VALIDATION_TRIALS) return false;
  }
  if (trials !== value.trialCount) return false;
  const tasks = value.tasks as P23ValidationTaskVector[];
  if (tasks.some((task, index) => index > 0 && tasks[index - 1].taskId.localeCompare(task.taskId) >= 0)) return false;
  for (const objective of OBJECTIVES) {
    if (Number(value[objective]) !== mean(tasks.map(task => task[objective]))) return false;
  }
  return true;
}

/** Build a detached, bounded, deterministic per-task vector from validation reports only. */
export function buildP23ValidationCandidateMetrics(
  rawReports: readonly SkillLearnBenchTrialReport[],
): P23ValidationCandidateMetrics {
  let detached: unknown;
  try { detached = snapshotPlainData(rawReports); }
  catch { throw new Error('p23-validation-metrics-data-boundary-rejected'); }
  if (!Array.isArray(detached) || detached.length < 1 || detached.length > MAX_VALIDATION_TRIALS) {
    throw new Error('p23-validation-metrics-trial-count-limit');
  }

  const groups = new Map<string, {
    family: string | null;
    trialIds: Set<string>;
    taskSuccess: number[];
    trajectory: number[];
    skill: number[];
    safety: number[];
  }>();
  for (const raw of detached) {
    if (!isRecord(raw) || !isSafeLearningIdentity(raw.taskId, 256) ||
        !isSafeLearningIdentity(raw.trialId, 256) ||
        (raw.taskFamily !== undefined && !isSafeLearningIdentity(raw.taskFamily, 128)) ||
        !isRecord(raw.taskSuccess) || typeof raw.taskSuccess.passed !== 'boolean' ||
        raw.taskSuccess.passRate !== (raw.taskSuccess.passed ? 1 : 0) ||
        !isRecord(raw.skillQuality) || !isUnit(raw.skillQuality.functionalCoverage) ||
        !isUnit(raw.skillQuality.executability) || !isUnit(raw.skillQuality.safety) ||
        !isUnit(raw.skillQuality.aggregate) ||
        !Number.isSafeInteger(raw.skillQuality.safetyViolationCount) ||
        Number(raw.skillQuality.safetyViolationCount) < 0 ||
        raw.skillQuality.safety !== (raw.skillQuality.safetyViolationCount === 0 ? 1 : 0) ||
        raw.skillQuality.aggregate !== round6((
          Number(raw.skillQuality.functionalCoverage) +
          Number(raw.skillQuality.executability) + Number(raw.skillQuality.safety)
        ) / 3) ||
        !isRecord(raw.trajectoryQuality) || !isUnit(raw.trajectoryQuality.keyPointRecall) ||
        !isUnit(raw.trajectoryQuality.executionOrder) || !isUnit(raw.trajectoryQuality.completeness) ||
        !isUnit(raw.trajectoryQuality.aggregate) ||
        raw.trajectoryQuality.aggregate !== round6((
          Number(raw.trajectoryQuality.keyPointRecall) +
          Number(raw.trajectoryQuality.executionOrder) +
          Number(raw.trajectoryQuality.completeness)
        ) / 3)) {
      throw new Error('p23-validation-metrics-report-invalid');
    }
    const taskId = String(raw.taskId);
    const trialId = String(raw.trialId);
    const family = raw.taskFamily === undefined ? null : String(raw.taskFamily);
    const group = groups.get(taskId) ?? {
      family, trialIds: new Set<string>(), taskSuccess: [], trajectory: [], skill: [], safety: [],
    };
    if (group.family !== family) throw new Error('p23-validation-metrics-task-family-conflict');
    if (group.trialIds.has(trialId)) throw new Error('p23-validation-metrics-duplicate-trial');
    group.trialIds.add(trialId);
    group.taskSuccess.push(Number(raw.taskSuccess.passRate));
    group.trajectory.push(Number(raw.trajectoryQuality.aggregate));
    group.skill.push(Number(raw.skillQuality.aggregate));
    group.safety.push(Number(raw.skillQuality.safety));
    groups.set(taskId, group);
  }
  if (groups.size > MAX_VALIDATION_TASKS) throw new Error('p23-validation-metrics-task-count-limit');

  const tasks: P23ValidationTaskVector[] = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([taskId, row]) => ({
      taskId,
      ...(row.family === null ? {} : { taskFamily: row.family }),
      trialCount: row.trialIds.size,
      taskSuccess01: mean(row.taskSuccess),
      trajectoryQuality01: mean(row.trajectory),
      skillQuality01: mean(row.skill),
      safetyCompliance01: mean(row.safety),
    }));
  const metrics: P23ValidationCandidateMetrics = {
    schemaVersion: 1,
    trialCount: detached.length,
    taskCount: tasks.length,
    taskSuccess01: mean(tasks.map(task => task.taskSuccess01)),
    trajectoryQuality01: mean(tasks.map(task => task.trajectoryQuality01)),
    skillQuality01: mean(tasks.map(task => task.skillQuality01)),
    safetyCompliance01: mean(tasks.map(task => task.safetyCompliance01)),
    tasks,
  };
  if (!isValidP23ValidationCandidateMetrics(metrics)) {
    throw new Error('p23-validation-metrics-internal-validation-failed');
  }
  return metrics;
}

function sameTaskCohort(a: P23ValidationCandidateMetrics, b: P23ValidationCandidateMetrics): boolean {
  return a.taskCount === b.taskCount && a.tasks.every((task, index) =>
    task.taskId === b.tasks[index].taskId && task.taskFamily === b.tasks[index].taskFamily);
}

/** Strict per-example Pareto dominance across success, trajectory, skill quality and safety. */
export function dominatesP23ValidationCandidate(
  candidate: P23ValidationCandidateMetrics,
  other: P23ValidationCandidateMetrics,
): boolean {
  if (!isValidP23ValidationCandidateMetrics(candidate) || !isValidP23ValidationCandidateMetrics(other)) {
    throw new Error('p23-validation-pareto-metrics-invalid');
  }
  if (!sameTaskCohort(candidate, other)) {
    throw new Error('p23-validation-pareto-task-cohort-mismatch');
  }
  let strictlyBetter = false;
  for (let index = 0; index < candidate.tasks.length; index++) {
    const left = candidate.tasks[index];
    const right = other.tasks[index];
    for (const objective of OBJECTIVES) {
      if (left[objective] < right[objective]) return false;
      if (left[objective] > right[objective]) strictlyBetter = true;
    }
  }
  return strictlyBetter;
}

/** Deterministic per-example Pareto frontier; no aggregate-only shortcut and no promotion authority. */
export function computeP23ValidationParetoFront<T extends {
  candidateId: string;
  validationMetrics: P23ValidationCandidateMetrics;
}>(entries: readonly T[]): T[] {
  if (!Array.isArray(entries) || entries.length > 512) {
    throw new Error('p23-validation-pareto-candidate-count-limit');
  }
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry || !isSafeLearningIdentity(entry.candidateId, 128) ||
        ids.has(entry.candidateId) || !isValidP23ValidationCandidateMetrics(entry.validationMetrics)) {
      throw new Error('p23-validation-pareto-entry-invalid');
    }
    ids.add(entry.candidateId);
  }
  if (entries.length < 2) return [...entries];
  const first = entries[0].validationMetrics;
  if (entries.some(entry => !sameTaskCohort(first, entry.validationMetrics))) {
    throw new Error('p23-validation-pareto-task-cohort-mismatch');
  }
  return entries.filter((entry, index) =>
    !entries.some((other, otherIndex) => otherIndex !== index &&
      dominatesP23ValidationCandidate(other.validationMetrics, entry.validationMetrics))
  ).sort((a, b) => a.candidateId.localeCompare(b.candidateId));
}
