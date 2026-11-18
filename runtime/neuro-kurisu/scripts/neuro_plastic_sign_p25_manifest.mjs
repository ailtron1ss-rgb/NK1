import { createPrivateKey, sign as cryptoSign } from 'node:crypto';
import path from 'node:path';
import { readSecureRegularFile, writeSecureNewFile } from './neuro_plastic_secure_files.mjs';
import { synapticAdapterManifestPayload } from '../src/organism/learning/AdaptiveSynapticMatrix.ts';

const MAX_FILE_BYTES = 256 * 1024;
const MAX_PRIVATE_KEY_BYTES = 16 * 1024;

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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);
  if (inputPath === outputPath) throw new Error('signer-output-must-not-overwrite-manifest');
  const source = JSON.parse((await readSecureRegularFile(inputPath, 'synaptic-manifest', MAX_FILE_BYTES)).toString('utf8'));
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('synaptic-manifest-schema-invalid');
  if (source.signerKeyId !== options['key-id']) throw new Error('synaptic-manifest-signer-key-id-mismatch');
  if (typeof source.signature === 'string' && source.signature !== '' && source.signature !== 'UNSIGNED') {
    throw new Error('synaptic-manifest-already-signed');
  }
  const unsigned = { ...source, signature: 'UNSIGNED' };
  const payload = synapticAdapterManifestPayload(unsigned);
  const privateKeyBytes = await readSecureRegularFile(options['key-file'], 'private-key', MAX_PRIVATE_KEY_BYTES, true);
  const privateKey = createPrivateKey(privateKeyBytes);
  if (privateKey.type !== 'private' || privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('synaptic-manifest-signer-requires-an-ed25519-private-key');
  }
  const signature = cryptoSign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');
  const signedManifest = { ...unsigned, signature };
  await writeSecureNewFile(outputPath, JSON.stringify(signedManifest, null, 2) + '\n', 0o600);
  process.stdout.write('NEURO_PLASTIC_P25_MANIFEST_SIGNED=' + outputPath + '\n');
}

main().catch(error => {
  process.stderr.write('NEURO_PLASTIC_P25_SIGNER_ERROR=' + String(error?.message || error) + '\n');
  process.exitCode = 1;
});
