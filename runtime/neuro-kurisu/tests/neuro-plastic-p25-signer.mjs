import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { generateKeyPairSync, verify as cryptoVerify } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { synapticAdapterManifestPayload } from '../src/organism/learning/AdaptiveSynapticMatrix.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'neuro-plastic-p25-signer-'));
const scriptPath = fileURLToPath(new URL('../scripts/neuro_plastic_sign_p25_manifest.mjs', import.meta.url));
const keyId = 'p25-policy-offline-key';
const signer = generateKeyPairSync('ed25519');
const privatePem = signer.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKey = signer.publicKey;
const manifest = {
  id: 'p25-reasoning-signer-v1',
  artifactRef: 'file://adapter-store/p25-reasoning-v1',
  artifactSha256: 'a'.repeat(64),
  adapterFormat: 'lora',
  rank: 16,
  baseModelId: 'kurisu-7b',
  baseModelRevisionSha256: 'b'.repeat(64),
  tasks: ['reasoning'],
  competenceByTask01: { reasoning: 0.9 },
  conflictGroup: 'reasoning-specialists',
  minimumConfidence01: 0.72,
  maximumResourceRisk01: 0.3,
  maximumUncertainty01: 0.25,
  maximumContextTokens: 8192,
  trainingDatasetRef: 'dataset://verified/train-v1',
  owner: 'neuro-plastic-operator',
  validation: {
    reportId: 'p25-holdout-report-2026-11',
    reportSha256: 'c'.repeat(64),
    holdoutDatasetRef: 'dataset://independent/holdout-v1',
    pairedSeeds: 8,
    baselineScore01: 0.7,
    adapterScore01: 0.82,
    lower95Delta01: 0.04,
    guardrailRegressionCount: 0,
  },
  signerKeyId: keyId,
  signature: 'UNSIGNED',
};

const inputPath = path.join(root, 'p25-unsigned.json');
const privatePath = path.join(root, 'p25-private.pem');
const outputPath = path.join(root, 'p25-signed.json');
function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', scriptPath, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return result;
}

try {
  await writeFile(inputPath, JSON.stringify(manifest));
  await writeFile(privatePath, privatePem, { mode: 0o600 });
  await chmod(privatePath, 0o600);
  run(['--input', inputPath, '--key-file', privatePath, '--key-id', keyId, '--output', outputPath]);
  const signed = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(cryptoVerify(null, Buffer.from(synapticAdapterManifestPayload(signed), 'utf8'),
    publicKey, Buffer.from(signed.signature, 'base64')), true,
  'P25 signed manifest must verify against its canonical payload and configured public key');
  assert.equal((await readFile(outputPath, 'utf8')).includes('PRIVATE KEY'), false);
  const tampered = { ...signed, maximumResourceRisk01: 0.9 };
  assert.equal(cryptoVerify(null, Buffer.from(synapticAdapterManifestPayload(tampered), 'utf8'),
    publicKey, Buffer.from(signed.signature, 'base64')), false,
  'post-signing policy mutation must invalidate the signature');

  run(['--input', inputPath, '--key-file', privatePath, '--key-id', 'wrong-key',
    '--output', path.join(root, 'wrong-key.json')], 1);
  const alreadySignedPath = path.join(root, 'already-signed.json');
  await writeFile(alreadySignedPath, JSON.stringify({ ...manifest, signature: 'prior-signature' }));
  run(['--input', alreadySignedPath, '--key-file', privatePath, '--key-id', keyId,
    '--output', path.join(root, 'resigned.json')], 1);

  await chmod(privatePath, 0o644);
  run(['--input', inputPath, '--key-file', privatePath, '--key-id', keyId,
    '--output', path.join(root, 'permissive-mode.json')], 1);
  await chmod(privatePath, 0o600);
  const keySymlink = path.join(root, 'p25-private-symlink.pem');
  await symlink(privatePath, keySymlink);
  run(['--input', inputPath, '--key-file', keySymlink, '--key-id', keyId,
    '--output', path.join(root, 'symlink-key.json')], 1);
  run(['--input', inputPath, '--key-file', privatePath, '--key-id', keyId, '--output', outputPath], 1);

  console.log('NEURO_PLASTIC_P25_SIGNER=PASS canonicalManifest=1 signatureVerification=1 tamperRejected=1 wrongKeyIdRejected=1 symlinkRejected=1 permissionsRejected=1 overwriteRejected=1');
} finally {
  await rm(root, { recursive: true, force: true });
}
