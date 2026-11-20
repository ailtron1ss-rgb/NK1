import { types as utilTypes } from 'node:util';
import { cosineSimilarity } from '../core/NumericPrimitives.ts';

/** BIG PASS 239 — compiler between continuous neural traces and symbolic concepts. */
const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const safeLabel = (value: unknown): string => {
  const raw = typeof value === 'string' ? value : 'unknown';
  const normalized = raw.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 96);
  return normalized || 'unknown';
};
const quoteMeTTa = (value: string): string => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const numberAtom = (value: unknown): string => clamp(typeof value === 'number' ? value : 0).toFixed(4);
const MAX_RESTORED_CONCEPTS = 512;
const MAX_RESTORED_VECTOR_DIMENSIONS = 16;
const MAX_RESTORED_COUNTER = 1_000_000_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !utilTypes.isProxy(value);

const ownDataValue = (record: Record<string, unknown>, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
};

const hasOwnAccessor = (record: Record<string, unknown>, key: string): boolean => {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor !== undefined && !('value' in descriptor);
};

const safeCounter = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, MAX_RESTORED_COUNTER)
    : 0;

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
  version: 1, cycles: 0, compiled: 0, concepts: Object.create(null) as Record<string, ConceptPrototype>, mappingCoherence01: .5, lastConcept: 'none',
});
const cosine = (a: number[], b: number[]) => clamp((cosineSimilarity(a, b) + 1) / 2);

export class NeuroSymbolicConceptCompiler {
  private state = defaultNeuroSymbolicCompiler();

  restore(raw?: Partial<NeuroSymbolicCompilerState> | null) {
    const defaults = defaultNeuroSymbolicCompiler();
    try {
      if (!isRecord(raw)) {
        this.state = defaults;
        return;
      }

      const rootFields = ['cycles', 'compiled', 'concepts', 'mappingCoherence01', 'lastConcept'];
      if (rootFields.some((field) => hasOwnAccessor(raw, field))) {
        this.state = defaults;
        return;
      }

      const concepts = Object.create(null) as Record<string, ConceptPrototype>;
      const rawConcepts = ownDataValue(raw, 'concepts');
      if (isRecord(rawConcepts)) {
        const keys = Object.getOwnPropertyNames(rawConcepts).sort().slice(0, MAX_RESTORED_CONCEPTS);
        for (const key of keys) {
          const descriptor = Object.getOwnPropertyDescriptor(rawConcepts, key);
          if (!descriptor || !('value' in descriptor) || !isRecord(descriptor.value)) continue;
          const rawConcept = descriptor.value;
          const conceptFields = ['label', 'centroid', 'confidence01', 'uses', 'success01'];
          if (conceptFields.some((field) => hasOwnAccessor(rawConcept, field))) continue;

          const rawLabel = ownDataValue(rawConcept, 'label');
          const label = safeLabel(typeof rawLabel === 'string' ? rawLabel : key);
          if (Object.prototype.hasOwnProperty.call(concepts, label)) continue;

          const rawCentroid = ownDataValue(rawConcept, 'centroid');
          if (!Array.isArray(rawCentroid) || utilTypes.isProxy(rawCentroid)) continue;
          const dimensions = Math.min(rawCentroid.length, MAX_RESTORED_VECTOR_DIMENSIONS);
          const centroid: number[] = [];
          let hasAccessor = false;
          for (let index = 0; index < dimensions; index++) {
            const vectorDescriptor = Object.getOwnPropertyDescriptor(rawCentroid, String(index));
            if (vectorDescriptor && !('value' in vectorDescriptor)) {
              hasAccessor = true;
              break;
            }
            const value = vectorDescriptor && 'value' in vectorDescriptor ? vectorDescriptor.value : 0;
            centroid.push(typeof value === 'number' ? clamp(value) : 0);
          }
          if (hasAccessor) continue;

          const rawConfidence = ownDataValue(rawConcept, 'confidence01');
          const rawUses = ownDataValue(rawConcept, 'uses');
          const rawSuccess = ownDataValue(rawConcept, 'success01');
          concepts[label] = {
            label,
            centroid,
            confidence01: typeof rawConfidence === 'number' && Number.isFinite(rawConfidence) ? clamp(rawConfidence) : 0,
            uses: safeCounter(rawUses),
            success01: typeof rawSuccess === 'number' && Number.isFinite(rawSuccess) ? clamp(rawSuccess) : 0,
          };
        }
      }

      const rawCoherence = ownDataValue(raw, 'mappingCoherence01');
      const rawLastConcept = ownDataValue(raw, 'lastConcept');
      this.state = {
        version: 1,
        cycles: safeCounter(ownDataValue(raw, 'cycles')),
        compiled: safeCounter(ownDataValue(raw, 'compiled')),
        concepts,
        mappingCoherence01: typeof rawCoherence === 'number' && Number.isFinite(rawCoherence)
          ? clamp(rawCoherence)
          : defaults.mappingCoherence01,
        lastConcept: typeof rawLastConcept === 'string' ? safeLabel(rawLastConcept) : defaults.lastConcept,
      };
    } catch {
      this.state = defaults;
    }
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
      .sort((a, b) => {
        const left = safeLabel(a.label);
        const right = safeLabel(b.label);
        return left < right ? -1 : left > right ? 1 : 0;
      })
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
