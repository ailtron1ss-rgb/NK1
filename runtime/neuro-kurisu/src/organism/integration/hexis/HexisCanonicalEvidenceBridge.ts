import { createHash } from 'node:crypto';
import { normalizeEvidenceLineageProvenance, type EvidenceLineageProvenance } from '../../memory/EvidenceLineageProvenance.ts';
import type { MemoryEvidenceSource, MemoryItem2 } from '../../developmental/MemoryOS2.ts';
import type { MemoryFabric } from '../../memory/MemoryFabric.ts';
import type { P65EpistemicLedger } from '../../memory/P65EpistemicLedger.ts';
import type { SourceMonitor, SourceTrace } from '../../memory/SourceMonitor.ts';

export interface HexisCanonicalEvidenceBridgeStats {
  attempted: number;
  accepted: number;
  added: number;
  duplicates: number;
  rejected: number;
}
type EvidenceOrigin = 'source-monitor' | 'p65';
type IndependentSource = 'user' | 'system' | 'world' | 'tool';
type Candidate = {
  id: string;
  source: SourceTrace['source'];
  kind: string;
  confidence: number;
  epistemicStatus: string;
  at: number;
  provenance?: EvidenceLineageProvenance;
};

/**
 * One-way provenance bridge into MemoryFabric's existing canonical mutation
 * boundary. It never verifies a claim, authenticates a source, changes belief
 * confidence, grants tool permission, or promotes a skill. A declared content
 * fingerprint is lineage metadata, not source authentication.
 */
export class HexisCanonicalEvidenceBridge {
  private readonly counters: HexisCanonicalEvidenceBridgeStats = {
    attempted: 0, accepted: 0, added: 0, duplicates: 0, rejected: 0,
  };
  private readonly memory: MemoryFabric;
  private readonly sourceMonitor: SourceMonitor;
  private readonly p65: P65EpistemicLedger;

  constructor(memory: MemoryFabric, sourceMonitor: SourceMonitor, p65: P65EpistemicLedger) {
    this.memory = memory;
    this.sourceMonitor = sourceMonitor;
    this.p65 = p65;
  }

  recordSourceTrace(memoryId: string, traceId: string) {
    this.counters.attempted++;
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
    this.counters.attempted++;
    const claim = this.p65.snapshot().claimsData.find(row => row.id === claimId);
    if (!claim) return this.reject(memoryId, 'p65-claim-not-found', claimId);
    if (claim.kind !== 'observation' || claim.resolved || claim.status !== 'active') {
      return this.reject(memoryId, 'p65-claim-not-current-observation', claimId);
    }
    const source = this.mapP65Source(claim.source);
    if (!source) return this.reject(memoryId, 'p65-source-not-independent', claimId);
    const provenance = normalizeEvidenceLineageProvenance(claim.provenance);
    if (!provenance || createHash('sha256').update(claim.content).digest('hex') !== provenance.contentFingerprint) {
      return this.reject(memoryId, 'p65-content-fingerprint-mismatch', claimId);
    }
    return this.recordCandidate(memoryId, {
      id: claim.id,
      source,
      kind: 'p65-observation',
      confidence: claim.confidence01,
      epistemicStatus: 'observation',
      at: claim.at,
      provenance: claim.provenance,
    }, 'p65');
  }

  snapshotStats(): Readonly<HexisCanonicalEvidenceBridgeStats> {
    return Object.freeze({ ...this.counters });
  }

  private recordCandidate(memoryId: string, candidate: Candidate, origin: EvidenceOrigin) {
    if (typeof memoryId !== 'string' || !memoryId.trim() || memoryId !== memoryId.trim() ||
      memoryId.length > 192 || /[\u0000-\u001f\u007f-\u009f]/u.test(memoryId)) {
      return this.reject(memoryId, 'memory-identity-invalid', candidate.id);
    }
    if (!['user', 'system', 'world', 'tool'].includes(candidate.source)) {
      return this.reject(memoryId, 'source-not-independent', candidate.id);
    }
    if (candidate.epistemicStatus !== 'observation' && candidate.epistemicStatus !== 'fact') {
      return this.reject(memoryId, 'epistemic-status-not-observation', candidate.id);
    }
    if (typeof candidate.confidence !== 'number' || !Number.isFinite(candidate.confidence) ||
      candidate.confidence < 0 || candidate.confidence > 1 ||
      !Number.isSafeInteger(candidate.at) || candidate.at < 0 || candidate.at > 8_640_000_000_000_000) {
      return this.reject(memoryId, 'observation-confidence-or-time-invalid', candidate.id);
    }
    // Bound the observation timestamp independently of the provenance capture time.
    // A valid/fresh envelope must not legitimize a future-dated event in canonical memory.
    if (candidate.at > Date.now() + 5 * 60_000) {
      return this.reject(memoryId, 'observation-time-in-future', candidate.id);
    }
    const provenance = normalizeEvidenceLineageProvenance(candidate.provenance);
    if (!provenance) return this.reject(memoryId, 'provenance-envelope-invalid', candidate.id);
    if (provenance.evidenceClass !== 'direct-observation' && provenance.evidenceClass !== 'corroborated') {
      return this.reject(memoryId, 'provenance-class-not-eligible', candidate.id);
    }
    if (provenance.capturedAt > Date.now() + 5 * 60_000) {
      return this.reject(memoryId, 'provenance-capture-time-in-future', candidate.id);
    }

    const canonical = this.memory.canonicalSnapshot(false).items.find(row => row.id === memoryId);
    if (!canonical) return this.reject(memoryId, 'canonical-memory-not-found', candidate.id);

    const sourceDigest = createHash('sha256')
      .update(provenance.sourceId + '\u0000' + provenance.contentFingerprint)
      .digest('hex');
    const independenceKey = 'hexis-source:' + sourceDigest;
    const lineageKey = 'lineage:' + independenceKey.normalize('NFKC').toLocaleLowerCase();
    if (this.hasLineage(canonical, independenceKey, lineageKey)) {
      this.counters.accepted++;
      this.counters.duplicates++;
      return {
        accepted: true as const,
        added: false as const,
        reason: 'duplicate-source-lineage',
        origin,
        memoryId: canonical.id,
        sourceRecordId: candidate.id,
        independentSources: Array.isArray(canonical.evidenceSources) ? canonical.evidenceSources.length : 0,
      };
    }

    const provenanceClass: MemoryEvidenceSource['provenanceClass'] =
      candidate.source === 'user' ? 'user' :
      candidate.source === 'world' || candidate.source === 'tool' ? 'external' : 'device';
    const authorityCap = provenance.evidenceClass === 'corroborated' ? 0.76 : 0.64;
    const source: MemoryEvidenceSource = {
      source: 'hexis-lineage:' + origin + ':' + candidate.source + ':' + provenance.sourceKind,
      provenanceClass,
      sourceAuthority01: Math.min(candidate.confidence, authorityCap),
      independenceKey,
      observedAt: candidate.at,
      evidenceFreshnessAt: provenance.capturedAt,
    };
    const commandId = 'hexis-canonical-evidence:' + origin + ':' +
      createHash('sha256').update(memoryId + '\u0000' + independenceKey).digest('hex').slice(0, 32);
    try {
      const updated = this.memory.attachEvidenceSource(memoryId, source, 'hexis-canonical-evidence-lineage', { commandId });
      if (!updated) return this.reject(memoryId, 'canonical-evidence-write-failed', candidate.id);
      if (!this.hasLineage(updated, independenceKey, lineageKey)) {
        return this.reject(memoryId, 'canonical-lineage-not-retained', candidate.id);
      }
      this.counters.accepted++;
      this.counters.added++;
      return {
        accepted: true as const,
        added: true as const,
        reason: 'canonical-lineage-recorded',
        origin,
        memoryId: updated.id,
        sourceRecordId: candidate.id,
        independentSources: Array.isArray(updated.evidenceSources) ? updated.evidenceSources.length : 0,
      };
    } catch {
      return this.reject(memoryId, 'canonical-evidence-write-failed', candidate.id);
    }
  }

  private hasLineage(memory: Pick<MemoryItem2, 'evidenceLineageKeys' | 'evidenceSources'>, independenceKey: string, lineageKey: string) {
    if (Array.isArray(memory.evidenceLineageKeys) && memory.evidenceLineageKeys.includes(lineageKey)) return true;
    return Array.isArray(memory.evidenceSources) && memory.evidenceSources.some(source =>
      typeof source.independenceKey === 'string' &&
      source.independenceKey.trim().normalize('NFKC').toLocaleLowerCase() === independenceKey.normalize('NFKC').toLocaleLowerCase()
    );
  }

  private mapP65Source(source: string): IndependentSource | null {
    const normalized = String(source ?? '').trim().toLocaleLowerCase();
    if (normalized === 'user') return 'user';
    if (['os', 'android', 'termux', 'device', 'sensor'].includes(normalized)) return 'system';
    if (['external-api', 'web', 'world'].includes(normalized)) return 'world';
    if (normalized === 'tool') return 'tool';
    return null;
  }

  private reject(memoryId: unknown, reason: string, sourceRecordId?: string) {
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
