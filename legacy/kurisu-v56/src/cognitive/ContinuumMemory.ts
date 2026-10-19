/**
 * ContinuumMemory v1
 *
 * A mobile approximation of the multi-timescale memory idea from Nested Learning:
 * different memory bands update at different rates. This is NOT the Hope model
 * and does not train model weights on-device.
 *
 * The "delta stack" here is an engineering abstraction for hierarchical
 * context deltas (push/merge/pop), not a claim to reproduce a published
 * DeltaStack architecture.
 */
import { MemoryItem } from '../types';
import { readJson, writeJson, clamp } from './StateVault';
import { embedText, cosine } from '../brain/embeddings';

export type MemoryBand = 'working' | 'episodic' | 'semantic' | 'identity';

export interface MemoryDelta {
  id: string;
  at: number;
  op: 'push' | 'merge' | 'pop';
  band: MemoryBand;
  content: string;
  weight: number;
  parentId?: string;
}

export interface ContinuumSnapshot {
  bands: Record<MemoryBand, number>;
  stackDepth: number;
  lastConsolidationAt: number;
  totalDeltas: number;
}

const DELTA_KEY = 'kurisu_continuum_deltas_v1';
const SNAPSHOT_KEY = 'kurisu_continuum_snapshot_v1';
const MAX_DELTAS = 160;

function loadDeltas(): MemoryDelta[] {
  return readJson<MemoryDelta[]>(DELTA_KEY, []).slice(0, MAX_DELTAS);
}
function saveDeltas(v: MemoryDelta[]) { writeJson(DELTA_KEY, v.slice(0, MAX_DELTAS)); }

export const continuumMemory = {
  push(content: string, band: MemoryBand, weight = 0.5, parentId?: string) {
    const d: MemoryDelta = {
      id: `delta_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(), op: 'push', band, content: content.slice(0, 500),
      weight: clamp(weight, 0, 1), parentId
    };
    saveDeltas([d, ...loadDeltas()]);
    return d;
  },

  merge(contents: string[], band: MemoryBand, weight = 0.6) {
    const joined = contents.filter(Boolean).join(' · ').slice(0, 900);
    if (!joined) return null;
    const d: MemoryDelta = {
      id: `merge_${Date.now().toString(36)}`,
      at: Date.now(), op: 'merge', band, content: joined,
      weight: clamp(weight, 0, 1)
    };
    saveDeltas([d, ...loadDeltas()]);
    return d;
  },

  pop(count = 1) {
    const deltas = loadDeltas();
    const removed = deltas.splice(0, Math.max(0, Math.min(8, count)));
    saveDeltas(deltas);
    return removed;
  },

  retrieve(query: string, bands: MemoryBand[] = ['working', 'episodic', 'semantic', 'identity'], topK = 6) {
    const q = embedText(query);
    const now = Date.now();
    return loadDeltas()
      .filter(d => bands.includes(d.band))
      .map(d => {
        const semantic = Math.max(0, cosine(q, embedText(d.content)));
        const ageDays = Math.max(0, (now - d.at) / 86400000);
        const halfLife = d.band === 'working' ? 0.08 : d.band === 'episodic' ? 7 : d.band === 'semantic' ? 45 : 3650;
        const retention = Math.pow(0.5, ageDays / Math.max(0.01, halfLife));
        return { d, score: semantic * 0.62 + retention * 0.23 + d.weight * 0.15 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  },

  consolidate(memories: MemoryItem[]) {
    const semantic = memories.filter(m => m.category === 'self' || m.category === 'world' || m.category === 'topic');
    const episodic = memories.filter(m => m.category === 'episodic' || m.category === 'reflection');
    const identity = memories.filter(m => m.category === 'relationship' || m.category === 'user');
    const recent = memories.slice(-20);
    this.merge(recent.map(m => m.content), 'working', 0.35);
    if (episodic.length) this.merge(episodic.slice(0, 8).map(m => m.meaning || m.content), 'episodic', 0.65);
    if (semantic.length) this.merge(semantic.slice(0, 8).map(m => m.content), 'semantic', 0.72);
    if (identity.length) this.merge(identity.slice(0, 6).map(m => m.content), 'identity', 0.8);
    const snap: ContinuumSnapshot = {
      bands: { working: recent.length, episodic: episodic.length, semantic: semantic.length, identity: identity.length },
      stackDepth: loadDeltas().length,
      lastConsolidationAt: Date.now(),
      totalDeltas: loadDeltas().length
    };
    writeJson(SNAPSHOT_KEY, snap);
    return snap;
  },

  snapshot(): ContinuumSnapshot {
    return readJson<ContinuumSnapshot>(SNAPSHOT_KEY, {
      bands: { working: 0, episodic: 0, semantic: 0, identity: 0 },
      stackDepth: loadDeltas().length,
      lastConsolidationAt: 0,
      totalDeltas: loadDeltas().length
    });
  },

  promptHint(max = 900) {
    const s = this.snapshot();
    const top = this.retrieve('текущий разговор', undefined, 3).map(x => x.d.content.slice(0, 140)).join(' | ');
    return `[CONTINUUM MEMORY]\nbands=working:${s.bands.working}, episodic:${s.bands.episodic}, semantic:${s.bands.semantic}, identity:${s.bands.identity}; deltaDepth=${s.stackDepth}\nRelevant continuum cues: ${top || 'none'}\nTreat retrieved cues as fallible memory, not facts.`;
  }
};
