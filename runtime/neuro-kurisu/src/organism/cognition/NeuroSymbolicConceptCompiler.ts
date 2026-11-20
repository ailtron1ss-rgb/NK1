import { cosineSimilarity } from '../core/NumericPrimitives.ts';

/** BIG PASS 239 — compiler between continuous neural traces and symbolic concepts. */
const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const safeLabel = (value: unknown): string => {
  const raw = typeof value === 'string' ? value : 'unknown';
  const normalized = raw.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 96);
  return normalized || 'unknown';
};
const quoteMeTTa = (value: string): string => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const numberAtom = (value: unknown): string => clamp(typeof value === 'number' ? value : 0).toFixed(4);

export interface ConceptPrototype {
  label: string;
  centroid: number[];
  confidence01: number;
  uses: number;
  success01: number;
}
export interface NeuroSymbolicCompilerState {
  version: 1;
  cycles: number;
  compiled: number;
  concepts: Record<string, ConceptPrototype>;
  mappingCoherence01: number;
  lastConcept: string;
}
export interface MeTTaConceptExport {
  format: 'metta';
  conceptCount: number;
  facts: string[];
  text: string;
}
export const defaultNeuroSymbolicCompiler = (): NeuroSymbolicCompilerState => ({
  version: 1, cycles: 0, compiled: 0, concepts: {}, mappingCoherence01: .5, lastConcept: 'none',
});
const cosine = (a: number[], b: number[]) => clamp((cosineSimilarity(a, b) + 1) / 2);

export class NeuroSymbolicConceptCompiler {
  private state = defaultNeuroSymbolicCompiler();

  restore(raw?: Partial<NeuroSymbolicCompilerState> | null) {
    const d = defaultNeuroSymbolicCompiler(), r = raw ?? {};
    this.state = { ...d, ...r, concepts: { ...d.concepts, ...(r.concepts ?? {}) }, version: 1 };
  }

  snapshot() {
    return structuredClone(this.state);
  }

  compile(input: { label: string; latent: number[]; outcome01: number; novelty01: number }) {
    const label = safeLabel(input.label);
    const latent = input.latent.filter(Number.isFinite).map(clamp).slice(0, 16);
    const existing = Object.values(this.state.concepts);
    let best: ConceptPrototype | undefined, bestSim = 0;
    for (const concept of existing) {
      if (concept.centroid.length !== latent.length) continue;
      const sim = cosine(latent, concept.centroid);
      if (sim > bestSim) { bestSim = sim; best = concept; }
    }
    if (!best || bestSim < .76) {
      best = { label, centroid: latent, confidence01: .35, uses: 0, success01: .5 };
      this.state.concepts[label] = best;
      this.state.compiled++;
    } else {
      best.centroid = best.centroid.map((value, index) => clamp(value * .86 + (latent[index] ?? value) * .14));
    }
    best.uses++;
    best.success01 = clamp(best.success01 * .9 + clamp(input.outcome01) * .1);
    best.confidence01 = clamp(best.confidence01 * .9 + (bestSim || .55) * .1);
    this.state.cycles++;
    this.state.lastConcept = best.label;
    this.state.mappingCoherence01 = clamp(this.state.mappingCoherence01 * .88 + (bestSim || .55) * .12);
    return { label: best.label, similarity01: bestSim, confidence01: best.confidence01, isNew: existing.indexOf(best) < 0 };
  }

  /**
   * Export a bounded, deterministic MeTTa fact set for an optional Hyperon adapter.
   * This is serialization only: no rule parsing, evaluation, process launch or memory write occurs.
   */
  exportMeTTaFacts(maxConcepts = 128): MeTTaConceptExport {
    const limit = Number.isFinite(maxConcepts) ? Math.max(0, Math.min(128, Math.floor(maxConcepts))) : 128;
    const concepts = Object.values(this.state.concepts)
      .filter((concept) => concept && Array.isArray(concept.centroid))
      .sort((a, b) => safeLabel(a.label).localeCompare(safeLabel(b.label)))
      .slice(0, limit);
    const facts: string[] = [];
    for (const concept of concepts) {
      const label = quoteMeTTa(safeLabel(concept.label));
      const uses = Number.isSafeInteger(concept.uses) && concept.uses >= 0 ? concept.uses : 0;
      facts.push('(NK1Concept ' + label + ' ' + numberAtom(concept.confidence01) + ' ' + uses + ' ' + numberAtom(concept.success01) + ')');
      const vector = concept.centroid.slice(0, 16).map(numberAtom);
      facts.push('(NK1ConceptEmbedding ' + label + ' (Vector' + (vector.length ? ' ' + vector.join(' ') : '') + '))');
    }
    return { format: 'metta', conceptCount: concepts.length, facts, text: facts.join('\n') };
  }

  summary() {
    return {
      cycles: this.state.cycles,
      compiled: this.state.compiled,
      concepts: Object.keys(this.state.concepts).length,
      mappingCoherence01: this.state.mappingCoherence01,
      lastConcept: this.state.lastConcept,
    };
  }
}
