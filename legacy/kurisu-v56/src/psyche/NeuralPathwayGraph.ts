/**
 * Neural pathway graph — associative links that strengthen with use / sleep.
 * Metaphor for "new connections", not biological neurons.
 */

export interface PathwayEdge {
  from: string;
  to: string;
  weight: number;
  hits: number;
  lastAt: number;
}

interface GraphState {
  edges: PathwayEdge[];
  nodes: string[];
}

const KEY = 'kurisu_pathways_v1';
const MAX_EDGES = 120;

function norm(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(w => w.length > 3).slice(0, 4).join('_');
}

function load(): GraphState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw?.edges) return raw;
  } catch { /* */ }
  return {
    nodes: ['kurisu', 'user', 'lab', 'truth', 'time', 'memory'],
    edges: [
      { from: 'kurisu', to: 'lab', weight: 0.8, hits: 5, lastAt: Date.now() },
      { from: 'kurisu', to: 'truth', weight: 0.9, hits: 5, lastAt: Date.now() },
      { from: 'user', to: 'kurisu', weight: 0.5, hits: 1, lastAt: Date.now() }
    ]
  };
}

function save(g: GraphState) {
  if (g.edges.length > MAX_EDGES) {
    g.edges.sort((a, b) => b.weight - a.weight);
    g.edges = g.edges.slice(0, MAX_EDGES);
  }
  localStorage.setItem(KEY, JSON.stringify(g));
}

export const neuralPathways = {
  get: load,
  /** Link concepts from a message */
  associate(text: string, emotionWeight = 0.5) {
    const g = load();
    const tokens = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 6);
    tokens.forEach(t => {
      if (!g.nodes.includes(t)) g.nodes.push(t);
    });
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const from = tokens[i];
        const to = tokens[j];
        let e = g.edges.find(x => (x.from === from && x.to === to) || (x.from === to && x.to === from));
        if (!e) {
          e = { from, to, weight: 0.15 * emotionWeight, hits: 1, lastAt: Date.now() };
          g.edges.push(e);
        } else {
          e.weight = Math.min(1, e.weight + 0.05 * emotionWeight);
          e.hits += 1;
          e.lastAt = Date.now();
        }
      }
    }
    // always nudge user-kurisu
    let uk = g.edges.find(x => x.from === 'user' && x.to === 'kurisu');
    if (!uk) {
      g.edges.push({ from: 'user', to: 'kurisu', weight: 0.4, hits: 1, lastAt: Date.now() });
    } else {
      uk.weight = Math.min(1, uk.weight + 0.01);
      uk.hits += 1;
    }
    save(g);
  },
  /** Sleep consolidation: boost frequent edges, prune dead */
  consolidateDuringSleep(): { boosted: number; pruned: number; newBridges: number } {
    const g = load();
    let boosted = 0;
    let pruned = 0;
    const now = Date.now();
    g.edges = g.edges.filter(e => {
      if (e.hits < 2 && now - e.lastAt > 7 * 86400000 && e.weight < 0.2) {
        pruned++;
        return false;
      }
      if (e.hits >= 3) {
        e.weight = Math.min(1, e.weight + 0.08);
        boosted++;
      }
      return true;
    });
    // bridge: if A-B and B-C strong, mild A-C
    let newBridges = 0;
    const strong = g.edges.filter(e => e.weight > 0.55);
    for (const e1 of strong.slice(0, 20)) {
      for (const e2 of strong.slice(0, 20)) {
        if (e1.to === e2.from && e1.from !== e2.to) {
          const exists = g.edges.some(
            x => (x.from === e1.from && x.to === e2.to) || (x.from === e2.to && x.to === e1.from)
          );
          if (!exists && newBridges < 5) {
            g.edges.push({
              from: e1.from,
              to: e2.to,
              weight: 0.25,
              hits: 1,
              lastAt: now
            });
            newBridges++;
          }
        }
      }
    }
    save(g);
    return { boosted, pruned, newBridges };
  },
  topLinks(n = 6): string[] {
    return load()
      .edges.slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, n)
      .map(e => `${e.from}—${e.to}(${e.weight.toFixed(2)})`);
  },
  toPromptBlock(): string {
    const links = this.topLinks(5);
    return `[НЕЙРОННЫЕ СВЯЗИ (ассоциации)]\n${links.join(' | ') || 'пока редко'}`;
  }
};
