export type NegativeSpaceConditionOperator = 'gte' | 'lte';

export interface NegativeSpaceReopenCondition {
  signal: string;
  operator: NegativeSpaceConditionOperator;
  value: number;
}

export interface NegativeSpaceSignificance {
  cost01: number;
  risk01: number;
  futureImportance01: number;
  score01: number;
}

export interface NegativeSpaceAlternativeInput {
  action: string;
  expectedOutcome01: number;
  confidence01?: number;
  rejectionReason?: string;
  constraints?: string[];
  expectedConsequences?: string[];
  reopenWhen?: NegativeSpaceReopenCondition[];
}

export interface NegativeSpaceAlternative {
  action: string;
  expectedOutcome01: number;
  confidence01: number;
  rejectionReason: string;
  constraints: string[];
  expectedConsequences: string[];
  reopenWhen: NegativeSpaceReopenCondition[];
  reviewEligible: boolean;
  reopenedAt?: number;
  reopenReason?: string;
}

export type NegativeSpaceReviewStatus = 'awaiting-outcome' | 'retained' | 'review-eligible' | 'reopened';

export interface NegativeSpaceRecord {
  id: string;
  decisionId: string;
  at: number;
  chosen: string;
  chosenExpectedOutcome01: number;
  chosenActualOutcome01: number | null;
  outcomeAt: number | null;
  outcomePredictionError01: number | null;
  outcomeShortfall01: number | null;
  significance: NegativeSpaceSignificance;
  alternatives: NegativeSpaceAlternative[];
  outcomeEvidence: string[];
  reviewStatus: NegativeSpaceReviewStatus;
}

export interface NegativeSpaceMemoryState {
  version: 1;
  records: NegativeSpaceRecord[];
  totalRecorded: number;
  pruned: number;
  lastAt: number;
}

export interface NegativeSpaceDecisionInput {
  decisionId: string;
  at?: number;
  chosen: string;
  chosenExpectedOutcome01: number;
  significance: Omit<NegativeSpaceSignificance, 'score01'>;
  alternatives: NegativeSpaceAlternativeInput[];
}

export interface NegativeSpaceOutcomeInput {
  decisionId: string;
  actualOutcome01: number;
  at?: number;
  evidence?: string[];
  signals?: Record<string, number>;
}

const MAX_RECORDS = 128;
const MAX_ALTERNATIVES = 4;
const SIGNIFICANCE_THRESHOLD01 = 0.72;
const DEFAULT_REOPEN_CONDITION: NegativeSpaceReopenCondition = {
  signal: 'outcome.shortfall01',
  operator: 'gte',
  value: 0.2,
};

const clamp01 = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0;
};
const finite = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
const cleanText = (value: unknown, max = 240): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const cleanList = (value: unknown, limit: number, maxLength: number): string[] =>
  Array.isArray(value)
    ? value.map(item => cleanText(item, maxLength)).filter(Boolean).slice(0, limit)
    : [];

function normalizeCondition(value: unknown): NegativeSpaceReopenCondition | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const signal = cleanText(row.signal, 96);
  const operator = row.operator === 'lte' ? 'lte' : row.operator === 'gte' ? 'gte' : null;
  if (!signal || !operator || !Number.isFinite(Number(row.value))) return null;
  return { signal, operator, value: clamp01(row.value) };
}

function normalizeAlternative(input: NegativeSpaceAlternativeInput, chosen: string): NegativeSpaceAlternative | null {
  if (!input || typeof input !== 'object') return null;
  const action = cleanText(input?.action, 96);
  if (!action || action === chosen) return null;
  const suppliedConditions = Array.isArray(input.reopenWhen)
    ? input.reopenWhen.map(normalizeCondition).filter((row): row is NegativeSpaceReopenCondition => Boolean(row)).slice(0, 4)
    : [];
  return {
    action,
    expectedOutcome01: clamp01(input.expectedOutcome01),
    confidence01: clamp01(input.confidence01 ?? 0.5),
    rejectionReason: cleanText(input.rejectionReason) || 'ranked-below-selected-action',
    constraints: cleanList(input.constraints, 6, 120),
    expectedConsequences: cleanList(input.expectedConsequences, 8, 160),
    reopenWhen: suppliedConditions.length ? suppliedConditions : [{ ...DEFAULT_REOPEN_CONDITION }],
    reviewEligible: false,
  };
}

function conditionMatches(condition: NegativeSpaceReopenCondition, signals: Record<string, number>): boolean {
  const observed = signals[condition.signal];
  if (!Number.isFinite(observed)) return false;
  return condition.operator === 'gte' ? observed >= condition.value : observed <= condition.value;
}

export function defaultNegativeSpaceMemoryState(): NegativeSpaceMemoryState {
  return { version: 1, records: [], totalRecorded: 0, pruned: 0, lastAt: 0 };
}

/**
 * Bounded memory of consequential rejected options. It records review evidence;
 * it never chooses or executes an alternative on behalf of the canonical arbiter.
 */
export class NegativeSpaceMemory {
  private state = defaultNegativeSpaceMemoryState();

  recordDecision(input: NegativeSpaceDecisionInput): NegativeSpaceRecord | null {
    const decisionId = cleanText(input?.decisionId, 128);
    const chosen = cleanText(input?.chosen, 96);
    if (!decisionId || !chosen) return null;
    const existing = this.state.records.find(record => record.decisionId === decisionId);
    if (existing) return structuredClone(existing);

    const cost01 = clamp01(input.significance?.cost01);
    const risk01 = clamp01(input.significance?.risk01);
    const futureImportance01 = clamp01(input.significance?.futureImportance01);
    const score01 = Math.max(cost01, risk01, futureImportance01);
    if (score01 < SIGNIFICANCE_THRESHOLD01) return null;

    const alternatives: NegativeSpaceAlternative[] = [];
    const seen = new Set<string>();
    for (const raw of Array.isArray(input.alternatives) ? input.alternatives : []) {
      const normalized = normalizeAlternative(raw, chosen);
      if (!normalized || seen.has(normalized.action)) continue;
      seen.add(normalized.action);
      alternatives.push(normalized);
    }
    alternatives.sort((a, b) => b.expectedOutcome01 - a.expectedOutcome01 || b.confidence01 - a.confidence01);
    alternatives.length = Math.min(alternatives.length, MAX_ALTERNATIVES);
    if (!alternatives.length) return null;

    const at = finite(input.at, Date.now());
    const row: NegativeSpaceRecord = {
      id: decisionId,
      decisionId,
      at,
      chosen,
      chosenExpectedOutcome01: clamp01(input.chosenExpectedOutcome01),
      chosenActualOutcome01: null,
      outcomeAt: null,
      outcomePredictionError01: null,
      outcomeShortfall01: null,
      significance: { cost01, risk01, futureImportance01, score01 },
      alternatives,
      outcomeEvidence: [],
      reviewStatus: 'awaiting-outcome',
    };
    const records = [...this.state.records, row];
    const pruned = Math.max(0, records.length - MAX_RECORDS);
    this.state = {
      ...this.state,
      records: records.slice(-MAX_RECORDS),
      totalRecorded: this.state.totalRecorded + 1,
      pruned: this.state.pruned + pruned,
      lastAt: at,
    };
    return structuredClone(row);
  }

  recordOutcome(input: NegativeSpaceOutcomeInput): NegativeSpaceRecord | null {
    const decisionId = cleanText(input?.decisionId, 128);
    const record = this.state.records.find(candidate => candidate.decisionId === decisionId);
    if (!record) return null;
    if (record.chosenActualOutcome01 !== null) return structuredClone(record);

    const actualOutcome01 = clamp01(input.actualOutcome01);
    const at = finite(input.at, Date.now());
    const predictionError01 = Math.abs(record.chosenExpectedOutcome01 - actualOutcome01);
    const shortfall01 = Math.max(0, record.chosenExpectedOutcome01 - actualOutcome01);
    record.chosenActualOutcome01 = actualOutcome01;
    record.outcomeAt = at;
    record.outcomePredictionError01 = predictionError01;
    record.outcomeShortfall01 = shortfall01;
    record.outcomeEvidence = cleanList(input.evidence, 8, 180);

    this.evaluateReviewConditions(decisionId, {
      ...input.signals,
      'outcome.actual01': actualOutcome01,
      'outcome.expected01': record.chosenExpectedOutcome01,
      'outcome.predictionError01': predictionError01,
      'outcome.shortfall01': shortfall01,
    }, at);
    return structuredClone(record);
  }

  evaluateReviewConditions(decisionId: string, signals: Record<string, number>, at = Date.now()): string[] {
    const record = this.state.records.find(candidate => candidate.decisionId === decisionId);
    if (!record || record.chosenActualOutcome01 === null) return [];
    const eligible: string[] = [];
    for (const alternative of record.alternatives) {
      if (alternative.reopenedAt !== undefined) continue;
      const alternativeSignals = {
        ...signals,
        'outcome.alternativeAdvantage01': Math.max(0, alternative.expectedOutcome01 - record.chosenActualOutcome01),
      };
      alternative.reviewEligible = alternative.reopenWhen.some(condition => conditionMatches(condition, alternativeSignals));
      if (alternative.reviewEligible) eligible.push(alternative.action);
    }
    record.reviewStatus = record.alternatives.some(alternative => alternative.reviewEligible)
      ? 'review-eligible'
      : record.alternatives.some(alternative => alternative.reopenedAt !== undefined) ? 'reopened' : 'retained';
    this.state.lastAt = Math.max(this.state.lastAt, finite(at, Date.now()));
    return eligible;
  }

  /** Mark a human/agent-reviewed option as reopened; this is not an execution request. */
  markReopened(decisionId: string, action: string, reason: string, at = Date.now()): boolean {
    const record = this.state.records.find(candidate => candidate.decisionId === decisionId);
    const alternative = record?.alternatives.find(candidate => candidate.action === action);
    const normalizedReason = cleanText(reason);
    if (!record || !alternative || !alternative.reviewEligible || !normalizedReason) return false;
    alternative.reviewEligible = false;
    alternative.reopenedAt = finite(at, Date.now());
    alternative.reopenReason = normalizedReason;
    record.reviewStatus = record.alternatives.some(candidate => candidate.reviewEligible) ? 'review-eligible' : 'reopened';
    this.state.lastAt = Math.max(this.state.lastAt, alternative.reopenedAt);
    return true;
  }

  reviewQueue(): Array<{ decisionId: string; chosen: string; alternative: NegativeSpaceAlternative; outcomeShortfall01: number }> {
    return this.state.records.flatMap(record => record.alternatives
      .filter(alternative => alternative.reviewEligible)
      .map(alternative => ({
        decisionId: record.decisionId,
        chosen: record.chosen,
        alternative: structuredClone(alternative),
        outcomeShortfall01: record.outcomeShortfall01 ?? 0,
      })));
  }

  restore(snapshot?: Partial<NegativeSpaceMemoryState> | null): void {
    const input = (snapshot ?? {}) as Record<string, unknown>;
    const restored: NegativeSpaceRecord[] = [];
    const rawRecords = Array.isArray(input.records) ? input.records.slice(-MAX_RECORDS) : [];
    for (const rawValue of rawRecords) {
      if (!rawValue || typeof rawValue !== 'object') continue;
      const raw = rawValue as Record<string, any>;
      const decisionId = cleanText(raw.decisionId, 128);
      const chosen = cleanText(raw.chosen, 96);
      if (!decisionId || !chosen || !Array.isArray(raw.alternatives)) continue;
      const alternatives: NegativeSpaceAlternative[] = [];
      for (const sourceValue of raw.alternatives.slice(0, MAX_ALTERNATIVES)) {
        const source = sourceValue && typeof sourceValue === 'object' ? sourceValue as Record<string, any> : null;
        if (!source) continue;
        const normalized = normalizeAlternative(source as NegativeSpaceAlternativeInput, chosen);
        if (!normalized || alternatives.some(existing => existing.action === normalized.action)) continue;
        alternatives.push({
          ...normalized,
          reviewEligible: source.reviewEligible === true,
          ...(Number.isFinite(Number(source.reopenedAt)) ? { reopenedAt: finite(source.reopenedAt) } : {}),
          ...(cleanText(source.reopenReason) ? { reopenReason: cleanText(source.reopenReason) } : {}),
        });
      }
      const significance = raw.significance && typeof raw.significance === 'object' ? raw.significance : {};
      const actual = raw.chosenActualOutcome01 === null || raw.chosenActualOutcome01 === undefined
        ? null : clamp01(raw.chosenActualOutcome01);
      const status: NegativeSpaceReviewStatus = ['awaiting-outcome', 'retained', 'review-eligible', 'reopened'].includes(raw.reviewStatus)
        ? raw.reviewStatus : actual === null ? 'awaiting-outcome' : 'retained';
      restored.push({
        id: cleanText(raw.id, 128) || decisionId,
        decisionId,
        at: finite(raw.at),
        chosen,
        chosenExpectedOutcome01: clamp01(raw.chosenExpectedOutcome01),
        chosenActualOutcome01: actual,
        outcomeAt: raw.outcomeAt === null || raw.outcomeAt === undefined ? null : finite(raw.outcomeAt),
        outcomePredictionError01: raw.outcomePredictionError01 === null || raw.outcomePredictionError01 === undefined ? null : clamp01(raw.outcomePredictionError01),
        outcomeShortfall01: raw.outcomeShortfall01 === null || raw.outcomeShortfall01 === undefined ? null : clamp01(raw.outcomeShortfall01),
        significance: {
          cost01: clamp01(significance.cost01), risk01: clamp01(significance.risk01),
          futureImportance01: clamp01(significance.futureImportance01), score01: clamp01(significance.score01),
        },
        alternatives,
        outcomeEvidence: cleanList(raw.outcomeEvidence, 8, 180),
        reviewStatus: status,
      });
    }
    this.state = {
      version: 1,
      records: restored,
      totalRecorded: Math.max(restored.length, Math.floor(finite(input.totalRecorded, restored.length))),
      pruned: Math.max(0, Math.floor(finite(input.pruned))),
      lastAt: finite(input.lastAt),
    };
  }

  snapshot(): NegativeSpaceMemoryState {
    return structuredClone(this.state);
  }

  diagnostics() {
    const records = this.state.records;
    const alternatives = records.flatMap(record => record.alternatives);
    return {
      version: 1 as const,
      records: records.length,
      alternatives: alternatives.length,
      reviewEligible: alternatives.filter(alternative => alternative.reviewEligible).length,
      reopened: alternatives.filter(alternative => alternative.reopenedAt !== undefined).length,
      totalRecorded: this.state.totalRecorded,
      pruned: this.state.pruned,
      lastAt: this.state.lastAt,
      bounded: records.length <= MAX_RECORDS && records.every(record => record.alternatives.length <= MAX_ALTERNATIVES),
    };
  }
}
