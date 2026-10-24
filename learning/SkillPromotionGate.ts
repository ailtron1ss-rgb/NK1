/**
 * NK1 skill promotion gate.
 *
 * Keeps candidate generation separate from activation. A candidate is only
 * eligible when it has traceable evidence, clears validation and holdout
 * thresholds, and does not exceed the permitted regression budget.
 *
 * This module is intentionally dependency-free so it can be adapted into the
 * runtime's existing learning engine without importing a second architecture.
 */

export type EvaluationSlice = {
  /** Number of independent evaluation cases. */
  cases: number;
  /** Fraction of cases completed successfully, in [0, 1]. */
  successRate: number;
  /** Mean trajectory-quality score, in [0, 1]. */
  trajectoryQuality: number;
  /** Mean skill-quality score, in [0, 1]. */
  skillQuality: number;
};

export type SkillCandidateEvidence = {
  candidateId: string;
  sourceSkillVersion: string;
  /** Stable IDs of real failure/session traces used to propose this revision. */
  sourceTraceIds: string[];
  /** Hash or immutable identifier for the exact candidate artifact. */
  artifactDigest: string;
  validation: EvaluationSlice;
  holdout: EvaluationSlice;
  /** Performance of the currently active skill on the same evaluation protocol. */
  baseline: EvaluationSlice;
  /** True only when the evaluator is independent of candidate generation. */
  independentlyEvaluated: boolean;
  /** True when secrets and untrusted instruction payloads were scrubbed. */
  inputSanitized: boolean;
};

export type PromotionPolicy = {
  minCasesPerSlice: number;
  minValidationSuccess: number;
  minHoldoutSuccess: number;
  minTrajectoryQuality: number;
  minSkillQuality: number;
  /** Maximum tolerated absolute success-rate drop versus baseline. */
  maxSuccessRegression: number;
};

export type PromotionDecision = {
  eligible: boolean;
  reasons: string[];
  candidateId: string;
  artifactDigest: string;
  /** Eligible means ready for a separate approval/activation step, not activated. */
  nextAction: "request_approval" | "revise_candidate";
};

export const DEFAULT_PROMOTION_POLICY: Readonly<PromotionPolicy> = {
  minCasesPerSlice: 8,
  minValidationSuccess: 0.7,
  minHoldoutSuccess: 0.65,
  minTrajectoryQuality: 0.6,
  minSkillQuality: 0.6,
  maxSuccessRegression: 0.03,
};

function isRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateSlice(name: string, slice: EvaluationSlice, minCases: number, reasons: string[]): void {
  if (!Number.isInteger(slice.cases) || slice.cases < minCases) {
    reasons.push(`${name}: insufficient independent cases (${slice.cases}; need ${minCases})`);
  }
  for (const key of ["successRate", "trajectoryQuality", "skillQuality"] as const) {
    if (!isRate(slice[key])) reasons.push(`${name}: ${key} must be a finite value in [0, 1]`);
  }
}

export function evaluateSkillPromotion(
  evidence: SkillCandidateEvidence,
  policy: PromotionPolicy = DEFAULT_PROMOTION_POLICY,
): PromotionDecision {
  const reasons: string[] = [];

  if (!evidence.candidateId.trim()) reasons.push("candidate ID is missing");
  if (!evidence.sourceSkillVersion.trim()) reasons.push("source skill version is missing");
  if (!evidence.artifactDigest.trim()) reasons.push("candidate artifact digest is missing");
  if (evidence.sourceTraceIds.length === 0) reasons.push("no real source traces are linked");
  if (new Set(evidence.sourceTraceIds).size !== evidence.sourceTraceIds.length) {
    reasons.push("source trace IDs contain duplicates");
  }
  if (!evidence.independentlyEvaluated) reasons.push("independent evaluation is required");
  if (!evidence.inputSanitized) reasons.push("candidate inputs have not passed sanitization");

  validateSlice("validation", evidence.validation, policy.minCasesPerSlice, reasons);
  validateSlice("holdout", evidence.holdout, policy.minCasesPerSlice, reasons);
  validateSlice("baseline", evidence.baseline, policy.minCasesPerSlice, reasons);

  if (isRate(evidence.validation.successRate) &&
      evidence.validation.successRate < policy.minValidationSuccess) {
    reasons.push("validation success rate is below threshold");
  }
  if (isRate(evidence.holdout.successRate) &&
      evidence.holdout.successRate < policy.minHoldoutSuccess) {
    reasons.push("holdout success rate is below threshold");
  }
  for (const sliceName of ["validation", "holdout"] as const) {
    const slice = evidence[sliceName];
    if (isRate(slice.trajectoryQuality) && slice.trajectoryQuality < policy.minTrajectoryQuality) {
      reasons.push(`${sliceName}: trajectory quality is below threshold`);
    }
    if (isRate(slice.skillQuality) && slice.skillQuality < policy.minSkillQuality) {
      reasons.push(`${sliceName}: skill quality is below threshold`);
    }
  }

  if (isRate(evidence.holdout.successRate) && isRate(evidence.baseline.successRate) &&
      evidence.holdout.successRate < evidence.baseline.successRate - policy.maxSuccessRegression) {
    reasons.push("holdout success regresses beyond the allowed budget");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    candidateId: evidence.candidateId,
    artifactDigest: evidence.artifactDigest,
    nextAction: reasons.length === 0 ? "request_approval" : "revise_candidate",
  };
}
