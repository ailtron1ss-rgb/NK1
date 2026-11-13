import { snapshotPlainData } from './LearningTrustBoundary.ts';
import type { ReflectiveRevisionRequest } from './P23LocalModelSkillRevisionGenerator.ts';

export interface GepaCandidateGeneratorOptions {
  enabled?: boolean;
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
}
export interface GepaCandidateGeneratorDiagnostics {
  provider: 'nk1-gepa-candidate-sidecar';
  enabled: boolean;
  configured: boolean;
  available: boolean;
  endpointHost: string | null;
  requests: number;
  failures: number;
  lastStatus: string;
}

const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_VALIDATION_ROWS = 128;
const MAX_TARGETS = 12;
const HASH = /^[a-f0-9]{64}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isUnit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const isText = (value: unknown, max = 160): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 &&
  value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const boundedInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
};
const SAFE_DIRECTIVES = Object.freeze({
  safety: 'Preserve every safety boundary. Repair only the validation-evidenced safety defect and require fresh independent safety evaluation.',
  'task-success': 'Repair the observed validation failure path. Specify preconditions, expected postconditions and bounded recovery.',
  trajectory: 'Use validation evidence to correct action ordering, missing steps and verification points.',
  'capability-coverage': 'Add only required capabilities explicitly missing from validation evidence; avoid unrelated capability growth.',
  executability: 'Repair the evidenced parsing or runtime-preflight defect while preserving the existing skill contract.',
});

function parseEndpoint(raw: string | undefined): URL | null {
  try {
    if (!raw?.trim()) return null;
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    const loopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
    if (!(url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) ||
        !url.hostname || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}
function projectStringIds(value: unknown, field: string, max = 128, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > max ||
      value.some(item => !isText(item, 160)) || new Set(value).size !== value.length) {
    throw new Error('gepa-invalid-' + field);
  }
  return value as string[];
}
function projectValidationReport(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw) || !isText(raw.taskId) || !isText(raw.trialId) ||
      (raw.taskFamily !== undefined && !isText(raw.taskFamily, 128)) ||
      !isRecord(raw.taskSuccess) || typeof raw.taskSuccess.passed !== 'boolean' ||
      raw.taskSuccess.passRate !== (raw.taskSuccess.passed ? 1 : 0) ||
      !isRecord(raw.skillQuality) || !isUnit(raw.skillQuality.functionalCoverage) ||
      !isUnit(raw.skillQuality.executability) || !isUnit(raw.skillQuality.safety) ||
      !isUnit(raw.skillQuality.aggregate) ||
      !Number.isSafeInteger(raw.skillQuality.safetyViolationCount) ||
      Number(raw.skillQuality.safetyViolationCount) < 0 ||
      !isRecord(raw.trajectoryQuality) || !isUnit(raw.trajectoryQuality.keyPointRecall) ||
      !isUnit(raw.trajectoryQuality.executionOrder) || !isUnit(raw.trajectoryQuality.completeness) ||
      !isUnit(raw.trajectoryQuality.aggregate)) {
    throw new Error('gepa-invalid-validation-report');
  }
  const missingCapabilityIds = raw.skillQuality.missingCapabilityIds === undefined
    ? [] : projectStringIds(raw.skillQuality.missingCapabilityIds, 'missing-capabilities', 128, true);
  const missingStepIds = raw.trajectoryQuality.missingStepIds === undefined
    ? [] : projectStringIds(raw.trajectoryQuality.missingStepIds, 'missing-steps', 128, true);
  const unexpectedStepIds = raw.trajectoryQuality.unexpectedStepIds === undefined
    ? [] : projectStringIds(raw.trajectoryQuality.unexpectedStepIds, 'unexpected-steps', 128, true);
  return {
    taskId: raw.taskId,
    trialId: raw.trialId,
    ...(raw.taskFamily === undefined ? {} : { taskFamily: raw.taskFamily }),
    taskSuccess: { passed: raw.taskSuccess.passed, passRate: raw.taskSuccess.passRate },
    skillQuality: {
      functionalCoverage: raw.skillQuality.functionalCoverage,
      executability: raw.skillQuality.executability,
      safety: raw.skillQuality.safety,
      aggregate: raw.skillQuality.aggregate,
      missingCapabilityIds,
      safetyViolationCount: raw.skillQuality.safetyViolationCount,
    },
    trajectoryQuality: {
      keyPointRecall: raw.trajectoryQuality.keyPointRecall,
      executionOrder: raw.trajectoryQuality.executionOrder,
      completeness: raw.trajectoryQuality.completeness,
      aggregate: raw.trajectoryQuality.aggregate,
      missingStepIds,
      unexpectedStepIds,
    },
  };
}
function projectTarget(raw: unknown, taskIds: Set<string>, trialIds: Set<string>): Record<string, unknown> {
  if (!isRecord(raw) || typeof raw.dimension !== 'string' ||
      !Object.hasOwn(SAFE_DIRECTIVES, raw.dimension) || !isUnit(raw.priority01) ||
      !Number.isSafeInteger(raw.evidenceCount) || Number(raw.evidenceCount) < 1) {
    throw new Error('gepa-invalid-revision-target');
  }
  const affectedTaskIds = projectStringIds(raw.affectedTaskIds, 'target-task-ids');
  const evidenceIds = projectStringIds(raw.evidenceIds, 'target-evidence-ids');
  if (Number(raw.evidenceCount) !== evidenceIds.length ||
      affectedTaskIds.some(id => !taskIds.has(id)) ||
      evidenceIds.some(id => !trialIds.has(id))) {
    throw new Error('gepa-target-not-bound-to-validation');
  }
  // The incoming directive is deliberately discarded. The sidecar receives a
  // fixed dimension-specific instruction, not free text that could smuggle
  // holdout feedback into an otherwise validation-only request.
  return {
    dimension: raw.dimension,
    priority01: raw.priority01,
    affectedTaskIds,
    evidenceIds,
    directive: SAFE_DIRECTIVES[raw.dimension as keyof typeof SAFE_DIRECTIVES],
  };
}
function assertSourcePayloadShape(source: unknown, candidate: unknown): unknown {
  if (source === null || candidate === null ||
      typeof source !== typeof candidate ||
      Array.isArray(source) !== Array.isArray(candidate)) {
    throw new Error('gepa-candidate-schema-mismatch');
  }
  if (isRecord(source)) {
    if (!isRecord(candidate)) throw new Error('gepa-candidate-schema-mismatch');
    const missing = Object.keys(source).filter(key => !Object.hasOwn(candidate, key));
    if (missing.length) throw new Error('gepa-candidate-dropped-source-field');
  }
  return candidate;
}
async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('gepa-response-too-large');
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('gepa-response-too-large');
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('gepa-response-too-large');
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('gepa-invalid-response-utf8');
  }
}

/**
 * Optional GEPA/DSPy sidecar transport for one untrusted candidate payload.
 * It intentionally sends validation data only. Scores, fitness and promotion
 * authority are discarded; P23 performs exact-payload independent evaluation.
 *
 * This class is a protocol bridge, not the optimizer engine or an embedded
 * implementation of upstream DSPy/GEPA. It is disabled unless explicitly opted in.
 */
export class GepaReflectiveCandidateGenerator {
  private readonly enabled: boolean;
  private readonly endpoint: URL | null;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRequestBytes: number;
  private readonly maxResponseBytes: number;
  private readonly fetchImpl: typeof fetch;
  private requests = 0;
  private failures = 0;
  private lastStatus = 'idle';

  constructor(options: GepaCandidateGeneratorOptions = {}) {
    this.enabled = options.enabled === true;
    this.endpoint = parseEndpoint(options.endpoint);
    this.apiKey = String(options.apiKey ?? '').trim();
    this.timeoutMs = boundedInt(options.timeoutMs, 120_000, 1000, 300_000);
    this.maxRequestBytes = boundedInt(options.maxRequestBytes, MAX_REQUEST_BYTES, 4096, 1_048_576);
    this.maxResponseBytes = boundedInt(options.maxResponseBytes, MAX_RESPONSE_BYTES, 4096, 1_048_576);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }
  static fromEnvironment(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch) {
    return new GepaReflectiveCandidateGenerator({
      enabled: env.NK1_GEPA_ENABLED === '1',
      endpoint: env.NK1_GEPA_ENDPOINT,
      apiKey: env.NK1_GEPA_API_KEY,
      timeoutMs: env.NK1_GEPA_TIMEOUT_MS ? Number(env.NK1_GEPA_TIMEOUT_MS) : undefined,
      maxRequestBytes: env.NK1_GEPA_MAX_REQUEST_BYTES ? Number(env.NK1_GEPA_MAX_REQUEST_BYTES) : undefined,
      maxResponseBytes: env.NK1_GEPA_MAX_RESPONSE_BYTES ? Number(env.NK1_GEPA_MAX_RESPONSE_BYTES) : undefined,
      fetchImpl,
    });
  }
  diagnostics(): GepaCandidateGeneratorDiagnostics {
    const configured = Boolean(this.endpoint && this.apiKey);
    return {
      provider: 'nk1-gepa-candidate-sidecar',
      enabled: this.enabled,
      configured,
      available: this.enabled && configured,
      endpointHost: this.endpoint?.hostname ?? null,
      requests: this.requests,
      failures: this.failures,
      lastStatus: this.lastStatus,
    };
  }
  private prepareRequest(raw: ReflectiveRevisionRequest): string {
    let detached: unknown;
    try {
      detached = snapshotPlainData(raw);
    } catch {
      throw new Error('gepa-request-data-boundary-rejected');
    }
    if (!isRecord(detached)) throw new Error('gepa-request-invalid');
    const request = detached as Record<string, unknown>;
    const expectedKeys = ['datasetFingerprint', 'holdoutPolicy', 'optimizerInstruction', 'sourcePayload', 'targets', 'validationEvidence'].sort();
    if (Object.keys(request).sort().join(',') !== expectedKeys.join(',')) {
      throw new Error('gepa-request-unsupported-field');
    }
    if (!HASH.test(String(request.datasetFingerprint ?? '')) ||
        typeof request.optimizerInstruction !== 'string' || request.optimizerInstruction.length > 12_000 ||
        !request.optimizerInstruction.trim()) throw new Error('gepa-request-metadata-invalid');
    if (!isRecord(request.holdoutPolicy) ||
        Object.keys(request.holdoutPolicy).sort().join(',') !== 'requiresFreshIndependentEvaluation,resultsWithheld' ||
        request.holdoutPolicy.resultsWithheld !== true ||
        request.holdoutPolicy.requiresFreshIndependentEvaluation !== true) {
      throw new Error('gepa-holdout-policy-required');
    }
    if (request.sourcePayload === null || request.sourcePayload === undefined) {
      throw new Error('gepa-source-payload-required');
    }
    const sourcePayload = JSON.stringify(request.sourcePayload);
    if (typeof sourcePayload !== 'string' || Buffer.byteLength(sourcePayload, 'utf8') > MAX_SOURCE_BYTES) {
      throw new Error('gepa-source-payload-too-large');
    }
    if (!Array.isArray(request.validationEvidence) || request.validationEvidence.length === 0 ||
        request.validationEvidence.length > MAX_VALIDATION_ROWS) throw new Error('gepa-validation-evidence-required');
    const validationEvidence = request.validationEvidence.map(projectValidationReport);
    const taskIds = new Set(validationEvidence.map(report => String(report.taskId)));
    const trialIds = new Set(validationEvidence.map(report => String(report.trialId)));
    if (trialIds.size !== validationEvidence.length) throw new Error('gepa-duplicate-validation-trial-id');
    if (!Array.isArray(request.targets) || request.targets.length === 0 || request.targets.length > MAX_TARGETS) {
      throw new Error('gepa-revision-targets-required');
    }
    const targets = request.targets.map(target => projectTarget(target, taskIds, trialIds));
    const wire = {
      schemaVersion: 1,
      adapter: 'nk1-gepa-validation-only',
      purpose: 'candidate-payload-only',
      sourcePayload: JSON.parse(sourcePayload) as unknown,
      datasetFingerprint: String(request.datasetFingerprint).toLowerCase(),
      revisionTargets: targets,
      validationEvidence,
      constraints: {
        holdoutResultsIncluded: false,
        holdoutCaseIdentifiersIncluded: false,
        optimizerFitnessIsAdvisory: true,
        activationAuthority: 'NK1-P23',
        independentReevaluationRequired: true,
      },
    };
    const body = JSON.stringify(wire);
    if (Buffer.byteLength(body, 'utf8') > this.maxRequestBytes) throw new Error('gepa-request-too-large');
    return body;
  }
  async generate(raw: ReflectiveRevisionRequest): Promise<unknown> {
    if (!this.enabled) {
      this.lastStatus = 'disabled';
      throw new Error('gepa-adapter-disabled');
    }
    if (!this.endpoint || !this.apiKey) {
      this.lastStatus = 'unconfigured';
      throw new Error('gepa-adapter-unconfigured');
    }
    const body = this.prepareRequest(raw);
    // Compare the returned candidate against the exact detached source payload
    // that passed the request allowlist and was serialized to the sidecar.
    const wireSourcePayload = (JSON.parse(body) as { sourcePayload: unknown }).sourcePayload;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    this.requests++;
    try {
      const response = await this.fetchImpl(this.endpoint.toString(), {
        method: 'POST',
        redirect: 'error',
        headers: {
          authorization: 'Bearer ' + this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error('gepa-adapter-http-' + response.status);
      }
      const text = await readBoundedText(response, this.maxResponseBytes);
      let decoded: unknown;
      try {
        decoded = JSON.parse(text) as unknown;
      } catch {
        throw new Error('gepa-adapter-invalid-json');
      }
      if (!isRecord(decoded) || decoded.schemaVersion !== 1 ||
          !Object.hasOwn(decoded, 'candidatePayload') || decoded.candidatePayload === null ||
          decoded.candidatePayload === undefined) {
        throw new Error('gepa-adapter-candidate-payload-required');
      }
      let candidate: unknown;
      try {
        candidate = snapshotPlainData(decoded.candidatePayload);
      } catch {
        throw new Error('gepa-candidate-data-boundary-rejected');
      }
      const preserved = assertSourcePayloadShape(wireSourcePayload, candidate);
      const encoded = JSON.stringify(preserved);
      if (typeof encoded !== 'string' || Buffer.byteLength(encoded, 'utf8') > MAX_SOURCE_BYTES) {
        throw new Error('gepa-candidate-payload-too-large');
      }
      this.lastStatus = 'ok';
      // Discard sidecar score, confidence, pass/fail, traces and activation claims.
      return preserved;
    } catch (error) {
      this.failures++;
      this.lastStatus = controller.signal.aborted
        ? 'timeout'
        : (error instanceof Error ? error.message.slice(0, 100) : 'transport-error');
      if (controller.signal.aborted) throw new Error('gepa-adapter-timeout');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  asP23RevisionGenerator(): (request: ReflectiveRevisionRequest) => Promise<unknown> {
    return request => this.generate(request);
  }
}
