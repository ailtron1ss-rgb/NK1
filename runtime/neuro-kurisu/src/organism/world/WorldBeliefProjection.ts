export interface WorldCognitiveSignalV1 {
  version: 1;
  revision: number;
  evidenceClass: 'observed' | 'mixed' | 'inferred' | 'unknown';
  evidenceConfidence01: number;
  uncertainty01: number;
  changeMagnitude01: number;
  conflict01: number;
  unresolved01: number;
  modelDisagreement01: number;
  predictionError01: number;
}
type EvidenceKind = 'observed' | 'model-output' | 'derived' | 'conflict' | 'unresolved';
type UnknownRecord = Record<string, unknown>;
interface WorldEntityEvidence {
  confidence01?: unknown; lastSeenAt?: unknown; observationCount?: unknown;
  sourceIds?: unknown; modalities?: unknown; modalityEvidenceKinds?: unknown;
  presenceStatus?: unknown; absenceEvidence01?: unknown;
}
interface GroundedWorldSnapshotLike {
  revision?: unknown; confidence01?: unknown; uncertainty01?: unknown; entities?: unknown; quarantinedFacts?: unknown;
}
interface WorldLearningStatsLike {
  observations?: unknown; modelAgreement01?: unknown;
  lastPassiveError01?: unknown; lastActionError01?: unknown;
}
const MODALITY_NAMES = new Set(['text', 'speech', 'audio', 'vision', 'sensor', 'world', 'semantic']);
const EVIDENCE_KINDS = new Set<EvidenceKind>(['observed', 'model-output', 'derived', 'conflict', 'unresolved']);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const unit = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : fallback;
const finite = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function evidenceFreshness(lastSeenAt: unknown, nowAt: number, tauMs: number): number {
  if (typeof lastSeenAt !== 'number' || !Number.isSafeInteger(lastSeenAt) || lastSeenAt < 0) return 0;
  if (lastSeenAt > nowAt + 5 * 60_000) return 0;
  return Math.exp(-Math.max(0, nowAt - lastSeenAt) / tauMs);
}
/** Read-only epistemic projection: freshness, provenance and evidence class stay separate. */
export function projectWorldCognitiveSignal(input: {
  snapshot: GroundedWorldSnapshotLike; learningStats?: WorldLearningStatsLike;
  latestModelError?: unknown; at: number; freshnessTauMs?: number;
}): WorldCognitiveSignalV1 {
  const nowAt = Number.isSafeInteger(input.at) && input.at >= 0 ? input.at : Date.now();
  const tauMs = Number.isFinite(input.freshnessTauMs) ? Math.max(1_000, Math.min(15 * 60_000, Number(input.freshnessTauMs))) : 60_000;
  const snapshot = isRecord(input.snapshot) ? input.snapshot : {};
  const entities = Array.isArray(snapshot.entities) ? snapshot.entities.slice(0, 128) as WorldEntityEvidence[] : [];
  // Historical facts restored from persistence have no live verifier capability.
  // They remain visible in quarantine and create bounded pressure to re-verify,
  // but can never contribute positive evidence weight or confidence.
  const quarantinedFacts = Array.isArray(snapshot.quarantinedFacts)
    ? [...new Set(snapshot.quarantinedFacts.slice(0, 192).filter((fact): fact is string =>
      typeof fact === 'string' && fact.trim().length > 0 && fact.length <= 512))]
    : [];
  const seenQuarantinedOutcomeIds = new Set<string>();
  const quarantinedOutcomeFreshWeight = Array.isArray(snapshot.quarantinedOutcomes)
    ? snapshot.quarantinedOutcomes.slice(0, 96).reduce((total, item) => {
        if (!isRecord(item) || typeof item.id !== 'string' || item.id.trim().length === 0
          || typeof item.label !== 'string' || !(item.label.startsWith('external-receipt:') || item.label.startsWith('restored-unverified:external-receipt:'))
          || seenQuarantinedOutcomeIds.has(item.id)) return total;
        seenQuarantinedOutcomeIds.add(item.id);
        // Diagnostic operational receipts create only short-lived pressure. Persisted
        // semantic facts remain in their own durable quarantine until re-attested.
        return total + evidenceFreshness(item.at, nowAt, tauMs);
      }, 0)
    : 0;
  const quarantinedEvidenceCount = quarantinedFacts.length + quarantinedOutcomeFreshWeight;
  const quarantinePressure01 = quarantinedEvidenceCount > 0
    ? Math.max(0, Math.min(0.45, 0.12 + 0.03 * Math.log2(quarantinedEvidenceCount)))
    : 0;
  let rawWeight = 0, freshWeight = 0, observedWeight = 0, inferredWeight = 0;
  let conflictWeight = 0, unresolvedWeight = 0, staleWeight = 0, fadingChange = 0;
  const independentSources = new Set<string>();
  for (const entity of entities) {
    if (!isRecord(entity)) continue;
    const confidence = unit(entity.confidence01, 0.35);
    const observationCount = typeof entity.observationCount === 'number' && Number.isSafeInteger(entity.observationCount) && entity.observationCount > 0
      ? Math.min(entity.observationCount, 10_000) : 1;
    const repeatSupport = 0.75 + 0.25 * Math.min(1, Math.log2(observationCount + 1) / 4);
    const baseWeight = confidence * repeatSupport;
    const freshness = evidenceFreshness(entity.lastSeenAt, nowAt, tauMs);
    const sourceIds = Array.isArray(entity.sourceIds) ? entity.sourceIds.filter((id): id is string =>
      typeof id === 'string' && id.trim().length > 0 && id.length <= 180 && !MODALITY_NAMES.has(id.trim().toLowerCase())) : [];
    for (const sourceId of sourceIds) independentSources.add(sourceId.trim());
    const kinds = isRecord(entity.modalityEvidenceKinds) ? Object.values(entity.modalityEvidenceKinds) : [];
    const evidenceKinds: EvidenceKind[] = kinds.filter((kind): kind is EvidenceKind =>
      typeof kind === 'string' && EVIDENCE_KINDS.has(kind as EvidenceKind));
    if (evidenceKinds.length === 0 && Array.isArray(entity.modalities) && entity.modalities.length > 0) evidenceKinds.push('unresolved');
    for (const rawKind of evidenceKinds) {
      const kind: EvidenceKind = rawKind === 'observed' && sourceIds.length === 0 ? 'unresolved' : rawKind;
      const weighted = baseWeight * freshness;
      rawWeight += baseWeight; freshWeight += weighted; staleWeight += baseWeight * (1 - freshness);
      if (kind === 'observed') observedWeight += weighted;
      else if (kind === 'model-output' || kind === 'derived') inferredWeight += weighted;
      else if (kind === 'conflict') conflictWeight += weighted;
      else unresolvedWeight += weighted;
    }
    if (entity.presenceStatus === 'fading') fadingChange = Math.max(fadingChange, unit(entity.absenceEvidence01) * 0.65 * freshness);
  }
  const totalFresh = observedWeight + inferredWeight + conflictWeight + unresolvedWeight;
  const freshnessCoverage = rawWeight > 0 ? clamp01(freshWeight / rawWeight) : 0;
  const conflict01 = totalFresh > 0 ? clamp01(conflictWeight / totalFresh) : 0;
  const unresolved01 = rawWeight > 0 ? clamp01(Math.max((unresolvedWeight + staleWeight * 0.75) / rawWeight, quarantinePressure01)) : 1;
  const observations = finite(input.learningStats?.observations);
  const modelAgreement = unit(input.learningStats?.modelAgreement01, 0.5);
  const modelDisagreement01 = observations > 0 ? clamp01(1 - modelAgreement) : 0;
  const lastPassiveError = unit(input.learningStats?.lastPassiveError01);
  const lastActionError = unit(input.learningStats?.lastActionError01);
  const latestModelError = unit(input.latestModelError);
  const predictionError01 = Math.max(latestModelError, lastPassiveError, lastActionError);
  const changeMagnitude01 = Math.max(predictionError01, fadingChange);
  const evidenceClass: WorldCognitiveSignalV1['evidenceClass'] =
    observedWeight > 0.05 && (inferredWeight > 0.05 || conflict01 > 0.05 || unresolved01 > 0.05) ? 'mixed'
      : observedWeight > 0.05 ? 'observed' : inferredWeight > 0.05 ? 'inferred' : 'unknown';
  const sourceFactor = 0.8 + 0.2 * Math.min(1, independentSources.size / 2);
  const evidenceQuality = totalFresh > 0 ? clamp01((observedWeight + inferredWeight * 0.45) / totalFresh) : 0;
  const evidenceConfidence01 = clamp01(unit(snapshot.confidence01) * freshnessCoverage * evidenceQuality * sourceFactor);
  const uncertainty01 = clamp01(Math.max(
    unit(snapshot.uncertainty01, 0.5),
    conflict01 * 0.65 + unresolved01 * 0.5 + modelDisagreement01 * 0.25,
    quarantinePressure01,
    freshnessCoverage < 0.1 ? 0.65 : 0,
  ));
  const revision = typeof snapshot.revision === 'number' && Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0 ? snapshot.revision : 0;
  return { version: 1, revision, evidenceClass, evidenceConfidence01, uncertainty01, changeMagnitude01, conflict01, unresolved01, modelDisagreement01, predictionError01 };
}
