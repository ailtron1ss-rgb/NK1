import { useEffect, useState } from "react";
import { neuroApi } from "@/neuro-kurisu/api";

type ResearchStatus = {
  ok?: boolean;
  neurocore?: { version: string; evidence: Record<string, unknown>; mode: string };
  nomega?: { version: string; forge: string; registry?: Record<string, unknown>; mode: string };
  deepcode?: { version: string; entrypoint: string; mode: string };
};

type Probe = Record<string, unknown> | null;
type ApprovalRequest = { id: string; toolId: string; permissionClass: string; expiresAt: number; reasonCode?: string; inputPreview?: Record<string, unknown> };

export function ResearchDock() {
  const [status, setStatus] = useState<ResearchStatus | null>(null);
  const [probe, setProbe] = useState<Probe>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);

  const load = async () => {
    try { setStatus(await neuroApi.researchStatus() as ResearchStatus); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { void load(); }, []);

  const run = async (kind: "neurocore" | "nomega-registry" | "deepcode", approvalId?: string) => {
    setRunning(kind); setError(null);
    try { setProbe(await neuroApi.researchProbe(kind, approvalId)); setApprovalRequest(null); }
    catch (e) {
      const detail=e as Error & { data?: { approvalRequired?: boolean; approvalRequest?: ApprovalRequest; error?: string } };
      if(detail.data?.approvalRequired && detail.data.approvalRequest) {
        setApprovalRequest({ ...detail.data.approvalRequest, ...(detail.data.approvalRequest.toolId ? {} : {toolId:`http.research.probe.${kind}`}) });
        setError(`Для этой проверки требуется однократное разрешение. Проверка ещё не запускалась.`);
      } else setError(e instanceof Error ? e.message : String(e));
    }
    finally { setRunning(null); }
  };

  const approveAndRun = async () => {
    if(!approvalRequest) return;
    const ticket=approvalRequest;
    const kind=ticket.toolId.endsWith('nomega-registry') ? 'nomega-registry' : ticket.toolId.endsWith('deepcode') ? 'deepcode' : 'neurocore';
    setRunning(kind); setError(null);
    try {
      await neuroApi.resolveToolPermission(ticket.id,true);
      setApprovalRequest(null);
      setProbe(await neuroApi.researchProbe(kind,ticket.id));
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRunning(null); }
  };

  const declineProbe = async () => {
    if(!approvalRequest) return;
    try { await neuroApi.resolveToolPermission(approvalRequest.id,false); setApprovalRequest(null); setError('Проверка отклонена. Исследовательский код не запускался.'); }
    catch(e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-3">
      <ResearchCard title="NeuroCore V143" mode={status?.neurocore?.mode || "research-only"} version={status?.neurocore?.version || "—"} actionLabel="Запустить проверку FwPKM" running={running === "neurocore"} onClick={() => void run("neurocore")} />
      <ResearchCard title="NOMEGA Pass20" mode={status?.nomega?.mode || "governed"} version={status?.nomega?.version || "—"} actionLabel="Просканировать канонический реестр" running={running === "nomega-registry"} onClick={() => void run("nomega-registry")} />
      <ResearchCard title="DeepCode / v21" mode={status?.deepcode?.mode || "research-only"} version={status?.deepcode?.version || "—"} actionLabel="Запустить smoke-проверку" running={running === "deepcode"} onClick={() => void run("deepcode")} />
    </div>
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs uppercase tracking-wider text-subtle">Исследовательский мост</p><p className="text-sm text-muted">Панель предварительной проверки только для чтения. Она не заменяет владельца Neuro-Kurisu и не продвигает код автоматически.</p></div>
        <button type="button" onClick={() => void load()} className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted hover:text-fg">Обновить</button>
      </div>
      {error ? <p className="mt-2 text-xs text-muted" role="status">{error}</p> : null}
      {approvalRequest ? <section className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3" aria-label="Запрос разрешения на исследовательскую проверку">
        <p className="text-xs font-semibold text-fg">Требуется однократное разрешение</p>
        <p className="mt-1 text-[10px] text-muted">Проверка запускает локальный исследовательский сценарий и может долго использовать процессор. Она не начнётся без вашего разрешения именно на эту проверку. Разрешение истекает в {new Date(approvalRequest.expiresAt).toLocaleTimeString()}.</p>
        <p className="mt-2 break-all font-mono text-[10px] text-fg">{approvalRequest.toolId} · {approvalRequest.id}</p>
        <pre className="mt-2 overflow-auto rounded border border-border bg-bg p-2 text-[10px] text-muted">{JSON.stringify(approvalRequest.inputPreview ?? {},null,2)}</pre>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={running!==null} onClick={() => void approveAndRun()} className="rounded-md border border-border px-3 py-2 text-xs font-medium text-fg hover:border-accent disabled:opacity-50">Разрешить один запуск</button>
          <button type="button" disabled={running!==null} onClick={() => void declineProbe()} className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:text-fg disabled:opacity-50">Отказать</button>
        </div>
      </section> : null}
      {probe ? <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-border bg-black/20 p-3 text-[10px] leading-relaxed text-muted">{JSON.stringify(probe, null, 2)}</pre> : null}
    </div>
  </div>;
}

function researchModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    "research-only": "Только исследования",
    governed: "Управляемый режим",
    production: "Эксплуатационный режим",
    disabled: "Отключён",
  };
  return labels[mode] ?? mode;
}

function ResearchCard({ title, mode, version, actionLabel, running, onClick }: { title: string; mode: string; version: string; actionLabel: string; running: boolean; onClick: () => void }) {
  return <article className="rounded-lg border border-border bg-bg p-3">
    <div className="flex items-start justify-between gap-2"><div><h4 className="text-sm text-fg">{title}</h4><p className="mt-0.5 font-mono text-[10px] text-subtle">{version}</p></div><span className="rounded-full border border-border px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted">{researchModeLabel(mode)}</span></div>
    <button type="button" disabled={running} onClick={onClick} className="mt-3 w-full rounded-md border border-border px-2 py-2 text-xs text-muted hover:border-accent hover:text-fg disabled:opacity-50">{running ? "выполняется…" : actionLabel}</button>
  </article>;
}
