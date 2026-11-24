/** Avoid repeating the same Kurisu line twice in a row / near-duplicate. */

const KEY = 'kurisu_recent_replies_v1';

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function save(xs: string[]) {
  localStorage.setItem(KEY, JSON.stringify(xs.slice(0, 12)));
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/\*[^*]+\*/g, '').trim().slice(0, 160);
}

export const replyMemory = {
  push(text: string) {
    const xs = load();
    xs.unshift(norm(text));
    save(xs);
  },
  isNearDuplicate(text: string): boolean {
    const n = norm(text);
    if (n.length < 12) return false;
    const xs = load();
    return xs.some(x => x === n || (n.length > 20 && x.includes(n.slice(0, 40))));
  },
  noteIfDup(text: string): string {
    if (!this.isNearDuplicate(text)) {
      this.push(text);
      return text;
    }
    // soft diversify without LLM
    const twist = ' Впрочем, повторю иначе: ';
    const alt = text + twist + 'смысл тот же, формулировку сменила, чтобы не звучать как заевшая пластинка.';
    this.push(alt);
    return text; // keep original meaning; logging only — diversification via prompt is better
  },
  toPromptBlock(): string {
    const xs = load().slice(0, 3);
    if (!xs.length) return '';
    return '[НЕ ПОВТОРЯЙ дословно недавние свои реплики]\n- ' + xs.join('\n- ');
  }
};
