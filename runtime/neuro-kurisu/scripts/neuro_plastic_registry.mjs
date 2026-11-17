#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  NeuroPlasticAdapterRegistry,
  createNeuroPlasticApprovalSignature,
  verifyNeuroPlasticApprovalSignature,
} from '../src/organism/learning/NeuroPlasticAdapterRegistry.ts';

const ROOT = path.resolve(process.env.NEURO_PLASTIC_RUNTIME_ROOT || process.cwd());
const SECRET = String(process.env.NEURO_PLASTIC_APPROVAL_SECRET || '');
const APPROVER = String(process.env.NEURO_PLASTIC_APPROVER_ID || '').trim();

function usage() {
  process.stdout.write([
    'Usage:',
    '  node --experimental-strip-types scripts/neuro_plastic_registry.mjs stage --input manifest.json',
    '  node --experimental-strip-types scripts/neuro_plastic_registry.mjs evaluate --adapter ID --input holdout-evaluation.json',
    '  node --experimental-strip-types scripts/neuro_plastic_registry.mjs approve --adapter ID --output approval.json',
    '  node --experimental-strip-types scripts/neuro_plastic_registry.mjs activate --adapter ID --input approval.json',
    '  node --experimental-strip-types scripts/neuro_plastic_registry.mjs rollback --adapter ID --reason "reason"',
    '',
    'Set NEURO_PLASTIC_APPROVAL_SECRET (32+ chars) and NEURO_PLASTIC_APPROVER_ID for approval commands.',
    '',
  ].join('\n'));
}

function parseArgs(argv) {
  const [operation, ...rest] = argv;
  const options = { operation };
  for (let index = 0; index < rest.length; index++) {
    const key = rest[index];
    if (!key.startsWith('--')) throw new Error('unexpected argument: ' + key);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error('missing value for ' + key);
    options[key.slice(2)] = value;
    index++;
  }
  return options;
}

function insideRoot(candidate, label) {
  const resolved = path.resolve(ROOT, candidate);
  const relative = path.relative(ROOT, resolved);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error(label + '-must-be-a-file-under-runtime-root');
  }
  return resolved;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    const existing = await lstat(filePath);
    if (existing.isSymbolicLink() || !existing.isFile()) throw new Error('refusing-to-overwrite-non-regular-file');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const temporary = filePath + '.' + process.pid + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await rename(temporary, filePath);
}

async function verifyArtifact(manifest) {
  const directory = String(manifest?.artifact?.directory || '');
  if (!directory.startsWith('adapter-store/') || directory.includes('\\') ||
      directory.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('adapter-artifact-path-invalid');
  }
  const storeRoot = path.resolve(ROOT, 'adapter-store');
  const adapterDirectory = path.resolve(ROOT, directory);
  const relative = path.relative(storeRoot, adapterDirectory);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('adapter-artifact-escapes-store');
  }
  const directoryStat = await lstat(adapterDirectory);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw new Error('adapter-artifact-directory-not-regular');
  const configPath = path.join(adapterDirectory, 'adapter_config.json');
  const weightsPath = path.join(adapterDirectory, 'adapter_model.safetensors');
  const metadataPath = path.join(adapterDirectory, 'neuro-plastic-artifact.json');
  for (const filePath of [configPath, weightsPath, metadataPath]) {
    const info = await lstat(filePath);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error('adapter-artifact-file-not-regular');
  }
  const [config, weights, metadata] = await Promise.all([
    readFile(configPath),
    readFile(weightsPath),
    readJson(metadataPath),
  ]);
  const configSha256 = createHash('sha256').update(config).digest('hex');
  const weightsSha256 = createHash('sha256').update(weights).digest('hex');
  const totalBytes = config.byteLength + weights.byteLength;
  if (configSha256 !== String(manifest.artifact.configSha256).toLowerCase() ||
      weightsSha256 !== String(manifest.artifact.weightsSha256).toLowerCase() ||
      totalBytes !== manifest.artifact.totalBytes) {
    throw new Error('adapter-artifact-hash-or-size-mismatch');
  }
  if (metadata.schemaVersion !== 1 || metadata.automaticActivation !== false ||
      metadata.domain !== manifest.domain || metadata.method !== manifest.method ||
      metadata.baseModelFingerprint !== manifest.baseModel?.fingerprint ||
      metadata.tokenizerFingerprint !== manifest.tokenizerFingerprint ||
      metadata.corpusFingerprint !== manifest.corpusFingerprint) {
    throw new Error('adapter-training-metadata-does-not-match-manifest');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.operation || options.operation === 'help' || options.operation === '--help') {
    usage();
    return;
  }
  const registryFile = insideRoot(
    process.env.NEURO_PLASTIC_REGISTRY_FILE || options.registry || 'state/neuro-plastic-adapters.json',
    'registry-path',
  );
  const registry = new NeuroPlasticAdapterRegistry();
  try {
    const snapshot = await readJson(registryFile);
    registry.restore(snapshot, (approval, context) =>
      verifyNeuroPlasticApprovalSignature(approval, context, SECRET));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error('existing-neuro-plastic-registry-invalid: ' + error.message);
  }

  const adapterId = options.adapter;
  if (options.operation !== 'stage' && options.operation !== 'help' &&
      (!adapterId || !/^[a-z0-9][a-z0-9._-]{2,79}$/.test(adapterId))) {
    throw new Error('valid---adapter-id-required');
  }

  if (options.operation === 'stage') {
    if (!options.input) throw new Error('--input-manifest-required');
    const manifest = await readJson(path.resolve(options.input));
    await verifyArtifact(manifest);
    registry.stage(manifest);
    await atomicWrite(registryFile, registry.snapshot());
  } else if (options.operation === 'evaluate') {
    if (!options.input) throw new Error('--input-holdout-evaluation-required');
    const input = await readJson(path.resolve(options.input));
    const report = registry.evaluateCandidate(adapterId, input);
    await atomicWrite(registryFile, registry.snapshot());
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  } else if (options.operation === 'approve') {
    if (SECRET.length < 32 || !APPROVER) throw new Error('approval-secret-and-approver-id-required');
    const record = registry.snapshot().adapters.find(item => item.manifest.adapterId === adapterId);
    if (!record || record.status !== 'eligible' || !record.evaluation?.eligible) {
      throw new Error('only-an-independently-eligible-candidate-can-be-approved');
    }
    const unsigned = {
      approvalId: randomUUID(),
      actorId: APPROVER,
      approvedAt: Date.now(),
    };
    const context = {
      adapterId,
      reportId: record.evaluation.reportId,
      baseModelFingerprint: record.manifest.baseModel.fingerprint,
    };
    const approval = {
      ...unsigned,
      signature: createNeuroPlasticApprovalSignature(unsigned, context, SECRET),
    };
    const outputPath = path.resolve(options.output || ('state/' + adapterId + '.approval.json'));
    const safeOutput = insideRoot(path.relative(ROOT, outputPath), 'approval-output-path');
    await atomicWrite(safeOutput, { adapterId, ...context, approval });
    process.stdout.write('NEURO_PLASTIC_APPROVAL_CREATED=' + safeOutput + '\n');
    return;
  } else if (options.operation === 'activate') {
    if (!SECRET || !options.input) throw new Error('approval-secret-and---input-approval-required');
    const input = await readJson(path.resolve(options.input));
    if (input.adapterId !== adapterId) throw new Error('approval-adapter-id-mismatch');
    await registry.activate(adapterId, input.approval, (approval, context) =>
      verifyNeuroPlasticApprovalSignature(approval, context, SECRET));
    await atomicWrite(registryFile, registry.snapshot());
  } else if (options.operation === 'rollback') {
    const reason = String(options.reason || '').trim();
    if (!reason) throw new Error('--reason-required-for-rollback');
    registry.rollback(adapterId, reason);
    await atomicWrite(registryFile, registry.snapshot());
  } else {
    usage();
    throw new Error('unknown-operation');
  }
  process.stdout.write('NEURO_PLASTIC_REGISTRY=PASS operation=' + options.operation + ' registry=' + registryFile + '\n');
}

main().catch(error => {
  process.stderr.write('NEURO_PLASTIC_REGISTRY_ERROR=' + String(error?.message || error) + '\n');
  process.exitCode = 1;
});
