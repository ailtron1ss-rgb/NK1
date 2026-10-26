import { createHash } from 'node:crypto';
import type { MemoryOS2 } from '../../developmental/MemoryOS2.ts';
import type { P65ClaimProvenance, P65EpistemicLedger } from '../../memory/P65EpistemicLedger.ts';
import type { SourceMonitor, SourceTrace, SourceTraceProvenance } from '../../memory/SourceMonitor.ts';

export interface HexisCanonicalEvidenceBridgeStats {
  attempted: number;
  accepted: number;
  added: number;
  duplicates: number;
  rejected: number;
}

/**
 * Bounded, one-way integration from descriptive Hexis/OMEGA source lineage to the
 * canonical MemoryOS2 evidence owner. This bridge records provenance only: it
 * does not verify a factual claim, authenticate a source, authorize a skill, or
 * revise belief confidence. Only direct/corroborated observations with a declared
 * content fingerprint may enter this path; model/memory echoes, inferences and
 * unverified traces cannot manufacture independent evidence.
 */
export class HexisCanonicalEvidenceBridge {
  private readonly counters: HexisCanonicalEvidenceBridgeStats = {
    attempted: 0, accepted: 0, added: 0, duplicates: 0, rejected: 0,
  };

  constructor(
    private readonly memory: MemoryOS2,
    private readonly sourceMonitor: SourceMonitor,
    private readonly p65: P65EpistemicLedger,
  ) {}

  recordSourceTrace(memoryId: string, traceId: string) {
    const trace = this.sourceMonitor.lineage(traceId, 1)[0];
    if (!trace) return this.reject(memoryId, 'source-trace-not-found', traceId);
    return this.recordCandidate(memoryId, {
      id: trace.id,
      source: trace.source,
      kind: trace.kind,
      confidence: trace.confidence,
      epistemicStatus: trace.epistemicStatus,
      at: trace.at,
      provenance: trace.provenance,
    }, 'source-monitor');
  }

  recordP65Claim(memoryId: string, claimId: string) {
    const claim = this.p65.snapshot().claimsData.find(row => row.id === claimId);
    if (!claim) return this.reject(memoryId, 'p65-claim-not-found', claimId);
    if (claim.kind !== 'observation' || claim.resolved || claim.status !== 'active') {
      return this.reject(memoryId, 'p65-claim-not-current-observation', claimId);
    }
    const source = this.mapP65Source(claim.source);
    if (!source) return this.reject(memoryId, 'p65-source-not-independent', claimId);
    return this.recordCandidate(memoryId, {
      id: claim.id,
      source,
      kind: 'p65:' + claim.kind,
      confidence: claim.confidence01,
      epistemicStatus: 'observation',
      at: claim.at,
      provenance: claim.provenance,
    }, 'p65');
  }

  snapshotStats(): Readonly<HexisCanonicalEvidenceBridgeStats> {
    return Object.freeze({ ...this.counters });
  }

  private recordCandidate(
    memoryId: string,
    candidate: {
      id: string;
      source: SourceTrace['source'];
      kind: string;
      confidence: number;
      epistemicStatus: SourceTrace['epistemicStatus'];
      at: number;
      provenance?: SourceTraceProvenance | P65ClaimProvenance;
    },
    origin: 'source-monitor' | 'p65',
  ) {
    this.counters.attempted++;
    if (typeof memoryId !== 'string' || !memoryId.trim() || memoryId !== memoryId.trim() || memoryId.length > 192) {
      return this.reject(memoryId, 'memory-identity-invalid', candidate.id, true);
    }
    if (!['user', 'system', 'world', 'tool'].includes(candidate.source)) {
      return this.reject(memoryId, 'source-not-independent', candidate.id, true);
    }
    if (!['observation', 'fact'].includes(candidate.epistemicStatus)) {
      return this.reject(memoryId, 'epistemic-status-not-observation', candidate.id, true);
    }
    if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1 ||
        !Number.isSafeInteger(candidate.at) || candidate.at < 0 || candidate.at > 8_640_000_000_000_000) {
      return this.reject(memoryId, 'observation-confidence-or-time-invalid', candidate.id, true);
    }

    const provenance = candidate.provenance;
    if (!provenance ||
        typeof provenance.sourceId !== 'string' || !provenance.sourceId.trim() ||
        provenance.sourceId !== provenance.sourceId.trim() || provenance.sourceId.length > 192 ||
        /[\u0000-\u001f\u007f-\u009f]/.test(provenance.sourceId) ||
        typeof provenance.sourceKind !== 'string' || !provenance.sourceKind.trim() ||
        provenance.sourceKind !== provenance.sourceKind.trim() || provenance.sourceKind.length > 64 ||
        /[\u0000-\u001f\u007f-\u009f]/.test(provenance.sourceKind) ||
        !Number.isSafeInteger(provenance.capturedAt) || provenance.capturedAt < 0 ||
        provenance.capturedAt > 8_640_000_000_000_000 ||
        (provenance.evidenceClass !== 'direct-observation' && provenance.evidenceClass !== 'corroborated') ||
        typeof provenance.contentFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(provenance.contentFingerprint)) {
      return this.reject(memoryId, 'provenance-not-eligible-for-canonical-lineage', candidate.id, true);
    }

    // Same upstream source + same declared content fingerprint is one lineage,
    // regardless of whether the trace arrived through SourceMonitor or P65.
    const independentDigest = createHash('sha256')
      .update(provenance.sourceId + '\u0000' + provenance.contentFingerprint)
      .digest('hex');
    const independenceKey = 'hexis-source:' + independentDigest;
    const provenanceClass = this.mapSource(candidate.source);
    const authorityCap = provenance.evidenceClass === 'corroborated' ? 0.76 : 0.64;
    const source = 'hexis-' + origin + ':' + candidate.source + ':' + provenance.sourceKind;

    try {
      const result = this.memory.recordEvidence(memoryId, {
        source,
        provenanceClass,
        sourceAuthority01: Math.min(candidate.confidence, authorityCap),
        independenceKey,
        observedAt: candidate.at,
        evidenceFreshnessAt: provenance.capturedAt,
      });
      if (!result.ok) return this.reject(memoryId, result.reason, candidate.id, true);
      this.counters.accepted++;
      if (result.added) this.counters.added++;
      else this.counters.duplicates++;
      return {
        accepted: true as const,
        added: result.added,
        reason: result.reason,
        origin,
        memoryId: result.memoryId,
        sourceRecordId: candidate.id,
        independentSources: result.independentSources,
      };
    } catch {
      return this.reject(memoryId, 'canonical-evidence-write-failed', candidate.id, true);
    }
  }

  private mapSource(source: SourceTrace['source']): 'user' | 'device' | 'external' {
    if (source === 'user') return 'user';
    if (source === 'world' || source === 'tool') return 'external';
    return 'device';
  }

  private mapP65Source(source: string): SourceTrace['source'] | null {
    const normalized = String(source ?? '').trim().toLocaleLowerCase();
    if (normalized === 'user') return 'user';
    if (['os', 'android', 'termux', 'device', 'sensor'].includes(normalized)) return 'system';
    if (['external-api', 'web', 'world'].includes(normalized)) return 'world';
    if (normalized === 'tool') return 'tool';
    return null;
  }

  private reject(memoryId: string, reason: string, sourceRecordId?: string, counted = false) {
    if (!counted) this.counters.attempted++;
    this.counters.rejected++;
    return {
      accepted: false as const,
      added: false as const,
      reason,
      memoryId: typeof memoryId === 'string' ? memoryId : '',
      ...(typeof sourceRecordId === 'string' ? { sourceRecordId } : {}),
    };
  }
}
