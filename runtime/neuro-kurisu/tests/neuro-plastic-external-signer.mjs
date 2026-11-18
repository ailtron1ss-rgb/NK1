import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { generateKeyPairSync } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  canonicalNeuroPlasticApprovalPayload,
  parseTrustedNeuroPlasticApprovalKeys,
  verifyNeuroPlasticApprovalSignature,
} from '../src/organism/learning/NeuroPlasticAdapterRegistry.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'neuro-plastic-external-signer-'));
const scriptPath = fileURLToPath(new URL('../scripts/neuro_plastic_sign_approval.mjs', import.meta.url));
const signerKeyId = 'offline-operator-key';
const signer = generateKeyPairSync('ed25519');
const privatePem = signer.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = signer.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const trustedKeys = parseTrustedNeuroPlasticApprovalKeys(JSON.stringify({ [signerKeyId]: publicPem }));
const context = {
  adapterId: 'kurisu-signer-test-v1',
  reportId: 'a'.repeat(64),
  baseModelFingerprint: 'b'.repeat(64),
  manifestFingerprint: 'c'.repeat(64),
};
const approval = {
  approvalId: 'offline-approval-1',
  actorId: 'test-operator',
  approvedAt: Date.now(),
  signerKeyId,
};
const canonicalPayload = canonicalNeuroPlasticApprovalPayload(approval, context);
const request = { schemaVersion: 1, ...context, approval, canonicalPayload };
const requestPath = path.join(root, 'approval-request.json');
const privateKeyPath = path.join(root, 'operator-private.pem');
const outputPath = path.join(root, 'approval-signed.json');

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', scriptPath, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return result;
}

try {
  await mkdir(path.join(root, 'state'), { recursive: true });
  await writeFile(requestPath, JSON.stringify(request));
  await writeFile(privateKeyPath, privatePem, { mode: 0o600 });
  await chmod(privateKeyPath, 0o600);

  run(['--input', requestPath, '--key-file', privateKeyPath, '--key-id', signerKeyId, '--output', outputPath]);
  const signed = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(signed.approval.signerKeyId, signerKeyId);
  assert.equal(verifyNeuroPlasticApprovalSignature(signed.approval, context, trustedKeys), true,
    'offline signer output must verify against the independently configured public-key trust map');
  assert.equal(JSON.stringify(signed).includes(privatePem), false,
    'signed output must never contain the private key');
  assert.equal((await readFile(outputPath, 'utf8')).includes('PRIVATE KEY'), false);

  run(['--input', requestPath, '--key-file', privateKeyPath, '--key-id', 'wrong-key-id',
    '--output', path.join(root, 'wrong-key-id.json')], 1);

  const tamperedRequestPath = path.join(root, 'approval-tampered-request.json');
  await writeFile(tamperedRequestPath, JSON.stringify({ ...request, canonicalPayload: 'tampered' }));
  run(['--input', tamperedRequestPath, '--key-file', privateKeyPath, '--key-id', signerKeyId,
    '--output', path.join(root, 'tampered-signed.json')], 1);

  await chmod(privateKeyPath, 0o644);
  run(['--input', requestPath, '--key-file', privateKeyPath, '--key-id', signerKeyId,
    '--output', path.join(root, 'permissive-key-mode.json')], 1);
  await chmod(privateKeyPath, 0o600);

  const symlinkPath = path.join(root, 'operator-private-symlink.pem');
  await symlink(privateKeyPath, symlinkPath);
  run(['--input', requestPath, '--key-file', symlinkPath, '--key-id', signerKeyId,
    '--output', path.join(root, 'symlink-key-output.json')], 1);

  run(['--input', requestPath, '--key-file', privateKeyPath, '--key-id', signerKeyId,
    '--output', outputPath], 1);

  const rsaPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsaPrivatePath = path.join(root, 'rsa-private.pem');
  await writeFile(rsaPrivatePath, rsaPair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  await chmod(rsaPrivatePath, 0o600);
  run(['--input', requestPath, '--key-file', rsaPrivatePath, '--key-id', signerKeyId,
    '--output', path.join(root, 'rsa-output.json')], 1);

  console.log('NEURO_PLASTIC_EXTERNAL_SIGNER=PASS canonicalBinding=1 publicKeyVerification=1 noPrivateKeyLeak=1 symlinkRejected=1 permissivePermissionsRejected=1 wrongKeyIdRejected=1 overwriteRejected=1');
} finally {
  await rm(root, { recursive: true, force: true });
}
