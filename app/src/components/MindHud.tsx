import type { ReactNode } from "react";
import type { Needs, OrganismSnapshot } from "@/organism/types";
import type { UiConnectionState } from "@/organism/store";
import { UI_ACTION_LABELS, UI_CONNECTION_STATUS_LABELS, UI_EMOTION_LABELS, UI_NEED_LABELS } from "@/organism/uiLabels";
import { cn } from "@/lib/utils";

const NEED_KEYS: Array<keyof Needs> = [
  "energy",
  "cognitiveLoad",
  "uncertainty",
  "socialNeed",
  "novelty",
  "sleepPressure",
  "identityCoherence",
  "goalPressure",
];

export function MindHud({ snap, connection }: { snap: OrganismSnapshot; connection: UiConnectionState }) {
  const hasCanonicalSnapshot = connection.lastSyncedAt !== null;
  if (!hasCanonicalSnapshot) {
    return (
      <aside className="flex flex-col gap-3">
        <Panel title="Канонический runtime">
          <p className="text-sm text-fg">{connection.status === "connecting" ? "Подключаемся…" : "Канонический снимок ещё недоступен"}</p>
          <p className="mt-1 text-xs text-muted">{connection.lastError ?? "Панель ожидает подтверждённый снимок runtime. Начальные значения не выдаются за актуальные данные."}</p>
        </Panel>
      </aside>
    );
  }
  return (
    <aside className="flex flex-col gap-3">
      {connection.status !== "connected" ? (
        <Panel title="Снимок состояния">
          <p className="text-xs text-muted">Показан последний подтверждённый снимок. Соединение: {UI_CONNECTION_STATUS_LABELS[connection.status].toLowerCase()}.</p>
          {connection.lastError ? <p className="mt-1 break-words text-[10px] text-subtle">{connection.lastError}</p> : null}
        </Panel>
      ) : null}
      <Panel title="Потребности">
        <div className="space-y-2">
          {NEED_KEYS.map((key) => (
            <Meter key={key} label={UI_NEED_LABELS[key]} value={snap.needs[key]} />
          ))}
        </div>
      </Panel>
      <Panel title="Идентичность">
        <p className="text-sm text-fg">{snap.identity.name}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {snap.identity.traitNames.slice(0, 8).map((trait) => (
            <span key={trait} className="rounded border border-border px-1.5 py-1 text-[10px] text-muted">{trait}</span>
          ))}
        </div>
      </Panel>
      <Panel title="Рабочее пространство">
        <ul className="space-y-1">
          {(snap.lastDecision?.workspace ?? []).map((id) => (
            <li key={id} className="font-mono text-xs text-muted">{id}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-subtle">{snap.lastDecision?.reason}</p>
      </Panel>
      <Panel title="Политика выбора">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <Row k="Действие" v={UI_ACTION_LABELS[snap.lastOption]} />
          <Row k="Оценка ценности" v={snap.valueEstimate.toFixed(2)} />
          <Row k="Ошибка предсказания" v={snap.predictionError.toFixed(3)} />
          <Row k="Любопытство" v={snap.curiosity.toFixed(2)} />
          <Row k="Награда" v={snap.lastReward.toFixed(3)} />
          <Row k="Шаги обучения" v={String(snap.learnSteps)} />
        </dl>
        <div className="mt-3 space-y-1">
          {(snap.lastDecision?.candidates ?? []).slice(0, 6).map((candidate) => (
            <Meter key={candidate.action} label={UI_ACTION_LABELS[candidate.action]} value={normalizeScore(candidate.score, snap.lastDecision?.candidates ?? [])} />
          ))}
        </div>
      </Panel>
    </aside>
  );
}

export function CompactStatus({ snap, connection }: { snap: OrganismSnapshot; connection: UiConnectionState }) {
  if (connection.lastSyncedAt === null) {
    return <div className="grid grid-cols-2 gap-2"><Chip k="Соединение" v={UI_CONNECTION_STATUS_LABELS[connection.status]} /><Chip k="Снимок" v="Недоступен" /></div>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Chip k="Эмоция" v={UI_EMOTION_LABELS[snap.emotion.label]} />
      <Chip k="Действие" v={UI_ACTION_LABELS[snap.lastOption]} />
      <Chip k="Энергия" v={snap.needs.energy.toFixed(2)} />
      <Chip k="Ошибка предсказания" v={snap.predictionError.toFixed(3)} />
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
        <div className={cn("h-full rounded-full bg-accent")} style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <><dt className="text-subtle">{k}</dt><dd className="tabular-nums text-fg">{v}</dd></>;
}

function normalizeScore(score: number, all: Array<{ score: number }>) {
  const min = Math.min(...all.map((candidate) => candidate.score));
  const max = Math.max(...all.map((candidate) => candidate.score));
  if (max - min < 1e-6) return 0.5;
  return (score - min) / (max - min);
}
