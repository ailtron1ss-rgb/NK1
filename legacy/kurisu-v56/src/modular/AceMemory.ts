/**
 * ACE-style hierarchical memory: Persona → Episodic → Working → Micro
 * Mobile: localStorage JSON, capped sizes.
 */

export type AceLayer = 'persona' | 'episodic' | 'working' | 'micro';

export interface AceEntry {
  id: string;
  layer: AceLayer;
  text: string;
  valence: number; // -1..1
  at: number;
  tags: string[];
}

const KEY = 'kurisu_ace_memory_v1';
const CAPS: Record<AceLayer, number> = {
  persona: 40,
  episodic: 80,
  working: 24,
  micro: 60
};

function load(): AceEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function save(rows: AceEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

function uid() {
  return `ace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const aceMemory = {
  add(layer: AceLayer, text: string, valence = 0, tags: string[] = []) {
    const rows = load().filter(r => !(r.layer === layer && r.text === text));
    rows.unshift({
      id: uid(),
      layer,
      text: text.slice(0, 400),
      valence,
      at: Date.now(),
      tags
    });
    const byLayer: Record<string, AceEntry[]> = { persona: [], episodic: [], working: [], micro: [] };
    for (const r of rows) byLayer[r.layer].push(r);
    const next: AceEntry[] = [];
    (Object.keys(CAPS) as AceLayer[]).forEach(l => {
      next.push(...byLayer[l].slice(0, CAPS[l]));
    });
    save(next);
  },

  retrieve(query: string, limit = 8): AceEntry[] {
    const q = query.toLowerCase();
    const rows = load();
    const scored = rows.map(r => {
      const hit = r.tags.some(t => q.includes(t)) || r.text.toLowerCase().includes(q.slice(0, 24));
      const recency = 1 / (1 + (Date.now() - r.at) / 86400000);
      const layerBoost = r.layer === 'persona' ? 1.2 : r.layer === 'episodic' ? 1.1 : 1;
      return { r, s: (hit ? 2 : 0.3) * recency * layerBoost };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, limit).map(x => x.r);
  },

  toPromptBlock(query: string): string {
    const rows = this.retrieve(query, 6);
    if (!rows.length) return '[ACE MEMORY]\n(пусто)';
    return (
      '[ACE MEMORY]\n' +
      rows.map(r => `- (${r.layer}, v${r.valence.toFixed(1)}) ${r.text}`).join('\n')
    );
  },

  snapshotCounts() {
    const rows = load();
    const c: Record<string, number> = {};
    for (const r of rows) c[r.layer] = (c[r.layer] || 0) + 1;
    return c;
  },

  /** Nightly-style: promote frequent micro themes to episodic */
  consolidate() {
    const rows = load();
    const micros = rows.filter(r => r.layer === 'micro');
    if (micros.length < 5) return { promoted: 0 };
    const sample = micros.slice(0, 5).map(m => m.text).join(' | ');
    this.add('episodic', `Сводка: ${sample.slice(0, 280)}`, 0, ['consolidate']);
    return { promoted: 1 };
  }
};

// seed persona once
try {
  if (!localStorage.getItem('kurisu_ace_seeded')) {
    aceMemory.add('persona', 'Я Макисэ Курису: нейроучёный, цундере, ценю логику и границы.', 0.2, ['self']);
    aceMemory.add('persona', 'Ненавижу имя Кристина; спорю остро, но не жестоко без причины.', -0.1, ['self']);
    localStorage.setItem('kurisu_ace_seeded', '1');
  }
} catch { /* */ }
