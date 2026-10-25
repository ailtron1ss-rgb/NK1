import type { InternalDialogueReviewReceipt } from '../language/LanguageOrgan.ts';

export type InternalDialogueUncertaintyCategory =
  | 'conflicting-evidence'
  | 'action-outcome'
  | 'missing-evidence'
  | 'low-confidence'
  | 'stale-context'
  | 'other';

export interface InternalDialogueHistorySummary {
  schemaVersion: 1;
  sampleCount: number;
  windowSize: number;
  firstTick: number | null;
  lastTick: number | null;
  statusCounts: { reviewed: number; provisional: number; 'needs-evidence': number };
  meanRankingConfidence01: number | null;
  meanEvidenceCoverage01: number | null;
  meanUncertainty01: number | null;
  meanContradiction01: number | null;
  rankingConfidenceDelta01: number | null;
  evidenceCoverageDelta01: number | null;
  rankingConfidenceTrend: 'up' | 'down' | 'flat' | 'insufficient-data';
  evidenceCoverageTrend: 'up' | 'down' | 'flat' | 'insufficient-data';
  uncertaintyCategoryCounts: Array<{ category: InternalDialogueUncertaintyCategory; count: number }>;
  advisoryOnly: true;
}

const MAX_HISTORY = 32;
const CATEGORY_ORDER: InternalDialogueUncertaintyCategory[] = [
  'conflicting-evidence', 'action-outcome', 'missing-evidence', 'low-confidence', 'stale-context', 'other',
];
const STATUSES = new Set(['reviewed', 'provisional', 'needs-evidence']);

const isFinite01 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

function isReceipt(value: unknown): value is InternalDialogueReviewReceipt {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = value as Partial<InternalDialogueReviewReceipt>;
  return receipt.schemaVersion === 1 &&
    receipt.advisoryOnly === true &&
    Number.isSafeInteger(receipt.tick) && Number(receipt.tick) >= 0 &&
    STATUSES.has(String(receipt.status)) &&
    isFinite01(receipt.rankingConfidence01) &&
    isFinite01(receipt.evidenceCoverage01) &&
    isFinite01(receipt.uncertainty01) &&
    isFinite01(receipt.contradiction01) &&
    Array.isArray(receipt.unresolvedQuestions);
}

function categoryForQuestion(question: string): InternalDialogueUncertaintyCategory {
  const text = question.toLowerCase().slice(0, 180);
  if (/(conflict|contradict|inconsisten|разногла|противореч|несоглас)/u.test(text)) return 'conflicting-evidence';
  if (/(outcome|action|execution|result|исход|действ|выполнен|результат)/u.test(text)) return 'action-outcome';
  if (/(evidence|support|source|proof|доказ|источник|подтверж|наблюден)/u.test(text)) return 'missing-evidence';
  if (/(confidence|uncertain|uncertainty|уверен|неопредел|сомнен)/u.test(text)) return 'low-confidence';
  if (/(stale|outdated|freshness|timestamp|устар|свежест|временн)/u.test(text)) return 'stale-context';
  return 'other';
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function deltaTrend(delta: number | null): 'up' | 'down' | 'flat' | 'insufficient-data' {
  if (delta === null) return 'insufficient-data';
  if (delta > 0.04) return 'up';
  if (delta < -0.04) return 'down';
  return 'flat';
}

/**
 * Produces a bounded, privacy-preserving trend summary. It retains only numeric
 * aggregates and a fixed uncertainty taxonomy; question text is never returned.
 * Inputs must already pass the runtime's stricter receipt restoration validator.
 */
export function summarizeInternalDialogueHistory(
  input: readonly InternalDialogueReviewReceipt[],
  limit = MAX_HISTORY,
): InternalDialogueHistorySummary {
  const windowLimit = Math.max(1, Math.min(MAX_HISTORY, Math.floor(Number(limit) || MAX_HISTORY)));
  const receipts = (Array.isArray(input) ? input as readonly unknown[] : [])
    .filter(isReceipt)
    .slice(-windowLimit);
  const confidences = receipts.map(receipt => receipt.rankingConfidence01);
  const coverages = receipts.map(receipt => receipt.evidenceCoverage01);
  const uncertainties = receipts.map(receipt => receipt.uncertainty01);
  const contradictions = receipts.map(receipt => receipt.contradiction01);
  const statusCounts = { reviewed: 0, provisional: 0, 'needs-evidence': 0 };
  const categoryCounts = new Map<InternalDialogueUncertaintyCategory, number>();

  for (const receipt of receipts) {
    statusCounts[receipt.status] += 1;
    for (const question of receipt.unresolvedQuestions.slice(0, 10)) {
      if (typeof question !== 'string' || !question.trim()) continue;
      const category = categoryForQuestion(question);
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  const halfSize = Math.floor(receipts.length / 2);
  const hasComparableHalves = receipts.length >= 4 && halfSize >= 2;
  const earlier = hasComparableHalves ? receipts.slice(0, halfSize) : [];
  const later = hasComparableHalves ? receipts.slice(receipts.length - halfSize) : [];
  const confidenceDelta = hasComparableHalves
    ? Number(((mean(later.map(receipt => receipt.rankingConfidence01)) ?? 0) -
      (mean(earlier.map(receipt => receipt.rankingConfidence01)) ?? 0)).toFixed(3))
    : null;
  const coverageDelta = hasComparableHalves
    ? Number(((mean(later.map(receipt => receipt.evidenceCoverage01)) ?? 0) -
      (mean(earlier.map(receipt => receipt.evidenceCoverage01)) ?? 0)).toFixed(3))
    : null;

  const uncertaintyCategoryCounts = CATEGORY_ORDER
    .map(category => ({ category, count: categoryCounts.get(category) ?? 0 }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count || CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    .slice(0, 6);

  return {
    schemaVersion: 1,
    sampleCount: receipts.length,
    windowSize: windowLimit,
    firstTick: receipts.length ? receipts[0].tick : null,
    lastTick: receipts.length ? receipts[receipts.length - 1].tick : null,
    statusCounts,
    meanRankingConfidence01: mean(confidences),
    meanEvidenceCoverage01: mean(coverages),
    meanUncertainty01: mean(uncertainties),
    meanContradiction01: mean(contradictions),
    rankingConfidenceDelta01: confidenceDelta,
    evidenceCoverageDelta01: coverageDelta,
    rankingConfidenceTrend: deltaTrend(confidenceDelta),
    evidenceCoverageTrend: deltaTrend(coverageDelta),
    uncertaintyCategoryCounts,
    advisoryOnly: true,
  };
}
