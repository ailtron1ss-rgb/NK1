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
  familyResults: Array<{ family: string; pairedN: number; gain: number | null; eligible: boolean }>;
}

const DEFAULTS: PromotionGateConfig = {
  minPairedTasks: 30,
  minFamilies: 3,
  minAbsoluteGain: 0.02,
  maxFamilyRegression: 0.05,
  requirePositiveConfidenceLowerBound: true,
};

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.normalize('NFKC').trim().length > 0;
const isUnit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const isGain = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1;
const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

type IntervalRead = { present: false } | { present: true; valid: false } |
  { present: true; valid: true; lower: number; upper: number };

function readInterval(value: unknown): IntervalRead {
  if (value === undefined || value === null) return { present: false };
  if (!Array.isArray(value) || value.length !== 2 ||
      !isGain(value[0]) || !isGain(value[1]) || value[0] > value[1]) {
    return { present: true, valid: false };
  }
  return { present: true, valid: true, lower: value[0], upper: value[1] };
}

function validateSummary(value: unknown, prefix: 'aggregate' | 'family'): string[] {
  const reasons: string[] = [];
  if (!isRecord(value)) return [`invalid-${prefix}-evidence`];

  if (!nonEmpty(value.baseline) || !nonEmpty(value.candidate) ||
      (typeof value.baseline === 'string' && typeof value.candidate === 'string' &&
       value.baseline.normalize('NFKC').trim() === value.candidate.normalize('NFKC').trim())) {
    reasons.push(`invalid-${prefix}-method-identity`);
  }
  if (!isCount(value.pairedN)) reasons.push(`invalid-${prefix}-paired-count`);
  if (!isUnit(value.baselinePassRate) || !isUnit(value.candidatePassRate)) {
    reasons.push(`invalid-${prefix}-pass-rate`);
  }
  if (!isGain(value.absoluteGain)) reasons.push(`invalid-${prefix}-gain`);
  if (!isCount(value.discordantCandidateWins) || !isCount(value.discordantBaselineWins)) {
    reasons.push(`invalid-${prefix}-discordant-counts`);
  } else if (isCount(value.pairedN) &&
      value.discordantCandidateWins + value.discordantBaselineWins > value.pairedN) {
    reasons.push(`invalid-${prefix}-discordant-counts`);
  }
  if (isUnit(value.baselinePassRate) && isUnit(value.candidatePassRate) && isGain(value.absoluteGain) &&
      Math.abs((value.candidatePassRate - value.baselinePassRate) - value.absoluteGain) > 1e-6) {
    reasons.push(`inconsistent-${prefix}-gain`);
  }

  const approximate = readInterval(value.approximate95CI);
  const bootstrap = readInterval(value.bootstrap95CI);
  if (approximate.present && !approximate.valid) reasons.push(`invalid-${prefix}-approximate-confidence-interval`);
  if (bootstrap.present && !bootstrap.valid) reasons.push(`invalid-${prefix}-bootstrap-confidence-interval`);
  return reasons;
}

/**
 * Conservative promotion gate for externally verified paired outcomes.
 *
 * This function never executes, trains, or promotes a candidate. It rejects
 * malformed/inconsistent evidence, requires agreement between reported gain
 * and pass rates, validates the paired win/loss counts, and prefers the
 * seed-clustered bootstrap interval when one is available. That interval is
 * more relevant when task cells share the same seed-level experimental unit.
 */
export function evaluateOutcomePromotion(
  aggregate: PairedMethodSummary,
  families: FamilyOutcomeSummary[],
  config: Partial<PromotionGateConfig> = {},
): PromotionGateResult {
  const cfg = { ...DEFAULTS, ...config };
  if (!Number.isSafeInteger(cfg.minPairedTasks) || cfg.minPairedTasks < 1 ||
      !Number.isSafeInteger(cfg.minFamilies) || cfg.minFamilies < 1 ||
      !Number.isFinite(cfg.minAbsoluteGain) || cfg.minAbsoluteGain < 0 || cfg.minAbsoluteGain > 1 ||
      !Number.isFinite(cfg.maxFamilyRegression) || cfg.maxFamilyRegression < 0 || cfg.maxFamilyRegression > 1 ||
      typeof cfg.requirePositiveConfidenceLowerBound !== 'boolean') {
    throw new Error('invalid promotion gate configuration');
  }

  const reasons: string[] = validateSummary(aggregate, 'aggregate');
  if (!Array.isArray(families)) reasons.push('invalid-family-list');
  const safeFamilies: unknown[] = Array.isArray(families) ? families : [];
  if (safeFamilies.length < cfg.minFamilies) reasons.push('insufficient-task-families');

  const aggregatePairedN = isRecord(aggregate) && isCount(aggregate.pairedN) ? aggregate.pairedN : 0;
  const aggregateGain = isRecord(aggregate) && isGain(aggregate.absoluteGain) ? aggregate.absoluteGain : null;
  if (aggregatePairedN < cfg.minPairedTasks) reasons.push('insufficient-paired-tasks');
  if (aggregatePairedN <= 0 || aggregateGain === null) {
    reasons.push('missing-aggregate-evidence');
  } else if (aggregateGain < cfg.minAbsoluteGain) {
    reasons.push('aggregate-gain-below-threshold');
  }

  // Prefer the cluster-bootstrap interval. Never fall back to a more optimistic
  // approximate interval when a bootstrap interval was supplied but is invalid
  // or its lower bound does not clear zero.
  const rawAggregate: RecordValue = isRecord(aggregate) ? aggregate : {};
  const bootstrap = readInterval(rawAggregate.bootstrap95CI);
  const interval = bootstrap.present ? bootstrap : readInterval(rawAggregate.approximate95CI);
  if (cfg.requirePositiveConfidenceLowerBound &&
      (!interval.present || !interval.valid || interval.lower <= 0)) {
    reasons.push('confidence-lower-bound-not-positive');
  }

  const seen = new Set<string>();
  const familyResults: PromotionGateResult['familyResults'] = safeFamilies.map((raw) => {
    if (!isRecord(raw)) {
      reasons.push('invalid-family-entry');
      return { family: '(invalid)', pairedN: 0, gain: null, eligible: false };
    }
    const name = nonEmpty(raw.family) ? raw.family.normalize('NFKC').trim() : '';
    const key = name.toLocaleLowerCase('en-US');
    if (!name || seen.has(key)) {
      throw new Error('family names must be non-empty and unique');
    }
    seen.add(key);

    reasons.push(...validateSummary(raw, 'family'));
    const n = isCount(raw.pairedN) ? raw.pairedN : 0;
    const gain = isGain(raw.absoluteGain) ? raw.absoluteGain : null;
    const valid = !validateSummary(raw, 'family').length;
    const eligible = valid && n > 0 && gain !== null && gain >= -cfg.maxFamilyRegression;
    if (n === 0) reasons.push(`missing-family-pairs:${name}`);
    if (gain !== null && gain < -cfg.maxFamilyRegression) reasons.push(`family-regression:${name}`);
    return { family: name, pairedN: n, gain, eligible };
  });

  const familyPairTotal = familyResults.reduce((sum, item) => sum + item.pairedN, 0);
  if (familyPairTotal !== aggregatePairedN) reasons.push('family-pair-count-mismatch');
  const finiteFamilyGains = familyResults.flatMap(item => item.gain === null ? [] : [item.gain]);
  const worstFamilyGain = finiteFamilyGains.length ? Math.min(...finiteFamilyGains) : null;

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    pairedTasks: aggregatePairedN,
    familyCount: safeFamilies.length,
    aggregateGain,
    worstFamilyGain,
    familyResults,
  };
}
