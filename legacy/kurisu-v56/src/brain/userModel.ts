/**
 * Slow user model — long-horizon traits about the human partner.
 */

export interface UserModel {
  topics: string[];
  prefersShort: boolean;
  nightOwl: boolean;
  technical: boolean;
  lastSeen: number;
  notes: string;
}

const KEY = 'kurisu_user_model_v1';

const DEFAULT: UserModel = {
  topics: [],
  prefersShort: false,
  nightOwl: false,
  technical: false,
  lastSeen: 0,
  notes: ''
};

function load(): UserModel {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT };
  }
}

function save(m: UserModel) {
  localStorage.setItem(KEY, JSON.stringify(m));
}

export const userModel = {
  get: load,
  observeUserMessage(text: string) {

    const m = load();
    m.lastSeen = Date.now();
    if (text.length < 40) m.prefersShort = true;
    if (text.length > 200) m.prefersShort = false;
    if (/код|алгоритм|нейро|квант|формул|api|termux/i.test(text)) m.technical = true;
    const h = new Date().getHours();
    if (h >= 23 || h < 5) m.nightOwl = true;
    // topic crumbs
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 5).slice(0, 3);
    m.topics = Array.from(new Set([...words, ...m.topics])).slice(0, 12);
    save(m);
  },
  toPromptBlock(): string {
    const m = load();
    return `[МОДЕЛЬ ПОЛЬЗОВАТЕЛЯ — медленная]
technical=${m.technical} nightOwl=${m.nightOwl} prefersShort=${m.prefersShort}
topics: ${m.topics.join(', ') || '—'}
${m.notes ? 'notes: ' + m.notes : ''}`;
  }
};
