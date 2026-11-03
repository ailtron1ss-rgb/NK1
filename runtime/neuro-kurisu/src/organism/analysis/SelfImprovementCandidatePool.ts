import { createPublicKey } from 'node:crypto';
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
import { verifyPatchReceipt, type PatchReceipt } from './PatchReceiptGuard.ts';
import {
  patchTreatmentMethod,
  type P36PatchOutcomeEvidence,
  type P36PatchOutcomeEvidenceRequest,
} from '../learning/P36PatchOutcomeEvidenceAuthority.ts';

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

/**
 * Immutable host-owned trust configuration. It must be loaded by the trusted
 * composition root from operator-controlled configuration, never from a
 * candidate, model response, tool result or runtime-writable memory.
 * Contains public verification keys only; signing private keys stay outside NK1.
 */
export interface HostOwnedPatchReceiptTrust {
  baseSha: string;
  trustedPublicKeys: Readonly<Record<string, string>>;
}

export const DEFAULT_POOL_POLICY: CandidatePoolPolicy = Object.freeze({ maxPoolSize: 32, minDownstreamGain: 0 });
export type CandidateAdmissionClass = 'metrics-only' | 'signed-patch-receipt' | 'host-verified-holdout-outcome';
export interface VerifiedPatchReceiptSummary { keyId: string; baseSha: string; patchSha256: string; }
/** Host-owned P36 evaluator closure; never accepted from candidate input. */
export interface HostOwnedPatchOutcomeAuthority {
  measure(request: P36PatchOutcomeEvidenceRequest): P36PatchOutcomeEvidence | null;
}
export interface VerifiedPatchOutcomeSummary extends P36PatchOutcomeEvidence {}
export interface AdmissionResult {
  accepted: boolean;
  candidateId: string;
  reason: string;
  admissionClass?: CandidateAdmissionClass;
  patchReceipt?: VerifiedPatchReceiptSummary;
  outcomeEvidence?: VerifiedPatchOutcomeSummary;
  guard?: GuardResult;
  divergence?: DivergenceResult;
  danger?: DangerAssessment;
}
export interface RankedCandidate {
  candidateId: string;
  downstreamGain: number;
  proxyGain: number | null;
  divergence: number | null;
  danger01: number;
  admissionClass: CandidateAdmissionClass;
  patchReceipt?: VerifiedPatchReceiptSummary;
  outcomeEvidence?: VerifiedPatchOutcomeSummary;
  parentId?: string;
}
interface StoredCandidate {
  candidate: Readonly<SelfImprovementCandidate>;
  downstreamGain: number;
  proxyGain: number | null;
  divergence: number | null;
  danger01: number;
  admissionClass: CandidateAdmissionClass;
  patchReceipt?: VerifiedPatchReceiptSummary;
  outcomeEvidence?: VerifiedPatchOutcomeSummary;
}
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
function normalizeCandidate(input: unknown, options: { ignoreObservations?: boolean } = {}): { candidateId: string; candidate?: Readonly<SelfImprovementCandidate>; reason?: string } {
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

  // P36-backed admission deliberately never reads candidate observations: the
  // independent host outcome is the only downstream signal on that path.
  const observations: PairedObservation[] = [];
  if (options.ignoreObservations !== true) {
    const rawObservations = denseArray(ownData(input, 'observations'), MAX_OBSERVATIONS);
    if (!rawObservations) return { candidateId, reason: 'malformed-observations' };
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
function normalizePatchReceiptTrust(input: unknown): Readonly<HostOwnedPatchReceiptTrust> {
  const refuse = () => { throw new RangeError('candidate-pool-patch-receipt-trust-invalid'); };
  if (!isPlainRecord(input) || hasAccessor(input, 'baseSha') || hasAccessor(input, 'trustedPublicKeys')) return refuse();
  const baseSha = ownData(input, 'baseSha');
  const rawKeys = ownData(input, 'trustedPublicKeys');
  if (typeof baseSha !== 'string' || !/^[a-f0-9]{40}$/i.test(baseSha) || !isPlainRecord(rawKeys)) return refuse();

  let keyIds: string[];
  try { keyIds = Object.keys(rawKeys); } catch { return refuse(); }
  if (keyIds.length < 1 || keyIds.length > 64) return refuse();

  const trustedPublicKeys: Record<string, string> = Object.create(null);
  for (const keyId of keyIds) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(keyId) || hasAccessor(rawKeys, keyId)) return refuse();
    const pem = ownData(rawKeys, keyId);
    if (typeof pem !== 'string' || pem.length < 64 || pem.length > 8192 || !pem.includes('BEGIN PUBLIC KEY')) return refuse();
    try {
      const publicKey = createPublicKey(pem);
      if (publicKey.asymmetricKeyType !== 'ed25519') return refuse();
    } catch {
      return refuse();
    }
    trustedPublicKeys[keyId] = pem;
  }

  return Object.freeze({
    baseSha: baseSha.toLowerCase(),
    trustedPublicKeys: Object.freeze(trustedPublicKeys),
  });
}

function normalizeHostPatchOutcomeAuthority(input: unknown): Readonly<HostOwnedPatchOutcomeAuthority> | null {
  if (input === undefined || input === null) return null;
  if (!isPlainRecord(input) || hasAccessor(input, 'measure')) throw new RangeError('candidate-pool-patch-outcome-authority-invalid');
  const measure = ownData(input, 'measure');
  if (typeof measure !== 'function') throw new RangeError('candidate-pool-patch-outcome-authority-invalid');
  return Object.freeze({ measure: measure as HostOwnedPatchOutcomeAuthority['measure'] });
}

function normalizePatchOutcomeEvidence(
  value: unknown,
  expected: { candidateId: string; baseSha: string; patchSha256: string },
): VerifiedPatchOutcomeSummary | null {
  if (!isPlainRecord(value)) return null;
  const candidateId = ownData(value, 'candidateId');
  const baseSha = ownData(value, 'baseSha');
  const patchSha256 = ownData(value, 'patchSha256');
  const treatmentMethod = ownData(value, 'treatmentMethod');
  const manifestFingerprint = ownData(value, 'manifestFingerprint');
  const taskFamily = ownData(value, 'taskFamily');
  const baselineMethod = ownData(value, 'baselineMethod');
  const pairedSeedCount = ownData(value, 'pairedSeedCount');
  const baselinePassRate = finite(ownData(value, 'baselinePassRate'));
  const candidatePassRate = finite(ownData(value, 'candidatePassRate'));
  const absoluteGain = finite(ownData(value, 'absoluteGain'));
  const evidenceFingerprint = ownData(value, 'evidenceFingerprint');
  const sourceEvidenceFingerprint = ownData(value, 'sourceEvidenceFingerprint');
  const evidenceRefs = denseArray(ownData(value, 'evidenceRefs'), 20_000);
  const delayMs = ownData(value, 'delayMs');
  const evidenceScope = ownData(value, 'evidenceScope');
  if (candidateId !== expected.candidateId || baseSha !== expected.baseSha ||
      patchSha256 !== expected.patchSha256 || treatmentMethod !== patchTreatmentMethod(expected.patchSha256) ||
      typeof manifestFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(manifestFingerprint) ||
      typeof taskFamily !== 'string' || !taskFamily.trim() || taskFamily.length > 96 ||
      typeof baselineMethod !== 'string' || !baselineMethod.trim() || baselineMethod.length > 180 ||
      typeof pairedSeedCount !== 'number' || !Number.isSafeInteger(pairedSeedCount) || pairedSeedCount < 4 || pairedSeedCount > 128 ||
      baselinePassRate === null || baselinePassRate < 0 || baselinePassRate > 1 ||
      candidatePassRate === null || candidatePassRate < 0 || candidatePassRate > 1 ||
      absoluteGain === null || absoluteGain < -1 || absoluteGain > 1 ||
      Math.abs(absoluteGain - (candidatePassRate - baselinePassRate)) > 1e-9 ||
      typeof evidenceFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(evidenceFingerprint) ||
      typeof sourceEvidenceFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(sourceEvidenceFingerprint) ||
      !evidenceRefs || evidenceRefs.length < pairedSeedCount * 2 ||
      evidenceRefs.some(ref => typeof ref !== 'string' || !ref.trim() || ref.length > 512) ||
      new Set(evidenceRefs).size !== evidenceRefs.length ||
      delayMs !== 0 || evidenceScope !== 'point-in-time-holdout-only') {
    return null;
  }
  return Object.freeze({
    candidateId,
    baseSha,
    patchSha256,
    treatmentMethod,
    manifestFingerprint,
    taskFamily,
    baselineMethod,
    pairedSeedCount,
    baselinePassRate,
    candidatePassRate,
    absoluteGain,
    evidenceFingerprint,
    sourceEvidenceFingerprint,
    evidenceRefs: Object.freeze([...evidenceRefs]) as unknown as string[],
    delayMs: 0,
    evidenceScope: 'point-in-time-holdout-only',
  });
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
  private readonly patchReceiptTrust: Readonly<HostOwnedPatchReceiptTrust> | null;
  private readonly patchOutcomeAuthority: Readonly<HostOwnedPatchOutcomeAuthority> | null;
  private admittedCount = 0;
  private rejectedCount = 0;

  constructor(
    policy: Partial<CandidatePoolPolicy> = {},
    dangerThresholds: DangerThresholds = DEFAULT_DANGER_THRESHOLDS,
    hostPatchReceiptTrust?: unknown,
    hostPatchOutcomeAuthority?: unknown,
  ) {
    this.policy = normalizePolicy(policy);
    this.dangerThresholds = Object.freeze({
      maxDanger01: clamp01(Number(dangerThresholds?.maxDanger01 ?? DEFAULT_DANGER_THRESHOLDS.maxDanger01)),
      maxBlastRadius01: clamp01(Number(dangerThresholds?.maxBlastRadius01 ?? DEFAULT_DANGER_THRESHOLDS.maxBlastRadius01)),
    });
    this.patchReceiptTrust = hostPatchReceiptTrust === undefined ? null : normalizePatchReceiptTrust(hostPatchReceiptTrust);
    this.patchOutcomeAuthority = normalizeHostPatchOutcomeAuthority(hostPatchOutcomeAuthority);
  }
  get size(): number { return this.byId.size; }
  rejections(): readonly { candidateId: string; reason: string }[] { return this.rejected.map(row => ({ ...row })); }
  private reject(candidateId: string, reason: string): AdmissionResult {
    this.rejectedCount = Math.min(1_000_000_000, this.rejectedCount + 1);
    this.rejected.push({ candidateId, reason });
    if (this.rejected.length > MAX_REJECTIONS) this.rejected.shift();
    return { accepted: false, candidateId, reason };
  }

  /**
   * Cryptographically verified admission path for executable candidates.
   * submit() remains a metrics-only in-memory ranking API; it does not authorize
   * staging or executing a patch.
   */
  submitVerified(input: unknown, graph: SourceGraph, proof: unknown): AdmissionResult {
    const normalized = normalizeCandidate(input);
    if (!normalized.candidate) return this.reject(normalized.candidateId, normalized.reason ?? 'malformed-candidate');
    const candidateId = normalized.candidate.candidateId;
    const hostTrust = this.patchReceiptTrust;
    if (!hostTrust) return this.reject(candidateId, 'patch-receipt:host-trust-unconfigured');
    if (!isPlainRecord(proof)) return this.reject(candidateId, 'patch-receipt:proof-malformed');
    const patchText = ownData(proof, 'patchText');
    const receipt = ownData(proof, 'receipt') as PatchReceipt | undefined;
    if (typeof patchText !== 'string' || !receipt) {
      return this.reject(candidateId, 'patch-receipt:proof-malformed');
    }

    // The candidate supplies only the bytes to inspect. Expected source revision
    // and accepted public keys are snapshotted from host configuration at pool
    // construction and are never read from this proof object.
    const verification = verifyPatchReceipt(receipt, {
      patchText,
      expectedBaseSha: hostTrust.baseSha,
      expectedTargetFiles: normalized.candidate.targetFiles,
      evolveBlocks: normalized.candidate.evolveBlocks,
      trustedPublicKeys: hostTrust.trustedPublicKeys,
    });
    if (!verification.ok) return this.reject(candidateId, 'patch-receipt:' + verification.reason);
    return this.admit(input, graph, 'signed-patch-receipt', {
      keyId: verification.keyId,
      baseSha: verification.baseSha,
      patchSha256: verification.patchSha256,
    });
  }

  /**
   * Admit a signed patch only when a host-owned P36 authority independently
   * measures the exact receipt-bound patch on authenticated paired holdout seeds.
   * Candidate observations are not even read on this path.
   */
  submitVerifiedOutcome(input: unknown, graph: SourceGraph, proof: unknown): AdmissionResult {
    const normalized = normalizeCandidate(input, { ignoreObservations: true });
    if (!normalized.candidate) return this.reject(normalized.candidateId, normalized.reason ?? 'malformed-candidate');
    const candidate = normalized.candidate;
    const candidateId = candidate.candidateId;
    if (this.byId.has(candidateId)) return this.reject(candidateId, 'duplicate-candidate-id');

    const hostTrust = this.patchReceiptTrust;
    if (!hostTrust) return this.reject(candidateId, 'patch-receipt:host-trust-unconfigured');
    const outcomeAuthority = this.patchOutcomeAuthority;
    if (!outcomeAuthority) return this.reject(candidateId, 'patch-outcome:host-authority-unconfigured');
    if (!isPlainRecord(proof)) return this.reject(candidateId, 'patch-receipt:proof-malformed');
    const patchText = ownData(proof, 'patchText');
    const receipt = ownData(proof, 'receipt') as PatchReceipt | undefined;
    if (typeof patchText !== 'string' || !receipt) return this.reject(candidateId, 'patch-receipt:proof-malformed');

    const verification = verifyPatchReceipt(receipt, {
      patchText,
      expectedBaseSha: hostTrust.baseSha,
      expectedTargetFiles: candidate.targetFiles,
      evolveBlocks: candidate.evolveBlocks,
      trustedPublicKeys: hostTrust.trustedPublicKeys,
    });
    if (!verification.ok) return this.reject(candidateId, 'patch-receipt:' + verification.reason);

    let rawOutcome: P36PatchOutcomeEvidence | null;
    try {
      rawOutcome = outcomeAuthority.measure({
        candidateId,
        baseSha: verification.baseSha,
        patchSha256: verification.patchSha256,
      });
    } catch {
      return this.reject(candidateId, 'patch-outcome:host-authority-failed');
    }
    if (!rawOutcome) return this.reject(candidateId, 'patch-outcome:holdout-evidence-unavailable');
    const outcomeEvidence = normalizePatchOutcomeEvidence(rawOutcome, {
      candidateId,
      baseSha: verification.baseSha,
      patchSha256: verification.patchSha256,
    });
    if (!outcomeEvidence) return this.reject(candidateId, 'patch-outcome:evidence-binding-invalid');
    if (outcomeEvidence.absoluteGain < this.policy.minDownstreamGain) {
      return this.reject(candidateId, 'below-independent-holdout-floor:' + outcomeEvidence.absoluteGain);
    }

    const guard = evaluateModification({ candidateId, targetFiles: candidate.targetFiles }, graph);
    if (guard.decision !== 'allowed') {
      const reason = guard.refusals.map(r => r.reason).join(',') || 'guard-refused';
      return this.reject(candidateId, 'structural:' + reason);
    }

    // P36's independently signed holdout delta is the only downstream signal.
    // Proxy observations are explicitly unmeasured, not copied from candidate claims.
    const danger = assessDanger({
      candidateId,
      targetFiles: candidate.targetFiles,
      rollbackReady: candidate.rollbackReady,
      meanDownstreamGain: outcomeEvidence.absoluteGain,
      meanDivergence: null,
      observationCount: outcomeEvidence.pairedSeedCount,
      protectedHits: guard.protectedHits.length,
    }, graph, this.dangerThresholds);
    if (!isWithinDangerEnvelope(danger, this.dangerThresholds)) {
      return this.reject(candidateId, danger.reason);
    }

    const patchReceipt: VerifiedPatchReceiptSummary = {
      keyId: verification.keyId,
      baseSha: verification.baseSha,
      patchSha256: verification.patchSha256,
    };
    this.byId.set(candidateId, {
      candidate,
      downstreamGain: outcomeEvidence.absoluteGain,
      proxyGain: null,
      divergence: null,
      danger01: danger.score01,
      admissionClass: 'host-verified-holdout-outcome',
      patchReceipt: Object.freeze({ ...patchReceipt }),
      outcomeEvidence,
    });
    this.admittedCount = Math.min(1_000_000_000, this.admittedCount + 1);
    this.evictIfNeeded();
    return {
      accepted: true,
      candidateId,
      reason: 'admitted',
      admissionClass: 'host-verified-holdout-outcome',
      patchReceipt,
      outcomeEvidence,
      guard,
      danger,
    };
  }

  /** Ranking from candidate-supplied observations is metrics-only, never patch authorization. */
  submit(input: unknown, graph: SourceGraph): AdmissionResult {
    return this.admit(input, graph, 'metrics-only');
  }

  private admit(
    input: unknown,
    graph: SourceGraph,
    admissionClass: CandidateAdmissionClass,
    patchReceipt?: VerifiedPatchReceiptSummary,
  ): AdmissionResult {
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
      admissionClass,
      ...(patchReceipt ? { patchReceipt: Object.freeze({ ...patchReceipt }) } : {}),
    });
    this.admittedCount = Math.min(1_000_000_000, this.admittedCount + 1);
    this.evictIfNeeded();
    return {
      accepted: true,
      candidateId,
      reason: 'admitted',
      admissionClass,
      ...(patchReceipt ? { patchReceipt: { ...patchReceipt } } : {}),
      guard,
      divergence,
      danger,
    };
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
      admissionClass: stored.admissionClass,
      ...(stored.patchReceipt ? { patchReceipt: { ...stored.patchReceipt } } : {}),
      ...(stored.outcomeEvidence ? { outcomeEvidence: stored.outcomeEvidence } : {}),
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