import { createHash, verify as verifySignature } from 'node:crypto';
import type { PairedObservation } from './ProxyDivergenceGuard.ts';

export interface SignedPairedHoldoutPayload {
  schemaVersion: 1;
  candidateId: string;
  patchSha256: string;
  evidenceId: string;
  seed: number;
  split: 'holdout';
  verifierId: string;
  environmentId: string;
  proxyGain: number;
  downstreamGain: number;
  observedAt: number;
}

export interface SignedPairedHoldoutArtifact {
  payload: SignedPairedHoldoutPayload;
  signature: string;
}

export interface VerifiedPairedHoldoutBatch {
  accepted: true;
  observations: PairedObservation[];
  pairs: number;
  verifierCount: number;
  environmentCount: number;
  fingerprint: string;
}

export interface RefusedPairedHoldoutBatch {
  accepted: false;
  reason: string;
}

const SHA256 = /^[a-f0-9]{64}$/i;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const MAX_ARTIFACTS = 256;
const MIN_INDEPENDENT_PAIRS = 5;

function plain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function own(value: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
      descriptor.get === undefined && descriptor.set === undefined
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function ownKeys(value: Record<string, unknown>): string[] | null {
  try { return Object.keys(value); } catch { return null; }
}

function dense(value: unknown, maximum: number): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = lengthDescriptor && 'value' in lengthDescriptor ? lengthDescriptor.value : Number.NaN;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > maximum) return null;
    const rows: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined) return null;
      rows.push(descriptor.value);
    }
    return rows;
  } catch {
    return null;
  }
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum &&
    value.trim() === value && !/[\u0000-\u001f]/.test(value);
}

function finiteUnit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1;
}

/** Stable signature payload. Unknown fields are refused before this function is used. */
export function canonicalPairedHoldoutPayload(payload: SignedPairedHoldoutPayload): string {
  return JSON.stringify({
    schemaVersion: 1,
    candidateId: payload.candidateId,
    patchSha256: payload.patchSha256.toLowerCase(),
    evidenceId: payload.evidenceId,
    seed: payload.seed,
    split: 'holdout',
    verifierId: payload.verifierId,
    environmentId: payload.environmentId,
    proxyGain: payload.proxyGain,
    downstreamGain: payload.downstreamGain,
    observedAt: payload.observedAt,
  });
}

/**
 * Verifies independent evaluator artifacts bound to one exact candidate and patch.
 * Candidate-provided observation rows are deliberately never accepted by this path.
 */
export function verifySignedPairedHoldoutEvidence(
  rawArtifacts: unknown,
  expectedCandidateId: string,
  expectedPatchSha256: string,
  trustedVerifierKeys: Readonly<Record<string, string>>,
): VerifiedPairedHoldoutBatch | RefusedPairedHoldoutBatch {
  const rows = dense(rawArtifacts, MAX_ARTIFACTS);
  if (!rows || rows.length === 0) return { accepted: false, reason: 'host-evidence-missing' };
  if (rows.length < MIN_INDEPENDENT_PAIRS) {
    return { accepted: false, reason: `insufficient-independent-pairs:${rows.length}<${MIN_INDEPENDENT_PAIRS}` };
  }
  if (!boundedText(expectedCandidateId, 128) || !SHA256.test(expectedPatchSha256)) {
    return { accepted: false, reason: 'evidence-binding-input-invalid' };
  }
  if (!plain(trustedVerifierKeys)) return { accepted: false, reason: 'host-verifier-keys-invalid' };

  const allowedPayloadKeys = new Set([
    'schemaVersion', 'candidateId', 'patchSha256', 'evidenceId', 'seed', 'split',
    'verifierId', 'environmentId', 'proxyGain', 'downstreamGain', 'observedAt',
  ]);
  const observations: PairedObservation[] = [];
  const evidenceIds = new Set<string>();
  const seeds = new Set<number>();
  const verifiers = new Set<string>();
  const environments = new Set<string>();
  const canonicalRows: string[] = [];

  for (const raw of rows) {
    if (!plain(raw) || Object.keys(raw).some(key => !['payload', 'signature'].includes(key))) {
      return { accepted: false, reason: 'signed-outcome-artifact-malformed' };
    }
    const payload = own(raw, 'payload');
    const signature = own(raw, 'signature');
    if (!plain(payload) || Object.keys(payload).some(key => !allowedPayloadKeys.has(key))) {
      return { accepted: false, reason: 'signed-outcome-payload-malformed' };
    }
    const schemaVersion = own(payload, 'schemaVersion');
    const candidateId = own(payload, 'candidateId');
    const patchSha256 = own(payload, 'patchSha256');
    const evidenceId = own(payload, 'evidenceId');
    const seed = own(payload, 'seed');
    const split = own(payload, 'split');
    const verifierId = own(payload, 'verifierId');
    const environmentId = own(payload, 'environmentId');
    const proxyGain = own(payload, 'proxyGain');
    const downstreamGain = own(payload, 'downstreamGain');
    const observedAt = own(payload, 'observedAt');

    if (schemaVersion !== 1 || !boundedText(candidateId, 128) ||
        !SHA256.test(String(patchSha256 ?? '')) || !boundedText(evidenceId, 160) ||
        typeof seed !== 'number' || !Number.isSafeInteger(seed) || seed < 0 ||
        split !== 'holdout' || !boundedText(verifierId, 96) || !KEY_ID.test(verifierId) ||
        !boundedText(environmentId, 180) || !finiteUnit(proxyGain) || !finiteUnit(downstreamGain) ||
        typeof observedAt !== 'number' || !Number.isFinite(observedAt) || observedAt <= 0) {
      return { accepted: false, reason: 'signed-outcome-payload-invalid' };
    }
    if (candidateId !== expectedCandidateId) return { accepted: false, reason: 'candidate-id-mismatch' };
    if (String(patchSha256).toLowerCase() !== expectedPatchSha256.toLowerCase()) {
      return { accepted: false, reason: 'patch-digest-mismatch' };
    }
    if (evidenceIds.has(evidenceId) || seeds.has(seed)) {
      return { accepted: false, reason: 'duplicate-evidence-id-or-seed' };
    }
    const keyDescriptor = Object.getOwnPropertyDescriptor(trustedVerifierKeys, verifierId);
    const publicKey = keyDescriptor && Object.prototype.hasOwnProperty.call(keyDescriptor, 'value')
      ? keyDescriptor.value
      : undefined;
    if (typeof publicKey !== 'string') return { accepted: false, reason: 'untrusted-verifier-key' };
    if (typeof signature !== 'string' || signature.length < 80 || signature.length > 256 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
      return { accepted: false, reason: 'signed-outcome-signature-malformed' };
    }
    let signatureValid = false;
    try {
      const bytes = Buffer.from(signature, 'base64');
      signatureValid = bytes.toString('base64') === signature &&
        verifySignature(null, Buffer.from(canonicalPairedHoldoutPayload(payload as unknown as SignedPairedHoldoutPayload), 'utf8'), publicKey, bytes);
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) return { accepted: false, reason: 'invalid-signature' };

    evidenceIds.add(evidenceId);
    seeds.add(seed);
    verifiers.add(verifierId);
    environments.add(environmentId);
    observations.push({ id: evidenceId, proxyGain, downstreamGain });
    canonicalRows.push(canonicalPairedHoldoutPayload(payload as unknown as SignedPairedHoldoutPayload));
  }

  // A minimum sample alone is not enough: at least two host-authorized verifier
  // identities and two isolated evaluation environments must contribute.
  if (verifiers.size < 2) return { accepted: false, reason: 'insufficient-independent-verifiers' };
  if (environments.size < 2) return { accepted: false, reason: 'insufficient-independent-environments' };

  canonicalRows.sort();
  const fingerprint = createHash('sha256').update(canonicalRows.join('\n'), 'utf8').digest('hex');
  return {
    accepted: true,
    observations,
    pairs: observations.length,
    verifierCount: verifiers.size,
    environmentCount: environments.size,
    fingerprint,
  };
}
