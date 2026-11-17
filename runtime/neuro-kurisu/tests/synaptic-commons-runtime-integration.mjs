import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
import {
  synapticArtifactFingerprint,
  synapticAttestationSigningPayload,
} from '../src/organism/learning/SynapticCommons.ts';

const publisher = generateKeyPairSync('ed25519');
const attestor = generateKeyPairSync('ed25519');
const publicPem = pair => pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = pair => pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
process.env.NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON = JSON.stringify({ 'runtime-publisher': publicPem(publisher) });
process.env.NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON = JSON.stringify({ 'runtime-evaluator': publicPem(attestor) });
process.env.NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON = JSON.stringify(['b'.repeat(64)]);

const now = Date.now();
const environmentFingerprint = 'e'.repeat(64);
const artifact = {
  schemaVersion: 1,
  skill: {
    skillId: 'runtime-safe-summary',
    name: 'Runtime safe summary',
    version: '1.0.0',
    summary: 'A portable declarative summary procedure.',
    kind: 'procedure',
  },
  contract: {
    capability: 'documents.summarize',
    requiredCapabilities: ['documents.read'],
    requiredTools: ['documents.fetch'],
    permissionClass: 'assisted',
    allowedModes: ['assisted'],
    minimumRuntimeVersion: '1.0.0',
  },
  definition: {
    format: 'declarative-json-v1',
    payload: { steps: [{ operation: 'invoke-capability', capability: 'documents.fetch' }] },
  },
  provenance: {
    sourceInstanceId: 'nk1-source-runtime',
    sourceRuntimeVersion: '1.2.0',
    sourceArtifactFingerprint: 'a'.repeat(64),
    createdAt: now,
  },
  license: {
    identifier: 'Apache-2.0',
    redistributionAllowed: true,
    reviewFingerprint: 'b'.repeat(64),
  },
  signature: { keyId: 'runtime-publisher', algorithm: 'Ed25519', value: 'A'.repeat(88) },
};
const fingerprint = synapticArtifactFingerprint(artifact);
artifact.signature.value = sign(null, Buffer.from(fingerprint), privatePem(publisher)).toString('base64');

function makeAttestation() {
  const receipt = {
    schemaVersion: 1,
    artifactFingerprint: fingerprint,
    attestorId: 'runtime-evaluator',
    runtimeVersion: '1.2.0',
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
  receipt.signature.value = sign(null, Buffer.from(synapticAttestationSigningPayload(receipt)),
    privatePem(attestor)).toString('base64');
  return receipt;
}

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nk1-synaptic-commons-runtime-'));
const config = {
  stateFile: path.join(directory, 'organism.json'),
  worldStateFile: path.join(directory, 'world.json'),
  stateStore: new MemoryStateStore(),
  worldStateStore: new MemoryStateStore(),
  journal: new BoundedOperationalJournal(),
  intervalMs: 60_000,
  enableLanguage: false,
  autoRun: false,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
};

try {
  const runtime = new OrganismRuntime(config);
  await runtime.init();
  assert.equal((await runtime.synapticCommonsDiagnostics()).total, 0);

  const imported = await runtime.importSynapticArtifact(artifact);
  assert.equal(imported.record.status, 'quarantined');
  assert.equal(imported.duplicate, false);

  const duplicate = await runtime.importSynapticArtifact(artifact);
  assert.equal(duplicate.duplicate, true);
  assert.equal((await runtime.synapticCommonsDiagnostics()).total, 1);

  const compatible = await runtime.evaluateSynapticSkillCompatibility(fingerprint, {
    runtimeVersion: '1.2.0',
    environmentFingerprint,
    supportedCapabilities: ['documents.read', 'documents.summarize'],
    permittedTools: ['documents.fetch'],
  });
  assert.equal(compatible.status, 'compatible');

  const attested = await runtime.attestSynapticSkill(fingerprint, makeAttestation());
  assert.equal(attested.status, 'attested');
  const exportTarget = {
    runtimeVersion: '1.2.0', environmentFingerprint,
    supportedCapabilities: ['documents.read', 'documents.summarize'],
    permittedTools: ['documents.fetch'],
  };
  assert.equal((await runtime.exportSynapticArtifact(fingerprint, exportTarget)).artifact.skill.skillId, 'runtime-safe-summary');

  await runtime.flush();
  await runtime.stop();

  const restarted = new OrganismRuntime(config);
  await restarted.init();
  const restored = await restarted.synapticCommonsSnapshot();
  assert.equal(restored.records.length, 1);
  assert.equal(restored.records[0].artifactFingerprint, fingerprint);
  assert.equal(restored.records[0].status, 'attested',
    'the file-backed sidecar and trust signatures must survive a full runtime restart');
  assert.equal((await restarted.synapticCommonsDiagnostics()).executableCount, 0,
    'the Commons catalog cannot grant execution rights after restart');
  const revoked = await restarted.revokeSynapticSkill(fingerprint, 'post-restart independent security review');
  assert.equal(revoked.status, 'revoked');
  assert.equal(revoked.attestation?.artifactFingerprint, fingerprint);
  await restarted.flush();
  await restarted.stop();

  const afterRevocationRestart = new OrganismRuntime(config);
  await afterRevocationRestart.init();
  const revokedSnapshot = await afterRevocationRestart.synapticCommonsSnapshot();
  assert.equal(revokedSnapshot.records[0].status, 'revoked');
  assert.equal((await afterRevocationRestart.synapticCommonsDiagnostics()).revoked, 1);
  await assert.rejects(() => afterRevocationRestart.exportSynapticArtifact(fingerprint, exportTarget), /requires-attested-artifact/);
  await assert.rejects(() => afterRevocationRestart.evaluateSynapticSkillCompatibility(fingerprint, {
    runtimeVersion: '1.2.0', environmentFingerprint,
    supportedCapabilities: ['documents.read', 'documents.summarize'],
    permittedTools: ['documents.fetch'],
  }), /skill-revoked/);
  await afterRevocationRestart.stop();

  console.log(JSON.stringify({
    status: 'SYNAPTIC_COMMONS_RUNTIME_PASS',
    imported: true, sidecarRestart: true, attested: true,
    durableRevocation: true, executableCount: 0,
  }));
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
