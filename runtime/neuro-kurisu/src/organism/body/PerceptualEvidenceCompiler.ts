import type { P41PerceptionState } from '../cognition/P41SemanticPerception.ts';
import type { P41NativePerceptionState } from '../cognition/P41NativePerception.ts';
import type { P41TemporalPerceptionState } from '../cognition/P41TemporalPerceptionModel.ts';
import type { MultimodalState } from './MultimodalPerception.ts';
import type { EmbodiedActionResult } from './EmbodiedActionExecutor.ts';
import { isTrustedEmbodiedOutcomeVerification } from '../system/ExternalPostconditionVerifier.ts';
import { countOr, isPlainDataArray, isPlainDataRecord, ownDataValue, stringOr, timestampOr, unitOr } from './RestoreSanitizers.ts';

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

const trustedPerceptualEvidenceSnapshots = new WeakSet<object>();
const consumedPerceptualEvidenceProofs = new WeakSet<object>();

/** True only for the exact in-process snapshot minted by this canonical evidence owner. */
export function isTrustedPerceptualEvidenceSnapshot(value:unknown):value is PerceptualEvidenceState{
  return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&trustedPerceptualEvidenceSnapshots.has(value as object));
}

function deepFreezeEvidenceSnapshot<T>(value:T,seen=new WeakSet<object>()):T{
  if(value===null||typeof value!=='object')return value;
  const object=value as unknown as object;
  if(seen.has(object))return value;
  seen.add(object);
  for(const key of Reflect.ownKeys(object)){
    let child:unknown;
    try{child=(object as Record<PropertyKey,unknown>)[key];}catch{continue;}
    deepFreezeEvidenceSnapshot(child,seen);
  }
  Object.freeze(value);
  return value;
}

function normalizeUnattestedEvidenceKind(value:unknown):PerceptualEvidenceKind{
  if(value==='observed')return 'derived';
  return value==='model-output'||value==='derived'||value==='conflict'||value==='unresolved'?value:'unresolved';
}

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
      ? rawEvidence.slice(0,96).map((row:unknown)=>{
        if(!isPlainDataRecord(row))return null;
        const id=stringOr(ownDataValue(row,'id'),'',180);
        const modality=stringOr(ownDataValue(row,'modality'),'world',16);
        const claim=stringOr(ownDataValue(row,'claim'),'',512);
        if(!id||!claim||!['text','vision','audio','sensor','world','fusion'].includes(modality))return null;
        const rawParents=ownDataValue(row,'parents');
        const parents=isPlainDataArray(rawParents,32)
          ?rawParents.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())&&value.length<=180).slice(0,8)
          :[];
        return {
          id, at:timestampOr(ownDataValue(row,'at'),0),
          modality:modality as PerceptualEvidenceRecord['modality'], claim,
          confidence01:unitOr(ownDataValue(row,'confidence01'),0),
          uncertainty01:unitOr(ownDataValue(row,'uncertainty01'),1),
          // An ephemeral verifier capability cannot be reconstructed from JSON.
          kind:normalizeUnattestedEvidenceKind(ownDataValue(row,'kind')), parents,
        } satisfies PerceptualEvidenceRecord;
      }).filter((row):row is PerceptualEvidenceRecord=>row!==null)
      : [];
    const evidenceCount=Math.max(1,evidence.length);
    const meanConfidence=evidence.length?evidence.reduce((sum,row)=>sum+row.confidence01,0)/evidence.length:0;
    const metrics={
      grounding01:evidence.length?clamp(meanConfidence*.45):d.metrics.grounding01,
      semanticCoverage01:Math.min(1,evidence.length/32),
      crossModalAgreement01:d.metrics.crossModalAgreement01,
      temporalBinding01:d.metrics.temporalBinding01,
      // Persisted aggregates cannot self-attest an observed sensor source.
      groundedSignalRatio01:0,
      conflict01:evidence.filter(row=>row.kind==='conflict').length/evidenceCount,
      unresolved01:evidence.filter(row=>row.kind==='unresolved').length/evidenceCount,
    };
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
      updates:countOr(ownDataValue(r,'updates'),d.updates),
      lastAt:timestampOr(ownDataValue(r,'lastAt'),d.lastAt),
      scene:stringOr(ownDataValue(r,'scene'),d.scene,120),
      evidence,
      activeQuery,
      metrics,
      lastHash:'',
    };
    const digest=`${this.state.scene}|${this.state.evidence.slice(0,24).map(row=>`${row.modality}:${row.claim}:${row.confidence01.toFixed(2)}:${row.kind}`).join('|')}|${JSON.stringify(this.state.metrics)}`;
    this.state.lastHash=stableHash(digest);
  }
  snapshot(){
    const snapshot=deepFreezeEvidenceSnapshot(structuredClone(this.state));
    trustedPerceptualEvidenceSnapshots.add(snapshot);
    return snapshot;
  }

  /** P2840: feed independently observed external outcomes back into next-cycle grounding. */
  recordExternalEvidence(input:{at:number;claim:string;confidence01:number;parents?:string[];modality?:'sensor'|'vision'|'world'|'fusion';verified?:boolean;verification?:unknown;embodiedAction?:EmbodiedActionResult}){
    const confidence=clamp(input.confidence01);
    // `verified` remains accepted for compatibility but is never an authority.
    const proof=input.verification;
    const trustedProof=isTrustedEmbodiedOutcomeVerification(proof,input.embodiedAction);
    const action=input.embodiedAction;
    const cameraArtifact=action?.realityClass==='camera-artifact'?action.artifact:undefined;
    const cameraFrameClaim=cameraArtifact
      ? `android-camera-frame:${cameraArtifact.cameraId ?? '?'}:${cameraArtifact.hash ?? 'missing-hash'}:${cameraArtifact.size ?? 0}:${cameraArtifact.captureNonce ?? 'missing-nonce'}`
      : undefined;
    const claimMatchesProof=action?.realityClass!=='camera-artifact' ||
      Boolean(cameraFrameClaim && input.modality==='vision' && input.claim===cameraFrameClaim &&
        Math.abs(input.at-Number(cameraArtifact?.capturedAt??0))<=2_000);
    const proofAvailable=Boolean(proof && typeof proof==='object' && !consumedPerceptualEvidenceProofs.has(proof as object));
    const independentlyVerified=trustedProof && claimMatchesProof && proofAvailable;
    if(independentlyVerified && proof && typeof proof==='object') consumedPerceptualEvidenceProofs.add(proof as object);
    const record:PerceptualEvidenceRecord={
      id:`pe-external-${stableHash(`${input.at}:${input.claim}:${confidence.toFixed(3)}`)}`,
      at:input.at, modality:input.modality??'sensor', claim:String(input.claim).slice(0,240),
      confidence01:confidence, uncertainty01:1-confidence, kind:independentlyVerified?'observed':'derived', parents:[...(input.parents??[])].slice(0,8),
    };
    const existing=this.state.evidence.findIndex(x=>x.id===record.id);
    if(existing<0) this.state.evidence=[record,...this.state.evidence].slice(0,96);
    this.state.lastAt=input.at; this.state.updates++;
    const evidenceBoost=independentlyVerified?1:.45;
    this.state.metrics.groundedSignalRatio01=clamp(this.state.metrics.groundedSignalRatio01*.92+.08*(independentlyVerified?1:0));
    this.state.metrics.grounding01=clamp(this.state.metrics.grounding01*.94+.06*confidence*evidenceBoost);
    this.state.metrics.temporalBinding01=clamp(this.state.metrics.temporalBinding01*.94+.06*(independentlyVerified?1:.55));
    const digest=`${this.state.scene}|${this.state.evidence.slice(0,24).map(e=>`${e.modality}:${e.claim}:${e.confidence01.toFixed(2)}:${e.kind}`).join('|')}|${JSON.stringify(this.state.metrics)}`;
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
          const evidenceKind=normalizeUnattestedEvidenceKind(e.modalityEvidenceKinds?.[modality]??'unresolved');
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
          kind:normalizeUnattestedEvidenceKind(r.evidenceKind),
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
            kind:normalizeUnattestedEvidenceKind(evidenceKind),
            parents:[event.id],
          });
        }
      }
      if(semantic.scene.label!=='unknown') records.push({id:`pe-${stableHash(`scene:${semantic.scene.label}:${semantic.scene.at}`)}`,at:semantic.scene.at,modality:'fusion',claim:`scene:${semantic.scene.label}`,confidence01:semantic.scene.confidence01,uncertainty01:1-semantic.scene.confidence01,kind:normalizeUnattestedEvidenceKind(semantic.sceneEvidenceKind??'unresolved'),parents:[]});
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
    const currentEvidence=this.state.evidence.filter(row=>row.at<=at&&at-row.at<=5_000);
    const externalLike=currentEvidence.length?currentEvidence.filter(row=>row.kind==='observed').length/currentEvidence.length:0;
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
    const digest=`${this.state.scene}|${this.state.evidence.slice(0,24).map(e=>`${e.modality}:${e.claim}:${e.confidence01.toFixed(2)}:${e.kind}`).join('|')}|${JSON.stringify(this.state.metrics)}`;
    this.state.lastHash=stableHash(digest);
    return this.snapshot();
  }
  summary(){return {scene:this.state.scene,activeQuery:this.state.activeQuery,metrics:this.state.metrics,evidence:this.state.evidence.slice(0,24),lastHash:this.state.lastHash};}
}
