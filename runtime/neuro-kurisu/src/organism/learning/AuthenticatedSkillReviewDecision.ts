import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import type { SkillReviewRecord } from './HexisSkillReviewInbox.ts';

export interface SignedSkillReviewDecisionPayload {
  schemaVersion: 1;
  algorithm: 'Ed25519';
  keyId: string;
  reviewId: string;
  reviewPacketDigest: string;
  decisionDigest: string;
  outcome: 'approve' | 'reject';
  reviewerId: string;
  rationale: string;
  decidedAt: number;
}

export interface SignedSkillReviewDecisionArtifact {
  payload: SignedSkillReviewDecisionPayload;
  signature: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isHash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('decision payload is not JSON-serializable');
    return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
};

export function canonicalSkillReviewDecisionPayload(payload: SignedSkillReviewDecisionPayload): string {
  return canonical(payload);
}

/**
 * Build the exact payload an authenticated reviewer must sign outside NK1.
 * This helper does not sign anything; the private key must remain with the
 * independent operator/approval service.
 */
export function createSkillReviewDecisionSigningPayload(
  review: Readonly<SkillReviewRecord>,
  keyId: string,
): SignedSkillReviewDecisionPayload {
  if (!review || review.status !== 'approved-for-signed-promotion' || !review.decision ||
      review.decision.outcome !== 'approve' || !isHash(review.packet?.reviewId) ||
      !isHash(review.packet?.digest) || !isHash(review.decision.digest) ||
      !nonEmpty(keyId) || keyId.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:@-]*$/.test(keyId)) {
    throw new Error('a completed approved review and valid trusted signing key ID are required');
  }
  return {
    schemaVersion: 1,
    algorithm: 'Ed25519',
    keyId,
    reviewId: review.packet.reviewId,
    reviewPacketDigest: review.packet.digest,
    decisionDigest: review.decision.digest,
    outcome: review.decision.outcome,
    reviewerId: review.decision.reviewerId,
    rationale: review.decision.rationale,
    decidedAt: review.decision.decidedAt,
  };
}

/** Load allow-listed Ed25519 public keys. Missing keys mean default-deny. */
export function parseTrustedSkillReviewDecisionKeys(raw: string | undefined): ReadonlyMap<string, string> {
  if (raw === undefined || raw.trim() === '') {
    throw new Error('NEURO_SKILL_REVIEW_APPROVAL_KEYS_JSON is required; review signatures fail closed without trusted keys');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('NEURO_SKILL_REVIEW_APPROVAL_KEYS_JSON must be valid JSON'); }
  if (!isRecord(parsed) || Object.keys(parsed).length === 0 || Object.keys(parsed).length > 64) {
    throw new Error('trusted review decision key set must contain between 1 and 64 entries');
  }
  const keys = new Map<string, string>();
  for (const [keyId, pem] of Object.entries(parsed)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/.test(keyId) || typeof pem !== 'string' || !pem.trim()) {
      throw new Error('trusted review decision key entry is malformed');
    }
    let key: KeyObject;
    try { key = createPublicKey(pem); }
    catch { throw new Error('trusted review decision keys must be valid Ed25519 public keys'); }
    if (key.asymmetricKeyType !== 'ed25519') {
      throw new Error('trusted review decision keys must be valid Ed25519 public keys');
    }
    keys.set(keyId, pem);
  }
  return keys;
}

/**
 * Verify a signed, independently authenticated approval against the exact durable
 * review packet and decision. The inbox's reviewer label/digest alone is not an
 * authentication mechanism. Callers must use this verifier before returning an
 * activation-approval request.
 */
export function verifySignedSkillReviewDecisionArtifact(
  value: unknown,
  trustedKeys: ReadonlyMap<string, string>,
  review: Readonly<SkillReviewRecord>,
): SignedSkillReviewDecisionPayload {
  if (!review || review.status !== 'approved-for-signed-promotion' || !review.decision ||
      review.decision.outcome !== 'approve' || !isHash(review.packet?.reviewId) ||
      !isHash(review.packet?.digest) || !isHash(review.decision.digest)) {
    throw new Error('durable review must contain a completed positive decision');
  }
  if (!isRecord(value) || !isRecord(value.payload) || typeof value.signature !== 'string') {
    throw new Error('signed review decision artifact schema is invalid');
  }
  const payload = value.payload;
  if (payload.schemaVersion !== 1 || payload.algorithm !== 'Ed25519' ||
      !nonEmpty(payload.keyId) || payload.keyId.length > 128 ||
      !isHash(payload.reviewId) || !isHash(payload.reviewPacketDigest) ||
      !isHash(payload.decisionDigest) || payload.outcome !== 'approve' ||
      !nonEmpty(payload.reviewerId) || payload.reviewerId.length > 128 ||
      /[\u0000-\u001f\u007f]/.test(payload.reviewerId) ||
      !nonEmpty(payload.rationale) || payload.rationale.length > 2000 ||
      !Number.isSafeInteger(payload.decidedAt) || Number(payload.decidedAt) < review.packet.createdAt) {
    throw new Error('signed review decision payload is malformed or outside its allowed bounds');
  }
  if (payload.reviewId !== review.packet.reviewId ||
      payload.reviewPacketDigest !== review.packet.digest ||
      payload.decisionDigest !== review.decision.digest ||
      payload.outcome !== review.decision.outcome ||
      payload.reviewerId !== review.decision.reviewerId ||
      payload.rationale !== review.decision.rationale ||
      payload.decidedAt !== review.decision.decidedAt) {
    throw new Error('signed review decision does not match the exact durable review packet and decision');
  }
  const rawPublicKey = trustedKeys.get(payload.keyId);
  if (!rawPublicKey) throw new Error('review signing key ID is not trusted');
  let publicKey: KeyObject;
  try { publicKey = createPublicKey(rawPublicKey); }
  catch { throw new Error('trusted review decision public key could not be loaded'); }
  if (publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('trusted review decision public key must use Ed25519');
  }
  const signature = Buffer.from(value.signature, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== value.signature) {
    throw new Error('signed review decision signature must be a canonical 64-byte base64 Ed25519 signature');
  }
  let verified = false;
  try {
    verified = verifySignature(
      null,
      Buffer.from(canonicalSkillReviewDecisionPayload(payload as unknown as SignedSkillReviewDecisionPayload), 'utf8'),
      publicKey,
      signature,
    );
  } catch { verified = false; }
  if (!verified) throw new Error('signed review decision signature verification failed');
  return payload as unknown as SignedSkillReviewDecisionPayload;
}

/** Stable hash for audit/logging; it is not a replacement for signature verification. */
export function fingerprintSignedSkillReviewDecisionArtifact(value: SignedSkillReviewDecisionArtifact): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
