/** 
 * Applies a reviewed Hexis evidence proposal to NK1's canonical MemoryOS2 record.
 *
 * This is deliberately not an automatic belief updater: it records source lineage
 * and the latest evidence polarity for audit, but never applies Hexis confidence
 * deltas or silently changes epistemic status. The caller remains responsible for
 * deciding whether the proposal is independently reviewed.
 */
import { MemoryOS2, type MemoryItem2 } from '../developmental/MemoryOS2.ts';
import { adaptHexisEvidence, type HexisEvidenceRecord } from './HexisEvidenceBridge.ts';

export type HexisEvidenceApplyResult =
  | { status: 'missing-target'; targetMemoryId: string }
  | { status: 'duplicate'; targetMemoryId: string; evidenceId: string }
  | { status: 'review-required'; targetMemoryId: string; evidenceId: string; stance: HexisEvidenceRecord['stance'] }
  | { status: 'recorded'; targetMemoryId: string; evidenceId: string; stance: HexisEvidenceRecord['stance']; independentLineage: string };

export interface HexisEvidenceApplyOptions {
  /** Must be true only after the caller's independent review has completed. */
  reviewed: boolean;
}

/**
 * Persist evidence through MemoryOS2's existing evidence-source merge/dedup path.
 * A missing review approval is a non-mutating result. Exact replays and different
 * event IDs from an already-seen independent source are both idempotent duplicates.
 */
export function applyReviewedHexisEvidence(
  memory: Pick<MemoryOS2, 'get' | 'updateSignals' | 'updateContext'>,
  targetMemoryId: string,
  record: HexisEvidenceRecord,
  options: HexisEvidenceApplyOptions,
): HexisEvidenceApplyResult {
  const proposal = adaptHexisEvidence(record);
  const target = memory.get(targetMemoryId) as MemoryItem2 | null;
  if (!target) return { status: 'missing-target', targetMemoryId };

  if (!options.reviewed) {
    return { status: 'review-required', targetMemoryId, evidenceId: proposal.evidenceId, stance: proposal.stance };
  }

  const lineage = `lineage:${proposal.source.independenceKey!.normalize('NFKC').toLowerCase()}`;
  // MemoryOS2's canonical replay guard is lineage-based, not just event-ID-based.
  // Different event IDs or source wrappers must not turn one upstream origin into
  // multiple corroborating sources. Check both the durable compact guard and the
  // visible trail because older snapshots may predate evidenceLineageKeys.
  const priorLineageSeen =
    (target.evidenceLineageKeys ?? []).includes(lineage) ||
    (target.evidenceSources ?? []).some(source =>
      typeof source.independenceKey === 'string' &&
      `lineage:${source.independenceKey.trim().normalize('NFKC').toLowerCase()}` === lineage
    );
  if (priorLineageSeen) {
    return { status: 'duplicate', targetMemoryId, evidenceId: proposal.evidenceId };
  }

  // Exact suffix matching avoids treating "...#event-1" as a replay of "...#event-10".
  const evidenceMarker = `#${proposal.evidenceId}`;
  if ((target.evidenceSources ?? []).some(source => String(source.source).endsWith(evidenceMarker))) {
    return { status: 'duplicate', targetMemoryId, evidenceId: proposal.evidenceId };
  }

  const priorSources = target.evidenceSources ?? [];
  const merged = memory.updateSignals(targetMemoryId, {
    evidenceSources: [...priorSources, proposal.source],
  }, 'hexis-evidence-reviewed');
  if (!merged) return { status: 'missing-target', targetMemoryId };

  // Context is bounded metadata, not a second evidence store. Full source lineage
  // remains governed by MemoryOS2's capped evidenceSources/evidenceLineageKeys.
  memory.updateContext(targetMemoryId, {
    hexisLastEvidenceId: proposal.evidenceId.slice(0, 120),
    hexisLastEvidenceHash: proposal.contentHash.slice(0, 120),
    hexisLastEvidenceStance: proposal.stance,
    hexisLastEvidenceSource: proposal.source.source.slice(0, 180),
    hexisLastEvidenceAt: String(proposal.source.observedAt),
  });

  return {
    status: 'recorded',
    targetMemoryId,
    evidenceId: proposal.evidenceId,
    stance: proposal.stance,
    independentLineage: lineage,
  };
}
