import { useEffect, useState } from "react";
import { Archive, Brain, CheckCircle2, Clock3, Download, History, Radio, RefreshCw, Send, ShieldCheck, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neuroApi } from "@/neuro-kurisu/api";

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
  const [hmxIntent, setHmxIntent] = useState<"port" | "duplicate" | "telepathy" | "analysis">("telepathy");
  const [hmxStrategy, setHmxStrategy] = useState<"additive" | "authoritative" | "deliberative" | "analysis_only">("additive");
  const [hmxConfirmed, setHmxConfirmed] = useState(false);
  const [hmxImportText, setHmxImportText] = useState("");
  const [hmxImportName, setHmxImportName] = useState("");
  const [placement, setPlacement] = useState("local");
  const [executionAction, setExecutionAction] = useState("tool.execute");
  const [risk, setRisk] = useState("0.4");
  const [remotePeerStatus, setRemotePeerStatus] = useState<any | null>(null);
  const [remoteQuestion, setRemoteQuestion] = useState("");
  const [remoteConfirmation, setRemoteConfirmation] = useState(false);
  const [remoteResult, setRemoteResult] = useState<any | null>(null);

  const run = async (label: string, operation: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await operation();
      setPanel(fmt(result));
      setMessage(`${label}: OK`);

      // The mutation result is authoritative for this interaction. A later
      // dashboard/memory refresh can fail independently and must not erase a
      // successful HMX receipt before its caller can render APPLIED/UNCERTAIN.
      try {
        const next = await neuroApi.hexis();
        setState(next);
        const memoryResult = await neuroApi.hexisMemories(64);
        setMemories(Array.isArray((memoryResult as any)?.memoryIndex) ? (memoryResult as any).memoryIndex : []);
      } catch (refreshError) {
        setMessage(`${label}: action completed; refresh failed: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
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
    const result = await run("Export HMX", () => neuroApi.hexisHmxExport());
    const hmxDocument = (result as any)?.document;
    if (!hmxDocument) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(hmxDocument, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "neuro-kurisu-hexis-hmx.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const stageCurrentHmx = async () => {
    setHmxConfirmed(false);
    setStageId("");
    const exported = await neuroApi.hexisHmxExport();
    const staged = await run("Stage HMX", () => neuroApi.hexisHmxStage({ document: (exported as any).document, intent: hmxIntent, strategy: hmxStrategy }));
    const nextId = (staged as any)?.stage?.stagingId;
    if (nextId) setStageId(String(nextId));
  };

  const stageImportedHmx = async () => {
    setHmxConfirmed(false);
    setStageId("");
    let hmxDocument: unknown;
    try {
      hmxDocument = JSON.parse(hmxImportText);
    } catch {
      setMessage("Stage imported HMX: input is not valid JSON");
      return;
    }
    if (!hmxDocument || typeof hmxDocument !== "object" || Array.isArray(hmxDocument)) {
      setMessage("Stage imported HMX: expected a JSON object");
      return;
    }
    const staged = await run("Stage imported HMX", () => neuroApi.hexisHmxStage({
      document: hmxDocument,
      intent: hmxIntent,
      strategy: hmxStrategy,
    }));
    const nextId = (staged as any)?.stage?.stagingId;
    if (nextId) setStageId(String(nextId));
  };

  const acceptHmxStage = async () => {
    const accepted = await run("Accept HMX", () => neuroApi.hexisHmxDecide(stageId, "accept"));
    const stage = (accepted as any)?.stage;
    const receipt = stage?.importResult;
    if (!receipt || typeof receipt !== "object" || typeof receipt.status !== "string") return;

    // All import-result statuses are terminal. Clear the local accept controls
    // and explain the outcome so a pending/uncertain receipt is never presented
    // as a clean success or accidentally retried from this UI surface.
    setHmxConfirmed(false);
    setStageId("");
    const created = Number.isSafeInteger(receipt.created) ? receipt.created : 0;
    const reused = Number.isSafeInteger(receipt.reused) ? receipt.reused : 0;
    const skipped = Number.isSafeInteger(receipt.skipped) ? receipt.skipped : 0;
    if (receipt.status === "uncertain") {
      setMessage(`Accept HMX: UNCERTAIN — the import outcome could not be confirmed; memory changes may have survived. Do not retry this stage. Unverified bookkeeping counts (not proof of applied rows): created ${created}, reused ${reused}, remaining/unconfirmed ${skipped}. Inspect canonical memories and the import receipt before remediation.`);
      return;
    }
    if (receipt.status === "pending") {
      setMessage("Accept HMX: RECEIPT PENDING — canonical import outcome is not confirmed. Do not retry this stage; inspect the canonical memory state and receipt.");
      return;
    }
    const reason = typeof receipt.reason === "string" && receipt.reason ? ` (${receipt.reason})` : "";
    setMessage(`Accept HMX: ${receipt.status.toUpperCase()} — created ${created}, reused ${reused}, skipped ${skipped}${reason}`);
  };

  const checkRemotePeer = async () => {
    const result = await run("Remote Hexis status", () => neuroApi.hexisRemotePeerStatus());
    if (result && typeof result === "object") setRemotePeerStatus((result as any).peer ?? result);
  };

  const consultRemotePeer = async () => {
    setRemoteConfirmation(false);
    const result = await run("Consult QuixiAI/Hexis", () => neuroApi.hexisRemotePeerConsult({
      question: remoteQuestion,
      context: {},
      confirmExternalConsult: true,
    }));
    if (result && typeof result === "object") {
      setRemoteResult((result as any).result ?? result);
      setRemoteConfirmation(false);
    }
  };

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

        <Panel title="Portable HMX 1.7" icon={<Download className="size-4" />}>
          <p className="mb-2 text-[11px] leading-relaxed text-muted">
            NK1 exports a bounded memory-only HMX 1.7 document. It is not redacted: inspect content and consent before sharing it. For ordinary memory import, use telepathy + additive. Unknown or protected populated sections are rejected instead of silently dropped; other intent/strategy pairs stage as preview-only.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={hmxIntent} onChange={e => { setHmxIntent(e.target.value as typeof hmxIntent); setHmxConfirmed(false); setStageId(""); }} className="h-10 rounded-md border border-border bg-bg px-2 text-xs text-fg"><option value="port">port</option><option value="duplicate">duplicate</option><option value="telepathy">telepathy</option><option value="analysis">analysis</option></select>
            <select value={hmxStrategy} onChange={e => { setHmxStrategy(e.target.value as typeof hmxStrategy); setHmxConfirmed(false); setStageId(""); }} className="h-10 rounded-md border border-border bg-bg px-2 text-xs text-fg"><option value="additive">additive</option><option value="authoritative">authoritative</option><option value="deliberative">deliberative</option><option value="analysis_only">analysis_only</option></select>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void exportHmx()}>Export HMX</Button>
            <Button variant="outline" disabled={busy} onClick={() => void stageCurrentHmx()}>Stage current HMX</Button>
            <input value={stageId} onChange={e => { setStageId(e.target.value); setHmxConfirmed(false); }} placeholder="Staging id" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-xs text-fg" />
            <Button disabled={busy || !stageId || !hmxConfirmed} onClick={() => void acceptHmxStage()}>Accept staged</Button>
            <Button variant="outline" disabled={busy || !stageId} onClick={() => void run("Reject HMX", () => neuroApi.hexisHmxDecide(stageId, "reject"))}>Reject</Button>
          </div>
          <div className="mt-3 rounded-md border border-border p-3">
            <p className="text-xs font-medium text-fg">Import an external Hexis HMX file</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">Choose a JSON file exported by your Hexis instance, or paste its contents below. This is a local file operation; it is not sent to the remote chat peer. For memory merging choose the source document's own intent (normally telepathy) and additive strategy. The server validates before staging.</p>
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={async e => {
                const file = e.target.files?.[0];
                setHmxConfirmed(false);
                setStageId("");
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  setMessage("Import HMX: file exceeds 2 MiB");
                  e.target.value = "";
                  return;
                }
                try {
                  const text = await file.text();
                  setHmxImportText(text);
                  setHmxImportName(file.name);
                  setMessage("Loaded HMX file locally: " + file.name);
                } catch {
                  setMessage("Import HMX: could not read the selected file");
                }
              }}
              className="mt-2 block w-full text-[11px] text-muted file:mr-3 file:rounded-md file:border-0 file:bg-bg file:px-3 file:py-2 file:text-fg"
            />
            {hmxImportName ? <p className="mt-1 text-[10px] text-subtle">Loaded: {hmxImportName}</p> : null}
            <textarea
              value={hmxImportText}
              onChange={e => { setHmxImportText(e.target.value); setHmxImportName(""); setHmxConfirmed(false); setStageId(""); }}
              rows={4}
              maxLength={2 * 1024 * 1024}
              placeholder="Paste an HMX 1.7 JSON document…"
              className="mt-2 w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-[10px] leading-relaxed text-fg"
            />
            <Button variant="outline" className="mt-2" disabled={busy || !hmxImportText.trim()} onClick={() => void stageImportedHmx()}>Validate & stage imported HMX</Button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted"><input type="checkbox" checked={hmxConfirmed} onChange={e => setHmxConfirmed(e.target.checked)} /> I explicitly approve this staged HMX operation after checking its conflicts, source and application mode.</label>
        </Panel>

        <Panel title="QuixiAI/Hexis remote peer" icon={<Radio className="size-4" />}>
          <p className="mb-2 text-[11px] leading-relaxed text-muted">
            Optional external cognitive peer. Status checks are user-triggered. A consultation sends only the question entered here, not NK1 memory or chat history. The remote Hexis agent may have its own tools enabled, so treat every answer as advisory.
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void checkRemotePeer()}>Check remote status</Button>
            <span className="text-[10px] text-subtle">
              {remotePeerStatus?.reachable === true ? "reachable" : remotePeerStatus?.reason ? String(remotePeerStatus.reason) : "not checked"}
            </span>
          </div>
          <pre className="mb-3 max-h-24 overflow-auto rounded-md border border-border bg-bg p-2 text-[10px] leading-relaxed text-muted">{remotePeerStatus ? fmt(remotePeerStatus) : "No remote status loaded. The remote connector is disabled until configured by the operator."}</pre>
          <textarea
            value={remoteQuestion}
            onChange={e => { setRemoteQuestion(e.target.value); setRemoteConfirmation(false); }}
            maxLength={6000}
            rows={3}
            placeholder="Ask a focused question for the external Hexis peer…"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-xs leading-relaxed text-fg"
          />
          <label className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
            <input type="checkbox" checked={remoteConfirmation} onChange={e => setRemoteConfirmation(e.target.checked)} />
            I confirm that this question will be sent to a separately configured Hexis service. Its own tool permissions apply.
          </label>
          <Button
            className="mt-2"
            disabled={busy || !remoteQuestion.trim() || !remoteConfirmation || remotePeerStatus?.reachable !== true || remotePeerStatus?.consultEnabled !== true}
            onClick={() => void consultRemotePeer()}
          >Consult remote Hexis</Button>
          <p className="mt-2 text-[10px] leading-relaxed text-subtle">A response never counts as verified evidence and cannot change NK1 memory or activate a skill. Importable data must still pass the HMX stage and explicit NK1 decision.</p>
          {remoteResult ? <pre className="mt-3 max-h-56 overflow-auto rounded-md border border-border bg-bg p-3 text-[10px] leading-relaxed text-muted">{fmt(remoteResult)}</pre> : null}
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
