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

function normalizeExperience(value:unknown):ExperienceRecord|null {
  if(value===null||typeof value!=='object'||Array.isArray(value))return null;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  const row:Record<string,unknown>=Object.create(null);
  for(const [key,descriptor] of Object.entries(descriptors)){
    if(!('value' in descriptor))return null;
    row[key]=descriptor.value;
  }
  if(typeof row.id!=='string'||!row.id.trim()||row.id!==row.id.trim()||row.id.length>180||/[\u0000-\u001f\u007f-\u009f]/.test(row.id))return null;
  if(typeof row.timestamp!=='number'||!Number.isFinite(row.timestamp)||row.timestamp<0)return null;
  for(const key of ['novelty','utility','uncertainty'] as const){
    if(typeof row[key]!=='number'||!Number.isFinite(row[key])||row[key]<0||row[key]>1)return null;
  }
  if(!Array.isArray(row.tags)||row.tags.length>24||row.tags.some(tag=>typeof tag!=='string'||!tag.trim()||tag.length>80||/[\u0000-\u001f\u007f-\u009f]/.test(tag)))return null;
  return {id:row.id,timestamp:row.timestamp,novelty:row.novelty as number,utility:row.utility as number,uncertainty:row.uncertainty as number,tags:[...row.tags as string[]]};
}

export class AdaptiveExperienceConsolidator {
  private readonly maxBuffer: number;
  private buffer: ExperienceRecord[] = [];

  constructor(maxBuffer = 256) {
    this.maxBuffer = Number.isSafeInteger(maxBuffer) ? Math.max(16, Math.min(4096, maxBuffer)) : 256;
  }

  ingest(exp: ExperienceRecord): void {
    const safe=normalizeExperience(exp);
    if(!safe)throw new TypeError('experience-record-invalid');
    if(this.buffer.some(existing=>existing.id===safe.id))throw new Error('experience-id-duplicate');
    this.buffer.push(safe);
    if (this.buffer.length > this.maxBuffer) this.buffer.splice(0, this.buffer.length - this.maxBuffer);
  }

  consolidate(limit = this.buffer.length): ConsolidatedExperience[] {
    if(this.buffer.length===0)return [];
    const requestedLimit=Number.isFinite(limit)?Math.floor(limit):this.buffer.length;
    if(requestedLimit<=0)return [];
    const boundedLimit=Math.min(this.buffer.length,requestedLimit);
    return this.buffer
      .map((e) => ({
        ...e,
        tags:[...e.tags],
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
    const restored:ExperienceRecord[]=[];
    if(Array.isArray(records))for(const raw of records.slice(-this.maxBuffer*4)){
      const safe=normalizeExperience(raw);
      if(!safe)continue;
      // Persisted snapshots may contain repeated IDs after older schema migrations.
      // Keep the last valid revision and move it to the newest position.
      const previous=restored.findIndex(row=>row.id===safe.id);
      if(previous>=0)restored.splice(previous,1);
      restored.push(safe);
    }
    this.buffer=restored.slice(-this.maxBuffer);
  }

  private score(e: ExperienceRecord): number {
    return clamp01(e.utility * 0.45 + e.novelty * 0.3 + (1 - e.uncertainty) * 0.25);
  }
}
