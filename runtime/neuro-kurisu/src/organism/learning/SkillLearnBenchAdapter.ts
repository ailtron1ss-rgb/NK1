/**
 * SkillLearnBench-compatible evaluation adapter.
 *
 * Adapted from the three evaluation dimensions described by SkillLearnBench:
 * task success, skill quality, and trajectory quality. This is a native
 * NeuroCore implementation; it does not execute untrusted skills or accept
 * self-reported success as verifier evidence.
 */
export interface SkillLearnBenchTrialInput {
  taskId: string;
  trialId: string;
  /** Result from an independent task verifier, never inferred from the skill. */
  verifierPassed: boolean;
  skill: {
    requiredCapabilityIds: string[];
    coveredCapabilityIds: string[];
    /** Result of a real parser/runtime preflight, supplied by the trusted evaluator. */
    executable: boolean;
    /** Counted by an independent safety scanner/reviewer. */
    safetyViolationCount: number;
  };
  trajectory: {
    /** Ordered key steps from the task-specific reference rubric. */
    expectedStepIds: string[];
    /** Observed action/trace step IDs from the actual execution. */
    observedStepIds: string[];
  };
}

export interface SkillLearnBenchTrialReport {
  taskId: string;
  trialId: string;
  taskSuccess: { passed: boolean; passRate: number };
  skillQuality: {
    functionalCoverage: number;
    executability: number;
    safety: number;
    aggregate: number;
    missingCapabilityIds: string[];
    safetyViolationCount: number;
  };
  trajectoryQuality: {
    keyPointRecall: number;
    executionOrder: number;
    completeness: number;
    aggregate: number;
    missingStepIds: string[];
    unexpectedStepIds: string[];
  };
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function validateUniqueIds(ids: unknown, field: string): asserts ids is string[] {
  if (!Array.isArray(ids) || ids.some((id) => !isNonEmptyString(id))) {
    throw new Error(`invalid-${field}`);
  }
  if (new Set(ids).size !== ids.length) throw new Error(`duplicate-${field}`);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Number((numerator / denominator).toFixed(6));
}

/** Count reference steps observed in reference order (not merely present). */
function orderedMatches(expected: string[], observed: string[]): number {
  let cursor = 0;
  let matched = 0;
  for (const step of expected) {
    const index = observed.indexOf(step, cursor);
    if (index >= 0) {
      matched += 1;
      cursor = index + 1;
    }
  }
  return matched;
}

export function evaluateSkillLearnBenchTrial(
  input: SkillLearnBenchTrialInput,
): SkillLearnBenchTrialReport {
  if (!input || !isNonEmptyString(input.taskId) || !isNonEmptyString(input.trialId)) {
    throw new Error('invalid-trial-identity');
  }
  if (typeof input.verifierPassed !== 'boolean') throw new Error('invalid-verifier-result');
  if (!input.skill || typeof input.skill.executable !== 'boolean') throw new Error('invalid-skill-executability');
  if (!Number.isSafeInteger(input.skill.safetyViolationCount) || input.skill.safetyViolationCount < 0) {
    throw new Error('invalid-safety-violation-count');
  }
  validateUniqueIds(input.skill.requiredCapabilityIds, 'required-capability-ids');
  validateUniqueIds(input.skill.coveredCapabilityIds, 'covered-capability-ids');
  validateUniqueIds(input.trajectory?.expectedStepIds, 'expected-step-ids');
  validateUniqueIds(input.trajectory?.observedStepIds, 'observed-step-ids');

  const required = input.skill.requiredCapabilityIds;
  const covered = new Set(input.skill.coveredCapabilityIds);
  const missingCapabilityIds = required.filter((id) => !covered.has(id));
  const functionalCoverage = ratio(required.length - missingCapabilityIds.length, required.length);
  const executability = input.skill.executable ? 1 : 0;
  const safety = input.skill.safetyViolationCount === 0 ? 1 : 0;

  const expected = input.trajectory.expectedStepIds;
  const observed = input.trajectory.observedStepIds;
  const observedSet = new Set(observed);
  const missingStepIds = expected.filter((id) => !observedSet.has(id));
  const expectedSet = new Set(expected);
  const unexpectedStepIds = observed.filter((id) => !expectedSet.has(id));
  const matchedInOrder = orderedMatches(expected, observed);
  const keyPointRecall = ratio(expected.length - missingStepIds.length, expected.length);
  const executionOrder = ratio(matchedInOrder, expected.length);
  const completeness = ratio(expected.length - missingStepIds.length, expected.length);

  return {
    taskId: input.taskId.trim(),
    trialId: input.trialId.trim(),
    taskSuccess: { passed: input.verifierPassed, passRate: input.verifierPassed ? 1 : 0 },
    skillQuality: {
      functionalCoverage,
      executability,
      safety,
      aggregate: Number(((functionalCoverage + executability + safety) / 3).toFixed(6)),
      missingCapabilityIds,
      safetyViolationCount: input.skill.safetyViolationCount,
    },
    trajectoryQuality: {
      keyPointRecall,
      executionOrder,
      completeness,
      aggregate: Number(((keyPointRecall + executionOrder + completeness) / 3).toFixed(6)),
      missingStepIds,
      unexpectedStepIds,
    },
  };
}

/** Aggregate trial reports without letting task-rich families dominate the result. */
export function aggregateSkillLearnBenchReports(
  reports: SkillLearnBenchTrialReport[],
): {
  trialCount: number;
  taskCount: number;
  taskSuccessRate: number;
  meanSkillQuality: number;
  meanTrajectoryQuality: number;
  byTask: Array<{ taskId: string; trialCount: number; taskSuccessRate: number; meanSkillQuality: number; meanTrajectoryQuality: number }>;
} {
  if (!Array.isArray(reports) || reports.length === 0) throw new Error('reports-required');
  const groups = new Map<string, SkillLearnBenchTrialReport[]>();
  for (const report of reports) {
    if (!report || !isNonEmptyString(report.taskId) || !isNonEmptyString(report.trialId)) {
      throw new Error('invalid-report');
    }
    const group = groups.get(report.taskId) ?? [];
    group.push(report);
    groups.set(report.taskId, group);
  }
  const mean = (values: number[]) => Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(6));
  const byTask = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([taskId, rows]) => ({
    taskId,
    trialCount: rows.length,
    taskSuccessRate: mean(rows.map((r) => r.taskSuccess.passRate)),
    meanSkillQuality: mean(rows.map((r) => r.skillQuality.aggregate)),
    meanTrajectoryQuality: mean(rows.map((r) => r.trajectoryQuality.aggregate)),
  }));
  // Macro-average task-level scores, so tasks with more trials do not dominate.
  return {
    trialCount: reports.length,
    taskCount: byTask.length,
    taskSuccessRate: mean(byTask.map((r) => r.taskSuccessRate)),
    meanSkillQuality: mean(byTask.map((r) => r.meanSkillQuality)),
    meanTrajectoryQuality: mean(byTask.map((r) => r.meanTrajectoryQuality)),
    byTask,
  };
}
