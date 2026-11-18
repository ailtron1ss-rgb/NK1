import { constants as fsConstants } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { createPrivateKey, sign as cryptoSign } from 'node:crypto';
import path from 'node:path';
import { canonicalNeuroPlasticApprovalPayload } from '../src/organism/learning/NeuroPlasticAdapterRegistry.ts';

const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_PRIVATE_KEY_BYTES = 16 * 1024;
const NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith('--') || options[key.slice(2)] !== undefined) {
      throw new Error('invalid-or-duplicate-signer-option');
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error('missing-value-for-' + key);
    options[key.slice(2)] = value;
    index++;
  }
  for (const key of ['input', 'key-file', 'key-id', 'output']) {
    if (typeof options[key] !== 'string' || options[key].trim() === '') {
      throw new Error('required-option-missing: --' + key);
    }
  }
  return options;
}

async function readRegularFile(filePath, label, maxBytes, requirePrivatePermissions = false) {
  const handle = await open(filePath, fsConstants.O_RDONLY | NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > maxBytes) {
      throw new Error(label + '-must-be-a-bounded-regular-file');
    }
    if (requirePrivatePermissions && process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
      throw new Error('private-key-file-permissions-must-be-owner-only');
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength > maxBytes) throw new Error(label + '-exceeds-size-limit');
    return bytes;
  } finally {
    await handle.close();
  }
}

function requireApprovalRequest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      raw.schemaVersion !== 1 || typeof raw.adapterId !== 'string' ||
      !raw.approval || typeof raw.approval !== 'object' || Array.isArray(raw.approval)) {
    throw new Error('approval-request-schema-invalid');
  }
  const approval = raw.approval;
  const expectedKeys = ['actorId', 'approvalId', 'approvedAt', 'signerKeyId'];
  const actualKeys = Object.keys(approval).sort();
  if (actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key, index) => key !== expectedKeys.slice().sort()[index])) {
    throw new Error('approval-request-must-contain-only-unsigned-approval-fields');
  }
  if (approval.signerKeyId !== raw.signerKeyId && raw.signerKeyId !== undefined) {
    throw new Error('approval-request-signer-key-id-mismatch');
  }
  if (approval.signature !== undefined) throw new Error('approval-request-already-signed');
  return raw;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);
  if (inputPath === outputPath) throw new Error('signer-output-must-not-overwrite-request');
  const requestBytes = await readRegularFile(inputPath, 'approval-request', MAX_REQUEST_BYTES);
  const request = requireApprovalRequest(JSON.parse(requestBytes.toString('utf8')));
  if (request.approval.signerKeyId !== options['key-id']) {
    throw new Error('approval-request-signer-key-id-does-not-match-selected-key');
  }
  const context = {
    adapterId: request.adapterId,
    reportId: request.reportId,
    baseModelFingerprint: request.baseModelFingerprint,
    manifestFingerprint: request.manifestFingerprint,
  };
  const canonicalPayload = canonicalNeuroPlasticApprovalPayload(request.approval, context);
  if (typeof request.canonicalPayload !== 'string' || request.canonicalPayload !== canonicalPayload) {
    throw new Error('approval-request-canonical-payload-mismatch');
  }

  const privateKeyBytes = await readRegularFile(options['key-file'], 'private-key', MAX_PRIVATE_KEY_BYTES, true);
  const privateKey = createPrivateKey(privateKeyBytes);
  if (privateKey.type !== 'private' || privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('approval-signer-requires-an-ed25519-private-key');
  }
  const signature = cryptoSign(null, Buffer.from(canonicalPayload, 'utf8'), privateKey).toString('base64');
  const signedRequest = {
    ...request,
    approval: { ...request.approval, signature },
  };
  const outputHandle = await open(outputPath, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | NOFOLLOW, 0o600);
  try {
    await outputHandle.writeFile(JSON.stringify(signedRequest, null, 2) + '\n', 'utf8');
    await outputHandle.sync();
  } catch (error) {
    await outputHandle.close().catch(() => {});
    await unlink(outputPath).catch(() => {});
    throw error;
  }
  await outputHandle.close();
  process.stdout.write('NEURO_PLASTIC_APPROVAL_SIGNED=' + outputPath + '\n');
}

main().catch(error => {
  process.stderr.write('NEURO_PLASTIC_SIGNER_ERROR=' + String(error?.message || error) + '\n');
  process.exitCode = 1;
});
