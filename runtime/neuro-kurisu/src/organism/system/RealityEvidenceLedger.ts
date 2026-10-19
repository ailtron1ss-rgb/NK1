/**
 * BIG PASS 162 — Reality / Simulation evidence separation.
 *
 * The ledger prevents internal simulation evidence from being silently treated
 * as independent reality evidence. It is a compact accounting layer; detailed
 * provenance remains in RuntimeEvidenceBus / ExternalEvidenceTrust.
 */
export type EvidenceRealityClass = 'external-observation'|'device-observation'|'simulator'|'derived'|'model-generated'|'user-reported';

export interface RealityEvidenceRecord {
  id:string;
  tick:number;
  at:number;
  realityClass:EvidenceRealityClass;
  claim:string;
  confidence01:number;
  independenceKey:string;
  parentIds:string[];
}

export interface RealityEvidenceLedgerState {
  version:1;
  total:number;
  externalCount:number;
  simulatorCount:number;
  independentSources:number;
  recent:RealityEvidenceRecord[];
}

const clamp01=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const EXTERNAL=new Set<EvidenceRealityClass>(['external-observation','device-observation','user-reported']);

export class RealityEvidenceLedger {
  private readonly capacity:number;
  private records:RealityEvidenceRecord[]=[];
  private total=0;

  constructor(capacity=384){this.capacity=Math.max(128,Math.min(2048,Math.floor(capacity)));}

  restore(raw?:Partial<RealityEvidenceLedgerState>|null):void{
    const list=Array.isArray(raw?.recent)?raw!.recent.slice(0,this.capacity).map((x:any)=>({...x,parentIds:Array.isArray(x.parentIds)?x.parentIds.slice(0,8):[],confidence01:clamp01(Number(x.confidence01??.5))})) : [];
    this.records=list; this.total=Math.max(list.length,Number(raw?.total??list.length));
  }

  record(input:{tick:number;realityClass:EvidenceRealityClass;claim:string;confidence01?:number;independenceKey:string;parentIds?:string[];at?:number}):RealityEvidenceRecord{
    const at=Number(input.at??Date.now());
    const row:RealityEvidenceRecord={id:`rel:${at}:${input.tick}:${Math.random().toString(16).slice(2)}`,tick:Math.max(0,Math.floor(input.tick)),at,realityClass:input.realityClass,claim:String(input.claim||'').slice(0,240),confidence01:clamp01(input.confidence01??.5),independenceKey:String(input.independenceKey||'unknown').slice(0,160),parentIds:(input.parentIds??[]).map(String).slice(0,8)};
    this.records.unshift(row); if(this.records.length>this.capacity)this.records.length=this.capacity; this.total++; return structuredClone(row);
  }

  recent(limit=64){return structuredClone(this.records.slice(0,Math.max(1,Math.min(256,Math.floor(limit)))));}

  claimAssessment(claim:string){
    const rows=this.records.filter(r=>r.claim===claim);
    const external=rows.filter(r=>EXTERNAL.has(r.realityClass));
    const simulator=rows.filter(r=>r.realityClass==='simulator');
    const externalKeys=new Set(external.map(r=>r.independenceKey));
    const simulationKeys=new Set(simulator.map(r=>r.independenceKey));
    const externalConfidence=external.length?Math.max(...external.map(r=>r.confidence01)):0;
    const simulationConfidence=simulator.length?Math.max(...simulator.map(r=>r.confidence01)):0;
    return {
      claim,
      samples:rows.length,
      externalSamples:external.length,
      simulationSamples:simulator.length,
      externalConfidence01:externalConfidence,
      simulationConfidence01:simulationConfidence,
      independentExternalSources:externalKeys.size,
      independentSimulationSources:simulationKeys.size,
      promotionAllowed:external.length>0&&externalKeys.size>0&&externalConfidence>=.55,
      realityGap01:Math.max(0,simulationConfidence-externalConfidence),
    };
  }

  snapshot():RealityEvidenceLedgerState{
    const independent=new Set(this.records.filter(r=>EXTERNAL.has(r.realityClass)).map(r=>r.independenceKey));
    return {version:1,total:this.total,externalCount:this.records.filter(r=>EXTERNAL.has(r.realityClass)).length,simulatorCount:this.records.filter(r=>r.realityClass==='simulator').length,independentSources:independent.size,recent:this.recent(96)};
  }
}
