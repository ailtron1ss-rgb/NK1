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

const SIGNED_OUTCOME_PAYLOAD_KEYS = [
  'schemaVersion', 'artifactId', 'runId', 'manifestFingerprint', 'taskId', 'taskVersion',
  'method', 'seed', 'attempt', 'passed', 'verifierId', 'observedAt',
] as const;
const SIGNED_OUTCOME_ARTIFACT_KEYS = ['payload', 'signature'] as const;

/**
 * Snapshot only an exact plain data record. Reading descriptors rather than
 * properties prevents untrusted getters from running during evidence verification.
 * All proxy traps are treated as malformed input.
 */
function snapshotPlainDataRecord(value: unknown, expectedKeys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    const expected = new Set(expectedKeys);
    if (ownKeys.length !== expectedKeys.length ||
        ownKeys.some(key => typeof key !== 'string' || !expected.has(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || descriptor.enumerable !== true || !('value' in descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    return null;
  }
}

/** Ed25519 signatures must use one canonical Base64 spelling for exactly 64 bytes. */
function decodeCanonicalEd25519Signature(value: unknown): Buffer | null {
  if (typeof value !== 'string' || value.length !== 88 || !/^[A-Za-z0-9+/]{86}==$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === 64 && decoded.toString('base64') === value ? decoded : null;
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

  const artifactRecord = snapshotPlainDataRecord(artifact, SIGNED_OUTCOME_ARTIFACT_KEYS);
  if (!artifactRecord || typeof artifactRecord.signature !== 'string') {
    return { accepted: false, artifactFingerprint: '', rejection: 'invalid-artifact-schema' };
  }
  const payloadRecord = snapshotPlainDataRecord(artifactRecord.payload, SIGNED_OUTCOME_PAYLOAD_KEYS);
  if (!payloadRecord || payloadRecord.schemaVersion !== 1) {
    return { accepted: false, artifactFingerprint: '', rejection: 'invalid-artifact-schema' };
  }
  // Continue only with the descriptor-backed snapshot, never the caller's mutable object.
  const payload = payloadRecord as unknown as SignedOutcomePayload;
  const signature = artifactRecord.signature;
  if (typeof payload.manifestFingerprint !== 'string' ||
      !isNonEmptyString(payload.artifactId) || !isNonEmptyString(payload.runId) ||
      !isNonEmptyString(payload.taskId) || !isNonEmptyString(payload.taskVersion) ||
      !isNonEmptyString(payload.method) || !isNonEmptyString(payload.verifierId) ||
      !Number.isSafeInteger(payload.seed) || payload.seed < 0 ||
      !Number.isSafeInteger(payload.attempt) || payload.attempt < 1 ||
      typeof payload.passed !== 'boolean' ||
      typeof payload.observedAt !== 'number' || !Number.isFinite(payload.observedAt) || payload.observedAt <= 0) {
    return { accepted: false, artifactFingerprint: '', rejection: 'invalid-artifact-fields' };
  }
  const fingerprint = outcomePayloadFingerprint(payload);
  if (!/^[a-f0-9]{64}$/i.test(payload.manifestFingerprint) ||
      payload.manifestFingerprint !== ledger.manifestFingerprint()) {
    return { accepted: false, artifactFingerprint: fingerprint, rejection: 'manifest-fingerprint-mismatch' };
  }
  const signatureBytes = decodeCanonicalEd25519Signature(signature);
  if (!signatureBytes) {
    return { accepted: false, artifactFingerprint: fingerprint, rejection: 'invalid-signature-encoding' };
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
      signatureBytes,
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
