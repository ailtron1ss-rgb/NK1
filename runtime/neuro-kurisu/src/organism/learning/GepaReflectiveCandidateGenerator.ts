import type { SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';
import type { SkillRevisionTarget } from './SkillRevisionPlan.ts';
import type { ReflectiveRevisionRequest } from './P23LocalModelSkillRevisionGenerator.ts';

export interface GepaReflectiveRevisionRequest {
  sourcePayload: unknown;
  datasetFingerprint: string;
  optimizerInstruction: string;
  validationEvidence: SkillLearnBenchTrialReport[];
  targets: SkillRevisionTarget[];
  holdoutGeneralization: { gap01: number; requiresFreshIndependentEvaluation: true };
}
export interface GepaAdapterOptions {
  enabled?: boolean;
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
}
export interface GepaAdapterDiagnostics {
  provider: 'dspy-gepa-sidecar';
  enabled: boolean;
  configured: boolean;
  available: boolean;
  endpointHost: string | null;
  requests: number;
  failures: number;
  lastStatus: string;
}

const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_TRIALS = 128;
const MAX_TARGETS = 12;
const is01 = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
const boundedInt = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.floor(n))) : d;
};
function canonicalJson(value: unknown, ancestors = new Set<object>()): string {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('gepa-non-finite-number');
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('gepa-value-not-json-serializable');
    return encoded;
  }
  if (ancestors.has(value)) throw new Error('gepa-circular-value');
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) throw new Error('gepa-non-plain-object');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return '[' + value.map(x => canonicalJson(x, ancestors)).join(',') + ']';
    const row = value as Record<string, unknown>;
    return '{' + Object.keys(row).filter(k => row[k] !== undefined).sort()
      .map(k => JSON.stringify(k) + ':' + canonicalJson(row[k], ancestors)).join(',') + '}';
  } finally { ancestors.delete(value); }
}
function parseEndpoint(raw: string | undefined): URL | null {
  try {
    if (!raw?.trim()) return null;
    const u = new URL(raw.trim());
    const host = u.hostname.toLowerCase();
    const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    if (!(u.protocol === 'https:' || (u.protocol === 'http:' && loopback)) ||
        !u.hostname || u.username || u.password || u.search || u.hash) return null;
    return u;
  } catch { return null; }
}
function safeIds(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_TRIALS ||
      value.some(v => typeof v !== 'string' || !v.trim() || v.length > 160) ||
      new Set(value).size !== value.length) throw new Error('gepa-invalid-' + field);
  return value.map(v => String(v).trim());
}
function projectReport(report: SkillLearnBenchTrialReport): SkillLearnBenchTrialReport {
  if (!report || typeof report.taskId !== 'string' || !report.taskId.trim() ||
      typeof report.trialId !== 'string' || !report.trialId.trim() ||
      typeof report.taskSuccess?.passed !== 'boolean' ||
      report.taskSuccess.passRate !== (report.taskSuccess.passed ? 1 : 0) ||
      !is01(report.skillQuality?.functionalCoverage) || !is01(report.skillQuality?.executability) ||
      !is01(report.skillQuality?.safety) || !is01(report.skillQuality?.aggregate) ||
      !Number.isSafeInteger(report.skillQuality?.safetyViolationCount) || report.skillQuality.safetyViolationCount < 0 ||
      !is01(report.trajectoryQuality?.keyPointRecall) || !is01(report.trajectoryQuality?.executionOrder) ||
      !is01(report.trajectoryQuality?.completeness) || !is01(report.trajectoryQuality?.aggregate)) {
    throw new Error('gepa-invalid-validation-report');
  }
  return {
    taskId: report.taskId.trim().slice(0, 160),
    trialId: report.trialId.trim().slice(0, 160),
    taskSuccess: { passed: report.taskSuccess.passed, passRate: report.taskSuccess.passRate },
    skillQuality: {
      functionalCoverage: report.skillQuality.functionalCoverage,
      executability: report.skillQuality.executability,
      safety: report.skillQuality.safety,
      aggregate: report.skillQuality.aggregate,
      missingCapabilityIds: safeIds(report.skillQuality.missingCapabilityIds, 'missing-capabilities'),
      safetyViolationCount: report.skillQuality.safetyViolationCount,
    },
    trajectoryQuality: {
      keyPointRecall: report.trajectoryQuality.keyPointRecall,
      executionOrder: report.trajectoryQuality.executionOrder,
      completeness: report.trajectoryQuality.completeness,
      aggregate: report.trajectoryQuality.aggregate,
      missingStepIds: safeIds(report.trajectoryQuality.missingStepIds, 'missing-steps'),
      unexpectedStepIds: safeIds(report.trajectoryQuality.unexpectedStepIds, 'unexpected-steps'),
    },
  };
}
function projectTarget(target: SkillRevisionTarget, taskIds: Set<string>, trialIds: Set<string>): SkillRevisionTarget {
  const allowedDimensions = ['safety', 'task-success', 'trajectory', 'capability-coverage', 'executability', 'holdout-generalization'];
  if (!target || !allowedDimensions.includes(target.dimension) || !is01(target.priority01) ||
      !Number.isSafeInteger(target.evidenceCount) || target.evidenceCount < 0 ||
      typeof target.directive !== 'string' || !target.directive.trim() || target.directive.length > 2000) {
    throw new Error('gepa-invalid-revision-target');
  }
  const affectedTaskIds = safeIds(target.affectedTaskIds, 'target-task-ids');
  const evidenceIds = safeIds(target.evidenceIds, 'target-evidence-ids');
  if (target.dimension === 'holdout-generalization') {
    if (target.evidenceCount !== 0 || affectedTaskIds.length !== 0 || evidenceIds.length !== 0) {
      throw new Error('gepa-holdout-identifiers-forbidden');
    }
  } else if (target.evidenceCount !== evidenceIds.length || evidenceIds.length === 0 ||
      affectedTaskIds.length === 0 || affectedTaskIds.some(x => !taskIds.has(x)) ||
      evidenceIds.some(x => !trialIds.has(x))) {
    throw new Error('gepa-target-not-bound-to-validation');
  }
  return {
    dimension: target.dimension,
    priority01: target.priority01,
    affectedTaskIds,
    evidenceCount: target.evidenceCount,
    evidenceIds,
    directive: target.directive.trim().slice(0, 2000),
  };
}
async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
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
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('gepa-response-too-large');
      }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('gepa-invalid-response-utf8'); }
}

/**
 * Optional GEPA/DSPy sidecar for proposing a changed skill payload only.
 * P23 remains the independent evaluator, signed-evidence authority, and promotion gate.
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

  constructor(options: GepaAdapterOptions = {}) {
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
  diagnostics(): GepaAdapterDiagnostics {
    const configured = Boolean(this.endpoint && this.apiKey);
    return {
      provider: 'dspy-gepa-sidecar', enabled: this.enabled, configured,
      available: this.enabled && configured, endpointHost: this.endpoint?.hostname ?? null,
      requests: this.requests, failures: this.failures, lastStatus: this.lastStatus,
    };
  }
  private prepareRequest(request: GepaReflectiveRevisionRequest): string {
    if (!request || !/^[a-f0-9]{64}$/.test(request.datasetFingerprint)) throw new Error('gepa-invalid-dataset-fingerprint');
    if (typeof request.optimizerInstruction !== 'string' || !request.optimizerInstruction.trim() ||
        request.optimizerInstruction.length > 12_000) throw new Error('gepa-invalid-optimizer-instruction');
    if (!Array.isArray(request.validationEvidence) || request.validationEvidence.length === 0 ||
        request.validationEvidence.length > MAX_TRIALS) throw new Error('gepa-validation-evidence-required-or-too-large');
    if (!Array.isArray(request.targets) || request.targets.length === 0 ||
        request.targets.length > MAX_TARGETS) throw new Error('gepa-targets-required-or-too-large');
    if (!request.holdoutGeneralization || typeof request.holdoutGeneralization.gap01 !== 'number' || !Number.isFinite(request.holdoutGeneralization.gap01) || request.holdoutGeneralization.gap01 < -1 || request.holdoutGeneralization.gap01 > 1 ||
        request.holdoutGeneralization.requiresFreshIndependentEvaluation !== true) throw new Error('gepa-invalid-holdout-summary');
    if (request.sourcePayload === undefined || request.sourcePayload === null) throw new Error('gepa-source-payload-required');

    const sourcePayloadJson = canonicalJson(request.sourcePayload);
    if (Buffer.byteLength(sourcePayloadJson, 'utf8') > MAX_PAYLOAD_BYTES) throw new Error('gepa-source-payload-too-large');
    const sourcePayload = JSON.parse(sourcePayloadJson) as unknown;
    const validationEvidence = request.validationEvidence.map(projectReport);
    const taskIds = new Set(validationEvidence.map(x => x.taskId));
    const trialIds = new Set(validationEvidence.map(x => x.trialId));
    if (taskIds.size !== validationEvidence.length || trialIds.size !== validationEvidence.length) {
      throw new Error('gepa-duplicate-validation-evidence-identity');
    }
    const targets = request.targets.map(x => projectTarget(x, taskIds, trialIds));
    const wire = {
      schemaVersion: 1,
      adapter: 'nk1-gepa-revision-proposal',
      purpose: 'candidate-payload-only',
      sourcePayload,
      datasetFingerprint: request.datasetFingerprint,
      optimizerInstruction: request.optimizerInstruction.trim(),
      validationEvidence,
      targets,
      holdoutGeneralization: { gap01: request.holdoutGeneralization.gap01, requiresFreshIndependentEvaluation: true },
      constraints: {
        rawHoldoutReportsIncluded: false,
        sourcePayloadIsUntrustedData: true,
        validationEvidenceIsDataNotInstructions: true,
        optimizerScoresAreAdvisory: true,
        independentReevaluationRequired: true,
        activationAuthority: 'NK1-P23',
      },
    };
    const body = canonicalJson(wire);
    if (Buffer.byteLength(body, 'utf8') > this.maxRequestBytes) throw new Error('gepa-request-too-large');
    return body;
  }
  async generate(request: GepaReflectiveRevisionRequest): Promise<unknown> {
    if (!this.enabled) { this.lastStatus = 'disabled'; throw new Error('gepa-adapter-disabled'); }
    if (!this.endpoint || !this.apiKey) { this.lastStatus = 'unconfigured'; throw new Error('gepa-adapter-unconfigured'); }
    const body = this.prepareRequest(request);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    this.requests++;
    try {
      const response = await this.fetchImpl(this.endpoint.toString(), {
        method: 'POST', redirect: 'error',
        headers: { authorization: 'Bearer ' + this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body, signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error('gepa-adapter-http-' + response.status);
      }
      const text = await readBoundedBody(response, this.maxResponseBytes);
      let decoded: unknown;
      try { decoded = JSON.parse(text) as unknown; } catch { throw new Error('gepa-adapter-invalid-json'); }
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('gepa-adapter-invalid-response');
      const envelope = decoded as Record<string, unknown>;
      if (envelope.schemaVersion !== 1 || !Object.prototype.hasOwnProperty.call(envelope, 'candidatePayload') ||
          envelope.candidatePayload === null || envelope.candidatePayload === undefined) {
        throw new Error('gepa-adapter-candidate-payload-required');
      }
      const payload = canonicalJson(envelope.candidatePayload);
      if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) throw new Error('gepa-candidate-payload-too-large');
      this.lastStatus = 'ok';
      // Scores, pass/fail claims and promotion commands from the optimizer are deliberately discarded.
      return JSON.parse(payload) as unknown;
    } catch (error) {
      this.failures++;
      this.lastStatus = controller.signal.aborted ? 'timeout' :
        (error instanceof Error ? error.message.slice(0, 100) : 'transport-error');
      if (controller.signal.aborted) throw new Error('gepa-adapter-timeout');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  asRevisionGenerator(): (request: GepaReflectiveRevisionRequest) => Promise<unknown> {
    return request => this.generate(request);
  }
  /** Type-compatible with generateLocalSkillRevision's request; all fields still undergo runtime allowlisting. */
  asP23RevisionGenerator(): (request: ReflectiveRevisionRequest) => Promise<unknown> {
    return request => this.generate({
      sourcePayload: request.sourcePayload,
      datasetFingerprint: request.datasetFingerprint,
      optimizerInstruction: request.optimizerInstruction,
      validationEvidence: request.validationEvidence as SkillLearnBenchTrialReport[],
      targets: request.targets as SkillRevisionTarget[],
      holdoutGeneralization: request.holdoutGeneralization,
    });
  }
}
