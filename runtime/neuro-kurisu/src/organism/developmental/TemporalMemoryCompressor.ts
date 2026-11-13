import { createHash } from 'node:crypto';
export interface MemoryCapsule{ id:string; startedAt:number; endedAt:number; eventCount:number; highlights:string[]; dominantActions:string[]; predictionError01:number; confidence01:number; sourceTraceIds:string[]; tier:'daily'|'weekly'|'monthly'; provenanceClasses:string[]; correctionCount:number; correctedTraceIds:string[]; correctionLinks:Array<{id:string;corrects:string}>; evidenceHashes:string[]; sourceDiversity01:number; }
export interface TemporalMemoryCompressionState{version:3;inputEvents:number;capsulesCreated:number;rawCompactions:number;lastCompactionAt:number;hotWindowSize:number;capsules:MemoryCapsule[];}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(fin(v,f)));
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string').map(x=>x.slice(0,320)).slice(-cap):[];
const TIERS:readonly MemoryCapsule['tier'][]=['daily','weekly','monthly'];
const sanitizeCapsule=(v:unknown):MemoryCapsule|null=>{
  if(!v||typeof v!=='object')return null;
  const r=v as Record<string,unknown>;
  if(typeof r.id!=='string'||!r.id)return null;
  const links=Array.isArray(r.correctionLinks)?r.correctionLinks.filter((l):l is Record<string,unknown>=>Boolean(l&&typeof l==='object'&&typeof (l as Record<string,unknown>).id==='string'&&typeof (l as Record<string,unknown>).corrects==='string')).map(l=>({id:(l.id as string).slice(0,80),corrects:(l.corrects as string).slice(0,80)})).slice(-32):[];
  return {id:r.id.slice(0,80),startedAt:Math.max(0,fin(r.startedAt,0)),endedAt:Math.max(0,fin(r.endedAt,0)),eventCount:cnt(r.eventCount,0),highlights:strArr(r.highlights,8),dominantActions:strArr(r.dominantActions,8),predictionError01:c(fin(r.predictionError01,0)),confidence01:c(fin(r.confidence01,0)),sourceTraceIds:strArr(r.sourceTraceIds,32),tier:TIERS.includes(r.tier as MemoryCapsule['tier'])?r.tier as MemoryCapsule['tier']:'daily',provenanceClasses:strArr(r.provenanceClasses,8),correctionCount:cnt(r.correctionCount,0),correctedTraceIds:strArr(r.correctedTraceIds,32),correctionLinks:links,evidenceHashes:strArr(r.evidenceHashes,32),sourceDiversity01:c(fin(r.sourceDiversity01,0))};
};
export const defaultTemporalMemoryCompression=():TemporalMemoryCompressionState=>({version:3,inputEvents:0,capsulesCreated:0,rawCompactions:0,lastCompactionAt:0,hotWindowSize:160,capsules:[]});
export class TemporalMemoryCompressor{
 private state=defaultTemporalMemoryCompression();
 restore(s:TemporalMemoryCompressionState|undefined){const d=defaultTemporalMemoryCompression();const src:Record<string,unknown>=(s&&typeof s==='object')?s as unknown as Record<string,unknown>:{};let capsules:MemoryCapsule[]=[];try{const raw=src.capsules;if(Array.isArray(raw))capsules=raw.map(sanitizeCapsule).filter((x):x is MemoryCapsule=>x!==null).slice(0,180);}catch{capsules=[];}this.state={version:3,inputEvents:cnt(src.inputEvents,d.inputEvents),capsulesCreated:cnt(src.capsulesCreated,d.capsulesCreated),rawCompactions:cnt(src.rawCompactions,d.rawCompactions),lastCompactionAt:Math.max(0,fin(src.lastCompactionAt,d.lastCompactionAt)),hotWindowSize:Math.max(1,Math.floor(fin(src.hotWindowSize,d.hotWindowSize))),capsules};}
 snapshot(){return structuredClone(this.state);}
 compress(events:Array<{at:number;action?:string;summary:string;predictionError?:number;id?:string;provenanceClass?:string;correctionOfId?:string|null;evidenceHash?:string;epistemicStatus?:string}>,tier:'daily'|'weekly'|'monthly'='daily'){
   const valid=events.filter(Boolean); if(!valid.length)return null; this.state.inputEvents+=valid.length;
   const text=valid.map(e=>e.summary).join(' | ').slice(0,3200); const id=createHash('sha256').update(`${tier}|${valid[0].at}|${valid.at(-1)?.at}|${text}`).digest('hex').slice(0,20);
   const actions=[...new Set(valid.map(e=>e.action).filter(Boolean) as string[])].slice(0,8); const errors=valid.map(e=>e.predictionError??0); const confidence=c(1-(errors.reduce((a,b)=>a+b,0)/(errors.length||1)));
   const provenanceClasses=[...new Set(valid.map(e=>String(e.provenanceClass??'unknown')).filter(Boolean))].slice(0,8); const corrected=valid.filter(e=>Boolean(e.correctionOfId)||e.epistemicStatus==='superseded'||e.epistemicStatus==='quarantined');
   const correctedTraceIds=corrected.map(e=>e.id).filter(Boolean).slice(-32) as string[]; const correctionLinks=valid.filter(e=>Boolean(e.id&&e.correctionOfId)).map(e=>({id:String(e.id),corrects:String(e.correctionOfId)})).slice(-32); const evidenceHashes=[...new Set(valid.map(e=>e.evidenceHash).filter(Boolean) as string[])].slice(-32);
   const sourceDiversity01=c(provenanceClasses.length/4);
   const capsule:MemoryCapsule={id,startedAt:valid[0].at,endedAt:valid.at(-1)?.at??valid[0].at,eventCount:valid.length,highlights:valid.slice(0,8).map(e=>e.summary.slice(0,240)),dominantActions:actions,predictionError01:c(1-confidence),confidence01:confidence,sourceTraceIds:valid.map(e=>e.id).filter(Boolean).slice(-32) as string[],tier,provenanceClasses,correctionCount:corrected.length,correctedTraceIds,correctionLinks,evidenceHashes,sourceDiversity01};
   this.state.capsules=[capsule,...this.state.capsules.filter(x=>x.id!==id)].slice(0,180); this.state.capsulesCreated++; this.state.rawCompactions+=Math.max(0,valid.length-capsule.highlights.length); this.state.lastCompactionAt=Date.now(); return structuredClone(capsule);
 }
 maintain(hotEvents:number){this.state.hotWindowSize=Math.max(64,Math.min(400,Math.trunc(hotEvents)));this.state.capsules=this.state.capsules.slice(0, this.state.hotWindowSize<120?52:120);}
}
