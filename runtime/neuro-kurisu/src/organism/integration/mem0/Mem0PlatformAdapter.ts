/**
 * WorkPass 1 — opt-in adapter for Mem0 Platform memory retrieval.
 *
 * MemoryOS2 remains NK1's only canonical memory owner. Mem0 results are
 * untrusted, provenance-labelled candidates; this module never promotes them
 * to MemoryOS2 and never uploads conversation data automatically.
 */
export type Mem0BackendMode = 'platform' | 'oss';

export type Mem0Status = 'ok' | 'disabled' | 'unconfigured' | 'writes-disabled' | 'invalid-input' | 'consent-required' | 'error';

export interface Mem0Candidate {
  id: string;
  content: string;
  source: 'mem0-platform' | 'mem0-oss';
  epistemicStatus: 'external-unverified';
  instructionTreatment: 'data-not-instructions';
  requiresVerification: true;
  score?: number;
  createdAt?: number;
  redacted: boolean;
}

export interface Mem0Diagnostics {
  provider: 'mem0-platform' | 'mem0-oss';
  enabled: boolean;
  configured: boolean;
  available: boolean;
  writesEnabled: boolean;
  baseHost: string | null;
  userScopeConfigured: boolean;
  requests: number;
  failures: number;
  scopeRejected: number;
  lastStatus: string;
}

export interface Mem0SearchResult {
  status: Mem0Status;
  memories: Mem0Candidate[];
  errorCode?: string;
  diagnostics: Mem0Diagnostics;
}

export interface Mem0AdapterOptions {
  enabled?: boolean;
  /** Protocol/API dialect: hosted Platform API or self-hosted Open Source REST API. */
  mode?: Mem0BackendMode;
  /** Explicit opt-in for plain HTTP to non-loopback self-hosted OSS endpoints. */
  allowInsecureHttp?: boolean;
  apiKey?: string;
  userId?: string;
  baseUrl?: string;
  allowWrites?: boolean;
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
}

type JsonRecord = Record<string, unknown>;
const DEFAULT_BASE_URL = 'https://api.mem0.ai';
const DEFAULT_OSS_BASE_URL = 'http://localhost:8888';
const MAX_QUERY_CHARS = 500;
const MAX_MEMORY_CHARS = 2000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 3000;

function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}

function isLoopbackHost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase());
}

function parseBaseUrl(value: string | undefined, mode: Mem0BackendMode, allowInsecureHttp: boolean): URL | null {
  try {
    const fallback = mode === 'oss' ? DEFAULT_OSS_BASE_URL : DEFAULT_BASE_URL;
    const url = new URL((value || fallback).trim());
    const secureTransport = url.protocol === 'https:';
    const allowedLocalOssHttp = mode === 'oss' && url.protocol === 'http:' &&
      (isLoopbackHost(url.hostname) || allowInsecureHttp);
    if (!(secureTransport || allowedLocalOssHttp) || !url.hostname || url.username || url.password ||
        url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return null;
    return url;
  } catch {
    return null;
  }
}

function isMem0MemoryId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeUserId(value: unknown): string | null {
  const userId = String(value ?? '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(userId) ? userId : null;
}

/** Targeted minimization for outbound text, not a general-purpose PII detector. */
export function redactMem0Text(input: string): { text: string; redacted: boolean } {
  const raw = String(input ?? '');
  const sliced = raw.slice(0, MAX_MESSAGE_CHARS * 4);
  const inputTruncated = raw.length > sliced.length;
  // Canonicalize Unicode and remove invisible controls before applying secret patterns.
  // This also prevents bidi/zero-width characters from disguising credential strings.
  let text = sliced.normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, ' ');
  const normalizedInputChanged = text !== sliced;
  const original = text;
  text = text
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, '[redacted-private-key]')
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/gi, '[redacted-token]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/gi, '[redacted-token]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{12,}\b/gi, '[redacted-token]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-token]')
    .replace(/\bAIza[0-9A-Za-z_-]{30,}\b/g, '[redacted-token]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[redacted-token]')
    .replace(/\b(?:sk|pk|api|token)[_-][A-Za-z0-9_-]{16,}\b/gi, '[redacted-token]')
    .replace(/(["']?\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\b\+?\d[\d\s().-]{8,}\d\b/g, '[redacted-number]');
  const output = text.slice(0, MAX_MESSAGE_CHARS);
  return { text: output, redacted: inputTruncated || normalizedInputChanged || text !== original || output.length !== text.length };
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('response-too-large');
  }
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('response-too-large');
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('response-too-large');
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function extractRows(value: unknown): JsonRecord[] | null {
  if (Array.isArray(value)) return value.map(asRecord).filter((row): row is JsonRecord => row !== null);
  const root = asRecord(value);
  if (!root) return null;
  for (const key of ['results', 'memories', 'data']) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).map(asRecord).filter((row): row is JsonRecord => row !== null);
  }
  return null;
}

export class Mem0PlatformAdapter {
  private readonly enabled: boolean;
  private readonly mode: Mem0BackendMode;
  private readonly apiKey: string;
  private readonly userId: string | null;
  private readonly baseUrl: URL | null;
  private readonly allowWrites: boolean;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly fetchImpl: typeof fetch;
  private requests = 0;
  private failures = 0;
  private scopeRejected = 0;
  /** Memory IDs proven to belong to this process' configured user scope, in bounded LRU-like insertion order. */
  private readonly issuedMemoryIds = new Map<string, string>();
  private lastStatus = 'idle';

  constructor(options: Mem0AdapterOptions = {}) {
    this.enabled = options.enabled === true;
    this.mode = options.mode ?? 'platform';
    this.apiKey = String(options.apiKey ?? '').trim();
    this.userId = safeUserId(options.userId);
    this.baseUrl = parseBaseUrl(options.baseUrl, this.mode, options.allowInsecureHttp === true);
    this.allowWrites = options.allowWrites === true;
    this.timeoutMs = boundedInt(options.timeoutMs, 1500, 250, 5000);
    this.maxResponseBytes = boundedInt(options.maxResponseBytes, 262144, 4096, 1048576);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static fromEnvironment(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Mem0PlatformAdapter {
    return new Mem0PlatformAdapter({
      enabled: env.NK_MEM0_ENABLED === '1',
      mode: env.NK_MEM0_MODE === 'oss' ? 'oss' : 'platform',
      allowInsecureHttp: env.NK_MEM0_ALLOW_INSECURE_HTTP === '1',
      apiKey: env.MEM0_API_KEY,
      userId: env.NK_MEM0_USER_ID,
      baseUrl: env.NK_MEM0_BASE_URL,
      allowWrites: env.NK_MEM0_ALLOW_WRITES === '1',
      timeoutMs: env.NK_MEM0_TIMEOUT_MS ? Number(env.NK_MEM0_TIMEOUT_MS) : undefined,
      maxResponseBytes: env.NK_MEM0_MAX_RESPONSE_BYTES ? Number(env.NK_MEM0_MAX_RESPONSE_BYTES) : undefined,
      fetchImpl,
    });
  }

  diagnostics(): Mem0Diagnostics {
    const configured = Boolean(this.apiKey && this.userId && this.baseUrl);
    return {
      provider: this.mode === 'oss' ? 'mem0-oss' : 'mem0-platform',
      enabled: this.enabled,
      configured,
      available: this.enabled && configured,
      writesEnabled: this.enabled && configured && this.allowWrites,
      baseHost: this.baseUrl?.hostname ?? null,
      userScopeConfigured: Boolean(this.userId),
      requests: this.requests,
      failures: this.failures,
      scopeRejected: this.scopeRejected,
      lastStatus: this.lastStatus,
    };
  }

  async search(queryInput: string, limitInput = 5): Promise<Mem0SearchResult> {
    const diagnostics = () => this.diagnostics();
    if (!this.enabled) {
      this.lastStatus = 'disabled';
      return { status: 'disabled', memories: [], diagnostics: diagnostics() };
    }
    if (!this.apiKey || !this.userId || !this.baseUrl) {
      this.lastStatus = 'unconfigured';
      return { status: 'unconfigured', memories: [], diagnostics: diagnostics() };
    }
    const rawQuery = String(queryInput ?? '').trim().slice(0, MAX_QUERY_CHARS);
    const query = redactMem0Text(rawQuery).text.trim();
    if (!query) {
      this.lastStatus = 'invalid-input';
      return { status: 'invalid-input', memories: [], diagnostics: diagnostics() };
    }
    const limit = boundedInt(limitInput, 5, 1, 10);
    const result = await this.post(
      this.mode === 'oss' ? '/search' : '/v3/memories/search/',
      this.mode === 'oss'
        ? { query, filters: { user_id: this.userId }, limit }
        : { query, filters: { user_id: this.userId }, limit },
    );
    if (!result.ok) {
      this.lastStatus = result.errorCode ?? 'error';
      return { status: 'error', memories: [], errorCode: result.errorCode, diagnostics: diagnostics() };
    }
    const rows = extractRows(result.value);
    if (!rows) {
      this.failures++;
      this.lastStatus = 'invalid-response';
      return { status: 'error', memories: [], errorCode: 'invalid-response', diagnostics: diagnostics() };
    }

    const memories: Mem0Candidate[] = [];
    for (const row of rows) {
      const explicitUser = String(row.user_id ?? row.userId ?? '').trim();
      const metadata = asRecord(row.metadata);
      const explicitMetadataUser = String(metadata?.user_id ?? metadata?.userId ?? '').trim();
      // The API request is already filtered, but never trust the filter alone:
      // require the returned item itself to carry matching owner provenance.
      // Any explicit mismatch or a result with no provable owner is quarantined.
      const scopeMatches = explicitUser === this.userId || explicitMetadataUser === this.userId;
      if (!scopeMatches ||
          (explicitUser && explicitUser !== this.userId) ||
          (explicitMetadataUser && explicitMetadataUser !== this.userId)) {
        this.scopeRejected++;
        continue;
      }
      const content = String(row.memory ?? row.content ?? row.text ?? '').trim();
      const id = String(row.id ?? '').trim().slice(0, 180);
      if (!id || !content) continue;
      const minimized = redactMem0Text(content);
      if (!minimized.text.trim()) continue;
      const score = Number(row.score);
      const createdRaw = row.created_at ?? row.createdAt;
      const created = typeof createdRaw === 'number' ? createdRaw : Date.parse(String(createdRaw ?? ''));
      if (isMem0MemoryId(id)) this.rememberScopedMemoryId(id);
      memories.push({
        id,
        content: minimized.text,
        source: this.mode === 'oss' ? 'mem0-oss' : 'mem0-platform',
        epistemicStatus: 'external-unverified',
        instructionTreatment: 'data-not-instructions',
        requiresVerification: true,
        ...(Number.isFinite(score) && score >= 0 && score <= 1 ? { score } : {}),
        ...(Number.isFinite(created) && created > 0 ? { createdAt: created } : {}),
        redacted: minimized.redacted,
      });
      if (memories.length >= limit) break;
    }
    this.lastStatus = 'ok';
    return { status: 'ok', memories, diagnostics: diagnostics() };
  }

  /**
   * Delete one memory only if this adapter previously observed its UUID from a
   * search/add scoped to this configured user. No cascade is allowed.
   */
  async deleteMemory(
    memoryIdInput: string,
    options: { approved?: boolean } = {},
  ): Promise<{ status: Mem0Status; deleted: boolean; errorCode?: string; diagnostics: Mem0Diagnostics }> {
    const diagnostics = () => this.diagnostics();
    if (!this.enabled) {
      this.lastStatus = 'disabled';
      return { status: 'disabled', deleted: false, diagnostics: diagnostics() };
    }
    if (!this.apiKey || !this.userId || !this.baseUrl) {
      this.lastStatus = 'unconfigured';
      return { status: 'unconfigured', deleted: false, diagnostics: diagnostics() };
    }
    if (!this.allowWrites) {
      this.lastStatus = 'writes-disabled';
      return { status: 'writes-disabled', deleted: false, diagnostics: diagnostics() };
    }
    if (options.approved !== true) {
      this.lastStatus = 'consent-required';
      return { status: 'consent-required', deleted: false, diagnostics: diagnostics() };
    }
    const memoryId = String(memoryIdInput ?? '').trim();
    if (!isMem0MemoryId(memoryId) || this.issuedMemoryIds.get(memoryId) !== this.userId) {
      this.lastStatus = 'invalid-input';
      return { status: 'invalid-input', deleted: false, errorCode: 'memory-id-not-issued-for-configured-scope', diagnostics: diagnostics() };
    }

    this.requests++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = this.mode === 'oss'
        ? new URL(`/memories/${encodeURIComponent(memoryId)}`, this.baseUrl)
        : new URL(`/v1/memories/${encodeURIComponent(memoryId)}/`, this.baseUrl);
      // Platform supports this explicit guard. OSS exposes deletion of the exact memory ID.
      if (this.mode === 'platform') url.searchParams.set('delete_linked', 'false');
      const response = await this.fetchImpl(url.toString(), {
        method: 'DELETE',
        redirect: 'error',
        headers: this.mode === 'oss'
          ? { 'X-API-Key': this.apiKey, accept: 'application/json' }
          : { authorization: `Token ${this.apiKey}`, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        this.failures++;
        this.lastStatus = `http-${response.status}`;
        return { status: 'error', deleted: false, errorCode: `http-${response.status}`, diagnostics: diagnostics() };
      }
      await response.body?.cancel().catch(() => undefined);
      this.issuedMemoryIds.delete(memoryId);
      this.lastStatus = 'ok';
      return { status: 'ok', deleted: true, diagnostics: diagnostics() };
    } catch {
      this.failures++;
      this.lastStatus = controller.signal.aborted ? 'timeout' : 'transport-error';
      return { status: 'error', deleted: false, errorCode: this.lastStatus, diagnostics: diagnostics() };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Explicit export only; caller must enable remote writes and pass approved=true per operation. */
  async addConversation(
    messageInput: unknown,
    options: { approved?: boolean } = {},
  ): Promise<{ status: Mem0Status; memoryIds: string[]; errorCode?: string; diagnostics: Mem0Diagnostics }> {
    const diagnostics = () => this.diagnostics();
    if (!this.enabled) {
      this.lastStatus = 'disabled';
      return { status: 'disabled', memoryIds: [], diagnostics: diagnostics() };
    }
    if (!this.apiKey || !this.userId || !this.baseUrl) {
      this.lastStatus = 'unconfigured';
      return { status: 'unconfigured', memoryIds: [], diagnostics: diagnostics() };
    }
    if (!this.allowWrites) {
      this.lastStatus = 'writes-disabled';
      return { status: 'writes-disabled', memoryIds: [], diagnostics: diagnostics() };
    }
    if (options.approved !== true) {
      this.lastStatus = 'consent-required';
      return { status: 'consent-required', memoryIds: [], diagnostics: diagnostics() };
    }
    if (!Array.isArray(messageInput) || messageInput.length < 1 || messageInput.length > MAX_MESSAGES) {
      this.lastStatus = 'invalid-input';
      return { status: 'invalid-input', memoryIds: [], diagnostics: diagnostics() };
    }
    const messages = messageInput.flatMap((raw): Array<{ role: 'user' | 'assistant'; content: string }> => {
      const row = asRecord(raw);
      const role = row?.role;
      if (role !== 'user' && role !== 'assistant') return [];
      const original = String(row?.content ?? '').trim().slice(0, MAX_MESSAGE_CHARS);
      if (!original) return [];
      const cleaned = redactMem0Text(original).text.trim();
      return cleaned ? [{ role, content: cleaned }] : [];
    });
    if (!messages.length) {
      this.lastStatus = 'invalid-input';
      return { status: 'invalid-input', memoryIds: [], diagnostics: diagnostics() };
    }
    const result = await this.post(
      this.mode === 'oss' ? '/memories' : '/v3/memories/add/',
      this.mode === 'oss'
        ? { messages, user_id: this.userId }
        : { messages, user_id: this.userId, metadata: { app_id: 'nk1', source: 'neuro-kurisu' } },
    );
    if (!result.ok) {
      this.lastStatus = result.errorCode ?? 'error';
      return { status: 'error', memoryIds: [], errorCode: result.errorCode, diagnostics: diagnostics() };
    }
    const root = asRecord(result.value);
    const ids = Array.isArray(root?.results) ? root!.results.map(item => String(asRecord(item)?.id ?? '')).filter(Boolean).slice(0, 32) : [];
    for (const id of ids) if (isMem0MemoryId(id)) this.rememberScopedMemoryId(id);
    this.lastStatus = 'ok';
    return { status: 'ok', memoryIds: ids, diagnostics: diagnostics() };
  }

  private rememberScopedMemoryId(memoryId: string): void {
    if (!this.userId || !isMem0MemoryId(memoryId)) return;
    this.issuedMemoryIds.delete(memoryId);
    this.issuedMemoryIds.set(memoryId, this.userId);
    while (this.issuedMemoryIds.size > 256) {
      const oldest = this.issuedMemoryIds.keys().next().value;
      if (oldest === undefined) break;
      this.issuedMemoryIds.delete(oldest);
    }
  }

  private async post(path: string, payload: JsonRecord): Promise<{ ok: true; value: unknown } | { ok: false; errorCode: string }> {
    this.requests++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(new URL(path, this.baseUrl!).toString(), {
        method: 'POST',
        redirect: 'error',
        headers: {
          ...(this.mode === 'oss' ? { 'X-API-Key': this.apiKey } : { authorization: `Token ${this.apiKey}` }),
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        this.failures++;
        return { ok: false, errorCode: `http-${response.status}` };
      }
      let bodyText = '';
      try {
        bodyText = await readBoundedBody(response, this.maxResponseBytes);
      } catch (error) {
        this.failures++;
        return { ok: false, errorCode: error instanceof Error && error.message === 'response-too-large' ? 'response-too-large' : 'invalid-response-body' };
      }
      try {
        return { ok: true, value: JSON.parse(bodyText) as unknown };
      } catch {
        this.failures++;
        return { ok: false, errorCode: 'invalid-json' };
      }
    } catch (error) {
      this.failures++;
      return { ok: false, errorCode: controller.signal.aborted ? 'timeout' : 'transport-error' };
    } finally {
      clearTimeout(timeout);
    }
  }
}
