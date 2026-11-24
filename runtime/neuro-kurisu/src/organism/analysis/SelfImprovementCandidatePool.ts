import { createHash, createPublicKey } from 'node:crypto';
/**
 * Bounded self-improvement candidate admission.
 * All candidate input is treated as untrusted data: only own data properties on
 * plain records and dense arrays are accepted, and an immutable normalized copy
 * is retained so callers cannot mutate a candidate after admission.
 */
import { buildSourceGraph, type SourceFileInput, type SourceGraph } from './SourceGraph.ts';
import { verifySignedPairedHoldoutEvidence } from './PairedSelfImprovementEvidence.ts';
import { evaluateModification, type GuardResult } from './SelfModificationGuard.ts';
import { evaluateProxyDivergence, type DivergenceResult, type PairedObservation } from './ProxyDivergenceGuard.ts';
import { assessDanger, isWithinDangerEnvelope, DEFAULT_DANGER_THRESHOLDS, type DangerAssessment, type DangerThresholds } from './DangerModel.ts';
import { verifyPatchReceipt, type PatchReceipt } from './PatchReceiptGuard.ts';

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
  /** Exact Git commit SHA from the trusted host checkout. */
  baseSha: string;
  /** SHA-256 of the complete canonical source-file snapshot at baseSha. */
  sourceSnapshotSha256: string;
  /** Ed25519 public keys that sign exact patch receipts. */
  trustedPublicKeys: Readonly<Record<string, string>>;
  /** Separate host-owned evaluator keys that sign paired holdout outcomes. */
  trustedOutcomePublicKeys: Readonly<Record<string, string>>;
}
export interface PairedOutcomeEvidenceSummary {
  pairs: number;
  verifierCount: number;
  environmentCount: number;
  fingerprint: string;
  experimentId: string;
  protocolFingerprint: string;
  taskManifestFingerprint: string;
  testFingerprint: string;
}

export const DEFAULT_POOL_POLICY: CandidatePoolPolicy = Object.freeze({ maxPoolSize: 32, minDownstreamGain: 0 });
export type CandidateAdmissionClass = 'metrics-only' | 'signed-patch-receipt';
export interface VerifiedPatchReceiptSummary { keyId: string; baseSha: string; patchSha256: string; }
export interface AdmissionResult {
  accepted: boolean;
  candidateId: string;
  reason: string;
  admissionClass?: CandidateAdmissionClass;
  patchReceipt?: VerifiedPatchReceiptSummary;
  pairedOutcomeEvidence?: PairedOutcomeEvidenceSummary;
  guard?: GuardResult;
  divergence?: DivergenceResult;
  danger?: DangerAssessment;
}
export interface RankedCandidate {
  candidateId: string;
  downstreamGain: number;
  proxyGain: number;
  divergence: number;
  danger01: number;
  admissionClass: CandidateAdmissionClass;
  patchReceipt?: VerifiedPatchReceiptSummary;
  pairedOutcomeEvidence?: PairedOutcomeEvidenceSummary;
  parentId?: string;
}
interface StoredCandidate {
  candidate: Readonly<SelfImprovementCandidate>;
  downstreamGain: number;
  proxyGain: number;
  divergence: number;
  danger01: number;
  admissionClass: CandidateAdmissionClass;
  patchReceipt?: VerifiedPatchReceiptSummary;
  pairedOutcomeEvidence?: PairedOutcomeEvidenceSummary;
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
function normalizeCandidate(input: unknown, includeCandidateObservations = true): { candidateId: string; candidate?: Readonly<SelfImprovementCandidate>; reason?: string } {
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

  const observations: PairedObservation[] = [];
  if (includeCandidateObservations) {
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
function publicKeyFingerprint(pem: string): string {
  const key = createPublicKey(pem);
  return createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
}

function normalizeEd25519KeyMap(raw: unknown, refuse: () => never): Readonly<Record<string, string>> {
  if (!isPlainRecord(raw)) return refuse();
  let keyIds: string[];
  try { keyIds = Object.keys(raw); } catch { return refuse(); }
  if (keyIds.length < 1 || keyIds.length > 64) return refuse();
  const keys: Record<string, string> = Object.create(null);
  const fingerprints = new Set<string>();
  for (const keyId of keyIds) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(keyId) || hasAccessor(raw, keyId)) return refuse();
    const pem = ownData(raw, keyId);
    if (typeof pem !== 'string' || pem.length < 64 || pem.length > 8192 || !pem.includes('BEGIN PUBLIC KEY')) return refuse();
    try {
      if (createPublicKey(pem).asymmetricKeyType !== 'ed25519') return refuse();
      const fingerprint = publicKeyFingerprint(pem);
      if (fingerprints.has(fingerprint)) return refuse();
      fingerprints.add(fingerprint);
    } catch {
      return refuse();
    }
    keys[keyId] = pem;
  }
  return Object.freeze(keys);
}

function normalizePatchReceiptTrust(input: unknown): Readonly<HostOwnedPatchReceiptTrust> {
  const refuse = (): never => { throw new RangeError('candidate-pool-patch-receipt-trust-invalid'); };
  if (!isPlainRecord(input) || hasAccessor(input, 'baseSha') ||
      hasAccessor(input, 'sourceSnapshotSha256') || hasAccessor(input, 'trustedPublicKeys') ||
      hasAccessor(input, 'trustedOutcomePublicKeys')) return refuse();
  const baseSha = ownData(input, 'baseSha');
  const sourceSnapshotSha256 = ownData(input, 'sourceSnapshotSha256');
  if (typeof baseSha !== 'string' || !/^[a-f0-9]{40}$/i.test(baseSha) ||
      typeof sourceSnapshotSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sourceSnapshotSha256)) return refuse();
  const trustedPublicKeys = normalizeEd25519KeyMap(ownData(input, 'trustedPublicKeys'), refuse);
  const trustedOutcomePublicKeys = normalizeEd25519KeyMap(ownData(input, 'trustedOutcomePublicKeys'), refuse);
  const patchKeyFingerprints = new Set(Object.values(trustedPublicKeys).map(publicKeyFingerprint));
  if (Object.values(trustedOutcomePublicKeys).some(pem => patchKeyFingerprints.has(publicKeyFingerprint(pem)))) return refuse();
  return Object.freeze({
    baseSha: baseSha.toLowerCase(),
    sourceSnapshotSha256: sourceSnapshotSha256.toLowerCase(),
    trustedPublicKeys,
    trustedOutcomePublicKeys,
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
  private admittedCount = 0;
  private rejectedCount = 0;

  constructor(
    policy: Partial<CandidatePoolPolicy> = {},
    dangerThresholds: DangerThresholds = DEFAULT_DANGER_THRESHOLDS,
    hostPatchReceiptTrust?: unknown,
  ) {
    this.policy = normalizePolicy(policy);
    this.dangerThresholds = Object.freeze({
      maxDanger01: clamp01(Number(dangerThresholds?.maxDanger01 ?? DEFAULT_DANGER_THRESHOLDS.maxDanger01)),
      maxBlastRadius01: clamp01(Number(dangerThresholds?.maxBlastRadius01 ?? DEFAULT_DANGER_THRESHOLDS.maxBlastRadius01)),
    });
    this.patchReceiptTrust = hostPatchReceiptTrust === undefined ? null : normalizePatchReceiptTrust(hostPatchReceiptTrust);
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
   * Low-level verified admission. The capability token is module-private and is
   * only held by SelfImprovementPatchAdmissionService after source-snapshot checks.
   */
  submitVerifiedFromHost(input: unknown, graph: SourceGraph, proof: unknown, capability: symbol): AdmissionResult {
    const normalized = normalizeCandidate(input, false);
    if (!normalized.candidate) return this.reject(normalized.candidateId, normalized.reason ?? 'malformed-candidate');
    const candidate = normalized.candidate;
    const candidateId = candidate.candidateId;
    if (capability !== HOST_ADMISSION_CAPABILITY) {
      return this.reject(candidateId, 'patch-receipt:host-admission-service-required');
    }
    const hostTrust = this.patchReceiptTrust;
    if (!hostTrust) return this.reject(candidateId, 'patch-receipt:host-trust-unconfigured');
    if (!isPlainRecord(proof)) return this.reject(candidateId, 'patch-receipt:proof-malformed');
    const patchText = ownData(proof, 'patchText');
    const receipt = ownData(proof, 'receipt') as PatchReceipt | undefined;
    const rawPairedOutcomes = ownData(proof, 'pairedOutcomes');
    if (typeof patchText !== 'string' || !receipt) {
      return this.reject(candidateId, 'patch-receipt:proof-malformed');
    }

    // The candidate supplies patch bytes and signed artifacts only. Source SHA,
    // source graph, patch signer keys and evaluator keys are pinned by the host.
    const verification = verifyPatchReceipt(receipt, {
      patchText,
      expectedBaseSha: hostTrust.baseSha,
      expectedTargetFiles: candidate.targetFiles,
      evolveBlocks: candidate.evolveBlocks,
      trustedPublicKeys: hostTrust.trustedPublicKeys,
    });
    if (!verification.ok) return this.reject(candidateId, 'patch-receipt:' + verification.reason);

    const pairedEvidence = verifySignedPairedHoldoutEvidence(
      rawPairedOutcomes,
      candidateId,
      verification.patchSha256,
      hostTrust.trustedOutcomePublicKeys,
    );
    if (!pairedEvidence.accepted) {
      return this.reject(candidateId, 'paired-outcome:' + pairedEvidence.reason);
    }

    // Candidate-supplied observations were never read. Only host-signed holdout
    // rows are carried into the divergence and danger evaluators.
    const evidenceBoundCandidate: SelfImprovementCandidate = {
      candidateId,
      targetFiles: [...candidate.targetFiles],
      evolveBlocks: candidate.evolveBlocks.map(block => ({ ...block })),
      observations: pairedEvidence.observations,
      rollbackReady: true,
      ...(candidate.parentId ? { parentId: candidate.parentId } : {}),
    };
    return this.admit(evidenceBoundCandidate, graph, 'signed-patch-receipt', {
      keyId: verification.keyId,
      baseSha: verification.baseSha,
      patchSha256: verification.patchSha256,
    }, {
      pairs: pairedEvidence.pairs,
      verifierCount: pairedEvidence.verifierCount,
      environmentCount: pairedEvidence.environmentCount,
      fingerprint: pairedEvidence.fingerprint,
      experimentId: pairedEvidence.experimentId,
      protocolFingerprint: pairedEvidence.protocolFingerprint,
      taskManifestFingerprint: pairedEvidence.taskManifestFingerprint,
      testFingerprint: pairedEvidence.testFingerprint,
    });
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
    pairedOutcomeEvidence?: PairedOutcomeEvidenceSummary,
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
      ...(pairedOutcomeEvidence ? { pairedOutcomeEvidence: Object.freeze({ ...pairedOutcomeEvidence }) } : {}),
    });
    this.admittedCount = Math.min(1_000_000_000, this.admittedCount + 1);
    this.evictIfNeeded();
    return {
      accepted: true,
      candidateId,
      reason: 'admitted',
      admissionClass,
      ...(patchReceipt ? { patchReceipt: { ...patchReceipt } } : {}),
      ...(pairedOutcomeEvidence ? { pairedOutcomeEvidence: { ...pairedOutcomeEvidence } } : {}),
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
      ...(stored.pairedOutcomeEvidence ? { pairedOutcomeEvidence: { ...stored.pairedOutcomeEvidence } } : {}),
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
const HOST_ADMISSION_CAPABILITY = Symbol('host-owned-self-improvement-admission');

export interface HostSourceSnapshot {
  baseSha: string;
  files: readonly SourceFileInput[];
}

export interface SelfImprovementPatchAdmissionConfig {
  sourceSnapshot: HostSourceSnapshot;
  hostTrust: HostOwnedPatchReceiptTrust;
  policy?: Partial<CandidatePoolPolicy>;
  dangerThresholds?: DangerThresholds;
}

const MAX_SOURCE_FILES = 25_000;
const MAX_SOURCE_FILE_BYTES = 8 * 1024 * 1024;
const MAX_SOURCE_SNAPSHOT_BYTES = 256 * 1024 * 1024;

function normalizeHostSourceFiles(raw: unknown): SourceFileInput[] {
  const rows = denseArray(raw, MAX_SOURCE_FILES);
  if (!rows || rows.length === 0) throw new RangeError('host-source-snapshot-files-invalid');
  const seen = new Set<string>();
  const files: SourceFileInput[] = [];
  let totalBytes = 0;
  for (const row of rows) {
    if (!isPlainRecord(row) || hasAccessor(row, 'path') || hasAccessor(row, 'text')) {
      throw new RangeError('host-source-snapshot-file-invalid');
    }
    const path = ownData(row, 'path');
    const text = ownData(row, 'text');
    if (!validRepoPath(path) || typeof text !== 'string' || seen.has(path)) {
      throw new RangeError('host-source-snapshot-file-invalid');
    }
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_SOURCE_FILE_BYTES) throw new RangeError('host-source-snapshot-file-too-large');
    totalBytes += bytes;
    if (totalBytes > MAX_SOURCE_SNAPSHOT_BYTES) throw new RangeError('host-source-snapshot-too-large');
    seen.add(path);
    files.push({ path, text });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** Canonical digest over every file path and exact UTF-8 content in the host inventory. */
export function computeSourceSnapshotSha256(files: readonly SourceFileInput[]): string {
  const normalized = normalizeHostSourceFiles(files);
  const rows = normalized.map(file => ({
    path: file.path,
    bytes: Buffer.byteLength(file.text, 'utf8'),
    contentSha256: createHash('sha256').update(file.text, 'utf8').digest('hex'),
  }));
  return createHash('sha256').update(JSON.stringify(rows), 'utf8').digest('hex');
}

/**
 * Host-side admission boundary for code patches. It builds the structural source
 * graph once from a complete host snapshot, pins the exact base SHA and public
 * verification keys, and never exposes the graph or candidate pool to the model.
 *
 * This is a preflight/admission service only: it does not write files, execute
 * patches, merge branches or publish releases.
 */
export class SelfImprovementPatchAdmissionService {
  readonly #pool: SelfImprovementCandidatePool;
  readonly #graph: SourceGraph;
  readonly #baseSha: string;
  readonly #sourceSnapshotSha256: string;
  readonly #sourceFileCount: number;

  constructor(config: SelfImprovementPatchAdmissionConfig) {
    if (!isPlainRecord(config) || hasAccessor(config, 'sourceSnapshot') || hasAccessor(config, 'hostTrust')) {
      throw new RangeError('self-improvement-admission-config-invalid');
    }
    const rawSnapshot = ownData(config, 'sourceSnapshot');
    const rawTrust = ownData(config, 'hostTrust');
    if (!isPlainRecord(rawSnapshot) || hasAccessor(rawSnapshot, 'baseSha') || hasAccessor(rawSnapshot, 'files')) {
      throw new RangeError('host-source-snapshot-invalid');
    }
    const snapshotBaseSha = ownData(rawSnapshot, 'baseSha');
    if (typeof snapshotBaseSha !== 'string' || !/^[a-f0-9]{40}$/i.test(snapshotBaseSha)) {
      throw new RangeError('host-source-snapshot-base-sha-invalid');
    }
    const files = normalizeHostSourceFiles(ownData(rawSnapshot, 'files'));
    const hostTrust = normalizePatchReceiptTrust(rawTrust);
    if (snapshotBaseSha.toLowerCase() !== hostTrust.baseSha) {
      throw new RangeError('host-source-snapshot-base-sha-mismatch');
    }
    const snapshotSha256 = computeSourceSnapshotSha256(files);
    if (snapshotSha256 !== hostTrust.sourceSnapshotSha256) {
      throw new RangeError('host-source-snapshot-digest-mismatch');
    }
    this.#graph = buildSourceGraph(files);
    this.#baseSha = hostTrust.baseSha;
    this.#sourceSnapshotSha256 = snapshotSha256;
    this.#sourceFileCount = files.length;
    this.#pool = new SelfImprovementCandidatePool(
      ownData(config, 'policy') as Partial<CandidatePoolPolicy> | undefined,
      ownData(config, 'dangerThresholds') as DangerThresholds | undefined,
      hostTrust,
    );
  }

  /** Metrics-only observations can rank candidates but never create patch admission. */
  submitMetricsOnly(candidate: unknown): AdmissionResult {
    return this.#pool.submit(candidate, this.#graph);
  }

  /** Requires a host-signed patch receipt and independently signed holdout pairs. */
  admitVerifiedPatch(candidate: unknown, proof: unknown): AdmissionResult {
    return this.#pool.submitVerifiedFromHost(candidate, this.#graph, proof, HOST_ADMISSION_CAPABILITY);
  }

  rank(): RankedCandidate[] {
    return this.#pool.rank();
  }

  diagnostics() {
    return {
      mode: 'host-verified-preflight' as const,
      baseSha: this.#baseSha,
      sourceSnapshotSha256: this.#sourceSnapshotSha256,
      sourceFileCount: this.#sourceFileCount,
      pool: this.#pool.snapshot(),
    };
  }
}
