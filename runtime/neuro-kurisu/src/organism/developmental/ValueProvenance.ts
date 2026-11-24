export interface ValueEvidence {
  at:number;
  source:string;
  success:number;
  surprise:number;
  episodeId?:string;
  reason:string;
  evidenceKey?:string;
}
export interface ValueProvenanceRecord {
  value:string;
  origin:string;
  confidence:number;
  supporting:ValueEvidence[];
  violating:ValueEvidence[];
  lastRevisionAt:number;
  independentSourceCount?:number;
}
export interface ValueProvenanceState {records:ValueProvenanceRecord[];version:number;}
export const defaultValueProvenance=():ValueProvenanceState=>({records:[],version:2});
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const clean=(x:unknown,n=120)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
const evidenceKey=(e:ValueEvidence)=>clean(e.evidenceKey||`${e.source}|${e.episodeId??''}|${Math.floor(e.at/5000)}|${e.reason}`,220);

/** Evidence lineage for values; derived support/violation records are idempotent by evidenceKey. */
export class ValueProvenance {
  private state=defaultValueProvenance();
  restore(s:ValueProvenanceState|undefined){
    const d=defaultValueProvenance();
    this.state={...d,...(s??{}),version:2,records:Array.isArray(s?.records)?s!.records.slice(0,64).map(r=>({
      ...r,
      supporting:Array.isArray(r.supporting)?r.supporting.slice(0,64):[],
      violating:Array.isArray(r.violating)?r.violating.slice(0,64):[],
      independentSourceCount:Number(r.independentSourceCount??0),
    })):[]};
  }
  observe(value:string,e:ValueEvidence,aligned:boolean){
    let r=this.state.records.find(x=>x.value===value);
    if(!r){r={value,origin:'developmental-prior',confidence:.5,supporting:[],violating:[],lastRevisionAt:0,independentSourceCount:0};this.state.records.push(r);}
    const normalized={...e,success:clamp(e.success),surprise:clamp(e.surprise),source:clean(e.source,72),reason:clean(e.reason,180),evidenceKey:evidenceKey(e)};
    const list=aligned?r.supporting:r.violating;
    if(!list.some(x=>x.evidenceKey===normalized.evidenceKey)) list.unshift(normalized);
    if(list.length>64)list.length=64;
    const sources=new Set([...r.supporting,...r.violating].map(x=>clean(x.source,72)).filter(Boolean));
    r.independentSourceCount=sources.size;
    const supportWeight=r.supporting.reduce((s,x)=>s+(1-x.surprise),0);
    const violationWeight=r.violating.reduce((s,x)=>s+(0.4+x.surprise),0);
    r.confidence=clamp(.5+Math.tanh((supportWeight-violationWeight)/18)*.48);
    r.lastRevisionAt=normalized.at;
    return structuredClone(r);
  }
  summary(){
    return {version:2,recordCount:this.state.records.length,independentSources:this.state.records.reduce((s,r)=>s+(r.independentSourceCount??0),0),supported:this.state.records.reduce((s,r)=>s+r.supporting.length,0),violations:this.state.records.reduce((s,r)=>s+r.violating.length,0)};
  }
  snapshot(){return structuredClone(this.state);}
}
