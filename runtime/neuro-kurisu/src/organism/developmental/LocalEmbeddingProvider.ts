import { createHash } from 'node:crypto';
import { localEndpointResourceKey, sharedLocalInferenceScheduler } from '../integration/local/LocalInferenceScheduler.mjs';

export type LocalEmbeddingProviderKind = 'ollama' | 'openai-compatible';

export interface TextEmbeddingProvider {
  readonly providerId: string;
  readonly modelId: string;
  embedBatch(texts: string[], options?: { timeoutMs?: number }): Promise<number[][]>;
  diagnostics(): LocalEmbeddingDiagnostics;
}

export interface LocalEmbeddingDiagnostics {
  configured: boolean;
  provider: LocalEmbeddingProviderKind | 'none';
  model: string;
  endpoint: string;
  cacheEntries: number;
  cacheHits: number;
  cacheMisses: number;
  requests: number;
  failures: number;
  lastError: string | null;
  lastLatencyMs: number;
  redactedInputs: number;
}

export interface LocalEmbeddingProviderOptions {
  kind?: LocalEmbeddingProviderKind;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  batchSize?: number;
  maxTextChars?: number;
  cacheEntries?: number;
  allowRemote?: boolean;
  fetchImpl?: typeof fetch;
}

const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
};
const normalize = (vector: number[]) => {
  const clean = vector.map(value => Number.isFinite(Number(value)) ? Number(value) : 0);
  const norm = Math.sqrt(clean.reduce((sum, value) => sum + value * value, 0));
  return norm > 1e-12 ? clean.map(value => value / norm) : [];
};
const fingerprint = (text: string) => createHash('sha256').update(text).digest('hex');
/**
 * Minimize obvious secrets and direct contact identifiers before text can enter an
 * embedding cache or cross the configured provider boundary. This is intentionally a
 * narrow heuristic (not a universal PII classifier); local-only routing remains the
 * default and remote endpoints still require explicit opt-in + HTTPS.
 */
export const sanitizeEmbeddingInput = (raw: unknown): string => String(raw ?? '').normalize('NFKC')
  .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
  .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED_CREDENTIAL]')
  .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/g, '[REDACTED_CREDENTIAL]')
  .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|secret|private[_-]?key|authorization)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[REDACTED_CREDENTIAL]')
  .replace(/([?&](?:token|key|secret|password|api[_-]?key)=)[^&#\s]+/gi, '$1[REDACTED]')
  .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@')
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
  .replace(/(?<![\w])(?:\+|00)\d(?:[\s().-]*\d){7,14}(?![\w])/g, '[REDACTED_PHONE]')
  .replace(/\b\d{9,16}\b/g, '[REDACTED_LONG_ID]');
const isLoopbackHost = (hostname: string) => {
  const host = hostname.toLocaleLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || host === '127.0.0.1' || host.startsWith('127.') || host.endsWith('.localhost');
};

/**
 * Optional HTTP adapter for a local embedding model. It deliberately has no model
 * runtime dependency: Ollama and llama.cpp's OpenAI-compatible endpoint both work.
 * Requests are loopback-only by default, bounded, cached and never redirect to a
 * different host. No text is logged by this adapter.
 */
export class LocalEmbeddingProvider implements TextEmbeddingProvider {
  readonly providerId: string;
  readonly modelId: string;
  readonly kind: LocalEmbeddingProviderKind;
  private readonly baseUrl: URL;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly batchSize: number;
  private readonly maxTextChars: number;
  private readonly cacheLimit: number;
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new Map<string, number[]>();
  private readonly stats = { cacheHits: 0, cacheMisses: 0, requests: 0, failures: 0, lastError: null as string | null, lastLatencyMs: 0, redactedInputs: 0 };

  constructor(options: LocalEmbeddingProviderOptions = {}) {
    this.kind = options.kind ?? 'ollama';
    const defaultUrl = this.kind === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:8080/v1';
    this.baseUrl = new URL(options.baseUrl ?? defaultUrl);
    if (!['http:', 'https:'].includes(this.baseUrl.protocol)) throw new Error('Embedding endpoint must use HTTP(S)');
    if (this.baseUrl.username || this.baseUrl.password) throw new Error('Embedding endpoint URL must not contain credentials');
    if (!options.allowRemote && !isLoopbackHost(this.baseUrl.hostname)) throw new Error('Remote embedding endpoint blocked; set NK_EMBEDDINGS_ALLOW_REMOTE=1 only for a trusted private endpoint');
    if (options.allowRemote && !isLoopbackHost(this.baseUrl.hostname) && this.baseUrl.protocol !== 'https:') throw new Error('Remote embedding endpoints must use HTTPS');
    this.baseUrl.hash = '';
    this.baseUrl.search = '';
    this.baseUrl.pathname = this.baseUrl.pathname.replace(/\/+$/, '');
    this.modelId = String(options.model ?? (this.kind === 'ollama' ? 'embeddinggemma' : 'embeddinggemma')).trim().slice(0, 160);
    if (!this.modelId) throw new Error('Embedding model name is required');
    this.providerId = `${this.kind}:${this.baseUrl.origin}${this.baseUrl.pathname}:${this.modelId}`;
    this.apiKey = String(options.apiKey ?? '');
    this.timeoutMs = clampInt(options.timeoutMs, 5000, 500, 20000);
    this.batchSize = clampInt(options.batchSize, 24, 1, 64);
    this.maxTextChars = clampInt(options.maxTextChars, 2400, 128, 8000);
    this.cacheLimit = clampInt(options.cacheEntries, 2048, 64, 4096);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static fromEnvironment(env: Record<string, string | undefined> = process.env): LocalEmbeddingProvider | undefined {
    if (/^(0|false|off|no)$/i.test(String(env.NK_EMBEDDINGS_ENABLED ?? '1'))) return undefined;
    const kind = String(env.NK_EMBEDDINGS_PROVIDER ?? 'ollama').toLocaleLowerCase() === 'openai-compatible' ? 'openai-compatible' : 'ollama';
    const defaultUrl = kind === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:8080/v1';
    try {
      return new LocalEmbeddingProvider({
        kind,
        baseUrl: env.NK_EMBEDDINGS_BASE_URL || defaultUrl,
        model: env.NK_EMBEDDINGS_MODEL || 'embeddinggemma',
        apiKey: env.NK_EMBEDDINGS_API_KEY || '',
        timeoutMs: clampInt(env.NK_EMBEDDINGS_TIMEOUT_MS, 5000, 500, 20000),
        batchSize: clampInt(env.NK_EMBEDDINGS_BATCH_SIZE, 24, 1, 64),
        maxTextChars: clampInt(env.NK_EMBEDDINGS_MAX_TEXT_CHARS, 2400, 128, 8000),
        cacheEntries: clampInt(env.NK_EMBEDDINGS_CACHE_ENTRIES, 2048, 64, 4096),
        allowRemote: /^(1|true|yes|on)$/i.test(String(env.NK_EMBEDDINGS_ALLOW_REMOTE ?? '')),
      });
    } catch {
      return undefined;
    }
  }

  async embedBatch(rawTexts: string[], requestOptions: { timeoutMs?: number } = {}): Promise<number[][]> {
    const timeoutMs = clampInt(requestOptions.timeoutMs, this.timeoutMs, 100, this.timeoutMs);
    const deadlineAt = Date.now() + timeoutMs;
    const texts = rawTexts.map(raw => { const original = String(raw ?? '').normalize('NFKC'); const sanitized = sanitizeEmbeddingInput(original); if (sanitized !== original) this.stats.redactedInputs++; return sanitized.trim().slice(0, this.maxTextChars); });
    if (texts.length > 256) throw new Error('Embedding batch exceeds 256 inputs');
    if (!texts.length) return [];
    const outputs: Array<number[] | undefined> = new Array(texts.length);
    const missing: Array<{ index: number; text: string; key: string }> = [];
    texts.forEach((text, index) => {
      const key = `${this.providerId}:${fingerprint(text)}`;
      const cached = this.cache.get(key);
      if (cached) {
        this.cache.delete(key);
        this.cache.set(key, cached);
        this.stats.cacheHits++;
        outputs[index] = cached;
      } else {
        this.stats.cacheMisses++;
        missing.push({ index, text, key });
      }
    });
    for (let offset = 0; offset < missing.length; offset += this.batchSize) {
      const part = missing.slice(offset, offset + this.batchSize);
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) throw new Error('Embedding request exceeded its total time budget');
      const texts = part.map(row => row.text);
      const vectors = await sharedLocalInferenceScheduler.run(
        localEndpointResourceKey({ baseUrl: this.baseUrl }, 'embeddings'),
        () => {
          const inferenceRemainingMs = deadlineAt - Date.now();
          if (inferenceRemainingMs < 100) throw new Error('Embedding request exceeded its total time budget');
          return this.requestVectors(texts, inferenceRemainingMs);
        },
        { queueTimeoutMs: Math.max(100, Math.min(sharedLocalInferenceScheduler.queueTimeoutMs, remainingMs)) },
      );
      if (vectors.length !== part.length) throw new Error('Embedding provider returned a mismatched vector count');
      const dimension = vectors[0]?.length ?? 0;
      if (!dimension || dimension > 4096 || vectors.some(vector => vector.length !== dimension)) throw new Error('Embedding provider returned inconsistent dimensions');
      vectors.forEach((vector, partIndex) => {
        const normalized = normalize(vector);
        if (!normalized.length) throw new Error('Embedding provider returned an empty or zero vector');
        const row = part[partIndex];
        this.cache.set(row.key, normalized);
        outputs[row.index] = normalized;
      });
      while (this.cache.size > this.cacheLimit) {
        const first = this.cache.keys().next().value as string | undefined;
        if (first === undefined) break;
        this.cache.delete(first);
      }
    }
    if (outputs.some(vector => !vector)) throw new Error('Embedding provider did not return every vector');
    return outputs as number[][];
  }

  private async requestVectors(texts: string[], timeoutMs = this.timeoutMs): Promise<number[][]> {
    const endpoint = new URL(this.kind === 'ollama' ? 'api/embed' : 'embeddings', `${this.baseUrl.toString().replace(/\/+$/, '')}/`);
    const body = this.kind === 'ollama' ? { model: this.modelId, input: texts, truncate: true } : { model: this.modelId, input: texts, encoding_format: 'float' };
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    const started = Date.now();
    this.stats.requests++;
    try {
      const response = await this.fetchImpl(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(1, Math.min(this.timeoutMs, Math.floor(timeoutMs)))), redirect: 'error' });
      if (!response.ok) throw new Error(`Embedding endpoint returned HTTP ${response.status}`);
      const payload = await response.json() as any;
      let vectors: unknown[];
      if (this.kind === 'ollama') vectors = payload?.embeddings;
      else {
        const data = Array.isArray(payload?.data) ? [...payload.data].sort((a, b) => Number(a?.index ?? 0) - Number(b?.index ?? 0)) : [];
        vectors = data.map((row: any) => row?.embedding);
      }
      if (!Array.isArray(vectors) || vectors.length !== texts.length) throw new Error('Embedding response has no valid vector list');
      return vectors.map((raw, index) => {
        if (!Array.isArray(raw) || !raw.length || raw.length > 4096 || raw.some(value => !Number.isFinite(Number(value)))) throw new Error(`Invalid embedding vector at index ${index}`);
        return raw.map(Number);
      });
    } catch (error) {
      this.stats.failures++;
      this.stats.lastError = String(error instanceof Error ? error.message : error).slice(0, 240);
      throw error;
    } finally {
      this.stats.lastLatencyMs = Math.max(0, Date.now() - started);
    }
  }

  diagnostics(): LocalEmbeddingDiagnostics {
    return { configured: true, provider: this.kind, model: this.modelId, endpoint: `${this.baseUrl.origin}${this.baseUrl.pathname === '/' ? '' : this.baseUrl.pathname}`, cacheEntries: this.cache.size, ...this.stats };
  }
}
