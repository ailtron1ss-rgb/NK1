import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { SynapticCommons, synapticArtifactFingerprint } from '../src/organism/learning/SynapticCommons.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-synaptic-publisher-'));
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const inputPath = path.join(root, 'unsigned-artifact.json');
const privateKeyPath = path.join(root, 'publisher-private.pem');
const outputPath = path.join(root, 'signed-package.json');
const insecureKeyPath = path.join(root, 'insecure-private.pem');
const insecureOutputPath = path.join(root, 'must-not-be-created.json');
const toolPath = path.resolve('scripts/sign-synaptic-artifact.mjs');
try {
  const unsignedArtifact = {
    schemaVersion: 1,
    skill: {
      skillId: 'publisher-cli-summary',
      name: 'Publisher CLI summary',
      version: '1.0.0',
      summary: 'A simple offline-signed test skill.',
      kind: 'procedure',
    },
    contract: {
      capability: 'documents.summarize',
      requiredCapabilities: ['documents.read'],
      requiredTools: ['documents.fetch'],
      permissionClass: 'assisted',
      allowedModes: ['assisted'],
      minimumRuntimeVersion: '1.0.0',
      environmentFingerprint: 'e'.repeat(64),
    },
    definition: {
      format: 'declarative-json-v1',
      payload: { steps: [{ operation: 'invoke-capability', capability: 'documents.fetch' }] },
    },
    provenance: {
      sourceInstanceId: 'publisher-fixture',
      sourceRuntimeVersion: '1.2.0',
      sourceArtifactFingerprint: 'a'.repeat(64),
      createdAt: Date.now(),
    },
    license: {
      identifier: 'Apache-2.0',
      redistributionAllowed: true,
      reviewFingerprint: 'b'.repeat(64),
    },
  };
  await writeFile(inputPath, JSON.stringify(unsignedArtifact), { mode: 0o600 });
  await writeFile(privateKeyPath, privatePem, { mode: 0o600 });
  const stdout = execFileSync(process.execPath, [
    '--experimental-strip-types', toolPath, inputPath, privateKeyPath, 'publisher-cli', outputPath,
  ], { encoding: 'utf8' });
  assert.match(stdout, /^SYNAPTIC_ARTIFACT_SIGNED [a-f0-9]{64}\n$/);
  const packaged = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(packaged.artifactFingerprint, synapticArtifactFingerprint(packaged.artifact));
  assert.equal(packaged.artifact.signature.keyId, 'publisher-cli');

  const commons = new SynapticCommons({
    trustedPublisherKeys: new Map([['publisher-cli', publicPem]]),
    trustedAttestorKeys: new Map(),
    trustedLicenseReviewFingerprints: new Set(['b'.repeat(64)]),
  });
  const imported = commons.importArtifact(packaged.artifact);
  assert.equal(imported.record.status, 'quarantined',
    'a local publication must still enter receiving-host quarantine');
  assert.equal(imported.record.artifactFingerprint, packaged.artifactFingerprint);
  assert.equal(commons.diagnostics().executableCount, 0);

  const overwriteAttempt = spawnSync(process.execPath, [
    '--experimental-strip-types', toolPath, inputPath, privateKeyPath, 'publisher-cli', outputPath,
  ], { encoding: 'utf8' });
  assert.notEqual(overwriteAttempt.status, 0, 'publisher never silently overwrites a package');
  assert.match(overwriteAttempt.stderr, /EEXIST/);

  await writeFile(insecureKeyPath, privatePem, { mode: 0o644 });
  await chmod(insecureKeyPath, 0o644);
  const insecureAttempt = spawnSync(process.execPath, [
    '--experimental-strip-types', toolPath, inputPath, insecureKeyPath, 'publisher-cli', insecureOutputPath,
  ], { encoding: 'utf8' });
  if (process.platform !== 'win32') {
    assert.notEqual(insecureAttempt.status, 0);
    assert.match(insecureAttempt.stderr, /owner-only-0600/);
  }

  const signedInput = {
    ...unsignedArtifact,
    signature: { keyId: 'publisher-cli', algorithm: 'Ed25519', value: 'A'.repeat(88) },
  };
  await writeFile(inputPath, JSON.stringify(signedInput));
  const signedInputAttempt = spawnSync(process.execPath, [
    '--experimental-strip-types', toolPath, inputPath, privateKeyPath, 'publisher-cli', insecureOutputPath,
  ], { encoding: 'utf8' });
  assert.notEqual(signedInputAttempt.status, 0);
  assert.match(signedInputAttempt.stderr, /unsigned-artifact-json/);

  console.log('SYNAPTIC_COMMONS_PUBLISHER_CLI=PASS offline-ed25519 owner-only-key exclusive-output quarantine-import');
} finally {
  await rm(root, { recursive: true, force: true });
}
