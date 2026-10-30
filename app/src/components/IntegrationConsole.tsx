import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Database, Download, Fingerprint, Gauge, Radio, RefreshCw, Search, Send, ShieldAlert, ShieldCheck, Volume2, WandSparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neuroApi } from "@/neuro-kurisu/api";

const fmt = (v: unknown) => JSON.stringify(v, null, 2);
type ApprovalRequest = { id: string; toolId: string; permissionClass: string; operation?: string; status?: string; expiresAt: number; reasonCode?: string; inputKeys?: string[]; inputPreview?: Record<string, unknown> };
type PendingApproval = { name: string; request: ApprovalRequest; resume: (approvalId: string) => Promise<any> };

export function IntegrationConsole() {
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [query, setQuery] = useState("");
  const [searchRows, setSearchRows] = useState<any[]>([]);
  const [transportText, setTransportText] = useState("");
  const [channel, setChannel] = useState("ui");
  const [jsonPanel, setJsonPanel] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [outboundTarget, setOutboundTarget] = useState("");
  const [outboundConfirmed, setOutboundConfirmed] = useState(false);
  const [conversationTarget, setConversationTarget] = useState("user");
  const [conversationCondition, setConversationCondition] = useState("reply-received");
  const [webTarget, setWebTarget] = useState("");
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);

  const load = async () => {
    setBusy(true); setMessage("");
    try { setOverview(await neuroApi.integrationOverview()); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  const caps = useMemo(() => Array.isArray((overview as any)?.capabilities) ? (overview as any).capabilities : [], [overview]);

  const action = async (name: string, fn: (approvalId?: string) => Promise<any>) => {
    if (pendingApproval) { setMessage(`Resolve the pending approval for ${pendingApproval.name} first.`); return; }
    setBusy(true); setMessage("");
    try { const result = await fn(); setJsonPanel(fmt(result)); setMessage(`${name}: OK`); await load(); }
    catch (e) {
      const details = e && typeof e === "object" && "data" in e ? (e as { data?: any }).data : undefined;
      const request = details?.approvalRequest as ApprovalRequest | undefined;
      if (details?.approvalRequired === true && request?.id && request?.toolId) {
        setPendingApproval({ name, request, resume: (approvalId) => fn(approvalId) });
        setMessage(`${name}: owner approval is required for this exact request.`);
      } else { setMessage(`${name}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    finally { setBusy(false); }
  };

  const decidePendingApproval = async (approved: boolean) => {
    const pending = pendingApproval;
    if (!pending || busy) return;
    setBusy(true); setMessage("");
    try {
      const decision = await neuroApi.resolveToolPermission(pending.request.id, approved);
      if (!approved) {
        setPendingApproval(null); setJsonPanel(fmt(decision)); setMessage(`${pending.name}: request declined; no action executed.`);
      } else {
        const result = await pending.resume(pending.request.id);
        setPendingApproval(null); setJsonPanel(fmt(result)); setMessage(`${pending.name}: approved and executed once.`);
      }
      await load();
    } catch (e) {
      const details = e && typeof e === "object" && "data" in e ? (e as { data?: any }).data : undefined;
      const replacement = details?.approvalRequest as ApprovalRequest | undefined;
      if (replacement?.id) setPendingApproval({ ...pending, request: replacement });
      setMessage(`${pending.name}: ${e instanceof Error ? e.message : String(e)}. Refresh permissions before retrying.`);
    } finally { setBusy(false); }
  };

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true); setMessage("");
    try {
      const result = await neuroApi.exactSearch(query, 12);
      setSearchRows(Array.isArray((result as any).hits) ? (result as any).hits : []);
      setJsonPanel(fmt(result));
      setMessage(`Search: ${(result as any).hits?.length ?? 0} hits`);
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const exportPma = async () => {
    const result = await neuroApi.exportPma();
    const blob = new Blob([JSON.stringify((result as any).pma ?? result, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = href; a.download = "neuro-kurisu-portable-mind.json"; a.click(); URL.revokeObjectURL(href);
    setJsonPanel(fmt(result)); setMessage("PMA exported");
    return result;
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-subtle">Tooling / integration bridge</p>
          <h2 className="font-display text-xl text-fg">Operator Console</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">One UI surface for capabilities that were previously available only through raw HTTP/WILL endpoints. The console is presentation-only; canonical runtime ownership stays in Neuro-Kurisu.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Refresh integration status" disabled={busy} onClick={() => void load()}><RefreshCw className="size-4" /></Button>
      </div>

      {message ? <div className="mt-3 rounded-md border border-border bg-bg px-3 py-2 text-xs text-muted">{message}</div> : null}
      {pendingApproval ? <div className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3" role="alertdialog" aria-label="Action approval request">
        <div className="flex items-start gap-2"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500"/><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-fg">Explicit one-time approval required</h3><p className="mt-1 text-xs text-muted">{pendingApproval.name} · {pendingApproval.request.toolId} · permission class: {pendingApproval.request.permissionClass}</p><p className="mt-1 break-all font-mono text-[10px] text-subtle">Ticket {pendingApproval.request.id} · expires {new Date(pendingApproval.request.expiresAt).toLocaleTimeString()}</p>{pendingApproval.request.inputKeys?.length ? <p className="mt-1 text-[11px] text-muted">Bound input keys: {pendingApproval.request.inputKeys.join(", ")}</p> : null}<pre className="mt-2 max-h-28 overflow-auto rounded-md border border-border bg-bg p-2 text-[10px] text-muted">{fmt(pendingApproval.request.inputPreview ?? {})}</pre><p className="mt-2 text-[11px] text-muted">Approval applies only to these exact parameters and can be consumed once before expiry. Changing the operation requires a new approval.</p><div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>void decidePendingApproval(true)}><CheckCircle2 className="mr-2 size-4"/>Approve and run once</Button><Button variant="outline" disabled={busy} onClick={()=>void decidePendingApproval(false)}><XCircle className="mr-2 size-4"/>Decline</Button></div></div></div>
      </div> : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="min-w-0 space-y-3">
          <Panel title="Capability profiles" icon={<ShieldCheck className="size-4" />}>
            <div className="mb-2 flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={()=>void action("Authorize outbound",()=>neuroApi.integrationCapabilityAuthorize("channel.outbound","telegram",outboundConfirmed))}>Authorize outbound</Button>
          </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {caps.map((c:any) => <div key={c.id} className="rounded-md border border-border bg-bg p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm text-fg">{c.label}</span><span className="text-[10px] uppercase tracking-wider text-subtle">{c.risk}</span></div><p className="mt-1 text-[11px] leading-relaxed text-muted">{c.adapter}</p><p className="mt-1 text-[10px] text-subtle">{c.requiresConfirmation ? "confirmation required" : "read-through"} · {c.enabled ? "enabled" : "disabled"}</p></div>)}
            </div>
          </Panel>

          <Panel title="Exact search" icon={<Search className="size-4" />}>
            <div className="flex gap-2"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void search();}} placeholder="Search exact/lexical memory, goals, skills, traces…" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"/><Button onClick={()=>void search()} disabled={busy || !query.trim()}><Search className="mr-2 size-4"/>Search</Button></div>
            <div className="mt-3 max-h-56 space-y-2 overflow-auto">{searchRows.map((r:any)=><div key={`${r.kind}:${r.id}`} className="rounded-md border border-border bg-bg p-2"><div className="flex justify-between gap-2 text-[10px] uppercase tracking-wider text-subtle"><span>{r.kind}</span><span>{Number(r.score||0).toFixed(2)}</span></div><p className="mt-1 text-xs leading-relaxed text-fg">{r.text}</p><p className="mt-1 text-[10px] text-subtle">{r.source} · {Array.isArray(r.matchedTerms)?r.matchedTerms.join(", "):""}</p></div>)}</div>
          </Panel>

          <Panel title="Transport / idempotency" icon={<Radio className="size-4" />}>
            <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]"><select value={channel} disabled={busy || Boolean(pendingApproval)} onChange={e=>setChannel(e.target.value)} className="h-10 rounded-md border border-border bg-bg px-2 text-sm text-fg"><option>ui</option><option>http</option><option>mcp</option><option>discord</option><option>whatsapp</option><option>telegram</option><option>sdk</option></select><input value={transportText} disabled={busy || Boolean(pendingApproval)} onChange={e=>setTransportText(e.target.value)} placeholder="Inbound message / tool envelope" className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"/><Button disabled={busy || !transportText.trim()} onClick={()=>void action("Transport",()=>neuroApi.integrationTransport({channel,text:transportText,from:"operator-ui"}))}><Send className="mr-2 size-4"/>Send</Button></div>
            <div className="mt-2 rounded-md border border-border bg-bg p-2"><div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]"><select value={channel} disabled={busy || Boolean(pendingApproval)} onChange={e=>setChannel(e.target.value)} className="h-10 rounded-md border border-border bg-bg px-2 text-sm text-fg"><option>discord</option><option>whatsapp</option><option>telegram</option><option>http</option><option>mcp</option><option>generic</option></select><input value={outboundTarget} disabled={busy || Boolean(pendingApproval)} onChange={e=>setOutboundTarget(e.target.value)} placeholder="Outbound target / chat id" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"/><Button disabled={busy || !outboundTarget.trim() || !transportText.trim() || !outboundConfirmed} onClick={()=>void action("Outbound",approvalId=>neuroApi.integrationOutbound({channel,target:outboundTarget,payload:{text:transportText},confirmed:true,...(approvalId?{approvalId}:{})}))}><Send className="mr-2 size-4"/>Outbound</Button></div><label className="mt-2 flex items-center gap-2 text-[11px] text-muted"><input type="checkbox" checked={outboundConfirmed} disabled={busy || Boolean(pendingApproval)} onChange={e=>setOutboundConfirmed(e.target.checked)}/>I explicitly confirm this external side effect.</label></div>
            <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>void action("Replay",()=>neuroApi.integrationReplay(16))}><RefreshCw className="mr-2 size-4"/>Replay 16</Button><Button variant="outline" disabled={busy} onClick={()=>void action("Integrity",()=>neuroApi.integrationIntegrity())}><Fingerprint className="mr-2 size-4"/>Verify chain</Button><Button variant="outline" disabled={busy} onClick={()=>void action("PMA",exportPma)}><Download className="mr-2 size-4"/>Export PMA</Button></div>
          </Panel>

                    <Panel title="Web safety / competence portability" icon={<ShieldCheck className="size-4" />}>
            <div className="flex gap-2"><input value={webTarget} onChange={e=>setWebTarget(e.target.value)} placeholder="https://example.com" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"/><Button disabled={busy || !webTarget.trim()} onClick={()=>void action("Web safety",()=>neuroApi.integrationWebValidate(webTarget))}>Validate URL</Button></div>
            <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>void action("Competence",()=>neuroApi.integrationCompetence())}>Export competence</Button><Button variant="outline" disabled={busy} onClick={()=>void action("Competence validation",async()=>{const x=await neuroApi.integrationCompetence(); return neuroApi.integrationCompetenceValidate((x as any).bundle);})}>Validate competence</Button></div>
          </Panel>
<Panel title="Social continuity" icon={<Database className="size-4" />}>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input value={conversationTarget} onChange={e=>setConversationTarget(e.target.value)} placeholder="Conversation target" className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"/>
              <input value={conversationCondition} onChange={e=>setConversationCondition(e.target.value)} placeholder="Completion condition" className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"/>
              <Button disabled={busy || !conversationTarget.trim()} onClick={()=>void action("Open conversation",()=>neuroApi.integrationConversation({id:`ui:${conversationTarget}`,target:conversationTarget,completionCondition:conversationCondition,expectedReplyType:"text"}))}>Open</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>void action("Close conversation",()=>neuroApi.integrationConversation({action:"close",id:`ui:${conversationTarget}`}))}>Close</Button><Button variant="outline" disabled={busy} onClick={()=>void action("Social state",()=>neuroApi.integrationSocial())}>Inspect social state</Button></div>
          </Panel>
          <Panel title="Voice embodiment" icon={<Volume2 className="size-4" />}>
            <div className="flex gap-2"><input value={voiceText} disabled={busy || Boolean(pendingApproval)} onChange={e=>setVoiceText(e.target.value)} placeholder="Text to Kurisu voice" className="h-10 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"/><Button disabled={busy || !voiceText.trim()} onClick={()=>void action("Speak",approvalId=>neuroApi.voiceSpeak(voiceText,approvalId))}><Volume2 className="mr-2 size-4"/>Speak</Button></div>
            <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>void action("Interrupt speech",()=>neuroApi.voiceInterrupt("operator-ui-stop"))}>Interrupt speech</Button><Button variant="outline" disabled={busy} onClick={()=>void action("Listen",approvalId=>neuroApi.voiceListen(approvalId))}>Listen</Button><Button variant="outline" disabled={busy} onClick={()=>void action("Voice turn",approvalId=>neuroApi.voiceTurn(true,true,approvalId))}>Voice turn</Button><Button variant="outline" disabled={busy} onClick={()=>void action("Voice status",()=>neuroApi.voiceStatus())}>Status</Button></div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-3">
          <Panel title="Live integration state" icon={<Database className="size-4" />}>
            <div className="grid grid-cols-2 gap-2 text-xs"><Stat label="WILL schema" value={String((overview as any)?.will?.schemaVersion ?? "—")} /><Stat label="Record chain" value={(overview as any)?.will?.recordChain?.integrity?.ok ? "OK" : "—"} /><Stat label="Vector engine" value={String((overview as any)?.will?.vector?.engine ?? "—")} /><Stat label="PMA fingerprint" value={String((overview as any)?.will?.pma?.lastFingerprint ?? "—").slice(0,12)} /><Stat label="Search index" value={String((overview as any)?.lumina?.search?.indexedRecords ?? 0)} /><Stat label="Idempotency hits" value={String((overview as any)?.lumina?.idempotency?.hits ?? 0)} /></div>
            <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-bg p-3 text-[10px] leading-relaxed text-muted">{overview ? fmt({will:(overview as any).will,lumina:(overview as any).lumina,voice:(overview as any).voice}) : "Loading…"}</pre>
          </Panel>
          <Panel title="Advanced runtime surfaces" icon={<WandSparkles className="size-4" />}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={()=>void action("Capabilities",()=>neuroApi.integrationCapabilities())}>Capabilities</Button>
              <Button variant="outline" disabled={busy} onClick={()=>void action("WILL diagnostics",()=>neuroApi.willDiagnostics())}>WILL diagnostics</Button>
              <Button variant="outline" disabled={busy} onClick={()=>void action("SDK manifest",()=>neuroApi.willSdk())}>SDK</Button>
              <Button variant="outline" disabled={busy} onClick={()=>void action("MCP manifest",()=>neuroApi.willMcpManifest())}>MCP</Button>
              <Button variant="outline" disabled={busy} onClick={()=>void action("Vector benchmark",()=>neuroApi.willBenchmark(["neural continuity","persistent identity","tool capability"],5,32))}>Vector benchmark</Button>
              <Button variant="outline" disabled={busy} onClick={()=>void action("PMA validation",async()=>{const exported=await neuroApi.exportPma(); return neuroApi.validatePma((exported as any).pma);})}>Validate PMA</Button>
              <Button variant="outline" disabled={busy} onClick={()=>void action("Idempotency probe",()=>neuroApi.idempotency({source:"operator-ui",probe:"same-operation"}))}>Idempotency probe</Button>
            </div>
          </Panel>
          <Panel title="Evidence payload" icon={<Gauge className="size-4" />}>
            <pre className="max-h-[480px] overflow-auto rounded-md border border-border bg-bg p-3 text-[10px] leading-relaxed text-muted">{jsonPanel || "Run an operation to inspect its runtime response."}</pre>
          </Panel>
          <Panel title="Human-governed tool loop" icon={<WandSparkles className="size-4" />}>
            <div className="space-y-2 text-xs leading-relaxed text-muted"><p><b className="text-fg">Read-only</b> operations are directly exposed. Write/execute/outbound/self-modifying profiles remain confirmation-gated.</p><p>The UI records the same request through the canonical transport/idempotency seam, so clicking the same action twice does not silently create a second side effect.</p><p>Browser support is presented as a governed adapter seam; there is no hidden second browser owner in the runtime.</p></div>
          </Panel>
        </div>
      </div>
    </section>
  );
}

function Panel({title,icon,children}:{title:string;icon:ReactNode;children:ReactNode}){return <section className="min-w-0 rounded-lg border border-border bg-bg p-3"><div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-subtle">{icon}{title}</div>{children}</section>}
function Stat({label,value}:{label:string;value:string}){return <div className="rounded-md border border-border bg-bg p-2"><p className="text-[10px] uppercase tracking-wider text-subtle">{label}</p><p className="mt-1 break-all font-mono text-sm text-fg">{value}</p></div>}
