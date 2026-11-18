#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyNeuroPlasticAdapterArtifact } from '../src/organism/learning/NeuroPlasticArtifactVerifier.ts';
import {
  NeuroPlasticAdapterRegistry,
  canonicalNeuroPlasticApprovalPayload,
  neuroPlasticAdapterManifestFingerprint,
  parseTrustedNeuroPlasticApprovalKeys,
  verifyNeuroPlasticApprovalSignature,
  verifyNeuroPlasticEvaluationSignature,
  verifyNeuroPlasticEvaluationReceiptSignature,
} from '../src/organism/learning/NeuroPlasticAdapterRegistry.ts';

const ROOT = path.resolve(process.env.NEURO_PLASTIC_RUNTIME_ROOT || process.cwd());
const APPROVAL_PUBLIC_KEYS = parseTrustedNeuroPlasticApprovalKeys(process.env.NEURO_PLASTIC_APPROVAL_PUBLIC_KEYS_JSON);
const EVALUATOR_PUBLIC_KEY = String(process.env.NEURO_PLASTIC_EVALUATOR_PUBLIC_KEY || '');
const APPROVER = String(process.env.NEURO_PLASTIC_APPROVER_ID || '').trim();
const APPROVER_KEY_ID = String(process.env.NEURO_PLASTIC_APPROVER_KEY_ID || '').trim();

function usage() {
  process.stdout.write([
    'Usage:',
    '  node --experimental-strip-types scripts/neuro_plastic_registry.mjs stage --input manifest.json',
    '  node --experimental-strip-types scripts/neuro_plastic_registry.mjs evaluate --adapter ID --input holdout-evaluation.json',
    '  node --experimental-strip-types scripts/neuro_plastic_registry.mjs approve --adapter ID --output approval.json',
    '  node --experimental-strip-types scripts/neuro_plastic_registry.mjs activate --adapter ID --input approval.json',
    '  node --experimental-strip-types scripts/neuro_plastic_registry.mjs rollback --adapter ID --reason "reason"',
    '',
    'Set NEURO_PLASTIC_EVALUATOR_PUBLIC_KEY (Ed25519 public PEM) for receipt verification.',
    'Set NEURO_PLASTIC_APPROVER_ID, NEURO_PLASTIC_APPROVER_KEY_ID and NEURO_PLASTIC_APPROVAL_PUBLIC_KEYS_JSON for approval requests.',
    'The approve command emits an unsigned canonical payload; an external Ed25519 signer must add a base64 signature.',
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
  await assertNoSymlinkAncestors(filePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await assertNoSymlinkAncestors(filePath);
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

async function assertNoSymlinkAncestors(targetPath) {
  const relative = path.relative(ROOT, path.dirname(targetPath));
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('path-escapes-runtime-root');
  }
  let cursor = ROOT;
  for (const segment of relative ? relative.split(path.sep) : []) {
    cursor = path.join(cursor, segment);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new Error('refusing-symlink-or-nondirectory-in-runtime-path');
      }
    } catch (error) {
      if (error?.code === 'ENOENT') break;
      throw error;
    }
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
    await registry.restore(
      snapshot,
      (approval, context, purpose) => verifyNeuroPlasticApprovalSignature(approval, context, APPROVAL_PUBLIC_KEYS, { purpose }),
      (receipt, context) => verifyNeuroPlasticEvaluationReceiptSignature(context.adapterId, receipt, EVALUATOR_PUBLIC_KEY),
      (manifest) => verifyNeuroPlasticAdapterArtifact(ROOT, manifest),
    );
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
    if (!await verifyNeuroPlasticAdapterArtifact(ROOT, manifest)) {
      throw new Error('adapter-artifact-integrity-verification-failed');
    }
    registry.stage(manifest);
    await atomicWrite(registryFile, registry.snapshot());
  } else if (options.operation === 'evaluate') {
    if (!options.input) throw new Error('--input-holdout-evaluation-required');
    const input = await readJson(path.resolve(options.input));
    if (!EVALUATOR_PUBLIC_KEY.includes('PUBLIC KEY')) throw new Error('independent-evaluator-public-key-required');
    const report = registry.evaluateCandidate(adapterId, input, (receipt) =>
      verifyNeuroPlasticEvaluationSignature(adapterId, input, receipt, EVALUATOR_PUBLIC_KEY));
    await atomicWrite(registryFile, registry.snapshot());
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  } else if (options.operation === 'approve') {
    if (!APPROVER || !APPROVER_KEY_ID || !APPROVAL_PUBLIC_KEYS.has(APPROVER_KEY_ID)) {
      throw new Error('trusted-approval-public-key-and-approver-identities-required');
    }
    const record = registry.snapshot().adapters.find(item => item.manifest.adapterId === adapterId);
    if (!record || record.status !== 'eligible' || !record.evaluation?.eligible) {
      throw new Error('only-an-independently-eligible-candidate-can-be-approved');
    }
    const context = {
      adapterId,
      reportId: record.evaluation.reportId,
      baseModelFingerprint: record.manifest.baseModel.fingerprint,
      manifestFingerprint: neuroPlasticAdapterManifestFingerprint(record.manifest),
    };
    const approval = {
      approvalId: randomUUID(),
      actorId: APPROVER,
      approvedAt: Date.now(),
      signerKeyId: APPROVER_KEY_ID,
    };
    const canonicalPayload = canonicalNeuroPlasticApprovalPayload(approval, context);
    const outputPath = path.resolve(options.output || ('state/' + adapterId + '.approval-request.json'));
    const safeOutput = insideRoot(path.relative(ROOT, outputPath), 'approval-output-path');
    await atomicWrite(safeOutput, {
      schemaVersion: 1,
      adapterId,
      ...context,
      approval,
      canonicalPayload,
      signing: { algorithm: 'Ed25519', encoding: 'base64', privateKeyLocation: 'external-signer-only' },
    });
    process.stdout.write('NEURO_PLASTIC_APPROVAL_REQUEST=' + safeOutput + '\n');
    return;
  } else if (options.operation === 'activate') {
    if (!options.input) throw new Error('--input-signed-approval-required');
    const input = await readJson(path.resolve(options.input));
    if (input.adapterId !== adapterId) throw new Error('approval-adapter-id-mismatch');
    const record = registry.snapshot().adapters.find(item => item.manifest.adapterId === adapterId);
    if (!record || record.status !== 'eligible' || !record.evaluation?.eligible) {
      throw new Error('only-an-eligible-candidate-can-be-activated');
    }
    const context = {
      adapterId,
      reportId: record.evaluation.reportId,
      baseModelFingerprint: record.manifest.baseModel.fingerprint,
      manifestFingerprint: neuroPlasticAdapterManifestFingerprint(record.manifest),
    };
    for (const key of ['reportId', 'baseModelFingerprint', 'manifestFingerprint']) {
      if (input[key] !== context[key]) throw new Error('approval-context-mismatch-' + key);
    }
    const canonicalPayload = canonicalNeuroPlasticApprovalPayload(input.approval, context);
    if (input.canonicalPayload !== canonicalPayload) throw new Error('approval-canonical-payload-mismatch');
    await registry.activate(adapterId, input.approval, (approval, verifiedContext, purpose) =>
      verifyNeuroPlasticApprovalSignature(approval, verifiedContext, APPROVAL_PUBLIC_KEYS, { purpose }));
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
