import { createHash } from 'node:crypto';
export interface MemoryCapsule{ id:string; startedAt:number; endedAt:number; eventCount:number; highlights:string[]; dominantActions:string[]; predictionError01:number; confidence01:number; sourceTraceIds:string[]; tier:'daily'|'weekly'|'monthly'; }
export interface TemporalMemoryCompressionState{version:1;inputEvents:number;capsulesCreated:number;rawCompactions:number;lastCompactionAt:number;hotWindowSize:number;capsules:MemoryCapsule[];}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultTemporalMemoryCompression=():TemporalMemoryCompressionState=>({version:1,inputEvents:0,capsulesCreated:0,rawCompactions:0,lastCompactionAt:0,hotWindowSize:160,capsules:[]});
export class TemporalMemoryCompressor{
 private state=defaultTemporalMemoryCompression();
 restore(s:TemporalMemoryCompressionState|undefined){this.state={...defaultTemporalMemoryCompression(),...(s??{}),capsules:Array.isArray(s?.capsules)?s!.capsules.slice(0,180):[]};}
 snapshot(){return structuredClone(this.state);}
 compress(events:Array<{at:number;action?:string;summary:string;predictionError?:number;id?:string}>,tier:'daily'|'weekly'|'monthly'='daily'){
   const valid=events.filter(Boolean); if(!valid.length)return null; this.state.inputEvents+=valid.length;
   const text=valid.map(e=>e.summary).join(' | ').slice(0,3200); const id=createHash('sha256').update(`${tier}|${valid[0].at}|${valid.at(-1)?.at}|${text}`).digest('hex').slice(0,20);
   const actions=[...new Set(valid.map(e=>e.action).filter(Boolean) as string[])].slice(0,8); const errors=valid.map(e=>e.predictionError??0); const confidence=c(1-(errors.reduce((a,b)=>a+b,0)/(errors.length||1)));
   const capsule:MemoryCapsule={id,startedAt:valid[0].at,endedAt:valid.at(-1)?.at??valid[0].at,eventCount:valid.length,highlights:valid.slice(0,8).map(e=>e.summary.slice(0,240)),dominantActions:actions,predictionError01:c(1-confidence),confidence01:confidence,sourceTraceIds:valid.map(e=>e.id).filter(Boolean).slice(-32) as string[],tier};
   this.state.capsules=[capsule,...this.state.capsules.filter(x=>x.id!==id)].slice(0,180); this.state.capsulesCreated++; this.state.rawCompactions+=Math.max(0,valid.length-capsule.highlights.length); this.state.lastCompactionAt=Date.now(); return structuredClone(capsule);
 }
 maintain(hotEvents:number){this.state.hotWindowSize=Math.max(64,Math.min(400,Math.trunc(hotEvents)));this.state.capsules=this.state.capsules.slice(0, this.state.hotWindowSize<120?52:120);}
}
