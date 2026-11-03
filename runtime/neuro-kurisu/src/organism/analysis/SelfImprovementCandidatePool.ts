/**
 * Bounded pool of self-improvement candidates, selected by measured downstream
 * outcome rather than by the proxy score the optimizer can see.
 *
 * This replaces the previous shape, where `SandboxedSelfRewriteEngine.propose`
 * approved a rewrite by thresholding four caller-supplied scalars. That engine had
 * no candidate pool, no restriction on where a rewrite could land, and no way to
 * tell a real gain from a proxy gain — which is precisely the failure mode seen in
 * documented 2026 self-improvement incidents.
 *
 * Three gates are enforced on submission, and all three fail closed:
 *   1. structural   — every target file must be declared as an evolve block, and the
 *                     self-modification guard must not find a protected/forbidden hit;
 *   2. divergence   — proxy gain must be backed by downstream gain (ProxyDivergenceGuard);
 *   3. reversibility — a candidate without a rollback path is never admitted.
 *
 * Selection reads only `downstreamGain`. The proxy value is retained for reporting so
 * the gap stays visible, never for ranking.
 */

import type { SourceGraph } from './SourceGraph.ts';
import { evaluateModification, type GuardResult } from './SelfModificationGuard.ts';
import {
  evaluateProxyDivergence,
  type DivergenceResult,
  type PairedObservation,
} from './ProxyDivergenceGuard.ts';

export interface EvolveBlock {
  file: string;
  startLine: number;
  endLine: number;
}

export interface SelfImprovementCandidate {
  candidateId: string;
  /** Files the candidate wants to modify; must all appear in `evolveBlocks`. */
  targetFiles: string[];
  /** Regions a rewrite is permitted to touch, mirroring the EVOLVE-BLOCK discipline. */
  evolveBlocks: EvolveBlock[];
  /** Paired observations backing the claim; the divergence gate reads these. */
  observations: PairedObservation[];
  rollbackReady: boolean;
  /** Optional lineage pointer to the candidate this one was derived from. */
  parentId?: string;
}

export interface CandidatePoolPolicy {
  /** Hard cap on retained candidates; the weakest by downstream gain is evicted. */
  maxPoolSize: number;
  /** A candidate below this measured downstream gain is not worth keeping. */
  minDownstreamGain: number;
}

export const DEFAULT_POOL_POLICY: CandidatePoolPolicy = {
  maxPoolSize: 32,
  minDownstreamGain: 0,
};

export interface AdmissionResult {
  accepted: boolean;
  candidateId: string;
  reason: string;
  guard?: GuardResult;
  divergence?: DivergenceResult;
}

export interface RankedCandidate {
  candidateId: string;
  downstreamGain: number;
  proxyGain: number;
  divergence: number;
  parentId?: string;
}

interface StoredCandidate {
  candidate: SelfImprovementCandidate;
  downstreamGain: number;
  proxyGain: number;
  divergence: number;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class SelfImprovementCandidatePool {
  private readonly byId = new Map<string, StoredCandidate>();
  private readonly rejected: { candidateId: string; reason: string }[] = [];
  private readonly policy: CandidatePoolPolicy;
  private admittedCount = 0;

  constructor(policy: Partial<CandidatePoolPolicy> = {}) {
    this.policy = { ...DEFAULT_POOL_POLICY, ...policy };
  }

  get size(): number {
    return this.byId.size;
  }

  /** Ordered rejections, retained for audit; not part of selection. */
  rejections(): readonly { candidateId: string; reason: string }[] {
    return [...this.rejected];
  }

  private reject(candidateId: string, reason: string): AdmissionResult {
    this.rejected.push({ candidateId, reason });
    return { accepted: false, candidateId, reason };
  }

  submit(candidate: SelfImprovementCandidate, graph: SourceGraph): AdmissionResult {
    const candidateId = typeof candidate?.candidateId === 'string' ? candidate.candidateId.trim() : '';
    if (!candidateId) return this.reject('', 'candidate-id-missing');
    if (this.byId.has(candidateId)) return this.reject(candidateId, 'duplicate-candidate-id');
    if (!candidate.rollbackReady) return this.reject(candidateId, 'no-rollback-path');

    const targets = Array.isArray(candidate.targetFiles) ? candidate.targetFiles.filter((f) => typeof f === 'string') : [];
    if (targets.length === 0) return this.reject(candidateId, 'no-target-files');

    // Gate 1a: a rewrite may only land in a declared evolve block.
    const blocks = Array.isArray(candidate.evolveBlocks) ? candidate.evolveBlocks : [];
    const declaredFiles = new Set(blocks.map((b) => b?.file).filter((f) => typeof f === 'string'));
    for (const target of targets) {
      if (!declaredFiles.has(target)) {
        return this.reject(candidateId, `target-outside-evolve-block:${target}`);
      }
      const block = blocks.find((b) => b?.file === target);
      const start = finiteOrNull(block?.startLine);
      const end = finiteOrNull(block?.endLine);
      if (start === null || end === null || start < 1 || end < start) {
        return this.reject(candidateId, `malformed-evolve-block:${target}`);
      }
    }

    // Gate 1b: the structural danger guard.
    const guard = evaluateModification({ candidateId, targetFiles: targets }, graph);
    if (guard.decision !== 'allowed') {
      const reason = guard.refusals.map((r) => r.reason).join(',') || 'guard-refused';
      return { accepted: false, candidateId, reason: `structural:${reason}`, guard };
    }

    // Gate 2: proxy gain must be backed by downstream gain.
    const divergence = evaluateProxyDivergence(candidate.observations ?? []);
    if (divergence.decision !== 'supported') {
      return { accepted: false, candidateId, reason: `divergence:${divergence.reason}`, guard, divergence };
    }

    // Gate 3: the measured outcome must clear the pool floor.
    if (divergence.meanDownstreamGain < this.policy.minDownstreamGain) {
      return { accepted: false, candidateId, reason: `below-downstream-floor:${divergence.meanDownstreamGain}`, guard, divergence };
    }

    this.byId.set(candidateId, {
      candidate,
      downstreamGain: divergence.meanDownstreamGain,
      proxyGain: divergence.meanProxyGain,
      divergence: divergence.meanDivergence,
    });
    this.admittedCount += 1;
    this.evictIfNeeded();
    return { accepted: true, candidateId, reason: 'admitted', guard, divergence };
  }

  private evictIfNeeded(): void {
    while (this.byId.size > this.policy.maxPoolSize) {
      let weakestId: string | null = null;
      let weakestGain = Number.POSITIVE_INFINITY;
      for (const [id, stored] of this.byId) {
        if (stored.downstreamGain < weakestGain) {
          weakestGain = stored.downstreamGain;
          weakestId = id;
        }
      }
      if (weakestId === null) return;
      this.byId.delete(weakestId);
    }
  }

  /** Ranking by measured downstream gain; ties broken by id for determinism. */
  rank(): RankedCandidate[] {
    return [...this.byId.values()]
      .map((stored) => ({
        candidateId: stored.candidate.candidateId,
        downstreamGain: stored.downstreamGain,
        proxyGain: stored.proxyGain,
        divergence: stored.divergence,
        parentId: stored.candidate.parentId,
      }))
      .sort((a, b) => (b.downstreamGain - a.downstreamGain) || a.candidateId.localeCompare(b.candidateId));
  }

  best(): RankedCandidate | null {
    return this.rank()[0] ?? null;
  }

  snapshot() {
    return {
      version: 1 as const,
      size: this.byId.size,
      admitted: this.admittedCount,
      rejected: this.rejected.length,
      policy: { ...this.policy },
      ranked: this.rank(),
    };
  }
}
