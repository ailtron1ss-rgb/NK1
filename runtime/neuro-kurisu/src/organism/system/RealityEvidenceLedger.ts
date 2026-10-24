/**
 * Reality / Simulation evidence ledger.
 *
 * The ledger separates external/device evidence from simulation and derived
 * claims. Event IDs provide idempotency only; they never confer trust or proof.
 */
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

export type EvidenceRealityClass = 'external-observation'|'device-observation'|'simulator'|'derived'|'model-generated'|'user-reported';

export interface RealityEvidenceRecord {
  id:string;
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
  /** IDs whose payload was reused with conflicting evidence content. */
  quarantinedEventIds?:string[];
}

const clamp01=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const EXTERNAL=new Set<EvidenceRealityClass>(['external-observation','device-observation','user-reported']);
const REALITY_CLASSES=new Set<EvidenceRealityClass>(['external-observation','device-observation','simulator','derived','model-generated','user-reported']);
const EVENT_ID=/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const CONTROL=/[\u0000-\u001f\u007f-\u009f]/;

function isRecord(value:unknown):value is Record<string,unknown>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);
  return prototype===Object.prototype||prototype===null;
}
function eventIdValue(value:unknown):string|null{
  if(typeof value!=='string'||value.trim()!==value||value.length===0||value.length>128||CONTROL.test(value))return null;
  const normalized=value.normalize('NFKC');
  return EVENT_ID.test(normalized)?normalized:null;
}
function validText(value:unknown,max:number):value is string{
  return typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&!CONTROL.test(value)&&value.normalize('NFKC')===value;
}
function safeCounter(value:unknown,fallback:number):number{
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
}
function parseRecord(value:unknown):RealityEvidenceRecord|null{
  if(!isRecord(value))return null;
  const eventId=value.eventId===undefined?undefined:eventIdValue(value.eventId)??undefined;
  if(value.eventId!==undefined&&(!eventId||value.id!==eventId))return null;
  const id=validText(value.id,180)?value.id:null;
  const tick=safeCounter(value.tick,-1);
  const at=typeof value.at==='number'&&Number.isFinite(value.at)&&value.at>=0?value.at:null;
  const realityClass=value.realityClass;
  const claim=validText(value.claim,240)?value.claim:null;
  const confidence=typeof value.confidence01==='number'&&Number.isFinite(value.confidence01)&&value.confidence01>=0&&value.confidence01<=1?value.confidence01:null;
  const independenceKey=validText(value.independenceKey,160)?value.independenceKey:null;
  const parentIds=Array.isArray(value.parentIds)&&value.parentIds.length<=8&&value.parentIds.every(parent=>validText(parent,256))?value.parentIds as string[]:null;
  if(!id||tick<0||at===null||typeof realityClass!=='string'||!REALITY_CLASSES.has(realityClass as EvidenceRealityClass)||!claim||confidence===null||!independenceKey||!parentIds)return null;
  return {id,...(eventId?{eventId}:{}),tick,at,realityClass:realityClass as EvidenceRealityClass,claim,confidence01:confidence,independenceKey,parentIds:[...parentIds]};
}
function sameEventPayload(a:RealityEvidenceRecord,b:RealityEvidenceRecord):boolean{
  // Processing time is deliberately excluded: a retry may be observed later.
  return JSON.stringify([a.tick,a.realityClass,a.claim,a.confidence01,a.independenceKey,a.parentIds])===
    JSON.stringify([b.tick,b.realityClass,b.claim,b.confidence01,b.independenceKey,b.parentIds]);
}

export class RealityEvidenceLedger {
  private readonly capacity:number;
  private records:RealityEvidenceRecord[]=[];
  private total=0;
  private quarantinedEventIds=new Set<string>();

  constructor(capacity=384){this.capacity=Math.max(128,Math.min(2048,Math.floor(capacity)));}

  restore(raw?:Partial<RealityEvidenceLedgerState>|null):void{
    let detached:unknown;
    try{
      detached=snapshotPlainData(raw??{},{allowNonFiniteNumbers:true,maxDepth:24,maxNodes:100_000,maxStringUnits:4*1024*1024});
    }catch{
      this.records=[];this.total=0;this.quarantinedEventIds=new Set();return;
    }
    if(!isRecord(detached)){
      this.records=[];this.total=0;this.quarantinedEventIds=new Set();return;
    }
    const quarantine=new Set<string>();
    if(Array.isArray(detached.quarantinedEventIds)){
      for(const value of detached.quarantinedEventIds.slice(-2048)){const id=eventIdValue(value);if(id)quarantine.add(id);}
    }
    const records:RealityEvidenceRecord[]=[];
    const eventRows=new Map<string,RealityEvidenceRecord>();
    const rawRows=Array.isArray(detached.recent)?detached.recent.slice(0,this.capacity*4):[];
    for(const value of rawRows){
      const row=parseRecord(value);
      if(!row)continue;
      if(row.eventId&&quarantine.has(row.eventId))continue;
      if(row.eventId){
        const prior=eventRows.get(row.eventId);
        if(prior){
          if(!sameEventPayload(prior,row))quarantine.add(row.eventId);
          continue;
        }
        eventRows.set(row.eventId,row);
      }
      records.push(row);
    }
    this.records=records.slice(0,this.capacity);
    this.quarantinedEventIds=quarantine;
    this.total=Math.max(this.records.length,safeCounter(detached.total,this.records.length));
  }

  record(raw: {tick:number;realityClass:EvidenceRealityClass;claim:string;confidence01?:number;independenceKey:string;parentIds?:string[];at?:number;eventId?:string}):RealityEvidenceRecord{
    let detached:unknown;
    try{detached=snapshotPlainData(raw,{allowNonFiniteNumbers:true,maxDepth:12,maxNodes:2048,maxStringUnits:64*1024});}
    catch{throw new TypeError('reality-evidence-input-invalid');}
    if(!isRecord(detached))throw new TypeError('reality-evidence-input-invalid');
    const input=detached;
    const tick=safeCounter(input.tick,-1);
    const at=input.at===undefined?Date.now():input.at;
    const confidence=input.confidence01===undefined?.5:input.confidence01;
    const eventId=input.eventId===undefined?undefined:eventIdValue(input.eventId)??undefined;
    const parentIds=input.parentIds===undefined?[]:input.parentIds;
    if(tick<0||typeof at!=='number'||!Number.isFinite(at)||at<0||
       typeof input.realityClass!=='string'||!REALITY_CLASSES.has(input.realityClass as EvidenceRealityClass)||
       !validText(input.claim,240)||typeof confidence!=='number'||!Number.isFinite(confidence)||confidence<0||confidence>1||
       !validText(input.independenceKey,160)||!Array.isArray(parentIds)||parentIds.length>8||!parentIds.every(parent=>validText(parent,256))||
       (input.eventId!==undefined&&!eventId)){
      throw new TypeError('reality-evidence-input-invalid');
    }
    if(eventId&&this.quarantinedEventIds.has(eventId))throw new Error('reality-evidence-event-id-quarantined');
    const row:RealityEvidenceRecord={
      id:eventId??`rel:${at}:${tick}:${Math.random().toString(16).slice(2)}`,
      ...(eventId?{eventId}:{}),
      tick,at,realityClass:input.realityClass as EvidenceRealityClass,claim:input.claim,
      confidence01:clamp01(confidence),independenceKey:input.independenceKey,
      parentIds:[...parentIds],
    };
    if(eventId){
      const existing=this.records.find(record=>record.eventId===eventId);
      if(existing){
        if(sameEventPayload(existing,row))return structuredClone(existing);
        this.quarantinedEventIds.add(eventId);
        throw new Error('reality-evidence-event-id-conflict');
      }
    }
    this.records.unshift(row);
    if(this.records.length>this.capacity)this.records.length=this.capacity;
    this.total++;
    return structuredClone(row);
  }

  recent(limit=64){return structuredClone(this.records.filter(row=>!row.eventId||!this.quarantinedEventIds.has(row.eventId)).slice(0,Math.max(1,Math.min(256,Math.floor(limit)))));}

  claimAssessment(claim:string){
    const rows=this.records.filter(r=>r.claim===claim&&(!r.eventId||!this.quarantinedEventIds.has(r.eventId)));
    const external=rows.filter(r=>EXTERNAL.has(r.realityClass));
    const simulator=rows.filter(r=>r.realityClass==='simulator');
    const externalKeys=new Set(external.map(r=>r.independenceKey));
    const simulationKeys=new Set(simulator.map(r=>r.independenceKey));
    const externalConfidence=external.length?Math.max(...external.map(r=>r.confidence01)):0;
    const simulationConfidence=simulator.length?Math.max(...simulator.map(r=>r.confidence01)):0;
    return {
      claim,samples:rows.length,externalSamples:external.length,simulationSamples:simulator.length,
      externalConfidence01:externalConfidence,simulationConfidence01:simulationConfidence,
      independentExternalSources:externalKeys.size,independentSimulationSources:simulationKeys.size,
      promotionAllowed:external.length>0&&externalKeys.size>0&&externalConfidence>=.55,
      realityGap01:Math.max(0,simulationConfidence-externalConfidence),
    };
  }

  snapshot():RealityEvidenceLedgerState{
    const active=this.records.filter(r=>!r.eventId||!this.quarantinedEventIds.has(r.eventId));
    const independent=new Set(active.filter(r=>EXTERNAL.has(r.realityClass)).map(r=>r.independenceKey));
    return {
      version:1,total:this.total,
      externalCount:active.filter(r=>EXTERNAL.has(r.realityClass)).length,
      simulatorCount:active.filter(r=>r.realityClass==='simulator').length,
      independentSources:independent.size,
      recent:this.recent(96),
      quarantinedEventIds:[...this.quarantinedEventIds].slice(-2048),
    };
  }
}
