export type SourceEvidenceClass = 'direct-observation'|'corroborated'|'inferred'|'unverified';
export interface SourceTraceProvenance {
 sourceId:string; sourceKind:string; capturedAt:number; evidenceClass:SourceEvidenceClass;
 contentFingerprint?:string; citation?:string;
}
export interface SourceTrace{
 id:string; source:'user'|'system'|'world'|'model'|'tool'|'memory'; kind:string; confidence:number;
 epistemicStatus:'input'|'hypothesis'|'observation'|'fact'|'rejected'; at:number;
 /** Descriptive lineage only; this is not cryptographic authentication. */
 provenance?:SourceTraceProvenance; parentIds?:string[];
}
export interface SourceMonitorState{traces:SourceTrace[];conflicts:number;unattributed:number;}
export const defaultSourceMonitor=():SourceMonitorState=>({traces:[],conflicts:0,unattributed:0});

const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const cleanText=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&![...value].some(c=>{const n=c.charCodeAt(0);return n<32||n===127;});
const fingerprint=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const SOURCES=new Set<SourceTrace['source']>(['user','system','world','model','tool','memory']);
const EPISTEMIC=new Set<SourceTrace['epistemicStatus']>(['input','hypothesis','observation','fact','rejected']);
const EVIDENCE_CLASSES=new Set<SourceEvidenceClass>(['direct-observation','corroborated','inferred','unverified']);

function normalizeProvenance(value:unknown):SourceTraceProvenance|undefined{
 if(value===undefined||value===null)return undefined;
 if(!isRecord(value)||!cleanText(value.sourceId,192)||!cleanText(value.sourceKind,64)||
    !Number.isSafeInteger(value.capturedAt)||Number(value.capturedAt)<0||
    !EVIDENCE_CLASSES.has(String(value.evidenceClass) as SourceEvidenceClass))return undefined;
 if(value.contentFingerprint!==undefined&&!fingerprint(value.contentFingerprint))return undefined;
 if(value.citation!==undefined&&!cleanText(value.citation,256))return undefined;
 return {
  sourceId:value.sourceId.trim(),sourceKind:value.sourceKind.trim(),capturedAt:Number(value.capturedAt),
  evidenceClass:value.evidenceClass as SourceEvidenceClass,
  ...(value.contentFingerprint?{contentFingerprint:value.contentFingerprint as string}:{}),
  ...(value.citation?{citation:(value.citation as string).trim()}:{}),
 };
}
function normalizeTrace(value:unknown):SourceTrace|undefined{
 if(!isRecord(value)||!cleanText(value.id,192)||!SOURCES.has(value.source as SourceTrace['source'])||
    !cleanText(value.kind,96)||typeof value.confidence!=='number'||!Number.isFinite(value.confidence)||
    !EPISTEMIC.has(value.epistemicStatus as SourceTrace['epistemicStatus'])||
    !Number.isSafeInteger(value.at)||Number(value.at)<0)return undefined;
 const provenance=normalizeProvenance(value.provenance);
 if(value.provenance!==undefined&&value.provenance!==null&&!provenance)return undefined;
 const parents=Array.isArray(value.parentIds)?value.parentIds.slice(0,8).filter((id):id is string=>cleanText(id,192)):[];
 return {
  id:value.id.trim(),source:value.source as SourceTrace['source'],kind:value.kind.trim(),
  confidence:Math.max(0,Math.min(1,value.confidence)),
  epistemicStatus:value.epistemicStatus as SourceTrace['epistemicStatus'],at:Number(value.at),
  ...(provenance?{provenance}:{}),...(parents.length?{parentIds:[...new Set(parents)]}:{})
 };
}

export class SourceMonitor{
 private state=defaultSourceMonitor();
 restore(s:SourceMonitorState|undefined){
  const raw=Array.isArray(s?.traces)?s!.traces.slice(0,512):[];
  const traces:SourceTrace[]=[];let rejected=0;
  for(const item of raw){const normalized=normalizeTrace(item);if(normalized)traces.push(normalized);else rejected++;}
  const incoming=Number.isSafeInteger(s?.unattributed)&&Number(s?.unattributed)>=0?Number(s?.unattributed):0;
  this.state={...defaultSourceMonitor(),...(s??{}),traces,unattributed:incoming+rejected};
  this.state.conflicts=Number.isSafeInteger(this.state.conflicts)&&this.state.conflicts>=0?this.state.conflicts:0;
 }
 record(trace:SourceTrace){
  const normalized=normalizeTrace(trace);
  if(!normalized){this.state.unattributed++;return;}
  this.state.traces=[normalized,...this.state.traces.filter(existing=>existing.id!==normalized.id)].slice(0,512);
 }
 add(source:SourceTrace['source'],kind:string,confidence:number,epistemicStatus:SourceTrace['epistemicStatus']='observation',
     provenance?:SourceTraceProvenance,parentIds?:string[]){
  this.record({id:`src-${Date.now()}-${Math.random().toString(16).slice(2)}`,source,kind,confidence,
    epistemicStatus,at:Date.now(),...(provenance?{provenance}:{}),...(parentIds?{parentIds}:{})});
 }
 latest(limit=16){return this.state.traces.slice(0,Math.max(0,Math.min(512,limit))).map(x=>structuredClone(x));}
 /** Bounded breadth-first lineage over known parent traces; never infers missing ancestry. */
 lineage(id:string,maxNodes=16):SourceTrace[]{
  if(!cleanText(id,192))return [];
  const limit=Number.isSafeInteger(maxNodes)?Math.max(1,Math.min(32,maxNodes)):16;
  const byId=new Map(this.state.traces.map(trace=>[trace.id,trace]));
  const queue=[id],seen=new Set<string>(),result:SourceTrace[]=[];
  while(queue.length&&result.length<limit){
   const current=queue.shift()!;if(seen.has(current))continue;seen.add(current);
   const trace=byId.get(current);if(!trace)continue;
   result.push(structuredClone(trace));
   for(const parentId of trace.parentIds??[]){if(!seen.has(parentId)&&queue.length<limit)queue.push(parentId);}
  }
  return result;
 }
 snapshot(){return structuredClone(this.state);}
}
