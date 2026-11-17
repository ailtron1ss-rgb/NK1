import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import type { ConstitutionReviewInput, ConstitutionTestEvidence } from './ConstitutionEvolutionEngine.ts';

export interface ConstitutionReviewPayload {
  schemaVersion: 1;
  proposalId: string;
  candidateDigest: string;
  reviewerId: string;
  decision: 'approve' | 'reject';
  invariantsPassed: boolean;
  tests: ConstitutionTestEvidence;
  evidenceRefs: string[];
  rationale: string;
  at: number;
}
export interface ConstitutionReviewArtifact {
  payload: ConstitutionReviewPayload;
  signature: string;
}
export interface ConstitutionReviewExpected {
  proposalId: string;
  candidateDigest: string;
  authorId: string;
  testPlanCount: number;
}
export type ConstitutionReviewVerifier = (artifact: unknown, expected: ConstitutionReviewExpected) => ConstitutionReviewInput | null;
export interface ConstitutionReviewAuthorityOptions {
  maxAgeMs?: number;
  allowedClockSkewMs?: number;
  now?: () => number;
}

const MAX_REVIEWERS = 16;
const MAX_EVIDENCE_REFS = 12;
const MAX_RATIONALE_CHARS = 1200;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown, max = 160): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const fingerprint = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const safeInteger = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).filter(key => object[key] !== undefined).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
}

export function canonicalConstitutionReviewPayload(payload: ConstitutionReviewPayload): string {
  return canonical(payload);
}

/** Load only trusted Ed25519 public keys. Private signing keys must remain outside NK1. */
export function parseTrustedConstitutionReviewKeys(raw: string | undefined): ReadonlyMap<string, string> {
  if (raw === undefined || raw.trim() === '') return new Map();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('NEURO_CONSTITUTION_REVIEW_KEYS_JSON must be valid JSON'); }
  if (!isRecord(parsed)) throw new Error('constitution review keys must be an object keyed by reviewer ID');
  const keys = new Map<string, string>();
  for (const [reviewerId, pem] of Object.entries(parsed)) {
    if (!nonEmpty(reviewerId) || !/^[A-Za-z0-9][A-Za-z0-9._:@-]*$/.test(reviewerId) || typeof pem !== 'string') {
      throw new Error('constitution review key entries must map valid reviewer IDs to PEM public keys');
    }
    if (keys.size >= MAX_REVIEWERS) throw new Error('constitution review key set exceeds the 16-key limit');
    let key;
    try { key = createPublicKey(pem); }
    catch { throw new Error('constitution review keys must be valid Ed25519 public keys'); }
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('constitution review keys must be valid Ed25519 public keys');
    keys.set(reviewerId, pem);
  }
  return keys;
}

function validateEvidence(value: unknown, expectedPlanCount: number): value is ConstitutionTestEvidence {
  if (!isRecord(value)) return false;
  const planned=value.planned, executed=value.executed, passed=value.passed, failed=value.failed, holdoutCases=value.holdoutCases;
  if (!safeInteger(planned,0,1000) || !safeInteger(executed,0,1000) || !safeInteger(passed,0,1000)
      || !safeInteger(failed,0,1000) || !safeInteger(holdoutCases,0,1000)) return false;
  if (planned !== expectedPlanCount || executed > planned || passed > executed || failed > executed
      || passed + failed > executed || typeof value.holdoutPassed !== 'boolean') return false;
  return true;
}

/**
 * Verifies a detached Ed25519 review artifact against a specific immutable proposal
 * digest, trusted reviewer key, freshness window, and test-plan cardinality.
 * The output is the only review shape that should be passed to the engine.
 */
export function createAuthenticatedConstitutionReviewVerifier(
  trustedKeys: ReadonlyMap<string, string>,
  options: ConstitutionReviewAuthorityOptions = {},
): ConstitutionReviewVerifier {
  const now = options.now ?? Date.now;
  const maxAgeMs = options.maxAgeMs ?? 15 * 60_000;
  const allowedClockSkewMs = options.allowedClockSkewMs ?? 30_000;
  if (!safeInteger(maxAgeMs, 1_000, 24 * 60 * 60_000) ||
      !safeInteger(allowedClockSkewMs, 0, 5 * 60_000)) {
    throw new Error('constitution review freshness policy is out of bounds');
  }
  return (artifact: unknown, expected: ConstitutionReviewExpected): ConstitutionReviewInput | null => {
    try {
      if (trustedKeys.size === 0 || !isRecord(artifact) || !isRecord(artifact.payload) ||
          typeof artifact.signature !== 'string' || artifact.signature.length > 1024) return null;
      const payload = artifact.payload as unknown as ConstitutionReviewPayload;
      if (payload.schemaVersion !== 1 || !nonEmpty(payload.proposalId, 120) ||
          !fingerprint(payload.candidateDigest) || !nonEmpty(payload.reviewerId) ||
          !['approve', 'reject'].includes(payload.decision) ||
          typeof payload.invariantsPassed !== 'boolean' ||
          !validateEvidence(payload.tests, expected.testPlanCount) ||
          !Array.isArray(payload.evidenceRefs) || payload.evidenceRefs.length < 1 ||
          payload.evidenceRefs.length > MAX_EVIDENCE_REFS ||
          !payload.evidenceRefs.every(ref => nonEmpty(ref, 500)) ||
          !nonEmpty(payload.rationale, MAX_RATIONALE_CHARS) ||
          !safeInteger(payload.at, 1, Number.MAX_SAFE_INTEGER)) return null;
      if (!nonEmpty(expected.proposalId, 120) || !fingerprint(expected.candidateDigest) ||
          !nonEmpty(expected.authorId) || !safeInteger(expected.testPlanCount, 1, 20)) return null;
      if (payload.proposalId !== expected.proposalId || payload.candidateDigest !== expected.candidateDigest ||
          payload.reviewerId === expected.authorId) return null;
      const keyPem = trustedKeys.get(payload.reviewerId);
      if (!keyPem) return null;
      const timestamp = now();
      if (!Number.isFinite(timestamp) || payload.at > timestamp + allowedClockSkewMs ||
          timestamp - payload.at > maxAgeMs) return null;
      if (payload.decision === 'approve' &&
          (payload.invariantsPassed !== true || payload.tests.executed !== payload.tests.planned ||
           payload.tests.passed !== payload.tests.planned || payload.tests.failed !== 0 ||
           payload.tests.holdoutCases < 1 || payload.tests.holdoutPassed !== true)) return null;
      const key = createPublicKey(keyPem);
      if (key.asymmetricKeyType !== 'ed25519' ||
          !verifySignature(null, Buffer.from(canonicalConstitutionReviewPayload(payload), 'utf8'), keyPem,
            Buffer.from(artifact.signature, 'base64'))) return null;
      return {
        reviewerId: payload.reviewerId,
        candidateDigest: payload.candidateDigest,
        decision: payload.decision,
        invariantsPassed: payload.invariantsPassed,
        tests: structuredClone(payload.tests),
        evidenceRefs: payload.evidenceRefs.map(ref => ref.trim()),
        rationale: payload.rationale.trim(),
        at: payload.at,
      };
    } catch {
      return null;
    }
  };
}

/** Non-secret diagnostics for UI/operations; callers never receive PEM material. */
export function constitutionReviewAuthoritySnapshot(keys: ReadonlyMap<string, string>) {
  return { configured: keys.size > 0, trustedReviewerCount: keys.size, reviewerIds: [...keys.keys()].sort() };
}
