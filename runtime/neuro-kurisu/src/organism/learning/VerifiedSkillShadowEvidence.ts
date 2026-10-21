import { createHash, sign as signSignature, verify as verifySignature } from 'node:crypto';
import type { SkillShadowObservation, VersionedSkillCandidate } from './VersionedSkillCandidateStore.ts';

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
