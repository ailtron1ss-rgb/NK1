import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLocalInferenceBenchmark, compareLocalInferenceBenchmarks } from '../src/organism/system/LocalInferenceBenchmark.ts';
import { LocalModelArtifactStore } from '../src/organism/integration/local/LocalModelArtifactStore.ts';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const temp = await mkdtemp(join(tmpdir(), 'nk1-local-model-evidence-'));

try {
  const dataset = [
    { id: 'math-exact', category: 'reasoning', system: 'Follow the exact output rule.', user: 'Output only the number 42.', assertions: [{ type: 'exact', value: '42' }] },
    { id: 'ru-instruction', category: 'russian', system: 'Answer in Russian.', user: 'Say that the verification passed.', assertions: [{ type: 'contains', value: 'Проверка пройдена' }, { type: 'not-contains', value: 'I cannot' }] },
    { id: 'json-shape', category: 'structured', system: 'Return JSON only.', user: 'Return an object with ok true and count 2.', assertions: [{ type: 'json-keys', keys: ['ok', 'count'] }] },
  ];
  const makeProvider = (texts, latencies = [10, 20, 30]) => {
    let index = 0;
    return {
      async generate(request) {
        const i = index++;
        assert.equal(typeof request.user, 'string');
        return {
          text: texts[i],
          backend: 'llama.cpp:q4',
          model: 'qwen-local-q4',
          latencyMs: latencies[i],
          usage: { promptTokens: 12, completionTokens: 2, totalTokens: 14 },
        };
      },
    };
  };
  const model = {
    repoId: 'Qwen/Qwen3.5-4B',
    revision: '851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a',
    artifactSha256: 'a'.repeat(64),
    quantization: 'Q4_K_M',
    licenseId: 'apache-2.0',
  };
  const runtime = { name: 'llama.cpp', version: 'b8672', serverBuild: 'b8672' };
  const baseline = await runLocalInferenceBenchmark({
    provider: makeProvider(['42', 'Проверка пройдена', '{"ok":true,"count":2}']),
    model, runtime, cases: dataset,
  });
  assert.equal(baseline.metrics.requestCount, 3);
  assert.equal(baseline.metrics.passedRequests, 3);
  assert.equal(baseline.metrics.objectivePassRate01, 1);
  assert.equal(baseline.metrics.latencyP50Ms, 20);
  assert.equal(baseline.metrics.latencyP95Ms, 30);
  assert.equal(baseline.metrics.completionTokensPerSecond, 100);
  assert.equal(baseline.results.length, 3);
  assert.ok(baseline.results.every(row => !Object.hasOwn(row, 'text') && !Object.hasOwn(row, 'prompt')));
  assert.equal(baseline.privacy.promptsRecorded, false);
  assert.equal(baseline.privacy.outputsRecorded, false);
  assert.equal(baseline.evidenceLimit, 'deterministic-assertions-are-not-a-human-quality-rating');

  const candidate = await runLocalInferenceBenchmark({
    provider: makeProvider(['42', 'не та фраза', '{"ok":true,"count":2}']),
    model: { ...model, artifactSha256: 'b'.repeat(64) },
    runtime, cases: dataset,
  });
  assert.equal(candidate.metrics.objectivePassRate01, 2 / 3);
  const comparison = compareLocalInferenceBenchmarks(baseline, candidate);
  assert.equal(comparison.pairedRequests, 3);
  assert.equal(comparison.baselineObjectivePassRate01, 1);
  assert.equal(comparison.candidateObjectivePassRate01, 2 / 3);
  assert.ok(comparison.datasetFingerprint === baseline.datasetFingerprint);
  assert.throws(() => compareLocalInferenceBenchmarks(baseline, { ...candidate, datasetFingerprint: 'c'.repeat(64) }), /dataset-fingerprint-mismatch/);

  const failed = await runLocalInferenceBenchmark({
    provider: { async generate() { throw new Error('llama.cpp-timeout'); } },
    model, runtime, cases: [dataset[0]],
  });
  assert.equal(failed.metrics.failedRequests, 1);
  assert.equal(failed.metrics.requestErrorRate01, 1);
  assert.equal(failed.results[0].errorCode, 'llama.cpp-timeout');
  assert.equal(failed.metrics.completionTokensPerSecond, null);
  await assert.rejects(() => runLocalInferenceBenchmark({
    provider: makeProvider(['42', '42']), model, runtime, cases: [dataset[0], dataset[0]],
  }), /duplicate-case-id/);

  const sourcePath = join(temp, 'candidate.gguf');
  const bytes = Buffer.from('NK1 immutable local-model fixture bytes');
  await writeFile(sourcePath, bytes);
  const artifactHash = sha256(bytes);
  const manifest = {
    schemaVersion: 1,
    artifactSha256: artifactHash,
    artifactBytes: bytes.length,
    modelRepoId: 'Qwen/Qwen3.5-4B',
    modelRevision: '851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a',
    baseModelRepoId: 'Qwen/Qwen3.5-4B-Base',
    baseModelRevision: 'd'.repeat(40),
    modelLicenseId: 'apache-2.0',
    modelLicenseUrl: 'https://huggingface.co/Qwen/Qwen3.5-4B/blob/main/LICENSE',
    format: 'gguf',
    quantization: 'Q4_K_M',
    architecture: 'qwen3_5',
    tokenizerSha256: 'e'.repeat(64),
    chatTemplateSha256: 'f'.repeat(64),
    adaptation: { method: 'base', parentArtifactSha256: null, trainingDatasetSha256: null, trainingRunId: null },
    createdAt: 1793784800000,
  };
  const store = new LocalModelArtifactStore(join(temp, 'store'));
  const staged = await store.register(sourcePath, manifest);
  assert.equal(staged.manifest.artifactSha256, artifactHash);
  assert.equal(await readFile(staged.artifactPath, 'utf8'), bytes.toString());
  assert.equal(staged.reused, false);
  const stat = await (await import('node:fs/promises')).stat(staged.artifactPath);
  if (process.platform !== 'win32') assert.equal(stat.mode & 0o222, 0, 'registered weight blobs must be read-only');
  const repeated = await store.register(sourcePath, manifest);
  assert.equal(repeated.reused, true, 'identical content and metadata must be idempotent');
  assert.equal((await store.resolve(artifactHash)).manifest.artifactSha256, artifactHash);

  await assert.rejects(() => store.register(sourcePath, { ...manifest, artifactSha256: '9'.repeat(64) }), /artifact-hash-mismatch/);
  await assert.rejects(() => store.register(sourcePath, { ...manifest, modelLicenseId: 'changed-license' }), /manifest-conflict/);
  await assert.rejects(() => store.register(sourcePath, {
    ...manifest,
    adaptation: { method: 'lora', parentArtifactSha256: null, trainingDatasetSha256: null, trainingRunId: null },
  }), /adaptation-provenance-required/);

  const tamperPath = staged.artifactPath;
  await chmod(tamperPath, 0o600);
  await writeFile(tamperPath, 'tampered weights');
  await assert.rejects(() => store.resolve(artifactHash), /stored-artifact-integrity-failed/);

  const symlinkPath = join(temp, 'linked.gguf');
  await symlink(sourcePath, symlinkPath);
  await assert.rejects(() => store.register(symlinkPath, manifest), /source-must-be-regular-file/);

  console.log(JSON.stringify({
    status: 'PASS',
    benchmarkCases: 3,
    benchmarkComparison: 'same-dataset-paired-request-delta',
    weightStore: 'content-addressed-read-only',
    checks: 23,
  }));
} finally {
  await rm(temp, { recursive: true, force: true });
}
