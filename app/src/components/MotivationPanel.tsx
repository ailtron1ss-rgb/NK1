import type { OrganismSnapshot } from "@/organism/types";
import type { UiConnectionState } from "@/organism/store";
import { UI_CONNECTION_STATUS_LABELS, UI_NEED_LABELS } from "@/organism/uiLabels";

const DRIVE_HINTS: Record<keyof OrganismSnapshot["needs"], string> = {
  energy: "Доступный внутренний ресурс.",
  cognitiveLoad: "Текущая нагрузка на обработку информации.",
  uncertainty: "Неустранённая ошибка предсказания или нехватка контекста.",
  socialNeed: "Потребность во взаимодействии.",
  novelty: "Запрос на новую информацию.",
  sleepPressure: "Гомеостатическая потребность в отдыхе.",
  goalPressure: "Срочность ещё не достигнутых целей.",
  identityCoherence: "Непрерывность модели собственного Я.",
};

const DRIVE_KEYS: Array<keyof OrganismSnapshot["needs"]> = [
  "energy", "cognitiveLoad", "uncertainty", "socialNeed",
  "novelty", "sleepPressure", "goalPressure", "identityCoherence",
];

const GOAL_STATUS_LABELS: Record<string, string> = {
  active: "Активна",
  pending: "Ожидает",
  completed: "Завершена",
  blocked: "Заблокирована",
  abandoned: "Отменена",
};

export function MotivationPanel({ snap, connection }: { snap: OrganismSnapshot; connection: UiConnectionState }) {
  const hasCanonicalSnapshot = connection.lastSyncedAt !== null;
  const goals = snap.goals.slice().sort((a, b) => (b.urgency + b.importance) - (a.urgency + a.importance));
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,.8fr)]">
      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="font-display text-lg text-fg">Текущие цели</h2><p className="text-xs text-muted">Цели берутся из подтверждённого снимка канонического runtime.</p></div>
          <span className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted">{hasCanonicalSnapshot ? `${goals.length} записей` : "Недоступно"}</span>
        </div>
        {!hasCanonicalSnapshot ? <p className="mt-4 rounded-lg border border-border bg-bg p-3 text-sm text-muted">Цели скрыты до подтверждения первого канонического снимка. Это не позволяет выдать начальные значения за реальные намерения организма.</p> :
          goals.length === 0 ? <p className="mt-4 rounded-lg border border-border bg-bg p-3 text-sm text-muted">Runtime пока не опубликовал ни одной цели.</p> :
          <ul className="mt-4 space-y-3">{goals.map((goal) => (
            <li key={goal.id} className="rounded-lg border border-border bg-bg p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-medium text-fg">{goal.title}</p><span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">{GOAL_STATUS_LABELS[goal.status] ?? goal.status}</span></div>
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted"><span>Источник: {goal.source}</span><span>Срочность: {goal.urgency.toFixed(2)}</span><span>Важность: {goal.importance.toFixed(2)}</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-accent" style={{ width: (Math.max(0, Math.min(1, goal.progress)) * 100) + "%" }} /></div>
              <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-subtle">{(goal.progress * 100).toFixed(0)}%</p>
            </li>
          ))}</ul>
        }
      </section>
      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <h2 className="font-display text-lg text-fg">Гомеостаз и потребности</h2>
        <p className="text-xs text-muted">Только просмотр актуальных каналов потребностей.</p>
        {!hasCanonicalSnapshot ? <p className="mt-4 text-sm text-muted">Сначала дождитесь подтверждения канонического снимка.</p> :
          <ul className="mt-4 space-y-3">{DRIVE_KEYS.map((key) => {
            const raw = snap.needs[key];
            const value = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : null;
            return <li key={key}>
              <div className="flex items-center justify-between gap-2 text-xs"><span className="text-fg">{UI_NEED_LABELS[key]}</span><span className="font-mono tabular-nums text-muted">{value === null ? "Неизвестно" : value.toFixed(2)}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-accent" style={{ width: ((value ?? 0) * 100) + "%" }} /></div>
              <p className="mt-1 text-[10px] text-subtle">{DRIVE_HINTS[key]}</p>
            </li>;
          })}</ul>
        }
        {connection.status !== "connected" && hasCanonicalSnapshot ? <p className="mt-4 rounded-md border border-border bg-bg p-2 text-xs text-muted">Показаны последние подтверждённые значения; соединение: {UI_CONNECTION_STATUS_LABELS[connection.status].toLowerCase()}.</p> : null}
      </section>
    </div>
  );
}
