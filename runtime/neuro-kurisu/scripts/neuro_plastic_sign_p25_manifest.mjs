import { constants as fsConstants } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { createPrivateKey, sign as cryptoSign } from 'node:crypto';
import path from 'node:path';
import { synapticAdapterManifestPayload } from '../src/organism/learning/AdaptiveSynapticMatrix.ts';

const MAX_FILE_BYTES = 256 * 1024;
const MAX_PRIVATE_KEY_BYTES = 16 * 1024;
const NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith('--') || options[key.slice(2)] !== undefined) throw new Error('invalid-or-duplicate-signer-option');
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error('missing-value-for-' + key);
    options[key.slice(2)] = value;
    index++;
  }
  for (const key of ['input', 'key-file', 'key-id', 'output']) {
    if (typeof options[key] !== 'string' || options[key].trim() === '') throw new Error('required-option-missing: --' + key);
  }
  return options;
}

async function readRegularFile(filePath, label, maxBytes, requirePrivatePermissions = false) {
  const handle = await open(filePath, fsConstants.O_RDONLY | NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > maxBytes) throw new Error(label + '-must-be-a-bounded-regular-file');
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);
  if (inputPath === outputPath) throw new Error('signer-output-must-not-overwrite-manifest');
  const source = JSON.parse((await readRegularFile(inputPath, 'synaptic-manifest', MAX_FILE_BYTES)).toString('utf8'));
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('synaptic-manifest-schema-invalid');
  if (source.signerKeyId !== options['key-id']) throw new Error('synaptic-manifest-signer-key-id-mismatch');
  if (typeof source.signature === 'string' && source.signature !== '' && source.signature !== 'UNSIGNED') {
    throw new Error('synaptic-manifest-already-signed');
  }
  const unsigned = { ...source, signature: 'UNSIGNED' };
  const payload = synapticAdapterManifestPayload(unsigned);
  const privateKeyBytes = await readRegularFile(options['key-file'], 'private-key', MAX_PRIVATE_KEY_BYTES, true);
  const privateKey = createPrivateKey(privateKeyBytes);
  if (privateKey.type !== 'private' || privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('synaptic-manifest-signer-requires-an-ed25519-private-key');
  }
  const signature = cryptoSign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');
  const signedManifest = { ...unsigned, signature };
  const output = await open(outputPath, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | NOFOLLOW, 0o600);
  try {
    await output.writeFile(JSON.stringify(signedManifest, null, 2) + '\n', 'utf8');
    await output.sync();
  } catch (error) {
    await output.close().catch(() => {});
    await unlink(outputPath).catch(() => {});
    throw error;
  }
  await output.close();
  process.stdout.write('NEURO_PLASTIC_P25_MANIFEST_SIGNED=' + outputPath + '\n');
}

main().catch(error => {
  process.stderr.write('NEURO_PLASTIC_P25_SIGNER_ERROR=' + String(error?.message || error) + '\n');
  process.exitCode = 1;
});
