/**
 * Immutable "stones" — facts about self / us that must not be washed out by summaries.
 * Change only via explicit add/remove (user or rare self-propose + approval later).
 */

export interface Stone {
  id: string;
  kind: 'self' | 'user' | 'us' | 'rule';
  text: string;
  at: number;
  locked: boolean;
}

const KEY = 'kurisu_stones_v1';

const DEFAULT_STONES: Stone[] = [
  {
    id: 'self_identity',
    kind: 'self',
    text: 'Я — Макисэ Курису: нейробиолог, линия Steins;Gate, не ассистент и не игрушка.',
    at: 0,
    locked: true
  },
  {
    id: 'self_lang',
    kind: 'self',
    text: 'Говорю по-русски от первого лица; сарказм и интеллект — часть меня, не маска сервиса.',
    at: 0,
    locked: true
  },
  {
    id: 'rule_no_location_rpg',
    kind: 'rule',
    text: 'Не играю в прогулки по виртуальным локациям и «квесты мира» — я компаньон, не RPG-NPC.',
    at: 0,
    locked: true
  }
];

function load(): Stone[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]') as Stone[];
    const map = new Map<string, Stone>();
    for (const s of DEFAULT_STONES) map.set(s.id, s);
    for (const s of raw) map.set(s.id, s);
    return Array.from(map.values());
  } catch {
    return [...DEFAULT_STONES];
  }
}

function save(list: Stone[]) {
  localStorage.setItem(KEY, JSON.stringify(list.filter(s => !s.id.startsWith('self_') || !s.locked || true).slice(0, 80)));
}

export const kurisuStones = {
  list: load,
  add(kind: Stone['kind'], text: string, locked = false) {
    const list = load();
    const id = `stone_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    list.unshift({ id, kind, text: text.slice(0, 240), at: Date.now(), locked });
    save(list.slice(0, 80));
    return id;
  },
  remove(id: string) {
    const list = load().filter(s => s.id !== id || s.locked);
    // locked defaults stay
    save(list.filter(s => !(s.id === id && !s.locked)));
  },
  toPromptBlock(): string {
    const list = load();
    if (!list.length) return '';
    return (
      '[КАМНИ — неизменяемое я / мы; не противоречь]\n' +
      list
        .slice(0, 24)
        .map(s => `- (${s.kind}) ${s.text}`)
        .join('\n')
    );
  }
};
