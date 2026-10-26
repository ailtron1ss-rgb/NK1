import type { BackendUiSnapshot, ChatBackendResponse } from "./types";
import { waitForActionApproval } from "./action-approval-broker.ts";

const API_BASE = String(import.meta.env?.VITE_NEURO_KURISU_API_BASE ?? "").replace(/\/$/, "");

type ApprovalChallenge = {
  id: string;
  toolId: string;
  permissionClass: string;
  operation: string;
  reasonCode: string;
  expiresAt: number;
  createdAt?: number;
  inputKeys?: string[];
  inputPreview?: Record<string, unknown>;
};

type ApiFailure = Error & { status?: number; data?: unknown };

async function sendRequest(path: string, init?: RequestInit): Promise<{ response: Response; data: unknown }> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { response, data };
}

function apiFailure(response: Response, data: unknown): ApiFailure {
  const message = typeof data === "object" && data && "error" in data ? String((data as { error?: unknown }).error) : `HTTP ${response.status}`;
  const error = new Error(message) as ApiFailure;
  error.status = response.status;
  error.data = data;
  return error;
}

function safeApprovalPreview(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 16)) {
    const key = String(rawKey).replace(/[\r\n\t]/g, " ").slice(0, 80);
    if (!key) continue;
    if (/(secret|password|passwd|token|authorization|credential|cookie|api.?key|private.?key|access.?key|raw.?content|binary|base64|file.?content|document.?body|prompt.?context)/i.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    if (rawValue === null || typeof rawValue === "number" || typeof rawValue === "boolean") {
      output[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "string") {
      output[key] = rawValue
        .replace(/(bearer\s+)[a-z0-9._~+\/-]+=*/ig, "$1[redacted]")
        .replace(/([?&](?:access[_-]?token|refresh[_-]?token|token|key|secret|password|api[_-]?key|client[_-]?secret)=)[^&\s]+/ig, "$1[redacted]")
        .replace(/(https?:\/\/)[^:/@\s]+:[^/@\s]+@/ig, "$1[redacted]@")
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig, "[email]")
        .replace(/(?<!\w)\+?\d[\d .()/-]{7,}\d(?!\w)/g, "[phone]")
        .slice(0, 240);
      continue;
    }
    if (Array.isArray(rawValue)) output[key] = `[array: ${Math.min(10000, rawValue.length)} items]`;
    else if (typeof rawValue === "object") output[key] = `[object: ${Object.keys(rawValue as object).slice(0, 8).map(name => name.slice(0, 48)).join(", ")}]`;
    else output[key] = "[unsupported value]";
  }
  return output;
}

function approvalChallenge(data: unknown): ApprovalChallenge | null {
  if (!data || typeof data !== "object" || (data as { approvalRequired?: unknown }).approvalRequired !== true) return null;
  const payload = data as Record<string, unknown>;
  const nested = payload.approvalRequest && typeof payload.approvalRequest === "object"
    ? payload.approvalRequest as Record<string, unknown>
    : payload.result && typeof payload.result === "object" && (payload.result as Record<string, unknown>).approvalRequest && typeof (payload.result as Record<string, unknown>).approvalRequest === "object"
      ? (payload.result as Record<string, unknown>).approvalRequest as Record<string, unknown>
      : null;
  if (!nested || typeof nested.id !== "string" || !/^approval-[a-z0-9-]{8,116}$/i.test(nested.id) || typeof nested.toolId !== "string" || !/^[a-z0-9._:-]{1,96}$/i.test(nested.toolId)) return null;
  const expiresAt = Number(nested.expiresAt);
  const now = Date.now();
  // ActionGateway issues five-minute tickets. Reject malformed/far-future values
  // before they can become a browser-side continuation or timer.
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt - now > 5 * 60_000 + 1_000) return null;
  return {
    id: nested.id,
    toolId: nested.toolId,
    permissionClass: String(nested.permissionClass || "protected-action").slice(0, 48),
    operation: String(nested.operation || "execute").slice(0, 32),
    reasonCode: String(nested.reasonCode || "explicit-approval-required").replace(/[\r\n\t]/g, " ").slice(0, 120),
    expiresAt,
    ...(Number.isFinite(Number(nested.createdAt)) ? { createdAt: Number(nested.createdAt) } : {}),
    inputKeys: Array.isArray(nested.inputKeys) ? nested.inputKeys.filter((x): x is string => typeof x === "string").slice(0, 24).map(x => x.replace(/[\r\n\t]/g, " ").slice(0, 80)) : [],
    inputPreview: safeApprovalPreview(nested.inputPreview),
  };
}

function apiLabel(path: string): string {
  if (path.includes("/projects/step")) return "Advance the active project by one step";
  if (path.includes("/projects/tool")) return "Execute a tool for the active project";
  if (path.includes("/tools/reconcile")) return "Reconcile an uncertain external action";
  if (path.includes("/tools/execute")) return "Execute a protected organism tool";
  if (path.includes("/research/probe/")) return "Launch an isolated research probe";
  if (path.includes("/integration/outbound")) return "Send data to an external integration";
  if (path.includes("/voice/listen")) return "Access microphone input";
  if (path.includes("/voice/speak")) return "Speak a reply through the selected voice provider";
  if (path.includes("/voice/turn")) return "Run a voice conversation turn";
  if (path.includes("/chat")) return "Process a chat request that includes a protected action";
  return `Protected action: ${path.split("?")[0].slice(0, 100)}`;
}

function isReplayableJsonRequest(init: RequestInit | undefined): boolean {
  if (typeof init?.body !== "string") return false;
  try {
    const value: unknown = JSON.parse(init.body);
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  } catch { return false; }
}

function requestWithApprovalId(init: RequestInit | undefined, approvalId: string): RequestInit {
  const originalBody = init?.body;
  if (typeof originalBody !== "string") throw new Error("This protected request cannot be safely resumed because it has no replayable JSON body.");
  let decoded: unknown;
  try { decoded = JSON.parse(originalBody); } catch { throw new Error("This protected request cannot be safely resumed because its body is not valid JSON."); }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("This protected request cannot be safely resumed because its JSON body is not an object.");
  return { ...init, body: JSON.stringify({ ...(decoded as Record<string, unknown>), approvalId }) };
}

async function request<T>(path: string, init?: RequestInit, allowApprovalContinuation = true): Promise<T> {
  const { response, data } = await sendRequest(path, init);
  if (!response.ok) {
    const challenge = allowApprovalContinuation && response.status === 403 && String(init?.method || "GET").toUpperCase() === "POST" && !path.includes("/tools/permissions/") && isReplayableJsonRequest(init)
      ? approvalChallenge(data)
      : null;
    if (challenge && challenge.expiresAt > Date.now()) {
      return waitForActionApproval<T>({
        ...challenge,
        requestPath: path,
        label: apiLabel(path),
        execute: async (approved) => {
          const decisionResponse = await sendRequest("/api/organism/tools/permissions/resolve", {
            method: "POST",
            body: JSON.stringify({ requestId: challenge.id, approved }),
          });
          if (!decisionResponse.response.ok || !decisionResponse.data || typeof decisionResponse.data !== "object" || (decisionResponse.data as Record<string, unknown>).ok !== true) {
            throw apiFailure(decisionResponse.response, decisionResponse.data);
          }
          if (!approved) return undefined as T;
          // Retry only the original path and original JSON payload, adding the one-time ticket.
          // The low-level retry is deliberately forbidden from creating another approval UI loop.
          return request<T>(path, requestWithApprovalId(init, challenge.id), false);
        },
      });
    }
    throw apiFailure(response, data);
  }
  return data as T;
}

type MemoryInspectorOptions = { query?: string; limit?: number; temporalMode?: "current" | "at" | "all"; asOfAt?: number };

function memoryInspectorSearch(options: MemoryInspectorOptions = {}): string {
  const params = new URLSearchParams();
  const query = options.query?.trim();
  if (query) params.set("q", query);
  if (options.limit !== undefined && Number.isFinite(options.limit)) {
    params.set("limit", String(Math.max(1, Math.min(32, Math.floor(options.limit)))));
  }
  if (options.temporalMode) params.set("temporalMode", options.temporalMode);
  if (options.asOfAt !== undefined && Number.isFinite(options.asOfAt)) params.set("asOfAt", String(options.asOfAt));
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export const neuroApi = {
  uiSnapshot: () => request<BackendUiSnapshot>("/api/organism/ui-snapshot"),
  statusLite: () => request<{ ok: boolean; version: string; tick: number; lastAction: string; autonomyScore: number; predictionError: number; identityContinuity01: number; memoryCount: number; body: Record<string, number | boolean>; language: { calls: number; backend: string; degraded: boolean; lastFailure?: string }; voice: { state?: { speaking: boolean; listening: boolean } } }>("/api/organism/status-lite"),
  sensorium: () => request<Record<string, unknown>>("/api/organism/sensorium/status"),
  chat: (message: string, deliberate = true, speak = false, approvalId?: string) => request<ChatBackendResponse>("/api/organism/chat", {
    method: "POST",
    body: JSON.stringify({ message, deliberate, speak, ...(approvalId ? { approvalId } : {}) }),
  }),
  proactiveMessage: () => request<{ ok: boolean; initiative: null | { id: string; kind: string; topic: string; message: string; createdAt: number; tick?: number; priority01: number; status: string } }>("/api/organism/proactive-message"),
  ackProactiveMessage: (id: string) => request<{ ok: boolean; acknowledged: boolean }>("/api/organism/proactive-message/ack", { method: "POST", body: JSON.stringify({ id }) }),
  sleep: (reason = "ui") => request<{ ok: boolean }>("/api/organism/sleep", { method: "POST", body: JSON.stringify({ reason }) }),
  wake: (reason = "ui") => request<{ ok: boolean }>("/api/organism/wake", { method: "POST", body: JSON.stringify({ reason }) }),
  researchStatus: () => request<Record<string, unknown>>("/api/research/status"),
  researchProbe: (kind: "neurocore" | "nomega-registry" | "deepcode", approvalId?: string) => request<Record<string, unknown>>(`/api/research/probe/${kind}`, { method: "POST", body: JSON.stringify({ ...(approvalId ? { approvalId } : {}) }) }),
  toolPermissions: () => request<Record<string, unknown>>("/api/organism/tools/permissions"),
  actionRecovery: (limit = 32) => request<Record<string, unknown>>(`/api/organism/action-recovery?limit=${Math.max(1, Math.min(64, Math.floor(limit)))}`),
  resolveToolPermission: (requestId: string, approved: boolean) => request<Record<string, unknown>>("/api/organism/tools/permissions/resolve", { method: "POST", body: JSON.stringify({ requestId, approved }) }),
  requestToolPermission: (id: string, toolInput: Record<string, unknown>, reason: string, operation: "execute" | "reconcile" | "direct" = "direct") => request<Record<string, unknown>>("/api/organism/tools/permissions/request", { method: "POST", body: JSON.stringify({ id, toolInput, reason, operation }) }),
  willDiagnostics: () => request<Record<string, unknown>>("/api/organism/will"),
  memoryStrategyDiagnostics: () => request<Record<string, unknown>>("/api/organism/memory-strategy"),
  portableSubjectFidelity: () => request<Record<string, unknown>>("/api/organism/subject-fidelity"),
  contextBudgetDiagnostics: () => request<Record<string, unknown>>("/api/organism/context-budget"),
  knownEntityDossiers: (limit = 64, handle?: string) => request<Record<string, unknown>>(`/api/organism/known-entities?limit=${Math.max(1, Math.min(128, limit))}${handle ? `&handle=${encodeURIComponent(handle)}` : ""}`),
  memoryRetrievalBenchmark: (examples: unknown[], options: Record<string, unknown> = {}) => request<Record<string, unknown>>("/api/organism/memory-benchmark", { method: "POST", body: JSON.stringify({ examples: examples.slice(0, 256), options }) }),
  willSdk: () => request<Record<string, unknown>>("/api/organism/will/sdk"),
  willMcpManifest: () => request<Record<string, unknown>>("/api/organism/will/mcp"),
  willBenchmark: (queries: string[] = [], k = 5, efSearch = 32) => request<Record<string, unknown>>("/api/organism/will/benchmark", { method: "POST", body: JSON.stringify({ queries, k, efSearch }) }),

  integrationOverview: () => request<Record<string, unknown>>("/api/organism/integration/overview"),
  integrationCapabilities: (channel?: string) => request<Record<string, unknown>>(`/api/organism/integration/capabilities${channel ? `?channel=${encodeURIComponent(channel)}` : ""}`),
  integrationCapabilityAuthorize: (id: string, channel: string, confirmed=false) => request<Record<string, unknown>>(`/api/organism/integration/capability/authorize?id=${encodeURIComponent(id)}&channel=${encodeURIComponent(channel)}&confirmed=${confirmed ? "1" : "0"}`),
  integrationSocial: () => request<Record<string, unknown>>("/api/organism/integration/social"),
  integrationConversation: (payload: unknown) => request<Record<string, unknown>>("/api/organism/integration/social/conversation", { method: "POST", body: JSON.stringify(payload) }),
  integrationOutbound: (payload: unknown) => request<Record<string, unknown>>("/api/organism/integration/outbound", { method: "POST", body: JSON.stringify(payload) }),
  integrationWebValidate: (url: string) => request<Record<string, unknown>>("/api/organism/integration/web/validate", { method: "POST", body: JSON.stringify({ url }) }),
  integrationCompetence: () => request<Record<string, unknown>>("/api/organism/integration/competence"),
  integrationCompetenceValidate: (bundle: unknown) => request<Record<string, unknown>>("/api/organism/integration/competence/validate", { method: "POST", body: JSON.stringify({ bundle }) }),
  exactSearch: (q: string, k = 12) => request<Record<string, unknown>>(`/api/organism/integration/search?q=${encodeURIComponent(q)}&k=${Math.max(1, Math.min(24, k))}`),
  exportPma: () => request<Record<string, unknown>>("/api/organism/integration/pma"),
  validatePma: (pma: unknown) => request<Record<string, unknown>>("/api/organism/integration/pma/validate", { method: "POST", body: JSON.stringify({ pma }) }),
  idempotency: (payload: unknown) => request<Record<string, unknown>>("/api/organism/integration/idempotency", { method: "POST", body: JSON.stringify({ payload }) }),
  integrationTransport: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/transport", { method: "POST", body: JSON.stringify(payload) }),
  integrationReplay: (limit = 16) => request<Record<string, unknown>>("/api/organism/integration/transport/replay", { method: "POST", body: JSON.stringify({ limit }) }),
  integrationIntegrity: () => request<Record<string, unknown>>("/api/organism/integration/integrity"),
  hexis: () => request<Record<string, unknown>>("/api/organism/integration/hexis"),
  conscio: () => request<Record<string, unknown>>("/api/organism/integration/conscio"),
  conscioSyncMemory: (limit=512) => request<Record<string, unknown>>("/api/organism/integration/conscio/sync-memory", { method: "POST", body: JSON.stringify({ limit }) }),
  conscioSearch: (q: string, k=12) => request<Record<string, unknown>>(`/api/organism/integration/conscio/search?q=${encodeURIComponent(q)}&k=${Math.max(1, Math.min(32, k))}`),
  conscioSourceBoundary: (path: string, requestedState="canonical") => request<Record<string, unknown>>("/api/organism/integration/conscio/source-boundary", { method: "POST", body: JSON.stringify({ path, requestedState }) }),
  conscioSkills: () => request<Record<string, unknown>>("/api/organism/integration/conscio/skills"),
  conscioPublishSkill: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/conscio/skills/publish", { method: "POST", body: JSON.stringify(payload) }),
  conscioTrialSkill: (skillId: string, ok: boolean, evidence: string) => request<Record<string, unknown>>("/api/organism/integration/conscio/skills/trial", { method: "POST", body: JSON.stringify({ skillId, ok, evidence }) }),
  conscioReviewSkill: (skillId: string, decision: "approve"|"reject", reason="") => request<Record<string, unknown>>("/api/organism/integration/conscio/skills/review", { method: "POST", body: JSON.stringify({ skillId, decision, reason }) }),
  conscioPeers: () => request<Record<string, unknown>>("/api/organism/integration/conscio/peers"),
  conscioPairPeer: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/conscio/peers/pair", { method: "POST", body: JSON.stringify(payload) }),
  conscioDecidePeer: (id: string, decision: "trust"|"revoke") => request<Record<string, unknown>>("/api/organism/integration/conscio/peers/decide", { method: "POST", body: JSON.stringify({ id, decision }) }),
  conscioPeerMessage: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/conscio/peers/message", { method: "POST", body: JSON.stringify(payload) }),
  conscioPeerAck: (id: string, accepted=true) => request<Record<string, unknown>>("/api/organism/integration/conscio/peers/ack", { method: "POST", body: JSON.stringify({ id, accepted }) }),
  conscioCalibration: (key?: string) => request<Record<string, unknown>>(`/api/organism/integration/conscio/calibration${key ? `?key=${encodeURIComponent(key)}` : ""}`),
  conscioCalibrationObserve: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/conscio/calibration/observe", { method: "POST", body: JSON.stringify(payload) }),
  conscioClaims: () => request<Record<string, unknown>>("/api/organism/integration/conscio/claims"),
  conscioRecordClaim: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/conscio/claims", { method: "POST", body: JSON.stringify(payload) }),
  conscioMetabolic: (used=0, window=16384) => request<Record<string, unknown>>(`/api/organism/integration/conscio/metabolic?used=${encodeURIComponent(used)}&window=${encodeURIComponent(window)}`),
  lettaGovernance: () => request<Record<string, unknown>>("/api/organism/integration/letta"),
  lettaSourceBoundary: (name: string, requestedState = "canonical") => request<Record<string, unknown>>("/api/organism/integration/letta/source-boundary", { method: "POST", body: JSON.stringify({ name, requestedState }) }),
  lettaTelemetryPolicy: () => request<Record<string, unknown>>("/api/organism/integration/letta/telemetry"),
  lettaSetTelemetryPolicy: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/letta/telemetry", { method: "POST", body: JSON.stringify(payload) }),
  lettaArtifactReview: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/letta/review", { method: "POST", body: JSON.stringify(payload) }),
  lettaArtifactDecide: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/letta/review/decide", { method: "POST", body: JSON.stringify(payload) }),
  hexisSyncMemory: (limit=96) => request<Record<string, unknown>>("/api/organism/integration/hexis/sync-memory", { method: "POST", body: JSON.stringify({ limit }) }),
  hexisMemories: (limit=64) => request<Record<string, unknown>>(`/api/organism/integration/hexis/memories?limit=${Math.max(1, Math.min(128, limit))}`),
  hexisReviseBelief: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/hexis/belief/revise", { method: "POST", body: JSON.stringify(payload) }),
  hexisTemporalAt: (memoryId: string, at: number) => request<Record<string, unknown>>(`/api/organism/integration/hexis/temporal?memoryId=${encodeURIComponent(memoryId)}&at=${encodeURIComponent(at)}`),
  hexisTemporalDiff: (memoryId: string, from: number, to: number) => request<Record<string, unknown>>(`/api/organism/integration/hexis/temporal/diff?memoryId=${encodeURIComponent(memoryId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  hexisReviews: () => request<Record<string, unknown>>("/api/organism/integration/hexis/reviews"),
  hexisCreateReview: () => request<Record<string, unknown>>("/api/organism/integration/hexis/reviews/create", { method: "POST", body: "{}" }),
  hexisDecideReview: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/hexis/reviews/decide", { method: "POST", body: JSON.stringify(payload) }),
  hexisRetentionPropose: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/hexis/retention/propose", { method: "POST", body: JSON.stringify(payload) }),
  hexisRetentionApply: (proposalId: string, confirmed=false) => request<Record<string, unknown>>("/api/organism/integration/hexis/retention/apply", { method: "POST", body: JSON.stringify({ proposalId, confirmed }) }),
  hexisHmxExport: () => request<Record<string, unknown>>("/api/organism/integration/hexis/hmx/export"),
  hexisHmxStage: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/hexis/hmx/stage", { method: "POST", body: JSON.stringify(payload) }),
  hexisHmxDecide: (stagingId: string, decision: "accept"|"reject") => request<Record<string, unknown>>("/api/organism/integration/hexis/hmx/decide", { method: "POST", body: JSON.stringify({ stagingId, decision }) }),
  hexisOutbox: () => request<Record<string, unknown>>("/api/organism/integration/hexis/outbox"),
  hexisOutboxEnqueue: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/hexis/outbox/enqueue", { method: "POST", body: JSON.stringify(payload) }),
  hexisOutboxClaim: (id: string) => request<Record<string, unknown>>("/api/organism/integration/hexis/outbox/claim", { method: "POST", body: JSON.stringify({ id }) }),
  hexisOutboxAck: (id: string, published=true, error?: string) => request<Record<string, unknown>>("/api/organism/integration/hexis/outbox/ack", { method: "POST", body: JSON.stringify({ id, published, error }) }),
  hexisOutboxReclaim: (maxAgeMs=60000) => request<Record<string, unknown>>("/api/organism/integration/hexis/outbox/reclaim", { method: "POST", body: JSON.stringify({ maxAgeMs }) }),
  hexisPolicyGrant: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/hexis/policy", { method: "POST", body: JSON.stringify(payload) }),
  hexisPolicyEvaluate: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/hexis/policy/evaluate", { method: "POST", body: JSON.stringify(payload) }),
  hexisPolicyRevoke: (id: string) => request<Record<string, unknown>>("/api/organism/integration/hexis/policy/revoke", { method: "POST", body: JSON.stringify({ id }) }),
  hexisExecutionPlan: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/hexis/execution-plan", { method: "POST", body: JSON.stringify(payload) }),
  hexisRemotePeerStatus: () => request<Record<string, unknown>>("/api/organism/integration/hexis/peer/status"),
  hexisRemotePeerConsult: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/api/organism/integration/hexis/peer/consult", { method: "POST", body: JSON.stringify(payload) }),
  voiceSpeak: (text: string, approvalId?: string) => request<Record<string, unknown>>("/api/organism/voice/speak", { method: "POST", body: JSON.stringify({ text, ...(approvalId ? { approvalId } : {}) }) }),
  voiceListen: (approvalId?: string) => request<Record<string, unknown>>("/api/organism/voice/listen", { method: "POST", body: JSON.stringify({ ...(approvalId ? { approvalId } : {}) }) }),
  voiceTurn: (speak = true, deliberate = true, approvalId?: string) => request<Record<string, unknown>>("/api/organism/voice/turn", { method: "POST", body: JSON.stringify({ speak, deliberate, ...(approvalId ? { approvalId } : {}) }) }),
  status: () => request<Record<string, unknown>>("/api/organism/status"),
  inspect: () => request<Record<string, unknown>>("/api/organism/inspect"),
  systemGraph: () => request<Record<string, unknown>>("/api/organism/system-graph"),
  cognitiveArchitecture: () => request<Record<string, unknown>>("/api/organism/cognitive-architecture"),
  subsystems: () => request<Record<string, unknown>>("/api/organism/subsystems"),
  session: () => request<Record<string, unknown>>("/api/organism/session"),
  time: () => request<Record<string, unknown>>("/api/organism/time"),
  resilience: () => request<Record<string, unknown>>("/api/organism/resilience"),
  // Sensorium is owned by the canonical organism runtime, not a separate API service.
  cognitionPlan: () => request<Record<string, unknown>>("/api/organism/cognition-plan"),
  perception: () => request<Record<string, unknown>>("/api/organism/perception"),
  semanticIntelligence: () => request<Record<string, unknown>>("/api/organism/semantic-intelligence"),
  semanticPerception: () => request<Record<string, unknown>>("/api/organism/semantic-perception"),
  semanticWorld: () => request<Record<string, unknown>>("/api/organism/semantic-world"),
  neuralWorld: () => request<Record<string, unknown>>("/api/organism/neural-world"),
  neuralSpine: () => request<Record<string, unknown>>("/api/organism/neural-spine"),
  worldGrounding: () => request<Record<string, unknown>>("/api/organism/world-grounding"),
  worldIdentity: () => request<Record<string, unknown>>("/api/organism/world-identity"),
  temporalPerception: () => request<Record<string, unknown>>("/api/organism/temporal-perception"),
  memoryInspector: (options: MemoryInspectorOptions = {}) => request<Record<string, unknown>>(`/api/organism/memory-inspector${memoryInspectorSearch(options)}`),
  learning: () => request<Record<string, unknown>>("/api/organism/learning"),
  trueLearning: () => request<Record<string, unknown>>("/api/organism/true-learning"),
  skills: () => request<Record<string, unknown>>("/api/organism/skills"),
  continualIntelligence: () => request<Record<string, unknown>>("/api/organism/continual-intelligence"),
  personalCurriculum: () => request<Record<string, unknown>>("/api/organism/personal-curriculum"),
  personalWorldline: () => request<Record<string, unknown>>("/api/organism/personal-worldline"),
  subjectContinuity: () => request<Record<string, unknown>>("/api/organism/subject-continuity"),
  personhood: () => request<Record<string, unknown>>("/api/organism/personhood"),
  socialMind: () => request<Record<string, unknown>>("/api/organism/social-mind"),
  developmentalSelf: () => request<Record<string, unknown>>("/api/organism/developmental-self"),
  developmentalSynthesis: () => request<Record<string, unknown>>("/api/organism/developmental-synthesis"),
  developmentalExecutive: () => request<Record<string, unknown>>("/api/organism/developmental-executive"),
  life: () => request<Record<string, unknown>>("/api/organism/life"),
  lifeTrajectory: () => request<Record<string, unknown>>("/api/organism/life-trajectory"),
  scientificDevelopment: () => request<Record<string, unknown>>("/api/organism/scientific-development"),
  researchGradeOrganism: () => request<Record<string, unknown>>("/api/organism/research-grade-organism"),
  projectsActive: () => request<Record<string, unknown>>("/api/organism/projects/active"),
  autonomousCognitiveLife: () => request<Record<string, unknown>>("/api/organism/autonomous-cognitive-life"),
  persistentReality: () => request<Record<string, unknown>>("/api/organism/persistent-reality"),
  cognitiveContinuity: () => request<Record<string, unknown>>("/api/organism/cognitive-organism-continuity"),
  experienceContinuum: () => request<Record<string, unknown>>("/api/organism/experience-continuum"),
  consciousness: () => request<Record<string, unknown>>("/api/organism/consciousness"),

  voiceStatus: () => request<Record<string, unknown>>("/api/organism/voice/status"),
  voiceInterrupt: (reason = "operator-ui-stop") => request<Record<string, unknown>>("/api/organism/voice/interrupt", { method: "POST", body: JSON.stringify({ reason }) }),

};
