import { useEffect, useState } from "react";
import { Archive, Brain, CheckCircle2, Clock3, Download, History, RefreshCw, Send, ShieldCheck, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neuroApi } from "@/neuro-kurisu/api";
import type {
  HexisGoalActivationResponse,
  HexisGoalMaterializeResponse,
  HexisGoalProposal,
  HexisGoalProposalDecisionResponse,
  HexisGoalProposalListResponse,
  HexisGoalProposalPrepareResponse,
  HexisGoalProposalStatus,
  HexisHmxExportResponse,
  HexisHmxStage,
  HexisHmxStageInput,
  HexisHmxStageResponse,
} from "@/neuro-kurisu/types";

const fmt = (value: unknown) => JSON.stringify(value, null, 2);

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-bg p-2"><p className="text-[10px] uppercase tracking-wider text-subtle">{label}</p><p className="mt-1 break-all font-mono text-sm text-fg">{value}</p></div>;
}

export function HexisControlConsole() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState("");
  const [state, setState] = useState<Record<string, unknown> | null>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [memoryId, setMemoryId] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [evidenceTrust, setEvidenceTrust] = useState("0.8");
  const [confidence, setConfidence] = useState("0.5");
  const [stance, setStance] = useState<"supports" | "contradicts">("supports");
  const [context, setContext] = useState("operator-ui");
  const [temporalAt, setTemporalAt] = useState(String(Date.now()));
  const [temporalFrom, setTemporalFrom] = useState("0");
  const [temporalTo, setTemporalTo] = useState(String(Date.now()));
  const [review, setReview] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"approve" | "correct" | "forget">("approve");
  const [correction, setCorrection] = useState("");
  const [retentionAction, setRetentionAction] = useState<"compress" | "archive" | "forget">("archive");
  const [proposalId, setProposalId] = useState("");
  const [retentionConfirmed, setRetentionConfirmed] = useState(false);
  const [outboxKey, setOutboxKey] = useState("");
  const [outboxId, setOutboxId] = useState("");
  const [outboxChannel, setOutboxChannel] = useState("telegram");
  const [policyConnector, setPolicyConnector] = useState("telegram");
  const [policyAction, setPolicyAction] = useState("send");
  const [policyContext, setPolicyContext] = useState("chat");
  const [policyTarget, setPolicyTarget] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [policyMaxPerWindow, setPolicyMaxPerWindow] = useState("10");
  const [policyWindowMs, setPolicyWindowMs] = useState("60000");
  const [confirmed, setConfirmed] = useState(false);
  const [stageId, setStageId] = useState("");
  const [hmxIntent, setHmxIntent] = useState<"port" | "duplicate" | "telepathy" | "analysis">("port");
  const [hmxStrategy, setHmxStrategy] = useState<"additive" | "authoritative" | "deliberative" | "analysis_only">("additive");
  const [hmxConfirmed, setHmxConfirmed] = useState(false);
  const [hmxApplyConfirmed, setHmxApplyConfirmed] = useState(false);
  const [hmxAccepted, setHmxAccepted] = useState(false);
  const [hmxStage, setHmxStage] = useState<HexisHmxStage | null>(null);
  const [goalProposals, setGoalProposals] = useState<HexisGoalProposal[]>([]);
  const [goalProposalId, setGoalProposalId] = useState("");
  const [goalProposalStatus, setGoalProposalStatus] = useState<HexisGoalProposalStatus>("pending");
  const [goalMaterializeConfirmed, setGoalMaterializeConfirmed] = useState(false);
  const [goalActivationConfirmed, setGoalActivationConfirmed] = useState(false);
  const [placement, setPlacement] = useState("local");
  const [executionAction, setExecutionAction] = useState("tool.execute");
  const [risk, setRisk] = useState("0.4");

  const run = async (label: string, operation: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await operation();
      setPanel(fmt(result));
      setMessage(`${label}: OK`);
      try {
        const next = label === "Refresh" && result && typeof result === "object"
          ? result as Record<string, unknown>
          : await neuroApi.hexis();
        setState(next);
        const memoryResult = await neuroApi.hexisMemories(64);
        setMemories(Array.isArray((memoryResult as any)?.memoryIndex) ? (memoryResult as any).memoryIndex : []);
      } catch (refreshError) {
        setMessage(`${label}: OK; panel refresh failed: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
      }
      return result;
    } catch (error) {
      setMessage(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const refresh = () => void run("Refresh", () => neuroApi.hexis());

  useEffect(() => { refresh(); }, []);

  const createReview = async () => {
    const result = await run("Create review", () => neuroApi.hexisCreateReview());
    if (result && typeof result === "object") setReview((result as any).review ?? null);
  };

  const exportHmx = async () => {
    const result = await run("Export HMX", () => neuroApi.hexisHmxExport()) as HexisHmxExportResponse | null;
    const hmxDocument = result?.document;
    if (!hmxDocument || typeof hmxDocument !== "object" || Array.isArray(hmxDocument)) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(hmxDocument, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "neuro-kurisu-hexis-hmx.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const stageCurrentHmx = async () => {
    const staged = await run("Stage HMX", async () => {
      const exported = await neuroApi.hexisHmxExport();
      const hmxDocument = (exported as any)?.document;
      if (!hmxDocument || typeof hmxDocument !== "object" || Array.isArray(hmxDocument)) {
        throw new Error("HMX export returned no JSON document.");
      }
      return neuroApi.hexisHmxStage({ document: hmxDocument, intent: hmxIntent, strategy: hmxStrategy });
    });
    const stage = (staged as HexisHmxStageResponse | null)?.stage ?? null;
    if (stage?.stagingId) {
      setStageId(String(stage.stagingId));
      setHmxStage(stage);
      setHmxAccepted(false);
      setHmxConfirmed(false);
      setHmxApplyConfirmed(false);
    }
  };

  const stageHmxFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      setMessage("Stage imported HMX: files above 8 MiB are rejected before parsing.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setMessage("Stage imported HMX: the selected file is not valid JSON.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setMessage("Stage imported HMX: the document root must be a JSON object.");
      return;
    }
    const requestBody = JSON.stringify({ document: parsed, intent: hmxIntent, strategy: hmxStrategy });
    // The default server body cap is 256,000 bytes; leave room for headers/envelope.
    if (new TextEncoder().encode(requestBody).byteLength > 240_000) {
      setMessage("Stage imported HMX: the request exceeds the conservative 240 KB limit for the current server body cap.");
      return;
    }
    const stageInput: HexisHmxStageInput = {
      document: parsed as Record<string, unknown>, intent: hmxIntent, strategy: hmxStrategy,
    };
    const result = await run("Stage imported HMX", () => neuroApi.hexisHmxStage(stageInput));
    const stage = (result as HexisHmxStageResponse | null)?.stage ?? null;
    if (stage?.stagingId) {
      setStageId(String(stage.stagingId));
      setHmxStage(stage);
      setHmxAccepted(false);
      setHmxConfirmed(false);
      setHmxApplyConfirmed(false);
    }
  };

  const acceptHmx = async () => {
    const result = await run("Accept staged HMX", () => neuroApi.hexisHmxDecide(stageId, "accept", true));
    const stage = (result as HexisHmxStageResponse | null)?.stage ?? null;
    if (stage) {
      setHmxStage(stage);
      setHmxAccepted(stage.status === "accepted");
      setHmxApplyConfirmed(false);
    }
  };

  const rejectHmx = async () => {
    const result = await run("Reject staged HMX", () => neuroApi.hexisHmxDecide(stageId, "reject"));
    const stage = (result as HexisHmxStageResponse | null)?.stage ?? null;
    if (stage) {
      setHmxStage(stage);
      setHmxAccepted(false);
      setHmxApplyConfirmed(false);
    }
  };

  const applyHmx = async () => {
    const result = await run("Apply canonical HMX", () => neuroApi.hexisHmxDecide(stageId, "apply", true));
    const stage = (result as HexisHmxStageResponse | null)?.stage ?? null;
    if (stage) {
      setHmxStage(stage);
      setHmxAccepted(false);
      setHmxApplyConfirmed(false);
    }
  };

  const loadGoalProposals = async (status: HexisGoalProposalStatus = goalProposalStatus) => {
    const result = await run("Load HMX goal proposals", () => neuroApi.hexisGoalProposals(status, 64));
    const rows = (result as HexisGoalProposalListResponse | null)?.proposals ?? [];
    setGoalProposals(rows);
    setGoalProposalId(String(rows[0]?.id ?? ""));
  };

  const prepareGoalProposals = async () => {
    if (!stageId.trim() || hmxStage?.status !== "applied") return;
    const result = await run("Prepare imported goal proposals", () => neuroApi.hexisGoalPrepare(stageId));
    const rows = (result as HexisGoalProposalPrepareResponse | null)?.proposals ?? [];
    setGoalProposals(rows);
    setGoalProposalStatus("pending");
    setGoalProposalId(String(rows[0]?.id ?? ""));
    setGoalMaterializeConfirmed(false);
    setGoalActivationConfirmed(false);
  };

  const decideGoalProposal = async (decision: "approve" | "reject") => {
    if (!goalProposalId) return;
    const result = await run(decision === "approve" ? "Approve HMX goal" : "Reject HMX goal", () =>
      neuroApi.hexisGoalDecide(goalProposalId, decision));
    const proposal = (result as HexisGoalProposalDecisionResponse | null)?.proposal;
    if (proposal?.id) {
      setGoalProposals([proposal]);
      setGoalProposalId(proposal.id);
      setGoalProposalStatus(proposal.status);
      setGoalMaterializeConfirmed(false);
      setGoalActivationConfirmed(false);
    }
  };

  const materializeGoalProposal = async () => {
    if (!goalProposalId || !goalMaterializeConfirmed) return;
    const result = await run("Materialize approved HMX goal", () =>
      neuroApi.hexisGoalMaterialize(goalProposalId, true));
    const proposal = (result as HexisGoalMaterializeResponse | null)?.proposal;
    if (proposal?.id) {
      setGoalProposals([proposal]);
      setGoalProposalId(proposal.id);
      setGoalProposalStatus("materialized");
      setGoalMaterializeConfirmed(false);
      setGoalActivationConfirmed(false);
    }
  };

  const activateGoalProposal = async () => {
    if (!goalProposalId || !goalActivationConfirmed) return;
    const result = await run("Activate approved HMX goal", () =>
      neuroApi.hexisGoalActivate(goalProposalId, true));
    const proposal = (result as HexisGoalActivationResponse | null)?.proposal;
    if (proposal?.id) {
      setGoalProposals([proposal]);
      setGoalProposalId(proposal.id);
      setGoalProposalStatus("materialized");
      setGoalActivationConfirmed(false);
    }
  };

  const selectedGoalProposal = goalProposals.find(proposal => proposal.id === goalProposalId) ?? null;

  const approveFirstReview = async () => {
    const result = await run("Load reviews", () => neuroApi.hexisReviews());
    const reviews = Array.isArray((result as any)?.reviews) ? (result as any).reviews : [];
    const first = reviews.find((item: any) => item.status === "pending" && item.items?.some((row: any) => row.status === "pending"));
    if (first) setReview(first);
  };

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-subtle">Hexis adaptation / epistemic governance</p>
          <h2 className="font-display text-xl text-fg">Memory & Governance Center</h2>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted">Hexis mechanisms are bound to the canonical Neuro-Kurisu memory, persistence and action owners. This surface exposes the same functions through the UI rather than leaving them HTTP-only.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Refresh Hexis state" disabled={busy} onClick={refresh}><RefreshCw className="size-4" /></Button>
      </div>

      <datalist id="hexis-memory-options">{memories.map((memory) => <option key={memory.id} value={memory.id}>{memory.kind} · {String(memory.summary ?? "").slice(0, 100)}</option>)}</datalist>

      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <Stat label="Canonical memories" value={String(memories.length)} />
        <Stat label="Beliefs" value={String((state as any)?.hexis?.counts?.beliefs ?? 0)} />
        <Stat label="Pending reviews" value={String((state as any)?.hexis?.counts?.pendingReviews ?? 0)} />
        <Stat label="Pending outbox" value={String((state as any)?.hexis?.counts?.pendingOutbox ?? 0)} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Panel title="Evidence / belief revision" icon={<Brain className="size-4" />}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={memoryId} onChange={e => setMemoryId(e.target.value)} list="hexis-memory-options" placeholder="Canonical memory id" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <input value={evidenceRef} onChange={e => setEvidenceRef(e.target.value)} placeholder="Evidence reference" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <input value={confidence} onChange={e => setConfidence(e.target.value)} placeholder="Base confidence 0..1" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <input value={evidenceTrust} onChange={e => setEvidenceTrust(e.target.value)} placeholder="Evidence trust 0..1" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <select value={stance} onChange={e => setStance(e.target.value as "supports" | "contradicts")} className="h-10 rounded-md border border-border bg-bg px-2 text-xs text-fg"><option value="supports">supports</option><option value="contradicts">contradicts</option></select>
            <input value={context} onChange={e => setContext(e.target.value)} placeholder="Context" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy || !memoryId.trim() || !evidenceRef.trim()} onClick={() => void run("Revise belief", () => neuroApi.hexisReviseBelief({ memoryId, confidence01: Number(confidence), stance, context, evidence: { ref: evidenceRef, trust01: Number(evidenceTrust) } }))}>Apply evidence</Button>
            <Button variant="outline" disabled={busy} onClick={() => void run("Sync memory", () => neuroApi.hexisSyncMemory(96))}>Sync canonical memory</Button>
          </div>
        </Panel>

        <Panel title="Temporal memory / time travel" icon={<History className="size-4" />}>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={memoryId} onChange={e => setMemoryId(e.target.value)} list="hexis-memory-options" placeholder="Memory id" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <input value={temporalAt} onChange={e => setTemporalAt(e.target.value)} className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <Button disabled={busy || !memoryId} onClick={() => void run("Temporal state", () => neuroApi.hexisTemporalAt(memoryId, Number(temporalAt)))}>At timestamp</Button>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input value={temporalFrom} onChange={e => setTemporalFrom(e.target.value)} placeholder="From" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <input value={temporalTo} onChange={e => setTemporalTo(e.target.value)} placeholder="To" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <Button variant="outline" disabled={busy || !memoryId} onClick={() => void run("Temporal diff", () => neuroApi.hexisTemporalDiff(memoryId, Number(temporalFrom), Number(temporalTo)))}>Diff</Button>
          </div>
        </Panel>

        <Panel title="Learning review" icon={<CheckCircle2 className="size-4" />}>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void createReview()}>Create review</Button>
            <Button variant="outline" disabled={busy} onClick={() => void approveFirstReview()}>Load pending review</Button>
          </div>
          {review?.items?.[0] && (
            <div className="mt-3 rounded-md border border-border bg-bg p-3">
              <p className="text-xs text-fg">{review.items[0].title}</p>
              <p className="mt-1 text-[11px] text-muted">{review.items[0].content}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <select value={reviewDecision} onChange={e => setReviewDecision(e.target.value as any)} className="h-9 rounded-md border border-border bg-bg px-2 text-xs text-fg"><option value="approve">approve</option><option value="correct">correct</option><option value="forget">forget</option></select>
                <input value={correction} onChange={e => setCorrection(e.target.value)} placeholder="Correction (for correct)" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
                <Button disabled={busy} onClick={() => void run("Review decision", () => neuroApi.hexisDecideReview({ reviewId: review.id, itemId: review.items[0].id, decision: reviewDecision, correction }))}>Decide</Button>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Retention / deliberate forgetting" icon={<Archive className="size-4" />}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={memoryId} onChange={e => setMemoryId(e.target.value)} list="hexis-memory-options" placeholder="Memory id" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <select value={retentionAction} onChange={e => setRetentionAction(e.target.value as any)} className="h-10 rounded-md border border-border bg-bg px-2 text-xs text-fg"><option value="archive">archive</option><option value="compress">compress</option><option value="forget">forget</option></select>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy || !memoryId} onClick={async () => { const result = await run("Retention proposal", () => neuroApi.hexisRetentionPropose({ memoryId, action: retentionAction, reason: "operator-ui-review" })); const id=(result as any)?.proposal?.id; if(id) setProposalId(String(id)); }}>Propose</Button>
            <input value={proposalId} onChange={e => setProposalId(e.target.value)} placeholder="Proposal id" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <Button variant="outline" disabled={busy || !proposalId || !retentionConfirmed} onClick={() => void run("Apply retention", () => neuroApi.hexisRetentionApply(proposalId, true))}>Apply</Button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted"><input type="checkbox" checked={retentionConfirmed} onChange={e => setRetentionConfirmed(e.target.checked)} /> I explicitly approve this memory-retention change.</label>
        </Panel>

        <Panel title="Portable HMX" icon={<Download className="size-4" />}>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={hmxIntent} onChange={e => setHmxIntent(e.target.value as typeof hmxIntent)} className="h-10 rounded-md border border-border bg-bg px-2 text-xs text-fg"><option value="port">port</option><option value="duplicate">duplicate</option><option value="telepathy">telepathy</option><option value="analysis">analysis</option></select>
            <select value={hmxStrategy} onChange={e => setHmxStrategy(e.target.value as typeof hmxStrategy)} className="h-10 rounded-md border border-border bg-bg px-2 text-xs text-fg"><option value="additive">additive</option><option value="authoritative">authoritative</option><option value="deliberative">deliberative</option><option value="analysis_only">analysis_only</option></select>
          </div>
          {hmxStage && (
            <div className="mt-2 rounded-md border border-border bg-bg p-2 text-[11px]">
              <p className="text-fg">Stage status: {hmxStage.status} · conflicts: {hmxStage.conflicts.length}</p>
              <p className="mt-1 text-muted">Section counts: {Object.entries(hmxStage.sectionCounts).map(([section, count]) => `${section}=${count}`).join(" · ") || "none"}</p>
              {hmxStage.application && (
                <div className="mt-2 rounded border border-border p-2">
                  <p className="text-fg">Canonical apply receipt: {hmxStage.application.status} · imported {hmxStage.application.importedCount} · deduplicated {hmxStage.application.deduplicatedCount}</p>
                  <p className="mt-1 text-muted">Projected edges: {hmxStage.application.projectedRelationships} · deferred: {hmxStage.application.deferredRelationships} · complete: {hmxStage.application.complete ? "yes" : "no"}</p>
                  {hmxStage.application.warnings.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-muted">{hmxStage.application.warnings.slice(0, 8).map((warning, index) => <li key={index}>{warning}</li>)}</ul>
                  )}
                </div>
              )}
              {hmxStage.conflicts.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-muted">{hmxStage.conflicts.slice(0, 8).map((conflict, index) => <li key={index}>{conflict.path}: {conflict.detail}</li>)}</ul>
              )}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void exportHmx()}>Export HMX</Button>
            <Button variant="outline" disabled={busy} onClick={() => void stageCurrentHmx()}>Stage current HMX</Button>
            <label className="flex h-10 cursor-pointer items-center rounded-md border border-border bg-bg px-3 text-xs text-fg">
              Import HMX JSON
              <input type="file" accept=".json,application/json" disabled={busy} className="ml-2 max-w-[145px] text-[10px]" onChange={event => {
                const selectedFile = event.currentTarget.files?.[0];
                if (selectedFile) void stageHmxFile(selectedFile);
                event.currentTarget.value = "";
              }} />
            </label>
            <input value={stageId} onChange={e => { setStageId(e.target.value); setHmxStage(null); setHmxAccepted(false); setHmxConfirmed(false); setHmxApplyConfirmed(false); }} placeholder="Staging id" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <Button disabled={busy || !stageId.trim() || !hmxConfirmed || (hmxStage !== null && hmxStage.status !== "staged") || (hmxStage?.conflicts.length ?? 0) > 0} onClick={() => void acceptHmx()}>Accept staged</Button>
            <Button variant="outline" disabled={busy || !stageId.trim() || (hmxStage !== null && hmxStage.status !== "staged")} onClick={() => void rejectHmx()}>Reject</Button>
            <Button variant="outline" disabled={busy || !stageId.trim() || !hmxApplyConfirmed || (hmxStage !== null && (hmxStage.status !== "accepted" || !hmxAccepted))} onClick={() => void applyHmx()}>Apply canonical memory</Button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted"><input type="checkbox" checked={hmxConfirmed} onChange={e => setHmxConfirmed(e.target.checked)} /> I explicitly approve this staged HMX document for acceptance.</label>
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted"><input type="checkbox" checked={hmxApplyConfirmed} onChange={e => setHmxApplyConfirmed(e.target.checked)} /> I separately confirm canonical memory writes after acceptance.</label>
          <p className="mt-2 text-[11px] text-muted">External HMX content is staged for review first. Canonical NK1 memory changes only after a separate apply confirmation.</p>
        </Panel>

        <Panel title="Imported goal proposals" icon={<CheckCircle2 className="size-4" />}>
          <p className="text-[11px] leading-relaxed text-muted">Imported goals remain proposals until reviewed. Approval, materialization into a paused local candidate, and activation are three distinct decisions.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <select value={goalProposalStatus} onChange={e => setGoalProposalStatus(e.target.value as HexisGoalProposalStatus)} className="h-10 rounded-md border border-border bg-bg px-2 text-xs text-fg">
              <option value="pending">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="materialized">Materialized</option>
            </select>
            <Button variant="outline" disabled={busy} onClick={() => void loadGoalProposals()}>Load proposals</Button>
            <Button disabled={busy || !stageId.trim() || hmxStage?.status !== "applied"} onClick={() => void prepareGoalProposals()}>Prepare from applied stage</Button>
          </div>
          {goalProposals.length > 0 ? (
            <>
              <select value={goalProposalId} onChange={e => { setGoalProposalId(e.target.value); setGoalMaterializeConfirmed(false); setGoalActivationConfirmed(false); }} className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-2 text-xs text-fg">
                {goalProposals.map(proposal => <option key={proposal.id} value={proposal.id}>{proposal.title} · {proposal.status}</option>)}
              </select>
              {selectedGoalProposal && (
                <div className="mt-2 rounded-md border border-border bg-bg p-3">
                  <p className="text-sm text-fg">{selectedGoalProposal.title}</p>
                  <p className="mt-1 text-[11px] text-muted">{selectedGoalProposal.description}</p>
                  <p className="mt-2 break-all font-mono text-[10px] text-subtle">status: {selectedGoalProposal.status} · proposal: {selectedGoalProposal.id}</p>
                  {selectedGoalProposal.goalRelationshipReceipt && (
                    <p className="mt-1 text-[11px] text-muted">Activation receipt · projected edges: {selectedGoalProposal.goalRelationshipReceipt.projected} · deferred: {selectedGoalProposal.goalRelationshipReceipt.deferred}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button disabled={busy || selectedGoalProposal.status !== "pending"} onClick={() => void decideGoalProposal("approve")}>Approve proposal</Button>
                    <Button variant="outline" disabled={busy || selectedGoalProposal.status !== "pending"} onClick={() => void decideGoalProposal("reject")}>Reject proposal</Button>
                  </div>
                  {selectedGoalProposal.status === "approved" && (
                    <>
                      <label className="mt-3 flex items-start gap-2 text-[11px] text-muted">
                        <input type="checkbox" checked={goalMaterializeConfirmed} onChange={e => setGoalMaterializeConfirmed(e.target.checked)} />
                        I explicitly confirm creating/reusing a local candidate goal. This does not activate it.
                      </label>
                      <Button className="mt-2" disabled={busy || !goalMaterializeConfirmed} onClick={() => void materializeGoalProposal()}>Materialize approved candidate</Button>
                    </>
                  )}
                  {selectedGoalProposal.status === "materialized" && !selectedGoalProposal.goalRelationshipReceipt && (
                    <>
                      <label className="mt-3 flex items-start gap-2 text-[11px] text-muted">
                        <input type="checkbox" checked={goalActivationConfirmed} onChange={e => setGoalActivationConfirmed(e.target.checked)} />
                        I explicitly approve activating this goal and projecting the supported relationships into canonical NK1 memory.
                      </label>
                      <Button className="mt-2" disabled={busy || !goalActivationConfirmed} onClick={() => void activateGoalProposal()}>Activate approved goal</Button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-border p-3 text-xs text-muted">No proposals loaded for this status. Prepare proposals from an applied stage or load an existing review queue.</p>
          )}
        </Panel>

        <Panel title="Transactional outbox" icon={<Send className="size-4" />}>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={outboxKey} onChange={e => setOutboxKey(e.target.value)} placeholder="Idempotency key" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <select value={outboxChannel} onChange={e => setOutboxChannel(e.target.value)} className="h-10 rounded-md border border-border bg-bg px-2 text-xs text-fg"><option>telegram</option><option>discord</option><option>whatsapp</option><option>http</option><option>generic</option></select>
            <Button disabled={busy || !outboxKey} onClick={async () => { const result=await run("Queue outbox",()=>neuroApi.hexisOutboxEnqueue({idempotencyKey:outboxKey,kind:"notify",channel:outboxChannel,payload:{source:"operator-ui",text:context}})); const id=(result as any)?.result?.id; if(id) setOutboxId(String(id)); }}>Queue</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={outboxId} onChange={e => setOutboxId(e.target.value)} placeholder="Outbox id" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <Button variant="outline" disabled={busy || !outboxId} onClick={() => void run("Claim outbox",()=>neuroApi.hexisOutboxClaim(outboxId))}>Claim</Button>
            <Button disabled={busy || !outboxId} onClick={() => void run("ACK outbox",()=>neuroApi.hexisOutboxAck(outboxId,true))}>ACK published</Button>
            <Button variant="outline" disabled={busy} onClick={() => void run("Reclaim outbox",()=>neuroApi.hexisOutboxReclaim())}>Reclaim stale</Button>
            <Button variant="outline" disabled={busy} onClick={() => void run("Outbox state",()=>neuroApi.hexisOutbox())}>Inspect</Button>
          </div>
        </Panel>

        <Panel title="Connector policy / authorisation" icon={<ShieldCheck className="size-4" />}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={policyConnector} onChange={e => setPolicyConnector(e.target.value)} placeholder="Connector" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <input value={policyAction} onChange={e => setPolicyAction(e.target.value)} placeholder="Action kind" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <input value={policyContext} onChange={e => setPolicyContext(e.target.value)} placeholder="Context" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <input value={policyTarget} onChange={e => setPolicyTarget(e.target.value)} placeholder="Allowed target" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <input value={policyMaxPerWindow} onChange={e => setPolicyMaxPerWindow(e.target.value)} placeholder="Max calls / window" inputMode="numeric" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <input value={policyWindowMs} onChange={e => setPolicyWindowMs(e.target.value)} placeholder="Window ms" inputMode="numeric" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={async () => { const result=await run("Grant policy",()=>neuroApi.hexisPolicyGrant({connectorId:policyConnector,actionKind:policyAction,contexts:[policyContext],requiresApproval:true,allowAutonomous:false,allowedTargets:policyTarget?[policyTarget]:[],maxPerWindow:Number(policyMaxPerWindow),windowMs:Number(policyWindowMs)})); const id=(result as any)?.policy?.id; if(id) setPolicyId(String(id)); }}>Grant</Button>
            <Button variant="outline" disabled={busy} onClick={() => void run("Evaluate action",()=>neuroApi.hexisPolicyEvaluate({connectorId:policyConnector,actionKind:policyAction,context:policyContext,target:policyTarget,confirmed,autonomous:false}))}>Evaluate</Button>
            <label className="flex items-center gap-2 text-[11px] text-muted"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} /> confirmed</label>
            <input value={policyId} onChange={e=>setPolicyId(e.target.value)} placeholder="Policy id" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <Button variant="outline" disabled={busy || !policyId} onClick={() => void run("Revoke policy",()=>neuroApi.hexisPolicyRevoke(policyId))}>Revoke</Button>
          </div>
        </Panel>

        <Panel title="Execution placement" icon={<Workflow className="size-4" />}>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={executionAction} onChange={e=>setExecutionAction(e.target.value)} placeholder="Action kind" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <select value={placement} onChange={e=>setPlacement(e.target.value)} className="h-10 rounded-md border border-border bg-bg px-2 text-xs text-fg"><option>local</option><option>sandbox</option><option>remote</option><option>companion</option></select>
            <input value={risk} onChange={e=>setRisk(e.target.value)} placeholder="Risk 0..1" className="h-10 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
          </div>
          <Button className="mt-2" disabled={busy} onClick={() => void run("Execution plan",()=>neuroApi.hexisExecutionPlan({actionKind:executionAction||"tool.execute",requestedPlacement:placement,risk01:Number(risk),rationale:"operator-ui execution planning",requiresApproval:Number(risk)>=0.6}))}>Plan execution</Button>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.5fr]">
        <Panel title="Live Hexis state" icon={<Clock3 className="size-4" />}>
          <pre className="max-h-80 overflow-auto rounded-md border border-border bg-bg p-3 text-[10px] leading-relaxed text-muted">{state ? fmt(state) : "Loading…"}</pre>
        </Panel>
        <Panel title="Operation result" icon={<History className="size-4" />}>
          <div className="mb-2 text-xs text-muted">{message || "Choose an operation above."}</div>
          <pre className="max-h-80 overflow-auto rounded-md border border-border bg-bg p-3 text-[10px] leading-relaxed text-muted">{panel || "No operation result."}</pre>
        </Panel>
      </div>
    </section>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-lg border border-border bg-bg/40 p-3"><div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-subtle">{icon}{title}</div>{children}</section>;
}
