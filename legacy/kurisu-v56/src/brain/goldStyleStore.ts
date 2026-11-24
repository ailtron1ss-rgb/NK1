/**
 * Gold style — user-preferred answer patterns (no weight training).
 * When user marks a reply as "как надо", we store a short style imprint.
 */

export interface GoldExample {
  id: string;
  at: number;
  userHint: string;
  replySample: string;
  tags: string[];
}

const KEY = 'kurisu_gold_style_v1';
const MAX = 24;

function load(): GoldExample[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function save(list: GoldExample[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export const goldStyleStore = {
  list(): GoldExample[] {
    return load();
  },
  add(userHint: string, replySample: string, tags: string[] = []) {
    const list = load();
    list.unshift({
      id: `g_${Date.now().toString(36)}`,
      at: Date.now(),
      userHint: userHint.slice(0, 200),
      replySample: replySample.slice(0, 400),
      tags
    });
    save(list);
  },
  /** Inject into system prompt */
  toPromptBlock(): string {
    const list = load().slice(0, 4);
    if (!list.length) return '';
    return (
      '[ЭТАЛОН СТИЛЯ — подражай тону, не копируй дословно]\n' +
      list.map((g, i) => `${i + 1}. ${g.replySample}`).join('\n')
    );
  },
  clear() {
    localStorage.removeItem(KEY);
  }
};
