export type AuroraDirective = 'act' | 'observe' | 'ask' | 'wait' | 'abstain';
export type AuroraEvidenceClass = 'observed' | 'mixed' | 'inferred' | 'unknown';

export interface AuroraPredictionInput {
  action: string;
  utility01: number;
  confidence01: number;
  uncertainty01: number;
}

export interface AuroraWorldSignal {
  revision: number;
  evidenceClass: AuroraEvidenceClass;
  evidenceConfidence01: number;
  uncertainty01: number;
  conflict01: number;
  unresolved01: number;
  modelDisagreement01: number;
  predictionError01: number;
}

export interface AuroraObservationCandidate {
  id: string;
  kind: 'observe' | 'ask';
  informationGain01: number;
  cost01: number;
  privacyRisk01?: number;
  latencyCost01?: number;
  interruptCost01?: number;
  available?: boolean;
}

export interface AuroraBudget {
  attention01?: number;
  energy01?: number;
  privacyTolerance01?: number;
  maxObservationCost01?: number;
  maxHorizon?: number;
}

export interface AuroraDecisionInput {
  prediction: AuroraPredictionInput;
  worldSignal: AuroraWorldSignal;
  budget?: AuroraBudget;
  observations?: AuroraObservationCandidate[];
}

export interface AuroraKernelState {
  version: 1;
  decisions: number;
  acted: number;
  observed: number;
  asked: number;
  waited: number;
  abstained: number;
  recentDirectives: AuroraDirective[];
  lastDirective: AuroraDirective;
  lastAt: number;
}

export interface AuroraDecision {
  version: 1;
  directive: AuroraDirective;
  reason: string;
  attentionFocus: string;
  worldRevision: number;
  epistemicPressure01: number;
  effectiveConfidence01: number;
  riskPenalty01: number;
  verificationBias01: number;
  adjustedUtility01: number;
  recommendedHorizon: number;
  observationValue01: number;
  selectedObservationId: string | null;
}

const DIRECTIVES = ['act', 'observe', 'ask', 'wait', 'abstain'] as const;
const MAX_RECENT_DIRECTIVES = 32;
const MAX_COUNTER = 1_000_000;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validUnit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const safeCounter = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(MAX_COUNTER, Math.floor(value))
    : 0;
const safeId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 120
    && /^[a-zA-Z0-9._:-]+$/.test(value);

const defaultState = (): AuroraKernelState => ({
  version: 1,
  decisions: 0,
  acted: 0,
  observed: 0,
  asked: 0,
  waited: 0,
  abstained: 0,
  recentDirectives: [],
  lastDirective: 'wait',
  lastAt: 0,
});

function validPrediction(value: unknown): value is AuroraPredictionInput {
  if (!isRecord(value)) return false;
  return typeof value.action === 'string' && value.action.length > 0 && value.action.length <= 64
    && validUnit(value.utility01) && validUnit(value.confidence01) && validUnit(value.uncertainty01);
}

function validWorldSignal(value: unknown): value is AuroraWorldSignal {
  if (!isRecord(value) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0) return false;
  if (!['observed', 'mixed', 'inferred', 'unknown'].includes(String(value.evidenceClass))) return false;
  return ['evidenceConfidence01', 'uncertainty01', 'conflict01', 'unresolved01', 'modelDisagreement01', 'predictionError01']
    .every(key => validUnit(value[key]));
}

function invalidDecision(): AuroraDecision {
  return {
    version: 1,
    directive: 'abstain',
    reason: 'invalid-prediction-or-world-signal',
    attentionFocus: 'integrity',
    worldRevision: 0,
    epistemicPressure01: 1,
    effectiveConfidence01: 0,
    riskPenalty01: 0.07,
    verificationBias01: 0,
    adjustedUtility01: 0,
    recommendedHorizon: 1,
    observationValue01: 0,
    selectedObservationId: null,
  };
}

/**
 * AURORA is a bounded executive kernel over NK1's existing neural/world models.
 * It owns decision telemetry only; the world, latent state, memory, predictors,
 * and action execution remain owned by their existing subsystems.
 */
export class AuroraPredictiveKernel {
  private state = defaultState();

  snapshot(): AuroraKernelState {
    return structuredClone(this.state);
  }

  restore(raw?: Partial<AuroraKernelState> | null): void {
    const recent = Array.isArray(raw?.recentDirectives)
      ? raw!.recentDirectives.filter((item): item is AuroraDirective =>
        typeof item === 'string' && (DIRECTIVES as readonly string[]).includes(item))
        .slice(-MAX_RECENT_DIRECTIVES)
      : [];
    const lastDirective = typeof raw?.lastDirective === 'string'
      && (DIRECTIVES as readonly string[]).includes(raw.lastDirective)
      ? raw.lastDirective as AuroraDirective
      : (recent.at(-1) ?? 'wait');
    this.state = {
      version: 1,
      decisions: safeCounter(raw?.decisions),
      acted: safeCounter(raw?.acted),
      observed: safeCounter(raw?.observed),
      asked: safeCounter(raw?.asked),
      waited: safeCounter(raw?.waited),
      abstained: safeCounter(raw?.abstained),
      recentDirectives: recent,
      lastDirective,
      lastAt: typeof raw?.lastAt === 'number' && Number.isFinite(raw.lastAt) && raw.lastAt >= 0
        ? raw.lastAt
        : 0,
    };
  }

  evaluate(input: AuroraDecisionInput): AuroraDecision {
    if (!validPrediction(input?.prediction) || !validWorldSignal(input?.worldSignal)) {
      return this.record(invalidDecision());
    }

    const prediction = input.prediction;
    const world = input.worldSignal;
    const budget = input.budget ?? {};
    const attention = clamp01(budget.attention01 ?? 0.5);
    const energy = clamp01(budget.energy01 ?? 0.5);
    const privacyTolerance = clamp01(budget.privacyTolerance01 ?? 0.25);
    const maxObservationCost = clamp01(budget.maxObservationCost01 ?? 0.65);

    const evidencePrior: Record<AuroraEvidenceClass, number> = {
      observed: 1,
      mixed: 0.82,
      inferred: 0.58,
      unknown: 0.28,
    };
    const groundedTrust = clamp01(evidencePrior[world.evidenceClass] * 0.4 + world.evidenceConfidence01 * 0.6);
    const pressure = clamp01(Math.max(
      world.uncertainty01,
      world.conflict01,
      world.unresolved01 * 0.9,
      world.modelDisagreement01 * 0.85,
      world.predictionError01 * 0.85,
      (1 - groundedTrust) * 0.7,
    ));
    const effectiveConfidence = clamp01(
      prediction.confidence01 * (0.72 + groundedTrust * 0.28) * (1 - pressure * 0.18),
    );
    const riskPenalty = Math.min(0.07, pressure * 0.055 + (1 - effectiveConfidence) * 0.01);
    const verificationBias = Math.min(0.05, pressure * 0.035 + world.modelDisagreement01 * 0.015);
    const adjustedUtility = clamp01(
      prediction.utility01 - riskPenalty + (prediction.action === 'verify' ? verificationBias : 0),
    );

    const attentionFocus = world.conflict01 >= 0.55
      ? 'world-conflict'
      : world.modelDisagreement01 >= 0.45 || world.predictionError01 >= 0.45
        ? 'prediction-reconciliation'
        : world.uncertainty01 >= 0.45 || world.unresolved01 >= 0.45
          ? 'epistemic-uncertainty'
          : 'grounded-prediction';

    const candidates = Array.isArray(input.observations) ? input.observations.slice(0, 24) : [];
    const ranked = candidates
      .filter(candidate => isRecord(candidate)
        && safeId(candidate.id)
        && (candidate.kind === 'observe' || candidate.kind === 'ask')
        && validUnit(candidate.informationGain01)
        && validUnit(candidate.cost01)
        && validUnit(candidate.privacyRisk01 ?? 0)
        && validUnit(candidate.latencyCost01 ?? 0)
        && validUnit(candidate.interruptCost01 ?? 0)
        && candidate.available !== false)
      .map(candidate => {
        const privacyRisk = clamp01(candidate.privacyRisk01 ?? 0);
        const latencyCost = clamp01(candidate.latencyCost01 ?? 0);
        const interruptCost = clamp01(candidate.interruptCost01 ?? 0);
        const value = clamp01(candidate.informationGain01 * (0.35 + 0.65 * pressure)
          - candidate.cost01 * 0.24
          - privacyRisk * 0.32
          - latencyCost * 0.15
          - interruptCost * 0.20);
        return { candidate, value };
      })
      .filter(({ candidate, value }) => candidate.cost01 <= maxObservationCost
        && candidate.cost01 <= attention * 0.9
        && candidate.cost01 <= energy * 1.2
        && clamp01(candidate.privacyRisk01 ?? 0) <= privacyTolerance
        && value >= 0.08)
      .sort((a, b) => b.value - a.value || a.candidate.id.localeCompare(b.candidate.id));

    const best = ranked[0];
    let directive: AuroraDirective;
    let reason: string;
    if (best && pressure >= 0.2) {
      directive = best.candidate.kind;
      reason = best.candidate.kind === 'ask' ? 'high-value-user-clarification' : 'high-value-additional-observation';
    } else if (attention < 0.22 || energy < 0.2) {
      directive = 'wait';
      reason = 'resource-budget-below-safe-observation-floor';
    } else if (pressure >= 0.65 || effectiveConfidence < 0.4) {
      directive = 'abstain';
      reason = 'epistemic-risk-exceeds-action-threshold';
    } else if (pressure >= 0.42 || effectiveConfidence < 0.55) {
      directive = 'abstain';
      reason = 'insufficient-grounding-for-proposed-action';
    } else {
      directive = 'act';
      reason = 'prediction-grounding-within-budget';
    }

    const maxHorizon = Number.isFinite(budget.maxHorizon)
      ? Math.max(1, Math.min(12, Math.floor(Number(budget.maxHorizon))))
      : 12;
    const recommendedHorizon = Math.max(1, Math.min(maxHorizon, Math.round(1 + (1 - pressure) * 11)));
    const decision: AuroraDecision = {
      version: 1,
      directive,
      reason,
      attentionFocus,
      worldRevision: world.revision,
      epistemicPressure01: pressure,
      effectiveConfidence01: effectiveConfidence,
      riskPenalty01: riskPenalty,
      verificationBias01: verificationBias,
      adjustedUtility01: adjustedUtility,
      recommendedHorizon,
      observationValue01: best?.value ?? 0,
      selectedObservationId: best?.candidate.id ?? null,
    };
    return this.record(decision);
  }

  private record(decision: AuroraDecision): AuroraDecision {
    this.state.decisions = Math.min(MAX_COUNTER, this.state.decisions + 1);
    const counterKey: Record<AuroraDirective, 'acted' | 'observed' | 'asked' | 'waited' | 'abstained'> = {
      act: 'acted', observe: 'observed', ask: 'asked', wait: 'waited', abstain: 'abstained',
    };
    const key = counterKey[decision.directive];
    this.state[key] = Math.min(MAX_COUNTER, this.state[key] + 1);
    this.state.lastDirective = decision.directive;
    this.state.recentDirectives = [...this.state.recentDirectives, decision.directive].slice(-MAX_RECENT_DIRECTIVES);
    this.state.lastAt = Date.now();
    return decision;
  }
}