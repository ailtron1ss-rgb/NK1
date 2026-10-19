/**
 * Adaptive experience consolidator.
 *
 * Retention is utility/novelty/uncertainty weighted. The buffer is bounded so
 * consolidation cost stays predictable on mobile devices.
 */
export interface ExperienceRecord {
  id: string;
  timestamp: number;
  novelty: number;
  utility: number;
  uncertainty: number;
  tags: string[];
}

export interface ConsolidatedExperience extends ExperienceRecord {
  retentionScore: number;
  abstractionLevel: number;
  consolidated: boolean;
}

const clamp01=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));

export class AdaptiveExperienceConsolidator {
  private readonly maxBuffer: number;
  private buffer: ExperienceRecord[] = [];

  constructor(maxBuffer = 256) {
    this.maxBuffer = Math.max(16, Math.floor(maxBuffer));
  }

  ingest(exp: ExperienceRecord): void {
    this.buffer.push({ ...exp, novelty:clamp01(exp.novelty), utility:clamp01(exp.utility), uncertainty:clamp01(exp.uncertainty), tags:[...exp.tags].slice(0,24) });
    if (this.buffer.length > this.maxBuffer) this.buffer.splice(0, this.buffer.length - this.maxBuffer);
  }

  consolidate(limit = this.buffer.length): ConsolidatedExperience[] {
    const boundedLimit = Math.max(1, Math.min(this.buffer.length, Math.floor(limit)));
    return this.buffer
      .map((e) => ({
        ...e,
        retentionScore: this.score(e),
        abstractionLevel: clamp01((e.utility + e.novelty + (1 - e.uncertainty)) / 3),
        consolidated: true,
      }))
      .sort((a, b) => b.retentionScore - a.retentionScore)
      .slice(0, boundedLimit);
  }

  size(): number { return this.buffer.length; }

  snapshot(): ExperienceRecord[] { return structuredClone(this.buffer); }

  restore(records?: ExperienceRecord[] | null): void {
    this.buffer = Array.isArray(records) ? records.slice(-this.maxBuffer) : [];
  }

  private score(e: ExperienceRecord): number {
    return clamp01(e.utility * 0.45 + e.novelty * 0.3 + (1 - e.uncertainty) * 0.25);
  }
}
