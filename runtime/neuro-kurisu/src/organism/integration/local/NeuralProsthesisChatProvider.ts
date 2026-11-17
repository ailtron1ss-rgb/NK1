export interface NeuralProsthesisRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}
export interface NeuralProsthesisResponse {
  text: string;
  backend: string;
  model: string;
  latencyMs: number;
  adapterId?: string;
}
export interface NeuralProsthesisProviderOptions {
  baseUrl?: string;
  model?: string;
  adapterId?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function canonicalBaseUrl(raw: string | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('neural-prosthesis-invalid-base-url'); }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.search || url.hash) {
    throw new Error('neural-prosthesis-endpoint-must-be-loopback-http');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!url.pathname || url.pathname === '/') url.pathname = '/v1';
  return url.toString().replace(/\/+$/, '');
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!Array.isArray(value)) return '';
  return value.map(part => part && typeof part === 'object' ? String((part as { text?: unknown }).text ?? '') : '')
    .filter(Boolean).join('').trim();
}

async function readBoundedResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) throw new Error('neural-prosthesis-response-too-large');
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
        try { await reader.cancel(); } catch { /* Keep the size-limit failure. */ }
        throw new Error('neural-prosthesis-response-too-large');
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

/** OpenAI-compatible local inference boundary for NK1's PyTorch/Transformers sidecar. */
export class NeuralProsthesisChatProvider {
  readonly baseUrl: string | null;
  readonly model: string;
  readonly adapterId: string | null;
  readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NeuralProsthesisProviderOptions = {}) {
    this.baseUrl = canonicalBaseUrl(options.baseUrl);
    this.model = String(options.model ?? 'local-transformer').trim().slice(0, 160) || 'local-transformer';
    this.adapterId = String(options.adapterId ?? '').trim().slice(0, 64) || null;
    this.timeoutMs = Math.max(250, Math.min(120_000, Math.floor(options.timeoutMs ?? 30_000)));
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  configured(): boolean { return Boolean(this.baseUrl); }
  endpoint(): string | null { return this.baseUrl ? this.baseUrl + '/chat/completions' : null; }

  async generate(request: NeuralProsthesisRequest): Promise<NeuralProsthesisResponse> {
    const endpoint = this.endpoint();
    if (!endpoint) throw new Error('neural-prosthesis-not-configured');
    if (request.signal?.aborted) throw new Error('neural-prosthesis-request-aborted');
    const startedAt = Date.now();
    const requestedTokens = Number(request.maxTokens ?? 512);
    const maxTokens = Math.max(1, Math.min(2048, Number.isFinite(requestedTokens) ? Math.floor(requestedTokens) : 512));
    const requestedTemperature = Number(request.temperature ?? 0.7);
    const temperature = Math.max(0, Math.min(2, Number.isFinite(requestedTemperature) ? requestedTemperature : 0.7));
    const deadlineSignal = AbortSignal.timeout(this.timeoutMs);
    const transportSignal = request.signal ? AbortSignal.any([deadlineSignal, request.signal]) : deadlineSignal;
    const payload: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: String(request.system ?? '').slice(0, 64_000) },
        { role: 'user', content: String(request.user ?? '').slice(0, 64_000) },
      ],
      max_tokens: maxTokens,
      temperature,
      stream: false,
    };
    if (this.adapterId) payload.adapter_id = this.adapterId;
    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: transportSignal,
        redirect: 'error',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (request.signal?.aborted) throw new Error('neural-prosthesis-request-aborted');
      if (deadlineSignal.aborted) throw new Error('neural-prosthesis-timeout');
      throw error;
    }
    if (!response.ok) throw new Error('neural-prosthesis-http-' + response.status);
    const contentLength = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      try { await response.body?.cancel(); } catch { /* Preserve the size-limit failure. */ }
      throw new Error('neural-prosthesis-response-too-large');
    }
    let raw: string;
    try {
      raw = await readBoundedResponse(response);
    } catch (error) {
      if (error instanceof Error && error.message === 'neural-prosthesis-response-too-large') throw error;
      if (request.signal?.aborted) throw new Error('neural-prosthesis-request-aborted');
      if (deadlineSignal.aborted) throw new Error('neural-prosthesis-timeout');
      throw error;
    }
    let result: { choices?: Array<{ message?: { content?: unknown } }>; model?: unknown; error?: unknown };
    try { result = JSON.parse(raw) as typeof result; } catch { throw new Error('neural-prosthesis-invalid-json'); }
    const text = extractText(result?.choices?.[0]?.message?.content);
    if (!text) throw new Error('neural-prosthesis-empty-response');
    const model = String(result?.model ?? this.model).slice(0, 160);
    return {
      text,
      backend: 'neural-prosthesis:' + model,
      model,
      latencyMs: Math.max(0, Date.now() - startedAt),
      ...(this.adapterId ? { adapterId: this.adapterId } : {}),
    };
  }
}
