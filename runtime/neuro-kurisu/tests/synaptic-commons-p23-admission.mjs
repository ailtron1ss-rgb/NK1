import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { createSignedSynapticArtifact, synapticArtifactFingerprint, synapticAttestationSigningPayload } from '../src/organism/learning/SynapticCommons.ts';
import { AtomicFileSkillStorePersistence } from '../src/organism/learning/AtomicFileSkillStorePersistence.ts';
import { VersionedSkillCandidateStore } from '../src/organism/learning/VersionedSkillCandidateStore.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import { createSynapticP23AdmissionProvider } from '../src/organism/learning/SynapticP23OutcomeBundleProvider.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-synaptic-p23-admission-'));
const previous = {
  publisher: process.env.NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON,
  attestor: process.env.NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON,
  licence: process.env.NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON,
  shadowVerifiers: process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON,
};
const now = Date.now();
const environmentFingerprint = 'e'.repeat(64);
const host = {
  runtimeVersion: '1.2.0',
  environmentFingerprint,
  supportedCapabilities: ['documents.read', 'documents.summarize'],
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
const outcomeVerifierId = 'synaptic-p23-local-verifier';
process.env.NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON = JSON.stringify({ 'publisher-1': publisher.publicKey });
process.env.NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON = JSON.stringify({ 'attestor-1': attestor.publicKey });
process.env.NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON = JSON.stringify(['b'.repeat(64)]);
process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = JSON.stringify({ [outcomeVerifierId]: outcomeVerifier.publicKey });

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

const candidateStorePath = path.join(root, 'p23-candidates.json');
const candidateStore = new VersionedSkillCandidateStore(
  new AtomicFileSkillStorePersistence(candidateStorePath),
  () => true,
  () => true,
  () => true,
);
const engine = new P23LearningEngine();
engine.configureVerifiedSkillLifecycle(candidateStore);

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
const runtime = new OrganismRuntime({
  stateFile: path.join(root, 'organism.json'),
  autoRun: false,
  enableLanguage: false,
  synapticP23Admission: {
    engine,
    currentHostCompatibilityTarget: () => hostDrift
      ? { ...host, permittedTools: [] }
      : { ...host },
    createLocalPromotionProposal: async ({ candidateMethod }) => {
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

  const snapshot = engine.verifiedSkillCandidateSnapshot();
  assert.deepEqual(snapshot.active, [], 'Synaptic import must never activate a local P23 skill');
  const candidate = snapshot.candidates.find(item => item.candidateId === staged.candidateId);
  assert.equal(candidate.status, 'staged');
  assert.equal(candidate.payload.admissionKind, 'synaptic-commons-p23-review-v1');
  assert.equal(candidate.payload.artifactFingerprint, fingerprint);
  assert.equal(candidate.payload.activation.canActivateAutomatically, false);
  assert.equal(candidate.payload.localEvidence.candidateMethod, 'synaptic-commons:' + fingerprint);

  assert.throws(() => candidateStore.recordShadowObservation(staged.candidateId, {
    runId: 'synaptic-blocked-shadow',
    evidenceFingerprint: '1'.repeat(64),
    passed: true,
    observedAt: Date.now(),
  }), /synaptic-candidate-requires-native-adapter/,
  'the generic P23 shadow runner cannot execute a portable review envelope');
  assert.throws(() => candidateStore.approveAndPromote(staged.candidateId, {
    approvedBy: 'test-authority',
    approvedAt: Date.now() + 1000,
    expectedActiveVersion: null,
  }, 3), /synaptic-candidate-requires-native-adapter/);
  assert.deepEqual(candidateStore.snapshot().active, [],
    'a portable review envelope cannot enter shadow execution or promotion');

  const restartedStore = new VersionedSkillCandidateStore(
    new AtomicFileSkillStorePersistence(candidateStorePath),
    () => true, () => true, () => true,
  );
  const restored = restartedStore.snapshot();
  assert.equal(restored.candidates[0].status, 'staged');
  assert.deepEqual(restored.active, []);
  assert.equal((await runtime.synapticCommonsDiagnostics()).executableCount, 0);
  console.log('SYNAPTIC_COMMONS_P23_ADMISSION=PASS authenticated-local-proposal exact-artifact-binding durable-stage shadow-only promotion-block');
} finally {
  await runtime.stop().catch(() => {});
  await rm(root, { recursive: true, force: true });
  if (previous.publisher === undefined) delete process.env.NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON;
  else process.env.NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON = previous.publisher;
  if (previous.attestor === undefined) delete process.env.NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON;
  else process.env.NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON = previous.attestor;
  if (previous.licence === undefined) delete process.env.NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON;
  else process.env.NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON = previous.licence;
  if (previous.shadowVerifiers === undefined) delete process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON;
  else process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = previous.shadowVerifiers;
}
