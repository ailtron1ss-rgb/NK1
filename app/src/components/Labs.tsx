
import type { OrganismSnapshot } from "@/organism/types";
import { useKurisu } from "@/organism/store";
import { cn } from "@/lib/utils";
import { MemoryExplorer } from "@/components/MemoryExplorer";

export function Labs({ snap }: { snap: OrganismSnapshot }) {
  const tab = useKurisu((s) => s.tab);
  const setTab = useKurisu((s) => s.setTab);
  const tabs = [
    { id: "mind", label: "Разум" },
    { id: "memory", label: "Память" },
    { id: "lab", label: "Внутренняя лаборатория" },
    { id: "skills", label: "Навыки" },
    { id: "evidence", label: "Свидетельства" },
  ] as const;

  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:p-5" aria-label="Лаборатория разума и памяти">
      <div className="mb-4 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-pressed={tab === t.id}
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
      {tab === "memory" ? <MemoryExplorer /> : null}
      {tab === "lab" ? <InnerLab snap={snap} /> : null}
      {tab === "skills" ? <SkillsLab snap={snap} /> : null}
      {tab === "evidence" ? <EvidenceLab snap={snap} /> : null}
    </section>
  );
}

function MindNote({ snap }: { snap: OrganismSnapshot }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Stat k="Субъект" v={snap.identity.subjectId.slice(-10)} />
      <Stat k="Циклы" v={String(snap.identity.cycles)} />
      <Stat k="Доверие" v={snap.identity.trust.toFixed(2)} />
      <Stat k="Повторное воспроизведение" v={String(snap.replayCount)} />
      <Stat k="Ошибка модели мира" v={snap.worldErrorEma.toFixed(4)} />
      <Stat k="Вызовы языковой модели" v={String(snap.languageCalls)} />
      <div className="md:col-span-3">
        <h4 className="mb-2 text-xs uppercase tracking-wider text-subtle">Цели</h4>
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

function InnerLab({ snap }: { snap: OrganismSnapshot }) {
  const world = snap.canonicalWorld;
  const metrics = [
    ["Ошибка предсказания", world.predictionError01],
    ["Уверенность латентной модели", world.latentConfidence01],
    ["Запуск рабочего пространства", world.workspaceIgnition01],
    ["Повторяемость рабочего пространства", world.workspaceRecurrence01],
    ["Метакогнитивная точность", world.metacognitiveAccuracy01],
    ["Непрерывность идентичности", world.identityContinuity01],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat k="Сцена" v={world.scene} />
        <Stat k="Модель мира" v={`${world.featureDim}f / ${world.hiddenDim}h`} />
        <Stat k="Примеры модели" v={String(world.modelSamples)} />
        <Stat k="Сущности" v={String(world.entities)} />
        <Stat k="Конфликты" v={String(world.conflicts)} />
        <Stat k="Разнообразие рабочих пространств" v={world.workspaceDiversity01.toFixed(3)} />
      </div>
      <div className="rounded-lg border border-border bg-bg p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-subtle">Канонический семантический мир</p>
            <p className="text-sm text-muted">Актуальная проекция состояния P27/P35/P23/P33. Устаревший 2D-рендерер отвечает только за визуальное отображение.</p>
          </div>
          <span className="rounded-full border border-border px-2 py-1 text-[9px] uppercase tracking-wider text-muted">Единственный владелец</span>
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
      {snap.skills.length === 0 ? <li className="text-sm text-muted">Навыков пока нет. Разговаривайте и действуйте.</li> : null}
      {snap.skills.map((s) => (
        <li key={s.id} className="rounded-md border border-border bg-bg px-3 py-2">
          <div className="flex justify-between text-sm">
            <span>{s.name}</span>
            <span className="tabular-nums text-muted">использований: {s.uses}</span>
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
            уверенность {b.confidence.toFixed(2)} · подтверждения {b.support} · источник {b.source}
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
