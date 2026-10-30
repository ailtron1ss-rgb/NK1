import { useEffect, useState, type ReactNode } from "react";
import { Activity, GitBranch, MessageSquare, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neuroApi } from "@/neuro-kurisu/api";

const pretty = (x: unknown) => JSON.stringify(x, null, 2);

export function ConscioControlConsole() {
  const [data, setData] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [skillName, setSkillName] = useState("");
  const [skillSummary, setSkillSummary] = useState("");
  const [peerId, setPeerId] = useState("");
  const [peerLabel, setPeerLabel] = useState("");
  const [peerMessage, setPeerMessage] = useState("");
  const [sourcePath, setSourcePath] = useState("runtime/neuro-kurisu/src");
  const [sourceState, setSourceState] = useState("canonical");
  const [reviewReason, setReviewReason] = useState("");
  const [claimSupported, setClaimSupported] = useState(true);
  const [claim, setClaim] = useState("");
  const [expectedAction, setExpectedAction] = useState("");
  const [claimEvidence, setClaimEvidence] = useState("");
  const [predicted, setPredicted] = useState("0.8");
  const [outcome, setOutcome] = useState("1");
  const [evidenceTrust, setEvidenceTrust] = useState("0.8");

  const load = async () => {
    setBusy(true);
    setStatus("");
    try {
      const [overview, skills, peers, claims, calibration] = await Promise.all([
        neuroApi.conscio(),
        neuroApi.conscioSkills(),
        neuroApi.conscioPeers(),
        neuroApi.conscioClaims(),
        neuroApi.conscioCalibration(),
      ]);
      const snapshot = (overview as any).conscio ?? {};
      setData({
        ...snapshot,
        skills: (skills as any).skills ?? snapshot.skills ?? [],
        peers: (peers as any).peers ?? snapshot.peers ?? [],
        messages: (peers as any).messages ?? snapshot.messages ?? [],
        claims: (claims as any).claims ?? snapshot.claims ?? [],
        calibration: (calibration as any).calibration ?? snapshot.calibration,
      });
    } catch (e) {
      setStatus(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const act = async (label: string, fn: () => Promise<any>) => {
    setBusy(true);
    setStatus("");
    try {
      const result = await fn();
      setStatus(`${label}: OK`);
      await load();
      return result;
    } catch (e) {
      setStatus(`${label}: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setBusy(false);
    }
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const result = await neuroApi.conscioSearch(query, 12);
      setHits(Array.isArray((result as any).hits) ? (result as any).hits : []);
      setStatus(`Hybrid search: ${(result as any).hits?.length ?? 0} hits`);
    } catch (e) {
      setStatus(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const pendingMessages = (data?.messages ?? []).filter((m: any) => m.status === "queued" || m.status === "quarantined");
  const recentClaims = (data?.claims ?? []).slice(-6).reverse();

  return <section className="mt-4 min-w-0 w-full max-w-full rounded-xl border border-border bg-surface p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-subtle">Conscio 4.8.2 adaptation</p>
        <h2 className="font-display text-xl text-fg">Cognitive Federation Console</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">Hybrid retrieval, quarantined skills, peer liaison, evidence/calibration, claim verification, source-boundary governance and metabolic guidance. Canonical state remains owned by Neuro-Kurisu.</p>
      </div>
      <Button variant="ghost" size="icon" aria-label="Refresh Conscio status" disabled={busy} onClick={() => void load()}><RefreshCw className="size-4" /></Button>
    </div>
    {status ? <div className="mt-3 rounded-md border border-border bg-bg px-3 py-2 text-xs text-muted">{status}</div> : null}

    <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel title="Hybrid retrieval" icon={<Search className="size-4" />}>
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void doSearch(); }} placeholder="memory, document, exact phrase…" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg" />
          <Button disabled={busy || !query.trim()} onClick={() => void doSearch()}><Search className="mr-2 size-4" />Search</Button>
        </div>
        <div className="mt-3 max-h-48 space-y-2 overflow-auto">
          {hits.map((h: any) => <div key={h.id} className="rounded-md border border-border bg-bg p-2">
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-subtle"><span>{h.kind}</span><span>{Number(h.score ?? 0).toFixed(2)}</span></div>
            <p className="mt-1 text-xs text-fg">{h.title}: {h.text}</p>
            <p className="mt-1 text-[10px] text-muted">RRF {Number(h.rrfScore ?? 0).toFixed(2)} · lexical {Number(h.lexicalScore ?? 0).toFixed(2)} · semantic {Number(h.semanticScore ?? 0).toFixed(2)}</p>
          </div>)}
        </div>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void act("Sync memory index", () => neuroApi.conscioSyncMemory(512))}>Sync canonical memory</Button>
      </Panel>

      <Panel title="Source boundary" icon={<ShieldCheck className="size-4" />}>
        <p className="text-[11px] text-muted">Checks whether a path may be treated as canonical. Research, legacy and provenance paths are never silently promoted.</p>
        <div className="mt-2 flex gap-2">
          <input value={sourcePath} onChange={e => setSourcePath(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
          <Button disabled={busy || !sourcePath.trim()} onClick={() => void act("Source boundary", () => neuroApi.conscioSourceBoundary(sourcePath, "canonical"))}>Check</Button>
        </div>
        <pre className="mt-2 max-h-24 overflow-auto rounded-md border border-border bg-bg p-2 text-[10px] text-muted">{pretty(data?.source ?? data?.sourceBoundaries)}</pre>
      </Panel>

      <Panel title="Skill federation" icon={<Sparkles className="size-4" />}>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={skillName} onChange={e => setSkillName(e.target.value)} placeholder="skill name" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
          <input value={skillSummary} onChange={e => setSkillSummary(e.target.value)} placeholder="skill summary" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2"><Button disabled={busy || !skillName || !skillSummary} onClick={() => void act("Publish skill", () => neuroApi.conscioPublishSkill({ name: skillName, summary: skillSummary, provenance: "operator-ui" }))}>Quarantine</Button></div>
        <div className="mt-3 max-h-48 space-y-2 overflow-auto">{(data?.skills ?? []).map((s: any) => <div key={s.id} className="rounded-md border border-border bg-bg p-2">
          <div className="flex items-center justify-between gap-2"><span className="text-xs text-fg">{s.name}</span><span className="text-[10px] uppercase text-subtle">{s.status}</span></div>
          <p className="mt-1 text-[10px] text-muted">{s.trialCount} trials · success {s.successes}/{s.trialCount || 0}</p><input value={reviewReason} onChange={e => setReviewReason(e.target.value)} placeholder="review reason (used for reject)" className="mt-2 h-8 w-full rounded-md border border-border bg-bg px-2 text-[11px] text-fg" />
          <div className="mt-2 flex gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => void act("Trial", () => neuroApi.conscioTrialSkill(s.id, true, "operator trial"))}>Pass trial</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => void act("Promote", () => neuroApi.conscioReviewSkill(s.id, "approve"))}>Promote</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => void act("Reject", () => neuroApi.conscioReviewSkill(s.id, "reject", reviewReason || "operator UI rejection"))}>Reject</Button></div>
        </div>)}</div>
      </Panel>

      <Panel title="Peer liaison" icon={<GitBranch className="size-4" />}>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={peerId} onChange={e => setPeerId(e.target.value)} placeholder="peer id" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
          <input value={peerLabel} onChange={e => setPeerLabel(e.target.value)} placeholder="label" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2"><Button disabled={busy || !peerId} onClick={() => void act("Pair", () => neuroApi.conscioPairPeer({ id: peerId, label: peerLabel || peerId, role: "companion", capabilities: ["message"] }))}>Pair</Button><Button variant="outline" disabled={busy || !peerId} onClick={() => void act("Trust", () => neuroApi.conscioDecidePeer(peerId, "trust"))}>Trust</Button></div>
        <div className="mt-3 flex gap-2"><input value={peerMessage} onChange={e => setPeerMessage(e.target.value)} placeholder="message payload" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-sm text-fg" /><Button disabled={busy || !peerId || !peerMessage} onClick={() => void act("Queue", () => neuroApi.conscioPeerMessage({ to: peerId, payload: { text: peerMessage }, idempotencyKey: `ui:${peerId}:${peerMessage}` }))}><MessageSquare className="mr-2 size-4" />Queue</Button></div>
        <div className="mt-3 max-h-32 space-y-1 overflow-auto">{pendingMessages.map((m: any) => <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg p-2 text-[10px]"><span className="truncate">{m.id} · {m.status}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void act("ACK", () => neuroApi.conscioPeerAck(m.id, true))}>ACK</Button></div>)}</div>
      </Panel>

      <Panel title="Calibration / claims" icon={<Activity className="size-4" />}>
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={predicted} onChange={e => setPredicted(e.target.value)} type="number" min="0" max="1" step="0.05" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" aria-label="Predicted probability" />
          <input value={outcome} onChange={e => setOutcome(e.target.value)} type="number" min="0" max="1" step="0.05" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" aria-label="Observed outcome" />
          <input value={evidenceTrust} onChange={e => setEvidenceTrust(e.target.value)} type="number" min="0" max="1" step="0.05" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" aria-label="Evidence trust" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void act("Observe confidence", () => neuroApi.conscioCalibrationObserve({ key: "operator.calibration", predicted01: Number(predicted), outcome01: Number(outcome), evidenceTrust01: Number(evidenceTrust) }))}>Record calibration</Button><Button variant="outline" disabled={busy} onClick={() => void act("Calibration", () => neuroApi.conscioCalibration())}>Refresh</Button></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={claim} onChange={e => setClaim(e.target.value)} placeholder="claim" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
          <input value={expectedAction} onChange={e => setExpectedAction(e.target.value)} placeholder="expected action / receipt" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg" />
        </div>
        <div className="mt-2 flex gap-2"><label className="flex items-center gap-1 text-[10px] text-muted"><input type="checkbox" checked={claimSupported} onChange={e => setClaimSupported(e.target.checked)} /> supported</label><input value={claimEvidence} onChange={e => setClaimEvidence(e.target.value)} placeholder="evidence" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-sm text-fg" /><Button disabled={busy || !claim.trim()} onClick={() => void act("Record supported claim", () => neuroApi.conscioRecordClaim({ claim, expectedAction, supported: true, evidence: claimEvidence ? [claimEvidence] : [] }))}>Verify claim</Button></div>
        <pre className="mt-3 max-h-36 overflow-auto rounded-md border border-border bg-bg p-2 text-[10px] text-muted">{pretty({ calibration: data?.calibration, recentClaims })}</pre>
      </Panel>

      <Panel title="Metabolic state" icon={<Activity className="size-4" />}>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void act("Metabolic", () => neuroApi.conscioMetabolic(9000, 16384))}>Assess 55% load</Button><Button variant="outline" disabled={busy} onClick={() => void act("Metabolic idle", () => neuroApi.conscioMetabolic(0, 16384))}>Idle state</Button></div>
        <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-border bg-bg p-3 text-[10px] leading-relaxed text-muted">{pretty(data?.metabolic)}</pre>
      </Panel>
    </div>
  </section>;
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <div className="rounded-lg border border-border bg-bg p-3"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-subtle">{icon}{title}</div>{children}</div>;
}
