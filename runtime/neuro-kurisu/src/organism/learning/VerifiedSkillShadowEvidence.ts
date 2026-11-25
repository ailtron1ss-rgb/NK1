import { createHash, sign as signSignature, verify as verifySignature } from 'node:crypto';
import type { SkillShadowEvidenceVerificationPurpose, SkillShadowObservation, VersionedSkillCandidate } from './VersionedSkillCandidateStore.ts';

export interface SignedSkillShadowPayload {
  schemaVersion: 1;
  artifactId: string;
  candidateId: string;
  skillId: string;
  candidateVersion: number;
  payloadFingerprint: string;
  proposalOutcomeFingerprint: string;
  runId: string;
  taskId: string;
  manifestFingerprint: string;
  seed: number;
  runtimeVersion: string;
  passed: boolean;
  observedAt: number;
  verifierId: string;
}

export interface SignedSkillShadowArtifact {
  payload: SignedSkillShadowPayload;
  signature: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',') }]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

export function skillShadowPayloadFingerprint(payload: SignedSkillShadowPayload): string {
  return createHash('sha256').update(canonical(payload)).digest('hex');
}

/** Test/fixture producer only. Production signing keys must stay outside the NK1 runtime. */
export function signSkillShadowArtifactForFixture(
  payload: SignedSkillShadowPayload,
  privateKeyPem: string,
): SignedSkillShadowArtifact {
  return {
    payload,
    signature: signSignature(null, Buffer.from(canonical(payload), 'utf8'), privateKeyPem).toString('base64'),
  };
}

/**
 * Verify a signed shadow execution receipt against the exact candidate version.
 * A valid signature proves trusted-key possession, not verifier independence or quality.
 */
export function verifySignedSkillShadowObservation(
  observation: Readonly<SkillShadowObservation>,
  candidate: Readonly<VersionedSkillCandidate>,
  trustedVerifierKeys: ReadonlyMap<string, string>,
): boolean {
  const artifact = observation?.artifact;
  const payload = artifact?.payload;
  if (!payload || payload.schemaVersion !== 1 || typeof artifact.signature !== 'string' || !artifact.signature.trim()) return false;
  if (!payload.artifactId?.trim() || !payload.runId?.trim() || !payload.taskId?.trim() ||
      !payload.runtimeVersion?.trim() || !payload.verifierId?.trim() ||
      !Number.isSafeInteger(payload.candidateVersion) || !Number.isSafeInteger(payload.seed) || payload.seed < 0 ||
      !Number.isFinite(payload.observedAt) || payload.observedAt <= 0 || typeof payload.passed !== 'boolean') return false;
  if (!/^[a-f0-9]{64}$/.test(payload.payloadFingerprint) ||
      !/^[a-f0-9]{64}$/.test(payload.proposalOutcomeFingerprint) ||
      !/^[a-f0-9]{64}$/.test(payload.manifestFingerprint)) return false;
  if (payload.candidateId !== candidate.candidateId || payload.skillId !== candidate.skillId ||
      payload.candidateVersion !== candidate.version || payload.payloadFingerprint !== candidate.payloadFingerprint ||
      payload.proposalOutcomeFingerprint !== candidate.proposalOutcomeFingerprint) return false;
  const fingerprint = skillShadowPayloadFingerprint(payload);
  if (observation.runId !== payload.runId || observation.evidenceFingerprint !== fingerprint ||
      observation.passed !== payload.passed || observation.observedAt !== payload.observedAt) return false;
  const publicKey = trustedVerifierKeys.get(payload.verifierId);
  if (!publicKey) return false;
  try {
    return verifySignature(null, Buffer.from(canonical(payload), 'utf8'), publicKey, Buffer.from(artifact.signature, 'base64'));
  } catch {
    return false;
  }
}

export interface TrustedShadowExecutionContext {
  /** Values must come from the trusted run ledger/supervisor, not the signed receipt. */
  runId: string;
  taskId: string;
  seed: number;
  manifestFingerprint: string;
  runtimeVersion: string;
}

/**
 * Bind a cryptographically valid receipt to independently supplied execution
 * context. The resolver must read trusted run records/configuration, never fields
 * copied from the receipt itself. Missing context fails closed.
 */
export interface SkillShadowEvidenceFreshnessPolicy {
  /** Maximum age for evidence entering or promoting a candidate. */
  maxAgeMs?: number;
  /** Small allowance for clock skew between the supervisor and verifier. */
  maxFutureSkewMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

const DEFAULT_SHADOW_EVIDENCE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_SHADOW_EVIDENCE_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

/**
 * Bind a cryptographically valid receipt to independently supplied execution
 * context and enforce a freshness window when the evidence enters the lifecycle.
 * Persisted active skills retain signature/context verification without expiring
 * solely because their original promotion receipt naturally aged.
 */
export function createContextBoundSkillShadowEvidenceVerifier(
  trustedVerifierKeys: ReadonlyMap<string, string>,
  resolveTrustedContext: (
    observation: Readonly<SkillShadowObservation>,
    candidate: Readonly<VersionedSkillCandidate>,
  ) => TrustedShadowExecutionContext | null,
  freshness: SkillShadowEvidenceFreshnessPolicy = {},
): (observation: Readonly<SkillShadowObservation>, candidate: Readonly<VersionedSkillCandidate>, purpose?: SkillShadowEvidenceVerificationPurpose) => boolean {
  const maxAgeMs = freshness.maxAgeMs ?? DEFAULT_SHADOW_EVIDENCE_MAX_AGE_MS;
  const maxFutureSkewMs = freshness.maxFutureSkewMs ?? DEFAULT_SHADOW_EVIDENCE_MAX_FUTURE_SKEW_MS;
  const now = freshness.now ?? Date.now;
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || maxAgeMs > 365 * 24 * 60 * 60 * 1000 ||
      !Number.isFinite(maxFutureSkewMs) || maxFutureSkewMs < 0 || maxFutureSkewMs > 24 * 60 * 60 * 1000 ||
      typeof now !== 'function') {
    throw new Error('invalid skill shadow evidence freshness policy');
  }
  return (observation, candidate, purpose = 'record') => {
    if (!verifySignedSkillShadowObservation(observation, candidate, trustedVerifierKeys)) return false;
    let context: TrustedShadowExecutionContext | null;
    try { context = resolveTrustedContext(observation, candidate); }
    catch { return false; }
    if (!context || typeof context.runId !== 'string' || !context.runId.trim() ||
        typeof context.taskId !== 'string' || !context.taskId.trim() ||
        !Number.isSafeInteger(context.seed) || context.seed < 0 ||
        typeof context.manifestFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(context.manifestFingerprint) ||
        typeof context.runtimeVersion !== 'string' || !context.runtimeVersion.trim()) return false;
    const payload = observation.artifact!.payload;
    if (payload.runId !== context.runId || payload.taskId !== context.taskId ||
        payload.seed !== context.seed || payload.manifestFingerprint !== context.manifestFingerprint ||
        payload.runtimeVersion !== context.runtimeVersion) return false;
    let nowMs: number;
    try { nowMs = now(); } catch { return false; }
    // Future timestamps are suspicious for every lifecycle state. Only age expiry
    // is exempted for already-active skills; a signed receipt from the future is
    // never accepted as historical evidence.
    if (!Number.isFinite(nowMs) || payload.observedAt > nowMs + maxFutureSkewMs) return false;
    if (purpose !== 'persisted-active' && nowMs - payload.observedAt > maxAgeMs) return false;
    return true;
  };
}
