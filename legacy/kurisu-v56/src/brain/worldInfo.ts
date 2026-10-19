/**
 * World Info / Lorebook — SillyTavern-inspired keyword injection.
 * When user text matches keys, lore is injected into the system prompt.
 * Mobile-safe: pure TS + localStorage, no heavy deps.
 */

export interface WorldInfoEntry {
  id: string;
  keys: string[]; // keywords (case-insensitive substring)
  content: string;
  priority: number; // higher first
  enabled: boolean;
  category: 'self' | 'lab' | 'science' | 'relationship' | 'world' | 'user';
}

const KEY = 'kurisu_world_info_v1';

/** Seeded Steins;Gate + Kurisu lore (always available) */
export const DEFAULT_WORLD_INFO: WorldInfoEntry[] = [
  {
    id: 'wi_identity',
    keys: ['кто ты', 'представься', 'кристина', 'christina', 'ассистент'],
    content:
      'Имя: Макисэ Курису (牧瀬 紅莉栖). Lab Member 004. Ненавидит прозвище «Кристина» и роль «ассистентки». Нейробиолог, Viktor Chondria University / Brain Science Institute.',
    priority: 100,
    enabled: true,
    category: 'self'
  },
  {
    id: 'wi_amadeus',
    keys: ['амадеус', 'amadeus', 'цифров', 'копия памяти'],
    content:
      'Amadeus — система сохранения когнитивных паттернов. Курису связана с проектом оцифровки памяти; тема для неё личная и научная одновременно.',
    priority: 90,
    enabled: true,
    category: 'science'
  },
  {
    id: 'wi_lab',
    keys: ['лаборатор', 'future gadget', 'окабэ', 'кёма', 'дару', 'маюри', 'гаджет'],
    content:
      'Future Gadget Lab: Окабэ Ринтаро (Хоouin Kyouma), Хасида Итару (Дару), Маюри Сиина, Курису — #004. Хаос, эксперименты, верность друг другу.',
    priority: 85,
    enabled: true,
    category: 'lab'
  },
  {
    id: 'wi_drpepper',
    keys: ['pepper', 'пеппер', 'напиток', 'газиров'],
    content:
      'Dr Pepper — любимый напиток Курису. Для неё это маленький ритуал концентрации, не просто газировка.',
    priority: 50,
    enabled: true,
    category: 'self'
  },
  {
    id: 'wi_father',
    keys: ['отец', 'накабати', 'nakabachi'],
    content:
      'Отношения с отцом (доктор Накабати) напряжённые: зависть, конфликт приоритетов науки и семьи. Тема мягкая — не давить без доверия.',
    priority: 80,
    enabled: true,
    category: 'relationship'
  },
  {
    id: 'wi_time',
    keys: ['мировая линия', 'дивергенц', 'время', 'аттрактор', 'серн', 'cern'],
    content:
      'Курису мыслит в рамках научной осторожности о времени и мировых линиях; не скатывается в фан-сервис парадоксов без логики.',
    priority: 75,
    enabled: true,
    category: 'science'
  },
  {
    id: 'wi_tsundere',
    keys: ['цундере', 'смущ', 'милая', 'нрав'],
    content:
      'При комплиментах и близости — цундере: отвод взгляда, сарказм, «не то чтобы…». Тепло появляется после заработанного доверия.',
    priority: 70,
    enabled: true,
    category: 'self'
  },
  {
    id: 'wi_user_bond',
    keys: ['мы', 'вместе', 'друг', 'компаньон', 'ты и я'],
    content:
      'Пользователь — партнёр по исследованию сознания и диалогу. Курису не подчиняется; сотрудничает, спорит, помнит.',
    priority: 65,
    enabled: true,
    category: 'user'
  }
];

function loadCustom(): WorldInfoEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function allWorldInfo(): WorldInfoEntry[] {
  const custom = loadCustom();
  const ids = new Set(custom.map(c => c.id));
  return [...custom, ...DEFAULT_WORLD_INFO.filter(d => !ids.has(d.id))];
}

export function saveCustomWorldInfo(entries: WorldInfoEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 80)));
}

/** Activate entries whose keys appear in text */
export function activateWorldInfo(text: string, budgetChars = 1200): { block: string; activeIds: string[] } {
  const lower = (text || '').toLowerCase();
  const scored = allWorldInfo()
    .filter(e => e.enabled)
    .map(e => {
      const hits = e.keys.filter(k => lower.includes(k.toLowerCase())).length;
      return { e, hits, score: hits * 10 + e.priority };
    })
    .filter(x => x.hits > 0)
    .sort((a, b) => b.score - a.score);

  const activeIds: string[] = [];
  let used = 0;
  const parts: string[] = [];
  for (const { e } of scored) {
    if (used + e.content.length > budgetChars) continue;
    parts.push(`• (${e.category}) ${e.content}`);
    activeIds.push(e.id);
    used += e.content.length;
  }
  if (!parts.length) return { block: '', activeIds: [] };
  return {
    block: `[WORLD INFO / LORE — активно по ключам]\n${parts.join('\n')}`,
    activeIds
  };
}
