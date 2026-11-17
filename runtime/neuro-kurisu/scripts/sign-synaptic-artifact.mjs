#!/usr/bin/env node
import { createPrivateKey, sign as signBytes } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createSignedSynapticArtifact, synapticArtifactFingerprint } from '../src/organism/learning/SynapticCommons.ts';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4) {
    throw new Error('usage: sign-synaptic-artifact.mjs <unsigned-artifact.json> <private-key.pem> <publisher-key-id> <output-package.json>');
  }
  const [inputArg, keyArg, keyId, outputArg] = args;
  const inputPath = path.resolve(inputArg);
  const keyPath = path.resolve(keyArg);
  const outputPath = path.resolve(outputArg);
  if (new Set([inputPath, keyPath, outputPath]).size !== 3)
    throw new Error('publisher-input-key-output-paths-must-be-distinct');

  const inputStat = await stat(inputPath);
  const keyStat = await stat(keyPath);
  if (!inputStat.isFile() || inputStat.size > 64 * 1024)
    throw new Error('publisher-input-file-invalid-or-too-large');
  if (!keyStat.isFile() || keyStat.size < 64 || keyStat.size > 8192)
    throw new Error('publisher-private-key-file-invalid');
  if (process.platform !== 'win32' && (keyStat.mode & 0o077) !== 0)
    throw new Error('publisher-private-key-file-must-be-owner-only-0600');

  const keyPem = await readFile(keyPath, 'utf8');
  const privateKey = createPrivateKey(keyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519')
    throw new Error('publisher-private-key-must-be-ed25519');

  let unsignedArtifact;
  try {
    unsignedArtifact = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch {
    throw new Error('publisher-input-must-be-valid-json');
  }
  if (!unsignedArtifact || typeof unsignedArtifact !== 'object' ||
      Array.isArray(unsignedArtifact) || Object.prototype.hasOwnProperty.call(unsignedArtifact, 'signature'))
    throw new Error('publisher-input-must-be-unsigned-artifact-json');

  const artifact = createSignedSynapticArtifact(unsignedArtifact, keyId, fingerprint =>
    signBytes(null, Buffer.from(fingerprint, 'utf8'), privateKey).toString('base64'));
  const fingerprint = synapticArtifactFingerprint(artifact);
  const output = JSON.stringify({ artifactFingerprint: fingerprint, artifact }, null, 2) + '\n';
  await writeFile(outputPath, output, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  process.stdout.write('SYNAPTIC_ARTIFACT_SIGNED ' + fingerprint + '\n');
}

main().catch(error => {
  const message = error instanceof Error ? error.message : 'unknown-publisher-error';
  process.stderr.write('Synaptic artifact signing failed: ' + message + '\n');
  process.exitCode = 1;
});
