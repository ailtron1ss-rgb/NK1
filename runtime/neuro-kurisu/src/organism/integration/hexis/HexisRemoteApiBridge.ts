export type HexisRemoteBridgeErrorCode =
  | 'hexis-remote-disabled'
  | 'hexis-remote-consult-disabled'
  | 'hexis-remote-confirmation-required'
  | 'hexis-remote-invalid-config'
  | 'hexis-remote-insecure-transport'
  | 'hexis-remote-auth-required'
  | 'hexis-remote-invalid-question'
  | 'hexis-remote-question-too-long'
  | 'hexis-remote-context-too-large'
  | 'hexis-remote-timeout'
  | 'hexis-remote-unavailable'
  | 'hexis-remote-auth-failed'
  | 'hexis-remote-http-error'
  | 'hexis-remote-invalid-json'
  | 'hexis-remote-response-too-large'
  | 'hexis-remote-model-unavailable'
  | 'hexis-remote-invalid-response';

export class HexisRemoteBridgeError extends Error {
  readonly code: HexisRemoteBridgeErrorCode;
  readonly httpStatus: number;

  constructor(code: HexisRemoteBridgeErrorCode, httpStatus = 503) {
    super(code);
    this.name = 'HexisRemoteBridgeError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface HexisRemoteApiConfig {
  enabled: boolean;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs: number;
  consultEnabled: boolean;
}

export interface HexisRemoteMemoryCandidate {
  id: string;
  summary: string;
  confidence01?: number;
  sourceRef?: string;
}

export interface HexisRemoteContext {
  tick?: number;
  currentGoal?: string;
  recentObservations?: string[];
  memoryCandidates?: HexisRemoteMemoryCandidate[];
}

export interface HexisRemoteConsultRequest {
  question: unknown;
  context?: unknown;
  confirmExternalConsult?: boolean;
}

export interface HexisRemoteConsultResult {
  provider: 'QuixiAI/Hexis';
  model: string;
  response: string;
  finishReason?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  advisoryOnly: true;
  externalAgentToolsMayRun: true;
  nk1StateChanged: false;
  eligibleAsVerifiedEvidence: false;
  promotionPath: 'HMX staging followed by an explicit NK1 decision';
}

const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_QUESTION_CHARS = 6000;
const MAX_CONTEXT_BYTES = 6000;
const MAX_REPLY_CHARS = 12000;
const DEFAULT_TIMEOUT_MS = 8000;

type Environment = Record<string, string | undefined>;
type FetchLike = typeof fetch;

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new HexisRemoteBridgeError('hexis-remote-invalid-config', 500);
  }
  return parsed;
}

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1' ||
    /^127(?:\.\d{1,3}){3}$/.test(host);
}

export function parseHexisRemoteApiConfig(env: Environment): HexisRemoteApiConfig {
  const rawUrl = String(env.NK1_HEXIS_REMOTE_BASE_URL ?? '').trim();
  const timeoutMs = boundedInteger(env.NK1_HEXIS_REMOTE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 500, 20000);
  const rawConsultEnabled = String(env.NK1_HEXIS_REMOTE_CONSULT_ENABLED ?? '').trim().toLowerCase();
  const consultRequested = rawConsultEnabled === 'true';
  const apiKey = String(env.NK1_HEXIS_REMOTE_API_KEY ?? '');
  const rawModel = String(env.NK1_HEXIS_REMOTE_MODEL ?? '').trim();

  if (!rawUrl) {
    if (consultRequested || apiKey || rawModel) {
      throw new HexisRemoteBridgeError('hexis-remote-invalid-config', 500);
    }
    return { enabled: false, timeoutMs, consultEnabled: false };
  }

  if (rawConsultEnabled && !['true', 'false'].includes(rawConsultEnabled)) {
    throw new HexisRemoteBridgeError('hexis-remote-invalid-config', 500);
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HexisRemoteBridgeError('hexis-remote-invalid-config', 500);
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new HexisRemoteBridgeError('hexis-remote-invalid-config', 500);
  }
  const loopback = isLoopback(url.hostname);
  if (url.protocol !== 'https:' && !loopback) {
    throw new HexisRemoteBridgeError('hexis-remote-insecure-transport', 500);
  }
  if (/[\u0000-\u001f\u007f]/.test(apiKey) || apiKey.length > 4096) {
    throw new HexisRemoteBridgeError('hexis-remote-invalid-config', 500);
  }
  if (!loopback && !apiKey.trim()) {
    throw new HexisRemoteBridgeError('hexis-remote-auth-required', 500);
  }
  if (rawModel.length > 200 || /[\u0000-\u001f\u007f]/.test(rawModel)) {
    throw new HexisRemoteBridgeError('hexis-remote-invalid-config', 500);
  }

  return {
    enabled: true,
    baseUrl: url.origin,
    ...(apiKey ? { apiKey } : {}),
    ...(rawModel ? { model: rawModel } : {}),
    timeoutMs,
    consultEnabled: consultRequested,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function safeText(value: unknown, maximum: number): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maximum);
}

function sanitizeContext(raw: unknown): HexisRemoteContext {
  const input = asRecord(raw);
  if (!input) return {};
  const result: HexisRemoteContext = {};

  if (Number.isSafeInteger(input.tick) && Number(input.tick) >= 0) {
    result.tick = Number(input.tick);
  }

  const goal = safeText(input.currentGoal, 500);
  if (goal) result.currentGoal = goal;

  if (Array.isArray(input.recentObservations)) {
    result.recentObservations = input.recentObservations
      .slice(0, 8)
      .map((value) => safeText(value, 500))
      .filter(Boolean);
  }

  if (Array.isArray(input.memoryCandidates)) {
    result.memoryCandidates = input.memoryCandidates.slice(0, 8).flatMap((value) => {
      const row = asRecord(value);
      if (!row) return [];
      const id = safeText(row.id, 120);
      const summary = safeText(row.summary, 500);
      if (!id || !summary) return [];

      const candidate: HexisRemoteMemoryCandidate = { id, summary };
      if (typeof row.confidence01 === 'number' && Number.isFinite(row.confidence01) &&
          row.confidence01 >= 0 && row.confidence01 <= 1) {
        candidate.confidence01 = row.confidence01;
      }
      const sourceRef = safeText(row.sourceRef, 200);
      if (sourceRef) candidate.sourceRef = sourceRef;
      return [candidate];
    });
  }
  return result;
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let output = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      totalBytes += part.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new HexisRemoteBridgeError('hexis-remote-response-too-large', 502);
      }
      output += decoder.decode(part.value, { stream: true });
    }
    output += decoder.decode();
    return output;
  } finally {
    reader.releaseLock();
  }
}

function readUsage(raw: unknown): HexisRemoteConsultResult['usage'] {
  const value = asRecord(raw);
  if (!value) return undefined;
  const result: NonNullable<HexisRemoteConsultResult['usage']> = {};

  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens'] as const) {
    const n = value[key];
    if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) {
      const target = key === 'prompt_tokens' ? 'promptTokens'
        : key === 'completion_tokens' ? 'completionTokens' : 'totalTokens';
      result[target] = n;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

export class HexisRemoteApiBridge {
  readonly config: HexisRemoteApiConfig;
  private readonly fetchImpl: FetchLike;

  constructor(env: Environment = process.env, options: { fetchImpl?: FetchLike } = {}) {
    this.config = parseHexisRemoteApiConfig(env);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async status(): Promise<Record<string, unknown>> {
    const base = {
      provider: 'QuixiAI/Hexis',
      apiContract: 'GET /health, GET /v1/models, POST /v1/chat/completions',
      configured: this.config.enabled,
      consultEnabled: this.config.consultEnabled,
      modelConfigured: Boolean(this.config.model),
      trustBoundary: 'external-agent-output-is-advisory',
      memoryWrites: 'not-directly-exposed-by-this-bridge',
      skillPromotion: 'requires-existing-NK1-HMX-stage-and-decision',
      checkedAt: Date.now(),
    };

    if (!this.config.enabled) {
      return { ...base, reachable: false, reason: 'not-configured' };
    }

    try {
      const health = await this.requestJson('/health');
      const checks = asRecord(health.body.checks);
      const healthy = health.body.status === 'ok' && checks?.db === true;
      return {
        ...base,
        reachable: healthy,
        health: healthy ? 'ok' : 'unhealthy',
        ...(!healthy ? {
          reason: checks?.db === false ? 'database-unhealthy' : 'health-contract-mismatch',
        } : {}),
      };
    } catch (error) {
      const code = error instanceof HexisRemoteBridgeError ? error.code : 'hexis-remote-unavailable';
      return { ...base, reachable: false, reason: code };
    }
  }

  async consult(request: HexisRemoteConsultRequest): Promise<HexisRemoteConsultResult> {
    if (!this.config.enabled) throw new HexisRemoteBridgeError('hexis-remote-disabled', 503);
    if (!this.config.consultEnabled) throw new HexisRemoteBridgeError('hexis-remote-consult-disabled', 403);
    if (request.confirmExternalConsult !== true) {
      throw new HexisRemoteBridgeError('hexis-remote-confirmation-required', 400);
    }
    if (typeof request.question !== 'string' || !request.question.trim()) {
      throw new HexisRemoteBridgeError('hexis-remote-invalid-question', 400);
    }
    if (request.question.length > MAX_QUESTION_CHARS) {
      throw new HexisRemoteBridgeError('hexis-remote-question-too-long', 413);
    }

    const question = safeText(request.question, MAX_QUESTION_CHARS);
    if (!question) throw new HexisRemoteBridgeError('hexis-remote-invalid-question', 400);
    const context = sanitizeContext(request.context);
    const contextJson = JSON.stringify(context);
    if (new TextEncoder().encode(contextJson).byteLength > MAX_CONTEXT_BYTES) {
      throw new HexisRemoteBridgeError('hexis-remote-context-too-large', 413);
    }

    const model = this.config.model ?? await this.discoverModel();
    const payload = await this.requestJson('/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.1,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content: [
              'You are an external Hexis cognitive peer being consulted by NK1 / Neuro Kurisu.',
              'Return bounded analysis only: separate sourced observations from inference and uncertainty.',
              'When a supplied memory candidate or source reference is relevant, cite its identifier; do not invent source references.',
              'Do not ask the caller to treat this answer as verified evidence, do not claim a tool/action succeeded unless a tool receipt proves it, and do not request automatic changes to NK1 identity, memory or active skills.',
              'This prompt is not a security boundary: Hexis tool permissions remain controlled by the remote Hexis deployment.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({ question, nk1_context: context }),
          },
        ],
      }),
    });

    const choices = Array.isArray(payload.body.choices) ? payload.body.choices : [];
    const choice = asRecord(choices[0]);
    const message = asRecord(choice?.message);
    const rawResponse = message?.content;
    if (typeof rawResponse !== 'string' || !rawResponse.trim()) {
      throw new HexisRemoteBridgeError('hexis-remote-invalid-response', 502);
    }
    const response = rawResponse.replace(/\u0000/g, '').slice(0, MAX_REPLY_CHARS).trim();
    if (!response) throw new HexisRemoteBridgeError('hexis-remote-invalid-response', 502);

    const usage = readUsage(payload.body.usage);
    return {
      provider: 'QuixiAI/Hexis',
      model: safeText(payload.body.model, 200) || model,
      response,
      ...(typeof choice?.finish_reason === 'string' ? { finishReason: safeText(choice.finish_reason, 80) } : {}),
      ...(usage ? { usage } : {}),
      advisoryOnly: true,
      externalAgentToolsMayRun: true,
      nk1StateChanged: false,
      eligibleAsVerifiedEvidence: false,
      promotionPath: 'HMX staging followed by an explicit NK1 decision',
    };
  }

  private async discoverModel(): Promise<string> {
    const result = await this.requestJson('/v1/models');
    const rows = Array.isArray(result.body.data) ? result.body.data : [];
    const first = rows.map(asRecord).find((row) => typeof row?.id === 'string' && safeText(row.id, 200));
    const model = safeText(first?.id, 200);
    if (!model) throw new HexisRemoteBridgeError('hexis-remote-model-unavailable', 503);
    return model;
  }

  private async requestJson(
    endpoint: '/health' | '/v1/models' | '/v1/chat/completions',
    init: RequestInit = {},
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    if (!this.config.enabled || !this.config.baseUrl) {
      throw new HexisRemoteBridgeError('hexis-remote-disabled', 503);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (this.config.apiKey) headers.set('authorization', 'Bearer ' + this.config.apiKey);

    try {
      const response = await this.fetchImpl(new URL(endpoint, this.config.baseUrl + '/'), {
        ...init,
        headers,
        signal: controller.signal,
        redirect: 'error',
      });
      const text = await readBoundedText(response, MAX_RESPONSE_BYTES);
      if (!response.ok) {
        throw new HexisRemoteBridgeError(
          response.status === 401 || response.status === 403
            ? 'hexis-remote-auth-failed' : 'hexis-remote-http-error',
          response.status >= 500 ? 503 : 502,
        );
      }
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new HexisRemoteBridgeError('hexis-remote-invalid-json', 502);
      }
      const record = asRecord(body);
      if (!record) throw new HexisRemoteBridgeError('hexis-remote-invalid-response', 502);
      return { status: response.status, body: record };
    } catch (error) {
      if (error instanceof HexisRemoteBridgeError) throw error;
      if (controller.signal.aborted) throw new HexisRemoteBridgeError('hexis-remote-timeout', 504);
      throw new HexisRemoteBridgeError('hexis-remote-unavailable', 503);
    } finally {
      clearTimeout(timeout);
    }
  }
}
