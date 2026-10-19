import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Clock3, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decideActionApproval, getActionApprovalSnapshot, subscribeActionApprovals, type ActionApprovalCard } from "@/neuro-kurisu/action-approval-broker";
import { neuroApi } from "@/neuro-kurisu/api";


type RemoteApproval = {
  id: string; toolId: string; permissionClass: string; operation: string; status: string;
  createdAt: number; expiresAt: number; reasonCode?: string; inputKeys?: string[]; inputPreview?: Record<string, unknown>;
};

function readRemoteApprovals(value: unknown): RemoteApproval[] {
  if (!value || typeof value !== "object") return [];
  const permissions = (value as Record<string, unknown>).permissions;
  if (!permissions || typeof permissions !== "object") return [];
  const requests = (permissions as Record<string, unknown>).requests;
  if (!Array.isArray(requests)) return [];
  return requests.slice(-128).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const toolId = typeof row.toolId === "string" ? row.toolId : "";
    const createdAt = Number(row.createdAt), expiresAt = Number(row.expiresAt);
    if (!id.startsWith("approval-") || id.length > 120 || !toolId || toolId.length > 96 || !Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) return [];
    const preview: Record<string, unknown> = {};
    if (row.inputPreview && typeof row.inputPreview === "object" && !Array.isArray(row.inputPreview)) {
      for (const [key, item] of Object.entries(row.inputPreview as Record<string, unknown>).slice(0, 16)) {
        if (/(secret|password|passwd|token|authorization|credential|cookie|api.?key|private.?key|access.?key|raw.?content|binary|base64|file.?content|document.?body|prompt.?context)/i.test(key)) preview[key.slice(0, 80)] = "[redacted]";
        else if (typeof item === "string") preview[key.slice(0, 80)] = item.replace(/(bearer\s+)[a-z0-9._~+\/-]+=*/ig, "$1[redacted]").replace(/([?&](?:access[_-]?token|refresh[_-]?token|token|key|secret|password|api[_-]?key)=)[^&\s]+/ig, "$1[redacted]").replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig, "[email]").replace(/(?<!\w)\+?\d[\d .()/-]{7,}\d(?!\w)/g, "[phone]").slice(0, 240);
        else if (item === null || typeof item === "number" || typeof item === "boolean") preview[key.slice(0, 80)] = item;
        else if (Array.isArray(item)) preview[key.slice(0, 80)] = `[array: ${item.length} items]`;
        else preview[key.slice(0, 80)] = "[structured value hidden]";
      }
    }
    return [{ id, toolId: toolId.slice(0, 96), permissionClass: String(row.permissionClass ?? "protected-action").slice(0, 48), operation: String(row.operation ?? "direct").slice(0, 32), status: String(row.status ?? "unknown"), createdAt, expiresAt, reasonCode: String(row.reasonCode ?? "explicit approval").slice(0, 120), inputKeys: Array.isArray(row.inputKeys) ? row.inputKeys.filter((key): key is string => typeof key === "string").slice(0, 24).map(key => key.slice(0, 80)) : [], inputPreview: preview }];
  });
}

function pretty(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return "[preview unavailable]"; }
}

function ApprovalItem({ card }: { card: ActionApprovalCard }) {
  const pending = card.stage === "pending";
  const processing = card.stage === "processing";
  const source = card.label || card.requestPath;
  return <article className="rounded-lg border border-amber-500/40 bg-bg p-3 shadow-sm" aria-label={`Approval for ${card.toolId}`}>
    <div className="flex items-start gap-2">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">Approval required</h3>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">{card.stage}</span>
        </div>
        <p className="mt-1 break-words text-xs text-muted">{source}</p>
        <p className="mt-1 break-all font-mono text-[10px] text-subtle">{card.toolId} · {card.permissionClass} · {card.operation}</p>
        <p className="mt-1 text-[11px] text-muted">{card.reasonCode}</p>
        {pending ? <p className="mt-1 flex items-center gap-1 text-[10px] text-muted"><Clock3 className="size-3"/>Expires at {new Date(card.expiresAt).toLocaleTimeString()} · approval authorizes one attempt only</p> : null}
        {card.inputKeys.length > 0 ? <p className="mt-1 break-words text-[10px] text-muted">Bound keys: {card.inputKeys.join(", ")}</p> : null}
        <pre className="mt-2 max-h-32 overflow-auto rounded-md border border-border bg-surface p-2 text-[10px] leading-relaxed text-muted">{pretty(card.inputPreview)}</pre>
        {card.outcome ? <p className="mt-2 text-[11px] text-muted" role="status">{card.outcome}</p> : null}
        {pending ? <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void decideActionApproval(card.id, true)}><CheckCircle2 className="mr-1.5 size-3.5"/>Approve and run once</Button>
          <Button size="sm" variant="secondary" onClick={() => void decideActionApproval(card.id, false)}><XCircle className="mr-1.5 size-3.5"/>Decline</Button>
        </div> : processing ? <p className="mt-2 text-[11px] text-muted" aria-live="polite">Resolving permission and resuming the captured request…</p> : null}
      </div>
    </div>
  </article>;
}

export function ActionApprovalCenter() {
  const cards = useSyncExternalStore(subscribeActionApprovals, getActionApprovalSnapshot, getActionApprovalSnapshot);
  const [remoteApprovals, setRemoteApprovals] = useState<RemoteApproval[]>([]);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [resolvingOrphan, setResolvingOrphan] = useState<string | null>(null);
  const refreshRemoteApprovals = useCallback(async () => {
    try {
      const data = await neuroApi.toolPermissions();
      setRemoteApprovals(readRemoteApprovals(data));
      setRemoteError(null);
    } catch (error) {
      setRemoteError(error instanceof Error ? error.message : "Could not read server-side approval state.");
    }
  }, []);
  useEffect(() => {
    void refreshRemoteApprovals();
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") void refreshRemoteApprovals(); }, 12_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refreshRemoteApprovals(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refreshRemoteApprovals]);
  const active = cards.filter((card) => card.stage === "pending" || card.stage === "processing");
  const activeIds = useMemo(() => new Set(active.map(card => card.id)), [active]);
  const now = Date.now();
  // Server-side pending tickets without a same-tab continuation are never auto-approved
  // or replayed. Only show them after a grace interval to avoid a race while a fresh
  // 403 challenge is being handed from fetch() to the local continuation broker.
  const orphans = remoteApprovals.filter(row => row.status === "pending" && !activeIds.has(row.id) && row.createdAt <= now - 2_500 && row.expiresAt > now).slice().reverse().slice(0, 8);
  const cancelOrphan = async (id: string) => {
    setResolvingOrphan(id);
    try {
      const result = await neuroApi.resolveToolPermission(id, false) as { ok?: boolean };
      if (result?.ok !== true) throw new Error("The stale permission was not declined; refresh the queue and inspect its current status.");
      setRemoteApprovals(rows => rows.map(row => row.id === id ? { ...row, status: "declined" } : row));
      setRemoteError(null);
    } catch (error) { setRemoteError(error instanceof Error ? error.message : "Unable to decline stale permission."); }
    finally { setResolvingOrphan(null); void refreshRemoteApprovals(); }
  };
  if (active.length === 0 && orphans.length === 0 && !remoteError) return null;
  return <aside className="fixed bottom-3 right-3 z-[100] flex max-h-[78dvh] w-[min(30rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-surface/95 p-2 shadow-2xl backdrop-blur-md" aria-label="Action approval center" aria-live="polite">
    <div className="flex items-center justify-between px-1 py-1">
      <div><p className="text-xs font-semibold text-fg">Action approval center</p><p className="text-[10px] text-muted">Captured request stays in this tab only.</p></div>
      <span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted">{active.length + orphans.length} shown</span>
    </div>
    {remoteError ? <div className="rounded-md border border-rose-500/30 p-2 text-[11px] text-muted" role="status">Approval-state refresh failed: {remoteError}<Button size="sm" variant="secondary" className="ml-2" onClick={() => void refreshRemoteApprovals()}>Retry</Button></div> : null}
    {orphans.length > 0 ? <section className="rounded-lg border border-sky-500/30 bg-bg p-3" aria-label="Unclaimed server approvals">
      <h3 className="text-xs font-semibold text-fg">Unclaimed approvals from another or previous tab</h3>
      <p className="mt-1 text-[10px] leading-relaxed text-muted">The original request body was deliberately not saved. These tickets cannot resume an action here. Declining only revokes a still-pending permission; nothing will be executed by this panel.</p>
      <div className="mt-2 grid gap-2">{orphans.map(row => <article key={row.id} className="rounded-md border border-border p-2">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-all text-xs font-medium text-fg">{row.toolId}</p><p className="mt-1 text-[10px] text-muted">{row.permissionClass} · {row.operation} · {row.reasonCode}</p><p className="mt-1 break-all font-mono text-[9px] text-subtle">{row.id}</p></div><span className="shrink-0 rounded border border-border px-2 py-0.5 text-[9px] text-muted">orphaned</span></div>
        {row.inputKeys?.length ? <p className="mt-1 text-[9px] text-muted">Bound fields: {row.inputKeys.join(", ")}</p> : null}
        {row.inputPreview && Object.keys(row.inputPreview).length ? <details className="mt-1"><summary className="cursor-pointer text-[10px] text-muted">Safe action preview</summary><pre className="mt-1 max-h-24 overflow-auto rounded border border-border bg-surface p-2 text-[9px] text-muted">{pretty(row.inputPreview)}</pre></details> : null}
        <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[9px] text-muted">Expires {new Date(row.expiresAt).toLocaleTimeString()}</span><Button size="sm" variant="secondary" disabled={resolvingOrphan !== null} onClick={() => void cancelOrphan(row.id)}>{resolvingOrphan === row.id ? "Declining…" : "Decline stale ticket"}</Button></div>
      </article>)}</div>
    </section> : null}
    {active.map((card) => <ApprovalItem key={card.id} card={card}/ >)}
  </aside>;
}
