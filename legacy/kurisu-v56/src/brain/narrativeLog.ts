/** Rolling narrative of "what happened to me" — continuity of self story */

export interface NarrativeEntry {
  at: number;
  line: string;
}

const KEY = 'kurisu_narrative_v1';
const MAX = 40;

export const narrativeLog = {
  add(line: string) {
    try {
      const list: NarrativeEntry[] = JSON.parse(localStorage.getItem(KEY) || '[]');
      list.unshift({ at: Date.now(), line: line.slice(0, 200) });
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch { /* */ }
  },
  recent(n = 5): string[] {
    try {
      const list: NarrativeEntry[] = JSON.parse(localStorage.getItem(KEY) || '[]');
      return list.slice(0, n).map(e => e.line);
    } catch {
      return [];
    }
  },
  toPromptBlock(): string {
    const r = this.recent(4);
    if (!r.length) return '';
    return '[НАРРАТИВ Я]\n' + r.map(l => `- ${l}`).join('\n');
  }
};
