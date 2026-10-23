import { createHash } from 'node:crypto';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

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
  /** Optional upstream action/decision/observation identity shared across NK1 subsystems. */
  eventId?:string;
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
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const REALITY_CLASSES:readonly EvidenceRealityClass[]=['external-observation','device-observation','simulator','derived','model-generated','user-reported'];
const EXTERNAL=new Set<EvidenceRealityClass>(['external-observation','device-observation','user-reported']);
const validText=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
const validScore=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const validTick=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const stableEvidenceId=(value:unknown):string=>'rel:'+createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,40);
const MAX_TOTAL=Number.MAX_SAFE_INTEGER;

export class RealityEvidenceLedger {
  private readonly capacity:number;
  private records:RealityEvidenceRecord[]=[];
  private total=0;

  constructor(capacity=384){this.capacity=Math.max(128,Math.min(2048,Math.floor(capacity)));}

  restore(raw?:Partial<RealityEvidenceLedgerState>|null):void{
    let detached:unknown;
    try{detached=snapshotPlainData(raw??{},{allowNonFiniteNumbers:true,maxDepth:16,maxNodes:20_000,maxStringUnits:2*1024*1024});}
    catch{this.records=[];this.total=0;return;}
    const value=isRecord(detached)?detached:{};
    const candidates=Array.isArray(value.recent)?value.recent.slice(0,this.capacity):[];
    const records:RealityEvidenceRecord[]=[];
    const seen=new Set<string>();
    const seenEvents=new Set<string>();
    for(const candidate of candidates){
      if(!isRecord(candidate)||!validText(candidate.id,256)||
         (candidate.eventId!==undefined&&!validText(candidate.eventId,256))||!validTick(candidate.tick)||
         typeof candidate.at!=='number'||!Number.isFinite(candidate.at)||candidate.at<0||
         !REALITY_CLASSES.includes(candidate.realityClass as EvidenceRealityClass)||
         !validText(candidate.claim,240)||!validScore(candidate.confidence01)||
         !validText(candidate.independenceKey,160))continue;
      if(seen.has(candidate.id)||(typeof candidate.eventId==='string'&&seenEvents.has(candidate.eventId)))continue;
      const parentIds=Array.isArray(candidate.parentIds)
        ?candidate.parentIds.filter((id):id is string=>typeof id==='string'&&id.length>0&&id.length<=256).slice(0,8):[];
      const record:RealityEvidenceRecord={
        id:candidate.id,...(typeof candidate.eventId==='string'?{eventId:candidate.eventId}:{}),
        tick:candidate.tick,at:candidate.at,
        realityClass:candidate.realityClass as EvidenceRealityClass,
        claim:candidate.claim,confidence01:candidate.confidence01,
        independenceKey:candidate.independenceKey,parentIds,
      };
      records.push(record);seen.add(record.id);
      if(record.eventId)seenEvents.add(record.eventId);
    }
    this.records=records;
    this.total=typeof value.total==='number'&&Number.isSafeInteger(value.total)&&value.total>=records.length
      ?Math.min(MAX_TOTAL,value.total):records.length;
  }

  record(rawInput:{tick:number;eventId?:string;realityClass:EvidenceRealityClass;claim:string;confidence01?:number;independenceKey:string;parentIds?:string[];at?:number}):RealityEvidenceRecord{
    let input:typeof rawInput;
    try{input=snapshotPlainData(rawInput,{allowNonFiniteNumbers:true,maxDepth:8,maxNodes:128,maxStringUnits:8192});}
    catch{throw new TypeError('reality-evidence-boundary-rejected');}
    const at=input.at??Date.now();
    if(!validTick(input.tick)||typeof at!=='number'||!Number.isFinite(at)||at<0||
       !REALITY_CLASSES.includes(input.realityClass)||!validText(input.claim,240)||
       !validText(input.independenceKey,160)||(input.eventId!==undefined&&!validText(input.eventId,256))||
       (input.confidence01!==undefined&&!validScore(input.confidence01))||
       (input.parentIds!==undefined&&(!Array.isArray(input.parentIds)||input.parentIds.length>8||
         input.parentIds.some(id=>typeof id!=='string'||id.length===0||id.length>256)))){
      throw new TypeError('reality-evidence-input-invalid');
    }
    const claim=input.claim.trim(),independenceKey=input.independenceKey.trim();
    const confidence01=input.confidence01??.5;
    const parentIds=(input.parentIds??[]).slice();
    const eventId=input.eventId?.trim();
    const identity={tick:input.tick,at,realityClass:input.realityClass,claim,confidence01,independenceKey,parentIds};
    const id=eventId
      ?stableEvidenceId({namespace:'nk1-reality-event-v1',eventId})
      :stableEvidenceId(identity);
    const prior=this.records.find(row=>row.id===id||(eventId!==undefined&&row.eventId===eventId));
    if(prior){
      const samePayload=prior.tick===input.tick&&prior.at===at&&prior.realityClass===input.realityClass&&
        prior.claim===claim&&prior.confidence01===confidence01&&prior.independenceKey===independenceKey&&
        JSON.stringify(prior.parentIds)===JSON.stringify(parentIds)&&prior.eventId===eventId;
      if(!samePayload)throw new TypeError('reality-evidence-event-identity-conflict');
      return structuredClone(prior);
    }
    const row:RealityEvidenceRecord={id,...(eventId?{eventId}:{}),tick:input.tick,at,realityClass:input.realityClass,claim,confidence01,independenceKey,parentIds};
    this.records.unshift(row);
    if(this.records.length>this.capacity)this.records.length=this.capacity;
    if(this.total<MAX_TOTAL)this.total++;
    return structuredClone(row);
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
