import { useMemo, useRef, useEffect, useState } from "react";
import type { OrganismSnapshot } from "@/organism/types";
import { useKurisu } from "@/organism/store";
import { cn } from "@/lib/utils";

export function Labs({ snap }: { snap: OrganismSnapshot }) {
  const tab = useKurisu((s) => s.tab);
  const setTab = useKurisu((s) => s.setTab);
  const tabs = [
    { id: "mind", label: "Mind" },
    { id: "memory", label: "Memory" },
    { id: "lab", label: "Inner lab" },
    { id: "skills", label: "Skills" },
    { id: "evidence", label: "Evidence" },
  ] as const;

  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="mb-4 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-11 rounded-md px-3 text-sm",
              tab === t.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "mind" ? <MindNote snap={snap} /> : null}
      {tab === "memory" ? <MemoryLab snap={snap} /> : null}
      {tab === "lab" ? <InnerLab snap={snap} /> : null}
      {tab === "skills" ? <SkillsLab snap={snap} /> : null}
      {tab === "evidence" ? <EvidenceLab snap={snap} /> : null}
    </section>
  );
}

function MindNote({ snap }: { snap: OrganismSnapshot }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Stat k="subject" v={snap.identity.subjectId.slice(-10)} />
      <Stat k="cycles" v={String(snap.identity.cycles)} />
      <Stat k="trust" v={snap.identity.trust.toFixed(2)} />
      <Stat k="replay" v={String(snap.replayCount)} />
      <Stat k="world error" v={snap.worldErrorEma.toFixed(4)} />
      <Stat k="language" v={String(snap.languageCalls)} />
      <div className="md:col-span-3">
        <h4 className="mb-2 text-xs uppercase tracking-wider text-subtle">Goals</h4>
        <ul className="space-y-2">
          {snap.goals.map((g) => (
            <li key={g.id}>
              <div className="flex justify-between text-sm">
                <span>{g.title}</span>
                <span className="tabular-nums text-muted">{(g.progress * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                <div className="h-full bg-accent" style={{ width: `${g.progress * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MemoryLab({ snap }: { snap: OrganismSnapshot }) {
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return snap.memories.filter((m) => !s || m.text.toLowerCase().includes(s)).slice(0, 24);
  }, [q, snap.memories]);
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search memories…"
        className="mb-3 h-11 w-full rounded-md border border-border bg-bg px-3 text-sm"
      />
      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {items.map((m) => (
          <li key={m.id} className="rounded-md border border-border bg-bg px-3 py-2">
            <p className="text-sm text-fg">{m.text}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-subtle">
              {m.kind} · {m.emotion} · pe {m.predictionError.toFixed(2)} · touches {m.touches}
              {m.verified ? " · verified" : ""}
            </p>
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm text-muted">No memories yet.</li> : null}
      </ul>
    </div>
  );
}

function InnerLab({ snap }: { snap: OrganismSnapshot }) {
  const world = snap.canonicalWorld;
  const metrics = [
    ["prediction error", world.predictionError01],
    ["latent confidence", world.latentConfidence01],
    ["workspace ignition", world.workspaceIgnition01],
    ["workspace recurrence", world.workspaceRecurrence01],
    ["metacognitive accuracy", world.metacognitiveAccuracy01],
    ["identity continuity", world.identityContinuity01],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat k="scene" v={world.scene} />
        <Stat k="world model" v={`${world.featureDim}f / ${world.hiddenDim}h`} />
        <Stat k="model samples" v={String(world.modelSamples)} />
        <Stat k="entities" v={String(world.entities)} />
        <Stat k="conflicts" v={String(world.conflicts)} />
        <Stat k="workspace diversity" v={world.workspaceDiversity01.toFixed(3)} />
      </div>
      <div className="rounded-lg border border-border bg-bg p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-subtle">Canonical semantic world</p>
            <p className="text-sm text-muted">Live projection of P27/P35/P23/P33 state. The legacy 2D renderer remains visual-only.</p>
          </div>
          <span className="rounded-full border border-border px-2 py-1 text-[9px] uppercase tracking-wider text-muted">single owner</span>
        </div>
        <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-[11px] text-muted">
                <span>{label}</span><span className="font-mono tabular-nums">{value.toFixed(3)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                <div className="h-full bg-accent" style={{ width: `${Math.round(value * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillsLab({ snap }: { snap: OrganismSnapshot }) {
  return (
    <ul className="space-y-2">
      {snap.skills.length === 0 ? <li className="text-sm text-muted">No skills forged yet. Talk and act.</li> : null}
      {snap.skills.map((s) => (
        <li key={s.id} className="rounded-md border border-border bg-bg px-3 py-2">
          <div className="flex justify-between text-sm">
            <span>{s.name}</span>
            <span className="tabular-nums text-muted">{s.uses} uses</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
            <div className="h-full bg-ok" style={{ width: `${s.success * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EvidenceLab({ snap }: { snap: OrganismSnapshot }) {
  return (
    <ul className="space-y-2">
      {snap.beliefs.map((b) => (
        <li key={b.id} className="rounded-md border border-border bg-bg px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-subtle">{b.kind}</p>
          <p className="text-sm">{b.claim}</p>
          <p className="mt-1 text-xs tabular-nums text-muted">
            conf {b.confidence.toFixed(2)} · support {b.support} · {b.source}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-border bg-bg px-3 py-2">
      <p className="text-xs uppercase tracking-wider text-subtle">{k}</p>
      <p className="font-mono text-sm tabular-nums">{v}</p>
    </div>
  );
}
