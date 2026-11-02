import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createCodeAssimilationCandidate } from '../src/organism/learning/CodeAssimilationContracts.ts';
import * as evidence from '../src/organism/learning/CodeAssimilationEvidence.ts';

const sha = value => createHash('sha256').update(value).digest('hex');
const fixedNow = 1_800_000_000_000;
const issuerIds = {
  source: 'source-bot-1',
  sbom: 'sbom-scanner-1',
  builder: 'builder-1',
  license: 'license-reviewer-1',
};
const roles = {
  source: 'source-verifier',
  sbom: 'sbom-scanner',
  builder: 'builder',
  license: 'license-reviewer',
};
const keyPairs = Object.fromEntries(Object.keys(roles).map(name => [
  name,
  generateKeyPairSync('ed25519'),
]));
const trustedKeys = new Map(
  Object.keys(roles).map(name => [
    evidence.codeAssimilationTrustKeyId(roles[name], issuerIds[name]),
    keyPairs[name].publicKey.export({ type: 'spki', format: 'pem' }),
  ]),
);

const createCandidate = (declaredLicenseExpression = 'MIT') => createCodeAssimilationCandidate({
  baseRuntimeSha: 'a'.repeat(40),
  createdAt: fixedNow - 10_000,
  manifest: {
    componentId: 'memory.reranker',
    componentVersion: '1.2.3',
    capabilityId: 'memory.rerank',
    interfaceVersion: '1.0.0',
    language: 'TypeScript',
    runtime: 'node>=24',
    source: {
      sourceKind: 'git',
      canonicalUri: 'https://github.com/example/memory-reranker',
      publisher: 'example-org',
      immutableRevision: 'b'.repeat(40),
      contentSha256: '1'.repeat(64),
      treeSha256: '2'.repeat(64),
      retrievedAt: fixedNow - 20_000,
    },
    dependencyLockFingerprint: '3'.repeat(64),
    sbomFingerprint: '4'.repeat(64),
    declaredLicenseExpression,
  },
});

function materialsFor(candidate) {
  return {
    sourceContentSha256: candidate.manifest.source.contentSha256,
    sourceTreeSha256: candidate.manifest.source.treeSha256,
    dependencyLockFingerprint: candidate.manifest.dependencyLockFingerprint,
    sbomFingerprint: candidate.manifest.sbomFingerprint,
  };
}

function payloadFor(candidate, name, overrides = {}) {
  const evidenceKind = ({
    source: 'source-provenance',
    sbom: 'sbom',
    builder: 'build',
    license: 'license-decision',
  })[name];
  const base = {
    schemaVersion: 1,
    attestationId: `attestation:${name}:001`,
    candidateId: candidate.candidateId,
    candidateFingerprint: candidate.candidateFingerprint,
    sourceFingerprint: candidate.sourceFingerprint,
    evidenceKind,
    issuerId: issuerIds[name],
    issuerRole: roles[name],
    issuedAt: fixedNow,
    subjectFingerprint: ({
      source: candidate.sourceFingerprint,
      sbom: candidate.manifest.sbomFingerprint,
      builder: sha('built-component-output'),
      license: sha('license-and-notice-evidence-bundle'),
    })[name],
    materialFingerprints: materialsFor(candidate),
  };
  if (name === 'license') {
    base.licenseDecision = {
      outcome: 'approved',
      licenseExpression: 'MIT',
      licenseEvidenceFingerprint: sha('license-and-notice-evidence-bundle'),
      permittedUses: ['study', 'execute'],
      reviewScope: 'exact-source-revision-and-dependency-bundle',
      reviewerBasis: 'human-review',
    };
  }
  return { ...base, ...overrides };
}

function signedArtifact(payload, name, signatureOverride) {
  const bytes = Buffer.from(evidence.canonicalCodeAssimilationEvidencePayload(payload), 'utf8');
  const signature = sign(null, bytes, keyPairs[name].privateKey).toString('base64');
  return { payload, signature: signatureOverride ?? signature };
}

function verify(candidate, payload, name, keys = trustedKeys, options = { now: () => fixedNow }) {
  return evidence.verifyCodeAssimilationEvidence(
    candidate,
    signedArtifact(payload, name),
    keys,
    options,
  );
}

const candidate = createCandidate();
assert.equal(typeof evidence.verifyCodeAssimilationEvidence, 'function',
  'A2 exports the source-bound Ed25519 evidence verifier');
assert.equal(typeof evidence.canonicalCodeAssimilationEvidencePayload, 'function');
assert.equal(typeof evidence.isAuthenticatedCodeAssimilationEvidenceReceipt, 'function');
assert.equal(typeof evidence.isCodeAssimilationUseAllowed, 'function');
assert.equal(candidate.stage, 'discovered');

// Source provenance is bound to candidate, source/tree digests, issuer role and signature.
{
  const payload = payloadFor(candidate, 'source');
  const result = verify(candidate, payload, 'source');
  assert.equal(result.accepted, true);
  assert.equal(result.evidenceKind, 'source-provenance');
  assert.equal(result.receipt.candidateFingerprint, candidate.candidateFingerprint);
  assert.equal(evidence.isAuthenticatedCodeAssimilationEvidenceReceipt(result.receipt), true);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'execute', candidate.candidateFingerprint), false);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'execute', 'f'.repeat(64)), false,
    'a license receipt for another candidate must not authorize this candidate');
}
{
  const payload = payloadFor(candidate, 'source');
  const invalid = signedArtifact(payload, 'source', Buffer.alloc(64, 9).toString('base64'));
  const result = evidence.verifyCodeAssimilationEvidence(candidate, invalid, trustedKeys, { now: () => fixedNow });
  assert.equal(result.accepted, false);
  assert.equal(result.rejection, 'invalid-signature');
}
{
  const result = verify(candidate, payloadFor(candidate, 'source'), 'source', new Map());
  assert.equal(result.accepted, false);
  assert.equal(result.rejection, 'untrusted-issuer');
}
{
  const payload = payloadFor(candidate, 'source', { issuerRole: 'builder' });
  const signed = signedArtifact(payload, 'source');
  const result = evidence.verifyCodeAssimilationEvidence(candidate, signed, trustedKeys, { now: () => fixedNow });
  assert.equal(result.accepted, false);
  assert.equal(result.rejection, 'issuer-role-mismatch');
}
{
  const payload = payloadFor(candidate, 'source');
  const changed = { ...payload, candidateFingerprint: 'f'.repeat(64) };
  const result = verify(candidate, changed, 'source');
  assert.equal(result.accepted, false);
  assert.equal(result.rejection, 'candidate-binding-mismatch');
}
{
  const tamperedCandidate = structuredClone(candidate);
  tamperedCandidate.manifest.source.treeSha256 = '9'.repeat(64);
  const result = verify(tamperedCandidate, payloadFor(candidate, 'source'), 'source');
  assert.equal(result.accepted, false);
}

// SBOM attestations bind the exact lockfile and SBOM declared by the candidate.
{
  const result = verify(candidate, payloadFor(candidate, 'sbom'), 'sbom');
  assert.equal(result.accepted, true);
  assert.equal(result.evidenceKind, 'sbom');
}
{
  const payload = payloadFor(candidate, 'sbom', {
    materialFingerprints: { ...materialsFor(candidate), dependencyLockFingerprint: '8'.repeat(64) },
  });
  const result = verify(candidate, payload, 'sbom');
  assert.equal(result.accepted, false);
  assert.equal(result.rejection, 'material-binding-mismatch');
}
{
  const noSbom = structuredClone(candidate);
  noSbom.manifest.sbomFingerprint = null;
  const payload = payloadFor(candidate, 'sbom');
  const result = verify(noSbom, payload, 'sbom');
  assert.equal(result.accepted, false);
}

// Build attestations bind input materials and a distinct output artifact digest.
{
  const result = verify(candidate, payloadFor(candidate, 'builder'), 'builder');
  assert.equal(result.accepted, true);
  assert.equal(result.evidenceKind, 'build');
  assert.equal(result.receipt.subjectFingerprint, sha('built-component-output'));
}

// License decisions are signed, scoped and fail-closed; a declared license string is not approval.
{
  const result = verify(candidate, payloadFor(candidate, 'license'), 'license');
  assert.equal(result.accepted, true);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'study', candidate.candidateFingerprint), true);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'execute', candidate.candidateFingerprint), true);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'modify', candidate.candidateFingerprint), false);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'redistribute', candidate.candidateFingerprint), false);
}
{
  const payload = payloadFor(candidate, 'license', {
    licenseDecision: {
      outcome: 'research-only',
      licenseExpression: 'MIT',
      licenseEvidenceFingerprint: sha('license-and-notice-evidence-bundle'),
      permittedUses: ['study'],
      reviewScope: 'exact-source-revision-and-dependency-bundle',
      reviewerBasis: 'human-review',
    },
  });
  const result = verify(candidate, payload, 'license');
  assert.equal(result.accepted, true);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'study', candidate.candidateFingerprint), true);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'execute', candidate.candidateFingerprint), false);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'redistribute', candidate.candidateFingerprint), false);
  let nestedMutationRejected = false;
  try { result.receipt.licenseDecision.permittedUses.push('execute'); }
  catch { nestedMutationRejected = true; }
  assert.equal(nestedMutationRejected, true, 'authenticated receipt permissions must be deeply immutable');
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'execute', candidate.candidateFingerprint), false);
}
{
  const payload = payloadFor(candidate, 'license', {
    licenseDecision: {
      outcome: 'approved',
      licenseExpression: 'MIT',
      licenseEvidenceFingerprint: sha('license-and-notice-evidence-bundle'),
      permittedUses: ['study', 'execute', 'redistribute'],
      reviewScope: 'exact-source-revision-and-dependency-bundle',
      reviewerBasis: 'human-review',
    },
  });
  const result = verify(candidate, payload, 'license');
  assert.equal(result.accepted, true);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'redistribute', candidate.candidateFingerprint), true);
}
{
  const payload = payloadFor(candidate, 'license', {
    licenseDecision: {
      outcome: 'approved',
      licenseExpression: 'MIT',
      licenseEvidenceFingerprint: sha('license-and-notice-evidence-bundle'),
      permittedUses: ['redistribute'],
      reviewScope: 'exact-source-revision-and-dependency-bundle',
      reviewerBasis: 'human-review',
    },
  });
  const result = verify(candidate, payload, 'license');
  assert.equal(result.accepted, true);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'redistribute', candidate.candidateFingerprint), true);
  assert.equal(evidence.isCodeAssimilationUseAllowed(result.receipt, 'execute', candidate.candidateFingerprint), false);
}
{
  const payload = payloadFor(candidate, 'license', {
    licenseDecision: {
      outcome: 'rejected',
      licenseExpression: 'MIT',
      licenseEvidenceFingerprint: sha('license-and-notice-evidence-bundle'),
      permittedUses: ['study'],
      reviewScope: 'exact-source-revision-and-dependency-bundle',
      reviewerBasis: 'human-review',
    },
  });
  const result = verify(candidate, payload, 'license');
  assert.equal(result.accepted, false);
  assert.equal(result.rejection, 'code-assimilation-evidence-license-decision-inconsistent');
}
{
  const payload = payloadFor(candidate, 'license', {
    licenseDecision: {
      outcome: 'approved',
      licenseExpression: 'Apache-2.0',
      licenseEvidenceFingerprint: sha('license-and-notice-evidence-bundle'),
      permittedUses: ['execute'],
      reviewScope: 'exact-source-revision-and-dependency-bundle',
      reviewerBasis: 'human-review',
    },
  });
  const result = verify(candidate, payload, 'license');
  assert.equal(result.accepted, false);
  assert.equal(result.rejection, 'declared-license-mismatch');
}
{
  const payload = payloadFor(candidate, 'license');
  const result = verify(candidate, payload, 'license', trustedKeys, { now: () => fixedNow - 31_000 });
  assert.equal(result.accepted, false);
  assert.equal(result.rejection, 'issued-at-in-future');
}

// Unknown declared license plus a null reviewer expression cannot authorize execution or redistribution.
{
  const unlicensed = createCandidate(null);
  const payload = payloadFor(unlicensed, 'license', {
    subjectFingerprint: sha('unresolved-license-evidence'),
    licenseDecision: {
      outcome: 'approved',
      licenseExpression: null,
      licenseEvidenceFingerprint: sha('unresolved-license-evidence'),
      permittedUses: ['execute', 'redistribute'],
      reviewScope: 'exact-source-revision-and-dependency-bundle',
      reviewerBasis: 'human-review',
    },
  });
  const result = verify(unlicensed, payload, 'license');
  assert.equal(result.accepted, false);
  assert.equal(result.rejection, 'code-assimilation-evidence-license-expression-required');
}

// Authentication is process-local; a serialized receipt must be verified again after restart.
{
  const result = verify(candidate, payloadFor(candidate, 'license'), 'license');
  assert.equal(result.accepted, true);
  assert.equal(evidence.isAuthenticatedCodeAssimilationEvidenceReceipt(result.receipt), true);
  assert.equal(evidence.isAuthenticatedCodeAssimilationEvidenceReceipt(structuredClone(result.receipt)), false);
}

// Untrusted object descriptors must be rejected without running getters.
{
  const payload = payloadFor(candidate, 'source');
  let getterCalls = 0;
  const root = { payload, signature: 'AAAA' };
  Object.defineProperty(root, 'signature', {
    enumerable: true,
    get() { getterCalls += 1; return 'AAAA'; },
  });
  const result = evidence.verifyCodeAssimilationEvidence(candidate, root, trustedKeys, { now: () => fixedNow });
  assert.equal(result.accepted, false);
  assert.equal(getterCalls, 0);
}
{
  const payload = payloadFor(candidate, 'source');
  const malformed = signedArtifact(payload, 'source', 'not base64!');
  const result = evidence.verifyCodeAssimilationEvidence(candidate, malformed, trustedKeys, { now: () => fixedNow });
  assert.equal(result.accepted, false);
}

console.log(JSON.stringify({
  ok: true,
  suite: 'code-assimilation-evidence-workpass656',
  cases: 18,
  sourceSha: candidate.sourceFingerprint,
  candidateId: candidate.candidateId,
}));
