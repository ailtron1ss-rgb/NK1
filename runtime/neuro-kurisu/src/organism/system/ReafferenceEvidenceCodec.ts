import type { ExternalObservationSourceClass, ExternalObservationAssessment, RealityClaimReconciliation } from './ExternalObserverFabric.ts';

export interface ReafferenceTemporalSignal {
  eligible: boolean;
  reason: 'ready' | 'missing-decision-link' | 'decision-not-pending' | 'non-external-source' | 'unknown-assessment' | 'insufficient-verification' | 'insufficient-independent-support' | 'insufficient-independent-contradiction';
  decisionId?: string;
  reward01?: number;
  verified01?: number;
  independent01?: number;
  autonomous01?: number;
  direction?: 'confirmed' | 'contradicted';
}

const EXTERNAL_SOURCES = new Set<ExternalObservationSourceClass>(['os', 'device', 'user', 'external-api', 'world']);
const clamp01 = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
};

/**
 * Translate an independently observed postcondition into the existing temporal
 * credit authority's signal. This codec owns no memory, policy or learning state.
 * Crucially, actionRef and decisionId are not interchangeable: the host must
 * supply an exact pending canonical decision ID instead of an inferred join.
 */
export function buildReafferenceTemporalSignal(input: {
  decisionId?: string | null;
  pendingDecisionIds: readonly string[];
  sourceClass: ExternalObservationSourceClass;
  independenceKey?: string;
  assessment: Pick<ExternalObservationAssessment, 'assessment' | 'verified' | 'confidence01'>;
  reconciliation: Pick<RealityClaimReconciliation, 'status' | 'support01' | 'contradiction01' | 'independentSupportSources' | 'independentContradictionSources' | 'recommendedConfidence01'>;
  autonomous?: boolean;
}): ReafferenceTemporalSignal {
  const decisionId = typeof input.decisionId === 'string' ? input.decisionId.trim() : '';
  if (!decisionId) return { eligible: false, reason: 'missing-decision-link' };
  if (!input.pendingDecisionIds.includes(decisionId)) return { eligible: false, reason: 'decision-not-pending' };
  if (!EXTERNAL_SOURCES.has(input.sourceClass) || !String(input.independenceKey ?? '').trim()) {
    return { eligible: false, reason: 'non-external-source' };
  }

  const confidence = clamp01(input.assessment.confidence01);
  if (input.assessment.assessment === 'match') {
    if (!input.assessment.verified || confidence < .72) return { eligible: false, reason: 'insufficient-verification' };
    const independentSources = Math.max(0, Math.floor(Number(input.reconciliation.independentSupportSources) || 0));
    if (independentSources < 1 || !['supported', 'corroborated'].includes(input.reconciliation.status)) {
      return { eligible: false, reason: 'insufficient-independent-support' };
    }
    return {
      eligible: true, reason: 'ready', decisionId, reward01: 1,
      verified01: clamp01(confidence * .75 + input.reconciliation.support01 * .25),
      independent01: Math.min(1, Math.max(.65, independentSources / 2)),
      autonomous01: input.autonomous === true ? 1 : 0,
      direction: 'confirmed',
    };
  }

  if (input.assessment.assessment === 'mismatch') {
    const independent = Math.max(0, Number(input.reconciliation.independentContradictionSources) || 0);
    if (input.reconciliation.status !== 'disputed' || independent < 2 || input.reconciliation.contradiction01 < .68) {
      return { eligible: false, reason: 'insufficient-independent-contradiction' };
    }
    const evidenceConfidence = clamp01(Math.max(input.reconciliation.contradiction01, input.reconciliation.recommendedConfidence01));
    return {
      eligible: true, reason: 'ready', decisionId, reward01: 0,
      verified01: evidenceConfidence,
      independent01: Math.min(1, independent / 2),
      autonomous01: input.autonomous === true ? 1 : 0,
      direction: 'contradicted',
    };
  }
  return { eligible: false, reason: 'unknown-assessment' };
}
