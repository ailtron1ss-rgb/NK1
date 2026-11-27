export interface LocalChatResponseFormat {
  /** llama-server accepts JSON object mode with an optional constrained JSON Schema. */
  type: 'json_object';
  schema?: Record<string, unknown>;
}
export interface LocalChatCompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Explicit server-side model alias, used only for locally preloaded adapters. */
  model?: string;
  /** Optional llama.cpp grammar-constrained structured response contract. */
  responseFormat?: LocalChatResponseFormat;
  /** Caller cancellation must reach the actual local HTTP transport. */
  signal?: AbortSignal;
}
export interface LocalChatCompletionResponse {
  text: string;
  backend: string;
  model: string;
  latencyMs: number;
  /** Parsed object is present only when responseFormat was explicitly requested. */
  structuredOutput?: Record<string, unknown>;
}
export interface LocalChatProviderOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

import { types as nodeUtilTypes } from 'node:util';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_JSON_SCHEMA_BYTES = 64 * 1024;
const MAX_JSON_SCHEMA_NODES = 2_048;
const MAX_JSON_SCHEMA_DEPTH = 16;

function invalidSchema(): never { throw new Error('llama.cpp-invalid-response-schema'); }

function cloneJsonSchema(value: unknown, depth = 0, budget = { nodes: 0 }): unknown {
  budget.nodes += 1;
  if (budget.nodes > MAX_JSON_SCHEMA_NODES || depth > MAX_JSON_SCHEMA_DEPTH) return invalidSchema();
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length <= 8_192 ? value : invalidSchema();
  if (typeof value === 'number') return Number.isFinite(value) ? value : invalidSchema();
  if (typeof value !== 'object' || nodeUtilTypes.isProxy(value)) return invalidSchema();

  let prototype: object | null;
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  } catch {
    return invalidSchema();
  }

  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) return invalidSchema();
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > 512 ||
        Reflect.ownKeys(descriptors).length !== length + 1) return invalidSchema();
    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return invalidSchema();
      output.push(cloneJsonSchema(descriptor.value, depth + 1, budget));
    }
    return output;
  }

  if (prototype !== Object.prototype && prototype !== null) return invalidSchema();
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length > 256) return invalidSchema();
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== 'string' || key.length > 128 ||
        key === '__proto__' || key === 'prototype' || key === 'constructor') return invalidSchema();
    const descriptor = descriptors[key];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
        descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return invalidSchema();
    output[key] = cloneJsonSchema(descriptor.value, depth + 1, budget);
  }
  return output;
}

function normalizeResponseFormat(value: unknown): LocalChatResponseFormat {
  if (!value || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) {
    throw new Error('llama.cpp-invalid-response-format');
  }
  let prototype: object | null;
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  } catch {
    throw new Error('llama.cpp-invalid-response-format');
  }
  if ((prototype !== Object.prototype && prototype !== null) || Reflect.ownKeys(descriptors).length > 2) {
    throw new Error('llama.cpp-invalid-response-format');
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !['type', 'schema'].includes(key))) {
    throw new Error('llama.cpp-invalid-response-format');
  }
  const typeDescriptor = descriptors.type;
  if (!typeDescriptor || !Object.prototype.hasOwnProperty.call(typeDescriptor, 'value') ||
      typeDescriptor.get !== undefined || typeDescriptor.set !== undefined || typeDescriptor.value !== 'json_object') {
    throw new Error('llama.cpp-invalid-response-format');
  }
  const schemaDescriptor = descriptors.schema;
  if (!schemaDescriptor) return { type: 'json_object' };
  if (!Object.prototype.hasOwnProperty.call(schemaDescriptor, 'value') ||
      schemaDescriptor.get !== undefined || schemaDescriptor.set !== undefined || !schemaDescriptor.enumerable) {
    return invalidSchema();
  }
  const schema = schemaDescriptor.value;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return invalidSchema();
  const safeSchema = cloneJsonSchema(schema);
  const serialized = JSON.stringify(safeSchema);
  if (new TextEncoder().encode(serialized).byteLength > MAX_JSON_SCHEMA_BYTES) return invalidSchema();
  return { type: 'json_object', schema: safeSchema as Record<string, unknown> };
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
    const responseFormat = request.responseFormat === undefined ? undefined : normalizeResponseFormat(request.responseFormat);
    const requestedModel = request.model === undefined ? this.model : String(request.model).trim();
    if (!requestedModel || requestedModel.length > 160 || /[\x00-\x1F\x7F-\x9F]/.test(requestedModel)) {
      throw new Error('llama.cpp-invalid-model-alias');
    }
    const maxTokens = Math.max(1, Math.min(8192, Math.floor(Number(request.maxTokens ?? 512) || 512)));
    const temperature = Math.max(0, Math.min(2, Number.isFinite(Number(request.temperature)) ? Number(request.temperature) : 0.7));
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
        model: requestedModel,
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
    const model = String(payload?.model ?? requestedModel).slice(0, 160);
    let structuredOutput: Record<string, unknown> | undefined;
    if (responseFormat) {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { throw new Error('llama.cpp-invalid-structured-json'); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('llama.cpp-invalid-structured-json');
      }
      structuredOutput = parsed as Record<string, unknown>;
    }
    return {
      text,
      backend: `llama.cpp:${model}`,
      model,
      latencyMs: Math.max(0, Date.now() - startedAt),
      ...(structuredOutput ? { structuredOutput } : {}),
    };
  }
}
