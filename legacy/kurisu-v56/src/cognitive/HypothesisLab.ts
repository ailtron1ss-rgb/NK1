/**
 * HypothesisLab v1 — lightweight scientific memory.
 * A hypothesis is not a fact. It carries evidence, confidence and a test plan.
 */
import { clamp, readJson, uid, writeJson } from './StateVault';

export interface Hypothesis {
  id: string;
  statement: string;
  confidence: number;
  supporting: number;
  contradicting: number;
  status: 'open' | 'supported' | 'weakened' | 'retired';
  testPlan?: string;
  createdAt: number;
  updatedAt: number;
}

const KEY = 'kurisu_hypothesis_lab_v1';
const MAX = 40;

export class HypothesisLab {
  private items = readJson<Hypothesis[]>(KEY, []);
  private save() { this.items = this.items.slice(0, MAX); writeJson(KEY, this.items); }
  list() { return [...this.items].sort((a, b) => b.confidence - a.confidence); }
  open(statement: string, testPlan?: string, confidence = 35) {
    const h: Hypothesis = { id: uid('hyp'), statement: statement.slice(0, 240), confidence: clamp(confidence), supporting: 0, contradicting: 0, status: 'open', testPlan, createdAt: Date.now(), updatedAt: Date.now() };
    this.items.unshift(h); this.save(); return h;
  }
  observe(id: string, supports: boolean, weight = 1) {
    const h = this.items.find(x => x.id === id); if (!h) return false;
    if (supports) h.supporting += Math.max(0, weight); else h.contradicting += Math.max(0, weight);
    const total = h.supporting + h.contradicting;
    h.confidence = clamp(total ? (h.supporting / total) * 100 : h.confidence);
    h.status = h.confidence >= 75 ? 'supported' : h.confidence <= 25 ? 'weakened' : 'open';
    h.updatedAt = Date.now(); this.save(); return true;
  }
  promptHint(max = 800) {
    const open = this.items.filter(h => h.status === 'open').slice(0, 4);
    return ['[HYPOTHESES]', open.length ? open.map(h => `- ${h.statement} (${Math.round(h.confidence)}%)`).join('\n') : '- none', 'Hypotheses are provisional; never present them as facts.'].join('\n').slice(0, max);
  }
}
export const hypothesisLab = new HypothesisLab();
