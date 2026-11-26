import { useCallback, useEffect, useState } from "react";
import { Activity, Download, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neuroApi } from "@/neuro-kurisu/api";
import { parseRuntimeRecovery, readFiniteMetric, safeRecord, type RuntimeRecoveryItem } from "@/organism/runtimeDiagnostics";

function display(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (value === null || value === undefined) return "Недоступно";
  try { return JSON.stringify(value).slice(0, 180); } catch { return "Недоступно"; }
}

const METRIC_LABELS: Record<string, string> = {
  autonomyScore: "Автономность",
  predictionError: "Ошибка предсказания",
  selfPredictionError: "Ошибка самопредсказания",
  identityContinuity01: "Непрерывность идентичности",
  workspaceIgnition01: "Запуск рабочего пространства",
  workspaceRecurrence01: "Повторяемость рабочего пространства",
  cognitiveLoad: "Когнитивная нагрузка",
  sleepPressure: "Давление сна",
  socialNeed: "Социальная потребность",
  goalPressure: "Давление цели",
  energy: "Энергия",
  uncertainty: "Неопределённость",
};

function metricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/01$/i, "").replace(/^./, (value) => value.toUpperCase());
}

function RecoveryCard({ item }: { item: RuntimeRecoveryItem }) {
  return (
    <article className="rounded-md border border-border bg-bg p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><p className="break-all text-xs font-semibold text-fg">{item.action}</p><p className="mt-1 break-all font-mono text-[9px] text-subtle">{item.id}</p></div>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">{item.status}</span>
      </div>
      {item.reason ? <p className="mt-2 text-[10px] text-muted">Причина: {item.reason}</p> : null}
      {item.outcome ? <p className="mt-1 text-[10px] text-muted">Результат: {item.outcome}</p> : null}
      <details className="mt-2"><summary className="cursor-pointer text-[10px] text-subtle">Запись восстановления · только просмотр</summary><pre className="mt-2 max-h-36 overflow-auto rounded bg-surface p-2 text-[9px] text-muted">{JSON.stringify(item.raw, null, 2)}</pre></details>
    </article>
  );
}

export function RuntimeHealthPanel() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [recovery, setRecovery] = useState<RuntimeRecoveryItem[]>([]);
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportData, setExportData] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    const results = await Promise.allSettled([
      neuroApi.statusLite(),
      neuroApi.session(),
      neuroApi.actionRecovery(32),
    ]);
    const nextErrors: string[] = [];
    let nextStatus: Record<string, unknown> | null = null;
    let nextSession: Record<string, unknown> | null = null;
    let nextRecovery: RuntimeRecoveryItem[] = [];
    let nextRecoveryNote: string | null = null;
    const raw: Record<string, unknown> = {};
    if (results[0].status === "fulfilled") {
      nextStatus = safeRecord(results[0].value);
      raw.status = results[0].value;
    } else nextErrors.push("Операционный статус: " + (results[0].reason instanceof Error ? results[0].reason.message : String(results[0].reason)));
    if (results[1].status === "fulfilled") {
      nextSession = safeRecord(results[1].value);
      raw.session = results[1].value;
    } else nextErrors.push("Непрерывность сессии: " + (results[1].reason instanceof Error ? results[1].reason.message : String(results[1].reason)));
    if (results[2].status === "fulfilled") {
      nextRecovery = parseRuntimeRecovery(results[2].value);
      const recoveryRoot = safeRecord(results[2].value);
      nextRecoveryNote = typeof recoveryRoot?.note === "string" ? recoveryRoot.note : null;
      raw.recovery = results[2].value;
    } else nextErrors.push("Очередь восстановления действий: " + (results[2].reason instanceof Error ? results[2].reason.message : String(results[2].reason)));
    setStatus(nextStatus);
    setSession(nextSession);
    setRecovery(nextRecovery);
    setRecoveryNote(nextRecoveryNote);
    setErrors(nextErrors);
    setUpdatedAt(Date.now());
    setExportData(raw);
    setBusy(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  const exportSnapshot = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "neurocore-runtime-diagnostics.json";
    anchor.click();
    URL.revokeObjectURL(href);
  };

  const body = safeRecord(status?.body);
  const metrics = [
    ["Автономность", readFiniteMetric(status?.autonomyScore)],
    ["Ошибка предсказания", readFiniteMetric(status?.predictionError)],
    ["Ошибка самопредсказания", readFiniteMetric(status?.selfPredictionError)],
    ["Непрерывность идентичности", readFiniteMetric(status?.identityContinuity01)],
    ["Запуск рабочего пространства", readFiniteMetric(status?.workspaceIgnition01)],
  ] as const;
  const bodyMetrics = body ? Object.entries(body).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])).slice(0, 8) : [];
  const sessionCurrent = safeRecord(session?.current);
  const continuity = safeRecord(session?.continuity);

  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:p-5" aria-label="Состояние runtime и восстановление действий">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs uppercase tracking-widest text-subtle">Операции runtime</p><h2 className="font-display text-xl text-fg">Здоровье и восстановление</h2><p className="mt-1 text-xs text-muted">Операционные показатели, непрерывность сессии и неподтверждённые результаты внешних действий.</p></div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}><RefreshCw className="mr-1.5 size-3.5" />Обновить</Button>
          <Button type="button" variant="ghost" size="sm" disabled={!exportData} onClick={exportSnapshot}><Download className="mr-1.5 size-3.5" />Экспортировать</Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1"><Activity className="size-3.5" />{status ? "Операционный статус загружен" : "Ожидаем статус"}</span>
        {status?.version ? <span>{display(status.version)} · core {display(status.organismCore)}</span> : null}
        {status?.schemaVersion !== undefined ? <span>schema {display(status.schemaVersion)}</span> : null}
        {status?.tick !== undefined ? <span>tick {display(status.tick)}</span> : null}
        {updatedAt ? <span>Обновлено: {new Date(updatedAt).toLocaleTimeString()}</span> : null}
      </div>
      {errors.length ? <div className="mt-3 rounded-md border border-amber-500/40 bg-bg p-3" role="status"><p className="text-xs font-medium text-fg">Некоторые диагностические данные недоступны</p>{errors.map(error => <p key={error} className="mt-1 text-[10px] text-muted">{error}</p>)}</div> : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-bg p-3">
          <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-accent" /><h3 className="text-sm font-medium text-fg">Организм · runtime</h3></div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div><p className="text-[10px] text-subtle">Последнее действие</p><p className="text-xs text-fg">{display(status?.lastAction)}</p></div>
            <div><p className="text-[10px] text-subtle">Записи памяти</p><p className="font-mono text-xs text-fg">{display(status?.memoryCount)}</p></div>
            <div><p className="text-[10px] text-subtle">Активная цель</p><p className="text-xs text-fg">{display(status?.activeGoal)}</p></div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {metrics.map(([label, value]) => <div key={label}><div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-muted">{label}</span><span className="font-mono tabular-nums text-fg">{value === null ? "Неизвестно" : value.toFixed(3)}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-accent" style={{ width: ((value === null ? 0 : Math.max(0, Math.min(1, value))) * 100) + "%" }} /></div></div>)}
          </div>
          {bodyMetrics.length ? <details className="mt-3"><summary className="cursor-pointer text-[10px] text-muted">Телеметрия тела и устройства</summary><div className="mt-2 grid grid-cols-2 gap-2">{bodyMetrics.map(([key,value]) => <div key={key}><p className="text-[9px] text-subtle">{metricLabel(key)}</p><p className="font-mono text-xs text-fg">{value.toFixed(3)}</p></div>)}</div></details> : null}
        </section>

        <section className="rounded-lg border border-border bg-bg p-3">
          <h3 className="text-sm font-medium text-fg">Непрерывность сессии</h3>
          <p className="mt-1 break-all font-mono text-[10px] text-muted">{display(session?.sessionId)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Object.entries(sessionCurrent ?? {}).slice(0, 8).map(([key,value]) => <div key={key}><p className="text-[9px] text-subtle">{metricLabel(key)}</p><p className="break-words text-xs text-fg">{display(value)}</p></div>)}
          </div>
          {continuity ? <details className="mt-3"><summary className="cursor-pointer text-[10px] text-muted">Запись непрерывности</summary><pre className="mt-2 max-h-40 overflow-auto rounded bg-surface p-2 text-[9px] text-muted">{JSON.stringify(continuity, null, 2)}</pre></details> : null}
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-border bg-bg p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ShieldAlert className="size-4 text-amber-400" /><h3 className="text-sm font-medium text-fg">Очередь восстановления действий</h3></div><span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted">{recovery.length} записей</span></div>
        <p className="mt-1 text-[10px] leading-relaxed text-muted">{recoveryNote ?? "Список действий, внешний результат которых может потребовать сверки."} Панель работает только для просмотра и никогда не повторяет и не выполняет действия автоматически.</p>
        {recovery.length ? <div className="mt-3 grid gap-2 xl:grid-cols-2">{recovery.map(item => <RecoveryCard key={item.id} item={item} />)}</div> : !errors.some(error => error.startsWith("Очередь восстановления действий:")) ? <p className="mt-3 text-xs text-muted">Runtime не вернул записей для восстановления.</p> : null}
      </section>
    </section>
  );
}
