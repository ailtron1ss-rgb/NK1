import { sanitizeEmbeddingInput } from './LocalEmbeddingProvider.ts';

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
};

function isLocalLoopback(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || host === '127.0.0.1'
    || host.startsWith('127.') || host.endsWith('.localhost');
}

export interface LocalCrossEncoderRerankerOptions {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxDocuments?: number;
  maxQueryChars?: number;
  maxDocumentChars?: number;
  maxTotalChars?: number;
  fetchImpl?: typeof fetch;
}

export interface LocalCrossEncoderRankedResult {
  index: number;
  relevanceScore: number;
}

export interface LocalCrossEncoderRerankResult {
  enabled: true;
  ok: boolean;
  errorCode: string | null;
  model: string;
  endpoint: string;
  latencyMs: number;
  documentCount: number;
  results: LocalCrossEncoderRankedResult[];
}

export interface LocalCrossEncoderDiagnostics {
  enabled: boolean;
  provider: 'llama.cpp';
  model: string;
  endpoint: string;
  requests: number;
  failures: number;
  lastErrorCode: string | null;
  lastLatencyMs: number;
}

/**
 * Optional llama.cpp cross-encoder adapter. It is disabled unless explicitly enabled,
 * loopback-only, bounded, non-redirecting and incapable of changing canonical retrieval.
 */
export class LocalCrossEncoderReranker {
  readonly modelId: string;
  private readonly endpointUrl: URL;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxDocuments: number;
  private readonly maxQueryChars: number;
  private readonly maxDocumentChars: number;
  private readonly maxTotalChars: number;
  private readonly fetchImpl: typeof fetch;
  private readonly stats = {
    requests: 0,
    failures: 0,
    lastErrorCode: null as string | null,
    lastLatencyMs: 0,
  };

  constructor(options: LocalCrossEncoderRerankerOptions = {}) {
    const baseUrl = new URL(options.baseUrl ?? 'http://127.0.0.1:8080');
    if (!['http:', 'https:'].includes(baseUrl.protocol)) throw new Error('cross-encoder-url-protocol-invalid');
    if (baseUrl.username || baseUrl.password) throw new Error('cross-encoder-url-credentials-forbidden');
    if (!isLocalLoopback(baseUrl.hostname)) throw new Error('cross-encoder-remote-endpoint-forbidden');
    if (baseUrl.search || baseUrl.hash) throw new Error('cross-encoder-url-query-or-fragment-forbidden');

    this.modelId = String(options.model ?? '').trim().slice(0, 160);
    this.apiKey = String(options.apiKey ?? '').trim();
    this.timeoutMs = clampInt(options.timeoutMs, 5000, 250, 10000);
    this.maxDocuments = clampInt(options.maxDocuments, 32, 1, 32);
    this.maxQueryChars = clampInt(options.maxQueryChars, 512, 16, 512);
    this.maxDocumentChars = clampInt(options.maxDocumentChars, 2048, 64, 2048);
    this.maxTotalChars = clampInt(options.maxTotalChars, 32 * 1024, 1024, 32 * 1024);
    this.fetchImpl = options.fetchImpl ?? fetch;

    baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, '');
    this.endpointUrl = new URL(`${baseUrl.pathname}/rerank`.replace(/\/+/g, '/'), baseUrl.origin);
  }

  static fromEnvironment(env: Record<string, string | undefined> = process.env): LocalCrossEncoderReranker | undefined {
    if (!/^(1|true|yes|on)$/i.test(String(env.NK_MEMORY_RERANKER_ENABLED ?? ''))) return undefined;
    try {
      return new LocalCrossEncoderReranker({
        baseUrl: env.NK_MEMORY_RERANKER_BASE_URL || 'http://127.0.0.1:8080',
        model: env.NK_MEMORY_RERANKER_MODEL || '',
        apiKey: env.NK_MEMORY_RERANKER_API_KEY || '',
        timeoutMs: clampInt(env.NK_MEMORY_RERANKER_TIMEOUT_MS, 5000, 250, 10000),
        maxDocuments: clampInt(env.NK_MEMORY_RERANKER_MAX_DOCUMENTS, 32, 1, 32),
      });
    } catch {
      // Invalid optional configuration disables only the shadow experiment.
      return undefined;
    }
  }

  async rerank(query: string, rawDocuments: string[]): Promise<LocalCrossEncoderRerankResult> {
    const started = Date.now();
    const failure = (errorCode: string): LocalCrossEncoderRerankResult => {
      this.stats.failures += 1;
      this.stats.lastErrorCode = errorCode;
      this.stats.lastLatencyMs = Math.max(0, Date.now() - started);
      return {
        enabled: true, ok: false, errorCode, model: this.modelId,
        endpoint: this.endpointUrl.origin + this.endpointUrl.pathname,
        latencyMs: this.stats.lastLatencyMs, documentCount: 0, results: [],
      };
    };

    if (typeof query !== 'string' || !query.trim() || typeof rawDocuments === 'string'
      || !Array.isArray(rawDocuments) || rawDocuments.length < 1 || rawDocuments.length > this.maxDocuments) {
      return failure('invalid-input');
    }
    const safeQuery = sanitizeEmbeddingInput(query).trim().slice(0, this.maxQueryChars);
    const documents = rawDocuments.map(value =>
      typeof value === 'string' ? sanitizeEmbeddingInput(value).trim().slice(0, this.maxDocumentChars) : '');
    if (!safeQuery || documents.some(value => !value)) return failure('invalid-input');
    if (safeQuery.length + documents.reduce((sum, value) => sum + value.length, 0) > this.maxTotalChars) {
      return failure('input-budget-exceeded');
    }

    const requestBody: Record<string, unknown> = {
      query: safeQuery,
      top_n: documents.length,
      documents,
    };
    if (this.modelId) requestBody.model = this.modelId;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
    };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    this.stats.requests += 1;
    try {
      const response = await this.fetchImpl(this.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'error',
      });
      if (!response.ok) return failure('http-error');
      const payload = await response.json() as { results?: unknown };
      if (!Array.isArray(payload?.results) || payload.results.length !== documents.length) {
        return failure('invalid-response');
      }
      const seen = new Set<number>();
      const results: LocalCrossEncoderRankedResult[] = [];
      for (const row of payload.results) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return failure('invalid-response');
        const value = row as Record<string, unknown>;
        const index = value.index;
        const score = value.relevance_score;
        if (!Number.isSafeInteger(index) || Number(index) < 0 || Number(index) >= documents.length
          || seen.has(Number(index)) || typeof score !== 'number' || !Number.isFinite(score)
          || Math.abs(score) > 1_000_000) {
          return failure('invalid-response');
        }
        seen.add(Number(index));
        results.push({ index: Number(index), relevanceScore: score });
      }
      if (seen.size !== documents.length) return failure('invalid-response');
      results.sort((left, right) => right.relevanceScore - left.relevanceScore || left.index - right.index);
      this.stats.lastErrorCode = null;
      this.stats.lastLatencyMs = Math.max(0, Date.now() - started);
      return {
        enabled: true, ok: true, errorCode: null, model: this.modelId,
        endpoint: this.endpointUrl.origin + this.endpointUrl.pathname,
        latencyMs: this.stats.lastLatencyMs, documentCount: documents.length, results,
      };
    } catch (error) {
      const name = error && typeof error === 'object' ? String((error as { name?: unknown }).name ?? '') : '';
      return failure(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unavailable');
    }
  }

  diagnostics(): LocalCrossEncoderDiagnostics {
    return {
      enabled: true,
      provider: 'llama.cpp',
      model: this.modelId,
      endpoint: this.endpointUrl.origin + this.endpointUrl.pathname,
      ...this.stats,
    };
  }
}
