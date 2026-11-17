import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, ClipboardList, Pencil, Plus, RefreshCw, Save, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  neuroApi,
  type DyadicCollaborationItem,
  type DyadicCollaborationKind,
  type DyadicCollaborationMutation,
  type DyadicCollaborationSnapshot,
  type DyadicTaskProgress,
} from "@/neuro-kurisu/api";

const kindOptions: Array<{ value: DyadicCollaborationKind; label: string }> = [
  { value: "goal", label: "Goal" },
  { value: "task", label: "Task" },
  { value: "agreement", label: "Agreement" },
  { value: "question", label: "Question" },
  { value: "success-criteria", label: "Success criteria" },
  { value: "decision", label: "Decision" },
];

const progressLabel: Record<DyadicTaskProgress, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
};

const labelKind = (kind: DyadicCollaborationKind) =>
  kind === "success-criteria" ? "Success criteria" : kind.charAt(0).toUpperCase() + kind.slice(1);

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "dyadic-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

export function DyadicCollaborationPanel() {
  const [snapshot, setSnapshot] = useState<DyadicCollaborationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<DyadicCollaborationKind>("task");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [completionId, setCompletionId] = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      setSnapshot(await neuroApi.dyadicCollaboration());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = useMemo(
    () => [...(snapshot?.items ?? [])].sort((a, b) => b.updatedAtTick - a.updatedAtTick),
    [snapshot?.items],
  );

  const mutate = useCallback(async (payload: DyadicCollaborationMutation): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await neuroApi.dyadicCollaborationMutation(payload, newIdempotencyKey());
      setNotice(result.replayed ? "The previous request was recovered; no duplicate was created." : "Saved to the shared workspace.");
      await refresh(false);
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, refresh]);

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || !confirmed || busy) return;
    const ok = await mutate({
      action: "record",
      kind,
      title: cleanTitle,
      ...(detail.trim() ? { detail: detail.trim() } : {}),
      confirmed: true,
    });
    if (ok) {
      setTitle("");
      setDetail("");
      setConfirmed(false);
    }
  };

  const startEdit = (item: DyadicCollaborationItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDetail(item.detail);
  };

  const saveEdit = async (itemId: string) => {
    if (!editTitle.trim() || busy) return;
    const ok = await mutate({
      action: "correct",
      itemId,
      title: editTitle.trim(),
      detail: editDetail.trim(),
      confirmed: true,
    });
    if (ok) setEditingId(null);
  };

  const updateProgress = (item: DyadicCollaborationItem, progress: DyadicTaskProgress) => {
    void mutate({ action: "progress", itemId: item.id, progress, confirmed: true });
  };

  return (
    <section className="rounded-xl border border-border bg-surface">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-fg">
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base text-fg">Shared workspace · Dyadic Mind</h2>
              <p className="text-xs text-muted">
                {snapshot
                  ? snapshot.summary.accepted + " accepted · " + snapshot.summary.proposals + " awaiting approval · " + snapshot.summary.tasksCompleted + " tasks completed"
                  : "Human and NK1 coordination"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-subtle sm:inline">Open workspace</span>
            <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
          </div>
        </summary>

        <div className="space-y-4 border-t border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-elevated px-2 py-1 text-fg">Accepted: {snapshot?.summary.accepted ?? "—"}</span>
              <span className="rounded-md bg-elevated px-2 py-1 text-fg">Proposals: {snapshot?.summary.proposals ?? "—"}</span>
              <span className="rounded-md bg-elevated px-2 py-1 text-fg">In progress: {snapshot?.summary.tasksInProgress ?? "—"}</span>
              <span className="rounded-md bg-elevated px-2 py-1 text-fg">Completed: {snapshot?.summary.tasksCompleted ?? "—"}</span>
            </div>
            <Button type="button" size="sm" variant="outline" disabled={loading || busy} onClick={() => void refresh()}>
              <RefreshCw className={"size-3.5 " + (loading ? "animate-spin" : "")} />
              Refresh
            </Button>
          </div>

          {error ? <p role="alert" className="rounded-md border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-fg">{error}</p> : null}
          {notice ? <p role="status" className="rounded-md border border-border bg-elevated px-3 py-2 text-sm text-muted">{notice}</p> : null}

          <form onSubmit={(event) => void createItem(event)} className="grid gap-3 rounded-lg border border-border bg-bg p-3 md:grid-cols-[180px_minmax(0,1fr)]">
            <label className="space-y-1 text-xs text-muted">
              <span>Shared item type</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as DyadicCollaborationKind)} className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg">
                {kindOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted">
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="What should we work on together?" className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-subtle" />
            </label>
            <label className="space-y-1 text-xs text-muted md:col-span-2">
              <span>Details (optional)</span>
              <textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={600} rows={2} placeholder="Context, expected outcome or constraints" className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-subtle" />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
              <label className="flex items-start gap-2 text-xs text-muted">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 accent-current" />
                <span>I confirm adding this item to the shared workspace.</span>
              </label>
              <Button type="submit" size="sm" disabled={busy || !confirmed || !title.trim()}>
                <Plus className="size-3.5" />
                Add shared item
              </Button>
            </div>
          </form>

          {loading && !snapshot ? <p className="py-4 text-sm text-muted">Loading shared workspace…</p> : null}
          {!loading && !error && items.length === 0 ? <p className="py-5 text-center text-sm text-muted">No shared items yet. Add a goal, task or agreement above.</p> : null}

          <div className="grid gap-3 lg:grid-cols-2">
            {items.map(item => (
              <article key={item.id} className="min-w-0 rounded-lg border border-border bg-bg p-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span className="rounded bg-elevated px-2 py-1">{labelKind(item.kind)}</span>
                  <span className="rounded bg-elevated px-2 py-1">{item.status === "proposed" ? "Awaiting approval" : item.status}</span>
                  <span>by {item.author}</span>
                </div>
                {editingId === item.id ? (
                  <div className="mt-3 space-y-2">
                    <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={160} className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg" />
                    <textarea value={editDetail} onChange={(event) => setEditDetail(event.target.value)} maxLength={600} rows={2} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg" />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy || !editTitle.trim()} onClick={() => void saveEdit(item.id)}><Save className="size-3.5" /> Save correction</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditingId(null)}><X className="size-3.5" /> Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="mt-2 break-words text-sm font-semibold text-fg">{item.title}</h3>
                    {item.detail ? <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">{item.detail}</p> : null}
                    {item.kind === "task" && item.progress ? <p className="mt-2 text-xs text-muted">Progress: <span className="font-medium text-fg">{progressLabel[item.progress]}</span></p> : null}
                    <p className="mt-2 text-[10px] text-subtle">Updated by {item.updatedBy} · tick {item.updatedAtTick}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.status === "proposed" ? (
                        <>
                          <Button size="sm" disabled={busy} onClick={() => void mutate({ action: "confirm", itemId: item.id, confirmed: true })}><Check className="size-3.5" /> Accept proposal</Button>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void mutate({ action: "reject", itemId: item.id, confirmed: true })}><X className="size-3.5" /> Reject</Button>
                        </>
                      ) : null}
                      {item.status === "accepted" ? (
                        <>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(item)}><Pencil className="size-3.5" /> Edit</Button>
                          {item.kind === "task" && item.progress === "not-started" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => updateProgress(item, "in-progress")}>Start</Button> : null}
                          {item.kind === "task" && item.progress === "in-progress" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => updateProgress(item, "blocked")}>Block</Button> : null}
                          {item.kind === "task" && item.progress === "blocked" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => updateProgress(item, "in-progress")}>Resume</Button> : null}
                          {item.kind === "task" && item.progress && item.progress !== "completed" ? (
                            completionId === item.id ? (
                              <>
                                <Button size="sm" disabled={busy} onClick={() => { void updateProgress(item, "completed"); setCompletionId(null); }}><Check className="size-3.5" /> Confirm completion</Button>
                                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCompletionId(null)}>Cancel</Button>
                              </>
                            ) : <Button size="sm" variant="outline" disabled={busy} onClick={() => setCompletionId(item.id)}>Mark complete</Button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>

          <div className="flex items-start gap-2 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>Human and NK1 personal states remain separate. System proposals need human approval. Shared notes are context, not autonomous tool permission; existing action approval gates still apply.</p>
          </div>
        </div>
      </details>
    </section>
  );
}
