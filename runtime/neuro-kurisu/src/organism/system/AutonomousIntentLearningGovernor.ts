/**
 * NK1 AILG — Autonomous Intent & Learning Governor.
 *
 * A deterministic arbitration seam, not a claim of consciousness. It converts
 * evidence-backed candidate goals into bounded decisions and records outcomes
 * so the cognitive cycle can learn from observed consequences.
 */
export type AILGIntent = {
  id: string;
  goal: string;
  triggerEvidence: string[];
  expectedBenefit01: number;
  uncertainty01: number;
  cost01: number;
  risk01: number;
  externalSideEffect: boolean;
  requiresApproval?: boolean;
};

export type AILGDecision = {
  intentId: string;
  status: 'act' | 'defer' | 'reject' | 'approval-required';
  score01: number;
  reason: string;
  selectedAt: number;
};

export type AILGOutcome = {
  intentId: string;
  observedBenefit01: number;
  evidence: string;
  observedAt: number;
};

export type AILGPromotionEvidence = {
  baselineSuccess01: number;
  candidateSuccess01: number;
  maxRegression01: number;
  observedRegression01: number;
  independentHoldoutCases: number;
  minimumHoldoutCases?: number;
};

export type AILGSnapshot = {
  version: 1;
  decisions: AILGDecision[];
  outcomes: AILGOutcome[];
  executedIntentIds: string[];
  approvedIntentIds: string[];
};

const finite01 = (n: number): number => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
const nonBlank = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;
const hasControls = (s: string): boolean => Array.from(s).some(ch => { const p = ch.codePointAt(0) ?? 0; return p <= 0x1f || (p >= 0x7f && p <= 0x9f); });

const readDataRecord = (value: unknown): Record<string, unknown> | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!('value' in descriptor)) return null;
    result[key] = descriptor.value;
  }
  return result;
};

const readDataArray = (value: unknown): unknown[] | null => {
  if (!Array.isArray(value)) return null;
  const length = Object.getOwnPropertyDescriptor(value, 'length');
  if (!length || !('value' in length) || !Number.isSafeInteger(length.value) || length.value < 0 || length.value > 8192) return null;
  const result: unknown[] = [];
  for (let i = 0; i < length.value; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor) { result.push(undefined); continue; }
    if (!('value' in descriptor)) return null;
    result.push(descriptor.value);
  }
  return result;
};

export class AutonomousIntentLearningGovernor {
  private readonly decisions = new Map<string, AILGDecision>();
  private readonly outcomes = new Map<string, AILGOutcome>();
  private readonly executionReceipts = new Map<string, string>();
  private readonly approvalReceipts = new Map<string, string>();

  private readonly config: {
    minimumScore01?: number;
    maximumRisk01?: number;
    requireApprovalForExternalEffects?: boolean;
  };

  constructor(config: {
    minimumScore01?: number;
    maximumRisk01?: number;
    requireApprovalForExternalEffects?: boolean;
  } = {}) {
    const raw = readDataRecord(config) ?? {};
    const minimum = raw.minimumScore01;
    const maximum = raw.maximumRisk01;
    const requireApproval = raw.requireApprovalForExternalEffects;
    this.config = Object.freeze({
      minimumScore01: typeof minimum === 'number' && Number.isFinite(minimum) && minimum >= 0 && minimum <= 1 ? minimum : undefined,
      maximumRisk01: typeof maximum === 'number' && Number.isFinite(maximum) && maximum >= 0 && maximum <= 1 ? maximum : undefined,
      requireApprovalForExternalEffects: typeof requireApproval === 'boolean' ? requireApproval : true,
    });
  }

  propose(intent: AILGIntent, now = Date.now()): AILGDecision {
    if (!Number.isFinite(now) || now < 0) throw new RangeError('AILG decision time must be finite and non-negative');
    const raw = readDataRecord(intent);
    const evidence = raw ? readDataArray(raw.triggerEvidence) : null;
    const idValue = raw?.id;
    const goalValue = raw?.goal;
    const benefitValue = raw?.expectedBenefit01;
    const uncertaintyValue = raw?.uncertainty01;
    const costValue = raw?.cost01;
    const riskValue = raw?.risk01;
    const externalSideEffect = raw?.externalSideEffect;
    const requiresApproval = raw?.requiresApproval;
    if (!raw || !nonBlank(idValue) || idValue.length > 180 || hasControls(idValue) ||
        !nonBlank(goalValue) || goalValue.length > 500 || hasControls(goalValue) ||
        !evidence || evidence.length === 0 || evidence.length > 32 ||
        !evidence.every(e => nonBlank(e) && e.length <= 240 && !hasControls(e)) ||
        typeof externalSideEffect !== 'boolean' ||
        (requiresApproval !== undefined && typeof requiresApproval !== 'boolean') ||
        typeof benefitValue !== 'number' || typeof uncertaintyValue !== 'number' ||
        typeof costValue !== 'number' || typeof riskValue !== 'number') {
      throw new TypeError('AILG intent requires bounded plain-data identity, goal, evidence, and policy flags');
    }
    if (this.decisions.has(idValue)) {
      throw new Error(`duplicate-intent:${idValue}`);
    }
    for (const n of [benefitValue, uncertaintyValue, costValue, riskValue]) {
      if (!Number.isFinite(n) || n < 0 || n > 1) {
        throw new RangeError('AILG scores must be finite values in [0, 1]');
      }
    }
    const safeIntent: AILGIntent = {
      id: idValue,
      goal: goalValue,
      triggerEvidence: evidence as string[],
      expectedBenefit01: benefitValue,
      uncertainty01: uncertaintyValue,
      cost01: costValue,
      risk01: riskValue,
      externalSideEffect,
      ...(typeof requiresApproval === 'boolean' ? { requiresApproval } : {}),
    };

    // Benefit and information value compete with uncertainty, cost, and risk.
    // Keep this transparent and deterministic so downstream evaluation can audit it.
    const informationValue = safeIntent.uncertainty01 * 0.2;
    const score01 = finite01(
      safeIntent.expectedBenefit01 * 0.65 +
      informationValue -
      safeIntent.cost01 * 0.15 -
      safeIntent.risk01 * 0.4
    );
    const maximumRisk = this.config.maximumRisk01 ?? 0.35;
    const minimumScore = this.config.minimumScore01 ?? 0.35;
    let status: AILGDecision['status'] = 'act';
    let reason = 'evidence-backed-intent-cleared';
    if (safeIntent.risk01 > maximumRisk) {
      status = 'reject';
      reason = 'risk-limit-exceeded';
    } else if (safeIntent.externalSideEffect &&
      (safeIntent.requiresApproval || this.config.requireApprovalForExternalEffects !== false)) {
      status = 'approval-required';
      reason = 'external-side-effect-needs-approval';
    } else if (score01 < minimumScore) {
      status = 'defer';
      reason = 'expected-value-below-threshold';
    }

    const decision: AILGDecision = { intentId: safeIntent.id, status, score01, reason, selectedAt: now };
    this.decisions.set(intent.id, decision);
    return { ...decision };
  }

  /** Explicit approval transitions a gated proposal to an executable decision. */
  authorize(intentId: string, approvalReceipt: string): { accepted: boolean; reason: string } {
    const decision = this.decisions.get(intentId);
    if (!decision) return { accepted: false, reason: 'unknown-intent' };
    if (decision.status !== 'approval-required') return { accepted: false, reason: 'approval-not-required' };
    if (!nonBlank(approvalReceipt) || approvalReceipt.length > 512) return { accepted: false, reason: 'invalid-approval-receipt' };
    this.approvalReceipts.set(intentId, approvalReceipt);
    decision.status = 'act';
    decision.reason = 'explicit-approval-recorded';
    return { accepted: true, reason: 'authorized' };
  }

  /** Execution must be attested before an outcome can be attributed to the intent. */
  recordExecution(intentId: string, executionReceipt: string): { accepted: boolean; reason: string } {
    const decision = this.decisions.get(intentId);
    if (!decision) return { accepted: false, reason: 'unknown-intent' };
    if (decision.status !== 'act') return { accepted: false, reason: 'intent-not-authorized' };
    if (!nonBlank(executionReceipt) || executionReceipt.length > 512) return { accepted: false, reason: 'invalid-execution-receipt' };
    if (this.executionReceipts.has(intentId)) return { accepted: false, reason: 'duplicate-execution' };
    this.executionReceipts.set(intentId, executionReceipt);
    return { accepted: true, reason: 'execution-recorded' };
  }

  recordOutcome(outcome: AILGOutcome): { accepted: boolean; reason: string } {
    const raw = readDataRecord(outcome);
    if (!raw) return { accepted: false, reason: 'invalid-outcome' };
    const intentId = raw.intentId;
    const observedBenefit01 = raw.observedBenefit01;
    const evidence = raw.evidence;
    const observedAt = raw.observedAt;
    if (!nonBlank(intentId)) return { accepted: false, reason: 'invalid-outcome' };
    const decision = this.decisions.get(intentId);
    if (!decision) return { accepted: false, reason: 'unknown-intent' };
    if (decision.status !== 'act' || !this.executionReceipts.has(intentId)) return { accepted: false, reason: 'intent-not-executed' };
    if (this.outcomes.has(intentId)) return { accepted: false, reason: 'duplicate-outcome' };
    if (typeof observedBenefit01 !== 'number' || !Number.isFinite(observedBenefit01) ||
        observedBenefit01 < 0 || observedBenefit01 > 1 ||
        !nonBlank(evidence) || evidence.length > 1000 ||
        typeof observedAt !== 'number' || !Number.isFinite(observedAt) || observedAt < 0) {
      return { accepted: false, reason: 'invalid-outcome' };
    }
    this.outcomes.set(intentId, { intentId, observedBenefit01, evidence, observedAt });
    return { accepted: true, reason: 'outcome-recorded' };
  }

  /** Promotion is eligibility only; this method never activates candidate code. */
  evaluatePromotion(e: AILGPromotionEvidence): { eligible: boolean; reason: string; delta01: number } {
    const raw = readDataRecord(e);
    if (!raw) return { eligible: false, reason: 'invalid-evaluation-evidence', delta01: 0 };
    const baseline = raw.baselineSuccess01;
    const candidate = raw.candidateSuccess01;
    const maximumRegression = raw.maxRegression01;
    const observedRegression = raw.observedRegression01;
    const holdoutCases = raw.independentHoldoutCases;
    const configuredMinimum = raw.minimumHoldoutCases;
    const values = [baseline, candidate, maximumRegression, observedRegression];
    if (!values.every(n => typeof n === 'number' && Number.isFinite(n)) ||
        values.some(n => typeof n !== 'number' || (n as number) < 0 || (n as number) > 1) ||
        typeof holdoutCases !== 'number' || !Number.isSafeInteger(holdoutCases) || holdoutCases < 0 ||
        (configuredMinimum !== undefined &&
          (typeof configuredMinimum !== 'number' || !Number.isSafeInteger(configuredMinimum) || configuredMinimum < 1))) {
      return { eligible: false, reason: 'invalid-evaluation-evidence', delta01: 0 };
    }
    const delta01 = (candidate as number) - (baseline as number);
    const minimum = (configuredMinimum as number | undefined) ?? 4;
    if ((holdoutCases as number) < minimum) {
      return { eligible: false, reason: 'insufficient-independent-holdout', delta01 };
    }
    if ((observedRegression as number) > (maximumRegression as number)) {
      return { eligible: false, reason: 'regression-budget-exceeded', delta01 };
    }
    if (delta01 <= 0) {
      return { eligible: false, reason: 'no-measured-improvement', delta01 };
    }
    return { eligible: true, reason: 'eligible-for-separate-approval', delta01 };
  }

  snapshot(): AILGSnapshot & { outcomeCoverage01: number } {
    const executableCount = [...this.decisions.values()].filter(v => v.status === 'act').length;
    return {
      version: 1,
      decisions: [...this.decisions.values()].map(v => ({ ...v })),
      outcomes: [...this.outcomes.values()].map(v => ({ ...v })),
      executedIntentIds: [...this.executionReceipts.keys()],
      approvedIntentIds: [...this.approvalReceipts.keys()],
      outcomeCoverage01: executableCount ? Math.min(1, this.outcomes.size / executableCount) : 0,
    };
  }

  /**
   * Restore a bounded snapshot defensively. Receipt payloads are never restored;
   * only identity/presence is retained. Host authorization must still be enforced
   * by the ActionGateway before executing any real side effect.
   */
  restore(raw?: Partial<AILGSnapshot> | null): void {
    this.decisions.clear();
    this.outcomes.clear();
    this.executionReceipts.clear();
    this.approvalReceipts.clear();
    const snapshot = readDataRecord(raw);
    if (snapshot?.version !== 1) return;
    const decisionRows = readDataArray(snapshot.decisions);
    if (!decisionRows) return;

    const allowedStatuses = new Set<AILGDecision['status']>(['act', 'defer', 'reject', 'approval-required']);
    for (const item of decisionRows.slice(-2048)) {
      const value = readDataRecord(item);
      if (!value) continue;
      const intentId = value.intentId;
      const reason = value.reason;
      const status = value.status as AILGDecision['status'];
      const score01 = value.score01;
      const selectedAt = value.selectedAt;
      if (!nonBlank(intentId) || intentId.length > 180 ||
          !nonBlank(reason) || reason.length > 160 ||
          !allowedStatuses.has(status) ||
          typeof score01 !== 'number' || !Number.isFinite(score01) || score01 < 0 || score01 > 1 ||
          typeof selectedAt !== 'number' || !Number.isFinite(selectedAt) || selectedAt < 0 ||
          this.decisions.has(intentId)) continue;
      this.decisions.set(intentId, { intentId, status, score01, reason, selectedAt });
    }

    const validIds = new Set(this.decisions.keys());
    const approvedIds = readDataArray(snapshot.approvedIntentIds) ?? [];
    for (const item of approvedIds.slice(-2048)) {
      if (nonBlank(item) && validIds.has(item) && this.decisions.get(item)?.status === 'act') this.approvalReceipts.set(item, 'restored-approval-reference');
    }
    const executedIds = readDataArray(snapshot.executedIntentIds) ?? [];
    for (const item of executedIds.slice(-2048)) {
      if (nonBlank(item) && validIds.has(item) && this.decisions.get(item)?.status === 'act') this.executionReceipts.set(item, 'restored-execution-reference');
    }
    const outcomeRows = readDataArray(snapshot.outcomes) ?? [];
    for (const item of outcomeRows.slice(-2048)) {
      const value = readDataRecord(item);
      if (!value) continue;
      const intentId = value.intentId;
      const evidence = value.evidence;
      const observedBenefit01 = value.observedBenefit01;
      const observedAt = value.observedAt;
      if (!nonBlank(intentId) || !validIds.has(intentId) || !this.executionReceipts.has(intentId) ||
          this.outcomes.has(intentId) || !nonBlank(evidence) || evidence.length > 1000 ||
          typeof observedBenefit01 !== 'number' || !Number.isFinite(observedBenefit01) || observedBenefit01 < 0 || observedBenefit01 > 1 ||
          typeof observedAt !== 'number' || !Number.isFinite(observedAt) || observedAt < 0) continue;
      this.outcomes.set(intentId, { intentId, observedBenefit01, evidence, observedAt });
    }
  }
}
