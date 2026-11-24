/**
 * ACE-style hierarchical memory for mobile:
 * Persona → Episodic → Working → Micro-logs
 * localStorage-backed, no SQLite required.
 */

import { readJson, writeJson } from '../cognitive/StateVault';

export type AceLayer = 'persona' | 'episodic' | 'working' | 'micro';

export interface AceEntry {
  id: string;
  layer: AceLayer;
  text: string;
  valence: number; // -1..1
  tags: string[];
  at: number;
}

const KEY = 'kurisu_ace_memory_v1';
const LIMITS: Record<AceLayer, number> = {
  persona: 40,
  episodic: 80,
  working: 20,
  micro: 100
};

interface Store {
  persona: AceEntry[];
  episodic: AceEntry[];
  working: AceEntry[];
  micro: AceEntry[];
}

function load(): Store {
  const s = readJson<Store>(KEY, {
    persona: [],
    episodic: [],
    working: [],
    micro: []
  });
  return {
    persona: s.persona || [],
    episodic: s.episodic || [],
    working: s.working || [],
    micro: s.micro || []
  };
}

function save(s: Store) {
  writeJson(KEY, s);
}

function uid() {
  return `ace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const aceMemory = {
  snapshotCounts() {
    const s = load();
    return {
      persona: s.persona.length,
      episodic: s.episodic.length,
      working: s.working.length,
      micro: s.micro.length
    };
  },

  add(layer: AceLayer, text: string, valence = 0, tags: string[] = []) {
    const s = load();
    const e: AceEntry = {
      id: uid(),
      layer,
      text: text.slice(0, 400),
      valence,
      tags,
      at: Date.now()
    };
    s[layer] = [e, ...s[layer]].slice(0, LIMITS[layer]);
    save(s);
    return e;
  },

  /** Promote important working items to episodic */
  consolidate() {
    const s = load();
    const promote = s.working.filter(w => Math.abs(w.valence) > 0.4 || w.tags.includes('important'));
    for (const p of promote.slice(0, 5)) {
      s.episodic = [
        { ...p, id: uid(), layer: 'episodic' as AceLayer, at: Date.now() },
        ...s.episodic
      ].slice(0, LIMITS.episodic);
    }
    s.micro = s.micro.slice(0, 40);
    s.working = s.working.slice(0, 12);
    save(s);
    return { promoted: promote.length };
  },

  retrieve(query: string, max = 5): AceEntry[] {
    const s = load();
    const q = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const pool = [...s.working, ...s.episodic, ...s.persona, ...s.micro];
    const scored = pool.map(e => {
      const t = e.text.toLowerCase();
      let score = 0;
      for (const w of q) if (t.includes(w)) score += 1;
      score += Math.abs(e.valence) * 0.3;
      score += Math.max(0, 1 - (Date.now() - e.at) / (1000 * 60 * 60 * 24 * 14)) * 0.5;
      return { e, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.filter(x => x.score > 0).slice(0, max).map(x => x.e);
  },

  toPromptBlock(query: string): string {
    const hits = this.retrieve(query, 5);
    if (!hits.length) return '[ACE MEMORY]\n(пусто)';
    return (
      '[ACE MEMORY]\n' +
      hits.map(h => `- (${h.layer}) ${h.text}`).join('\n')
    );
  },

  snapshot() {
    const s = load();
    return {
      persona: s.persona.length,
      episodic: s.episodic.length,
      working: s.working.length,
      micro: s.micro.length
    };
  }
};
