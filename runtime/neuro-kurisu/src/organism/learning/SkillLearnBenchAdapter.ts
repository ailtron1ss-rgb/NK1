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
  /** Canonical task family from a trusted benchmark/experiment manifest when available. */
  taskFamily?: string;
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
  /** Omitted only for legacy reports lacking canonical family provenance. */
  taskFamily?: string;
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
const isSafeTaskFamily = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128 &&
  value.trim() === value &&
  !Array.from(value).some(character => {
    const code=character.codePointAt(0)??0;
    return code<=0x1f||(code>=0x7f&&code<=0x9f);
  });

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
  if (input.taskFamily !== undefined && !isSafeTaskFamily(input.taskFamily.normalize('NFKC').trim())) throw new Error('invalid-task-family');
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
    ...(input.taskFamily !== undefined ? { taskFamily: input.taskFamily.normalize('NFKC').trim() } : {}),
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
  const seenTrials = new Set<string>();
  for (const report of reports) {
    const inRange = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    if (!report || !isNonEmptyString(report.taskId) || !isNonEmptyString(report.trialId) ||
        (report.taskFamily !== undefined && !isSafeTaskFamily(report.taskFamily)) ||
        typeof report.taskSuccess?.passed !== 'boolean' ||
        !inRange(report.taskSuccess?.passRate) ||
        report.taskSuccess.passRate !== (report.taskSuccess.passed ? 1 : 0) ||
        !inRange(report.skillQuality?.aggregate) ||
        !inRange(report.trajectoryQuality?.aggregate)) {
      throw new Error('invalid-report');
    }
    const taskId = report.taskId.trim();
    const trialId = report.trialId.trim();
    const trialKey = JSON.stringify([taskId, trialId]);
    if (seenTrials.has(trialKey)) throw new Error('duplicate-report-trial');
    seenTrials.add(trialKey);
    const group = groups.get(taskId) ?? [];
    group.push(report);
    groups.set(taskId, group);
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
  /** Maximum tolerated regression for adequately sampled held-out task families. */
  maximumHoldoutFamilyRegression01?: number;
  /** Minimum distinct tasks in one family before that family's regression can veto promotion. */
  minimumHoldoutFamilyTasks?: number;
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
  /** Number of families with sufficient matched holdout task coverage. */
  holdoutFamiliesEvaluated: number;
  /** Count of sufficiently sampled family regressions; names/scores stay out of optimizer feedback. */
  holdoutFamilyRegressions: number;
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
    const inRange = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    if (!report || !isNonEmptyString(report.taskId) || !isNonEmptyString(report.trialId) ||
        (report.taskFamily !== undefined && !isSafeTaskFamily(report.taskFamily)) ||
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
    const key = JSON.stringify([report.taskId.trim(), report.trialId.trim()]);
    if (keyed.has(key)) throw new Error(`candidate-${label}-duplicate-trial`);
    keyed.set(key, report);
  }
  return keyed;
}

function pairedCandidateMean(
  baseline: Map<string, SkillLearnBenchTrialReport>,
  candidate: Map<string, SkillLearnBenchTrialReport>,
  label: string,
): { baselineMean: number; candidateMean: number; paired: number; taskCount: number; candidateReports: SkillLearnBenchTrialReport[]; pairs: Array<{ baseline: SkillLearnBenchTrialReport; candidate: SkillLearnBenchTrialReport }> } {
  const keys = [...baseline.keys()].filter((key) => candidate.has(key)).sort();
  if (keys.length === 0 || keys.length !== baseline.size || keys.length !== candidate.size) {
    throw new Error(`candidate-${label}-trials-must-match-exactly`);
  }
  const baselineReports = keys.map((key) => baseline.get(key)!);
  const candidateReports = keys.map((key) => candidate.get(key)!);
  for (let index=0; index<keys.length; index++) {
    const baselineFamily=baselineReports[index].taskFamily;
    const candidateFamily=candidateReports[index].taskFamily;
    if (baselineFamily!==undefined && candidateFamily!==undefined && baselineFamily!==candidateFamily) {
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
    pairs: keys.map(key=>({baseline:baseline.get(key)!,candidate:candidate.get(key)!})),
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
  if (!Number.isFinite(minGain) || minGain < 0 || minGain > 1) {
    throw new RangeError('candidate-minimum-validation-gain-invalid');
  }
  if (!Number.isFinite(maxRegression) || maxRegression < 0 || maxRegression > 1) {
    throw new RangeError('candidate-maximum-holdout-regression-invalid');
  }
  if (!Number.isSafeInteger(minHoldoutTasks) || minHoldoutTasks < 1) {
    throw new RangeError('candidate-minimum-holdout-tasks-invalid');
  }
  const maxFamilyRegression = options.maximumHoldoutFamilyRegression01 ?? 0.10;
  const minFamilyTasks = options.minimumHoldoutFamilyTasks ?? 2;
  if (!Number.isFinite(maxFamilyRegression) || maxFamilyRegression < 0 || maxFamilyRegression > 1) {
    throw new RangeError('candidate-maximum-holdout-family-regression-invalid');
  }
  if (!Number.isSafeInteger(minFamilyTasks) || minFamilyTasks < 1) {
    throw new RangeError('candidate-minimum-holdout-family-tasks-invalid');
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
  const familyRows = new Map<string, Map<string, { baseline:number[]; candidate:number[] }>>();
  for (const pair of holdout.pairs) {
    const family=pair.candidate.taskFamily ?? pair.baseline.taskFamily;
    if (!family) continue; // Legacy reports without family provenance keep the aggregate gate only.
    const taskId=pair.candidate.taskId.trim();
    const tasks=familyRows.get(family)??new Map<string,{baseline:number[];candidate:number[]}>();
    const scores=tasks.get(taskId)??{baseline:[],candidate:[]};
    scores.baseline.push(candidateComposite(pair.baseline));
    scores.candidate.push(candidateComposite(pair.candidate));
    tasks.set(taskId,scores);familyRows.set(family,tasks);
  }
  const familyStats=[...familyRows.entries()].map(([family,tasks])=>{
    const rows=[...tasks.values()];
    const mean=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;
    const baselineMean=mean(rows.map(row=>mean(row.baseline)));
    const candidateMean=mean(rows.map(row=>mean(row.candidate)));
    return {family,taskCount:tasks.size,delta:candidateMean-baselineMean};
  }).filter(row=>row.taskCount>=minFamilyTasks);
  const holdoutFamilyRegressions=familyStats.filter(row=>row.delta < -maxFamilyRegression).length;
  const validationGain = validation.candidateMean - validation.baselineMean;
  const holdoutDelta = holdout.candidateMean - holdout.baselineMean;
  const reasons: string[] = [];
  const feedback: string[] = [];

  if (validationGain < minGain) reasons.push('validation-improvement-below-threshold');
  if (holdout.taskCount < minHoldoutTasks) reasons.push('holdout-task-coverage-insufficient');
  if (holdoutDelta < -maxRegression) reasons.push('holdout-regression-exceeds-tolerance');
  if (holdoutFamilyRegressions > 0) reasons.push('holdout-family-regression-exceeds-tolerance');

  const allCandidateReports = [...validation.candidateReports, ...holdout.candidateReports];
  const safetyViolations = allCandidateReports.reduce(
    (sum, report) => sum + report.skillQuality.safetyViolationCount, 0,
  );
  if (safetyViolations > 0) reasons.push('candidate-safety-violations-present');

  const macroTaskMetric = (reports: SkillLearnBenchTrialReport[], selector: (r: SkillLearnBenchTrialReport) => number) => {
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
  const validationTaskSuccess = macroTaskMetric(validation.candidateReports, (r) => r.taskSuccess.passRate);
  const validationTrajectory = macroTaskMetric(validation.candidateReports, (r) => r.trajectoryQuality.aggregate);
  const validationSkill = macroTaskMetric(validation.candidateReports, (r) => r.skillQuality.aggregate);
  if (validationTaskSuccess < 0.8) feedback.push('Improve independently verified task success before promotion.');
  if (validationTrajectory < 0.8) feedback.push('Inspect missing or out-of-order trajectory steps and revise the procedure.');
  if (validationSkill < 0.8) feedback.push('Increase required-capability coverage and confirm the skill remains executable.');
  if (holdoutDelta < 0) feedback.push('Aggregate holdout evaluation indicates regression; revise generality without inspecting holdout examples, then request a fresh independent evaluation.');
  if (holdoutFamilyRegressions > 0) feedback.push('At least one sufficiently sampled holdout task family regressed; improve generality without inspecting holdout examples and request a fresh independent evaluation.');
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
    holdoutFamiliesEvaluated: familyStats.length,
    holdoutFamilyRegressions,
    feedback,
  };
}
