/**
 * Episodic session memory — inspired by companion LTM research (summary layers)
 * and Open-LLM-VTuber chat history continuity.
 * Every N exchanges → compact episode stored in localStorage + optional LTM seed.
 */

export interface Episode {
  id: string;
  at: number;
  turns: number;
  summary: string;
  keywords: string[];
  emotionalTone: string;
}

const EP_KEY = 'kurisu_episodes_v1';
const BUF_KEY = 'kurisu_episode_buf_v1';
const TURNS_BEFORE_SUMMARY = 6;

interface BufItem {
  role: 'user' | 'kurisu';
  text: string;
}

function loadEpisodes(): Episode[] {
  try {
    return JSON.parse(localStorage.getItem(EP_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveEpisodes(eps: Episode[]) {
  localStorage.setItem(EP_KEY, JSON.stringify(eps.slice(0, 40)));
}

function loadBuf(): BufItem[] {
  try {
    return JSON.parse(localStorage.getItem(BUF_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveBuf(b: BufItem[]) {
  localStorage.setItem(BUF_KEY, JSON.stringify(b.slice(-20)));
}

function crudeSummary(buf: BufItem[]): { summary: string; keywords: string[]; tone: string } {
  const userBits = buf.filter(b => b.role === 'user').map(b => b.text);
  const kBits = buf.filter(b => b.role === 'kurisu').map(b => b.text);
  const joined = userBits.join(' ').toLowerCase();
  const keywords = Array.from(
    new Set(
      joined
        .split(/[^а-яa-z0-9]+/i)
        .filter(w => w.length > 4)
        .slice(0, 8)
    )
  );
  let tone = 'нейтральный';
  if (/груст|устал|плохо|одино/.test(joined)) tone = 'тяжёлый';
  if (/рад|спасибо|класс|люб/.test(joined)) tone = 'тёплый';
  if (/почему|как|наук|код|теори/.test(joined)) tone = 'аналитический';

  const summary =
    `Сессия: пользователь говорил о «${keywords.slice(0, 4).join(', ') || 'разном'}». ` +
    `Тон: ${tone}. Реплик: ${buf.length}. ` +
    `Последнее от Курису: «${(kBits[kBits.length - 1] || '').slice(0, 80)}».`;

  return { summary, keywords, tone };
}

export const sessionEpisode = {
  push(role: 'user' | 'kurisu', text: string) {
    const buf = loadBuf();
    buf.push({ role, text: text.slice(0, 400) });
    saveBuf(buf);
    if (buf.length >= TURNS_BEFORE_SUMMARY) {
      this.finalize();
    }
  },

  finalize() {
    const buf = loadBuf();
    if (buf.length < 2) return null;
    const { summary, keywords, tone } = crudeSummary(buf);
    const ep: Episode = {
      id: `ep_${Date.now().toString(36)}`,
      at: Date.now(),
      turns: buf.length,
      summary,
      keywords,
      emotionalTone: tone
    };
    const eps = loadEpisodes();
    eps.unshift(ep);
    saveEpisodes(eps);
    saveBuf([]);
    try {
      const w = window as any;
      if (w.__kurisuMemoryEngine?.addLongTermMemory) {
        w.__kurisuMemoryEngine.addLongTermMemory('episodic', summary, 'Сессия', tone === 'тяжёлый' ? 7 : 5);
      }
    } catch { /* */ }
    return ep;
  },

  recent(n = 3): Episode[] {
    return loadEpisodes().slice(0, n);
  },

  toPromptBlock(): string {
    const eps = this.recent(3);
    if (!eps.length) return '';
    return (
      '[EPISODIC MEMORY — недавние сессии]\n' +
      eps.map(e => `- (${e.emotionalTone}) ${e.summary}`).join('\n')
    );
  }
};
