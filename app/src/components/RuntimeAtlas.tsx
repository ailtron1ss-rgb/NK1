import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, Database, Eye, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { neuroApi } from "@/neuro-kurisu/api";
import { BrainArchitecturePanel } from "@/components/BrainArchitecturePanel";

const SURFACES = [
  { group: "Runtime", routes: [
    ["Status", "/api/organism/status", "status"],
    ["Status lite", "/api/organism/status-lite", "statusLite"],
    ["Inspect", "/api/organism/inspect", "inspect"],
    ["System graph", "/api/organism/system-graph", "systemGraph"],
    ["Brain architecture", "/api/organism/cognitive-architecture", "cognitiveArchitecture"],
    ["Subsystems", "/api/organism/subsystems", "subsystems"],
    ["Session", "/api/organism/session", "session"],
    ["Time / continuity", "/api/organism/time", "time"],
    ["Resilience", "/api/organism/resilience", "resilience"],
    ["Action recovery", "/api/organism/action-recovery", "actionRecovery"],
    ["Sensorium", "/api/organism/sensorium/status", "sensorium"],
    ["Known entity dossiers", "/api/organism/known-entities", "knownEntityDossiers"],
  ]},
  { group: "Cognition / world", routes: [
    ["Cognition plan", "/api/organism/cognition-plan", "cognitionPlan"],
    ["Perception", "/api/organism/perception", "perception"],
    ["Semantic intelligence", "/api/organism/semantic-intelligence", "semanticIntelligence"],
    ["Semantic perception", "/api/organism/semantic-perception", "semanticPerception"],
    ["Semantic world", "/api/organism/semantic-world", "semanticWorld"],
    ["Neural world", "/api/organism/neural-world", "neuralWorld"],
    ["Neural spine", "/api/organism/neural-spine", "neuralSpine"],
    ["World grounding", "/api/organism/world-grounding", "worldGrounding"],
    ["World identity", "/api/organism/world-identity", "worldIdentity"],
    ["Temporal perception", "/api/organism/temporal-perception", "temporalPerception"],
  ]},
  { group: "Memory / learning", routes: [
    ["Memory inspector", "/api/organism/memory-inspector", "memoryInspector"],
    ["Adaptive memory strategy", "/api/organism/memory-strategy", "memoryStrategyDiagnostics"],
    ["Language context budget", "/api/organism/context-budget", "contextBudgetDiagnostics"],
    ["Learning", "/api/organism/learning", "learning"],
    ["True learning", "/api/organism/true-learning", "trueLearning"],
    ["Skills", "/api/organism/skills", "skills"],
    ["Continual intelligence", "/api/organism/continual-intelligence", "continualIntelligence"],
    ["Personal curriculum", "/api/organism/personal-curriculum", "personalCurriculum"],
    ["Personal worldline", "/api/organism/personal-worldline", "personalWorldline"],
  ]},
  { group: "Identity / social / developmental", routes: [
    ["Subject continuity", "/api/organism/subject-continuity", "subjectContinuity"],
    ["Portable subject fidelity", "/api/organism/subject-fidelity", "portableSubjectFidelity"],
    ["Personhood", "/api/organism/personhood", "personhood"],
    ["Social mind", "/api/organism/social-mind", "socialMind"],
    ["Developmental self", "/api/organism/developmental-self", "developmentalSelf"],
    ["Developmental synthesis", "/api/organism/developmental-synthesis", "developmentalSynthesis"],
    ["Developmental executive", "/api/organism/developmental-executive", "developmentalExecutive"],
    ["Life", "/api/organism/life", "life"],
    ["Life trajectory", "/api/organism/life-trajectory", "lifeTrajectory"],
  ]},
  { group: "Governance / provenance", routes: [
    ["Letta governance", "/api/organism/integration/letta", "lettaGovernance"],
    ["Letta telemetry", "/api/organism/integration/letta/telemetry", "lettaTelemetryPolicy"],
  ]},
  { group: "Research / projects", routes: [
    ["Scientific development", "/api/organism/scientific-development", "scientificDevelopment"],
    ["Research-grade organism", "/api/organism/research-grade-organism", "researchGradeOrganism"],
    ["Projects", "/api/organism/projects/active", "projectsActive"],
    ["Autonomous cognitive life", "/api/organism/autonomous-cognitive-life", "autonomousCognitiveLife"],
    ["Persistent reality", "/api/organism/persistent-reality", "persistentReality"],
    ["Cognitive organism continuity", "/api/organism/cognitive-organism-continuity", "cognitiveContinuity"],
    ["Experience continuum", "/api/organism/experience-continuum", "experienceContinuum"],
    ["Consciousness diagnostics", "/api/organism/consciousness", "consciousness"],
  ]},
] as const;

type SurfaceKey = typeof SURFACES[number]["routes"][number][2];
type MemoryTemporalMode = "current" | "at" | "all";
type ActionApproval = { id:string; toolId:string; permissionClass:string; operation:string; status:string; createdAt:number; expiresAt:number; resolvedAt?:number; consumedAt?:number; reasonCode?:string; inputKeys?:string[]; inputPreview?:Record<string,unknown>; decisionId?:string; autonomous?:boolean; requestHashPrefix?:string };
type PermissionOverview = { requests:ActionApproval[]; created:number; approved:number; declined:number; consumed:number; expired:number; pending:number; lastChangeAt:number };
type ActionRecoveryEntry = { executionId:string|null; toolId:string; decisionId:string|null; ledgerStatus:string; status:string; recordedAt:number; ageMs:number; reconciliationSupported:boolean; registeredTool:boolean; nextAction:string; reasonCode:string };
type ActionRecoveryOverview = { version:number; generatedAt:number; unresolvedCount:number; returnedCount:number; entries:ActionRecoveryEntry[]; redacted:boolean; readOnly:boolean };

type ProjectExecutionStep = {
  id: string; action: string; preferredTool: string | null; purpose: string; status: string;
  attempts: number; successes: number; qualifyingAttempts: number; minAttemptsBeforePromotion: number;
  requiredEvidence01: number; failureAttempts: number; maxAttempts: number; retryAfterTick: number | null;
  lastFailureReason: string | null; dependsOn: string[]; requiresExternalResearch: boolean; requiresResearchPromotion: boolean;
};
type ProjectExecution = {
  projectId: string | null; tick: number; progress01: number; completedSteps: number; totalSteps: number;
  validatedSteps: number; executionScore01: number; skillPromotionCandidate01: number;
  toolCalls: number; toolSuccesses: number; blockedCycles: number; steps: ProjectExecutionStep[];
};

function ProjectExecutionPanel({ execution }: { execution: ProjectExecution }) {
  const statusLabel: Record<string, string> = {
    completed: "Completed", current: "Current step", blocked: "Blocked", "waiting-dependency": "Waiting for dependency",
    "waiting-retry": "Backoff", queued: "Queued",
  };
  const percent = Math.round(Math.max(0, Math.min(1, execution.progress01 || 0)) * 100);
  return <section className="mt-3 rounded-md border border-border p-3" aria-label="Autonomous project execution progress">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold text-fg">Project execution</p><p className="mt-1 text-[10px] text-muted">Verified plan progress and evidence gates</p></div>
      <p className="text-sm font-semibold tabular-nums text-fg">{percent}% · {execution.completedSteps}/{execution.totalSteps} steps</p>
    </div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg" role="progressbar" aria-label="Project plan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-md border border-border p-2"><p className="text-[10px] text-muted">Validated steps</p><p className="mt-1 text-sm font-medium text-fg">{execution.validatedSteps}</p></div>
      <div className="rounded-md border border-border p-2"><p className="text-[10px] text-muted">Tool success rate</p><p className="mt-1 text-sm font-medium text-fg">{execution.toolCalls ? Math.round(execution.toolSuccesses / execution.toolCalls * 100) : 0}%</p></div>
      <div className="rounded-md border border-border p-2"><p className="text-[10px] text-muted">Execution score</p><p className="mt-1 text-sm font-medium text-fg">{Math.round((execution.executionScore01 || 0) * 100)}%</p></div>
      <div className="rounded-md border border-border p-2"><p className="text-[10px] text-muted">Blocked cycles</p><p className="mt-1 text-sm font-medium text-fg">{execution.blockedCycles}</p></div>
    </div>
    <div className="mt-3 grid gap-2">
      {execution.steps.map((step) => <article key={step.id} className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><p className="text-xs font-medium text-fg">{step.id} <span className="font-normal text-muted">· {step.action}</span></p><p className="mt-1 text-xs text-muted">{step.purpose}</p></div>
          <span className="rounded-full border border-border px-2 py-1 text-[10px] text-fg">{statusLabel[step.status] ?? step.status}</span>
        </div>
        <div className="mt-2 grid gap-1 text-[10px] text-muted sm:grid-cols-3">
          <p>Qualifying attempts: <span className="text-fg">{step.qualifyingAttempts}/{step.minAttemptsBeforePromotion}</span></p>
          <p>Evidence threshold: <span className="text-fg">{Math.round(step.requiredEvidence01 * 100)}%</span></p>
          <p>Failed evidence attempts: <span className="text-fg">{step.failureAttempts}/{step.maxAttempts}</span></p>
        </div>
        {(step.requiresExternalResearch || step.requiresResearchPromotion) && <p className="mt-2 text-[10px] text-muted">Evidence gates: {step.requiresExternalResearch ? "external source required" : ""}{step.requiresExternalResearch && step.requiresResearchPromotion ? " · " : ""}{step.requiresResearchPromotion ? "research promotion required" : ""}</p>}
        {step.dependsOn.length > 0 && <p className="mt-1 text-[10px] text-muted">Depends on: {step.dependsOn.join(", ")}</p>}
        {step.retryAfterTick !== null && <p className="mt-1 text-[10px] text-muted">Retry after tick {step.retryAfterTick}</p>}
        {step.lastFailureReason && <p className="mt-2 break-words text-[10px] text-muted">Reason: {step.lastFailureReason}</p>}
      </article>)}
    </div>
    <p className="mt-3 text-[10px] leading-relaxed text-muted">A tool acknowledgement is not automatically project progress. Steps advance only when the required tool, evidence threshold, research gates and number of qualifying attempts are satisfied.</p>
  </section>;
}

function toLocalDateTimeValue(timestamp: number): string {
  const date = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export function RuntimeAtlas() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [activeKey, setActiveKey] = useState<SurfaceKey | null>(null);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryLimit, setMemoryLimit] = useState(16);
  const [memoryTemporalMode, setMemoryTemporalMode] = useState<MemoryTemporalMode>("current");
  const [memoryAsOf, setMemoryAsOf] = useState(() => toLocalDateTimeValue(Date.now()));
  const [permissionOverview, setPermissionOverview] = useState<PermissionOverview | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [actionRecovery, setActionRecovery] = useState<ActionRecoveryOverview | null>(null);
  const [actionRecoveryError, setActionRecoveryError] = useState<string | null>(null);
  const routes = useMemo(() => SURFACES.flatMap((group) => group.routes).filter(([, route, key]) =>
    `${route} ${key}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);

  const read = async (label: string, key: SurfaceKey) => {
    setActiveKey(key);
    setBusy(key);
    try {
      const fn = neuroApi[key];
      if (typeof fn !== "function") throw new Error(`Surface ${key} is not wired in the client API`);
      setPayload(key === "memoryInspector" ? await neuroApi.memoryInspector({ limit: memoryLimit, temporalMode: memoryTemporalMode }) : await fn());
    } catch (error) {
      setPayload({ ok: false, error: String(error instanceof Error ? error.message : error) });
    } finally {
      setBusy(null);
    }
  };

  const refreshPermissionQueue = async () => {
    try {
      const response=await neuroApi.toolPermissions() as {permissions?:PermissionOverview};
      setPermissionOverview(response.permissions ?? null);
      setPermissionError(null);
    } catch(error) { setPermissionError(error instanceof Error ? error.message : String(error)); }
  };
  const refreshActionRecovery = async () => {
    try {
      const response=await neuroApi.actionRecovery() as {recovery?:ActionRecoveryOverview};
      setActionRecovery(response.recovery ?? null);
      setActionRecoveryError(null);
    } catch(error) { setActionRecoveryError(error instanceof Error ? error.message : String(error)); }
  };
  useEffect(() => { void refreshPermissionQueue(); void refreshActionRecovery(); }, []);


  const searchMemory = async () => {
    setBusy("memoryInspector");
    setActiveKey("memoryInspector");
    try {
      const options: NonNullable<Parameters<typeof neuroApi.memoryInspector>[0]> = {
        query: memoryQuery,
        limit: memoryLimit,
        temporalMode: memoryTemporalMode,
      };
      if (memoryTemporalMode === "at" && memoryAsOf) {
        const parsed = new Date(memoryAsOf).getTime();
        if (Number.isFinite(parsed)) options.asOfAt = parsed;
      }
      setPayload(await neuroApi.memoryInspector(options));
    } catch (error) {
      setPayload({ ok: false, error: String(error instanceof Error ? error.message : error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-4 rounded-lg border border-border bg-bg p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-subtle"><Activity className="size-4" />Runtime Atlas</span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <>
        <div className="mt-3 flex items-center gap-2">
          <Search className="size-4 text-subtle" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search runtime surface…" className="h-9 flex-1 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
          <span className="text-[10px] text-muted">{routes.length} surfaces</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {routes.map(([label, route, key]) => <button key={key} type="button" disabled={busy !== null} onClick={() => void read(label, key)} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-left hover:bg-bg/60 disabled:opacity-50">
            <span className="min-w-0"><span className="block text-xs text-fg">{label}</span><span className="block truncate text-[10px] text-muted">{route}</span></span>
            {busy === key ? <RefreshCw className="size-4 animate-spin text-subtle" /> : <Eye className="size-4 text-subtle" />}
          </button>)}
        </div>
        <section className="mt-3 rounded-md border border-border p-3" aria-label="Explicit action approval queue">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><ShieldAlert className="size-4 text-subtle"/><div><p className="text-xs font-semibold text-fg">Action permissions</p><p className="text-[10px] text-muted">One-time approval bound to the exact tool and request; expires after five minutes. The Action Approval Center is the only interactive resolver so a ticket cannot be approved in one panel while its continuation is waiting in another.</p></div></div>
            <button type="button" onClick={() => void refreshPermissionQueue()} className="rounded-md border border-border px-2 py-1.5 text-[10px] text-muted hover:text-fg"><RefreshCw className="mr-1 inline size-3"/>Refresh</button>
          </div>
          {permissionError && <p className="mt-2 text-[10px] text-muted" role="status">{permissionError}</p>}
          {permissionOverview && <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[["Pending",permissionOverview.requests.filter(r=>r.status==='pending').length],["Approved",permissionOverview.requests.filter(r=>r.status==='approved').length],["Consumed",permissionOverview.consumed],["Declined",permissionOverview.declined],["Expired",permissionOverview.expired],["Created",permissionOverview.created]].map(([label,value])=><div key={String(label)} className="rounded border border-border p-2"><p className="text-[9px] text-muted">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums text-fg">{value}</p></div>)}
          </div>}
          <div className="mt-3 grid gap-2">
            {(permissionOverview?.requests??[]).slice().reverse().slice(0,10).map(request=> <article key={request.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-all text-xs font-medium text-fg">{request.toolId}</p><p className="mt-1 text-[10px] text-muted">{request.permissionClass} · {request.operation} · {request.reasonCode ?? 'explicit approval'}</p><p className="mt-1 break-all font-mono text-[10px] text-muted">Ticket: {request.id}</p></div><span className="rounded-full border border-border px-2 py-1 text-[10px] text-fg">{request.status}</span></div>
              {request.inputPreview && <details className="mt-2"><summary className="cursor-pointer text-[10px] text-muted">Review exact request summary</summary><pre className="mt-1 overflow-auto rounded border border-border bg-bg p-2 text-[10px] text-muted">{JSON.stringify(request.inputPreview,null,2)}</pre></details>}
              {request.status==='pending' && <p className="mt-2 text-[10px] text-muted">Expires {new Date(request.expiresAt).toLocaleTimeString()}. Resolve live requests in the Action Approval Center; it resumes the exact captured call only while the originating tab remains open. After a reload, let an orphaned ticket expire and submit the action again.</p>}
              {request.status==='approved' && <p className="mt-2 text-[10px] text-muted">Approved but not consumed. The approval center resumes live calls automatically; orphaned approvals expire and must not be reused for a changed request.</p>}
            </article>)}
            {(!permissionOverview || permissionOverview.requests.length===0) && <p className="text-[10px] text-muted">No explicit approval requests are recorded.</p>}
          </div>
        </section>
        <section className="mt-3 rounded-md border border-border p-3" aria-label="Durable action recovery queue">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Database className="size-4 text-subtle"/><div><p className="text-xs font-semibold text-fg">Durable action recovery</p><p className="text-[10px] text-muted">Read-only queue restored from the durable ActionGateway ledger. It never retries side effects. Reconciliation must use the original request identity and the normal approval path.</p></div></div>
            <button type="button" onClick={() => void refreshActionRecovery()} className="rounded-md border border-border px-2 py-1.5 text-[10px] text-muted hover:text-fg"><RefreshCw className="mr-1 inline size-3"/>Refresh</button>
          </div>
          {actionRecoveryError && <p className="mt-2 text-[10px] text-muted" role="status">Recovery queue unavailable: {actionRecoveryError}</p>}
          {actionRecovery && <>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded border border-border p-2"><p className="text-[9px] text-muted">Unresolved</p><p className="mt-1 text-sm font-semibold tabular-nums text-fg">{actionRecovery.unresolvedCount}</p></div>
              <div className="rounded border border-border p-2"><p className="text-[9px] text-muted">Shown</p><p className="mt-1 text-sm font-semibold tabular-nums text-fg">{actionRecovery.returnedCount}</p></div>
              <div className="rounded border border-border p-2"><p className="text-[9px] text-muted">Read-only</p><p className="mt-1 text-sm font-semibold text-fg">{actionRecovery.readOnly ? "Yes" : "Unknown"}</p></div>
              <div className="rounded border border-border p-2"><p className="text-[9px] text-muted">Redacted</p><p className="mt-1 text-sm font-semibold text-fg">{actionRecovery.redacted ? "Yes" : "Unknown"}</p></div>
            </div>
            <div className="mt-3 grid gap-2">
              {actionRecovery.entries.map((entry) => <article key={`${entry.executionId ?? "missing"}:${entry.toolId}`} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-all text-xs font-medium text-fg">{entry.toolId}</p><p className="mt-1 break-all font-mono text-[10px] text-muted">Execution: {entry.executionId ?? "missing id"}</p>{entry.decisionId && <p className="mt-1 break-all font-mono text-[10px] text-muted">Decision: {entry.decisionId}</p>}</div><span className="rounded-full border border-border px-2 py-1 text-[10px] text-fg">{entry.status}</span></div>
                <div className="mt-2 grid gap-1 text-[10px] text-muted sm:grid-cols-3"><p>Recorded: {new Date(entry.recordedAt).toLocaleString()}</p><p>Age: {Math.floor(entry.ageMs / 1000)} seconds</p><p>Provider lookup: {entry.reconciliationSupported ? "available" : "not registered"}</p></div>
                <p className="mt-2 text-[10px] text-muted">Next step: {entry.nextAction.replaceAll("-", " ")}. Diagnostic only; no request body, idempotency key, request fingerprint or provider payload is displayed.</p>
              </article>)}
              {actionRecovery.entries.length===0 && <p className="text-[10px] text-muted">No unresolved durable action receipts.</p>}
              {actionRecovery.unresolvedCount > actionRecovery.returnedCount && <p className="text-[10px] text-muted">Showing the oldest {actionRecovery.returnedCount} of {actionRecovery.unresolvedCount}; use the endpoint's bounded limit for pagination.</p>}
            </div>
          </>}
        </section>
        {activeKey === "memoryInspector" && <form onSubmit={(event) => { event.preventDefault(); void searchMemory(); }} className="mt-3 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(120px,0.7fr)_minmax(130px,0.8fr)_minmax(145px,1fr)_auto]">
          <label className="flex flex-col gap-1 text-[10px] text-muted">Search memory
            <input value={memoryQuery} onChange={(event) => setMemoryQuery(event.target.value)} placeholder="Words, facts, or topic…" required={memoryTemporalMode !== "current"} className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-muted">View
            <select value={memoryTemporalMode} onChange={(event) => setMemoryTemporalMode(event.target.value as MemoryTemporalMode)} className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg">
              <option value="current">Current only</option><option value="at">As of time</option><option value="all">All revisions</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-muted">Records (1–32)
            <input type="number" min={1} max={32} step={1} value={memoryLimit} onChange={(event) => setMemoryLimit(Math.max(1, Math.min(32, Number(event.target.value) || 1)))} className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
          </label>
          {memoryTemporalMode === "at" && <label className="flex flex-col gap-1 text-[10px] text-muted">Point in time
            <input type="datetime-local" value={memoryAsOf} onChange={(event) => setMemoryAsOf(event.target.value)} required className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
          </label>}
          <button type="submit" disabled={busy !== null} className="self-end rounded-md border border-border px-3 py-2 text-xs font-medium text-fg hover:bg-bg/60 disabled:opacity-50">{busy === "memoryInspector" ? "Reading…" : "Inspect memory"}</button>
          <p className="text-[10px] text-muted sm:col-span-2 lg:col-span-full">Inspection is read-only. Temporal modes require a search query; a blank current query shows the recent snapshot. “All revisions” includes expired/superseded versions, while “As of time” reconstructs validity at that timestamp.</p>
        </form>}
        {activeKey === "memoryInspector" && payload && typeof payload === "object" && "embeddingMaintenance" in payload && (() => {
          const d = (payload as { embeddingMaintenance?: { enabled?: boolean; runtimeEnabled?: boolean; provider?: string; model?: string; indexedItems?: number; corpusItems?: number; remaining?: number; waitingForRetry?: number; maintenanceInFlight?: boolean; lastRunAt?: number; lastDurationMs?: number; lastErrorCode?: string | null; redactedInputs?: number } }).embeddingMaintenance;
          if (!d) return null;
          const indexed = Math.max(0, Number(d.indexedItems ?? 0));
          const corpus = Math.max(0, Number(d.corpusItems ?? 0));
          return <section className="mt-3 rounded-md border border-border p-3" aria-label="Semantic memory index maintenance">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-fg">Semantic index maintenance</p><p className="text-[10px] text-muted">Derived vectors are warmed in bounded background batches; canonical memories remain in MemoryOS2 and lexical recall stays available.</p></div><span className="rounded-full border border-border px-2 py-1 text-[10px] text-fg">{d.runtimeEnabled ? (d.maintenanceInFlight ? "Indexing" : d.enabled ? "Enabled" : "Provider unavailable") : "Disabled by policy"}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded border border-border p-2"><p className="text-[9px] text-muted">Indexed</p><p className="mt-1 text-sm font-semibold tabular-nums text-fg">{indexed} / {corpus}</p></div><div className="rounded border border-border p-2"><p className="text-[9px] text-muted">Remaining</p><p className="mt-1 text-sm font-semibold tabular-nums text-fg">{Math.max(0, Number(d.remaining ?? corpus-indexed))}</p></div><div className="rounded border border-border p-2"><p className="text-[9px] text-muted">Retry wait</p><p className="mt-1 text-sm font-semibold tabular-nums text-fg">{Math.max(0, Number(d.waitingForRetry ?? 0))}</p></div><div className="rounded border border-border p-2"><p className="text-[9px] text-muted">Last batch</p><p className="mt-1 text-sm font-semibold tabular-nums text-fg">{d.lastRunAt ? `${Math.max(0, Number(d.lastDurationMs ?? 0))} ms` : "Not run"}</p></div></div>
            <p className="mt-2 break-words text-[10px] text-muted">Provider: {d.enabled ? `${d.provider ?? "local"} · ${d.model ?? "configured model"}` : "none"} · sanitized inputs: {Math.max(0, Number(d.redactedInputs ?? 0))}{d.lastErrorCode ? ` · last issue: ${d.lastErrorCode}` : ""}</p>
          </section>;
        })()}
        {activeKey === "cognitiveArchitecture" && payload && <BrainArchitecturePanel payload={payload} />}
        {activeKey === "projectsActive" && payload && typeof payload === "object" && "execution" in payload && (payload as { execution?: ProjectExecution }).execution && <ProjectExecutionPanel execution={(payload as { execution: ProjectExecution }).execution} />}
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_2fr]">
          <div className="rounded-md border border-border p-3 text-xs text-muted"><Database className="mb-2 size-4" />Read-only surface. Mutating operations remain behind their dedicated governed controls.</div>
          {activeKey === "cognitiveArchitecture" ? <details className="min-w-0 rounded-md border border-border p-3"><summary className="cursor-pointer text-xs font-medium text-fg">Raw architecture payload</summary><pre className="mt-2 max-h-[420px] overflow-auto bg-bg text-[10px] leading-relaxed text-muted">{JSON.stringify(payload, null, 2)}</pre></details> : <pre className="max-h-[420px] overflow-auto rounded-md border border-border bg-bg p-3 text-[10px] leading-relaxed text-muted">{payload ? JSON.stringify(payload, null, 2) : "Select a surface to inspect canonical runtime truth."}</pre>}
        </div>
      </>}
    </section>
  );
}
