import type { ActionKind } from '../core/types.ts';

const clamp = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clampSigned = (x:number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const now = () => Date.now();
const ACTIONS:ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];

export type P40Modality = 'text'|'vision'|'audio'|'sensor'|'world';

export interface P40SemanticClaim {
  id:string;
  modality:P40Modality;
  subject:string;
  predicate:string;
  object:string;
  confidence01:number;
  at:number;
  source:'observed'|'derived'|'inferred';
}

export interface P40Situation {
  id:string;
  tick:number;
  scene:string;
  focus:string[];
  claims:string[];
  uncertainty01:number;
  agreement01:number;
  at:number;
}

export interface P40CausalHypothesis {
  id:string;
  cause:string;
  effect:string;
  confidence01:number;
  evidenceIds:string[];
  samples:number;
  lastAt:number;
}

export interface P40SemanticIntelligenceState {
  version:1;
  tick:number;
  situations:P40Situation[];
  claims:P40SemanticClaim[];
  hypotheses:P40CausalHypothesis[];
  entityContinuity:Record<string,{count:number;confidence01:number;lastAt:number}>;
  modalityReliability:Record<P40Modality,{reliability01:number;samples:number;conflict01:number}>;
  focus:{primary:string;alternatives:string[];confidence01:number};
  actionBias:Record<ActionKind,number>;
  metrics:{semanticStability01:number;causalGrounding01:number;temporalBinding01:number;crossModalUsefulness01:number;updates:number};
}

function hash(s:string){
  let h=2166136261;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h,16777619);
  }
  return (h>>>0).toString(16).padStart(8,'0');
}
function id(prefix:string,s:string){return `${prefix}-${hash(s)}`;}

export const defaultP40SemanticIntelligence = ():P40SemanticIntelligenceState => ({
  version:1,
  tick:0,
  situations:[],
  claims:[],
  hypotheses:[],
  entityContinuity:{},
  modalityReliability:{
    text:{reliability01:.65,samples:0,conflict01:0},
    vision:{reliability01:.35,samples:0,conflict01:0},
    audio:{reliability01:.28,samples:0,conflict01:0},
    sensor:{reliability01:.55,samples:0,conflict01:0},
    world:{reliability01:.62,samples:0,conflict01:0},
  },
  focus:{primary:'unknown',alternatives:[],confidence01:.2},
  actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
  metrics:{semanticStability01:.2,causalGrounding01:0,temporalBinding01:0,crossModalUsefulness01:0,updates:0},
});

export interface P40SemanticInput {
  scene?:string;
  claims?:Array<{
    modality:P40Modality;
    subject:string;
    predicate:string;
    object:string;
    confidence01?:number;
    source?:'observed'|'derived'|'inferred';
  }>;
  entityLabels?:string[];
  uncertainty01?:number;
  agreement01?:number;
  at?:number;
}

export class P40SemanticIntelligenceEngine {
  private state = defaultP40SemanticIntelligence();

  restore(raw?:Partial<P40SemanticIntelligenceState>|null){
    const d = defaultP40SemanticIntelligence();
    const r = raw ?? {};
    this.state = {
      ...d,
      ...r,
      situations:Array.isArray(r.situations) ? r.situations.slice(-64) : [],
      claims:Array.isArray(r.claims) ? r.claims.slice(-256) : [],
      hypotheses:Array.isArray(r.hypotheses) ? r.hypotheses.slice(-128) : [],
      entityContinuity:{...d.entityContinuity,...(r.entityContinuity??{})},
      modalityReliability:{...d.modalityReliability,...(r.modalityReliability??{})},
      focus:{...d.focus,...(r.focus??{})},
      actionBias:{...d.actionBias,...(r.actionBias??{})},
      metrics:{...d.metrics,...(r.metrics??{})},
    };
  }

  snapshot(){return structuredClone(this.state);}

  ingest(input:P40SemanticInput, returnSnapshot=true){
    const at = input.at ?? now();
    const scene = String(input.scene || 'unknown').slice(0,120);
    const rawClaims = (input.claims ?? []).slice(0,48);
    const ids:string[] = [];
    for(const c of rawClaims){
      const subject = String(c.subject || 'unknown').slice(0,96);
      const predicate = String(c.predicate || 'related-to').slice(0,64);
      const object = String(c.object || 'unknown').slice(0,96);
      const rec:P40SemanticClaim = {
        id:id('claim',`${c.modality}:${subject}:${predicate}:${object}`),
        modality:c.modality,
        subject,
        predicate,
        object,
        confidence01:clamp(c.confidence01 ?? .5),
        at,
        source:c.source ?? 'observed',
      };
      this.state.claims.unshift(rec);
      ids.push(rec.id);
      const health = this.state.modalityReliability[c.modality];
      health.samples++;
      health.reliability01 = clamp(health.reliability01*.97 + rec.confidence01*.03);
      const key = `${rec.modality}:${subject}`;
      const prev = this.state.entityContinuity[key] ?? {count:0,confidence01:0,lastAt:0};
      this.state.entityContinuity[key] = {
        count:prev.count+1,
        confidence01:clamp(prev.confidence01*.8 + rec.confidence01*.2),
        lastAt:at,
      };
    }
    this.state.claims = this.state.claims.slice(0,256);
    const agreement = clamp(input.agreement01 ?? .5);
    const uncertainty = clamp(input.uncertainty01 ?? (1-agreement));
    const focusLabels = [...new Set(this.state.claims.slice(0,20).flatMap(c => [c.subject,c.object]).filter(Boolean))].slice(0,6);
    this.state.focus = {
      primary:focusLabels[0] ?? scene,
      alternatives:focusLabels.slice(1,4),
      confidence01:clamp((1-uncertainty)*.65 + agreement*.35),
    };
    this.state.situations.unshift({
      id:id('situation',`${scene}:${this.state.tick}:${this.state.focus.primary}`),
      tick:this.state.tick,
      scene,
      focus:focusLabels,
      claims:ids,
      uncertainty01:uncertainty,
      agreement01:agreement,
      at,
    });
    this.state.situations = this.state.situations.slice(0,64);
    const bySubject = new Map<string,P40SemanticClaim[]>();
    for(const c of this.state.claims.slice(0,24)){
      const arr = bySubject.get(c.subject) ?? [];
      arr.push(c);
      bySubject.set(c.subject,arr);
    }
    for(const [subject,arr] of bySubject){
      const rel = arr.find(c => c.predicate === 'causes' || c.predicate === 'leads-to');
      if(!rel) continue;
      const hid = id('hypothesis',`${subject}:${rel.object}`);
      const existing = this.state.hypotheses.find(h => h.id === hid);
      if(existing){
        existing.samples++;
        existing.confidence01 = clamp(existing.confidence01*.85 + rel.confidence01*.15);
        existing.lastAt = at;
        if(!existing.evidenceIds.includes(rel.id)) existing.evidenceIds.unshift(rel.id);
      } else {
        this.state.hypotheses.unshift({
          id:hid,
          cause:subject,
          effect:rel.object,
          confidence01:rel.confidence01,
          evidenceIds:[rel.id],
          samples:1,
          lastAt:at,
        });
      }
    }
    this.state.hypotheses = this.state.hypotheses.slice(0,128);
    this.state.metrics.semanticStability01 = clamp(this.state.metrics.semanticStability01*.96 + (scene === this.state.situations[1]?.scene ? 1 : 0)*.04);
    this.state.metrics.temporalBinding01 = clamp(this.state.metrics.temporalBinding01*.97 + (this.state.situations.length > 1 ? 1 : .1)*.03);
    this.state.metrics.causalGrounding01 = clamp(this.state.metrics.causalGrounding01*.98 + Math.min(1,this.state.hypotheses.length/12)*.02);
    this.state.metrics.crossModalUsefulness01 = clamp(this.state.metrics.crossModalUsefulness01*.97 + agreement*.03);
    this.state.metrics.updates++;
    this.state.tick++;
    return returnSnapshot ? this.snapshot() : undefined;
  }

  learnActionOutcome(action:ActionKind,reward01:number){
    const r = clamp(reward01);
    this.state.actionBias[action] = clampSigned(this.state.actionBias[action]*.9 + (r-.5)*.18);
    return this.state.actionBias[action];
  }
  bias(action:ActionKind){return this.state.actionBias[action] ?? 0;}
  semanticSummary(){
    return {
      focus:this.state.focus,
      scene:this.state.situations[0]?.scene ?? 'unknown',
      uncertainty01:this.state.situations[0]?.uncertainty01 ?? .5,
      agreement01:this.state.situations[0]?.agreement01 ?? .5,
      topClaims:this.state.claims.slice(0,12),
      hypotheses:this.state.hypotheses.slice(0,8),
      metrics:this.state.metrics,
    };
  }
}
