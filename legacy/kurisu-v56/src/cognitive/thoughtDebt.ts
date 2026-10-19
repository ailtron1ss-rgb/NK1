/**
 * Open cognitive threads — autonomy should resume unfinished topics, not random flavor.
 */

export interface ThoughtDebtItem {
  id: string;
  topic: string;
  from: 'user' | 'kurisu';
  at: number;
  priority: number;
}

const KEY = 'kurisu_thought_debt_v1';

function load(): ThoughtDebtItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function save(items: ThoughtDebtItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 30)));
}

function looksOpenQuestion(text: string): boolean {
  return /(\?|почему|зачем|как ты|что думаешь|продолж)/i.test(text);
}

export const thoughtDebt = {
  observeExchange(userText: string, kurisuText: string) {
    const items = load();
    // if user left an open question, debt on kurisu side
    if (looksOpenQuestion(userText) && kurisuText.length < 40) {
      items.unshift({
        id: `d_${Date.now().toString(36)}`,
        topic: userText.slice(0, 160),
        from: 'user',
        at: Date.now(),
        priority: 8
      });
    }
    // if kurisu asked user something
    if (looksOpenQuestion(kurisuText)) {
      items.unshift({
        id: `d_${Date.now().toString(36)}`,
        topic: kurisuText.slice(0, 160),
        from: 'kurisu',
        at: Date.now(),
        priority: 6
      });
    }
    // if user answered something, drop oldest matching loose debt
    if (userText.length > 20 && !looksOpenQuestion(userText)) {
      items.shift();
    }
    save(items);
  },
  peek(): ThoughtDebtItem | null {
    const items = load().sort((a, b) => b.priority - a.priority || b.at - a.at);
    return items[0] || null;
  },
  consume(id: string) {
    save(load().filter(i => i.id !== id));
  },
  toPromptBlock(): string {
    const d = this.peek();
    if (!d) return '';
    return `[ДОЛГ МЫСЛИ — незакрытый поток]\n${d.from}: ${d.topic}`;
  },
  initiativeLine(): string | null {
    const d = this.peek();
    if (!d) return null;
    if (Date.now() - d.at < 3 * 60 * 1000) return null; // not immediate nag
    if (d.from === 'user') {
      return `Кстати, ты спрашивал(а): «${d.topic.slice(0, 100)}». Я не договорила мысль — хочешь, продолжу с того места?`;
    }
    return `Мы остановились на: «${d.topic.slice(0, 100)}». Есть ответ, или тема уже не нужна?`;
  }
};
