import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fingerprintSkillPayload, VersionedSkillCandidateStore } from '../src/organism/learning/VersionedSkillCandidateStore.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { isAuthenticVerifiedSkillPromotionProposal, proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import { createNativeCompoundRepairRevisionProvider } from '../src/organism/learning/P23CompoundRepairRevisionProvider.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const previousKeyring = process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON;
process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = JSON.stringify({ 'verifier-v1': publicPem });

const baselinePayload = { schemaVersion: 1, steps: ['read'] };
const candidatePayload = { schemaVersion: 1, steps: ['read', 'verify'] };
const baselinePayloadFingerprint = fingerprintSkillPayload(baselinePayload);
const candidatePayloadFingerprint = fingerprintSkillPayload(candidatePayload);

const manifest = Array.from({ length: 12 }, (_, i) => ({
  taskId: 'task-' + i,
  family: i < 5 ? 'memory' : 'tool-use',
  split: i < 8 ? 'holdout' : i < 10 ? 'train' : 'validation',
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('native revision prompt ' + i),
  verifierId: 'verifier-v1',
  version: 'v1',
}));

function buildDataset() {
  const ledger = new VerifiedOutcomeLedger(manifest);
  const artifacts = [];
  for (let seed = 1; seed <= 5; seed++) {
    for (let i = 0; i < manifest.length; i++) {
      for (const [method, threshold] of [['baseline-v1', 6], ['source-v1', 8]]) {
        const task = manifest[i];
        const payload = {
          schemaVersion: 1,
          artifactId: 'artifact-' + task.taskId + '-' + method + '-' + seed,
          runId: 'run-' + task.taskId + '-' + method + '-' + seed,
          manifestFingerprint: ledger.manifestFingerprint(),
          taskId: task.taskId,
          taskVersion: task.version,
          method,
          seed,
          attempt: 1,
          passed: i < threshold,
          verifierId: task.verifierId,
          observedAt: 1_760_000_000_000 + seed * 1000 + i,
          payloadFingerprint: method === 'baseline-v1' ? baselinePayloadFingerprint : candidatePayloadFingerprint,
        };
        artifacts.push(signOutcomePayloadForFixture(payload, privatePem));
      }
    }
  }
  return {
    schemaVersion: 1,
    manifest,
    artifacts,
    baselineMethod: 'baseline-v1',
    candidateMethod: 'source-v1',
    gateOptions: { minPairedTasks: 8, minAbsoluteGain: 0.1, minCompleteSeeds: 3 },
  };
}

const temporary = async run => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-native-p23-provider-'));
  const stateDirectory = path.join(root, 'state');
  const configDirectory = path.join(root, 'config');
  await mkdir(stateDirectory, { mode: 0o700 });
  await mkdir(configDirectory, { mode: 0o700 });
  try {
    await run({ root, stateDirectory, configDirectory });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const createProvider = ({ datasetPath, root, stateDirectory, candidateStore }) =>
  createNativeCompoundRepairRevisionProvider({
    datasetPath,
    root,
    stateDirectory,
    candidateStore,
    generateSkillRevision: async request => ({ ...request.sourcePayload, revised: true }),
  });


function createStoreWithActiveBaseline(proposal, sourcePayload) {
  const approvedAt = Date.now();
  const baselineProposalId = 'c'.repeat(64);
  const baselineCandidate = {
    candidateId: 'a'.repeat(64),
    skillId: 'skill-a',
    version: 1,
    payload: baselinePayload,
    payloadFingerprint: baselinePayloadFingerprint,
    proposalId: baselineProposalId,
    proposalOutcomeFingerprint: 'd'.repeat(64),
    baseVersion: null,
    previousActive: null,
    status: 'active',
    shadowObservations: Array.from({ length: 3 }, (_, index) => ({
      runId: 'baseline-shadow-' + index,
      evidenceFingerprint: String(index + 1).repeat(64),
      passed: true,
      observedAt: approvedAt - 1000 + index,
    })),
    createdAt: approvedAt - 1000,
    approval: { approvedBy: 'native-provider-test', approvedAt, expectedActiveVersion: null },
    promotedAt: approvedAt,
  };
  let persisted = {
    schemaVersion: 1,
    revision: 0,
    active: [{
      skillId: 'skill-a',
      version: 1,
      payload: baselinePayload,
      payloadFingerprint: baselinePayloadFingerprint,
      proposalId: baselineProposalId,
      activatedAt: approvedAt,
    }],
    candidates: [baselineCandidate],
  };
  const persistence = {
    read: () => structuredClone(persisted),
    compareAndSwap(expectedRevision, next) {
      if (persisted.revision !== expectedRevision || next.revision !== expectedRevision + 1) return false;
      persisted = structuredClone(next);
      return true;
    },
  };
  const candidateStore = new VersionedSkillCandidateStore(persistence, () => true, () => true, () => true);
  const candidate = candidateStore.stageCandidate(proposal, 'skill-a', sourcePayload);
  return { candidateStore, candidate };
}

test('native provider rebuilds an authentic proposal from signed artifacts and finds its staged source', async () => {
  await temporary(async ({ root, stateDirectory, configDirectory }) => {
    const datasetPath = path.join(configDirectory, 'verified-proposal.json');
    const dataset = buildDataset();
    await writeFile(datasetPath, JSON.stringify(dataset), { mode: 0o600 });
    const sourceLedger = new VerifiedOutcomeLedger(manifest);
    for (const artifact of dataset.artifacts) {
      const result = ingestSignedOutcomeArtifact(sourceLedger, manifest, artifact, new Map([['verifier-v1', publicPem]]));
      assert.equal(result.accepted, true);
    }
    const proposal = proposeVerifiedSkillPromotion(sourceLedger, dataset.baselineMethod, dataset.candidateMethod, dataset.gateOptions);
    assert.equal(proposal.gate.accepted, true);
    assert.equal(isAuthenticVerifiedSkillPromotionProposal(proposal), true);
    // The exact payloads in the active baseline, signed artifacts and staged source agree.
    const { candidateStore, candidate } = createStoreWithActiveBaseline(proposal, candidatePayload);

    const provider = await createProvider({ datasetPath, root, stateDirectory, candidateStore });
    const inputs = await provider({ skillId: 'skill-a', repairFingerprints: ['a'.repeat(64)], repairEvidence: [] });
    assert.equal(inputs.sourceCandidateId, candidate.candidateId);
    assert.equal(inputs.proposal.proposalId, proposal.proposalId);
    assert.equal(isAuthenticVerifiedSkillPromotionProposal(inputs.proposal), true);
    assert.equal(inputs.options, undefined, 'promotion gate options must not be confused with fresh candidate-fitness options');
    assert.equal(inputs.proposal.gate.accepted, true);
    await assert.rejects(inputs.evaluateRevisedCandidate({}), /native-p23-revision-requires-independent-evaluation-wrapper/);
  });
});

test('native provider rejects a candidate with correct proposal lineage but the wrong payload fingerprint', async () => {
  await temporary(async ({ root, stateDirectory, configDirectory }) => {
    const datasetPath = path.join(configDirectory, 'payload-mismatch.json');
    await writeFile(datasetPath, JSON.stringify(buildDataset()), { mode: 0o600 });
    const sourceLedger = new VerifiedOutcomeLedger(manifest);
    const dataset = buildDataset();
    for (const artifact of dataset.artifacts) {
      const result = ingestSignedOutcomeArtifact(sourceLedger, manifest, artifact, new Map([['verifier-v1', publicPem]]));
      assert.equal(result.accepted, true);
    }
    const proposal = proposeVerifiedSkillPromotion(sourceLedger, dataset.baselineMethod, dataset.candidateMethod, dataset.gateOptions);
    const wrongPayload = { schemaVersion: 1, steps: ['read', 'different-code'] };
    const { candidateStore } = createStoreWithActiveBaseline(proposal, wrongPayload);
    const provider = await createProvider({ datasetPath, root, stateDirectory, candidateStore });
    await assert.rejects(
      provider({ skillId: 'skill-a', repairFingerprints: ['b'.repeat(64)], repairEvidence: [] }),
      /native-p23-revision-no-candidate-matches-signed-proposal-and-payload/,
    );
  });
});

test('native provider requires payload fingerprints on all signed baseline/source outcomes', async () => {
  await temporary(async ({ root, stateDirectory, configDirectory }) => {
    const dataset = buildDataset();
    dataset.artifacts = dataset.artifacts.map(artifact => {
      const payload = { ...artifact.payload };
      delete payload.payloadFingerprint;
      return signOutcomePayloadForFixture(payload, privatePem);
    });
    const datasetPath = path.join(configDirectory, 'missing-payload-fingerprint.json');
    await writeFile(datasetPath, JSON.stringify(dataset), { mode: 0o600 });
    await assert.rejects(
      createProvider({ datasetPath, root, stateDirectory, candidateStore: new VersionedSkillCandidateStore() }),
      /native-p23-revision-signed-payload-fingerprint-required/,
    );
  });
});

test('native provider rejects identical signed baseline and candidate payload fingerprints', async () => {
  await temporary(async ({ root, stateDirectory, configDirectory }) => {
    const dataset = buildDataset();
    dataset.artifacts = dataset.artifacts.map(artifact => {
      if (artifact.payload.method !== dataset.candidateMethod) return artifact;
      return signOutcomePayloadForFixture({
        ...artifact.payload,
        payloadFingerprint: baselinePayloadFingerprint,
      }, privatePem);
    });
    const datasetPath = path.join(configDirectory, 'identical-payload-fingerprint.json');
    await writeFile(datasetPath, JSON.stringify(dataset), { mode: 0o600 });
    await assert.rejects(
      createProvider({ datasetPath, root, stateDirectory, candidateStore: new VersionedSkillCandidateStore() }),
      /native-p23-revision-baseline-and-candidate-payload-fingerprints-identical/,
    );
  });
});

test('native provider rejects signed datasets whose artifact signature is invalid', async () => {
  await temporary(async ({ root, stateDirectory, configDirectory }) => {
    const dataset = buildDataset();
    dataset.artifacts[0].signature = (dataset.artifacts[0].signature[0] === 'A' ? 'B' : 'A') + dataset.artifacts[0].signature.slice(1);
    const datasetPath = path.join(configDirectory, 'tampered.json');
    await writeFile(datasetPath, JSON.stringify(dataset), { mode: 0o600 });
    await assert.rejects(
      createProvider({ datasetPath, root, stateDirectory, candidateStore: new VersionedSkillCandidateStore() }),
      /native-p23-revision-signed-outcome-rejected:invalid-signature/,
    );
  });
});

test('native provider rejects datasets stored in mutable organism state', async () => {
  await temporary(async ({ root, stateDirectory }) => {
    const datasetPath = path.join(stateDirectory, 'untrusted-dataset.json');
    await writeFile(datasetPath, JSON.stringify(buildDataset()), { mode: 0o600 });
    await assert.rejects(
      createProvider({ datasetPath, root, stateDirectory, candidateStore: new VersionedSkillCandidateStore() }),
      /native-p23-revision-dataset-must-be-outside-mutable-state-directory/,
    );
  });
});

test('native provider rejects symlink dataset paths before reading target bytes', async () => {
  if (process.platform === 'win32') return;
  await temporary(async ({ root, stateDirectory, configDirectory }) => {
    const targetPath = path.join(configDirectory, 'protected-target.json');
    const datasetPath = path.join(configDirectory, 'dataset-link.json');
    await writeFile(targetPath, JSON.stringify(buildDataset()), { mode: 0o600 });
    await symlink(targetPath, datasetPath);
    await assert.rejects(
      createProvider({ datasetPath, root, stateDirectory, candidateStore: new VersionedSkillCandidateStore() }),
      /native-p23-revision-dataset-must-be-a-regular-non-symlink-file/,
    );
  });
});

test('native provider rejects a dataset that can be modified by group or world', async () => {
  if (process.platform === 'win32') return;
  await temporary(async ({ root, stateDirectory, configDirectory }) => {
    const datasetPath = path.join(configDirectory, 'writable.json');
    await writeFile(datasetPath, JSON.stringify(buildDataset()), { mode: 0o600 });
    await chmod(datasetPath, 0o666);
    await assert.rejects(
      createProvider({ datasetPath, root, stateDirectory, candidateStore: new VersionedSkillCandidateStore() }),
      /native-p23-revision-dataset-must-not-be-group-or-world-writable/,
    );
  });
});

test.after(() => {
  if (previousKeyring === undefined) delete process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON;
  else process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = previousKeyring;
});
