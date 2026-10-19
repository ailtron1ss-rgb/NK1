export interface LocalChatCompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
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
function canonicalBaseUrl(raw: string | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('llama.cpp-invalid-base-url'); }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.search || url.hash) {
    throw new Error('llama.cpp-endpoint-must-be-loopback-http');
  }
  url.pathname = url.pathname.replace(/\\/+$/, '');
  if (!url.pathname || url.pathname === '/') url.pathname = '/v1';
  return url.toString().replace(/\\/+$/, '');
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
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
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
      }),
    });
    if (!response.ok) throw new Error(`llama.cpp-http-${response.status}`);
    const contentLength = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      try { await response.body?.cancel(); } catch { /* Preserve the size-limit failure. */ }
      throw new Error('llama.cpp-response-too-large');
    }
    const rawPayload = await readBoundedResponse(response);
    let payload: { choices?: Array<{ message?: { content?: unknown } }>; model?: unknown; error?: unknown };
    try { payload = JSON.parse(rawPayload) as typeof payload; } catch { throw new Error('llama.cpp-invalid-json'); }
    const text = extractText(payload?.choices?.[0]?.message?.content);
    if (!text) throw new Error('llama.cpp-empty-response');
    const model = String(payload?.model ?? this.model).slice(0, 160);
    return { text, backend: `llama.cpp:${model}`, model, latencyMs: Math.max(0, Date.now() - startedAt) };
  }
}
