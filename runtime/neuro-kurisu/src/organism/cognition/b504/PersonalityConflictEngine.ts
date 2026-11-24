export interface Belief { id:string; confidence:number; content:string }
export interface Conflict { beliefId:string; intensity:number; resolution:string; evidenceSupport01:number; contradicts:boolean }

const clamp01=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));

type EvidenceInput = string | { support01:number; contradicts?:boolean };

export class PersonalityConflictEngine {
  analyze(belief: Belief, evidence: EvidenceInput): Conflict {
    const support01 = typeof evidence === 'string' ? clamp01(evidence.trim().length / 200) : clamp01(evidence.support01);
    const contradicts = typeof evidence === 'string' ? false : Boolean(evidence.contradicts);
    const confidence = clamp01(belief.confidence);
    const mismatch = contradicts ? confidence * 0.75 + (1 - support01) * 0.25 : Math.abs(confidence - support01);
    const intensity = clamp01(mismatch);
    return {
      beliefId: belief.id,
      intensity,
      evidenceSupport01: support01,
      contradicts,
      resolution: intensity > 0.65 ? 'review_belief' : intensity > 0.35 ? 'seek_more_evidence' : 'integrate_experience',
    };
  }
}
