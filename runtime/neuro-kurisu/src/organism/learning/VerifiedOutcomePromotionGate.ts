import type { PairedMethodSummary } from './VerifiedOutcomeLedger.ts';

export interface FamilyOutcomeSummary extends PairedMethodSummary {
  family: string;
}

export interface PromotionGateConfig {
  minPairedTasks: number;
  minFamilies: number;
  minAbsoluteGain: number;
  maxFamilyRegression: number;
  requirePositiveConfidenceLowerBound: boolean;
}

export interface PromotionGateResult {
  eligible: boolean;
  reasons: string[];
  pairedTasks: number;
  familyCount: number;
  aggregateGain: number | null;
  worstFamilyGain: number | null;
  familyResults: Array<{ family: string; pairedN: number; gain: number; eligible: boolean }>;
}

const DEFAULTS: PromotionGateConfig = {
  minPairedTasks: 30,
  minFamilies: 3,
  minAbsoluteGain: 0.02,
  maxFamilyRegression: 0.05,
  requirePositiveConfidenceLowerBound: true,
};

/**
 * Conservative evaluation gate for candidate learning/replay strategies.
 * It does not train or promote a strategy itself; it summarizes externally
 * verified paired outcomes and makes the criteria explicit and reproducible.
 */
export function evaluateOutcomePromotion(
  aggregate: PairedMethodSummary,
  families: FamilyOutcomeSummary[],
  config: Partial<PromotionGateConfig> = {},
): PromotionGateResult {
  const cfg = { ...DEFAULTS, ...config };
  if (!Number.isSafeInteger(cfg.minPairedTasks) || cfg.minPairedTasks < 1 ||
      !Number.isSafeInteger(cfg.minFamilies) || cfg.minFamilies < 1 ||
      !Number.isFinite(cfg.minAbsoluteGain) || cfg.minAbsoluteGain < 0 ||
      !Number.isFinite(cfg.maxFamilyRegression) || cfg.maxFamilyRegression < 0) {
    throw new Error('invalid promotion gate configuration');
  }
  const reasons: string[] = [];
  if (aggregate.pairedN < cfg.minPairedTasks) reasons.push('insufficient-paired-tasks');
  if (families.length < cfg.minFamilies) reasons.push('insufficient-task-families');
  if (aggregate.pairedN <= 0 || !Number.isFinite(aggregate.absoluteGain)) {
    reasons.push('missing-aggregate-evidence');
  } else if (aggregate.absoluteGain < cfg.minAbsoluteGain) {
    reasons.push('aggregate-gain-below-threshold');
  }
  const lower = aggregate.approximate95CI?.[0];
  if (cfg.requirePositiveConfidenceLowerBound &&
      (lower === undefined || !Number.isFinite(lower) || lower <= 0)) {
    reasons.push('confidence-lower-bound-not-positive');
  }
  const seen = new Set<string>();
  const familyResults = families.map((item) => {
    if (!item.family.trim() || seen.has(item.family)) throw new Error('family names must be non-empty and unique');
    seen.add(item.family);
    const valid = Number.isSafeInteger(item.pairedN) && item.pairedN >= 0 &&
      Number.isFinite(item.absoluteGain);
    const eligible = valid && item.pairedN > 0 && item.absoluteGain >= -cfg.maxFamilyRegression;
    if (!valid) reasons.push(`invalid-family-evidence:${item.family}`);
    else if (item.pairedN === 0) reasons.push(`missing-family-pairs:${item.family}`);
    else if (item.absoluteGain < -cfg.maxFamilyRegression) reasons.push(`family-regression:${item.family}`);
    return { family: item.family, pairedN: item.pairedN, gain: item.absoluteGain, eligible };
  });
  const familyPairTotal = familyResults.reduce((sum, item) => sum + (Number.isSafeInteger(item.pairedN) && item.pairedN > 0 ? item.pairedN : 0), 0);
  if (familyPairTotal !== aggregate.pairedN) reasons.push('family-pair-count-mismatch');
  const worstFamilyGain = familyResults.length
    ? Math.min(...familyResults.map((item) => item.gain))
    : null;
  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    pairedTasks: aggregate.pairedN,
    familyCount: families.length,
    aggregateGain: Number.isFinite(aggregate.absoluteGain) ? aggregate.absoluteGain : null,
    worstFamilyGain,
    familyResults,
  };
}
