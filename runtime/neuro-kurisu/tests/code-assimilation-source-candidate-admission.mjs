import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCodeAssimilationCandidate } from '../src/organism/learning/CodeAssimilationContracts.ts';
import {
  canonicalCodeAssimilationEvidencePayload,
  codeAssimilationTrustKeyId,
  verifyCodeAssimilationEvidence,
} from '../src/organism/learning/CodeAssimilationEvidence.ts';
import {
  createCodeAssimilationSourceCandidateAuthorizationV1,
} from '../src/organism/learning/CodeAssimilationSourceCandidateAdmission.ts';
import {
  hashSourceCandidateTextV1,
  SourceCandidateWorkspaceV1,
} from '../src/organism/analysis/SourceCandidateWorkspace.ts';

const sha = value => createHash('sha256').update(value).digest('hex');
const now = 1_800_000_000_000;
const roles = {
  source: { id: 'source-verifier-1', role: 'source-verifier' },
  sbom: { id: 'sbom-scanner-1', role: 'sbom-scanner' },
  license: { id: 'license-reviewer-1', role: 'license-reviewer' },
};
const keys = Object.fromEntries(Object.keys(roles).map(name => [
  name,
  generateKeyPairSync('ed25519'),
]));
const trusted = new Map(Object.keys(roles).map(name => [
  codeAssimilationTrustKeyId(roles[name].role, roles[name].id),
  keys[name].publicKey.export({ type: 'spki', format: 'pem' }),
]));

function makeCandidate(immutableRevision = 'b'.repeat(40)) {
  return createCodeAssimilationCandidate({
    baseRuntimeSha: 'a'.repeat(40),
    createdAt: now - 20_000,
    manifest: {
      componentId: 'runtime.memory-adapter',
      componentVersion: '1.0.0',
      capabilityId: 'memory.adapter',
      interfaceVersion: '1.0.0',
      language: 'TypeScript',
      runtime: 'node>=24',
      source: {
        sourceKind: 'git',
        canonicalUri: 'https://github.com/example/donor',
        publisher: 'example-org',
        immutableRevision,
        contentSha256: sha('donor source content'),
        treeSha256: sha('donor source tree'),
        retrievedAt: now - 10_000,
      },
      dependencyLockFingerprint: sha('dependency lock'),
      sbomFingerprint: sha('sbom'),
      declaredLicenseExpression: 'MIT',
    },
  });
}

function materialFingerprints(candidate) {
  return {
    sourceContentSha256: candidate.manifest.source.contentSha256,
    sourceTreeSha256: candidate.manifest.source.treeSha256,
    dependencyLockFingerprint: candidate.manifest.dependencyLockFingerprint,
    sbomFingerprint: candidate.manifest.sbomFingerprint,
  };
}

function signedReceipt(candidate, name, licenseOverrides = {}) {
  const identity = roles[name];
  const licenseDecision = name === 'license' ? {
    outcome: 'approved',
    licenseExpression: 'MIT',
    licenseEvidenceFingerprint: sha('exact license evidence bundle'),
    permittedUses: ['study', 'modify'],
    reviewScope: 'exact-source-revision-and-dependency-bundle',
    reviewerBasis: 'human-review',
    ...licenseOverrides,
  } : undefined;
  const payload = {
    schemaVersion: 1,
    attestationId: 'admission:' + name + ':1',
    candidateId: candidate.candidateId,
    candidateFingerprint: candidate.candidateFingerprint,
    sourceFingerprint: candidate.sourceFingerprint,
    evidenceKind: name === 'source' ? 'source-provenance' : name === 'sbom' ? 'sbom' : 'license-decision',
    issuerId: identity.id,
    issuerRole: identity.role,
    issuedAt: now,
    subjectFingerprint: name === 'source' ? candidate.sourceFingerprint : name === 'sbom' ? candidate.manifest.sbomFingerprint : licenseDecision.licenseEvidenceFingerprint,
    materialFingerprints: materialFingerprints(candidate),
    ...(licenseDecision ? { licenseDecision } : {}),
  };
  const signature = sign(
    null,
    Buffer.from(canonicalCodeAssimilationEvidencePayload(payload), 'utf8'),
    keys[name].privateKey,
  ).toString('base64');
  const verified = verifyCodeAssimilationEvidence(candidate, { payload, signature }, trusted, { now: () => now });
  assert.equal(verified.accepted, true);
  return verified.receipt;
}

const candidate = makeCandidate();
const sourceReceipt = signedReceipt(candidate, 'source');
const sbomReceipt = signedReceipt(candidate, 'sbom');
const licenseReceipt = signedReceipt(candidate, 'license');
const baseFile = { path: 'runtime/adapter.ts', content: 'export const adapter = 1;\n' };
const replacement = 'export const adapter = 2;\n';
const baseTree = sha(JSON.stringify([[baseFile.path, hashSourceCandidateTextV1(baseFile.content)]]));
const temp = await mkdtemp(path.join(tmpdir(), 'nk1-source-admission-'));

try {
  let hostCalls = 0;
  let hostRequest = null;
  const authorization = createCodeAssimilationSourceCandidateAuthorizationV1({
    candidate,
    sourceProvenanceReceipt: sourceReceipt,
    sbomReceipt,
    licenseDecisionReceipt: licenseReceipt,
    verifyBaseSnapshot: request => {
      hostCalls++;
      hostRequest = request;
      return request.baseSha === candidate.baseRuntimeSha && request.beforeTreeSha256 === baseTree;
    },
  });
  const workspace = new SourceCandidateWorkspaceV1({
    workspaceRoot: path.join(temp, 'authorized'),
    authorize: authorization,
  });
  const result = await workspace.prepare({
    baseSha: candidate.baseRuntimeSha,
    files: [baseFile],
    edits: [{
      path: baseFile.path,
      expectedBeforeSha256: hashSourceCandidateTextV1(baseFile.content),
      replacement,
    }],
  });
  assert.equal(result.created, true, result.reason ?? 'candidate workspace should be admitted');
  assert.equal(result.executionStatus, 'not-executed');
  assert.equal(hostCalls, 1);
  assert.equal(hostRequest.baseSha, candidate.baseRuntimeSha);
  assert.equal(hostRequest.beforeTreeSha256, baseTree);
  assert.equal(hostRequest.changedFiles.length, 1);
  assert.ok(result.admissionReceiptId.startsWith('source-admission:' + candidate.candidateId + ':'));
  assert.equal(await readFile(path.join(result.candidateRoot, baseFile.path), 'utf8'), replacement);
  const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
  assert.equal(manifest.executionStatus, 'not-executed');
  assert.equal(manifest.admissionReceiptId, result.admissionReceiptId);

  let wrongBaseVerifierCalls = 0;
  const wrongBaseWorkspace = new SourceCandidateWorkspaceV1({
    workspaceRoot: path.join(temp, 'wrong-base'),
    authorize: createCodeAssimilationSourceCandidateAuthorizationV1({
      candidate,
      sourceProvenanceReceipt: sourceReceipt,
      licenseDecisionReceipt: licenseReceipt,
      verifyBaseSnapshot: () => { wrongBaseVerifierCalls++; return true; },
    }),
  });
  const wrongBase = await wrongBaseWorkspace.prepare({
    baseSha: 'c'.repeat(40),
    files: [baseFile],
    edits: [{ path: baseFile.path, expectedBeforeSha256: hashSourceCandidateTextV1(baseFile.content), replacement }],
  });
  assert.equal(wrongBase.created, false);
  assert.equal(wrongBase.reason, 'source-candidate-base-runtime-binding-mismatch');
  assert.equal(wrongBaseVerifierCalls, 0, 'wrong-base candidates must fail before host verification');

  let rejectedHostCalls = 0;
  const rejectedWorkspace = new SourceCandidateWorkspaceV1({
    workspaceRoot: path.join(temp, 'host-reject'),
    authorize: createCodeAssimilationSourceCandidateAuthorizationV1({
      candidate,
      sourceProvenanceReceipt: sourceReceipt,
      licenseDecisionReceipt: licenseReceipt,
      verifyBaseSnapshot: () => { rejectedHostCalls++; return false; },
    }),
  });
  const rejected = await rejectedWorkspace.prepare({
    baseSha: candidate.baseRuntimeSha,
    files: [baseFile],
    edits: [{ path: baseFile.path, expectedBeforeSha256: hashSourceCandidateTextV1(baseFile.content), replacement }],
  });
  assert.equal(rejected.created, false);
  assert.equal(rejected.reason, 'source-candidate-host-snapshot-not-verified');
  assert.equal(rejectedHostCalls, 1);
  assert.deepEqual(await readdir(path.join(temp, 'host-reject')), [],
    'a rejected host snapshot must never leave a candidate directory');

  const throwingWorkspace = new SourceCandidateWorkspaceV1({
    workspaceRoot: path.join(temp, 'host-throws'),
    authorize: createCodeAssimilationSourceCandidateAuthorizationV1({
      candidate,
      sourceProvenanceReceipt: sourceReceipt,
      licenseDecisionReceipt: licenseReceipt,
      verifyBaseSnapshot: () => { throw new Error('host unavailable'); },
    }),
  });
  const thrown = await throwingWorkspace.prepare({
    baseSha: candidate.baseRuntimeSha,
    files: [baseFile],
    edits: [{ path: baseFile.path, expectedBeforeSha256: hashSourceCandidateTextV1(baseFile.content), replacement }],
  });
  assert.equal(thrown.created, false);
  assert.equal(thrown.reason, 'source-candidate-host-snapshot-verifier-failed');
} finally {
  await rm(temp, { recursive: true, force: true });
}

assert.throws(() => createCodeAssimilationSourceCandidateAuthorizationV1({
  candidate,
  sourceProvenanceReceipt: sourceReceipt,
  licenseDecisionReceipt: licenseReceipt,
  verifyBaseSnapshot: () => true,
}), /sbom-receipt-required/,
'a valid source and license receipt cannot bypass independent SBOM attestation');

assert.throws(() => createCodeAssimilationSourceCandidateAuthorizationV1({
  candidate,
  sourceProvenanceReceipt: sourceReceipt,
  sbomReceipt: signedReceipt(makeCandidate('d'.repeat(40)), 'sbom'),
  licenseDecisionReceipt: licenseReceipt,
  verifyBaseSnapshot: () => true,
}), /sbom-receipt-required/,
'an SBOM receipt bound to another immutable donor cannot authorize this candidate');

assert.throws(() => createCodeAssimilationSourceCandidateAuthorizationV1({
  candidate,
  sourceProvenanceReceipt: structuredClone(sourceReceipt),
  sbomReceipt,
  licenseDecisionReceipt: licenseReceipt,
  verifyBaseSnapshot: () => true,
}), /source-provenance-receipt-required/,
'serialized receipts cannot be re-used as authenticated evidence after process-boundary loss');

assert.throws(() => createCodeAssimilationSourceCandidateAuthorizationV1({
  candidate,
  sourceProvenanceReceipt: sourceReceipt,
  sbomReceipt,
  licenseDecisionReceipt: signedReceipt(candidate, 'license', { outcome: 'research-only', permittedUses: ['study'] }),
  verifyBaseSnapshot: () => true,
}), /license-modify-approval-required/,
'study-only/research-only permission cannot authorize candidate modification');

const otherCandidate = makeCandidate('c'.repeat(40));
assert.notEqual(otherCandidate.candidateFingerprint, candidate.candidateFingerprint,
  'the other donor fixture must have a distinct immutable source fingerprint');
const otherSourceReceipt = signedReceipt(otherCandidate, 'source');
assert.throws(() => createCodeAssimilationSourceCandidateAuthorizationV1({
  candidate,
  sourceProvenanceReceipt: otherSourceReceipt,
  sbomReceipt,
  licenseDecisionReceipt: licenseReceipt,
  verifyBaseSnapshot: () => true,
}), /source-provenance-receipt-required/,
'provenance from another candidate cannot authorize this workspace');

const otherLicenseReceipt = signedReceipt(otherCandidate, 'license');
assert.throws(() => createCodeAssimilationSourceCandidateAuthorizationV1({
  candidate,
  sourceProvenanceReceipt: sourceReceipt,
  sbomReceipt,
  licenseDecisionReceipt: otherLicenseReceipt,
  verifyBaseSnapshot: () => true,
}), /license-modify-approval-required/,
'a modify approval from another candidate cannot authorize this workspace');

assert.throws(() => createCodeAssimilationSourceCandidateAuthorizationV1({
  candidate,
  sourceProvenanceReceipt: sourceReceipt,
  sbomReceipt,
  licenseDecisionReceipt: signedReceipt(candidate, 'license', { permittedUses: ['study', 'execute'] }),
  verifyBaseSnapshot: () => true,
}), /license-modify-approval-required/,
'an execution-only license does not imply permission to modify source');

assert.throws(() => createCodeAssimilationSourceCandidateAuthorizationV1({
  candidate,
  sourceProvenanceReceipt: sourceReceipt,
  sbomReceipt,
  licenseDecisionReceipt: structuredClone(licenseReceipt),
  verifyBaseSnapshot: () => true,
}), /license-modify-approval-required/,
'copied license receipts are not authenticated');

assert.throws(() => createCodeAssimilationSourceCandidateAuthorizationV1({
  candidate,
  sourceProvenanceReceipt: sourceReceipt,
  sbomReceipt,
  licenseDecisionReceipt: licenseReceipt,
}), /host-verifier-required/,
'a trusted host snapshot verifier is mandatory');

console.log('CODE_ASSIMILATION_SOURCE_CANDIDATE_ADMISSION_V1=PASS');
