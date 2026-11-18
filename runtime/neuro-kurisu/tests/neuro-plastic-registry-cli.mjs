import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalNeuroPlasticApprovalPayload, canonicalNeuroPlasticEvaluationReceiptPayload, createNeuroPlasticEvaluationReceiptPayload, neuroPlasticAdapterManifestFingerprint } from '../src/organism/learning/NeuroPlasticAdapterRegistry.ts';
import { fileURLToPath } from 'node:url';

const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'neuro-plastic-cli-'));
const cliPath = fileURLToPath(new URL('../scripts/neuro_plastic_registry.mjs', import.meta.url));
const evaluatorSigner = generateKeyPairSync('ed25519');
const approvalSigner = generateKeyPairSync('ed25519');
const evaluatorPublicPem = evaluatorSigner.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const approvalPublicPem = approvalSigner.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const adapterId = 'kurisu-reasoning-cli-v1';
const baseFingerprint = 'a'.repeat(64);
const tokenizerFingerprint = 'b'.repeat(64);
const sourceDatasetFingerprint = 'c'.repeat(64);
const holdoutFingerprint = 'd'.repeat(64);
const corpusFingerprint = 'e'.repeat(64);
const sha = (value) => createHash('sha256').update(value).digest('hex');

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', cliPath, ...args], {
    cwd: runtimeRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NEURO_PLASTIC_RUNTIME_ROOT: runtimeRoot,
      NEURO_PLASTIC_REGISTRY_FILE: 'state/neuro-plastic-adapters.json',
      NEURO_PLASTIC_APPROVAL_PUBLIC_KEYS_JSON: JSON.stringify({ 'cli-test-operator': approvalPublicPem }),
      NEURO_PLASTIC_APPROVER_ID: 'cli-test-operator',
      NEURO_PLASTIC_EVALUATOR_PUBLIC_KEYS_JSON: JSON.stringify({ 'independent-verifier-v1': evaluatorPublicPem }),
    },
  });
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return result;
}

try {
  const adapterDirectory = path.join(runtimeRoot, 'adapter-store', adapterId);
  await mkdir(adapterDirectory, { recursive: true });
  const configBytes = Buffer.from(JSON.stringify({ r: 16, lora_alpha: 32 }), 'utf8');
  const weightBytes = Buffer.from('synthetic-safetensors-test-fixture', 'utf8');
  await writeFile(path.join(adapterDirectory, 'adapter_config.json'), configBytes);
  await writeFile(path.join(adapterDirectory, 'adapter_model.safetensors'), weightBytes);
  await writeFile(path.join(adapterDirectory, 'neuro-plastic-artifact.json'), JSON.stringify({
    schemaVersion: 1,
    adapterId,
    method: 'lora',
    domain: 'reasoning',
    baseModelFingerprint: baseFingerprint,
    tokenizerFingerprint,
    sourceDatasetFingerprint,
    holdoutPlanFingerprint: holdoutFingerprint,
    corpusFingerprint,
    automaticActivation: false,
    artifacts: {
      'adapter_config.json': { sha256: sha(configBytes), bytes: configBytes.byteLength },
      'adapter_model.safetensors': { sha256: sha(weightBytes), bytes: weightBytes.byteLength },
    },
  }));

  const manifest = {
    schemaVersion: 1,
    adapterId,
    domain: 'reasoning',
    method: 'lora',
    baseModel: {
      id: 'kurisu-7b',
      backendId: 'llama.cpp',
      servedModelAlias: 'kurisu-base',
      fingerprint: baseFingerprint,
    },
    tokenizerFingerprint,
    sourceDatasetFingerprint,
    holdoutPlanFingerprint: holdoutFingerprint,
    corpusFingerprint,
    artifact: {
      directory: 'adapter-store/' + adapterId,
      configSha256: sha(configBytes),
      weightsSha256: sha(weightBytes),
      totalBytes: configBytes.byteLength + weightBytes.byteLength,
    },
    trainer: { name: 'fixture-trainer', version: '1.0', seed: 7, completedAt: 1_800_000_000_000 },
    governance: {
      trainingOptIn: true,
      privacyReviewed: true,
      licenseApproved: true,
      piiScreening: 'passed',
      evidenceCount: 7,
      attestedBy: 'reviewer',
      attestedAt: 1_800_000_000_000,
      licenseId: 'test-fixture-license',
    },
    servedModelAlias: 'kurisu-reasoning-cli',
  };
  const manifestPath = path.join(runtimeRoot, 'adapter-manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest));

  const tamperedManifestPath = path.join(runtimeRoot, 'tampered-manifest.json');
  await writeFile(tamperedManifestPath, JSON.stringify({
    ...manifest,
    artifact: { ...manifest.artifact, weightsSha256: 'f'.repeat(64) },
  }));
  run(['stage', '--input', tamperedManifestPath], 1);

  run(['stage', '--input', manifestPath]);
  const evaluation = {
    manifestFingerprint: neuroPlasticAdapterManifestFingerprint(manifest),
    holdoutFingerprint,
    evaluatedAt: 1_800_000_000_100,
    baseline: [],
    candidate: [],
  };
  for (let index = 0; index < 7; index++) {
    const pair = {
      pairId: 'holdout-task-' + index,
      seed: index + 100,
      split: 'holdout',
      authority: 'independent-verifier',
      verifierId: 'independent-verifier-v1',
      holdoutFingerprint,
      metrics: {
        quality01: 0.6,
        safety01: 0.99,
        retention01: 0.99,
        cost01: 0.2,
        latencyMs: 800,
        safetyViolationCount: 0,
      },
    };
    evaluation.baseline.push(pair);
    evaluation.candidate.push({
      ...pair,
      metrics: { ...pair.metrics, quality01: 0.82 },
    });
  }
  const unsignedReceipt = createNeuroPlasticEvaluationReceiptPayload(
    adapterId,
    evaluation,
    'independent-verifier-v1',
    'cli-holdout-evaluation-1',
  );
  const receipt = {
    ...unsignedReceipt,
    signature: sign(
      null,
      Buffer.from(canonicalNeuroPlasticEvaluationReceiptPayload(adapterId, unsignedReceipt), 'utf8'),
      evaluatorSigner.privateKey,
    ).toString('base64'),
  };
  const evaluationPath = path.join(runtimeRoot, 'holdout-evaluation.json');
  await writeFile(evaluationPath, JSON.stringify({ ...evaluation, receipt }));
  const tamperedPath = path.join(runtimeRoot, 'tampered-holdout-evaluation.json');
  await writeFile(tamperedPath, JSON.stringify({
    ...evaluation,
    candidate: evaluation.candidate.map((row, index) => index === 0
      ? { ...row, metrics: { ...row.metrics, quality01: 0.99 } }
      : row),
    receipt,
  }));
  run(['evaluate', '--adapter', adapterId, '--input', tamperedPath], 1);
  run(['evaluate', '--adapter', adapterId, '--input', evaluationPath]);

  const approvalRequestPath = path.join(runtimeRoot, 'state', adapterId + '.approval-request.json');
  run(['approve', '--adapter', adapterId]);
  const approvalRequest = JSON.parse(await readFile(approvalRequestPath, 'utf8'));
  assert.equal(approvalRequest.approvalRequest.actorId, 'cli-test-operator');
  assert.equal(approvalRequest.manifestFingerprint, neuroPlasticAdapterManifestFingerprint(manifest),
    'operator approval request must bind the exact staged adapter manifest');
  const approvalSignature = sign(
    null,
    Buffer.from(approvalRequest.canonicalPayload, 'utf8'),
    approvalSigner.privateKey,
  ).toString('base64');
  const approval = {
    adapterId,
    reportId: approvalRequest.reportId,
    baseModelFingerprint: approvalRequest.baseModelFingerprint,
    manifestFingerprint: approvalRequest.manifestFingerprint,
    approval: { ...approvalRequest.approvalRequest, signature: approvalSignature },
  };
  const approvalPath = path.join(runtimeRoot, 'state', adapterId + '.approval.json');
  await writeFile(approvalPath, JSON.stringify(approval));
  run(['activate', '--adapter', adapterId, '--input', approvalPath]);

  const registryPath = path.join(runtimeRoot, 'state', 'neuro-plastic-adapters.json');
  let snapshot = JSON.parse(await readFile(registryPath, 'utf8'));
  assert.equal(snapshot.adapters[0].status, 'active');
  assert.equal(snapshot.adapters[0].activationApproval.approvalId, approval.approval.approvalId);

  // A fresh process preserves ACTIVE only when evaluator and operator Ed25519 signatures both verify.
  run(['rollback', '--adapter', adapterId, '--reason', 'exercise rollback and registry persistence']);
  snapshot = JSON.parse(await readFile(registryPath, 'utf8'));
  assert.equal(snapshot.adapters[0].status, 'disabled');

  console.log('NEURO_PLASTIC_REGISTRY_CLI=PASS artifactTamperRejected=1 evaluatorTamperRejected=1 holdoutPairs=7 approvalEd25519=1 evaluatorEd25519=1 activation=1 rollback=1');
} finally {
  await rm(runtimeRoot, { recursive: true, force: true });
}
