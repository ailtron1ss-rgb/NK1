import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
import {
  normalizeCodeAssimilationCandidate,
  type CodeAssimilationCandidate,
  type CodeComponentManifest,
} from './CodeAssimilationContracts.ts';

export type CodeAssimilationEvidenceKind =
  | 'source-provenance'
  | 'sbom'
  | 'build'
  | 'license-decision';

export type CodeAssimilationIssuerRole =
  | 'source-verifier'
  | 'sbom-scanner'
  | 'builder'
  | 'license-reviewer';

export type CodeAssimilationPermittedUse = 'study' | 'execute' | 'modify' | 'redistribute';

export interface CodeAssimilationMaterialFingerprints {
  sourceContentSha256: string;
  sourceTreeSha256: string;
  dependencyLockFingerprint: string | null;
  sbomFingerprint: string | null;
}

export interface CodeAssimilationLicenseDecision {
  outcome: 'approved' | 'research-only' | 'rejected';
  licenseExpression: string | null;
  licenseEvidenceFingerprint: string;
  permittedUses: CodeAssimilationPermittedUse[];
  reviewScope: string;
  reviewerBasis: 'human-review' | 'legal-counsel';
}

export interface CodeAssimilationEvidencePayload {
  schemaVersion: 1;
  attestationId: string;
  candidateId: string;
  candidateFingerprint: string;
  sourceFingerprint: string;
  evidenceKind: CodeAssimilationEvidenceKind;
  issuerId: string;
  issuerRole: CodeAssimilationIssuerRole;
  issuedAt: number;
  subjectFingerprint: string;
  materialFingerprints: CodeAssimilationMaterialFingerprints;
  licenseDecision?: CodeAssimilationLicenseDecision;
}

export interface SignedCodeAssimilationEvidence {
  payload: CodeAssimilationEvidencePayload;
  signature: string;
}

export interface CodeAssimilationEvidenceReceipt {
  schemaVersion: 1;
  evidenceFingerprint: string;
  candidateId: string;
  candidateFingerprint: string;
  sourceFingerprint: string;
  evidenceKind: CodeAssimilationEvidenceKind;
  issuerId: string;
  issuerRole: CodeAssimilationIssuerRole;
  issuedAt: number;
  subjectFingerprint: string;
  licenseDecision?: CodeAssimilationLicenseDecision;
}

export interface CodeAssimilationEvidenceVerificationOptions {
  now?: () => number;
  allowedClockSkewMs?: number;
}

export type CodeAssimilationEvidenceVerificationResult =
  | {
      accepted: false;
      evidenceFingerprint: string;
      rejection: string;
    }
  | {
      accepted: true;
      evidenceFingerprint: string;
      evidenceKind: CodeAssimilationEvidenceKind;
      receipt: CodeAssimilationEvidenceReceipt;
    };

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
const SIGNATURE_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const EVIDENCE_KINDS = new Set<CodeAssimilationEvidenceKind>([
  'source-provenance', 'sbom', 'build', 'license-decision',
]);
const ISSUER_ROLES = new Set<CodeAssimilationIssuerRole>([
  'source-verifier', 'sbom-scanner', 'builder', 'license-reviewer',
]);
const USES = new Set<CodeAssimilationPermittedUse>(['study', 'execute', 'modify', 'redistribute']);
const ROLE_FOR_KIND: Readonly<Record<CodeAssimilationEvidenceKind, CodeAssimilationIssuerRole>> = {
  'source-provenance': 'source-verifier',
  sbom: 'sbom-scanner',
  build: 'builder',
  'license-decision': 'license-reviewer',
};
const authenticatedReceipts = new WeakSet<object>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (actual.length !== allowed.length || actual.some((key, index) => key !== allowed[index])) {
    throw new Error(`code-assimilation-evidence-${label}-shape-invalid`);
  }
}

function safeText(value: unknown, label: string, max = 512): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max ||
      value.trim() !== value || value.normalize('NFKC') !== value ||
      Array.from(value).some(character => {
        const code = character.codePointAt(0) ?? 0;
        return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
      })) {
    throw new Error(`code-assimilation-evidence-${label}-invalid`);
  }
  return value;
}

function digest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new Error(`code-assimilation-evidence-${label}-fingerprint-invalid`);
  }
  return value;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function expectedMaterials(manifest: CodeComponentManifest): CodeAssimilationMaterialFingerprints {
  return {
    sourceContentSha256: manifest.source.contentSha256,
    sourceTreeSha256: manifest.source.treeSha256,
    dependencyLockFingerprint: manifest.dependencyLockFingerprint,
    sbomFingerprint: manifest.sbomFingerprint,
  };
}

function normalizedMaterials(raw: unknown): CodeAssimilationMaterialFingerprints {
  if (!isRecord(raw)) throw new Error('code-assimilation-evidence-materials-invalid');
  exactKeys(raw, [
    'sourceContentSha256', 'sourceTreeSha256',
    'dependencyLockFingerprint', 'sbomFingerprint',
  ], 'materials');
  return {
    sourceContentSha256: digest(raw.sourceContentSha256, 'source-content'),
    sourceTreeSha256: digest(raw.sourceTreeSha256, 'source-tree'),
    dependencyLockFingerprint: raw.dependencyLockFingerprint === null
      ? null : digest(raw.dependencyLockFingerprint, 'dependency-lock'),
    sbomFingerprint: raw.sbomFingerprint === null
      ? null : digest(raw.sbomFingerprint, 'sbom'),
  };
}

function normalizeLicenseDecision(raw: unknown): CodeAssimilationLicenseDecision {
  if (!isRecord(raw)) throw new Error('code-assimilation-evidence-license-decision-invalid');
  exactKeys(raw, [
    'outcome', 'licenseExpression', 'licenseEvidenceFingerprint',
    'permittedUses', 'reviewScope', 'reviewerBasis',
  ], 'license-decision');
  if (!['approved', 'research-only', 'rejected'].includes(String(raw.outcome))) {
    throw new Error('code-assimilation-evidence-license-outcome-invalid');
  }
  const outcome = raw.outcome as CodeAssimilationLicenseDecision['outcome'];
  const licenseExpression = raw.licenseExpression === null
    ? null : safeText(raw.licenseExpression, 'license-expression', 256);
  const licenseEvidenceFingerprint = digest(raw.licenseEvidenceFingerprint, 'license-evidence');
  if (!Array.isArray(raw.permittedUses) || raw.permittedUses.length > USES.size) {
    throw new Error('code-assimilation-evidence-license-uses-invalid');
  }
  const permittedUses: CodeAssimilationPermittedUse[] = [];
  for (const value of raw.permittedUses) {
    if (typeof value !== 'string' || !USES.has(value as CodeAssimilationPermittedUse) ||
        permittedUses.includes(value as CodeAssimilationPermittedUse)) {
      throw new Error('code-assimilation-evidence-license-uses-invalid');
    }
    permittedUses.push(value as CodeAssimilationPermittedUse);
  }
  const reviewScope = safeText(raw.reviewScope, 'license-review-scope', 512);
  if (!['human-review', 'legal-counsel'].includes(String(raw.reviewerBasis))) {
    throw new Error('code-assimilation-evidence-license-reviewer-basis-invalid');
  }
  if (outcome === 'rejected' && permittedUses.length !== 0) {
    throw new Error('code-assimilation-evidence-license-decision-inconsistent');
  }
  if (outcome === 'research-only' && permittedUses.some(use => use !== 'study')) {
    throw new Error('code-assimilation-evidence-license-decision-inconsistent');
  }
  if (outcome === 'approved' && permittedUses.length === 0) {
    throw new Error('code-assimilation-evidence-license-decision-inconsistent');
  }
  return {
    outcome,
    licenseExpression,
    licenseEvidenceFingerprint,
    permittedUses,
    reviewScope,
    reviewerBasis: raw.reviewerBasis as CodeAssimilationLicenseDecision['reviewerBasis'],
  };
}

function normalizePayload(raw: unknown): CodeAssimilationEvidencePayload {
  if (!isRecord(raw)) throw new Error('code-assimilation-evidence-payload-invalid');
  const expected = [
    'schemaVersion', 'attestationId', 'candidateId', 'candidateFingerprint',
    'sourceFingerprint', 'evidenceKind', 'issuerId', 'issuerRole', 'issuedAt',
    'subjectFingerprint', 'materialFingerprints',
  ];
  const keys = Object.keys(raw);
  if (Object.prototype.hasOwnProperty.call(raw, 'licenseDecision')) expected.push('licenseDecision');
  exactKeys(raw, expected, 'payload');
  if (raw.schemaVersion !== 1) throw new Error('code-assimilation-evidence-schema-version-unsupported');
  if (typeof raw.evidenceKind !== 'string' || !EVIDENCE_KINDS.has(raw.evidenceKind as CodeAssimilationEvidenceKind)) {
    throw new Error('code-assimilation-evidence-kind-invalid');
  }
  if (typeof raw.issuerRole !== 'string' || !ISSUER_ROLES.has(raw.issuerRole as CodeAssimilationIssuerRole)) {
    throw new Error('code-assimilation-evidence-issuer-role-invalid');
  }
  const issuedAt = raw.issuedAt;
  if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt) || issuedAt <= 0) {
    throw new Error('code-assimilation-evidence-issued-at-invalid');
  }
  const payload: CodeAssimilationEvidencePayload = {
    schemaVersion: 1,
    attestationId: safeText(raw.attestationId, 'attestation-id', 256),
    candidateId: safeText(raw.candidateId, 'candidate-id', 64),
    candidateFingerprint: digest(raw.candidateFingerprint, 'candidate'),
    sourceFingerprint: digest(raw.sourceFingerprint, 'source'),
    evidenceKind: raw.evidenceKind as CodeAssimilationEvidenceKind,
    issuerId: safeText(raw.issuerId, 'issuer-id', 256),
    issuerRole: raw.issuerRole as CodeAssimilationIssuerRole,
    issuedAt,
    subjectFingerprint: digest(raw.subjectFingerprint, 'subject'),
    materialFingerprints: normalizedMaterials(raw.materialFingerprints),
    ...(raw.licenseDecision !== undefined
      ? { licenseDecision: normalizeLicenseDecision(raw.licenseDecision) } : {}),
  };
  if (!SAFE_ID.test(payload.issuerId)) throw new Error('code-assimilation-evidence-issuer-id-invalid');
  if (payload.evidenceKind !== 'license-decision' && payload.licenseDecision !== undefined) {
    throw new Error('code-assimilation-evidence-unexpected-license-decision');
  }
  if (payload.evidenceKind === 'license-decision' && payload.licenseDecision === undefined) {
    throw new Error('code-assimilation-evidence-license-decision-required');
  }
  return payload;
}

function validateCandidateBinding(
  candidate: CodeAssimilationCandidate,
  payload: CodeAssimilationEvidencePayload,
): string | null {
  if (payload.candidateId !== candidate.candidateId ||
      payload.candidateFingerprint !== candidate.candidateFingerprint ||
      payload.sourceFingerprint !== candidate.sourceFingerprint) {
    return 'candidate-binding-mismatch';
  }
  if (canonical(payload.materialFingerprints) !== canonical(expectedMaterials(candidate.manifest))) {
    return 'material-binding-mismatch';
  }
  if (payload.issuerRole !== ROLE_FOR_KIND[payload.evidenceKind]) return 'issuer-role-mismatch';
  switch (payload.evidenceKind) {
    case 'source-provenance':
      if (payload.subjectFingerprint !== candidate.sourceFingerprint) return 'source-subject-mismatch';
      break;
    case 'sbom':
      if (!candidate.manifest.sbomFingerprint ||
          payload.subjectFingerprint !== candidate.manifest.sbomFingerprint ||
          !candidate.manifest.dependencyLockFingerprint) return 'sbom-subject-mismatch';
      break;
    case 'build':
      if (!candidate.manifest.dependencyLockFingerprint || !candidate.manifest.sbomFingerprint) {
        return 'build-materials-incomplete';
      }
      break;
    case 'license-decision': {
      const decision = payload.licenseDecision!;
      if (payload.subjectFingerprint !== decision.licenseEvidenceFingerprint) return 'license-subject-mismatch';
      if (candidate.manifest.declaredLicenseExpression !== null &&
          decision.licenseExpression !== candidate.manifest.declaredLicenseExpression) {
        return 'declared-license-mismatch';
      }
      break;
    }
  }
  return null;
}

/** Stable trust-map key. Private signing keys must remain outside the NK1 runtime. */
export function codeAssimilationTrustKeyId(role: CodeAssimilationIssuerRole, issuerId: string): string {
  if (!ISSUER_ROLES.has(role) || !SAFE_ID.test(issuerId)) {
    throw new Error('code-assimilation-evidence-trust-key-identity-invalid');
  }
  return JSON.stringify([role, issuerId]);
}

/** Canonical Ed25519 signing input. The payload is detached and sorted recursively. */
export function canonicalCodeAssimilationEvidencePayload(payload: CodeAssimilationEvidencePayload): string {
  return canonical(payload);
}

export function codeAssimilationEvidenceFingerprint(payload: CodeAssimilationEvidencePayload): string {
  return sha256(canonicalCodeAssimilationEvidencePayload(payload));
}

function reject(rejection: string, evidenceFingerprint = ''): CodeAssimilationEvidenceVerificationResult {
  return { accepted: false, evidenceFingerprint, rejection };
}

/**
 * Verify one externally signed statement against an immutable code candidate.
 *
 * The trust map is supplied by the host; absence of a trusted issuer is default-deny.
 * A successful signature proves key possession and payload integrity, not that a
 * scanner, builder or human reviewer made a correct decision. Receipts are
 * process-local and must be re-created by re-verifying the persisted signature
 * after restart.
 */
export function verifyCodeAssimilationEvidence(
  rawCandidate: unknown,
  rawArtifact: unknown,
  trustedKeys: ReadonlyMap<string, string>,
  options: CodeAssimilationEvidenceVerificationOptions = {},
): CodeAssimilationEvidenceVerificationResult {
  let candidate: CodeAssimilationCandidate;
  let detached: unknown;
  try {
    candidate = normalizeCodeAssimilationCandidate(rawCandidate);
    detached = snapshotPlainData(rawArtifact, { maxDepth: 12, maxNodes: 2_048, maxStringUnits: 64_000 });
  } catch {
    return reject('untrusted-input-boundary-rejected');
  }
  if (!isRecord(detached)) return reject('evidence-artifact-invalid');
  try {
    exactKeys(detached, ['payload', 'signature'], 'artifact');
  } catch {
    return reject('evidence-artifact-shape-invalid');
  }
  let payload: CodeAssimilationEvidencePayload;
  try { payload = normalizePayload(detached.payload); }
  catch (error) {
    return reject(error instanceof Error ? error.message : 'evidence-payload-invalid');
  }
  const fingerprint = codeAssimilationEvidenceFingerprint(payload);
  const bindingRejection = validateCandidateBinding(candidate, payload);
  if (bindingRejection) return reject(bindingRejection, fingerprint);
  const keyId = codeAssimilationTrustKeyId(payload.issuerRole, payload.issuerId);
  const keyPem = trustedKeys?.get(keyId);
  if (typeof keyPem !== 'string' || !keyPem.trim()) return reject('untrusted-issuer', fingerprint);
  const now = options.now ?? Date.now;
  const allowedClockSkewMs = options.allowedClockSkewMs ?? 30_000;
  const timestamp = now();
  if (!Number.isFinite(timestamp) || !Number.isFinite(allowedClockSkewMs) ||
      allowedClockSkewMs < 0 || allowedClockSkewMs > 5 * 60_000 ||
      payload.issuedAt > timestamp + allowedClockSkewMs) {
    return reject('issued-at-in-future', fingerprint);
  }
  const signature = detached.signature;
  if (typeof signature !== 'string' || !SIGNATURE_BASE64.test(signature)) {
    return reject('invalid-signature-encoding', fingerprint);
  }
  const signatureBytes = Buffer.from(signature, 'base64');
  if (signatureBytes.length !== 64 || signatureBytes.toString('base64') !== signature) {
    return reject('invalid-signature-encoding', fingerprint);
  }
  let signatureValid = false;
  try {
    const publicKey = createPublicKey(keyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519') return reject('issuer-key-type-invalid', fingerprint);
    signatureValid = verifySignature(
      null,
      Buffer.from(canonicalCodeAssimilationEvidencePayload(payload), 'utf8'),
      publicKey,
      signatureBytes,
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return reject('invalid-signature', fingerprint);
  const receipt: CodeAssimilationEvidenceReceipt = Object.freeze({
    schemaVersion: 1,
    evidenceFingerprint: fingerprint,
    candidateId: candidate.candidateId,
    candidateFingerprint: candidate.candidateFingerprint,
    sourceFingerprint: candidate.sourceFingerprint,
    evidenceKind: payload.evidenceKind,
    issuerId: payload.issuerId,
    issuerRole: payload.issuerRole,
    issuedAt: payload.issuedAt,
    subjectFingerprint: payload.subjectFingerprint,
    ...(payload.licenseDecision ? { licenseDecision: payload.licenseDecision } : {}),
  });
  authenticatedReceipts.add(receipt);
  return {
    accepted: true,
    evidenceFingerprint: fingerprint,
    evidenceKind: payload.evidenceKind,
    receipt,
  };
}

/** A receipt copied to JSON or restored from disk is not authenticated in this process. */
export function isAuthenticatedCodeAssimilationEvidenceReceipt(raw: unknown): raw is CodeAssimilationEvidenceReceipt {
  return isRecord(raw) && authenticatedReceipts.has(raw);
}

/** Enforce a particular use against a currently authenticated, exact-candidate license decision. */
export function isCodeAssimilationUseAllowed(
  rawReceipt: unknown,
  use: CodeAssimilationPermittedUse,
): boolean {
  if (!isAuthenticatedCodeAssimilationEvidenceReceipt(rawReceipt) ||
      rawReceipt.evidenceKind !== 'license-decision' ||
      !USES.has(use)) return false;
  const decision = rawReceipt.licenseDecision;
  if (!decision || !decision.permittedUses.includes(use)) return false;
  if (decision.outcome === 'rejected') return false;
  if (decision.outcome === 'research-only') return use === 'study';
  return decision.outcome === 'approved';
}
