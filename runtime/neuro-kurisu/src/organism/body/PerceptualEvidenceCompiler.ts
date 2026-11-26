import type { P41PerceptionState } from '../cognition/P41SemanticPerception.ts';
import type { P41NativePerceptionState } from '../cognition/P41NativePerception.ts';
import type { P41TemporalPerceptionState } from '../cognition/P41TemporalPerceptionModel.ts';
import type { MultimodalState } from './MultimodalPerception.ts';
import { isPlainDataArray, isPlainDataRecord, ownDataValue, stringOr, timestampOr, unitOr } from './RestoreSanitizers.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
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
const EVIDENCE_MODALITIES = new Set<PerceptualEvidenceRecord['modality']>(['text','vision','audio','sensor','world','fusion']);
const RESTORABLE_EVIDENCE_KINDS = new Set<PerceptualEvidenceKind>(['model-output','derived','conflict','unresolved']);
const nonAuthoritativeKind=(kind:PerceptualEvidenceKind|undefined):PerceptualEvidenceKind=>kind==='observed'?'derived':(kind??'unresolved');

function restoreEvidenceRecord(value:unknown):PerceptualEvidenceRecord|null{
  if(!isPlainDataRecord(value))return null;
  const id=ownDataValue(value,'id'), at=ownDataValue(value,'at');
  const modality=ownDataValue(value,'modality'), claim=ownDataValue(value,'claim');
  if(typeof id!=='string'||!id.trim()||id.length>180||
    typeof at!=='number'||!Number.isSafeInteger(at)||at<0||
    typeof modality!=='string'||!EVIDENCE_MODALITIES.has(modality as PerceptualEvidenceRecord['modality'])||
    typeof claim!=='string'||!claim.trim())return null;
  const confidence01=unitOr(ownDataValue(value,'confidence01'),0);
  const rawKind=ownDataValue(value,'kind');
  const kind:PerceptualEvidenceKind=rawKind==='observed'
    ?'derived'
    :typeof rawKind==='string'&&RESTORABLE_EVIDENCE_KINDS.has(rawKind as PerceptualEvidenceKind)
      ?rawKind as PerceptualEvidenceKind
      :'unresolved';
  const rawParents=ownDataValue(value,'parents');
  const parents=isPlainDataArray(rawParents,32)
    ?rawParents.filter((parent):parent is string=>typeof parent==='string'&&Boolean(parent.trim())).slice(0,8).map(parent=>parent.trim().slice(0,180))
    :[];
  return {
    id:id.trim(),at,modality:modality as PerceptualEvidenceRecord['modality'],
    claim:claim.trim().slice(0,240),confidence01,
    uncertainty01:unitOr(ownDataValue(value,'uncertainty01'),1-confidence01),
    kind,parents,
  };
};

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
  /**
   * Rebuild persisted evidence state from validated primitives. The metrics block
   * feeds epistemic/immune scoring and the grounded-world integrate step, so a
   * corrupted metric (string, NaN or >1) must be replaced by its default rather
   * than spread into live state. Evidence rows and the active query are re-derived
   * through own data descriptors so a hostile record cannot inject accessors.
   */
  restore(raw?:Partial<PerceptualEvidenceState>|null){
    const d=defaultPerceptualEvidence();
    const r=isPlainDataRecord(raw)?raw:{};
    const rawEvidence=ownDataValue(r,'evidence');
    const evidence=isPlainDataArray(rawEvidence,512)
      ?rawEvidence.map(restoreEvidenceRecord).filter((row):row is PerceptualEvidenceRecord=>row!==null).slice(0,96)
      :[];
    const rawQuery=ownDataValue(r,'activeQuery');
    const activeQuery=isPlainDataRecord(rawQuery)?{
      id:stringOr(ownDataValue(rawQuery,'id'),'',128),
      modality:stringOr(ownDataValue(rawQuery,'modality'),'unknown',32),
      query:stringOr(ownDataValue(rawQuery,'query'),'',240),
      priority01:unitOr(ownDataValue(rawQuery,'priority01'),0),
      expectedInformationGain01:unitOr(ownDataValue(rawQuery,'expectedInformationGain01'),0),
      estimatedCost01:unitOr(ownDataValue(rawQuery,'estimatedCost01'),0),
    }:null;
    this.state={
      version:1,
      // Aggregate counters and smoothed metrics are not admission evidence. Rebuild
      // the bounded count from accepted rows and reset unverifiable aggregates.
      updates:evidence.length,
      lastAt:evidence.reduce((latest,row)=>Math.max(latest,row.at),0),
      scene:stringOr(ownDataValue(r,'scene'),d.scene,120),
      evidence,
      activeQuery,
      metrics:{...d.metrics},
      lastHash:'',
    };
    if(evidence.length>0||this.state.scene!==d.scene||activeQuery!==null)this.refreshHash();
  }
  private refreshHash(){
    const digest=`${this.state.scene}|${this.state.evidence.slice(0,24).map(e=>`${e.modality}:${e.claim}:${e.confidence01.toFixed(2)}`).join('|')}|${JSON.stringify(this.state.metrics)}`;
    this.state.lastHash=stableHash(digest);
  }
  snapshot(){return structuredClone(this.state);}

  /**
   * External observations stay derived until a host-owned, cryptographically
   * verified admission receipt is wired into this owner. Caller flags are ignored.
   */
  recordExternalEvidence(input:{at:number;claim:string;confidence01:number;parents?:string[];modality?:'sensor'|'world'|'fusion'}){
    // External producer payloads are untrusted data. Reject Proxy/accessor shapes
    // before property access so caller-defined code cannot run during admission.
    if(!isPlainDataRecord(input))throw new TypeError('external-perceptual-evidence-input-invalid');
    const at=timestampOr(ownDataValue(input,'at'),-1);
    const claim=stringOr(ownDataValue(input,'claim'),'',240).trim();
    if(at<0||!Number.isSafeInteger(at))throw new RangeError('external-perceptual-evidence-timestamp-invalid');
    if(!claim)throw new TypeError('external-perceptual-evidence-claim-required');
    const confidence=clamp(Number(ownDataValue(input,'confidence01')??0));
    const rawModality=ownDataValue(input,'modality');
    const modality=typeof rawModality==='string'&&EVIDENCE_MODALITIES.has(rawModality as PerceptualEvidenceRecord['modality'])
      ?rawModality as PerceptualEvidenceRecord['modality']:'sensor';
    const rawParents=ownDataValue(input,'parents');
    const parents=isPlainDataArray(rawParents,32)
      ?rawParents.filter((parent):parent is string=>typeof parent==='string'&&Boolean(parent.trim())).slice(0,8).map(parent=>parent.trim().slice(0,180))
      :[];
    const record:PerceptualEvidenceRecord={
      id:`pe-external-${stableHash(`${at}:${claim}:${confidence.toFixed(3)}`)}`,
      at,modality,claim,confidence01:confidence,uncertainty01:1-confidence,
      kind:'derived',parents,
    };
    const existing=this.state.evidence.findIndex(row=>row.id===record.id);
    if(existing>=0)return structuredClone(this.state.evidence[existing]);
    this.state.evidence=[record,...this.state.evidence].slice(0,96);
    this.state.lastAt=Math.max(this.state.lastAt,at);
    this.state.updates++;
    // Derived input carries a deliberately bounded, non-observational influence.
    const derivedWeight=.45;
    this.state.metrics.groundedSignalRatio01=clamp(this.state.metrics.groundedSignalRatio01*.92+.08*derivedWeight);
    this.state.metrics.grounding01=clamp(this.state.metrics.grounding01*.94+.06*confidence*derivedWeight);
    this.state.metrics.temporalBinding01=clamp(this.state.metrics.temporalBinding01*.94+.06*.55);
    this.refreshHash();
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
            kind:nonAuthoritativeKind(evidenceKind),
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
          kind:nonAuthoritativeKind(r.evidenceKind),
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
      if(semantic.scene.label!=='unknown') records.push({id:`pe-${stableHash(`scene:${semantic.scene.label}:${semantic.scene.at}`)}`,at:semantic.scene.at,modality:'fusion',claim:`scene:${semantic.scene.label}`,confidence01:semantic.scene.confidence01,uncertainty01:1-semantic.scene.confidence01,kind:nonAuthoritativeKind(semantic.sceneEvidenceKind),parents:[]});
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
    this.refreshHash();
    return this.snapshot();
  }
  summary(){return {scene:this.state.scene,activeQuery:this.state.activeQuery,metrics:this.state.metrics,evidence:this.state.evidence.slice(0,24),lastHash:this.state.lastHash};}
}
