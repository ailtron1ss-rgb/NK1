export interface LocalChatResponseFormat {
  /** llama-server accepts plain JSON mode or JSON Schema constrained decoding. */
  type: 'json_object' | 'json_schema';
  /** Optional schema supported by llama.cpp for both response-format types. */
  schema?: Record<string, unknown>;
}
export interface LocalChatCompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Optional server-side constrained decoding; omitted for ordinary text generation. */
  responseFormat?: LocalChatResponseFormat;
  /** Caller cancellation must reach the actual local HTTP transport. */
  signal?: AbortSignal;
}
export interface LocalChatCompletionResponse {
  text: string;
  backend: string;
  model: string;
  latencyMs: number;
}
export interface LocalChatProviderOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_SCHEMA_BYTES = 32 * 1024;
const MAX_RESPONSE_SCHEMA_DEPTH = 16;
const MAX_RESPONSE_SCHEMA_NODES = 2048;

/** Clone bounded JSON data without invoking getters, accepting proxies, or retaining mutable caller references. */
function cloneJsonData(value: unknown, state: { seen: Set<object>; budget: { nodes: number }; depth: number }): unknown {
  state.budget.nodes += 1;
  if (state.budget.nodes > MAX_RESPONSE_SCHEMA_NODES || state.depth > MAX_RESPONSE_SCHEMA_DEPTH) throw new Error('llama.cpp-response-schema-too-complex');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('llama.cpp-response-schema-not-json');
    return value;
  }
  if (typeof value !== 'object') throw new Error('llama.cpp-response-schema-not-json');
  const object = value as object;
  if (state.seen.has(object)) throw new Error('llama.cpp-response-schema-circular');
  state.seen.add(object);
  try {
    const prototype = Object.getPrototypeOf(object);
    const descriptors = Object.getOwnPropertyDescriptors(object);
    if (Array.isArray(object)) {
      if (prototype !== Array.prototype) throw new Error('llama.cpp-response-schema-not-plain-data');
      const lengthDescriptor = descriptors.length;
      const length = Number(lengthDescriptor?.value);
      if (!Number.isSafeInteger(length) || length < 0 || length > 512) throw new Error('llama.cpp-response-schema-array-too-large');
      const result: unknown[] = [];
      for (let i = 0; i < length; i += 1) {
        const descriptor = descriptors[String(i)];
        if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) throw new Error('llama.cpp-response-schema-not-plain-data');
        result.push(cloneJsonData(descriptor.value, { seen: state.seen, budget: state.budget, depth: state.depth + 1 }));
      }
      return result;
    }
    if (prototype !== Object.prototype && prototype !== null) throw new Error('llama.cpp-response-schema-not-plain-data');
    const keys = Reflect.ownKeys(object);
    if (keys.some(key => typeof key !== 'string')) throw new Error('llama.cpp-response-schema-not-plain-data');
    if (keys.length > 256) throw new Error('llama.cpp-response-schema-too-many-keys');
    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys as string[]) {
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) throw new Error('llama.cpp-response-schema-accessor-rejected');
      Object.defineProperty(result, key, {
        value: cloneJsonData(descriptor.value, { seen: state.seen, budget: state.budget, depth: state.depth + 1 }),
        enumerable: true, configurable: true, writable: true,
      });
    }
    return result;
  } finally {
    state.seen.delete(object);
  }
}


type NormalizedLocalChatResponseFormat =
  | { type: 'json_object'; schema?: Record<string, unknown> }
  | { type: 'json_schema'; json_schema: { schema: Record<string, unknown> } };

/**
 * Normalize NK1's ergonomic input shape to llama.cpp's actual server wire contract.
 * llama-server reads response_format.json_schema.schema for type=json_schema;
 * a sibling response_format.schema is only read for type=json_object.
 */
function normalizeResponseFormat(raw: LocalChatResponseFormat | undefined): NormalizedLocalChatResponseFormat | undefined {
  if (raw === undefined) return undefined;
  let cloned: unknown;
  try { cloned = cloneJsonData(raw, { seen: new Set<object>(), budget: { nodes: 0 }, depth: 0 }); }
  catch (error) { throw error instanceof Error ? error : new Error('llama.cpp-response-schema-invalid'); }
  if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) throw new Error('llama.cpp-response-format-invalid');
  const format = cloned as Record<string, unknown>;
  if (format.type !== 'json_object' && format.type !== 'json_schema') throw new Error('llama.cpp-response-format-type-invalid');
  if (Object.keys(format).some(key => key !== 'type' && key !== 'schema')) throw new Error('llama.cpp-response-format-unsupported-field');
  if (format.schema !== undefined && (!format.schema || typeof format.schema !== 'object' || Array.isArray(format.schema))) {
    throw new Error('llama.cpp-response-schema-invalid');
  }
  if (format.type === 'json_schema' && format.schema === undefined) throw new Error('llama.cpp-response-schema-required');
  const encoded = JSON.stringify(format);
  if (new TextEncoder().encode(encoded).byteLength > MAX_RESPONSE_SCHEMA_BYTES) throw new Error('llama.cpp-response-schema-too-large');
  if (format.type === 'json_schema') {
    return { type: 'json_schema', json_schema: { schema: format.schema as Record<string, unknown> } };
  }
  return { type: 'json_object', ...(format.schema === undefined ? {} : { schema: format.schema as Record<string, unknown> }) };
}
function canonicalBaseUrl(raw: string | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('llama.cpp-invalid-base-url'); }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.search || url.hash) {
    throw new Error('llama.cpp-endpoint-must-be-loopback-http');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!url.pathname || url.pathname === '/') url.pathname = '/v1';
  return url.toString().replace(/\/+$/, '');
}
function extractText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!Array.isArray(value)) return '';
  return value.map((part) => part && typeof part === 'object' ? String((part as { text?: unknown }).text ?? '') : '')
    .filter(Boolean).join('').trim();
}

/**
 * Read a response incrementally so the size limit bounds peak payload memory,
 * including chunked responses that omit Content-Length.
 */
async function readBoundedResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    // Lightweight injected test transports may only implement text(). The real
    // Fetch Response path always uses the bounded streaming reader above.
    const raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) throw new Error('llama.cpp-response-too-large');
    return raw;
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        try { await reader.cancel(); } catch { /* Preserve the size-limit failure. */ }
        throw new Error('llama.cpp-response-too-large');
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const payload = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(payload);
}

/**
 * Minimal local-only OpenAI-compatible chat boundary for llama.cpp `llama-server`
 * and compatible local runners. It deliberately owns no model state or fallback
 * policy; the existing P40 model ecology remains responsible for selection.
 */
export class OpenAICompatibleLocalChatProvider {
  readonly baseUrl: string | null;
  readonly model: string;
  readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LocalChatProviderOptions = {}) {
    this.baseUrl = canonicalBaseUrl(options.baseUrl);
    this.model = String(options.model ?? 'local-model').trim().slice(0, 160) || 'local-model';
    this.timeoutMs = Math.max(250, Math.min(120_000, Math.floor(options.timeoutMs ?? 15_000)));
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  configured(): boolean { return Boolean(this.baseUrl); }
  endpoint(): string | null { return this.baseUrl ? `${this.baseUrl}/chat/completions` : null; }

  async generate(request: LocalChatCompletionRequest): Promise<LocalChatCompletionResponse> {
    const endpoint = this.endpoint();
    if (!endpoint) throw new Error('llama.cpp-not-configured');
    const startedAt = Date.now();
    const maxTokens = Math.max(1, Math.min(8192, Math.floor(Number(request.maxTokens ?? 512) || 512)));
    const temperature = Math.max(0, Math.min(2, Number.isFinite(Number(request.temperature)) ? Number(request.temperature) : 0.7));
    const responseFormat = normalizeResponseFormat(request.responseFormat);
    if (request.signal?.aborted) throw new Error('llama.cpp-request-aborted');
    const deadlineSignal = AbortSignal.timeout(this.timeoutMs);
    const transportSignal = request.signal
      ? AbortSignal.any([deadlineSignal, request.signal])
      : deadlineSignal;
    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: transportSignal,
      redirect: 'error',
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: String(request.system ?? '').slice(0, 64_000) },
          { role: 'user', content: String(request.user ?? '').slice(0, 64_000) },
        ],
        max_tokens: maxTokens,
        temperature,
        stream: false,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
      });
    } catch (error) {
      if (request.signal?.aborted) throw new Error('llama.cpp-request-aborted');
      if (deadlineSignal.aborted) throw new Error('llama.cpp-timeout');
      throw error;
    }
    if (!response.ok) throw new Error(`llama.cpp-http-${response.status}`);
    const contentLength = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      try { await response.body?.cancel(); } catch { /* Preserve the size-limit failure. */ }
      throw new Error('llama.cpp-response-too-large');
    }
    let rawPayload: string;
    try {
      rawPayload = await readBoundedResponse(response);
    } catch (error) {
      if (error instanceof Error && error.message === 'llama.cpp-response-too-large') throw error;
      if (request.signal?.aborted) throw new Error('llama.cpp-request-aborted');
      if (deadlineSignal.aborted) throw new Error('llama.cpp-timeout');
      throw error;
    }
    let payload: { choices?: Array<{ message?: { content?: unknown } }>; model?: unknown; error?: unknown };
    try { payload = JSON.parse(rawPayload) as typeof payload; } catch { throw new Error('llama.cpp-invalid-json'); }
    const text = extractText(payload?.choices?.[0]?.message?.content);
    if (!text) throw new Error('llama.cpp-empty-response');
    const model = String(payload?.model ?? this.model).slice(0, 160);
    return { text, backend: `llama.cpp:${model}`, model, latencyMs: Math.max(0, Date.now() - startedAt) };
  }
}
