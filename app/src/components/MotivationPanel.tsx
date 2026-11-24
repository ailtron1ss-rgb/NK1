import type { OrganismSnapshot } from "@/organism/types";
import type { UiConnectionState } from "@/organism/store";

const drives: Array<{ key: keyof OrganismSnapshot["needs"]; label: string; hint: string }> = [
  { key: "energy", label: "Energy", hint: "Available internal resource" },
  { key: "cognitiveLoad", label: "Cognitive load", hint: "Current processing pressure" },
  { key: "uncertainty", label: "Uncertainty", hint: "Unresolved prediction or context" },
  { key: "socialNeed", label: "Social need", hint: "Pressure for interaction" },
  { key: "novelty", label: "Novelty", hint: "Demand for new information" },
  { key: "sleepPressure", label: "Rest pressure", hint: "Homeostatic pressure for rest" },
  { key: "goalPressure", label: "Goal pressure", hint: "Unresolved goal urgency" },
  { key: "identityCoherence", label: "Identity coherence", hint: "Continuity of the self-model" },
];

export function MotivationPanel({ snap, connection }: { snap: OrganismSnapshot; connection: UiConnectionState }) {
  const hasCanonicalSnapshot = connection.lastSyncedAt !== null;
  const goals = snap.goals.slice().sort((a, b) => (b.urgency + b.importance) - (a.urgency + a.importance));
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,.8fr)]">
      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="font-display text-lg text-fg">Current goals</h2><p className="text-xs text-muted">Goals are read from the canonical runtime snapshot.</p></div>
          <span className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted">{hasCanonicalSnapshot ? goals.length + " records" : "Unavailable"}</span>
        </div>
        {!hasCanonicalSnapshot ? <p className="mt-4 rounded-lg border border-border bg-bg p-3 text-sm text-muted">Goals are hidden until the first canonical snapshot is confirmed. This prevents boot defaults from looking like real organism intent.</p> :
          goals.length === 0 ? <p className="mt-4 rounded-lg border border-border bg-bg p-3 text-sm text-muted">The runtime has not published any goals yet.</p> :
          <ul className="mt-4 space-y-3">{goals.map((goal) => (
            <li key={goal.id} className="rounded-lg border border-border bg-bg p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-medium text-fg">{goal.title}</p><span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">{goal.status}</span></div>
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted"><span>Source: {goal.source}</span><span>Urgency: {goal.urgency.toFixed(2)}</span><span>Importance: {goal.importance.toFixed(2)}</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-accent" style={{ width: (Math.max(0, Math.min(1, goal.progress)) * 100) + "%" }} /></div>
              <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-subtle">{(goal.progress * 100).toFixed(0)}%</p>
            </li>
          ))}</ul>
        }
      </section>
      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <h2 className="font-display text-lg text-fg">Homeostasis and drives</h2>
        <p className="text-xs text-muted">A read-only view of the current need channels.</p>
        {!hasCanonicalSnapshot ? <p className="mt-4 text-sm text-muted">Waiting for confirmed runtime state.</p> :
          <ul className="mt-4 space-y-3">{drives.map((drive) => {
            const raw = snap.needs[drive.key];
            const value = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : null;
            return <li key={drive.key}>
              <div className="flex items-center justify-between gap-2 text-xs"><span className="text-fg">{drive.label}</span><span className="font-mono tabular-nums text-muted">{value === null ? "Unknown" : value.toFixed(2)}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-accent" style={{ width: ((value ?? 0) * 100) + "%" }} /></div>
              <p className="mt-1 text-[10px] text-subtle">{drive.hint}</p>
            </li>;
          })}</ul>
        }
        {connection.status !== "connected" && hasCanonicalSnapshot ? <p className="mt-4 rounded-md border border-border bg-bg p-2 text-xs text-muted">Showing the last confirmed values; the connection is {connection.status}.</p> : null}
      </section>
    </div>
  );
}
