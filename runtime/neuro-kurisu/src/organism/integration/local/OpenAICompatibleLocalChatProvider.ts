import { cognitiveNeuralProfileFingerprint, isValidCognitiveNeuralControlProfile, type CognitiveNeuralControlProfile } from '../../cognition/CognitiveToNeuralBridge.ts';

export interface LocalChatCompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Caller cancellation must reach the actual local HTTP transport. */
  signal?: AbortSignal;
  /** Optional NK1 control profile; forwarded only when custom llama.cpp Jinja controls are explicitly enabled. */
  cognitiveControl?: CognitiveNeuralControlProfile;
  /** Per-runtime unique correlation ID; required for a deliverable control receipt. */
  cognitiveControlRequestId?: string;
}
export interface LocalChatCompletionResponse {
  text: string;
  backend: string;
  model: string;
  latencyMs: number;
  providerControlReceipt?: {
    provider:'llama.cpp'; templateKwargsSent:true; featureSchema:string;
    requestId:string; profileFingerprint:string;
  };
}
export interface LocalChatProviderOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Opt-in: forward bounded NK1 channels to a compatible llama.cpp Jinja chat template. */
  enableCognitiveTemplateControls?: boolean;
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
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!url.pathname || url.pathname === '/') url.pathname = '/v1';
  return url.toString().replace(/\/+$/, '');
}
function cognitiveTemplateKwargs(profile:CognitiveNeuralControlProfile|undefined,requestId:string|undefined):Record<string,unknown>|null {
  if(!isValidCognitiveNeuralControlProfile(profile)
    || typeof requestId!=='string'
    || requestId.length<1 || requestId.length>128
    || !/^[a-z0-9][a-z0-9._:-]*$/i.test(requestId)) return null;
  const f=profile.featureVector01;
  const clamp01=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
  const clampIntent=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(.15,value)):0;
  return {
    nk1_control_version:2,
    nk1_feature_schema:profile.featureSchema,
    nk1_tick:profile.tick,
    nk1_action:profile.action,
    nk1_mode:profile.mode,
    nk1_adapter_hint:profile.adapterHint,
    nk1_feature_keys:[...profile.featureKeys],
    nk1_feature_vector01:[...f],
    nk1_motivation01:clamp01(f[7]),
    nk1_uncertainty01:clamp01(f[8]),
    nk1_urgency01:clamp01(f[9]),
    nk1_budget_remaining01:clamp01(f[10]),
    nk1_attention01:clamp01(f[11]),
    nk1_neural_prediction_error01:clamp01(f[12]),
    nk1_neural_plasticity01:clamp01(f[13]),
    nk1_neuromodulation01:clamp01(f[14]),
    nk1_neural_confidence01:clamp01(f[17]),
    nk1_model_agreement01:clamp01(f[18]),
    nk1_counterfactual_divergence01:clamp01(f[19]),
    nk1_allostatic_drive01:clamp01(f[22]),
    nk1_allostatic_exploration01:clamp01(f[24]),
    nk1_allostatic_preservation01:clamp01(f[25]),
    nk1_self_agency01:clamp01(f[28]),
    nk1_self_continuity01:clamp01(f[29]),
    nk1_goal_commitment01:clamp01(f[33]),
    nk1_neural_snapshot_available:profile.neuralSnapshotAvailable,
    nk1_neural_snapshot_version:profile.neuralSnapshotVersion,
    nk1_neural_snapshot_freshness01:clamp01(f[35]),
    nk1_steering_curiosity01:clampIntent(profile.steeringIntent01.curiosity01),
    nk1_steering_caution01:clampIntent(profile.steeringIntent01.caution01),
    nk1_steering_persistence01:clampIntent(profile.steeringIntent01.persistence01),
    nk1_steering_verification01:clampIntent(profile.steeringIntent01.verification01),
  };
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
  private readonly enableCognitiveTemplateControls: boolean;

  constructor(options: LocalChatProviderOptions = {}) {
    this.baseUrl = canonicalBaseUrl(options.baseUrl);
    this.model = String(options.model ?? 'local-model').trim().slice(0, 160) || 'local-model';
    this.timeoutMs = Math.max(250, Math.min(120_000, Math.floor(options.timeoutMs ?? 15_000)));
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.enableCognitiveTemplateControls = options.enableCognitiveTemplateControls === true;
  }

  configured(): boolean { return Boolean(this.baseUrl); }
  endpoint(): string | null { return this.baseUrl ? `${this.baseUrl}/chat/completions` : null; }

  async generate(request: LocalChatCompletionRequest): Promise<LocalChatCompletionResponse> {
    const endpoint = this.endpoint();
    if (!endpoint) throw new Error('llama.cpp-not-configured');
    const startedAt = Date.now();
    const maxTokens = Math.max(1, Math.min(8192, Math.floor(Number(request.maxTokens ?? 512) || 512)));
    const temperature = Math.max(0, Math.min(2, Number.isFinite(Number(request.temperature)) ? Number(request.temperature) : 0.7));
    if (request.signal?.aborted) throw new Error('llama.cpp-request-aborted');
    const deadlineSignal = AbortSignal.timeout(this.timeoutMs);
    const transportSignal = request.signal
      ? AbortSignal.any([deadlineSignal, request.signal])
      : deadlineSignal;
    const templateKwargs = this.enableCognitiveTemplateControls
      ? cognitiveTemplateKwargs(request.cognitiveControl,request.cognitiveControlRequestId)
      : null;
    const profileFingerprint = templateKwargs && request.cognitiveControl
      ? cognitiveNeuralProfileFingerprint(request.cognitiveControl)
      : null;
    const completionBody:Record<string,unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: String(request.system ?? '').slice(0, 64_000) },
        { role: 'user', content: String(request.user ?? '').slice(0, 64_000) },
      ],
      max_tokens: maxTokens,
      temperature,
      stream: false,
    };
    if (templateKwargs) completionBody.chat_template_kwargs = templateKwargs;
    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: transportSignal,
      redirect: 'error',
      body: JSON.stringify(completionBody),
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
    return {
      text,
      backend: `llama.cpp:${model}`,
      model,
      latencyMs: Math.max(0, Date.now() - startedAt),
      ...(templateKwargs && request.cognitiveControlRequestId && profileFingerprint ? {
        providerControlReceipt:{
          provider:'llama.cpp' as const,
          templateKwargsSent:true as const,
          featureSchema:request.cognitiveControl!.featureSchema,
          requestId:request.cognitiveControlRequestId,
          profileFingerprint,
        },
      } : {}),
    };
  }
}
