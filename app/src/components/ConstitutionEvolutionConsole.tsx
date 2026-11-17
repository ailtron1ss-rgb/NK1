import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { neuroApi } from "@/neuro-kurisu/api";

type AnyRecord = Record<string, any>;
type Change = "add" | "amend" | "retire";
type Domain = "workflow" | "quality" | "performance" | "resource" | "operations";
type Risk = "low" | "medium" | "high" | "critical";
const domains: Domain[] = ["workflow", "quality", "performance", "resource", "operations"];
const field = "mt-1 min-h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg";
const label = "block text-xs font-medium text-muted";
const splitLines = (value: string) => value.split("\n").map(x => x.trim()).filter(Boolean);

function reviewTemplate(p: AnyRecord): string {
  return JSON.stringify({ payload: {
    schemaVersion: 1, proposalId: p.id, candidateDigest: p.candidateDigest,
    reviewerId: "<configured-reviewer-id>", decision: "approve", invariantsPassed: true,
    tests: { planned: p.testPlan?.length ?? 0, executed: 0, passed: 0, failed: 0, holdoutCases: 0, holdoutPassed: false },
    evidenceRefs: [], rationale: "<independent review rationale>", at: Date.now(),
  }, signature: "<base64-ed25519-signature>" }, null, 2);
}

export function ConstitutionEvolutionConsole() {
  const [state, setState] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [change, setChange] = useState<Change>("add");
  const [targetRuleId, setTargetRuleId] = useState("");
  const [ruleId, setRuleId] = useState("workflow.reproducible-evidence");
  const [title, setTitle] = useState("Reproducible workflow evidence");
  const [statement, setStatement] = useState("Workflow changes retain source revision, command, environment, and test results so validation can be reproduced.");
  const [domain, setDomain] = useState<Domain>("workflow");
  const [scope, setScope] = useState("CI and engineering workflows that mutate code or configuration.");
  const [motivation, setMotivation] = useState("Reduce untraceable engineering changes and make regressions reproducible.");
  const [counterexample, setCounterexample] = useState("A workflow reports success but preserves no source revision or test output.");
  const [risk, setRisk] = useState<Risk>("medium");
  const [riskSummary, setRiskSummary] = useState("Evidence retention adds bounded storage and execution overhead.");
  const [mitigations, setMitigations] = useState("Bound evidence by size and retention time.\nNever include credentials or private content in evidence.");
  const [testPlan, setTestPlan] = useState("Validate source revision, command, and environment provenance.\nReject missing holdout evidence.");
  const [reviewText, setReviewText] = useState<Record<string, string>>({});
  const [rollbackTarget, setRollbackTarget] = useState("1.0.0");
  const [rollbackReason, setRollbackReason] = useState("Rollback after a reproduced operational regression.");

  const refresh = useCallback(async () => {
    try { setState(await neuroApi.constitution()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load constitutional governance state."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const rules: AnyRecord[] = useMemo(() => Array.isArray(state?.active?.rules) ? state!.active.rules.filter((r: AnyRecord) => r.enabled) : [], [state]);
  const selectedRule = rules.find(r => r.id === targetRuleId) ?? null;
  const proposals: AnyRecord[] = Array.isArray(state?.proposals) ? state!.proposals : [];
  const auditEvents: AnyRecord[] = Array.isArray(state?.auditEvents) ? state!.auditEvents : [];
  const invariants: AnyRecord[] = Array.isArray(state?.protectedInvariants) ? state!.protectedInvariants : [];
  const authority = state?.reviewAuthority ?? {};
  const diagnostics = state?.diagnostics ?? {};

  async function perform(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key); setError(null); setNotice(null);
    try { await action(); setNotice(success); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Governance operation was rejected."); await refresh(); }
    finally { setBusy(null); }
  }

  async function submitProposal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const mitigationsList = splitLines(mitigations), plan = splitLines(testPlan);
    if (!motivation.trim() || !scope.trim() || !counterexample.trim() || !riskSummary.trim() || !mitigationsList.length || !plan.length) {
      setError("Provide motivation, scope, counterexample, risk summary, at least one mitigation, and a test plan."); return;
    }
    if (change !== "add" && !selectedRule) { setError("Select an active mutable rule to amend or retire."); return; }
    if (change !== "retire" && (!title.trim() || !statement.trim() || (change === "add" && !ruleId.trim()))) {
      setError("Rule ID, title, and statement are required for add/amend."); return;
    }
    let proposedRule: AnyRecord | undefined;
    if (change === "add") {
      proposedRule = {
        id: ruleId.trim(), title: title.trim(), statement: statement.trim(),
        domain, scope: scope.trim(),
      };
    } else if (change === "amend") {
      // Re-resolve at submit time so a stale/removed selection can never be
      // dereferenced or turned into an amendment against an unknown rule.
      const target = rules.find(rule => rule.id === targetRuleId && rule.enabled);
      if (!target) {
        setError("The selected mutable rule is no longer active. Refresh and select an active rule.");
        return;
      }
      proposedRule = {
        id: target.id, title: title.trim(), statement: statement.trim(),
        domain: target.domain, scope: scope.trim(),
      };
    }
    const payload = {
      baseVersion: state?.active?.version, change,
      ...(change !== "add" ? { targetRuleId } : {}), ...(proposedRule ? { proposedRule } : {}),
      motivation: motivation.trim(), scope: scope.trim(), counterexample: counterexample.trim(),
      riskAssessment: { level: risk, summary: riskSummary.trim(), mitigations: mitigationsList }, testPlan: plan,
    };
    await perform("proposal", () => neuroApi.proposeConstitution(payload), "Proposal submitted. Independent signed review is required before ratification.");
  }

  async function submitReview(id: string) {
    try {
      const artifact = JSON.parse(reviewText[id] ?? "");
      await perform("review:" + id, () => neuroApi.reviewConstitution(id, artifact), "Signed independent review accepted.");
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid reviewer artifact JSON."); }
  }

  return <section className="mt-4 rounded-xl border border-border bg-surface p-4 md:p-5" aria-label="Constitution evolution console">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs uppercase tracking-widest text-subtle">OmeStro #20</p><h2 className="text-lg font-semibold text-fg">Constitution Evolution</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">Versioned rules evolve only inside five bounded domains. Protected invariants stay outside the mutable rule set; P69 remains the final runtime arbiter.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading || busy !== null} className="h-9 rounded-md border border-border px-3 text-xs text-muted hover:text-fg disabled:opacity-50">Refresh</button>
    </div>
    {error ? <div className="mt-3 rounded-md border border-rose-500/40 bg-bg p-3 text-xs text-rose-300" role="alert">{error}</div> : null}
    {notice ? <div className="mt-3 rounded-md border border-border bg-bg p-3 text-xs text-fg" role="status">{notice}</div> : null}
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Active version" value={state?.active?.version ?? (loading ? "…" : "unavailable")} />
      <Metric label="Mutable rules" value={String(diagnostics.mutableRuleCount ?? 0)} />
      <Metric label="Revisions retained" value={String(diagnostics.revisionCount ?? 0)} />
      <Metric label="Audit events" value={String(diagnostics.auditEventCount ?? 0)} />
    </div>
    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted">
      <span className="rounded border border-border px-2 py-1">Host HMAC: {diagnostics.signedState ? "configured" : "missing · mutation disabled"}</span>
      <span className="rounded border border-border px-2 py-1">Trusted reviewers: {authority.trustedReviewerCount ?? 0}</span>
      <span className="rounded border border-border px-2 py-1">Restore: {diagnostics.lastRestore?.reason ?? "not checked"}</span>
    </div>

    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-border bg-bg p-3">
        <h3 className="text-sm font-semibold text-fg">Protected invariants</h3>
        <p className="mt-1 text-[11px] text-muted">Compiled baseline. These cannot be amended or retired here.</p>
        <ul className="mt-3 space-y-2">{invariants.map(item => <li key={item.id} className="flex flex-wrap gap-x-2 text-xs"><span className="font-mono text-subtle">{item.id}</span><span className="text-muted">{item.statement}</span></li>)}</ul>
        <h3 className="mt-5 text-sm font-semibold text-fg">Active mutable rules</h3>
        <ul className="mt-2 space-y-2">
          {rules.map(rule => <li key={rule.id} className="rounded border border-border p-2"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-medium text-fg">{rule.title}</span><span className="font-mono text-[10px] text-subtle">{rule.domain}</span></div><p className="mt-1 text-[11px] text-muted">{rule.statement}</p><p className="mt-1 font-mono text-[10px] text-subtle">{rule.id}</p></li>)}
          {rules.length === 0 ? <li className="text-xs text-muted">No mutable rules are active yet.</li> : null}
        </ul>
      </div>

      <form onSubmit={submitProposal} className="rounded-lg border border-border bg-bg p-3">
        <h3 className="text-sm font-semibold text-fg">Propose a change</h3>
        <p className="mt-1 text-[11px] text-muted">The host assigns the author identity. The client cannot name its own reviewer or approver.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Change"><select className={field} value={change} onChange={e => setChange(e.target.value as Change)}><option value="add">Add rule</option><option value="amend">Amend rule</option><option value="retire">Retire rule</option></select></Field>
          {change === "add" ? <Field label="Domain"><select className={field} value={domain} onChange={e => setDomain(e.target.value as Domain)}>{domains.map(x => <option key={x}>{x}</option>)}</select></Field> : <Field label="Target active rule"><select className={field} value={targetRuleId} onChange={e => setTargetRuleId(e.target.value)}><option value="">Select…</option>{rules.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}</select></Field>}
          {change !== "retire" ? <>
            {change === "add" ? <Field label="Rule ID"><input className={field} value={ruleId} onChange={e => setRuleId(e.target.value)} /></Field> : null}
            <Field label="Rule title"><input className={field} value={title} onChange={e => setTitle(e.target.value)} /></Field>
            <Field label="Rule statement" wide><textarea className={field + " min-h-20"} value={statement} onChange={e => setStatement(e.target.value)} /></Field>
          </> : null}
          <Field label="Scope" wide><textarea className={field + " min-h-16"} value={scope} onChange={e => setScope(e.target.value)} /></Field>
          <Field label="Motivation" wide><textarea className={field + " min-h-16"} value={motivation} onChange={e => setMotivation(e.target.value)} /></Field>
          <Field label="Counterexample" wide><textarea className={field + " min-h-16"} value={counterexample} onChange={e => setCounterexample(e.target.value)} /></Field>
          <Field label="Risk level"><select className={field} value={risk} onChange={e => setRisk(e.target.value as Risk)}>{(["low","medium","high","critical"] as Risk[]).map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Risk summary"><input className={field} value={riskSummary} onChange={e => setRiskSummary(e.target.value)} /></Field>
          <Field label="Mitigations · one per line" wide><textarea className={field + " min-h-16"} value={mitigations} onChange={e => setMitigations(e.target.value)} /></Field>
          <Field label="Test plan · one per line" wide><textarea className={field + " min-h-20"} value={testPlan} onChange={e => setTestPlan(e.target.value)} /></Field>
        </div>
        <button type="submit" disabled={busy !== null || loading} className="mt-3 h-10 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-50">{busy === "proposal" ? "Submitting…" : "Submit proposal"}</button>
      </form>
    </div>

    <div className="mt-5"><h3 className="text-sm font-semibold text-fg">Proposal lifecycle</h3>
      <p className="mt-1 text-[11px] text-muted">Independent reviews require a configured Ed25519 signature. High/critical changes require two reviewers. Ratification and rollback use one-shot ActionGateway approval cards.</p>
      <div className="mt-3 space-y-3">
        {proposals.map(p => <article key={p.id} className="rounded-lg border border-border bg-bg p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-medium text-fg">{p.proposedRule?.title ?? p.targetRuleId ?? p.change}</p><p className="mt-1 font-mono text-[10px] text-subtle">{p.id}</p></div><div className="flex gap-2 text-[10px]"><span className="rounded border border-border px-2 py-1">{p.status}</span><span className="rounded border border-border px-2 py-1">{p.riskAssessment?.level} risk</span></div></div>
          <p className="mt-2 text-xs text-muted">{p.motivation}</p><p className="mt-2 break-all font-mono text-[10px] text-subtle">candidate digest · {p.candidateDigest}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted"><span>{p.reviews?.length ?? 0} review(s)</span><span>{p.testPlan?.length ?? 0} planned test(s)</span>{p.appliedVersion ? <span>applied {p.appliedVersion}</span> : null}{p.rejectionReason ? <span className="text-rose-300">{p.rejectionReason}</span> : null}</div>
          {Array.isArray(p.reviews) && p.reviews.length > 0 ? <div className="mt-3 rounded-md border border-border p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Verified reviewer evidence</p>
            <ul className="mt-2 space-y-2">{p.reviews.map((review: AnyRecord, index: number) => <li key={review.reviewerId + ":" + index} className="text-[11px]">
              <div className="flex flex-wrap gap-2"><span className="font-medium text-fg">{review.reviewerId}</span><span className="text-muted">{review.decision}</span><span className="text-muted">tests {review.tests?.passed ?? 0}/{review.tests?.planned ?? 0}</span><span className="text-muted">holdout {review.tests?.holdoutCases ?? 0} · {review.tests?.holdoutPassed ? "passed" : "not passed"}</span></div>
              <p className="mt-1 text-muted">{review.rationale}</p>
              <p className="mt-1 break-all font-mono text-[9px] text-subtle">evidence: {(review.evidenceRefs ?? []).join(" · ")}</p>
              {review.attestationMac ? <p className="mt-1 break-all font-mono text-[9px] text-subtle">host attestation · {review.attestationMac}</p> : null}
            </li>)}</ul>
          </div> : null}
          {p.approval ? <p className="mt-2 break-all text-[10px] text-muted">Ratified by {p.approval.approverId} · ticket {p.approval.approvalRef}</p> : null}
          {p.status === "pending-review" && authority.trustedReviewerCount > 0 ? <div className="mt-3">
            <label className={label}>Signed reviewer artifact · paste external JSON<textarea className={field + " min-h-32 font-mono text-[11px]"} value={reviewText[p.id] ?? reviewTemplate(p)} onChange={e => setReviewText(current => ({ ...current, [p.id]: e.target.value }))} /></label>
            <p className="mt-1 text-[10px] text-muted">Trusted reviewer IDs: {(authority.reviewerIds ?? []).join(", ")}</p>
            <button type="button" onClick={() => void submitReview(p.id)} disabled={busy !== null} className="mt-2 h-9 rounded-md border border-border px-3 text-xs text-fg disabled:opacity-50">{busy === "review:" + p.id ? "Verifying…" : "Verify signed review"}</button>
          </div> : null}
          {p.status === "awaiting-ratification" ? <button type="button" onClick={() => void perform("ratify:" + p.id, () => neuroApi.ratifyConstitution(p.id), "Ratification consumed through ActionGateway.")} disabled={busy !== null} className="mt-3 h-9 rounded-md border border-border px-3 text-xs text-fg disabled:opacity-50">{busy === "ratify:" + p.id ? "Waiting for owner approval…" : "Request owner ratification"}</button> : null}
          {p.status === "ratified" ? <button type="button" onClick={() => void perform("activate:" + p.id, () => neuroApi.activateConstitution(p.id), "New constitutional revision activated.")} disabled={busy !== null} className="mt-3 h-9 rounded-md bg-accent px-3 text-xs font-medium text-accent-fg disabled:opacity-50">{busy === "activate:" + p.id ? "Activating…" : "Activate revision"}</button> : null}
        </article>)}
        {proposals.length === 0 ? <p className="text-xs text-muted">No constitutional proposals yet.</p> : null}
      </div>
    </div>

    <div className="mt-5 rounded-lg border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-fg">Constitutional audit trail</h3><p className="mt-1 text-[11px] text-muted">Newest first · {auditEvents.length} retained signed events</p></div><span className="font-mono text-[10px] text-subtle">bounded ledger</span></div>
      <div className="mt-3 space-y-2">{auditEvents.slice(0,32).map(event => <article key={event.id} className="rounded border border-border p-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[10px] text-fg">{event.type}</span><time className="text-[10px] text-muted">{new Date(event.at).toLocaleString()}</time></div>
        <p className="mt-1 text-[11px] text-muted">{event.summary}</p>
        <div className="mt-1 flex flex-wrap gap-2 font-mono text-[9px] text-subtle"><span>actor · {event.actorId}</span><span>{event.fromVersion} → {event.toVersion ?? "pending"}</span></div>
        <p className="mt-1 break-all font-mono text-[9px] text-subtle">event digest · {event.digest}</p>
      </article>)}{auditEvents.length === 0 ? <p className="text-xs text-muted">No constitutional events recorded yet.</p> : null}</div>
    </div>

    <div className="mt-5 rounded-lg border border-border bg-bg p-3"><h3 className="text-sm font-semibold text-fg">Audited rollback</h3>
      <p className="mt-1 text-[11px] text-muted">Rollback appends a new revision pointing to a retained version; superseded history is never deleted.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
        <Field label="Target version"><select className={field} value={rollbackTarget} onChange={e => setRollbackTarget(e.target.value)}>{(Array.isArray(state?.revisions) ? state.revisions.map((revision: AnyRecord) => revision.version) : ["1.0.0"]).map((v: string) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Reason"><input className={field} value={rollbackReason} onChange={e => setRollbackReason(e.target.value)} /></Field>
        <div className="flex items-end"><button type="button" onClick={() => void perform("rollback", () => neuroApi.rollbackConstitution(rollbackTarget, rollbackReason), "Rollback approval consumed and a new revision appended.")} disabled={busy !== null || !rollbackReason.trim()} className="h-10 rounded-md border border-border px-3 text-xs text-fg disabled:opacity-50">{busy === "rollback" ? "Waiting for owner approval…" : "Request rollback"}</button></div>
      </div>
    </div>
  </section>;
}

function Field({ label: text, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={label + (wide ? " sm:col-span-2" : "")}>{text}{children}</label>;
}
function Metric({ label: text, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-bg px-3 py-2"><p className="text-[10px] uppercase tracking-wider text-subtle">{text}</p><p className="mt-1 font-mono text-sm text-fg">{value}</p></div>;
}
