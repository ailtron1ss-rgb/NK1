import type { P41PerceptionState } from '../cognition/P41SemanticPerception.ts';
import type { P41NativePerceptionState } from '../cognition/P41NativePerception.ts';
import type { P41TemporalPerceptionState } from '../cognition/P41TemporalPerceptionModel.ts';
import type { MultimodalState } from './MultimodalPerception.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const KINDS:readonly PerceptualEvidenceKind[]=['observed','model-output','derived','conflict','unresolved'];
const MODALITIES:readonly PerceptualEvidenceRecord['modality'][]=['text','vision','audio','sensor','world','fusion'];
const METRIC_KEYS:readonly (keyof PerceptualEvidenceState['metrics'])[]=['grounding01','semanticCoverage01','crossModalAgreement01','temporalBinding01','groundedSignalRatio01','conflict01','unresolved01'];
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,180)).slice(0,cap):[];
const sanRecord=(x:unknown):PerceptualEvidenceRecord|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,180),at:Math.max(0,finN(r.at,0)),modality:MODALITIES.includes(r.modality as PerceptualEvidenceRecord['modality'])?r.modality as PerceptualEvidenceRecord['modality']:'fusion',claim:typeof r.claim==='string'?r.claim.slice(0,400):'',confidence01:clamp(finN(r.confidence01,0)),uncertainty01:clamp(finN(r.uncertainty01,0)),kind:KINDS.includes(r.kind as PerceptualEvidenceKind)?r.kind as PerceptualEvidenceKind:'unresolved',parents:strArr(r.parents,8)};};
const sanMetrics=(v:unknown,d:PerceptualEvidenceState['metrics']):PerceptualEvidenceState['metrics']=>{const out={...d};if(!v||typeof v!=='object')return out;const r=v as Record<string,unknown>;for(const k of METRIC_KEYS)if(k in r)out[k]=clamp(finN(r[k],d[k]));return out;};
const sanQuery=(v:unknown):PerceptualEvidenceState['activeQuery']=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,180),modality:typeof r.modality==='string'?r.modality.slice(0,64):'',query:typeof r.query==='string'?r.query.slice(0,240):'',priority01:clamp(finN(r.priority01,0)),expectedInformationGain01:clamp(finN(r.expectedInformationGain01,0)),estimatedCost01:clamp(finN(r.estimatedCost01,0))};};
const stableHash=(value:string)=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};

export type PerceptualEvidenceKind='observed'|'model-output'|'derived'|'conflict'|'unresolved';
export interface PerceptualEvidenceRecord{
  id:string;
  at:number;
  modality:'text'|'vision'|'audio'|'sensor'|'world'|'fusion';
  claim:string;
  confidence01:number;
  uncertainty01:number;
  kind:PerceptualEvidenceKind;
  parents:string[];
}
export interface PerceptualEvidenceState{
  version:1;
  updates:number;
  lastAt:number;
  scene:string;
  evidence:PerceptualEvidenceRecord[];
  activeQuery:{id:string;modality:string;query:string;priority01:number;expectedInformationGain01:number;estimatedCost01:number}|null;
  metrics:{grounding01:number;semanticCoverage01:number;crossModalAgreement01:number;temporalBinding01:number;groundedSignalRatio01:number;conflict01:number;unresolved01:number};
  lastHash:string;
}
export const defaultPerceptualEvidence=():PerceptualEvidenceState=>({version:1,updates:0,lastAt:0,scene:'unknown',evidence:[],activeQuery:null,metrics:{grounding01:.08,semanticCoverage01:0,crossModalAgreement01:.5,temporalBinding01:.1,groundedSignalRatio01:0,conflict01:0,unresolved01:0},lastHash:''});

export interface PerceptualEvidenceInput{
  at:number;
  multimodal?:MultimodalState;
  semantic?:P41PerceptionState;
  native?:P41NativePerceptionState;
  temporal?:P41TemporalPerceptionState;
}

export class PerceptualEvidenceCompiler{
  private state=defaultPerceptualEvidence();
  restore(raw?:Partial<PerceptualEvidenceState>|null){
    const d=defaultPerceptualEvidence();const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    let evidence:PerceptualEvidenceRecord[]=[];try{const e=read('evidence');if(Array.isArray(e))evidence=e.slice(0,96).map(sanRecord).filter((x):x is PerceptualEvidenceRecord=>x!==null);}catch{evidence=[];}
    let activeQuery:PerceptualEvidenceState['activeQuery']=null;try{activeQuery=sanQuery(read('activeQuery'));}catch{activeQuery=null;}
    this.state={version:1,updates:cnt(read('updates'),d.updates),lastAt:Math.max(0,finN(read('lastAt'),d.lastAt)),scene:typeof read('scene')==='string'?String(read('scene')).slice(0,240):d.scene,evidence,activeQuery,metrics:sanMetrics(read('metrics'),d.metrics),lastHash:typeof read('lastHash')==='string'?String(read('lastHash')).slice(0,128):''};
  }
  snapshot(){return structuredClone(this.state);}

  /** P2840: feed independently observed external outcomes back into next-cycle grounding. */
  recordExternalEvidence(input:{at:number;claim:string;confidence01:number;parents?:string[];modality?:'sensor'|'world'|'fusion';verified?:boolean}){
    const confidence=clamp(input.confidence01);
    const record:PerceptualEvidenceRecord={
      id:`pe-external-${stableHash(`${input.at}:${input.claim}:${confidence.toFixed(3)}`)}`,
      at:input.at, modality:input.modality??'sensor', claim:String(input.claim).slice(0,240),
      confidence01:confidence, uncertainty01:1-confidence, kind:input.verified?'observed':'derived', parents:[...(input.parents??[])].slice(0,8),
    };
    const existing=this.state.evidence.findIndex(x=>x.id===record.id);
    if(existing<0) this.state.evidence=[record,...this.state.evidence].slice(0,96);
    this.state.lastAt=input.at; this.state.updates++;
    const observedBoost=input.verified?1:.45;
    this.state.metrics.groundedSignalRatio01=clamp(this.state.metrics.groundedSignalRatio01*.92+.08*observedBoost);
    this.state.metrics.grounding01=clamp(this.state.metrics.grounding01*.94+.06*confidence*observedBoost);
    this.state.metrics.temporalBinding01=clamp(this.state.metrics.temporalBinding01*.94+.06*(input.verified?1:.55));
    const digest=`${this.state.scene}|${this.state.evidence.slice(0,24).map(e=>`${e.modality}:${e.claim}:${e.confidence01.toFixed(2)}`).join('|')}|${JSON.stringify(this.state.metrics)}`;
    this.state.lastHash=stableHash(digest);
    return structuredClone(record);
  }
  compile(input:PerceptualEvidenceInput){
    const at=input.at;
    const semantic=input.semantic; const native=input.native; const temporal=input.temporal; const multi=input.multimodal;
    const records:PerceptualEvidenceRecord[]=[];
    if(semantic){
      const entities=semantic.entities.filter(e=>e.present01>.3).slice(0,16);
      for(const e of entities){
        const modalities=e.modalities.length?e.modalities:['world' as const];
        for(const modality of modalities){
          const evidenceKind=e.modalityEvidenceKinds?.[modality]??'unresolved';
          const observedAt=e.modalityLastSeenAt?.[modality]??e.lastSeenAt;
          records.push({
            id:`pe-${stableHash(`entity:${e.id}:${modality}:${observedAt}`)}`,
            at:observedAt,
            modality,
            claim:`entity:${e.id}:${e.label}`,
            confidence01:clamp(e.confidence01),
            uncertainty01:1-clamp(e.confidence01),
            kind:evidenceKind,
            parents:[e.id],
          });
        }
      }
      for(const r of semantic.relations.slice(0,16)){
        records.push({
          id:`pe-${stableHash(`relation:${r.id}:${r.at}`)}`,
          at:r.at,modality:r.modality,
          claim:`relation:${r.id}:${r.from}:${r.relation}:${r.to}`,
          confidence01:clamp(r.confidence01),uncertainty01:1-clamp(r.confidence01),
          kind:r.evidenceKind,
          parents:[r.fromEntityId,r.toEntityId].filter((x):x is string=>Boolean(x)),
        });
      }
      for(const event of semantic.events.slice(0,16)){
        const modalities=event.modalities.length?event.modalities:['world' as const];
        for(const modality of modalities){
          const evidenceKind=event.modalityEvidenceKinds?.[modality]??'unresolved';
          const observedAt=event.modalityLastSeenAt?.[modality]??event.lastAt;
          records.push({
            id:`pe-${stableHash(`event:${event.id}:${modality}:${observedAt}`)}`,
            at:observedAt,modality,
            claim:`event:${event.id}:${event.label}`,
            confidence01:clamp(event.confidence01),
            uncertainty01:1-clamp(event.confidence01),
            kind:evidenceKind,
            parents:[event.id],
          });
        }
      }
      if(semantic.scene.label!=='unknown') records.push({id:`pe-${stableHash(`scene:${semantic.scene.label}:${semantic.scene.at}`)}`,at:semantic.scene.at,modality:'fusion',claim:`scene:${semantic.scene.label}`,confidence01:semantic.scene.confidence01,uncertainty01:1-semantic.scene.confidence01,kind:semantic.sceneEvidenceKind??'unresolved',parents:[]});
    }
    if(native){
      for(const cue of native.semanticCues.slice(0,12)) records.push({id:`pe-${stableHash(`cue:${cue.id}`)}`,at:cue.at,modality:cue.modality,claim:`cue:${cue.label}`,confidence01:clamp(cue.confidence01),uncertainty01:1-clamp(cue.confidence01),kind:'derived',parents:[]});
    }
    const dedup=new Map<string,PerceptualEvidenceRecord>();
    const identity=(r:PerceptualEvidenceRecord)=>`${r.modality}:${r.claim}`;
    for(const r of records){const key=identity(r);const prev=dedup.get(key);if(!prev||r.at>prev.at)dedup.set(key,r);}
    for(const r of this.state.evidence){const key=identity(r);if(!dedup.has(key))dedup.set(key,r);}
    this.state.evidence=[...dedup.values()].sort((a,b)=>b.at-a.at).slice(0,96);
    const modalityReliability=semantic?Object.values(semantic.modalityReliability).map(x=>x.reliability01):[];
    const spread=modalityReliability.length?Math.max(...modalityReliability)-Math.min(...modalityReliability):0;
    const unresolved=semantic?semantic.pending.filter(x=>x.status==='pending').length:0;
    const coverage=semantic?Math.min(1,(semantic.entities.filter(e=>e.present01>.3).length/8))*0.72 + Math.min(1,(semantic.relations.length/8))*0.28:0;
    const externalLike=records.length?records.filter(r=>r.kind==='observed').length/records.length:0;
    this.state.scene=semantic?.scene.label??this.state.scene;
    this.state.metrics.grounding01=clamp(this.state.metrics.grounding01*.9+coverage*.1);
    this.state.metrics.semanticCoverage01=clamp(this.state.metrics.semanticCoverage01*.85+coverage*.15);
    this.state.metrics.crossModalAgreement01=clamp((semantic?.metrics.crossModalAgreement01??multi?.lastConfidence??.5));
    this.state.metrics.temporalBinding01=clamp(this.state.metrics.temporalBinding01*.9+(temporal?.metrics.temporalBinding01??0)*.1);
    this.state.metrics.groundedSignalRatio01=clamp(this.state.metrics.groundedSignalRatio01*.9+externalLike*.1);
    this.state.metrics.conflict01=clamp(this.state.metrics.conflict01*.9+spread*.1);
    this.state.metrics.unresolved01=clamp(unresolved/Math.max(1,semantic?.pending.length??1));
    const pending=semantic?.pending.filter(x=>x.status==='pending').sort((a,b)=>b.priority01-a.priority01)[0];
    this.state.activeQuery=pending?{id:pending.id,modality:pending.modality,query:pending.query,priority01:pending.priority01,expectedInformationGain01:pending.expectedInformationGain01,estimatedCost01:pending.estimatedCost01}:null;
    this.state.lastAt=at; this.state.updates++;
    const digest=`${this.state.scene}|${this.state.evidence.slice(0,24).map(e=>`${e.modality}:${e.claim}:${e.confidence01.toFixed(2)}`).join('|')}|${JSON.stringify(this.state.metrics)}`;
    this.state.lastHash=stableHash(digest);
    return this.snapshot();
  }
  summary(){return {scene:this.state.scene,activeQuery:this.state.activeQuery,metrics:this.state.metrics,evidence:this.state.evidence.slice(0,24),lastHash:this.state.lastHash};}
}
