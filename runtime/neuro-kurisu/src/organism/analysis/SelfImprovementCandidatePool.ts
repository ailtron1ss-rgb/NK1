/**
 * Bounded self-improvement candidate admission.
 * All candidate input is treated as untrusted data: only own data properties on
 * plain records and dense arrays are accepted, and an immutable normalized copy
 * is retained so callers cannot mutate a candidate after admission.
 */
import type { SourceGraph } from './SourceGraph.ts';
import { evaluateModification, type GuardResult } from './SelfModificationGuard.ts';
import { evaluateProxyDivergence, type DivergenceResult, type PairedObservation } from './ProxyDivergenceGuard.ts';
import { assessDanger, isWithinDangerEnvelope, DEFAULT_DANGER_THRESHOLDS, type DangerAssessment, type DangerThresholds } from './DangerModel.ts';

export interface EvolveBlock { file: string; startLine: number; endLine: number; }
export interface SelfImprovementCandidate {
  candidateId: string;
  targetFiles: string[];
  evolveBlocks: EvolveBlock[];
  observations: PairedObservation[];
  rollbackReady: boolean;
  parentId?: string;
}
export interface CandidatePoolPolicy { maxPoolSize: number; minDownstreamGain: number; }
export const DEFAULT_POOL_POLICY: CandidatePoolPolicy = Object.freeze({ maxPoolSize: 32, minDownstreamGain: 0 });
export interface AdmissionResult { accepted: boolean; candidateId: string; reason: string; guard?: GuardResult; divergence?: DivergenceResult; danger?: DangerAssessment; }
export interface RankedCandidate { candidateId: string; downstreamGain: number; proxyGain: number; divergence: number; danger01: number; parentId?: string; }
interface StoredCandidate { candidate: Readonly<SelfImprovementCandidate>; downstreamGain: number; proxyGain: number; divergence: number; danger01: number; }
const MAX_POOL_SIZE = 1024;
const MAX_REJECTIONS = 256;
const MAX_TARGETS = 256;
const MAX_OBSERVATIONS = 10_000;
const MAX_PATH_LENGTH = 512;
const MAX_LINE = 10_000_000;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try { const prototype = Object.getPrototypeOf(value); return prototype === Object.prototype || prototype === null; }
  catch { return false; }
}
function hasAccessor(value: Record<string, unknown>, key: string): boolean {
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor !== undefined && !Object.prototype.hasOwnProperty.call(descriptor, 'value'); }
  catch { return true; }
}
function ownData(value: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
  } catch { return undefined; }
}
function denseArray(value: unknown, maximum: number): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = lengthDescriptor && Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ? lengthDescriptor.value : Number.NaN;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > maximum) return null;
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch { return null; }
}
function validRepoPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > MAX_PATH_LENGTH || value !== value.trim()) return false;
  if (value.startsWith('/') || value.includes('\\') || value.includes('\0')) return false;
  const segments = value.split('/');
  return segments.every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}
function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
function freezeCandidate(candidate: SelfImprovementCandidate): Readonly<SelfImprovementCandidate> {
  const evolveBlocks = candidate.evolveBlocks.map(block => Object.freeze({ ...block }));
  const observations = candidate.observations.map(row => Object.freeze({ ...row }));
  return Object.freeze({
    candidateId: candidate.candidateId,
    targetFiles: Object.freeze([...candidate.targetFiles]) as unknown as string[],
    evolveBlocks: Object.freeze(evolveBlocks) as unknown as EvolveBlock[],
    observations: Object.freeze(observations) as unknown as PairedObservation[],
    rollbackReady: true,
    ...(candidate.parentId ? { parentId: candidate.parentId } : {}),
  });
}
function normalizeCandidate(input: unknown): { candidateId: string; candidate?: Readonly<SelfImprovementCandidate>; reason?: string } {
  if (!isPlainRecord(input)) return { candidateId: '', reason: 'malformed-candidate-record' };
  const rawId = ownData(input, 'candidateId');
  const candidateId = typeof rawId === 'string' ? rawId.trim() : '';
  if (!candidateId || candidateId.length > 128 || /[\u0000-\u001f]/.test(candidateId)) return { candidateId: '', reason: 'candidate-id-missing-or-invalid' };
  const rollbackReady = ownData(input, 'rollbackReady');
  if (rollbackReady !== true) return { candidateId, reason: rollbackReady === false ? 'no-rollback-path' : 'malformed-rollback-readiness' };

  const rawTargets = denseArray(ownData(input, 'targetFiles'), MAX_TARGETS);
  if (!rawTargets || rawTargets.length === 0) return { candidateId, reason: 'malformed-target-files' };
  const targetFiles: string[] = [];
  const targetSet = new Set<string>();
  for (const raw of rawTargets) {
    if (!validRepoPath(raw) || targetSet.has(raw)) return { candidateId, reason: 'malformed-target-files' };
    targetSet.add(raw); targetFiles.push(raw);
  }

  const rawBlocks = denseArray(ownData(input, 'evolveBlocks'), MAX_TARGETS);
  if (!rawBlocks) return { candidateId, reason: 'malformed-evolve-blocks' };
  const evolveBlocks: EvolveBlock[] = [];
  for (const raw of rawBlocks) {
    if (!isPlainRecord(raw)) return { candidateId, reason: 'malformed-evolve-blocks' };
    const file = ownData(raw, 'file');
    const startLine = ownData(raw, 'startLine');
    const endLine = ownData(raw, 'endLine');
    if (!validRepoPath(file) || !targetSet.has(file)) return { candidateId, reason: 'malformed-evolve-blocks' };
    if (typeof startLine !== 'number' || !Number.isSafeInteger(startLine) || startLine < 1 || startLine > MAX_LINE ||
        typeof endLine !== 'number' || !Number.isSafeInteger(endLine) || endLine < startLine || endLine > MAX_LINE) {
      return { candidateId, reason: `malformed-evolve-block:${file}` };
    }
    evolveBlocks.push({ file, startLine, endLine });
  }
  for (const target of targetFiles) {
    if (!evolveBlocks.some(block => block.file === target)) return { candidateId, reason: `target-outside-evolve-block:${target}` };
  }

  const rawObservations = denseArray(ownData(input, 'observations'), MAX_OBSERVATIONS);
  if (!rawObservations) return { candidateId, reason: 'malformed-observations' };
  const observations: PairedObservation[] = [];
  const observationIds = new Set<string>();
  for (const raw of rawObservations) {
    if (!isPlainRecord(raw)) return { candidateId, reason: 'malformed-observations' };
    const id = ownData(raw, 'id');
    const proxyGain = finite(ownData(raw, 'proxyGain'));
    const downstreamGain = finite(ownData(raw, 'downstreamGain'));
    if (typeof id !== 'string' || !id.trim() || id.length > 128 || observationIds.has(id.trim()) ||
        proxyGain === null || downstreamGain === null || Math.abs(proxyGain) > 1 || Math.abs(downstreamGain) > 1) {
      return { candidateId, reason: 'malformed-observations' };
    }
    observationIds.add(id.trim());
    observations.push({ id: id.trim(), proxyGain, downstreamGain });
  }
  if (hasAccessor(input, 'parentId')) return { candidateId, reason: 'malformed-parent-id' };
  const rawParent = ownData(input, 'parentId');
  if (rawParent !== undefined && (typeof rawParent !== 'string' || !rawParent.trim() || rawParent.length > 128)) {
    return { candidateId, reason: 'malformed-parent-id' };
  }
  const normalized: SelfImprovementCandidate = {
    candidateId, targetFiles, evolveBlocks, observations, rollbackReady: true,
    ...(typeof rawParent === 'string' ? { parentId: rawParent.trim() } : {}),
  };
  return { candidateId, candidate: freezeCandidate(normalized) };
}
function normalizePolicy(input: Partial<CandidatePoolPolicy>): CandidatePoolPolicy {
  if (!isPlainRecord(input) || hasAccessor(input, 'maxPoolSize') || hasAccessor(input, 'minDownstreamGain')) throw new RangeError('candidate-pool-policy-invalid');
  const rawMax = ownData(input, 'maxPoolSize');
  const rawFloor = ownData(input, 'minDownstreamGain');
  const maxPoolSize = rawMax === undefined ? DEFAULT_POOL_POLICY.maxPoolSize : rawMax;
  const minDownstreamGain = rawFloor === undefined ? DEFAULT_POOL_POLICY.minDownstreamGain : rawFloor;
  if (typeof maxPoolSize !== 'number' || !Number.isSafeInteger(maxPoolSize) || maxPoolSize < 1 || maxPoolSize > MAX_POOL_SIZE ||
      typeof minDownstreamGain !== 'number' || !Number.isFinite(minDownstreamGain) || minDownstreamGain < -1 || minDownstreamGain > 1) {
    throw new RangeError('candidate-pool-policy-invalid');
  }
  return Object.freeze({ maxPoolSize, minDownstreamGain });
}

export class SelfImprovementCandidatePool {
  private readonly byId = new Map<string, StoredCandidate>();
  private readonly rejected: { candidateId: string; reason: string }[] = [];
  private readonly policy: CandidatePoolPolicy;
  private readonly dangerThresholds: DangerThresholds;
  private admittedCount = 0;
  private rejectedCount = 0;

  constructor(policy: Partial<CandidatePoolPolicy> = {}, dangerThresholds: DangerThresholds = DEFAULT_DANGER_THRESHOLDS) {
    this.policy = normalizePolicy(policy);
    this.dangerThresholds = Object.freeze({
      maxDanger01: clamp01(Number(dangerThresholds?.maxDanger01 ?? DEFAULT_DANGER_THRESHOLDS.maxDanger01)),
      maxBlastRadius01: clamp01(Number(dangerThresholds?.maxBlastRadius01 ?? DEFAULT_DANGER_THRESHOLDS.maxBlastRadius01)),
    });
  }
  get size(): number { return this.byId.size; }
  rejections(): readonly { candidateId: string; reason: string }[] { return this.rejected.map(row => ({ ...row })); }
  private reject(candidateId: string, reason: string): AdmissionResult {
    this.rejectedCount = Math.min(1_000_000_000, this.rejectedCount + 1);
    this.rejected.push({ candidateId, reason });
    if (this.rejected.length > MAX_REJECTIONS) this.rejected.shift();
    return { accepted: false, candidateId, reason };
  }

  submit(input: unknown, graph: SourceGraph): AdmissionResult {
    const normalized = normalizeCandidate(input);
    const candidateId = normalized.candidateId;
    if (!normalized.candidate) return this.reject(candidateId, normalized.reason ?? 'malformed-candidate');
    const candidate = normalized.candidate;
    if (this.byId.has(candidateId)) return this.reject(candidateId, 'duplicate-candidate-id');

    const guard = evaluateModification({ candidateId, targetFiles: candidate.targetFiles }, graph);
    if (guard.decision !== 'allowed') {
      const reason = guard.refusals.map(r => r.reason).join(',') || 'guard-refused';
      return this.reject(candidateId, `structural:${reason}`);
    }

    const divergence = evaluateProxyDivergence(candidate.observations);
    if (divergence.decision !== 'supported') {
      return this.reject(candidateId, `divergence:${divergence.reason}`);
    }
    if (divergence.meanDownstreamGain < this.policy.minDownstreamGain) {
      return this.reject(candidateId, `below-downstream-floor:${divergence.meanDownstreamGain}`);
    }

    // Danger understanding: even a well-evidenced candidate is refused when its
    // structural risk (blast radius, sensitive subsystem, irreversibility) leaves the
    // advisory envelope. The score comes from the graph and the candidate's own
    // evidence, so a candidate cannot talk its way past it with a self-declared label.
    const danger = assessDanger({
      candidateId,
      targetFiles: candidate.targetFiles,
      rollbackReady: candidate.rollbackReady,
      meanDownstreamGain: divergence.meanDownstreamGain,
      meanDivergence: divergence.meanDivergence,
      observationCount: candidate.observations.length,
      protectedHits: guard.protectedHits.length,
    }, graph, this.dangerThresholds);
    if (!isWithinDangerEnvelope(danger, this.dangerThresholds)) {
      return this.reject(candidateId, danger.reason);
    }

    this.byId.set(candidateId, {
      candidate,
      downstreamGain: divergence.meanDownstreamGain,
      proxyGain: divergence.meanProxyGain,
      divergence: divergence.meanDivergence,
      danger01: danger.score01,
    });
    this.admittedCount = Math.min(1_000_000_000, this.admittedCount + 1);
    this.evictIfNeeded();
    return { accepted: true, candidateId, reason: 'admitted', guard, divergence, danger };
  }

  private evictIfNeeded(): void {
    while (this.byId.size > this.policy.maxPoolSize) {
      let weakestId: string | null = null;
      let weakestGain = Number.POSITIVE_INFINITY;
      for (const [id, stored] of this.byId) {
        if (stored.downstreamGain < weakestGain) { weakestGain = stored.downstreamGain; weakestId = id; }
      }
      if (weakestId === null) return;
      this.byId.delete(weakestId);
    }
  }
  rank(): RankedCandidate[] {
    return [...this.byId.values()].map(stored => ({
      candidateId: stored.candidate.candidateId,
      downstreamGain: stored.downstreamGain,
      proxyGain: stored.proxyGain,
      divergence: stored.divergence,
      danger01: stored.danger01,
      parentId: stored.candidate.parentId,
    })).sort((a, b) => (b.downstreamGain - a.downstreamGain) || (a.danger01 - b.danger01) || a.candidateId.localeCompare(b.candidateId));
  }
  best(): RankedCandidate | null { return this.rank()[0] ?? null; }
  snapshot() {
    return {
      version: 1 as const,
      size: this.byId.size,
      admitted: this.admittedCount,
      rejected: this.rejectedCount,
      policy: { ...this.policy },
      ranked: this.rank(),
      rejectionLedgerSize: this.rejected.length,
    };
  }
}