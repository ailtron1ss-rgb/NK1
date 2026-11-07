import { createHash } from 'node:crypto';
import { cpus, freemem, totalmem } from 'node:os';

export type LocalInferenceTaskCategory = 'instruction' | 'reasoning' | 'russian' | 'english' | 'structured';
export type LocalInferenceAssertion =
  | { type: 'exact'; value: string }
  | { type: 'contains'; value: string }
  | { type: 'not-contains'; value: string }
  | { type: 'json-keys'; keys: string[] };

export interface LocalInferenceBenchmarkCase {
  id: string;
  category: LocalInferenceTaskCategory;
  system: string;
  user: string;
  assertions: LocalInferenceAssertion[];
  maxTokens?: number;
}

export interface LocalInferenceBenchmarkProvider {
  generate(request: { system: string; user: string; maxTokens?: number; temperature?: number }): Promise<{
    text: string;
    backend: string;
    model: string;
    latencyMs: number;
    usage?: { promptTokens?: number | null; completionTokens?: number | null; totalTokens?: number | null };
  }>;
}

export interface LocalInferenceBenchmarkModel {
  repoId: string;
  revision: string;
  artifactSha256: string;
  quantization: string;
  licenseId: string;
}

export interface LocalInferenceBenchmarkRuntime {
  name: string;
  version: string;
  serverBuild: string;
}

export interface LocalInferenceBenchmarkReport {
  schemaVersion: 1;
  benchmarkId: 'nk1-local-inference-v1';
  startedAt: number;
  completedAt: number;
  durationMs: number;
  datasetFingerprint: string;
  model: LocalInferenceBenchmarkModel;
  runtime: LocalInferenceBenchmarkRuntime;
  environment: {
    platform: string;
    arch: string;
    nodeVersion: string;
    cpuCount: number;
    hostTotalMemoryBytes: number;
    hostFreeMemoryBeforeBytes: number;
    hostFreeMemoryAfterBytes: number;
    runnerRssBeforeBytes: number;
    runnerRssAfterBytes: number;
    runnerHeapBeforeBytes: number;
    runnerHeapAfterBytes: number;
  };
  metrics: {
    requestCount: number;
    passedRequests: number;
    failedRequests: number;
    transportErrors: number;
    objectivePassRate01: number;
    requestErrorRate01: number;
    latencyMeanMs: number | null;
    latencyP50Ms: number | null;
    latencyP95Ms: number | null;
    completionTokensPerSecond: number | null;
    completionTokensMeasured: number;
    categoryPassRates01: Record<string, number>;
    runnerRssDeltaBytes: number;
    hostFreeMemoryDeltaBytes: number;
  };
  results: Array<{
    caseId: string;
    category: LocalInferenceTaskCategory;
    repetition: number;
    passed: boolean;
    passedChecks: number;
    totalChecks: number;
    latencyMs: number | null;
    backend: string | null;
    reportedModel: string | null;
    completionTokens: number | null;
    outputSha256: string | null;
    errorCode: string | null;
  }>;
  privacy: { promptsRecorded: false; outputsRecorded: false };
  evidenceLimit: 'deterministic-assertions-are-not-a-human-quality-rating';
  resourceLimit: 'runner-process-and-host-free-memory-only-not-inference-server-or-gpu-memory';
}

const SHA256 = /^[a-f0-9]{64}$/;
const REVISION = /^[a-f0-9]{7,64}$/i;
const CATEGORIES = new Set<LocalInferenceTaskCategory>(['instruction', 'reasoning', 'russian', 'english', 'structured']);
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const round = (value: number) => Math.round(value * 1000) / 1000;

function validateInput(input: {
  model: LocalInferenceBenchmarkModel;
  runtime: LocalInferenceBenchmarkRuntime;
  cases: LocalInferenceBenchmarkCase[];
  repetitions?: number;
}): number {
  if (!input.model || !/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(input.model.repoId) ||
      !REVISION.test(input.model.revision) || !SHA256.test(input.model.artifactSha256) ||
      !input.model.quantization?.trim() || !input.model.licenseId?.trim()) {
    throw new Error('local-benchmark-model-provenance-invalid');
  }
  if (!input.runtime?.name?.trim() || !input.runtime.version?.trim() || !input.runtime.serverBuild?.trim()) {
    throw new Error('local-benchmark-runtime-identity-required');
  }
  if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 128) {
    throw new Error('local-benchmark-case-count-out-of-range');
  }
  const repetitions = input.repetitions ?? 1;
  if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 5) {
    throw new Error('local-benchmark-repetitions-out-of-range');
  }
  const ids = new Set<string>();
  for (const item of input.cases) {
    if (!item || !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(item.id) || ids.has(item.id) ||
        !CATEGORIES.has(item.category) || typeof item.system !== 'string' || item.system.length > 8192 ||
        typeof item.user !== 'string' || item.user.length < 1 || item.user.length > 8192 ||
        !Array.isArray(item.assertions) || item.assertions.length < 1 || item.assertions.length > 12) {
      throw new Error(ids.has(item?.id) ? 'local-benchmark-duplicate-case-id' : 'local-benchmark-case-invalid');
    }
    ids.add(item.id);
    for (const assertion of item.assertions) {
      if (!assertion || !['exact', 'contains', 'not-contains', 'json-keys'].includes(assertion.type)) {
        throw new Error('local-benchmark-assertion-invalid');
      }
      if (assertion.type === 'json-keys') {
        if (!Array.isArray(assertion.keys) || assertion.keys.length < 1 || assertion.keys.length > 16 ||
            assertion.keys.some(key => typeof key !== 'string' || !key.trim())) {
          throw new Error('local-benchmark-json-keys-invalid');
        }
      } else if (typeof assertion.value !== 'string' || assertion.value.length > 1000) {
        throw new Error('local-benchmark-assertion-value-invalid');
      }
    }
  }
  return repetitions;
}

function evaluate(text: string, assertions: LocalInferenceAssertion[]): number {
  let passed = 0;
  for (const assertion of assertions) {
    let ok = false;
    if (assertion.type === 'exact') ok = text.trim() === assertion.value;
    else if (assertion.type === 'contains') ok = text.toLocaleLowerCase().includes(assertion.value.toLocaleLowerCase());
    else if (assertion.type === 'not-contains') ok = !text.toLocaleLowerCase().includes(assertion.value.toLocaleLowerCase());
    else {
      try {
        const parsed: unknown = JSON.parse(text);
        ok = Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
          assertion.keys.every(key => Object.prototype.hasOwnProperty.call(parsed, key)));
      } catch { ok = false; }
    }
    if (ok) passed += 1;
  }
  return passed;
}

function errorCode(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'local-provider-failure');
  return raw.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96) || 'local-provider-failure';
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

export async function runLocalInferenceBenchmark(input: {
  provider: LocalInferenceBenchmarkProvider;
  model: LocalInferenceBenchmarkModel;
  runtime: LocalInferenceBenchmarkRuntime;
  cases: LocalInferenceBenchmarkCase[];
  repetitions?: number;
}): Promise<LocalInferenceBenchmarkReport> {
  if (!input.provider || typeof input.provider.generate !== 'function') throw new Error('local-benchmark-provider-required');
  const repetitions = validateInput(input);
  const startedAt = Date.now();
  const memoryBefore = process.memoryUsage();
  const freeBefore = freemem();
  const results: LocalInferenceBenchmarkReport['results'] = [];

  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    for (const item of input.cases) {
      try {
        const response = await input.provider.generate({
          system: item.system,
          user: item.user,
          maxTokens: Math.max(1, Math.min(2048, Math.floor(item.maxTokens ?? 256))),
          temperature: 0,
        });
        if (!response || typeof response.text !== 'string' || !response.text.trim()) throw new Error('local-benchmark-empty-output');
        if (!Number.isFinite(response.latencyMs) || response.latencyMs < 0) throw new Error('local-benchmark-invalid-latency');
        const completionTokens = Number.isSafeInteger(response.usage?.completionTokens) && Number(response.usage?.completionTokens) >= 0
          ? Number(response.usage?.completionTokens) : null;
        results.push({
          caseId: item.id, category: item.category, repetition,
          passed: evaluate(response.text, item.assertions) === item.assertions.length,
          passedChecks: evaluate(response.text, item.assertions), totalChecks: item.assertions.length,
          latencyMs: round(response.latencyMs),
          backend: String(response.backend ?? '').slice(0, 160) || null,
          reportedModel: String(response.model ?? '').slice(0, 160) || null,
          completionTokens,
          outputSha256: createHash('sha256').update(response.text).digest('hex'),
          errorCode: null,
        });
      } catch (error) {
        results.push({
          caseId: item.id, category: item.category, repetition,
          passed: false, passedChecks: 0, totalChecks: item.assertions.length,
          latencyMs: null, backend: null, reportedModel: null, completionTokens: null,
          outputSha256: null, errorCode: errorCode(error),
        });
      }
    }
  }

  const completedAt = Date.now();
  const memoryAfter = process.memoryUsage();
  const freeAfter = freemem();
  const successful = results.filter(row => row.latencyMs !== null);
  const latencies = successful.map(row => row.latencyMs as number);
  const passed = results.filter(row => row.passed).length;
  const transportErrors = results.filter(row => row.errorCode !== null).length;
  const completionTokensMeasured = successful.filter(row => row.completionTokens !== null).length;
  const completionTokenTotal = successful.reduce((sum, row) => sum + (row.completionTokens ?? 0), 0);
  const totalLatencyMs = latencies.reduce((sum, value) => sum + value, 0);
  const categoryCounts = new Map<string, { passed: number; total: number }>();
  for (const row of results) {
    const current = categoryCounts.get(row.category) ?? { passed: 0, total: 0 };
    current.total += 1;
    if (row.passed) current.passed += 1;
    categoryCounts.set(row.category, current);
  }
  const categoryPassRates01 = Object.fromEntries([...categoryCounts.entries()].map(([key, value]) => [key, round(value.passed / value.total)]));
  return {
    schemaVersion: 1,
    benchmarkId: 'nk1-local-inference-v1',
    startedAt,
    completedAt,
    durationMs: Math.max(0, completedAt - startedAt),
    datasetFingerprint: createHash('sha256').update(JSON.stringify(input.cases)).digest('hex'),
    model: { ...input.model },
    runtime: { ...input.runtime },
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpuCount: cpus().length,
      hostTotalMemoryBytes: totalmem(),
      hostFreeMemoryBeforeBytes: freeBefore,
      hostFreeMemoryAfterBytes: freeAfter,
      runnerRssBeforeBytes: memoryBefore.rss,
      runnerRssAfterBytes: memoryAfter.rss,
      runnerHeapBeforeBytes: memoryBefore.heapUsed,
      runnerHeapAfterBytes: memoryAfter.heapUsed,
    },
    metrics: {
      requestCount: results.length,
      passedRequests: passed,
      failedRequests: results.length - passed,
      transportErrors,
      objectivePassRate01: results.length ? clamp(passed / results.length) : 0,
      requestErrorRate01: results.length ? clamp(transportErrors / results.length) : 0,
      latencyMeanMs: latencies.length ? round(totalLatencyMs / latencies.length) : null,
      latencyP50Ms: percentile(latencies, 0.5),
      latencyP95Ms: percentile(latencies, 0.95),
      completionTokensPerSecond: completionTokensMeasured === results.length && totalLatencyMs > 0
        ? round(completionTokenTotal / (totalLatencyMs / 1000)) : null,
      completionTokensMeasured,
      categoryPassRates01,
      runnerRssDeltaBytes: memoryAfter.rss - memoryBefore.rss,
      hostFreeMemoryDeltaBytes: freeAfter - freeBefore,
    },
    results,
    privacy: { promptsRecorded: false, outputsRecorded: false },
    evidenceLimit: 'deterministic-assertions-are-not-a-human-quality-rating',
    resourceLimit: 'runner-process-and-host-free-memory-only-not-inference-server-or-gpu-memory',
  };
}

export function compareLocalInferenceBenchmarks(
  baseline: LocalInferenceBenchmarkReport,
  candidate: LocalInferenceBenchmarkReport,
): {
  schemaVersion: 1;
  datasetFingerprint: string;
  pairedRequests: number;
  baselineModelSha256: string;
  candidateModelSha256: string;
  baselineObjectivePassRate01: number;
  candidateObjectivePassRate01: number;
  objectivePassRateDelta01: number;
  latencyP50DeltaMs: number | null;
  latencyP95DeltaMs: number | null;
  completionTokensPerSecondDelta: number | null;
  interpretation: 'descriptive-only-no-statistical-significance-or-training-claim';
} {
  if (!baseline || !candidate || baseline.datasetFingerprint !== candidate.datasetFingerprint) {
    throw new Error('local-benchmark-dataset-fingerprint-mismatch');
  }
  if (baseline.model.artifactSha256 === candidate.model.artifactSha256) throw new Error('local-benchmark-model-artifacts-must-differ');
  if (baseline.metrics.requestCount !== candidate.metrics.requestCount) throw new Error('local-benchmark-paired-request-count-mismatch');
  const delta = (a: number | null, b: number | null) => a === null || b === null ? null : round(b - a);
  return {
    schemaVersion: 1,
    datasetFingerprint: baseline.datasetFingerprint,
    pairedRequests: baseline.metrics.requestCount,
    baselineModelSha256: baseline.model.artifactSha256,
    candidateModelSha256: candidate.model.artifactSha256,
    baselineObjectivePassRate01: baseline.metrics.objectivePassRate01,
    candidateObjectivePassRate01: candidate.metrics.objectivePassRate01,
    objectivePassRateDelta01: round(candidate.metrics.objectivePassRate01 - baseline.metrics.objectivePassRate01),
    latencyP50DeltaMs: delta(baseline.metrics.latencyP50Ms, candidate.metrics.latencyP50Ms),
    latencyP95DeltaMs: delta(baseline.metrics.latencyP95Ms, candidate.metrics.latencyP95Ms),
    completionTokensPerSecondDelta: delta(baseline.metrics.completionTokensPerSecond, candidate.metrics.completionTokensPerSecond),
    interpretation: 'descriptive-only-no-statistical-significance-or-training-claim',
  };
}
