import {
  isAuthenticatedCodeAssimilationEvidenceReceipt,
  isCodeAssimilationUseAllowed,
  type CodeAssimilationEvidenceReceipt,
} from './CodeAssimilationEvidence.ts';
import {
  normalizeCodeAssimilationCandidate,
  type CodeAssimilationCandidate,
} from './CodeAssimilationContracts.ts';
import type {
  SourceCandidateAuthorizationRequestV1,
  SourceCandidateAuthorizationDecisionV1,
  SourceCandidateAuthorizationV1,
} from '../analysis/SourceCandidateWorkspace.ts';

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const WORKSPACE_ID = /^[a-f0-9]{32}$/;

export type CodeAssimilationBaseSnapshotVerifierV1 = (
  request: Readonly<SourceCandidateAuthorizationRequestV1>,
) => boolean | Promise<boolean>;

export interface CodeAssimilationSourceCandidateAdmissionOptionsV1 {
  candidate: unknown;
  sourceProvenanceReceipt: unknown;
  licenseDecisionReceipt: unknown;
  /** Host-owned verification that the supplied snapshot is the exact trusted checkout at baseSha. */
  verifyBaseSnapshot: CodeAssimilationBaseSnapshotVerifierV1;
}

function rejected(reason: string): SourceCandidateAuthorizationDecisionV1 {
  return { accepted: false, reason };
}

function validWorkspaceRequest(request: SourceCandidateAuthorizationRequestV1): boolean {
  if (!request || typeof request !== 'object' ||
      !WORKSPACE_ID.test(request.candidateId) ||
      typeof request.baseSha !== 'string' || !SHA1.test(request.baseSha) ||
      typeof request.beforeTreeSha256 !== 'string' || !SHA256.test(request.beforeTreeSha256) ||
      typeof request.editSetSha256 !== 'string' || !SHA256.test(request.editSetSha256) ||
      !Array.isArray(request.changedFiles) ||
      request.changedFiles.length === 0 || request.changedFiles.length > 256) return false;

  const paths = new Set<string>();
  for (const file of request.changedFiles) {
    if (!file || typeof file !== 'object' ||
        typeof file.path !== 'string' || file.path.length === 0 || file.path.length > 1024 ||
        paths.has(file.path) ||
        !(file.expectedBeforeSha256 === null ||
          typeof file.expectedBeforeSha256 === 'string' && SHA256.test(file.expectedBeforeSha256)) ||
        typeof file.afterSha256 !== 'string' || !SHA256.test(file.afterSha256) ||
        typeof file.createIfMissing !== 'boolean') return false;
    paths.add(file.path);
  }
  return true;
}

function sameCandidateReceipt(
  raw: unknown,
  candidate: CodeAssimilationCandidate,
  evidenceKind: 'source-provenance' | 'license-decision',
): raw is CodeAssimilationEvidenceReceipt {
  return isAuthenticatedCodeAssimilationEvidenceReceipt(raw) &&
    raw.evidenceKind === evidenceKind &&
    raw.candidateId === candidate.candidateId &&
    raw.candidateFingerprint === candidate.candidateFingerprint &&
    raw.sourceFingerprint === candidate.sourceFingerprint;
}

/**
 * Composes signed donor provenance/license evidence with the host's trusted
 * checkout verifier before SourceCandidateWorkspaceV1 may materialize edits.
 *
 * This authorizes modification into a non-executing candidate workspace only.
 * It does not authorize execution, installation, activation, deployment, or
 * redistribution. The caller must separately supply host verification for the
 * exact base checkout and its before-tree fingerprint.
 */
export function createCodeAssimilationSourceCandidateAuthorizationV1(
  options: CodeAssimilationSourceCandidateAdmissionOptionsV1,
): SourceCandidateAuthorizationV1 {
  if (!options || typeof options !== 'object' ||
      typeof options.verifyBaseSnapshot !== 'function') {
    throw new Error('code-assimilation-source-candidate-host-verifier-required');
  }

  const candidate = normalizeCodeAssimilationCandidate(options.candidate);
  if (!sameCandidateReceipt(options.sourceProvenanceReceipt, candidate, 'source-provenance') ||
      options.sourceProvenanceReceipt.subjectFingerprint !== candidate.sourceFingerprint) {
    throw new Error('code-assimilation-source-provenance-receipt-required');
  }
  if (!sameCandidateReceipt(options.licenseDecisionReceipt, candidate, 'license-decision') ||
      !isCodeAssimilationUseAllowed(
        options.licenseDecisionReceipt,
        'modify',
        candidate.candidateFingerprint,
      )) {
    throw new Error('code-assimilation-license-modify-approval-required');
  }
  if (!SHA1.test(candidate.baseRuntimeSha)) {
    throw new Error('code-assimilation-workspace-base-sha-unsupported');
  }

  return async request => {
    if (!validWorkspaceRequest(request)) return rejected('source-candidate-authorization-request-invalid');
    if (request.baseSha !== candidate.baseRuntimeSha) {
      return rejected('source-candidate-base-runtime-binding-mismatch');
    }

    const detachedRequest: SourceCandidateAuthorizationRequestV1 = Object.freeze({
      candidateId: request.candidateId,
      baseSha: request.baseSha,
      beforeTreeSha256: request.beforeTreeSha256,
      editSetSha256: request.editSetSha256,
      changedFiles: Object.freeze(request.changedFiles.map(file => Object.freeze({ ...file }))) as unknown as SourceCandidateAuthorizationRequestV1['changedFiles'],
    });

    let hostVerified = false;
    try {
      hostVerified = await options.verifyBaseSnapshot(detachedRequest) === true;
    } catch {
      return rejected('source-candidate-host-snapshot-verifier-failed');
    }
    if (!hostVerified) return rejected('source-candidate-host-snapshot-not-verified');

    const receiptId = 'source-admission:' + candidate.candidateId + ':' + request.candidateId;
    return {
      accepted: true,
      receiptId,
      baseSha: request.baseSha,
      editSetSha256: request.editSetSha256,
    };
  };
}
