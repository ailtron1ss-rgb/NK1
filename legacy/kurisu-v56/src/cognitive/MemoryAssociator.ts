/** Lightweight associative graph. Kept in localStorage to remain Android-web safe. */
import { MemoryItem } from '../types';
import { readJson, writeJson } from './StateVault';

export interface MemoryEdge { from: string; to: string; weight: number; reason: string; updatedAt: number; }
const KEY = 'kurisu_memory_edges_v1';
const MAX_EDGES = 900;

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(x => x.length >= 4).slice(0, 80));
}

function overlap(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let hit = 0; for (const x of a) if (b.has(x)) hit++;
  return hit / Math.sqrt(a.size * b.size);
}

class MemoryAssociator {
  private edges = readJson<MemoryEdge[]>(KEY, []);
  private save() { this.edges = this.edges.slice(0, MAX_EDGES); writeJson(KEY, this.edges); }

  link(a: MemoryItem, b: MemoryItem, reason = 'semantic overlap', weight?: number) {
    if (a.id === b.id) return;
    const w = Math.max(0.05, Math.min(1, weight ?? overlap(tokens(a.content + ' ' + (a.topicName || '')), tokens(b.content + ' ' + (b.topicName || '')))));
    if (w < 0.18) return;
    const now = Date.now();
    const existing = this.edges.find(e => e.from === a.id && e.to === b.id);
    if (existing) { existing.weight = Math.min(1, existing.weight * 0.85 + w * 0.15 + 0.02); existing.updatedAt = now; }
    else this.edges.unshift({ from: a.id, to: b.id, weight: w, reason, updatedAt: now });
    this.save();
  }

  linkRelated(memory: MemoryItem, candidates: MemoryItem[], limit = 4) {
    const ranked = candidates.filter(x => x.id !== memory.id).map(x => ({ x, w: overlap(tokens(memory.content + ' ' + (memory.topicName || '')), tokens(x.content + ' ' + (x.topicName || ''))) })).sort((a,b)=>b.w-a.w).slice(0, limit);
    ranked.forEach(({x,w}) => this.link(memory, x, 'shared concepts', w));
  }

  related(id: string, limit = 5): string[] {
    return this.edges.filter(e => e.from === id || e.to === id).sort((a,b)=>b.weight-a.weight).slice(0, limit).map(e => e.from === id ? e.to : e.from);
  }

  stats() { return { edges: this.edges.length }; }
}

export const memoryAssociator = new MemoryAssociator();
