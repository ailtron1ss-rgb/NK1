/**
 * Hexis-inspired evidence bridge for NK1.
 *
 * Adapted contract only: this does not import Hexis, add a second memory store,
 * or trust Hexis confidence values as NK1 truth. MemoryOS2 remains the sole
 * writable memory owner. A proposal must be reviewed by the caller and then
 * recorded through the existing MemoryOS2 lifecycle.
 */
import type { MemoryEvidenceSource, MemoryProvenanceClass } from '../developmental/MemoryOS2.ts';

export type HexisEvidenceStance = 'supports' | 'refutes' | 'neutral';
export type HexisEvidenceKind =
  | 'user_testimony'
  | 'repository_document'
  | 'tool_receipt'
  | 'environment_observation'
  | 'agent_inference'
  | 'unknown';

export interface HexisEvidenceRecord {
  /** Stable upstream memory/belief identifier; retained as lineage, not NK1 ID. */
  beliefId: string;
  evidenceId: string;
  contentHash: string;
  sourceRef: string;
  sourceKind: HexisEvidenceKind;
  stance: HexisEvidenceStance;
  observedAt: number;
  /** Independent source grouping prevents duplicated copies counting as corroboration. */
  independenceKey: string;
  authority01: number;
  /** Optional upstream values are for audit only; never copied into NK1 confidence. */
  confidenceBefore?: number;
  confidenceAfter?: number;
}

export interface HexisEvidenceProposal {
  schema: 'nk1.hexis-evidence-proposal.v1';
  beliefId: string;
  evidenceId: string;
  contentHash: string;
  stance: HexisEvidenceStance;
  source: MemoryEvidenceSource;
  upstreamConfidence?: { before: number; after: number };
  requiresIndependentReview: true;
  confidenceMutationApplied: false;
}

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`Hexis evidence ${field} must be a non-empty string`);
  }
  return value.trim();
}

function provenanceFor(kind: HexisEvidenceKind): MemoryProvenanceClass {
  switch (kind) {
    case 'user_testimony': return 'user';
    case 'repository_document':
    case 'tool_receipt':
    case 'environment_observation': return 'external';
    case 'agent_inference': return 'derived';
    default: return 'unknown';
  }
}

/**
 * Converts one upstream evidence event into a bounded, reviewable NK1 proposal.
 * Refuting evidence is preserved as refuting evidence; it is not silently
 * converted into support. Repeated independence keys remain detectable.
 */
export function adaptHexisEvidence(record: HexisEvidenceRecord): HexisEvidenceProposal {
  const beliefId = nonEmpty(record.beliefId, 'beliefId');
  const evidenceId = nonEmpty(record.evidenceId, 'evidenceId');
  const contentHash = nonEmpty(record.contentHash, 'contentHash');
  const sourceRef = nonEmpty(record.sourceRef, 'sourceRef');
  const independenceKey = nonEmpty(record.independenceKey, 'independenceKey');

  if (!Number.isFinite(record.observedAt) || record.observedAt < 0) {
    throw new TypeError('Hexis evidence observedAt must be a finite non-negative timestamp');
  }
  if (!['supports', 'refutes', 'neutral'].includes(record.stance)) {
    throw new TypeError('Hexis evidence stance is invalid');
  }
  if (!['user_testimony', 'repository_document', 'tool_receipt', 'environment_observation', 'agent_inference', 'unknown'].includes(record.sourceKind)) {
    throw new TypeError('Hexis evidence sourceKind is invalid');
  }

  const before = record.confidenceBefore;
  const after = record.confidenceAfter;
  const upstreamConfidence = before !== undefined && after !== undefined
    && Number.isFinite(before) && Number.isFinite(after)
    ? { before: clamp01(before), after: clamp01(after) }
    : undefined;

  return {
    schema: 'nk1.hexis-evidence-proposal.v1',
    beliefId,
    evidenceId,
    contentHash,
    stance: record.stance,
    source: {
      source: `hexis:${sourceRef}#${evidenceId}`,
      provenanceClass: provenanceFor(record.sourceKind),
      sourceAuthority01: clamp01(record.authority01),
      independenceKey,
      observedAt: record.observedAt,
      evidenceFreshnessAt: record.observedAt,
    },
    ...(upstreamConfidence ? { upstreamConfidence } : {}),
    requiresIndependentReview: true,
    confidenceMutationApplied: false,
  };
}
