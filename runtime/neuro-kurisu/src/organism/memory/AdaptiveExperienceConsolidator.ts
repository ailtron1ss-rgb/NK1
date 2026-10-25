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
const ownDataRecord=(value:unknown):Record<string,unknown>|null=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return null;
  const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
  const descriptors=Object.getOwnPropertyDescriptors(value),out:Record<string,unknown>=Object.create(null);
  for(const [key,d] of Object.entries(descriptors)){if(!('value'in d))return null;out[key]=d.value;}
  return out;
};
const ownDataArray=(value:unknown,max=4096):unknown[]=>{
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return [];
  const length=Object.getOwnPropertyDescriptor(value,'length');
  if(!length||!('value'in length)||!Number.isSafeInteger(length.value)||length.value<0||length.value>max)return [];
  const out:unknown[]=[];
  for(let i=0;i<length.value;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d){out.push(undefined);continue;}if(!('value'in d))return [];out.push(d.value);}
  return out;
};
const safeText=(value:unknown,max=180):string|null=>
  typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&
  !Array.from(value).some(ch=>{const cp=ch.codePointAt(0)??0;return cp<=0x1f||(cp>=0x7f&&cp<=0x9f);})?value:null;
function normalizeExperience(value:unknown):ExperienceRecord|null{
  const row=ownDataRecord(value);
  if(!row||!safeText(row.id,256)||typeof row.timestamp!=='number'||!Number.isFinite(row.timestamp)||row.timestamp<0||
    typeof row.novelty!=='number'||!Number.isFinite(row.novelty)||
    typeof row.utility!=='number'||!Number.isFinite(row.utility)||
    typeof row.uncertainty!=='number'||!Number.isFinite(row.uncertainty)||!Array.isArray(row.tags))return null;
  const tags=ownDataArray(row.tags,256).filter((tag):tag is string=>safeText(tag,96)!==null).slice(0,24);
  return {id:row.id as string,timestamp:row.timestamp,novelty:clamp01(row.novelty),utility:clamp01(row.utility),
    uncertainty:clamp01(row.uncertainty),tags:tags.map(tag=>tag)};
}

export class AdaptiveExperienceConsolidator {
  private readonly maxBuffer: number;
  private buffer: ExperienceRecord[] = [];

  constructor(maxBuffer = 256) {
    this.maxBuffer = Math.max(16, Math.floor(maxBuffer));
  }

  ingest(exp: ExperienceRecord): void {
    const normalized=normalizeExperience(exp);
    if(!normalized)throw new TypeError('invalid experience record');
    this.buffer.push(normalized);
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
    const maxInput=Math.min(65_536,Math.max(1_024,this.maxBuffer*4));
    const rows=ownDataArray(records,maxInput);
    const restored:ExperienceRecord[]=[];
    const seen=new Set<string>();
    // Walk newest-first so a duplicate identity cannot restore an obsolete copy.
    for(let i=rows.length-1;i>=0;i--){
      const normalized=normalizeExperience(rows[i]);
      if(!normalized||seen.has(normalized.id))continue;
      seen.add(normalized.id);restored.push(normalized);
      if(restored.length>=this.maxBuffer)break;
    }
    this.buffer=restored.reverse();
  }

  private score(e: ExperienceRecord): number {
    return clamp01(e.utility * 0.45 + e.novelty * 0.3 + (1 - e.uncertainty) * 0.25);
  }
}
