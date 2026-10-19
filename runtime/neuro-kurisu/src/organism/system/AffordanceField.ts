import type { ActionKind, IntentCandidate, PredictedActionOutcome, DecisionAgencyEvidence } from '../core/types.ts';

const clamp01 = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
};

/**
 * WILL-inspired affordance/competition projection adapted to Neuro-Kurisu.
 * This module reads the candidate set already governed by OrganismCore; it does
 * not synthesize tools, execute actions, or replace the canonical policy owner.
 * Attention bounds the diagnostic field width, never the underlying selector.
 */
export function projectDecisionAgencyEvidence(input: {
  tick: number;
  candidates: readonly IntentCandidate[];
  selected: IntentCandidate | null | undefined;
  predictedOutcomes?: readonly PredictedActionOutcome[];
  attentionBudget01: number;
  requestedAction?: ActionKind | null;
}): DecisionAgencyEvidence {
  const candidates = input.candidates.filter((candidate) =>
    candidate && typeof candidate.id === 'string' && candidate.id.length > 0 &&
    typeof candidate.action === 'string' && Number.isFinite(Number(candidate.score))
  );
  const predictionByAction = new Map((input.predictedOutcomes ?? []).map((row) => [row.action, row]));
  const selectedId = input.selected?.id ?? null;
  const selectedAction = input.selected?.action ?? 'none';
  const attentionBudget01 = clamp01(input.attentionBudget01);
  const attentionWidth = Math.max(2, Math.min(12, 2 + Math.floor(attentionBudget01 * 8)));

  const ranked = candidates.map((candidate) => {
    const prediction = predictionByAction.get(candidate.action);
    return {
      candidateId: candidate.id,
      action: candidate.action,
      ...(candidate.goalId ? { goalId: candidate.goalId } : {}),
      score01: clamp01(candidate.score),
      predictedUtility01: clamp01(candidate.predictedUtility, .5),
      confidence01: clamp01(candidate.confidence, .5),
      estimatedCost01: clamp01(candidate.predictedCost),
      selected: candidate.id === selectedId,
      userRequested: candidate.action === (input.requestedAction ?? null),
      worldPredictionTicketPresent: Boolean(candidate.worldPredictionId),
      reasons: (prediction?.reasons ?? []).slice(0, 6).map((x) => String(x).slice(0, 120)),
      worldEvidence: (prediction?.worldEvidence ?? []).slice(0, 6).map((x) => String(x).slice(0, 160)),
    };
  }).sort((a, b) => b.score01 - a.score01 || a.candidateId.localeCompare(b.candidateId));

  // Always retain the selected candidate within the bounded field when it exists.
  const surfaced = ranked.slice(0, attentionWidth);
  const selectedRow = selectedId ? ranked.find((candidate) => candidate.candidateId === selectedId) : undefined;
  if (selectedRow && !surfaced.some((candidate) => candidate.candidateId === selectedId)) {
    surfaced[surfaced.length - 1] = selectedRow;
    surfaced.sort((a, b) => b.score01 - a.score01 || a.candidateId.localeCompare(b.candidateId));
  }
  const surfacedIds = new Set(surfaced.map((candidate) => candidate.candidateId));
  const alternatives = ranked.filter((candidate) => candidate.candidateId !== selectedId);
  const bestAlternative = alternatives[0];
  const selectedScore = selectedRow?.score01 ?? 0;
  const margin = bestAlternative ? selectedScore - bestAlternative.score01 : 1;
  const contest: DecisionAgencyEvidence['competition']['contest'] = !selectedRow
    ? 'selection-not-in-candidates'
    : !bestAlternative
      ? 'single-candidate'
      : margin < -0.0001
        ? 'selected-below-best-score'
        : margin < .04
          ? 'close-contest'
          : 'decisive';

  return {
    version: 1,
    tick: Math.max(0, Math.floor(Number(input.tick) || 0)),
    source: 'canonical-governed-candidates',
    selectionOwner: 'OrganismCore-canonical-arbiters',
    affectsSelection: false,
    attentionBudget01,
    attentionWidth,
    candidateCount: candidates.length,
    surfacedCandidateIds: surfaced.map((candidate) => candidate.candidateId),
    omittedCandidateIds: ranked.filter((candidate) => !surfacedIds.has(candidate.candidateId)).map((candidate) => candidate.candidateId),
    selectedAction,
    selectedCandidateId: selectedId,
    selectedBelongsToCandidates: Boolean(selectedRow),
    affordances: surfaced,
    competition: {
      contest,
      selectedScore01: selectedScore,
      bestAlternativeAction: bestAlternative?.action ?? null,
      bestAlternativeScore01: bestAlternative?.score01 ?? null,
      selectedVsBestAlternativeMargin: margin,
      rankedTop: ranked.slice(0, 4).map((candidate) => ({ candidateId: candidate.candidateId, action: candidate.action, score01: candidate.score01, selected: candidate.selected })),
    },
  };
}
