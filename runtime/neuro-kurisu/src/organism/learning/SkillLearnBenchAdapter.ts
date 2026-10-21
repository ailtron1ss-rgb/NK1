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


export type CandidateEvaluationSplit = 'validation' | 'holdout';

export interface SkillLearnBenchCandidateEvaluation {
  split: CandidateEvaluationSplit;
  reports: SkillLearnBenchTrialReport[];
}

export interface SkillLearnBenchCandidateGateOptions {
  /** Minimum macro-average validation improvement required to recommend promotion. */
  minimumValidationGain01?: number;
  /** Maximum tolerated macro-average holdout regression. */
  maximumHoldoutRegression01?: number;
  /** Minimum number of distinct holdout tasks; empty holdout must never pass. */
  minimumHoldoutTasks?: number;
}

export interface SkillLearnBenchCandidateGateReport {
  eligible: boolean;
  reasons: string[];
  baselineValidation01: number;
  candidateValidation01: number;
  validationGain01: number;
  baselineHoldout01: number;
  candidateHoldout01: number;
  holdoutDelta01: number;
  pairedValidationTrials: number;
  pairedHoldoutTrials: number;
  holdoutTaskCount: number;
  feedback: string[];
}

const candidateComposite = (report: SkillLearnBenchTrialReport): number =>
  0.5 * report.taskSuccess.passRate +
  0.3 * report.trajectoryQuality.aggregate +
  0.2 * report.skillQuality.aggregate;

function validateCandidateReports(
  reports: SkillLearnBenchTrialReport[],
  label: string,
): Map<string, SkillLearnBenchTrialReport> {
  if (!Array.isArray(reports) || reports.length === 0) {
    throw new Error(`candidate-${label}-reports-required`);
  }
  const keyed = new Map<string, SkillLearnBenchTrialReport>();
  for (const report of reports) {
    if (!report || !isNonEmptyString(report.taskId) || !isNonEmptyString(report.trialId) ||
        typeof report.taskSuccess?.passRate !== 'number' ||
        !Number.isFinite(report.taskSuccess.passRate) || report.taskSuccess.passRate < 0 || report.taskSuccess.passRate > 1 ||
        typeof report.skillQuality?.aggregate !== 'number' ||
        !Number.isFinite(report.skillQuality.aggregate) || report.skillQuality.aggregate < 0 || report.skillQuality.aggregate > 1 ||
        typeof report.trajectoryQuality?.aggregate !== 'number' ||
        !Number.isFinite(report.trajectoryQuality.aggregate) || report.trajectoryQuality.aggregate < 0 || report.trajectoryQuality.aggregate > 1 ||
        !Number.isSafeInteger(report.skillQuality.safetyViolationCount) || report.skillQuality.safetyViolationCount < 0) {
      throw new Error(`candidate-${label}-report-invalid`);
    }
    const key = `${report.taskId.trim()}\u0000${report.trialId.trim()}`;
    if (keyed.has(key)) throw new Error(`candidate-${label}-duplicate-trial`);
    keyed.set(key, report);
  }
  return keyed;
}

function pairedCandidateMean(
  baseline: Map<string, SkillLearnBenchTrialReport>,
  candidate: Map<string, SkillLearnBenchTrialReport>,
  label: string,
): { baselineMean: number; candidateMean: number; paired: number; taskCount: number; candidateReports: SkillLearnBenchTrialReport[] } {
  const keys = [...baseline.keys()].filter((key) => candidate.has(key)).sort();
  if (keys.length === 0 || keys.length !== baseline.size || keys.length !== candidate.size) {
    throw new Error(`candidate-${label}-trials-must-match-exactly`);
  }
  const baseScores = keys.map((key) => candidateComposite(baseline.get(key)!));
  const candidateReports = keys.map((key) => candidate.get(key)!);
  const candidateScores = candidateReports.map(candidateComposite);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    baselineMean: mean(baseScores),
    candidateMean: mean(candidateScores),
    paired: keys.length,
    taskCount: new Set(candidateReports.map((report) => report.taskId)).size,
    candidateReports,
  };
}

/**
 * Hermes Self-Evolution-inspired candidate gate for SkillLearnBench reports.
 *
 * Uses paired, task/trial-matched evidence, a multi-axis fitness score, a
 * separate untouched holdout, and a hard safety gate. It only recommends
 * eligibility; it never activates or writes a candidate. The caller must
 * still require the existing approval/activation path.
 */
export function evaluateSkillLearnBenchCandidate(
  baseline: {
    validation: SkillLearnBenchTrialReport[];
    holdout: SkillLearnBenchTrialReport[];
  },
  candidate: {
    validation: SkillLearnBenchTrialReport[];
    holdout: SkillLearnBenchTrialReport[];
  },
  options: SkillLearnBenchCandidateGateOptions = {},
): SkillLearnBenchCandidateGateReport {
  const minGain = options.minimumValidationGain01 ?? 0.005;
  const maxRegression = options.maximumHoldoutRegression01 ?? 0.02;
  const minHoldoutTasks = options.minimumHoldoutTasks ?? 2;
  if (!Number.isFinite(minGain) || minGain < 0 || minGain > 1) {
    throw new RangeError('candidate-minimum-validation-gain-invalid');
  }
  if (!Number.isFinite(maxRegression) || maxRegression < 0 || maxRegression > 1) {
    throw new RangeError('candidate-maximum-holdout-regression-invalid');
  }
  if (!Number.isSafeInteger(minHoldoutTasks) || minHoldoutTasks < 1) {
    throw new RangeError('candidate-minimum-holdout-tasks-invalid');
  }

  const validation = pairedCandidateMean(
    validateCandidateReports(baseline.validation, 'baseline-validation'),
    validateCandidateReports(candidate.validation, 'candidate-validation'),
    'validation',
  );
  const holdout = pairedCandidateMean(
    validateCandidateReports(baseline.holdout, 'baseline-holdout'),
    validateCandidateReports(candidate.holdout, 'candidate-holdout'),
    'holdout',
  );
  const validationGain = validation.candidateMean - validation.baselineMean;
  const holdoutDelta = holdout.candidateMean - holdout.baselineMean;
  const reasons: string[] = [];
  const feedback: string[] = [];

  if (validationGain < minGain) reasons.push('validation-improvement-below-threshold');
  if (holdout.taskCount < minHoldoutTasks) reasons.push('holdout-task-coverage-insufficient');
  if (holdoutDelta < -maxRegression) reasons.push('holdout-regression-exceeds-tolerance');

  const allCandidateReports = [...validation.candidateReports, ...holdout.candidateReports];
  const safetyViolations = allCandidateReports.reduce(
    (sum, report) => sum + report.skillQuality.safetyViolationCount, 0,
  );
  if (safetyViolations > 0) reasons.push('candidate-safety-violations-present');

  const mean = (reports: SkillLearnBenchTrialReport[], selector: (r: SkillLearnBenchTrialReport) => number) =>
    reports.reduce((sum, report) => sum + selector(report), 0) / reports.length;
  const validationTaskSuccess = mean(validation.candidateReports, (r) => r.taskSuccess.passRate);
  const validationTrajectory = mean(validation.candidateReports, (r) => r.trajectoryQuality.aggregate);
  const validationSkill = mean(validation.candidateReports, (r) => r.skillQuality.aggregate);
  if (validationTaskSuccess < 0.8) feedback.push('Improve independently verified task success before promotion.');
  if (validationTrajectory < 0.8) feedback.push('Inspect missing or out-of-order trajectory steps and revise the procedure.');
  if (validationSkill < 0.8) feedback.push('Increase required-capability coverage and confirm the skill remains executable.');
  if (holdoutDelta < 0) feedback.push('The candidate regresses on holdout; inspect task-specific failures before another attempt.');
  if (safetyViolations > 0) feedback.push('Resolve every safety violation; safety is a hard gate, not a score trade-off.');
  if (feedback.length === 0) feedback.push('No weak dimension crossed the feedback threshold; retain paired holdout evidence for review.');

  const rounded = (value: number) => Number(value.toFixed(6));
  return {
    eligible: reasons.length === 0,
    reasons,
    baselineValidation01: rounded(validation.baselineMean),
    candidateValidation01: rounded(validation.candidateMean),
    validationGain01: rounded(validationGain),
    baselineHoldout01: rounded(holdout.baselineMean),
    candidateHoldout01: rounded(holdout.candidateMean),
    holdoutDelta01: rounded(holdoutDelta),
    pairedValidationTrials: validation.paired,
    pairedHoldoutTrials: holdout.paired,
    holdoutTaskCount: holdout.taskCount,
    feedback,
  };
}
