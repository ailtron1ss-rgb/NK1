import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import type { ActiveSkillVersion, SkillPromotionApproval, SkillPromotionApprovalPayload, SkillPromotionApprovalVerificationPurpose, SkillPromotionApprovalVerifier, SkillRollbackApproval, SkillRollbackApprovalPayload, SkillRollbackApprovalVerificationPurpose, SkillRollbackApprovalVerifier, VersionedSkillCandidate } from './VersionedSkillCandidateStore.ts';

export interface AuthenticatedSkillPromotionApprovalOptions {
  maxAgeMs?: number;
  allowedClockSkewMs?: number;
  now?: () => number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const fingerprint = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const safeInteger = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
}

/** Deterministic context digest: a signed approval cannot be replayed after shadow evidence changes. */
export function skillPromotionShadowEvidenceFingerprint(candidate: Readonly<VersionedSkillCandidate>): string {
  const observations = [...candidate.shadowObservations]
    .map(item => ({ runId: item.runId, evidenceFingerprint: item.evidenceFingerprint, passed: item.passed, observedAt: item.observedAt }))
    .sort((a, b) => a.runId.localeCompare(b.runId));
  return createHash('sha256').update(canonical(observations)).digest('hex');
}

/**
 * Canonical payload for an external approval service or hardware-backed reviewer.
 * Sign this UTF-8 JSON with Ed25519 outside the NK1 runtime; never put the private
 * approval key in the application process or its environment.
 */
export function canonicalSkillPromotionApprovalPayload(payload: SkillPromotionApprovalPayload): string {
  return canonical(payload);
}

export function createSkillPromotionApprovalPayload(
  candidate: Readonly<VersionedSkillCandidate>,
  approverId: string,
  approvalId: string,
  approvedAt: number,
  expectedActiveVersion: number | null,
  minShadowRuns = 3,
): SkillPromotionApprovalPayload {
  if (!nonEmpty(approverId) || !nonEmpty(approvalId) || !Number.isFinite(approvedAt) || approvedAt <= 0 ||
      !(expectedActiveVersion === null || safeInteger(expectedActiveVersion, 1, Number.MAX_SAFE_INTEGER)) ||
      !safeInteger(minShadowRuns, 1, 1000)) {
    throw new Error('invalid authenticated skill promotion request identity or guards');
  }
  if (candidate.shadowObservations.some(item => !Number.isFinite(item.observedAt) || item.observedAt > approvedAt)) {
    throw new Error('promotion approval timestamp must not predate any shadow observation');
  }
  return {
    schemaVersion: 1,
    approvalId,
    approverId,
    approvedAt,
    candidateId: candidate.candidateId,
    skillId: candidate.skillId,
    candidateVersion: candidate.version,
    payloadFingerprint: candidate.payloadFingerprint,
    proposalId: candidate.proposalId,
    proposalOutcomeFingerprint: candidate.proposalOutcomeFingerprint,
    expectedActiveVersion,
    minShadowRuns,
    shadowEvidenceFingerprint: skillPromotionShadowEvidenceFingerprint(candidate),
  };
}

/** Load explicit trusted Ed25519 public keys. Missing keys are legal and mean default-deny. */
export function parseTrustedSkillPromotionApprovalKeys(raw: string | undefined): ReadonlyMap<string, string> {
  if (raw === undefined || raw.trim() === '') return new Map();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON must be valid JSON'); }
  if (!isRecord(parsed)) throw new Error('promotion approval keys must be an object keyed by approver ID');
  const keys = new Map<string, string>();
  for (const [approverId, pem] of Object.entries(parsed)) {
    if (!nonEmpty(approverId) || approverId.length > 128 ||
        !/^[A-Za-z0-9][A-Za-z0-9._:@-]*$/.test(approverId) || typeof pem !== 'string') {
      throw new Error('promotion approval key entries must map valid approver IDs to PEM public keys');
    }
    if (keys.size >= 64) throw new Error('promotion approval key set exceeds the 64-key limit');
    let key;
    try { key = createPublicKey(pem); }
    catch { throw new Error('promotion approval keys must be valid Ed25519 public keys'); }
    if (key.asymmetricKeyType !== 'ed25519') {
      throw new Error('promotion approval keys must be valid Ed25519 public keys');
    }
    keys.set(approverId, pem);
  }
  return keys;
}

/**
 * Default-deny verifier for the candidate store. It validates a detached signature,
 * freshness and every decision-critical candidate/evidence field before any promotion
 * can become active. An approval is single-candidate/single-evidence-set/single-CAS.
 */
export function createAuthenticatedSkillPromotionApprovalVerifier(
  trustedKeys: ReadonlyMap<string, string>,
  options: AuthenticatedSkillPromotionApprovalOptions = {},
): SkillPromotionApprovalVerifier {
  const now = options.now ?? Date.now;
  const maxAgeMs = options.maxAgeMs ?? 15 * 60_000;
  const allowedClockSkewMs = options.allowedClockSkewMs ?? 30_000;
  if (!safeInteger(maxAgeMs, 1_000, 24 * 60 * 60_000) ||
      !safeInteger(allowedClockSkewMs, 0, 5 * 60_000)) {
    throw new Error('promotion approval freshness policy is out of bounds');
  }
  return (approval: SkillPromotionApproval, candidate: Readonly<VersionedSkillCandidate>, requestedMinShadowRuns: number, purpose: SkillPromotionApprovalVerificationPurpose = 'promotion'): boolean => {
    try {
      if (trustedKeys.size === 0 || !approval?.artifact || !isRecord(approval.artifact) ||
          !isRecord(approval.artifact.payload) || typeof approval.artifact.signature !== 'string') return false;
      const payload = approval.artifact.payload as SkillPromotionApprovalPayload;
      if (payload.schemaVersion !== 1 || !nonEmpty(payload.approvalId) || !nonEmpty(payload.approverId) ||
          !Number.isFinite(payload.approvedAt) || payload.approvedAt <= 0 ||
          !(payload.expectedActiveVersion === null || safeInteger(payload.expectedActiveVersion, 1, Number.MAX_SAFE_INTEGER)) ||
          !safeInteger(payload.minShadowRuns, 1, 1000) ||
          !fingerprint(payload.candidateId) || !nonEmpty(payload.skillId) ||
          !safeInteger(payload.candidateVersion, 1, Number.MAX_SAFE_INTEGER) ||
          !fingerprint(payload.payloadFingerprint) || !fingerprint(payload.proposalId) ||
          !fingerprint(payload.proposalOutcomeFingerprint) || !fingerprint(payload.shadowEvidenceFingerprint)) return false;
      const keyPem = trustedKeys.get(payload.approverId);
      if (!keyPem) return false;
      if (approval.approvedBy !== payload.approverId || approval.approvedAt !== payload.approvedAt ||
          approval.expectedActiveVersion !== payload.expectedActiveVersion ||
          requestedMinShadowRuns !== payload.minShadowRuns) return false;
      if (payload.candidateId !== candidate.candidateId || payload.skillId !== candidate.skillId ||
          payload.candidateVersion !== candidate.version || payload.payloadFingerprint !== candidate.payloadFingerprint ||
          payload.proposalId !== candidate.proposalId ||
          payload.proposalOutcomeFingerprint !== candidate.proposalOutcomeFingerprint ||
          payload.shadowEvidenceFingerprint !== skillPromotionShadowEvidenceFingerprint(candidate) ||
          candidate.shadowObservations.some(item => item.observedAt > payload.approvedAt)) return false;
      const timestamp = now();
      if (!Number.isFinite(timestamp) || payload.approvedAt > timestamp + allowedClockSkewMs) return false;
      // A new activation needs a recent approval. Existing active skills are
      // re-verified across restart without expiring just because 15 minutes passed.
      if (purpose === 'promotion' && timestamp - payload.approvedAt > maxAgeMs) return false;
      const key = createPublicKey(keyPem);
      if (key.asymmetricKeyType !== 'ed25519') return false;
      // Pass the validated PEM through the minimal Node shim's supported verify() overload.
      return verifySignature(null, Buffer.from(canonicalSkillPromotionApprovalPayload(payload), 'utf8'), keyPem,
        Buffer.from(approval.artifact.signature, 'base64'));
    } catch {
      return false;
    }
  };
}


/** Bind a rollback signature to the exact previous active payload, not merely its version number. */
export function skillRollbackPreviousActiveFingerprint(previousActive: Readonly<ActiveSkillVersion> | null): string {
  return createHash('sha256').update(canonical(previousActive)).digest('hex');
}

export function canonicalSkillRollbackApprovalPayload(payload: SkillRollbackApprovalPayload): string {
  return canonical(payload);
}

/** Request payload for an external, authenticated rollback approver. */
export function createSkillRollbackApprovalPayload(
  candidate: Readonly<VersionedSkillCandidate>,
  approverId: string,
  approvalId: string,
  approvedAt: number,
): SkillRollbackApprovalPayload {
  if (candidate.status !== 'active' || !nonEmpty(approverId) || !nonEmpty(approvalId) ||
      !Number.isFinite(approvedAt) || approvedAt <= 0 ||
      candidate.shadowObservations.some(item => !Number.isFinite(item.observedAt) || item.observedAt > approvedAt)) {
    throw new Error('rollback approval request requires an active candidate and a current timestamp after its shadow evidence');
  }
  const restoreTarget = candidate.previousActive;
  return {
    schemaVersion: 1,
    approvalId,
    approverId,
    approvedAt,
    candidateId: candidate.candidateId,
    skillId: candidate.skillId,
    candidateVersion: candidate.version,
    payloadFingerprint: candidate.payloadFingerprint,
    proposalId: candidate.proposalId,
    expectedActiveVersion: candidate.version,
    restoredVersion: restoreTarget?.version ?? null,
    restoredPayloadFingerprint: restoreTarget?.payloadFingerprint ?? null,
    restoredProposalId: restoreTarget?.proposalId ?? null,
    previousActiveFingerprint: skillRollbackPreviousActiveFingerprint(restoreTarget),
    shadowEvidenceFingerprint: skillPromotionShadowEvidenceFingerprint(candidate),
  };
}

export function createAuthenticatedSkillRollbackApprovalVerifier(
  trustedKeys: ReadonlyMap<string, string>,
  options: AuthenticatedSkillPromotionApprovalOptions = {},
): SkillRollbackApprovalVerifier {
  const now = options.now ?? Date.now;
  const maxAgeMs = options.maxAgeMs ?? 15 * 60_000;
  const allowedClockSkewMs = options.allowedClockSkewMs ?? 30_000;
  if (!safeInteger(maxAgeMs, 1_000, 24 * 60 * 60_000) ||
      !safeInteger(allowedClockSkewMs, 0, 5 * 60_000)) {
    throw new Error('rollback approval freshness policy is out of bounds');
  }
  return (
    approval: SkillRollbackApproval,
    candidate: Readonly<VersionedSkillCandidate>,
    restoreTarget: Readonly<ActiveSkillVersion> | null,
    purpose: SkillRollbackApprovalVerificationPurpose = 'rollback',
  ): boolean => {
    try {
      if (trustedKeys.size === 0 || !approval?.artifact || !isRecord(approval.artifact) ||
          !isRecord(approval.artifact.payload) || typeof approval.artifact.signature !== 'string') return false;
      const payload = approval.artifact.payload as SkillRollbackApprovalPayload;
      if (payload.schemaVersion !== 1 || !nonEmpty(payload.approvalId) || !nonEmpty(payload.approverId) ||
          !Number.isFinite(payload.approvedAt) || payload.approvedAt <= 0 ||
          !fingerprint(payload.candidateId) || !nonEmpty(payload.skillId) ||
          !safeInteger(payload.candidateVersion, 1, Number.MAX_SAFE_INTEGER) ||
          !fingerprint(payload.payloadFingerprint) || !fingerprint(payload.proposalId) ||
          !safeInteger(payload.expectedActiveVersion, 1, Number.MAX_SAFE_INTEGER) ||
          !(payload.restoredVersion === null || safeInteger(payload.restoredVersion, 1, Number.MAX_SAFE_INTEGER)) ||
          !(payload.restoredPayloadFingerprint === null || fingerprint(payload.restoredPayloadFingerprint)) ||
          !(payload.restoredProposalId === null || fingerprint(payload.restoredProposalId)) ||
          !fingerprint(payload.previousActiveFingerprint) || !fingerprint(payload.shadowEvidenceFingerprint)) return false;
      if ((payload.restoredVersion === null) !== (payload.restoredPayloadFingerprint === null) ||
          (payload.restoredVersion === null) !== (payload.restoredProposalId === null)) return false;
      const keyPem = trustedKeys.get(payload.approverId);
      if (!keyPem) return false;
      if (approval.approvedBy !== payload.approverId || approval.approvedAt !== payload.approvedAt ||
          approval.expectedActiveVersion !== payload.expectedActiveVersion) return false;
      if (candidate.status !== 'active' && purpose === 'rollback') return false;
      if (payload.candidateId !== candidate.candidateId || payload.skillId !== candidate.skillId ||
          payload.candidateVersion !== candidate.version || payload.payloadFingerprint !== candidate.payloadFingerprint ||
          payload.proposalId !== candidate.proposalId || payload.expectedActiveVersion !== candidate.version ||
          payload.restoredVersion !== (restoreTarget?.version ?? null) ||
          payload.restoredPayloadFingerprint !== (restoreTarget?.payloadFingerprint ?? null) ||
          payload.restoredProposalId !== (restoreTarget?.proposalId ?? null) ||
          payload.previousActiveFingerprint !== skillRollbackPreviousActiveFingerprint(restoreTarget) ||
          payload.shadowEvidenceFingerprint !== skillPromotionShadowEvidenceFingerprint(candidate) ||
          candidate.shadowObservations.some(item => item.observedAt > payload.approvedAt)) return false;
      const timestamp = now();
      if (!Number.isFinite(timestamp) || payload.approvedAt > timestamp + allowedClockSkewMs) return false;
      if (purpose === 'rollback' && timestamp - payload.approvedAt > maxAgeMs) return false;
      const key = createPublicKey(keyPem);
      if (key.asymmetricKeyType !== 'ed25519') return false;
      // Keep runtime key-type validation while using the supported PEM verifier input.
      return verifySignature(null, Buffer.from(canonicalSkillRollbackApprovalPayload(payload), 'utf8'),
        keyPem, Buffer.from(approval.artifact.signature, 'base64'));
    } catch {
      return false;
    }
  };
}
