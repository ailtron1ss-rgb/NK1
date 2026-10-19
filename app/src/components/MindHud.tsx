import type { ReactNode } from "react";
import type { Needs, OrganismSnapshot } from "@/organism/types";
import { cn } from "@/lib/utils";

const NEED_KEYS: Array<{ k: keyof Needs; label: string }> = [
  { k: "energy", label: "energy" },
  { k: "cognitiveLoad", label: "load" },
  { k: "uncertainty", label: "uncertainty" },
  { k: "socialNeed", label: "social" },
  { k: "novelty", label: "novelty" },
  { k: "sleepPressure", label: "sleep" },
  { k: "identityCoherence", label: "identity" },
  { k: "goalPressure", label: "goal" },
];

export function MindHud({ snap }: { snap: OrganismSnapshot }) {
  return (
    <aside className="flex flex-col gap-3">
      <Panel title="Needs">
        <div className="space-y-2">
          {NEED_KEYS.map(({ k, label }) => (
            <Meter key={k} label={label} value={snap.needs[k]} />
          ))}
        </div>
      </Panel>
      <Panel title="Identity">
        <p className="text-sm text-fg">{snap.identity.name}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {snap.identity.traitNames.slice(0, 8).map((trait) => (
            <span key={trait} className="rounded border border-border px-1.5 py-1 text-[10px] text-muted">{trait}</span>
          ))}
        </div>
      </Panel>
      <Panel title="Workspace">
        <ul className="space-y-1">
          {(snap.lastDecision?.workspace ?? []).map((id) => (
            <li key={id} className="font-mono text-xs text-muted">
              {id}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-subtle">{snap.lastDecision?.reason}</p>
      </Panel>
      <Panel title="Policy">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <Row k="option" v={snap.lastOption} />
          <Row k="value" v={snap.valueEstimate.toFixed(2)} />
          <Row k="PE" v={snap.predictionError.toFixed(3)} />
          <Row k="curiosity" v={snap.curiosity.toFixed(2)} />
          <Row k="reward" v={snap.lastReward.toFixed(3)} />
          <Row k="learn" v={String(snap.learnSteps)} />
        </dl>
        <div className="mt-3 space-y-1">
          {(snap.lastDecision?.candidates ?? []).slice(0, 6).map((c) => (
            <Meter key={c.action} label={c.action} value={normalizeScore(c.score, snap.lastDecision?.candidates ?? [])} />
          ))}
        </div>
      </Panel>
    </aside>
  );
}

export function CompactStatus({ snap }: { snap: OrganismSnapshot }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Chip k="emotion" v={snap.emotion.label} />
      <Chip k="option" v={snap.lastOption} />
      <Chip k="energy" v={snap.needs.energy.toFixed(2)} />
      <Chip k="PE" v={snap.predictionError.toFixed(3)} />
    </div>
  );
}

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-xs uppercase tracking-wider text-subtle">{k}</p>
      <p className="font-mono text-sm tabular-nums text-fg">{v}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-subtle">{title}</h3>
      {children}
    </section>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums text-fg">{v.toFixed(2)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
        <div
          className={cn("h-full rounded-full bg-accent")}
          style={{ width: `${v * 100}%` }}
        />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-subtle">{k}</dt>
      <dd className="tabular-nums text-fg">{v}</dd>
    </>
  );
}

function normalizeScore(score: number, all: Array<{ score: number }>) {
  const min = Math.min(...all.map((a) => a.score));
  const max = Math.max(...all.map((a) => a.score));
  if (max - min < 1e-6) return 0.5;
  return (score - min) / (max - min);
}
