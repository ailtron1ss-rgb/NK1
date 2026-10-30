import type { PairedMethodSummary } from './VerifiedOutcomeLedger.ts';
import { evaluateOutcomePromotion, type FamilyOutcomeSummary, type PromotionGateConfig, type PromotionGateResult } from './VerifiedOutcomePromotionGate.ts';

export interface CandidatePromotionComparison {
  /** Content-addressed method identifier used by the preregistered plan. */
  method: string;
  aggregate: PairedMethodSummary;
  families: FamilyOutcomeSummary[];
}

export interface HolmAdjustedValue {
  id: string;
  rawPValue: number;
  adjustedPValue: number;
  rank: number;
}

export interface PortfolioPromotionResult {
  alpha: number;
  hypotheses: number;
  allEligible: boolean;
  eligibleMethods: string[];
  results: Array<{
    method: string;
    rawPValue: number | null;
    adjustedPValue: number | null;
    rank: number | null;
    eligible: boolean;
    reasons: string[];
    gate: PromotionGateResult;
  }>;
}

/**
 * Holm step-down family-wise error correction.
 * Controls the family-wise error rate under arbitrary dependence between
 * the declared candidate hypotheses; ties are deterministic by original id.
 */
export function holmAdjustPValues(values: Array<{ id: string; pValue: number }>): HolmAdjustedValue[] {
  if (!Array.isArray(values) || !values.length) throw new Error('p-value family must be non-empty');
  const seen = new Set<string>();
  const rows = values.map((value, index) => {
    if (!value || typeof value.id !== 'string' || !value.id.trim() || seen.has(value.id)) {
      throw new Error('hypothesis IDs must be non-empty and unique');
    }
    seen.add(value.id);
    if (typeof value.pValue !== 'number' || !Number.isFinite(value.pValue) ||
        value.pValue < 0 || value.pValue > 1) {
      throw new Error('p-values must be finite values in [0, 1]');
    }
    return { id: value.id, pValue: value.pValue, index };
  }).sort((a, b) => a.pValue - b.pValue || a.id.localeCompare(b.id));

  let monotoneAdjusted = 0;
  const adjusted = new Array<HolmAdjustedValue>(rows.length);
  rows.forEach((row, rankIndex) => {
    const multiplier = rows.length - rankIndex;
    monotoneAdjusted = Math.max(monotoneAdjusted, Math.min(1, row.pValue * multiplier));
    adjusted[row.index] = {
      id: row.id,
      rawPValue: row.pValue,
      adjustedPValue: monotoneAdjusted,
      rank: rankIndex + 1,
    };
  });
  return adjusted;
}

/**
 * Evaluate every preregistered candidate as one statistical family.
 * The input must contain the complete candidate set from the holdout campaign;
 * do not call this once per candidate after inspecting previous results.
 */
export function evaluateOutcomePromotionPortfolio(
  comparisons: CandidatePromotionComparison[],
  config: Partial<PromotionGateConfig> = {},
): PortfolioPromotionResult {
  if (!Array.isArray(comparisons) || !comparisons.length) {
    throw new Error('candidate comparison portfolio must be non-empty');
  }
  const methods = new Set<string>();
  let baseline: string | null = null;
  for (const comparison of comparisons) {
    if (!comparison || typeof comparison.method !== 'string' || !comparison.method.trim() ||
        methods.has(comparison.method)) {
      throw new Error('candidate methods must be non-empty and unique');
    }
    methods.add(comparison.method);
    if (!comparison.aggregate || comparison.aggregate.candidate !== comparison.method ||
        typeof comparison.aggregate.baseline !== 'string' || !comparison.aggregate.baseline.trim()) {
      throw new Error('candidate aggregate must match its method and declare a baseline');
    }
    if (baseline !== null && baseline !== comparison.aggregate.baseline) {
      throw new Error('all candidates in a portfolio must share the same baseline');
    }
    baseline = comparison.aggregate.baseline;
  }

  const alpha = config.familyWiseAlpha ?? 0.05;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error('familyWiseAlpha must be between zero and one');
  }
  const adjusted = holmAdjustPValues(comparisons.map(comparison => ({
    id: comparison.method,
    pValue: typeof comparison.aggregate.signTestPValue === 'number'
      ? comparison.aggregate.signTestPValue : Number.NaN,
  })));
  const byMethod = new Map(adjusted.map(value => [value.id, value]));
  const results = comparisons.map(comparison => {
    const correction = byMethod.get(comparison.method)!;
    const gate = evaluateOutcomePromotion(comparison.aggregate, comparison.families, config);
    const reasons = [...gate.reasons];
    if (correction.adjustedPValue > alpha) reasons.push('holm-adjusted-p-value-not-significant');
    const uniqueReasons = [...new Set(reasons)];
    return {
      method: comparison.method,
      rawPValue: correction.rawPValue,
      adjustedPValue: correction.adjustedPValue,
      rank: correction.rank,
      eligible: uniqueReasons.length === 0,
      reasons: uniqueReasons,
      gate,
    };
  });
  const eligibleMethods = results.filter(result => result.eligible).map(result => result.method);
  return {
    alpha,
    hypotheses: comparisons.length,
    allEligible: results.every(result => result.eligible),
    eligibleMethods,
    results,
  };
}
