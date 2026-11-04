import type { ModalityObservation, Modality } from './MultimodalPerception.ts';
import { countOr, isPlainDataRecord, ownDataValue, timestampOr, unitOr } from './RestoreSanitizers.ts';
export interface SituationVector{version:1;at:number;modalities:Modality[];features:number[];confidence01:number;uncertainty01:number;conflict01:number;novelty01:number;summary:string;}
export interface MultimodalSituationState{version:1;situations:number;last:SituationVector|null;modalityReliability:Record<Modality,number>;crossModalAgreements:number;crossModalConflicts:number;}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const empty=()=>({text:.6,speech:.6,vision:.35,sensor:.55,world:.55});
const MODALITIES:readonly Modality[]=['text','speech','vision','sensor','world'];
export const defaultMultimodalSituation=():MultimodalSituationState=>({version:1,situations:0,last:null,modalityReliability:empty(),crossModalAgreements:0,crossModalConflicts:0});
function hashFeatures(value:string,count=8){const out:number[]=[];let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}for(let i=0;i<count;i++){h=Math.imul(h^i+1,16777619);out.push(c((h>>>0)/4294967295));}return out;}

/**
 * Rebuild the persisted per-modality reliability table from validated unit
 * numbers. A hostile snapshot with reliability outside 0..1 (or a non-number)
 * would otherwise weight fusion scores with garbage, silently skewing the
 * situation confidence and conflict metrics that gate downstream decisions.
 */
function sanitizeReliability(raw:unknown):Record<Modality,number>{
  const base=empty();
  const out:Record<Modality,number>={...base};
  for(const modality of MODALITIES){
    const value=ownDataValue(raw,modality);
    if(value!==undefined) out[modality]=unitOr(value,base[modality]);
  }
  return out;
}

/** Keep only the finite, bounded shape of a persisted situation vector, or null. */
function sanitizeLastSituation(raw:unknown):SituationVector|null{
  if(!isPlainDataRecord(raw)) return null;
  const modalities=ownDataValue(raw,'modalities');
  const features=ownDataValue(raw,'features');
  const vector:SituationVector={
    version:1,
    at:timestampOr(ownDataValue(raw,'at'),0),
    modalities:Array.isArray(modalities)?modalities.filter((m):m is Modality=>MODALITIES.includes(m as Modality)).slice(0,8):[],
    features:Array.isArray(features)?features.filter((n):n is number=>typeof n==='number'&&Number.isFinite(n)).slice(0,32):[],
    confidence01:unitOr(ownDataValue(raw,'confidence01'),0),
    uncertainty01:unitOr(ownDataValue(raw,'uncertainty01'),1),
    conflict01:unitOr(ownDataValue(raw,'conflict01'),0),
    novelty01:unitOr(ownDataValue(raw,'novelty01'),0),
    summary:typeof ownDataValue(raw,'summary')==='string'?(ownDataValue(raw,'summary') as string).slice(0,2200):'',
  };
  return vector;
}

export class MultimodalSituationModel{
 private state=defaultMultimodalSituation();
 restore(s:MultimodalSituationState|undefined){
  const d=defaultMultimodalSituation();
  const raw=isPlainDataRecord(s)?s:{};
  this.state={
    version:1,
    situations:countOr(ownDataValue(raw,'situations'),d.situations),
    last:sanitizeLastSituation(ownDataValue(raw,'last')),
    modalityReliability:sanitizeReliability(ownDataValue(raw,'modalityReliability')),
    crossModalAgreements:countOr(ownDataValue(raw,'crossModalAgreements'),d.crossModalAgreements),
    crossModalConflicts:countOr(ownDataValue(raw,'crossModalConflicts'),d.crossModalConflicts),
  };
 }
 snapshot(){return structuredClone(this.state);}
 fuse(events:ModalityObservation[]):SituationVector{
  const valid=events.filter(Boolean).slice(-16); const modalities=[...new Set(valid.map(x=>x.modality))];
  if(!valid.length)return{version:1,at:Date.now(),modalities:[],features:hashFeatures('empty-situation'),confidence01:.05,uncertainty01:.95,conflict01:0,novelty01:.1,summary:'no-observed-situation'};
  const weighted=valid.reduce((s,e)=>s+e.confidence*(this.state.modalityReliability[e.modality]??.5),0); const weight=valid.reduce((s,e)=>s+(this.state.modalityReliability[e.modality]??.5),0)||1;
  const confidence=c(weighted/weight); const spread=Math.max(...valid.map(e=>e.confidence))-Math.min(...valid.map(e=>e.confidence)); const conflict=modalities.length>1?c(spread*.8):0;
  const agreement=modalities.length>1&&spread<.22; if(agreement)this.state.crossModalAgreements++; if(conflict>.35)this.state.crossModalConflicts++;
  for(const e of valid){const old=this.state.modalityReliability[e.modality]??.5;this.state.modalityReliability[e.modality]=c(old*.92+e.confidence*.08);}
  const summary=valid.map(e=>`[${e.modality}|${e.confidence.toFixed(2)}] ${e.summary}`).join(' | ').slice(0,2200);
  const features=hashFeatures(valid.map(e=>`${e.modality}:${e.contentHash??e.summary}`).join('|')); const novelty=c(1-confidence*.45+conflict*.2+(modalities.length>2?.15:0));
  const out:SituationVector={version:1,at:Date.now(),modalities,features,confidence01:c(confidence-conflict*.35),uncertainty01:c(1-confidence+conflict*.35),conflict01:conflict,novelty01:novelty,summary};
  this.state.last=out; this.state.situations++; return structuredClone(out);
 }
}
