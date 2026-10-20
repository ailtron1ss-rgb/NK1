import { createHash, verify as verifySignature } from 'node:crypto';
import type { TaskManifestEntry, VerifiedTaskOutcome } from './VerifiedOutcomeLedger.ts';
import { VerifiedOutcomeLedger } from './VerifiedOutcomeLedger.ts';

export interface SignedOutcomePayload {
  schemaVersion: 1;
  artifactId: string;
  runId: string;
  manifestFingerprint: string;
  taskId: string;
  taskVersion: string;
  method: string;
  seed: number;
  attempt: number;
  passed: boolean;
  verifierId: string;
  observedAt: number;
}

export interface SignedOutcomeArtifact {
  payload: SignedOutcomePayload;
  signature: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',') }]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

export function canonicalOutcomePayload(payload: SignedOutcomePayload): string {
  return canonical(payload);
}

export function outcomePayloadFingerprint(payload: SignedOutcomePayload): string {
  return createHash('sha256').update(canonicalOutcomePayload(payload)).digest('hex');
}

/**
 * Accepts only artifacts signed by an explicitly trusted verifier key and bound
 * to the exact task manifest. The caller must obtain the artifact independently;
 * a valid signature proves key possession, not that the verifier is unbiased.
 */
export function ingestSignedOutcomeArtifact(
  ledger: VerifiedOutcomeLedger,
  manifest: TaskManifestEntry[],
  artifact: SignedOutcomeArtifact,
  trustedVerifierKeys: ReadonlyMap<string, string>,
): { accepted: boolean; artifactFingerprint: string; rejection?: string } {
  const payload = artifact?.payload;
  if (!payload || typeof payload !== 'object' || payload.schemaVersion !== 1) {
    return { accepted: false, artifactFingerprint: '', rejection: 'invalid-artifact-schema' };
  }
  const fingerprint = outcomePayloadFingerprint(payload);
  if (!/^[a-f0-9]{64}$/i.test(payload.manifestFingerprint) ||
      payload.manifestFingerprint !== ledger.manifestFingerprint()) {
    return { accepted: false, artifactFingerprint: fingerprint, rejection: 'manifest-fingerprint-mismatch' };
  }
  if (!payload.artifactId?.trim() || !payload.runId?.trim() ||
      !payload.taskId?.trim() || !payload.taskVersion?.trim() ||
      !payload.method?.trim() || !payload.verifierId?.trim() ||
      !Number.isSafeInteger(payload.seed) || payload.seed < 0 ||
      !Number.isSafeInteger(payload.attempt) || payload.attempt < 1 ||
      typeof payload.passed !== 'boolean' ||
      !Number.isFinite(payload.observedAt) || payload.observedAt <= 0 ||
      typeof artifact.signature !== 'string' || !artifact.signature.trim()) {
    return { accepted: false, artifactFingerprint: fingerprint, rejection: 'invalid-artifact-fields' };
  }
  const task = manifest.find(entry => entry.taskId === payload.taskId);
  if (!task || task.version !== payload.taskVersion || task.verifierId !== payload.verifierId) {
    return { accepted: false, artifactFingerprint: fingerprint, rejection: 'manifest-task-or-verifier-mismatch' };
  }
  const publicKey = trustedVerifierKeys.get(payload.verifierId);
  if (!publicKey) {
    return { accepted: false, artifactFingerprint: fingerprint, rejection: 'untrusted-verifier-key' };
  }
  let signatureValid = false;
  try {
    signatureValid = verifySignature(
      null,
      Buffer.from(canonicalOutcomePayload(payload), 'utf8'),
      publicKey,
      Buffer.from(artifact.signature, 'base64'),
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return { accepted: false, artifactFingerprint: fingerprint, rejection: 'invalid-signature' };

  const outcome: VerifiedTaskOutcome = {
    taskId: payload.taskId,
    taskVersion: payload.taskVersion,
    method: payload.method,
    seed: payload.seed,
    attempt: payload.attempt,
    passed: payload.passed,
    authority: 'independent-verifier',
    verifierId: payload.verifierId,
    evidenceRef: `signed-artifact:${payload.artifactId}:sha256:${fingerprint}`,
    observedAt: payload.observedAt,
  };
  const result = ledger.record(outcome);
  return result.accepted
    ? { accepted: true, artifactFingerprint: fingerprint }
    : { accepted: false, artifactFingerprint: fingerprint, rejection: result.rejection?.code ?? 'ledger-rejected' };
}

/** Helper for producers/tests; production private keys must never live in NK1 runtime. */
export function signOutcomePayloadForFixture(
  payload: SignedOutcomePayload,
  privateKeyPem: string,
): SignedOutcomeArtifact {
  const { sign } = requireCryptoSign();
  return { payload, signature: sign(null, Buffer.from(canonicalOutcomePayload(payload)), privateKeyPem).toString('base64') };
}

function requireCryptoSign(): typeof import('node:crypto') {
  // Static import would also be fine; this indirection keeps the verification API obvious.
  return cryptoModule;
}

import * as cryptoModule from 'node:crypto';
