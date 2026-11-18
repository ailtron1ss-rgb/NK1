import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { createSignedSynapticArtifact, synapticArtifactFingerprint, synapticAttestationSigningPayload } from '../src/organism/learning/SynapticCommons.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import { createSynapticP23AdmissionProvider } from '../src/organism/learning/SynapticP23OutcomeBundleProvider.ts';
import { signSkillShadowArtifactForFixture, skillShadowPayloadFingerprint } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';
import { createSkillPromotionApprovalPayload, canonicalSkillPromotionApprovalPayload } from '../src/organism/learning/AuthenticatedSkillPromotionApproval.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-synaptic-p23-admission-'));
const previous = {
  publisher: process.env.NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON,
  attestor: process.env.NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON,
  licence: process.env.NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON,
  shadowVerifiers: process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON,
  approvalKeys: process.env.NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON,
};
const now = Date.now();
const environmentFingerprint = 'e'.repeat(64);
const host = {
  runtimeVersion: '1.2.0',
  environmentFingerprint,
  supportedCapabilities: ['documents.read', 'documents.summarize', 'neurocore.policy.preference'],
  permittedTools: ['documents.fetch'],
};

function ed25519Pair() {
  const pair = generateKeyPairSync('ed25519');
  return {
    publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: pair.privateKey,
  };
}

const publisher = ed25519Pair();
const attestor = ed25519Pair();
const outcomeVerifier = ed25519Pair();
const shadowVerifier = ed25519Pair();
const approvalAuthority = ed25519Pair();
const outcomeVerifierId = 'synaptic-p23-local-verifier';
const shadowVerifierId = 'synaptic-p23-shadow-verifier';
const approvalAuthorityId = 'synaptic-p23-approval-authority';
process.env.NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON = JSON.stringify({ 'publisher-1': publisher.publicKey });
process.env.NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON = JSON.stringify({ 'attestor-1': attestor.publicKey });
process.env.NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON = JSON.stringify(['b'.repeat(64)]);
process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = JSON.stringify({
  [outcomeVerifierId]: outcomeVerifier.publicKey,
  [shadowVerifierId]: shadowVerifier.publicKey,
});
process.env.NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON = JSON.stringify({
  [approvalAuthorityId]: approvalAuthority.publicKey,
});

const unsignedArtifact = {
  schemaVersion: 1,
  skill: {
    skillId: 'portable-summary',
    name: 'Portable document summary',
    version: '1.0.0',
    summary: 'A declarative summary skill evaluated locally before P23 staging.',
    kind: 'procedure',
  },
  contract: {
    capability: 'documents.summarize',
    requiredCapabilities: ['documents.read'],
    requiredTools: ['documents.fetch'],
    permissionClass: 'assisted',
    allowedModes: ['assisted'],
    minimumRuntimeVersion: '1.0.0',
    environmentFingerprint,
  },
  definition: {
    format: 'declarative-json-v1',
    payload: { steps: [{ operation: 'invoke-capability', capability: 'documents.fetch' }] },
  },
  provenance: {
    sourceInstanceId: 'remote-neurocore-instance',
    sourceRuntimeVersion: '1.2.0',
    sourceArtifactFingerprint: 'a'.repeat(64),
    createdAt: now,
  },
  license: {
    identifier: 'Apache-2.0',
    redistributionAllowed: true,
    reviewFingerprint: 'b'.repeat(64),
  },
};
const artifact = createSignedSynapticArtifact(unsignedArtifact, 'publisher-1', artifactFingerprint =>
  sign(null, Buffer.from(artifactFingerprint, 'utf8'), publisher.privateKey).toString('base64'));
const fingerprint = synapticArtifactFingerprint(artifact);

const attestation = {
  schemaVersion: 1,
  artifactFingerprint: fingerprint,
  attestorId: 'attestor-1',
  runtimeVersion: host.runtimeVersion,
  environmentFingerprint,
  testSuiteFingerprint: 'c'.repeat(64),
  holdoutFingerprint: 'd'.repeat(64),
  independentSeedCount: 5,
  holdoutSamples: 5,
  baselinePasses: 3,
  candidatePasses: 4,
  issuedAt: now,
  expiresAt: now + 7 * 24 * 60 * 60_000,
  signature: { algorithm: 'Ed25519', value: 'A'.repeat(88) },
};
attestation.signature.value = sign(
  null,
  Buffer.from(synapticAttestationSigningPayload(attestation), 'utf8'),
  attestor.privateKey,
).toString('base64');

const nativeUnsignedArtifact = {
  schemaVersion: 1,
  skill: {
    skillId: 'portable-verify-bias',
    name: 'Verified policy preference',
    version: '1.0.0',
    summary: 'A bounded local preference for the existing verify action in a fixed six-dimensional need context.',
    kind: 'abstraction',
  },
  contract: {
    capability: 'neurocore.policy.preference',
    requiredCapabilities: ['neurocore.policy.preference'],
    requiredTools: [],
    permissionClass: 'read-only',
    allowedModes: ['assisted'],
    minimumRuntimeVersion: '1.0.0',
    environmentFingerprint,
  },
  definition: {
    format: 'declarative-json-v1',
    payload: {
      schemaVersion: 1,
      schema: 'nk1-policy-bias-v1',
      action: 'verify',
      contextNeeds: {
        energy: 0.6,
        cognitiveLoad: 0.2,
        uncertainty: 0.8,
        novelty: 0.25,
        goalPressure: 0.8,
        socialNeed: 0.25,
      },
    },
  },
  provenance: {
    sourceInstanceId: 'remote-neurocore-instance',
    sourceRuntimeVersion: '1.2.0',
    sourceArtifactFingerprint: 'a'.repeat(64),
    createdAt: now,
  },
  license: {
    identifier: 'Apache-2.0',
    redistributionAllowed: true,
    reviewFingerprint: 'b'.repeat(64),
  },
};
const nativeArtifact = createSignedSynapticArtifact(nativeUnsignedArtifact, 'publisher-1', artifactFingerprint =>
  sign(null, Buffer.from(artifactFingerprint, 'utf8'), publisher.privateKey).toString('base64'));
const nativeFingerprint = synapticArtifactFingerprint(nativeArtifact);
const nativeAttestation = {
  ...JSON.parse(JSON.stringify(attestation)),
  artifactFingerprint: nativeFingerprint,
  signature: { algorithm: 'Ed25519', value: 'A'.repeat(88) },
};
nativeAttestation.signature.value = sign(
  null,
  Buffer.from(synapticAttestationSigningPayload(nativeAttestation), 'utf8'),
  attestor.privateKey,
).toString('base64');

function buildSignedOutcomeBundle(candidateMethod) {
  const verifierId = outcomeVerifierId;
  const manifest = Array.from({ length: 10 }, (_, index) => ({
    taskId: 'synaptic-local-task-' + index,
    family: index < 5 ? 'document-summary' : 'tool-use',
    split: 'holdout',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('unique local P23 evaluation task ' + index),
    verifierId,
    version: 'v1',
  }));
  const manifestLedger = new VerifiedOutcomeLedger(manifest);
  const outcomePrivatePem = outcomeVerifier.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const artifacts = [];
  for (let seed = 1; seed <= 5; seed += 1) {
    for (let index = 0; index < manifest.length; index += 1) {
      for (const [method, passed] of [['baseline', index < 6], [candidateMethod, index < 8]]) {
        const task = manifest[index];
        artifacts.push(signOutcomePayloadForFixture({
          schemaVersion: 1,
          artifactId: 'local-' + task.taskId + '-' + method + '-' + seed,
          runId: 'local-run-' + method + '-' + seed,
          manifestFingerprint: manifestLedger.manifestFingerprint(),
          taskId: task.taskId,
          taskVersion: task.version,
          method,
          seed,
          attempt: 1,
          passed,
          verifierId,
          observedAt: Date.now(),
        }, outcomePrivatePem));
      }
    }
  }
  return { schemaVersion: 1, manifest, baselineMethod: 'baseline', candidateMethod, artifacts };
}

function buildLocalProposal(candidateMethod) {
  const bundle = buildSignedOutcomeBundle(candidateMethod);
  const ledger = new VerifiedOutcomeLedger(bundle.manifest);
  const trustedKeys = new Map([[outcomeVerifierId, outcomeVerifier.publicKey]]);
  for (const signed of bundle.artifacts) {
    const ingested = ingestSignedOutcomeArtifact(ledger, bundle.manifest, signed, trustedKeys);
    assert.equal(ingested.accepted, true, 'local signed outcome rejected: ' + ingested.rejection);
  }
  return proposeVerifiedSkillPromotion(ledger, bundle.baselineMethod, bundle.candidateMethod, {
    minPairedTasks: 8, minAbsoluteGain: 0.1, minCompleteSeeds: 5,
  });
}

const outcomeBundlePath = path.join(root, 'synaptic-p23-outcomes.json');
await writeFile(outcomeBundlePath, JSON.stringify(buildSignedOutcomeBundle('synaptic-commons:' + fingerprint)));
const builtInProposalProvider = createSynapticP23AdmissionProvider({
  bundlePath: outcomeBundlePath,
  rawVerifierKeys: process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON,
});
if (process.platform !== 'win32') {
  const linkedBundlePath = path.join(root, 'linked-outcomes.json');
  await symlink(outcomeBundlePath, linkedBundlePath);
  const linkedProvider = createSynapticP23AdmissionProvider({
    bundlePath: linkedBundlePath,
    rawVerifierKeys: process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON,
  });
  await assert.rejects(
    () => linkedProvider({ candidateMethod: 'synaptic-commons:' + fingerprint }),
    /symlink-or-non-regular-file-rejected/,
    'the host evidence reader must not follow a symbolic link');
}
await assert.rejects(
  () => builtInProposalProvider({ candidateMethod: 'synaptic-commons:' + 'f'.repeat(64) }),
  /outcome-bundle-shape-or-method-binding-invalid/,
  'the host evidence file cannot be reused for another artifact fingerprint',
);
const staleBundlePath = path.join(root, 'stale-outcomes.json');
const staleBundle = buildSignedOutcomeBundle('synaptic-commons:' + fingerprint);
staleBundle.artifacts[0].payload.observedAt = Date.now() - 31 * 24 * 60 * 60_000;
await writeFile(staleBundlePath, JSON.stringify(staleBundle));
const staleProposalProvider = createSynapticP23AdmissionProvider({
  bundlePath: staleBundlePath,
  rawVerifierKeys: process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON,
});
await assert.rejects(
  () => staleProposalProvider({ candidateMethod: 'synaptic-commons:' + fingerprint }),
  /outcome-artifact-time-out-of-window/,
  'old local holdout results cannot be reused as current P23 evidence',
);

let proposalMode = 'valid';
let localProposalCalls = 0;
let hostDrift = false;
let runtimeStopped = false;
let activeOutcomeBundleMethod = 'synaptic-commons:' + fingerprint;
const runtime = new OrganismRuntime({
  stateFile: path.join(root, 'organism.json'),
  autoRun: false,
  enableLanguage: false,
  synapticP23Admission: {
    currentHostCompatibilityTarget: () => hostDrift
      ? { ...host, permittedTools: [] }
      : { ...host },
    createLocalPromotionProposal: async ({ candidateMethod }) => {
      if (candidateMethod !== activeOutcomeBundleMethod) {
        await writeFile(outcomeBundlePath, JSON.stringify(buildSignedOutcomeBundle(candidateMethod)));
        activeOutcomeBundleMethod = candidateMethod;
      }
      if (candidateMethod !== 'synaptic-commons:' + fingerprint) {
        return builtInProposalProvider({ candidateMethod });
      }
      localProposalCalls += 1;
      const actualMethod = proposalMode === 'wrong-method'
        ? 'synaptic-commons:' + 'f'.repeat(64)
        : candidateMethod;
      const proposal = proposalMode === 'valid' || proposalMode === 'host-drift'
        ? await builtInProposalProvider({ candidateMethod })
        : buildLocalProposal(actualMethod);
      if (proposalMode === 'host-drift') hostDrift = true;
      return proposalMode === 'serialized' ? JSON.parse(JSON.stringify(proposal)) : proposal;
    },
  },
});

try {
  await runtime.init();
  const imported = await runtime.importSynapticArtifact(artifact);
  assert.equal(imported.record.status, 'quarantined');
  const compatible = await runtime.evaluateSynapticSkillCompatibility(fingerprint, host);
  assert.equal(compatible.status, 'compatible');

  const unconfirmed = await runtime.stageSynapticSkillCandidate(fingerprint, false);
  assert.equal(unconfirmed.status, 'confirmation-required');
  assert.equal(localProposalCalls, 0, 'local evaluator is never invoked without explicit confirmation');

  await runtime.attestSynapticSkill(fingerprint, attestation);
  proposalMode = 'serialized';
  await assert.rejects(
    () => runtime.stageSynapticSkillCandidate(fingerprint, true),
    /authentic-accepted-proposal/,
    'JSON-shaped promotion data must not replace the process-authentic local proposal',
  );
  proposalMode = 'wrong-method';
  await assert.rejects(
    () => runtime.stageSynapticSkillCandidate(fingerprint, true),
    /candidate-method-binding-mismatch/,
    'local holdout evidence must name the exact imported artifact fingerprint',
  );
  proposalMode = 'host-drift';
  await assert.rejects(
    () => runtime.stageSynapticSkillCandidate(fingerprint, true),
    /host-manifest-changed-during-evaluation/,
    'host capability/tool drift during local evaluation must invalidate admission');
  hostDrift = false;
  proposalMode = 'valid';
  const staged = await runtime.stageSynapticSkillCandidate(fingerprint, true);
  assert.equal(staged.status, 'staged');
  assert.equal(staged.artifactFingerprint, fingerprint);
  assert.equal(staged.canActivateAutomatically, false);
  assert.equal(staged.promotionBlockedUntilNativeAdapter, true);
  assert.match(staged.candidateId, /^[a-f0-9]{64}$/);
  assert.equal(localProposalCalls, 4);

  const canonicalCoreSnapshot = runtime.core.verifiedSkillCandidateSnapshot();
  assert.ok(
    canonicalCoreSnapshot?.candidates.some(item => item.candidateId === staged.candidateId),
    'Synaptic admission must stage into OrganismCore canonical P23 store, not a detached engine store',
  );

  const snapshot = runtime.core.verifiedSkillCandidateSnapshot();
  assert.deepEqual(snapshot.active, [], 'Synaptic import must never activate a local P23 skill');
  const candidate = snapshot.candidates.find(item => item.candidateId === staged.candidateId);
  assert.equal(candidate.status, 'staged');
  assert.equal(candidate.payload.admissionKind, 'synaptic-commons-p23-review-v1');
  assert.equal(candidate.payload.artifactFingerprint, fingerprint);
  assert.equal(candidate.payload.activation.canActivateAutomatically, false);
  assert.equal(candidate.payload.localEvidence.candidateMethod, 'synaptic-commons:' + fingerprint);

  assert.throws(() => runtime.core.recordVerifiedSkillShadow(staged.candidateId, {
    runId: 'synaptic-blocked-shadow',
    evidenceFingerprint: '1'.repeat(64),
    passed: true,
    observedAt: Date.now(),
  }), /synaptic-candidate-requires-native-adapter/,
  'the generic P23 shadow runner cannot execute a portable review envelope');
  assert.throws(() => runtime.core.approveVerifiedSkillCandidate(staged.candidateId, {
    approvedBy: 'test-authority',
    approvedAt: Date.now() + 1000,
    expectedActiveVersion: null,
  }, 3), /synaptic-candidate-requires-native-adapter/);
  assert.deepEqual(snapshot.active, [],
    'a portable review envelope cannot enter shadow execution or promotion');

  const restartedCore = new OrganismCore(new FileStateStore(path.join(root, 'organism.json')));
  const restored = restartedCore.verifiedSkillCandidateSnapshot();
  assert.equal(restored.candidates[0].status, 'staged');
  assert.deepEqual(restored.active, []);
  assert.equal((await runtime.synapticCommonsDiagnostics()).executableCount, 0);

  const nativeImported = await runtime.importSynapticArtifact(nativeArtifact);
  assert.equal(nativeImported.record.status, 'quarantined');
  const nativeCompatible = await runtime.evaluateSynapticSkillCompatibility(nativeFingerprint, host);
  assert.equal(nativeCompatible.status, 'compatible');
  await runtime.attestSynapticSkill(nativeFingerprint, nativeAttestation);

  assert.equal(
    typeof runtime.stageSynapticNativePolicySkillCandidate,
    'function',
    'the host-owned native P23 policy adapter must be exposed by OrganismRuntime',
  );
  const nativeStaged = await runtime.stageSynapticNativePolicySkillCandidate(nativeFingerprint, true);
  assert.equal(nativeStaged.status, 'staged');
  assert.equal(nativeStaged.nativePolicy, true);
  assert.equal(nativeStaged.canActivateAutomatically, false);
  assert.equal(nativeStaged.executable, false);

  const nativeSnapshot = runtime.core.verifiedSkillCandidateSnapshot();
  const nativeCandidate = nativeSnapshot.candidates.find(item => item.candidateId === nativeStaged.candidateId);
  assert.ok(nativeCandidate, 'native policy candidate must be in the canonical Core P23 store');
  assert.equal(nativeCandidate.status, 'staged');
  assert.equal(nativeCandidate.payload.id, 'synaptic-commons:portable-verify-bias');
  assert.equal(nativeCandidate.payload.action, 'verify');
  assert.equal(nativeCandidate.payload.contextKey, 'e2|c1|u2|n1|g2|s1');
  assert.equal(nativeCandidate.payload.validationUses, 50);
  assert.equal(nativeCandidate.payload.validationSuccess01, 0.8);
  assert.ok(nativeCandidate.payload.confidence01 > 0.37 && nativeCandidate.payload.confidence01 < 0.38,
    'confidence must use five independent seed clusters, not fifty correlated task×seed cells');
  assert.equal(nativeCandidate.payload.synapticCommonsProvenance.artifactFingerprint, nativeFingerprint);
  assert.equal(nativeCandidate.payload.synapticCommonsProvenance.publisherKeyId, 'publisher-1');
  assert.equal(nativeCandidate.payload.synapticCommonsProvenance.attestorId, 'attestor-1');
  assert.equal(nativeCandidate.payload.synapticCommonsProvenance.localOutcomeFingerprint, nativeCandidate.proposalOutcomeFingerprint);
  assert.equal(nativeSnapshot.active.some(item => item.skillId === nativeCandidate.skillId), false,
    'native materialization remains staged until normal P23 signed shadow and approval gates complete');

  const nativeCountBeforeRepeat = nativeSnapshot.candidates.filter(item =>
    item.payload?.synapticCommonsProvenance?.artifactFingerprint === nativeFingerprint).length;
  const nativeRepeat = await runtime.stageSynapticNativePolicySkillCandidate(nativeFingerprint, true);
  const nativeAfterRepeat = runtime.core.verifiedSkillCandidateSnapshot();
  assert.equal(nativeRepeat.candidateId, nativeStaged.candidateId,
    'the same artifact fingerprint and local outcome dataset must be idempotent');
  assert.equal(nativeAfterRepeat.candidates.filter(item =>
    item.payload?.synapticCommonsProvenance?.artifactFingerprint === nativeFingerprint).length,
  nativeCountBeforeRepeat, 're-importing identical evidence must not create duplicate native P23 candidates');
  assert.deepEqual(runtime.core.p23TopSkills().filter(item => item.id === nativeCandidate.skillId), [],
    'a staged policy record cannot influence the live P23 skill resolver');

  const invalidNativeUnsigned = JSON.parse(JSON.stringify(nativeUnsignedArtifact));
  invalidNativeUnsigned.skill.skillId = 'portable-verify-bias-invalid';
  invalidNativeUnsigned.skill.name = 'Invalid portable policy';
  invalidNativeUnsigned.definition.payload.steps = [{ operation: 'invoke-capability', capability: 'documents.fetch' }];
  const invalidNativeArtifact = createSignedSynapticArtifact(invalidNativeUnsigned, 'publisher-1', artifactFingerprint =>
    sign(null, Buffer.from(artifactFingerprint, 'utf8'), publisher.privateKey).toString('base64'));
  const invalidNativeFingerprint = synapticArtifactFingerprint(invalidNativeArtifact);
  const invalidNativeAttestation = {
    ...JSON.parse(JSON.stringify(nativeAttestation)),
    artifactFingerprint: invalidNativeFingerprint,
    signature: { algorithm: 'Ed25519', value: 'A'.repeat(88) },
  };
  invalidNativeAttestation.signature.value = sign(
    null,
    Buffer.from(synapticAttestationSigningPayload(invalidNativeAttestation), 'utf8'),
    attestor.privateKey,
  ).toString('base64');
  const beforeInvalidNative = runtime.core.verifiedSkillCandidateSnapshot().candidates.length;
  await runtime.importSynapticArtifact(invalidNativeArtifact);
  const invalidCompatible = await runtime.evaluateSynapticSkillCompatibility(invalidNativeFingerprint, host);
  assert.equal(invalidCompatible.status, 'compatible');
  await runtime.attestSynapticSkill(invalidNativeFingerprint, invalidNativeAttestation);
  await assert.rejects(
    () => runtime.stageSynapticNativePolicySkillCandidate(invalidNativeFingerprint, true),
    /native-policy-schema|unknown-field|capability|tool/,
    'tool/capability operations and unknown fields must not be accepted as P23 policy skills',
  );
  assert.equal(runtime.core.verifiedSkillCandidateSnapshot().candidates.length, beforeInvalidNative,
    'invalid native DSL must not mutate the canonical P23 candidate store');

  // Create a second native package whose context is exactly the live OrganismCore
  // context. Its preference bias must become observable only after signed shadow
  // execution receipts and a detached approval from a separate authority.
  const liveNeeds = runtime.core.operationalStatusSnapshot().needs;
  const liveNativeUnsigned = JSON.parse(JSON.stringify(nativeUnsignedArtifact));
  liveNativeUnsigned.skill.skillId = 'portable-verify-bias-live';
  liveNativeUnsigned.skill.name = 'Live-context verified policy preference';
  liveNativeUnsigned.definition.payload.contextNeeds = {
    energy: liveNeeds.energy,
    cognitiveLoad: liveNeeds.cognitiveLoad,
    uncertainty: liveNeeds.uncertainty,
    novelty: liveNeeds.novelty,
    goalPressure: liveNeeds.goalPressure,
    socialNeed: liveNeeds.socialNeed,
  };
  const liveNativeArtifact = createSignedSynapticArtifact(liveNativeUnsigned, 'publisher-1', artifactFingerprint =>
    sign(null, Buffer.from(artifactFingerprint, 'utf8'), publisher.privateKey).toString('base64'));
  const liveNativeFingerprint = synapticArtifactFingerprint(liveNativeArtifact);
  const liveNativeAttestation = {
    ...JSON.parse(JSON.stringify(nativeAttestation)),
    artifactFingerprint: liveNativeFingerprint,
    signature: { algorithm: 'Ed25519', value: 'A'.repeat(88) },
  };
  liveNativeAttestation.signature.value = sign(
    null,
    Buffer.from(synapticAttestationSigningPayload(liveNativeAttestation), 'utf8'),
    attestor.privateKey,
  ).toString('base64');

  const biasBeforeActivation = runtime.core.p23SkillBias('verify');
  await runtime.importSynapticArtifact(liveNativeArtifact);
  const liveCompatible = await runtime.evaluateSynapticSkillCompatibility(liveNativeFingerprint, host);
  assert.equal(liveCompatible.status, 'compatible');
  await runtime.attestSynapticSkill(liveNativeFingerprint, liveNativeAttestation);
  const liveNativeStaged = await runtime.stageSynapticNativePolicySkillCandidate(liveNativeFingerprint, true);
  assert.equal(liveNativeStaged.status, 'staged');
  assert.equal(liveNativeStaged.executable, false);

  let shadowCandidate = runtime.core.verifiedSkillCandidateSnapshot().candidates
    .find(item => item.candidateId === liveNativeStaged.candidateId);
  assert.ok(shadowCandidate);
  const shadowManifestFingerprint = '9'.repeat(64);
  const shadowVerifierPrivatePem = shadowVerifier.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  const recordNativeShadow = (index) => {
    const runId = 'synaptic-native-shadow-run-' + index;
    const taskId = 'synaptic-native-shadow-task-' + index;
    const seed = 101 + index;
    const observedAt = Date.now();
    const context = {
      runId, taskId, seed,
      manifestFingerprint: shadowManifestFingerprint,
      runtimeVersion: host.runtimeVersion,
    };
    runtime.core.registerTrustedSkillShadowRun(context);
    const payload = {
      schemaVersion: 1,
      artifactId: 'synaptic-native-shadow-artifact-' + index,
      candidateId: shadowCandidate.candidateId,
      skillId: shadowCandidate.skillId,
      candidateVersion: shadowCandidate.version,
      payloadFingerprint: shadowCandidate.payloadFingerprint,
      proposalOutcomeFingerprint: shadowCandidate.proposalOutcomeFingerprint,
      runId, taskId,
      manifestFingerprint: shadowManifestFingerprint,
      seed,
      runtimeVersion: host.runtimeVersion,
      passed: true,
      observedAt,
      verifierId: shadowVerifierId,
    };
    const signedArtifact = signSkillShadowArtifactForFixture(payload, shadowVerifierPrivatePem);
    runtime.core.recordVerifiedSkillShadow(shadowCandidate.candidateId, {
      runId,
      evidenceFingerprint: skillShadowPayloadFingerprint(payload),
      passed: true,
      observedAt,
      artifact: signedArtifact,
    });
    shadowCandidate = runtime.core.verifiedSkillCandidateSnapshot().candidates
      .find(item => item.candidateId === shadowCandidate.candidateId);
    assert.ok(shadowCandidate);
  };

  recordNativeShadow(0);
  recordNativeShadow(1);
  const twoRunApprovalPayload = createSkillPromotionApprovalPayload(
    shadowCandidate, approvalAuthorityId, 'synaptic-native-approval-two-runs',
    Date.now(), null, 3,
  );
  const twoRunApproval = {
    approvedBy: approvalAuthorityId,
    approvedAt: twoRunApprovalPayload.approvedAt,
    expectedActiveVersion: null,
    artifact: {
      payload: twoRunApprovalPayload,
      signature: sign(
        null,
        Buffer.from(canonicalSkillPromotionApprovalPayload(twoRunApprovalPayload), 'utf8'),
        approvalAuthority.privateKey,
      ).toString('base64'),
    },
  };
  assert.throws(
    () => runtime.core.approveVerifiedSkillCandidate(shadowCandidate.candidateId, twoRunApproval, 3),
    /shadow gate requires enough runs/,
    'the detached approval cannot bypass the three-run shadow minimum',
  );

  recordNativeShadow(2);
  assert.throws(
    () => runtime.core.approveVerifiedSkillCandidate(shadowCandidate.candidateId, twoRunApproval, 3),
    /promotion approval is not authenticated/,
    'an approval signed before the final shadow receipt cannot be replayed after evidence changes',
  );
  shadowCandidate = runtime.core.verifiedSkillCandidateSnapshot().candidates
    .find(item => item.candidateId === shadowCandidate.candidateId);
  const finalApprovalPayload = createSkillPromotionApprovalPayload(
    shadowCandidate, approvalAuthorityId, 'synaptic-native-approval-final',
    Date.now(), null, 3,
  );
  const finalApproval = {
    approvedBy: approvalAuthorityId,
    approvedAt: finalApprovalPayload.approvedAt,
    expectedActiveVersion: null,
    artifact: {
      payload: finalApprovalPayload,
      signature: sign(
        null,
        Buffer.from(canonicalSkillPromotionApprovalPayload(finalApprovalPayload), 'utf8'),
        approvalAuthority.privateKey,
      ).toString('base64'),
    },
  };
  const activeVersion = runtime.core.approveVerifiedSkillCandidate(shadowCandidate.candidateId, finalApproval, 3);
  assert.equal(activeVersion.skillId, shadowCandidate.skillId);

  const activeSnapshot = runtime.core.verifiedSkillCandidateSnapshot();
  assert.ok(activeSnapshot.active.some(item =>
    item.skillId === 'synaptic-commons:portable-verify-bias-live'),
  'only the native P23 policy record may become active after signed shadow and approval');
  assert.ok(runtime.core.p23TopSkills().some(item =>
    item.id === 'synaptic-commons:portable-verify-bias-live' && item.status === 'promoted'),
  'the live P23 resolver must load the authenticated active PolicySkillRecord');
  const liveBias = runtime.core.p23SkillBias('verify');
  assert.ok(liveBias > biasBeforeActivation && liveBias > 0 && liveBias < 0.05,
    'the promoted adapter may only apply the bounded P23 preference bias, not execute a tool');
  assert.equal((await runtime.synapticCommonsDiagnostics()).executableCount, 0,
    'native policy activation must not make the portable artifact executable');

  const biasBeforeRevoke = runtime.core.p23SkillBias('verify');
  assert.ok(biasBeforeRevoke > biasBeforeActivation);
  const revokedNative = await runtime.revokeSynapticSkill(liveNativeFingerprint, 'publisher withdrawal test');
  assert.equal(revokedNative.status, 'revoked');
  assert.ok(runtime.core.verifiedSkillCandidateSnapshot().active.some(item =>
    item.skillId === 'synaptic-commons:portable-verify-bias-live'),
  'the P23 active version and detached approval remain available for audit');
  assert.equal(runtime.core.p23TopSkills().some(item =>
    item.id === 'synaptic-commons:portable-verify-bias-live'),
  false, 'a revoked source artifact must be removed from the live P23 resolver immediately');
  assert.ok(runtime.core.p23SkillBias('verify') <= biasBeforeActivation + 1e-9,
    'revocation must remove the native preference bias without mutating unrelated P23 state');
  assert.equal((await runtime.synapticCommonsDiagnostics()).revoked, 1);
  assert.equal((await runtime.synapticCommonsDiagnostics()).executableCount, 0);

  await runtime.stop();
  runtimeStopped = true;
  const restartedRuntime = new OrganismRuntime({
    stateFile: path.join(root, 'organism.json'),
    autoRun: false,
    enableLanguage: false,
  });
  try {
    await restartedRuntime.init();
    assert.ok(restartedRuntime.core.verifiedSkillCandidateSnapshot().active.some(item =>
      item.skillId === 'synaptic-commons:portable-verify-bias-live'),
    'the promoted P23 row remains in durable history after restart');
    assert.equal(restartedRuntime.core.p23TopSkills().some(item =>
      item.id === 'synaptic-commons:portable-verify-bias-live'),
    false, 'the restored revoked Commons tombstone must still suppress the native P23 policy');
    assert.ok(restartedRuntime.core.p23SkillBias('verify') <= biasBeforeActivation + 1e-9);
    assert.equal((await restartedRuntime.synapticCommonsDiagnostics()).revoked, 1);
    assert.equal((await restartedRuntime.synapticCommonsDiagnostics()).executableCount, 0);
  } finally {
    await restartedRuntime.stop().catch(() => {});
  }

  console.log('SYNAPTIC_COMMONS_P23_ADMISSION=PASS authenticated-review canonical-core durable-stage');
  console.log('SYNAPTIC_COMMONS_NATIVE_P23_ADAPTER=PASS allowlisted-policy-only signed-outcomes signed-shadow detached-approval live-bias idempotent');
  console.log('SYNAPTIC_COMMONS_NATIVE_P23_REVOCATION=PASS active-version-auditable immediate-resolver-suppression durable-restart');
} finally {
  if (!runtimeStopped) await runtime.stop().catch(() => {});
  await rm(root, { recursive: true, force: true });
  if (previous.publisher === undefined) delete process.env.NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON;
  else process.env.NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON = previous.publisher;
  if (previous.attestor === undefined) delete process.env.NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON;
  else process.env.NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON = previous.attestor;
  if (previous.licence === undefined) delete process.env.NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON;
  else process.env.NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON = previous.licence;
  if (previous.shadowVerifiers === undefined) delete process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON;
  else process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = previous.shadowVerifiers;
  if (previous.approvalKeys === undefined) delete process.env.NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON;
  else process.env.NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON = previous.approvalKeys;
}
