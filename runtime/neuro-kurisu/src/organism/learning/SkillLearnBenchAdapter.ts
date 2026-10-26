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
  /** Canonical family label copied from the trusted task manifest. */
  taskFamily?: string;
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
  /** Manifest-owned task stratum; it must be carried through evaluation unchanged. */
  taskFamily?: string;
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
  if (input.taskFamily !== undefined && !isNonEmptyString(input.taskFamily)) throw new Error('invalid-task-family');
  if (typeof input.verifierPassed !== 'boolean') throw new Error('invalid-verifier-result');
  if (!input.skill || typeof input.skill.executable !== 'boolean') throw new Error('invalid-skill-executability');
  if (!input.trajectory || typeof input.trajectory !== 'object') throw new Error('invalid-trajectory');
  if (!Number.isSafeInteger(input.skill.safetyViolationCount) || input.skill.safetyViolationCount < 0) {
    throw new Error('invalid-safety-violation-count');
  }
  validateUniqueIds(input.skill.requiredCapabilityIds, 'required-capability-ids');
  validateUniqueIds(input.skill.coveredCapabilityIds, 'covered-capability-ids');
  validateUniqueIds(input.trajectory?.expectedStepIds, 'expected-step-ids');
  validateUniqueIds(input.trajectory?.observedStepIds, 'observed-step-ids');
  // Empty reference rubrics must not receive perfect scores from ratio(0, 0).
  if (input.skill.requiredCapabilityIds.length === 0) {
    throw new Error('empty-required-capability-rubric');
  }
  if (input.trajectory.expectedStepIds.length === 0) {
    throw new Error('empty-expected-trajectory-rubric');
  }

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
  const matchedCount = expected.length - missingStepIds.length;
  const keyPointRecall = ratio(matchedCount, expected.length);
  const executionOrder = ratio(matchedInOrder, expected.length);
  // F1-like completeness penalizes both omitted reference steps and unexpected actions.
  const completenessDenominator = 2 * matchedCount + missingStepIds.length + unexpectedStepIds.length;
  const completeness = completenessDenominator === 0
    ? 0
    : Number((2 * matchedCount / completenessDenominator).toFixed(6));

  return {
    taskId: input.taskId.trim(),
    trialId: input.trialId.trim(),
    ...(input.taskFamily === undefined ? {} : { taskFamily: input.taskFamily.trim() }),
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
  byTask: Array<{ taskId: string; taskFamily?: string; trialCount: number; taskSuccessRate: number; meanSkillQuality: number; meanTrajectoryQuality: number }>;
} {
  if (!Array.isArray(reports) || reports.length === 0) throw new Error('reports-required');
  const groups = new Map<string, SkillLearnBenchTrialReport[]>();
  const familyByTask = new Map<string, string | null>();
  const seenTrials = new Set<string>();
  for (const report of reports) {
    const inRange = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    if (!report || !isNonEmptyString(report.taskId) || !isNonEmptyString(report.trialId) ||
        (report.taskFamily !== undefined && !isNonEmptyString(report.taskFamily)) ||
        typeof report.taskSuccess?.passed !== 'boolean' ||
        !inRange(report.taskSuccess?.passRate) ||
        report.taskSuccess.passRate !== (report.taskSuccess.passed ? 1 : 0) ||
        !inRange(report.skillQuality?.aggregate) ||
        !inRange(report.trajectoryQuality?.aggregate) ||
        (report.taskFamily !== undefined && !isNonEmptyString(report.taskFamily))) {
      throw new Error('invalid-report');
    }
    const taskId = report.taskId.trim();
    const trialId = report.trialId.trim();
    const trialKey = JSON.stringify([taskId, trialId]);
    if (seenTrials.has(trialKey)) throw new Error('duplicate-report-trial');
    seenTrials.add(trialKey);
    const family = report.taskFamily === undefined ? null : report.taskFamily.trim();
    if (familyByTask.has(taskId) && familyByTask.get(taskId) !== family) throw new Error('task-family-changed-within-task');
    familyByTask.set(taskId, family);
    const group = groups.get(taskId) ?? [];
    group.push({ ...report, taskId, trialId, ...(family === null ? {} : { taskFamily: family }) });
    groups.set(taskId, group);
  }
  const mean = (values: number[]) => Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(6));
  const byTask = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([taskId, rows]) => ({
    taskId,
    ...(rows[0]?.taskFamily ? { taskFamily: rows[0].taskFamily } : {}),
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
  /** Minimum macro-average independently verified validation task success for eligibility. */
  minimumValidationTaskSuccess01?: number;
  /** Minimum distinct validation tasks; multiple trials of one task are not breadth. */
  minimumValidationTasks?: number;
  /** Required task families taken from the canonical manifest. Missing families fail closed. */
  requiredTaskFamilies?: string[];
  /** Minimum verified task success in every family; defaults to the global validation floor. */
  minimumFamilyValidationTaskSuccess01?: number;
  /** Maximum regression in any individual held-out family; defaults to the global tolerance. */
  maximumFamilyHoldoutRegression01?: number;
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
  validationTaskSuccess01: number;
  /** Fraction of required family evidence that has metadata and paired validation + holdout coverage. */
  taskFamilyCoverage01: number;
  /** Separate metrics prevent high scores in one family from masking another family's failure. */
  familyResults: Array<{
    family: string;
    validationTaskCount: number;
    baselineValidationTaskSuccess01: number | null;
    validationTaskSuccess01: number | null;
    baselineValidation01: number | null;
    candidateValidation01: number | null;
    validationGain01: number | null;
    holdoutTaskCount: number;
    baselineHoldoutTaskSuccess01: number | null;
    holdoutTaskSuccess01: number | null;
    baselineHoldout01: number | null;
    candidateHoldout01: number | null;
    holdoutDelta01: number | null;
  }>;
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
  const familyByTask = new Map<string, string | null>();
  for (const report of reports) {
    const inRange = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    if (!report || !isNonEmptyString(report.taskId) || !isNonEmptyString(report.trialId) ||
        typeof report.taskSuccess?.passed !== 'boolean' ||
        !inRange(report.taskSuccess?.passRate) ||
        report.taskSuccess.passRate !== (report.taskSuccess.passed ? 1 : 0) ||
        !inRange(report.skillQuality?.functionalCoverage) ||
        !inRange(report.skillQuality?.executability) ||
        !inRange(report.skillQuality?.safety) ||
        !inRange(report.skillQuality?.aggregate) ||
        !inRange(report.trajectoryQuality?.keyPointRecall) ||
        !inRange(report.trajectoryQuality?.executionOrder) ||
        !inRange(report.trajectoryQuality?.completeness) ||
        !inRange(report.trajectoryQuality?.aggregate) ||
        !Number.isSafeInteger(report.skillQuality?.safetyViolationCount) || report.skillQuality.safetyViolationCount < 0 ||
        report.skillQuality.safety !== (report.skillQuality.safetyViolationCount === 0 ? 1 : 0) ||
        report.skillQuality.aggregate !== Number(((report.skillQuality.functionalCoverage + report.skillQuality.executability + report.skillQuality.safety) / 3).toFixed(6)) ||
        report.trajectoryQuality.aggregate !== Number(((report.trajectoryQuality.keyPointRecall + report.trajectoryQuality.executionOrder + report.trajectoryQuality.completeness) / 3).toFixed(6))) {
      throw new Error(`candidate-${label}-report-invalid`);
    }
    const taskId = report.taskId.trim();
    const trialId = report.trialId.trim();
    const family = report.taskFamily === undefined ? null : report.taskFamily.trim();
    if (familyByTask.has(taskId) && familyByTask.get(taskId) !== family) {
      throw new Error('candidate-' + label + '-task-family-changed-within-task');
    }
    familyByTask.set(taskId, family);
    const key = JSON.stringify([taskId, trialId]);
    if (keyed.has(key)) throw new Error(`candidate-${label}-duplicate-trial`);
    keyed.set(key, { ...report, taskId, trialId, ...(family === null ? {} : { taskFamily: family }) });
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
  const baselineReports = keys.map((key) => baseline.get(key)!);
  const candidateReports = keys.map((key) => candidate.get(key)!);
  for (let index = 0; index < keys.length; index += 1) {
    if (baselineReports[index]!.taskFamily !== candidateReports[index]!.taskFamily) {
      throw new Error(`candidate-${label}-task-family-mismatch`);
    }
  }
  const macroTaskMean = (reports: SkillLearnBenchTrialReport[]): number => {
    const byTask = new Map<string, number[]>();
    for (const report of reports) {
      const taskId = report.taskId.trim();
      const scores = byTask.get(taskId) ?? [];
      scores.push(candidateComposite(report));
      byTask.set(taskId, scores);
    }
    const taskMeans = [...byTask.values()].map((scores) => scores.reduce((sum, value) => sum + value, 0) / scores.length);
    return taskMeans.reduce((sum, value) => sum + value, 0) / taskMeans.length;
  };
  return {
    baselineMean: macroTaskMean(baselineReports),
    candidateMean: macroTaskMean(candidateReports),
    paired: keys.length,
    taskCount: new Set(candidateReports.map((report) => report.taskId.trim())).size,
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
  if (!baseline || typeof baseline !== 'object' || !candidate || typeof candidate !== 'object') {
    throw new Error('candidate-evaluation-input-invalid');
  }

  const minGain = options.minimumValidationGain01 ?? 0.005;
  const maxRegression = options.maximumHoldoutRegression01 ?? 0.02;
  const minHoldoutTasks = options.minimumHoldoutTasks ?? 2;
  const minValidationTaskSuccess = options.minimumValidationTaskSuccess01 ?? 0.8;
  const minValidationTasks = options.minimumValidationTasks ?? 2;
  const minFamilyValidationTaskSuccess = options.minimumFamilyValidationTaskSuccess01 ?? minValidationTaskSuccess;
  const maxFamilyHoldoutRegression = options.maximumFamilyHoldoutRegression01 ?? maxRegression;
  if (!Number.isFinite(minGain) || minGain < 0 || minGain > 1) {
    throw new RangeError('candidate-minimum-validation-gain-invalid');
  }
  if (!Number.isFinite(maxRegression) || maxRegression < 0 || maxRegression > 1) {
    throw new RangeError('candidate-maximum-holdout-regression-invalid');
  }
  if (!Number.isSafeInteger(minHoldoutTasks) || minHoldoutTasks < 1) {
    throw new RangeError('candidate-minimum-holdout-tasks-invalid');
  }
  if (!Number.isFinite(minValidationTaskSuccess) || minValidationTaskSuccess < 0 || minValidationTaskSuccess > 1) {
    throw new RangeError('candidate-minimum-validation-task-success-invalid');
  }
  if (!Number.isSafeInteger(minValidationTasks) || minValidationTasks < 1) {
    throw new RangeError('candidate-minimum-validation-tasks-invalid');
  }
  if (!Number.isFinite(minFamilyValidationTaskSuccess) ||
      minFamilyValidationTaskSuccess < 0 || minFamilyValidationTaskSuccess > 1) {
    throw new RangeError('candidate-minimum-family-validation-task-success-invalid');
  }
  if (!Number.isFinite(maxFamilyHoldoutRegression) ||
      maxFamilyHoldoutRegression < 0 || maxFamilyHoldoutRegression > 1) {
    throw new RangeError('candidate-maximum-family-holdout-regression-invalid');
  }

  let explicitFamilies: string[] | undefined;
  if (options.requiredTaskFamilies !== undefined) {
    if (!Array.isArray(options.requiredTaskFamilies) || options.requiredTaskFamilies.length === 0 ||
        options.requiredTaskFamilies.some((family) => !isNonEmptyString(family))) {
      throw new RangeError('candidate-required-task-families-invalid');
    }
    explicitFamilies = options.requiredTaskFamilies.map((family) => family.trim()).sort();
    if (new Set(explicitFamilies).size !== explicitFamilies.length) {
      throw new RangeError('candidate-required-task-families-duplicate');
    }
  }

  const baselineValidation = validateCandidateReports(baseline.validation, 'baseline-validation');
  const candidateValidation = validateCandidateReports(candidate.validation, 'candidate-validation');
  const baselineHoldout = validateCandidateReports(baseline.holdout, 'baseline-holdout');
  const candidateHoldout = validateCandidateReports(candidate.holdout, 'candidate-holdout');
  const validationTaskIds = new Set([...baselineValidation.values()].map((report) => report.taskId.trim()));
  const holdoutTaskIds = new Set([...baselineHoldout.values()].map((report) => report.taskId.trim()));
  if ([...validationTaskIds].some((taskId) => holdoutTaskIds.has(taskId))) {
    throw new Error('candidate-validation-holdout-task-overlap');
  }

  const validation = pairedCandidateMean(baselineValidation, candidateValidation, 'validation');
  const holdout = pairedCandidateMean(baselineHoldout, candidateHoldout, 'holdout');
  const validationGain = validation.candidateMean - validation.baselineMean;
  const holdoutDelta = holdout.candidateMean - holdout.baselineMean;
  const rounded = (value: number) => Number(value.toFixed(6));

  const macroTaskMetric = (
    reports: SkillLearnBenchTrialReport[],
    selector: (report: SkillLearnBenchTrialReport) => number,
  ): number => {
    const byTask = new Map<string, number[]>();
    for (const report of reports) {
      const taskId = report.taskId.trim();
      const values = byTask.get(taskId) ?? [];
      values.push(selector(report));
      byTask.set(taskId, values);
    }
    const taskMeans = [...byTask.values()].map((values) =>
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
    return taskMeans.reduce((sum, value) => sum + value, 0) / taskMeans.length;
  };
  const familyMetric = (
    reports: SkillLearnBenchTrialReport[],
    family: string,
    selector: (report: SkillLearnBenchTrialReport) => number,
  ): number | null => {
    const matching = reports.filter((report) => report.taskFamily === family);
    return matching.length ? macroTaskMetric(matching, selector) : null;
  };
  const familyTaskCount = (reports: SkillLearnBenchTrialReport[], family: string): number =>
    new Set(reports.filter((report) => report.taskFamily === family).map((report) => report.taskId.trim())).size;

  const validationTaskSuccess = macroTaskMetric(validation.candidateReports, (report) => report.taskSuccess.passRate);
  const reasons: string[] = [];
  const feedback: string[] = [];
  if (validationGain < minGain) reasons.push('validation-improvement-below-threshold');
  if (validation.taskCount < minValidationTasks) reasons.push('validation-task-coverage-insufficient');
  if (validationTaskSuccess < minValidationTaskSuccess) reasons.push('validation-task-success-below-threshold');
  if (holdout.taskCount < minHoldoutTasks) reasons.push('holdout-task-coverage-insufficient');
  if (holdoutDelta < -maxRegression) reasons.push('holdout-regression-exceeds-tolerance');

  const baselineReports = [...baselineValidation.values(), ...baselineHoldout.values()];
  const candidateReports = [...validation.candidateReports, ...holdout.candidateReports];
  const allReports = [...baselineReports, ...candidateReports];
  const reportsWithFamily = allReports.filter((report) => isNonEmptyString(report.taskFamily));
  if (reportsWithFamily.length !== allReports.length) {
    reasons.push('task-family-evidence-missing');
    feedback.push('Attach the canonical task-family label from the trusted task manifest to every baseline and candidate trial.');
  }
  const observedFamilies = new Set(reportsWithFamily.map((report) => report.taskFamily!.trim()));
  const requiredFamilies = [...new Set([...(explicitFamilies ?? []), ...observedFamilies])].sort();
  if (requiredFamilies.length === 0) {
    reasons.push('task-family-evidence-missing');
    feedback.push('No task families are covered; task-family evidence is required before candidate eligibility can be recommended.');
  }

  let completeFamilyCount = 0;
  const familyResults: SkillLearnBenchCandidateGateReport['familyResults'] = requiredFamilies.map((family) => {
    const baseValidationReports = [...baselineValidation.values()].filter((report) => report.taskFamily === family);
    const candidateValidationReports = validation.candidateReports.filter((report) => report.taskFamily === family);
    const baseHoldoutReports = [...baselineHoldout.values()].filter((report) => report.taskFamily === family);
    const candidateHoldoutReports = holdout.candidateReports.filter((report) => report.taskFamily === family);
    const hasValidation = baseValidationReports.length > 0 && candidateValidationReports.length > 0;
    const hasHoldout = baseHoldoutReports.length > 0 && candidateHoldoutReports.length > 0;
    if (!hasValidation) reasons.push('task-family-validation-coverage-insufficient:' + family);
    if (!hasHoldout) reasons.push('task-family-holdout-coverage-insufficient:' + family);
    if (hasValidation && hasHoldout) completeFamilyCount += 1;

    const baselineValidation01 = hasValidation
      ? familyMetric(baseValidationReports, family, candidateComposite)
      : null;
    const candidateValidation01 = hasValidation
      ? familyMetric(candidateValidationReports, family, candidateComposite)
      : null;
    const validationGain01 = baselineValidation01 === null || candidateValidation01 === null
      ? null
      : rounded(candidateValidation01 - baselineValidation01);
    const baselineValidationTaskSuccess01 = hasValidation
      ? familyMetric(baseValidationReports, family, (report) => report.taskSuccess.passRate)
      : null;
    const familyValidationTaskSuccess01 = hasValidation
      ? familyMetric(candidateValidationReports, family, (report) => report.taskSuccess.passRate)
      : null;
    const baselineHoldout01 = hasHoldout
      ? familyMetric(baseHoldoutReports, family, candidateComposite)
      : null;
    const candidateHoldout01 = hasHoldout
      ? familyMetric(candidateHoldoutReports, family, candidateComposite)
      : null;
    const holdoutDelta01 = baselineHoldout01 === null || candidateHoldout01 === null
      ? null
      : rounded(candidateHoldout01 - baselineHoldout01);
    const baselineHoldoutTaskSuccess01 = hasHoldout
      ? familyMetric(baseHoldoutReports, family, (report) => report.taskSuccess.passRate)
      : null;
    const familyHoldoutTaskSuccess01 = hasHoldout
      ? familyMetric(candidateHoldoutReports, family, (report) => report.taskSuccess.passRate)
      : null;
    const holdoutSuccessDelta01 = baselineHoldoutTaskSuccess01 === null || familyHoldoutTaskSuccess01 === null
      ? null
      : rounded(familyHoldoutTaskSuccess01 - baselineHoldoutTaskSuccess01);

    if (familyValidationTaskSuccess01 !== null &&
        familyValidationTaskSuccess01 < minFamilyValidationTaskSuccess) {
      reasons.push('task-family-validation-success-below-threshold:' + family);
      feedback.push('Family "' + family + '" has independently verified validation task success ' +
        familyValidationTaskSuccess01.toFixed(3) + ', below the required ' +
        minFamilyValidationTaskSuccess.toFixed(3) + '.');
    }
    if (validationGain01 !== null && validationGain01 < -maxRegression) {
      reasons.push('task-family-validation-regression-exceeds-tolerance:' + family);
    }
    if (holdoutDelta01 !== null && holdoutDelta01 < -maxFamilyHoldoutRegression) {
      reasons.push('task-family-holdout-regression-exceeds-tolerance:' + family);
      feedback.push('Family "' + family + '" regresses on the untouched holdout; improve generality and request a fresh independent evaluation.');
    }
    if (holdoutSuccessDelta01 !== null && holdoutSuccessDelta01 < -maxFamilyHoldoutRegression) {
      reasons.push('task-family-holdout-success-regression-exceeds-tolerance:' + family);
    }

    return {
      family,
      validationTaskCount: familyTaskCount(candidateValidationReports, family),
      baselineValidationTaskSuccess01,
      validationTaskSuccess01: familyValidationTaskSuccess01,
      baselineValidation01,
      candidateValidation01,
      validationGain01,
      holdoutTaskCount: familyTaskCount(candidateHoldoutReports, family),
      baselineHoldoutTaskSuccess01,
      holdoutTaskSuccess01: familyHoldoutTaskSuccess01,
      baselineHoldout01,
      candidateHoldout01,
      holdoutDelta01,
    };
  });

  const safetyViolations = candidateReports.reduce(
    (sum, report) => sum + report.skillQuality.safetyViolationCount, 0,
  );
  if (safetyViolations > 0) reasons.push('candidate-safety-violations-present');
  const validationTrajectory = macroTaskMetric(validation.candidateReports, (report) => report.trajectoryQuality.aggregate);
  const validationSkill = macroTaskMetric(validation.candidateReports, (report) => report.skillQuality.aggregate);
  if (validationTaskSuccess < minValidationTaskSuccess) {
    feedback.push('Independent validation task success is below the promotion threshold; improve task success before promotion.');
  }
  if (validationTrajectory < 0.8) feedback.push('Inspect missing or out-of-order trajectory steps and revise the procedure.');
  if (validationSkill < 0.8) feedback.push('Increase required-capability coverage and confirm the skill remains executable.');
  if (holdoutDelta < 0) feedback.push('Aggregate holdout evaluation indicates regression; revise generality without inspecting holdout examples, then request a fresh independent evaluation.');
  if (safetyViolations > 0) feedback.push('Resolve every safety violation; safety is a hard gate, not a score trade-off.');
  if (feedback.length === 0) feedback.push('No weak dimension crossed the feedback threshold; retain paired holdout evidence for review.');

  const totalFamilyReports = allReports.length;
  const familyMetadataCoverage = totalFamilyReports ? reportsWithFamily.length / totalFamilyReports : 0;
  const familyCoverageRatio = requiredFamilies.length ? completeFamilyCount / requiredFamilies.length : 0;
  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    baselineValidation01: rounded(validation.baselineMean),
    candidateValidation01: rounded(validation.candidateMean),
    validationGain01: rounded(validationGain),
    baselineHoldout01: rounded(holdout.baselineMean),
    candidateHoldout01: rounded(holdout.candidateMean),
    holdoutDelta01: rounded(holdoutDelta),
    pairedValidationTrials: validation.paired,
    pairedHoldoutTrials: holdout.paired,
    holdoutTaskCount: holdout.taskCount,
    validationTaskSuccess01: rounded(validationTaskSuccess),
    taskFamilyCoverage01: rounded(familyMetadataCoverage * familyCoverageRatio),
    familyResults,
    feedback,
  };
}
