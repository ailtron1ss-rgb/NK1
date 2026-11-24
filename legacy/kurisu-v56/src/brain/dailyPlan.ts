/**
 * Daily plan — 3 autonomous goals Kurisu "holds" for the day.
 * Not tasks for the user; her own lab agenda.
 */

import { getLabShift } from './labClock';
import { eventBus } from './eventBus';

export interface PlanItem {
  id: string;
  text: string;
  done: boolean;
  source: 'auto' | 'user' | 'promise';
}

interface DayPlan {
  dayKey: string;
  items: PlanItem[];
  note: string;
}

const KEY = 'kurisu_daily_plan_v1';

function dayKey() {
  return new Date().toDateString();
}

const POOL: Record<string, string[]> = {
  deep_night: [
    'Пересмотреть спорные места в сегодняшнем диалоге',
    'Не писать лишнего, пока внимание на нуле',
    'Зафиксировать одну гипотезу в journal'
  ],
  morning: [
    'Уточнить, что для него сейчас главное',
    'Проверить open promises',
    'Короткий научный пассаж, если тема подойдёт'
  ],
  lab_day: [
    'Держать научную точность в ответах',
    'Не скатываться в ассистентский тон',
    'Заметить противоречия в его словах'
  ],
  evening: [
    'Подвести мягкий итог дня (если он на связи)',
    'Обновить self-model по тону разговора',
    'Оставить один открытый вопрос на завтра'
  ]
};

function load(): DayPlan {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null') as DayPlan | null;
    if (p && p.dayKey === dayKey()) return p;
  } catch { /* */ }
  const shift = getLabShift();
  const pool = POOL[shift] || POOL.lab_day;
  const items = pool.slice(0, 3).map((text, i) => ({
    id: `p${i}`,
    text,
    done: false,
    source: 'auto' as const
  }));
  const plan = { dayKey: dayKey(), items, note: `Смена: ${shift}` };
  localStorage.setItem(KEY, JSON.stringify(plan));
  eventBus.emit('promise_added', { kind: 'daily_plan' });
  return plan;
}

export const dailyPlan = {
  get(): DayPlan {
    return load();
  },
  markDone(id: string) {
    const p = load();
    p.items = p.items.map(it => (it.id === id ? { ...it, done: true } : it));
    localStorage.setItem(KEY, JSON.stringify(p));
  },
  toPromptBlock(): string {
    const p = load();
    return (
      '[МОЙ ПЛАН НА ДЕНЬ — внутренний, не навязывай]\n' +
      p.items.map(it => `- [${it.done ? 'x' : ' '}] ${it.text}`).join('\n')
    );
  },
  refresh() {
    localStorage.removeItem(KEY);
    return load();
  }
};
