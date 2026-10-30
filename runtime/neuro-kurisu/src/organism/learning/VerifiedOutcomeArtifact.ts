import { createHash, sign as signSignature, verify as verifySignature } from 'node:crypto';
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

function isNonEmptyString(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }

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

// A provenance receipt is process-local by design. A restored ledger snapshot does
// not inherit trust: its signed artifacts must be re-ingested and re-verified.
const authenticatedEvidence = new WeakMap<VerifiedOutcomeLedger, Map<string, string>>();

export function hasAuthenticatedOutcomeEvidence(ledger: VerifiedOutcomeLedger, evidenceRef: string): boolean {
  return authenticatedEvidence.get(ledger)?.has(evidenceRef) ?? false;
}

export function authenticatedOutcomeEvidenceFingerprint(
  ledger: VerifiedOutcomeLedger,
  evidenceRef: string,
): string | undefined {
  return authenticatedEvidence.get(ledger)?.get(evidenceRef);
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
  // The caller-supplied manifest is part of the trust boundary. Do not validate a
  // signed row against a different task table than the one that defines the ledger.
  // In particular, task split/family/prompt identity must not come from an unbound
  // parallel manifest, even if taskId/version/verifier happen to match.
  let suppliedManifestFingerprint: string;
  try {
    suppliedManifestFingerprint = new VerifiedOutcomeLedger(manifest).manifestFingerprint();
  } catch {
    return { accepted: false, artifactFingerprint: '', rejection: 'invalid-supplied-manifest' };
  }
  if (suppliedManifestFingerprint !== ledger.manifestFingerprint()) {
    return { accepted: false, artifactFingerprint: '', rejection: 'supplied-manifest-mismatch' };
  }

  const payload = artifact?.payload;
  if (!payload || typeof payload !== 'object' || payload.schemaVersion !== 1) {
    return { accepted: false, artifactFingerprint: '', rejection: 'invalid-artifact-schema' };
  }
  const fingerprint = outcomePayloadFingerprint(payload);
  if (!/^[a-f0-9]{64}$/i.test(payload.manifestFingerprint) ||
      payload.manifestFingerprint !== ledger.manifestFingerprint()) {
    return { accepted: false, artifactFingerprint: fingerprint, rejection: 'manifest-fingerprint-mismatch' };
  }
  if (!isNonEmptyString(payload.artifactId) || !isNonEmptyString(payload.runId) ||
      !isNonEmptyString(payload.taskId) || !isNonEmptyString(payload.taskVersion) ||
      !isNonEmptyString(payload.method) || !isNonEmptyString(payload.verifierId) ||
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
  // A restored ledger intentionally has no in-memory trust receipts. Permit the exact
  // signed artifact to re-establish its receipt after restart, but never overwrite or
  // bless a conflicting outcome that happens to occupy the same task/method/seed/attempt.
  const existing = ledger.snapshot().outcomes.find(row =>
    row.taskId === outcome.taskId && row.method === outcome.method &&
    row.seed === outcome.seed && row.attempt === outcome.attempt,
  );
  if (existing) {
    const exactMatch = existing.taskVersion === outcome.taskVersion &&
      existing.passed === outcome.passed && existing.authority === outcome.authority &&
      existing.verifierId === outcome.verifierId && existing.evidenceRef === outcome.evidenceRef &&
      existing.observedAt === outcome.observedAt;
    if (!exactMatch) {
      return { accepted: false, artifactFingerprint: fingerprint, rejection: 'conflicting-existing-outcome' };
    }
    if (authenticatedEvidence.get(ledger)?.has(outcome.evidenceRef)) {
      return { accepted: false, artifactFingerprint: fingerprint, rejection: 'duplicate-attempt' };
    }
  } else {
    const result = ledger.record(outcome);
    if (!result.accepted) {
      return { accepted: false, artifactFingerprint: fingerprint, rejection: result.rejection?.code ?? 'ledger-rejected' };
    }
  }
  const evidence = authenticatedEvidence.get(ledger) ?? new Map<string, string>();
  evidence.set(outcome.evidenceRef, fingerprint);
  authenticatedEvidence.set(ledger, evidence);
  return { accepted: true, artifactFingerprint: fingerprint };
}

/** Helper for producers/tests; production private keys must never live in NK1 runtime. */
export function signOutcomePayloadForFixture(
  payload: SignedOutcomePayload,
  privateKeyPem: string,
): SignedOutcomeArtifact {
  return { payload, signature: signSignature(null, Buffer.from(canonicalOutcomePayload(payload)), privateKeyPem).toString('base64') };
}
