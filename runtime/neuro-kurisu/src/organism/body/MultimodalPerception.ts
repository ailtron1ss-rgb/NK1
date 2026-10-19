import { createHash } from 'node:crypto';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

export type Modality = 'text'|'speech'|'vision'|'sensor'|'world';
export interface ModalityObservation { modality: Modality; at:number; summary:string; confidence:number; salience:number; evidence:string[]; contentHash?:string; }
export interface MultimodalState {
  version:1;
  events:number;
  fused:number;
  lastFusionAt:number;
  lastConfidence:number;
  lastSalience:number;
  modalities:Record<Modality,number>;
  recent:ModalityObservation[];
  visionCaptures:number;
  speechTurns:number;
  fusionConflicts:number;
}
export const defaultMultimodalState=():MultimodalState=>({version:1,events:0,fused:0,lastFusionAt:0,lastConfidence:.25,lastSalience:.15,modalities:{text:0,speech:0,vision:0,sensor:0,world:0},recent:[],visionCaptures:0,speechTurns:0,fusionConflicts:0});

function hashText(value:string){return createHash('sha256').update(value).digest('hex').slice(0,16)}

export class MultimodalPerception {
  private state=defaultMultimodalState();
  restore(value?:Partial<MultimodalState>|null){this.state={...defaultMultimodalState(),...(value??{}),modalities:{...defaultMultimodalState().modalities,...(value?.modalities??{})},recent:Array.isArray(value?.recent)?value!.recent.slice(0,64):[]};}
  snapshot(){return structuredClone(this.state)}
  observe(input:Omit<ModalityObservation,'at'|'contentHash'> & {at?:number; content?:string}):ModalityObservation{
    const at=input.at??Date.now(); const content=input.content??input.summary; const hash=content?hashText(content):undefined;
    const ev:ModalityObservation={modality:input.modality,at,summary:input.summary.slice(0,500),confidence:clamp(input.confidence),salience:clamp(input.salience),evidence:input.evidence.slice(0,12),contentHash:hash};
    this.state.events++; this.state.modalities[ev.modality]++; if(ev.modality==='vision') this.state.visionCaptures++; if(ev.modality==='speech') this.state.speechTurns++;
    this.state.recent=[ev,...this.state.recent].slice(0,64); this.state.lastFusionAt=at; this.state.lastConfidence=clamp(this.state.lastConfidence*.68+ev.confidence*.32); this.state.lastSalience=clamp(this.state.lastSalience*.72+ev.salience*.28); return ev;
  }
  fuse(events:ModalityObservation[]):{summary:string;confidence:number;salience:number;modalities:Modality[]} {
    const valid=events.filter(Boolean).slice(-12); if(!valid.length) return {summary:'no-multimodal-evidence',confidence:0,salience:0,modalities:[]};
    const modalities=[...new Set(valid.map(x=>x.modality))];
    const avg=(key:'confidence'|'salience')=>valid.reduce((s,x)=>s+x[key],0)/valid.length;
    const summaries=valid.map(x=>`[${x.modality}] ${x.summary}`).join(' | ');
    const spread=Math.max(...valid.map(x=>x.confidence))-Math.min(...valid.map(x=>x.confidence));
    if(modalities.length>=2 && spread>.55) this.state.fusionConflicts++;
    this.state.fused++; return {summary:summaries.slice(0,1800),confidence:clamp(avg('confidence')-.08*spread),salience:clamp(avg('salience')),modalities};
  }
}
