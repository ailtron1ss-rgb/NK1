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
    this.config = config;
  }

  propose(intent: AILGIntent, now = Date.now()): AILGDecision {
    if (!Number.isFinite(now) || now < 0) throw new RangeError('AILG decision time must be finite and non-negative');
    if (!nonBlank(intent.id) || intent.id.length > 180 ||
        !nonBlank(intent.goal) || intent.goal.length > 500 ||
        !Array.isArray(intent.triggerEvidence) ||
        intent.triggerEvidence.length === 0 || intent.triggerEvidence.length > 32 ||
        !intent.triggerEvidence.every(e => nonBlank(e) && e.length <= 240) ||
        typeof intent.externalSideEffect !== 'boolean' ||
        (intent.requiresApproval !== undefined && typeof intent.requiresApproval !== 'boolean')) {
      throw new TypeError('AILG intent requires bounded identity, goal, evidence, and boolean policy flags');
    }
    if (this.decisions.has(intent.id)) {
      throw new Error(`duplicate-intent:${intent.id}`);
    }
    for (const n of [intent.expectedBenefit01, intent.uncertainty01, intent.cost01, intent.risk01]) {
      if (!Number.isFinite(n) || n < 0 || n > 1) {
        throw new RangeError('AILG scores must be finite values in [0, 1]');
      }
    }

    // Benefit and information value compete with uncertainty, cost, and risk.
    // Keep this transparent and deterministic so downstream evaluation can audit it.
    const informationValue = intent.uncertainty01 * 0.2;
    const score01 = finite01(
      intent.expectedBenefit01 * 0.65 +
      informationValue -
      intent.cost01 * 0.15 -
      intent.risk01 * 0.4
    );
    const maximumRisk = this.config.maximumRisk01 ?? 0.35;
    const minimumScore = this.config.minimumScore01 ?? 0.35;
    let status: AILGDecision['status'] = 'act';
    let reason = 'evidence-backed-intent-cleared';
    if (intent.risk01 > maximumRisk) {
      status = 'reject';
      reason = 'risk-limit-exceeded';
    } else if (intent.externalSideEffect &&
      (intent.requiresApproval || this.config.requireApprovalForExternalEffects !== false)) {
      status = 'approval-required';
      reason = 'external-side-effect-needs-approval';
    } else if (score01 < minimumScore) {
      status = 'defer';
      reason = 'expected-value-below-threshold';
    }

    const decision: AILGDecision = { intentId: intent.id, status, score01, reason, selectedAt: now };
    this.decisions.set(intent.id, decision);
    return { ...decision };
  }

  /** Explicit approval transitions a gated proposal to an executable decision. */
  authorize(intentId: string, approvalReceipt: string): { accepted: boolean; reason: string } {
    const decision = this.decisions.get(intentId);
    if (!decision) return { accepted: false, reason: 'unknown-intent' };
    if (decision.status !== 'approval-required') return { accepted: false, reason: 'approval-not-required' };
    if (!nonBlank(approvalReceipt)) return { accepted: false, reason: 'invalid-approval-receipt' };
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
    if (!nonBlank(executionReceipt)) return { accepted: false, reason: 'invalid-execution-receipt' };
    if (this.executionReceipts.has(intentId)) return { accepted: false, reason: 'duplicate-execution' };
    this.executionReceipts.set(intentId, executionReceipt);
    return { accepted: true, reason: 'execution-recorded' };
  }

  recordOutcome(outcome: AILGOutcome): { accepted: boolean; reason: string } {
    const decision = this.decisions.get(outcome.intentId);
    if (!decision) return { accepted: false, reason: 'unknown-intent' };
    if (decision.status !== 'act' || !this.executionReceipts.has(outcome.intentId)) return { accepted: false, reason: 'intent-not-executed' };
    if (this.outcomes.has(outcome.intentId)) return { accepted: false, reason: 'duplicate-outcome' };
    if (!Number.isFinite(outcome.observedBenefit01) ||
        outcome.observedBenefit01 < 0 || outcome.observedBenefit01 > 1 ||
        !nonBlank(outcome.evidence) ||
        !Number.isFinite(outcome.observedAt)) {
      return { accepted: false, reason: 'invalid-outcome' };
    }
    this.outcomes.set(outcome.intentId, { ...outcome });
    return { accepted: true, reason: 'outcome-recorded' };
  }

  /** Promotion is eligibility only; this method never activates candidate code. */
  evaluatePromotion(e: AILGPromotionEvidence): { eligible: boolean; reason: string; delta01: number } {
    const values = [e.baselineSuccess01, e.candidateSuccess01, e.maxRegression01, e.observedRegression01];
    if (!values.every(Number.isFinite) ||
        values.some(n => n < 0 || n > 1) ||
        !Number.isSafeInteger(e.independentHoldoutCases) || e.independentHoldoutCases < 0 ||
        (e.minimumHoldoutCases !== undefined &&
          (!Number.isSafeInteger(e.minimumHoldoutCases) || e.minimumHoldoutCases < 1))) {
      return { eligible: false, reason: 'invalid-evaluation-evidence', delta01: 0 };
    }
    const delta01 = e.candidateSuccess01 - e.baselineSuccess01;
    const minimum = e.minimumHoldoutCases ?? 4;
    if (e.independentHoldoutCases < minimum) {
      return { eligible: false, reason: 'insufficient-independent-holdout', delta01 };
    }
    if (e.observedRegression01 > e.maxRegression01) {
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
    if (raw?.version !== 1 || !Array.isArray(raw.decisions)) return;

    const allowedStatuses = new Set<AILGDecision['status']>(['act', 'defer', 'reject', 'approval-required']);
    for (const value of raw.decisions.slice(-2048)) {
      if (!value || !nonBlank(value.intentId) || value.intentId.length > 180 ||
          !nonBlank(value.reason) || value.reason.length > 160 ||
          !allowedStatuses.has(value.status) ||
          !Number.isFinite(value.score01) || value.score01 < 0 || value.score01 > 1 ||
          !Number.isFinite(value.selectedAt) || value.selectedAt < 0 ||
          this.decisions.has(value.intentId)) continue;
      this.decisions.set(value.intentId, {
        intentId: value.intentId,
        status: value.status,
        score01: value.score01,
        reason: value.reason,
        selectedAt: value.selectedAt,
      });
    }

    const validIds = new Set(this.decisions.keys());
    if (Array.isArray(raw.approvedIntentIds)) {
      for (const id of raw.approvedIntentIds.slice(-2048)) {
        const decision = validIds.has(id) ? this.decisions.get(id) : undefined;
        if (decision?.status === 'act' && nonBlank(id)) this.approvalReceipts.set(id, 'restored-approval-reference');
      }
    }
    if (Array.isArray(raw.executedIntentIds)) {
      for (const id of raw.executedIntentIds.slice(-2048)) {
        const decision = validIds.has(id) ? this.decisions.get(id) : undefined;
        if (decision?.status === 'act' && nonBlank(id)) this.executionReceipts.set(id, 'restored-execution-reference');
      }
    }
    if (Array.isArray(raw.outcomes)) {
      for (const value of raw.outcomes.slice(-2048)) {
        if (!value || !validIds.has(value.intentId) ||
            !this.executionReceipts.has(value.intentId) ||
            this.outcomes.has(value.intentId) ||
            !nonBlank(value.evidence) || value.evidence.length > 1000 ||
            !Number.isFinite(value.observedBenefit01) || value.observedBenefit01 < 0 || value.observedBenefit01 > 1 ||
            !Number.isFinite(value.observedAt) || value.observedAt < 0) continue;
        this.outcomes.set(value.intentId, { ...value });
      }
    }
  }
}
