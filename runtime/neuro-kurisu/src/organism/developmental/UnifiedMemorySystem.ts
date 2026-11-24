import { randomUUID } from 'node:crypto';
import type { MemoryOSState2 } from './MemoryOS2.ts';

export type BeliefStatus = 'supported' | 'tentative' | 'contradicted' | 'unknown';

export interface BeliefRecord {
  id: string;
  claim: string;
  status: BeliefStatus;
  confidence: number;
  evidence: string[];
  contradictions: string[];
  revisionCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryDevelopmentState {
  version: 2;
  encodeCount: number;
  retrieveCount: number;
  reconsolidationCount: number;
  dormantReactivations: number;
  beliefRevisions: number;
  skillPromotions: number;
  beliefs: BeliefRecord[];
  recentQueries: Array<{ query: string; at: number; hits: number }>;
  lastContextHash: string;
}

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export const defaultUnifiedMemory = (): MemoryDevelopmentState => ({
  version: 2,
  encodeCount: 0,
  retrieveCount: 0,
  reconsolidationCount: 0,
  dormantReactivations: 0,
  beliefRevisions: 0,
  skillPromotions: 0,
  beliefs: [],
  recentQueries: [],
  lastContextHash: '',
});

export class UnifiedMemorySystem {
  private state = defaultUnifiedMemory();

  restore(input: MemoryDevelopmentState | undefined): void {
    this.state = {
      ...defaultUnifiedMemory(),
      ...(input ?? {}),
      version: 2,
      beliefs: Array.isArray(input?.beliefs) ? input.beliefs.slice(0, 256).map(value => ({ ...value, evidence: [...(value.evidence ?? [])].slice(0, 24), contradictions: [...(value.contradictions ?? [])].slice(0, 24) })) : [],
      recentQueries: Array.isArray(input?.recentQueries) ? input.recentQueries.slice(0, 64) : [],
    };
  }

  observeContext(input: { text?: string; source?: string; confidence?: number; semanticHits?: number; contextHash?: string }): void {
    if (input.text?.trim()) {
      const normalized = normalize(input.text);
      const existing = this.state.beliefs.find(belief => normalize(belief.claim) === normalized);
      if (existing) {
        existing.confidence = clamp(existing.confidence * 0.8 + clamp(input.confidence ?? 0.55) * 0.2);
        existing.updatedAt = Date.now();
      } else {
        this.state.beliefs.unshift({
          id: randomUUID(),
          claim: input.text.slice(0, 220),
          status: 'tentative',
          confidence: clamp(input.confidence ?? 0.45),
          evidence: input.source ? [input.source] : [],
          contradictions: [],
          revisionCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        this.state.encodeCount += 1;
      }
    }
    if (input.contextHash) this.state.lastContextHash = input.contextHash.slice(0, 128);
    if (input.semanticHits != null) this.state.retrieveCount += input.semanticHits > 0 ? 1 : 0;
  }

  recordRetrieval(query: string, hits: number): void {
    this.state.retrieveCount += 1;
    this.state.recentQueries = [{ query: query.slice(0, 180), at: Date.now(), hits: Math.max(0, Math.trunc(hits)) }, ...this.state.recentQueries].slice(0, 64);
  }

  updateBelief(claim: string, outcome: 'support' | 'contradict' | 'unknown', evidence: string, strength = 0.1): BeliefRecord {
    const normalized = normalize(claim);
    let belief = this.state.beliefs.find(item => normalize(item.claim) === normalized);
    if (!belief) {
      belief = {
        id: randomUUID(),
        claim: claim.slice(0, 220),
        status: 'unknown',
        confidence: 0.35,
        evidence: [],
        contradictions: [],
        revisionCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.state.beliefs.unshift(belief);
    }
    const delta = clamp(strength);
    if (outcome === 'support') {
      belief.confidence = clamp(belief.confidence + delta * (1 - belief.confidence));
      belief.status = belief.confidence >= 0.72 ? 'supported' : 'tentative';
      belief.evidence = [evidence.slice(0, 180), ...belief.evidence].slice(0, 24);
    } else if (outcome === 'contradict') {
      belief.confidence = clamp(belief.confidence - delta * belief.confidence);
      belief.status = belief.confidence <= 0.28 ? 'contradicted' : 'tentative';
      belief.contradictions = [evidence.slice(0, 180), ...belief.contradictions].slice(0, 24);
    }
    belief.revisionCount += 1;
    belief.updatedAt = Date.now();
    this.state.beliefRevisions += 1;
    return structuredClone(belief);
  }

  markDormantReactivation(count: number): void { this.state.dormantReactivations += Math.max(0, Math.trunc(count)); }
  markReconsolidation(count = 1): void { this.state.reconsolidationCount += Math.max(0, Math.trunc(count)); }
  markSkillPromotion(count = 1): void { this.state.skillPromotions += Math.max(0, Math.trunc(count)); }

  influence(query: string): number {
    const normalized = normalize(query);
    if (!normalized) return 0;
    const match = this.state.beliefs.find(belief => normalize(belief.claim).includes(normalized) || normalized.includes(normalize(belief.claim)));
    if (!match) return 0;
    return match.status === 'supported' ? 0.06 : match.status === 'contradicted' ? -0.05 : 0.02;
  }

  snapshot(): MemoryDevelopmentState { return structuredClone(this.state); }
  summary(memoryOS: MemoryOSState2) {
    return {
      beliefs: this.state.beliefs.length,
      beliefRevisions: this.state.beliefRevisions,
      dormantReactivations: this.state.dormantReactivations,
      reconsolidations: this.state.reconsolidationCount + memoryOS.reconsolidations,
      storedItems: memoryOS.items.length,
      recentQueries: this.state.recentQueries.length,
    };
  }
}
