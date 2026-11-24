import { ArrowDownRight, ArrowRight, Brain, CircleDot, GitBranch, ShieldCheck } from "lucide-react";

type RecordLike = Record<string, unknown>;
const asRecord = (value: unknown): RecordLike | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordLike : null;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asText = (value: unknown, fallback = "—"): string => typeof value === "string" && value.trim() ? value : fallback;
const listOfText = (value: unknown): string[] => asArray(value).filter((item): item is string => typeof item === "string");
const LAYER_LABELS: Record<string, string> = {
  sensorium: "Perception", attention: "Attention", "affect-homeostasis": "Emotion & drives", "self-model": "Self-model",
  "goals-values": "Goals & values", "world-model": "World model", memory: "Memory", executive: "Executive",
  embodiment: "Action & body", "outcome-learning": "Outcome learning", social: "Social cognition", metacognition: "Metacognition",
  lifecycle: "Life cycle", research: "Research",
};

/** Read-only visualization of the canonical runtime graph; this is not a second scheduler or state owner. */
export function BrainArchitecturePanel({ payload }: { payload: unknown }) {
  const envelope = asRecord(payload);
  const architecture = asRecord(envelope?.architecture) ?? asRecord(payload);
  if (!architecture) return null;
  const mainSystem = asRecord(architecture.mainSystem);
  const validation = asRecord(architecture.validation);
  const runtimeSnapshot = asRecord(architecture.runtimeSnapshot);
  const runtimeSystems = asArray(runtimeSnapshot?.systems).map(asRecord).filter((item): item is RecordLike => Boolean(item));
  const availableRuntimeSystems = runtimeSystems.filter((item) => item.available === true).length;
  const subsystems = asArray(architecture.subsystems).map(asRecord).filter((item): item is RecordLike => Boolean(item));
  const flows = asArray(architecture.flows).map(asRecord).filter((item): item is RecordLike => Boolean(item));
  if (!mainSystem || subsystems.length === 0) return null;
  const flowCounts = flows.reduce<Record<string, number>>((counts, flow) => {
    const kind = asText(flow.kind, "other");
    counts[kind] = (counts[kind] ?? 0) + 1;
    return counts;
  }, {});
  const valid = validation?.ok === true;

  return (
    <section aria-label="Neuro-Kurisu brain architecture" className="mb-3 space-y-3 rounded-lg border border-border p-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Brain className="mt-0.5 size-5 text-fg" />
          <div>
            <h3 className="text-sm font-semibold text-fg">{asText(mainSystem.label, "Neuro-Kurisu cognitive organism")}</h3>
            <p className="mt-1 max-w-3xl text-xs text-muted">Один организм и один владелец состояния. Карточки показывают существующие подсистемы и связи, а не создают параллельный runtime.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${valid ? "border-emerald-700/40 text-emerald-700" : "border-amber-700/40 text-amber-700"}`}>
          <ShieldCheck className="size-3" />{valid ? "Graph contract valid" : "Graph needs attention"}
        </span>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-border p-2"><p className="text-[10px] uppercase tracking-wide text-muted">Cognitive systems</p><p className="mt-1 text-lg font-semibold text-fg">{subsystems.length}</p></div>
        <div className="rounded-md border border-border p-2"><p className="text-[10px] uppercase tracking-wide text-muted">Directed flows</p><p className="mt-1 text-lg font-semibold text-fg">{flows.length}</p></div>
        <div className="rounded-md border border-border p-2"><p className="text-[10px] uppercase tracking-wide text-muted">Feedback / governance</p><p className="mt-1 text-lg font-semibold text-fg">{(flowCounts.feedback ?? 0) + (flowCounts.governance ?? 0)}</p></div>
        {runtimeSnapshot && <div className="rounded-md border border-border p-2 sm:col-span-3"><p className="text-[10px] uppercase tracking-wide text-muted">Live runtime snapshot</p><p className="mt-1 text-sm font-semibold text-fg">Tick {typeof runtimeSnapshot.tick === "number" && Number.isFinite(runtimeSnapshot.tick) ? runtimeSnapshot.tick : "unknown"} · {availableRuntimeSystems}/{runtimeSystems.length} composed systems available</p><div className="mt-2 flex flex-wrap gap-1">{runtimeSystems.map((system) => <span key={asText(system.systemName)} className={`rounded border px-1.5 py-0.5 text-[9px] ${system.available === true ? "border-emerald-700/40 text-emerald-700" : "border-amber-700/40 text-amber-700"}`}>{asText(system.systemName)}: {system.available === true ? "available" : "unavailable"}{typeof system.snapshotMs === "number" ? ` · ${system.snapshotMs}ms` : ""}</span>)}</div></div>}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {subsystems.map((system) => {
          const id = asText(system.id, "unknown");
          const outputs = listOfText(system.outputs);
          const dependsOn = listOfText(system.dependsOn);
          const components = listOfText(system.components);
          return <article key={id} className="min-w-0 rounded-md border border-border p-3">
            <div className="flex items-start gap-2">
              <CircleDot className="mt-0.5 size-4 shrink-0 text-subtle" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-fg">{asText(system.label, id)}</h4>
                <p className="mt-1 text-[10px] text-muted">{LAYER_LABELS[asText(system.layer)] ?? asText(system.layer)} · {asText(system.cadence)}</p>
              </div>
            </div>
            <p className="mt-2 break-words text-[10px] text-muted"><span className="font-semibold text-fg">Owner:</span> {asText(system.owner)}</p>
            {outputs.length > 0 && <div className="mt-2"><p className="text-[10px] font-semibold text-fg">Produces</p><ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-muted">{outputs.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul></div>}
            {dependsOn.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{dependsOn.map((dependency) => <span key={dependency} className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted">{dependency}</span>)}</div>}
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] text-muted">Implementation paths ({components.length})</summary>
              <ul className="mt-1 space-y-1">{components.map((component) => <li key={component} className="break-all font-mono text-[9px] text-muted">{component}</li>)}</ul>
            </details>
          </article>;
        })}
      </div>

      <details className="rounded-md border border-border p-2">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-fg"><GitBranch className="size-4" />Inspect typed information flows</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {flows.map((flow, index) => <div key={`${asText(flow.from)}-${asText(flow.to)}-${index}`} className="flex min-w-0 items-start gap-2 rounded border border-border/70 p-2">
            {asText(flow.kind) === "feedback" ? <ArrowDownRight className="mt-0.5 size-3 shrink-0 text-subtle" /> : <ArrowRight className="mt-0.5 size-3 shrink-0 text-subtle" />}
            <div className="min-w-0"><p className="break-words text-[10px] text-fg">{asText(flow.from)} → {asText(flow.to)}</p><p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted">{asText(flow.kind)}</p><p className="mt-1 text-[10px] text-muted">{asText(flow.signal)}</p></div>
          </div>)}
        </div>
      </details>
      <p className="text-[10px] text-muted">Это инженерная модель когнитивной архитектуры; сама карта и успешные тесты не доказывают субъективное сознание.</p>
    </section>
  );
}
