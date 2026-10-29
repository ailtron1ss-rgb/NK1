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
  /** Bounded replay receipts outlive the active evidence window to preserve event-id idempotency. */
  eventReceipts?:RealityEvidenceRecord[];
  /** IDs whose payload was reused with conflicting evidence content. */
  quarantinedEventIds?:string[];
}

const clamp01=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const EXTERNAL=new Set<EvidenceRealityClass>(['external-observation','device-observation']);
const USER_REPORTED=new Set<EvidenceRealityClass>(['user-reported']);
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
/** Parse only explicit field=value / field:value claims; free-form prose is never guessed into a contradiction. */
function explicitFieldValue(claim:string):{field:string;value:string}|null{
  const match=/^([a-z][a-z0-9_.-]{1,63})\s*[:=]\s*(.{1,160})$/i.exec(claim.trim());
  if(!match)return null;
  const field=match[1].normalize('NFKC').toLowerCase();
  const value=match[2].normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
  return field&&value?{field,value}:null;
}
function sameEventPayload(a:RealityEvidenceRecord,b:RealityEvidenceRecord):boolean{
  // Processing time is deliberately excluded: a retry may be observed later.
  return JSON.stringify([a.tick,a.realityClass,a.claim,a.confidence01,a.independenceKey,a.parentIds])===
    JSON.stringify([b.tick,b.realityClass,b.claim,b.confidence01,b.independenceKey,b.parentIds]);
}
function sameEventPayloadExceptConfidence(a:RealityEvidenceRecord,b:RealityEvidenceRecord):boolean{
  // Trust calibration may conservatively reduce legacy confidence on restore,
  // but no other event field may change under the same event identity.
  return JSON.stringify([a.tick,a.realityClass,a.claim,a.independenceKey,a.parentIds])===
    JSON.stringify([b.tick,b.realityClass,b.claim,b.independenceKey,b.parentIds]);
}

export class RealityEvidenceLedger {
  private readonly capacity:number;
  private readonly receiptCapacity:number;
  private records:RealityEvidenceRecord[]=[];
  private eventReceipts=new Map<string,RealityEvidenceRecord>();
  private total=0;
  private quarantinedEventIds=new Set<string>();

  constructor(capacity=384){
    this.capacity=Math.max(128,Math.min(2048,Math.floor(capacity)));
    // The replay index is bounded but wider than the active evidence window;
    // it prevents a cached-out event from being counted again after a retry.
    this.receiptCapacity=Math.min(2048,Math.max(512,this.capacity*4));
  }

  private rememberEvent(row:RealityEvidenceRecord):void {
    if(!row.eventId)return;
    this.eventReceipts.set(row.eventId,structuredClone(row));
    while(this.eventReceipts.size>this.receiptCapacity){
      const oldest=this.eventReceipts.keys().next().value as string|undefined;
      if(oldest===undefined)break;
      this.eventReceipts.delete(oldest);
    }
  }

  private quarantineEventId(eventId:string):void {
    this.quarantinedEventIds.delete(eventId);
    this.quarantinedEventIds.add(eventId);
    while(this.quarantinedEventIds.size>this.receiptCapacity){
      const oldest=this.quarantinedEventIds.keys().next().value as string|undefined;
      if(oldest===undefined)break;
      this.quarantinedEventIds.delete(oldest);
    }
  }

  restore(raw?:Partial<RealityEvidenceLedgerState>|null):void{
    let detached:unknown;
    try{
      detached=snapshotPlainData(raw??{},{allowNonFiniteNumbers:true,maxDepth:24,maxNodes:100_000,maxStringUnits:4*1024*1024});
    }catch{
      this.records=[];this.eventReceipts=new Map();this.total=0;this.quarantinedEventIds=new Set();return;
    }
    if(!isRecord(detached)){
      this.records=[];this.eventReceipts=new Map();this.total=0;this.quarantinedEventIds=new Set();return;
    }
    const quarantine=new Set<string>();
    const quarantineId=(id:string)=>{
      quarantine.delete(id);
      quarantine.add(id);
      while(quarantine.size>this.receiptCapacity){
        const oldest=quarantine.keys().next().value as string|undefined;
        if(oldest===undefined)break;
        quarantine.delete(oldest);
      }
    };
    if(Array.isArray(detached.quarantinedEventIds)){
      for(const value of detached.quarantinedEventIds.slice(-this.receiptCapacity)){
        const id=eventIdValue(value);
        if(id)quarantineId(id);
      }
    }

    const receipts=new Map<string,RealityEvidenceRecord>();
    const mergeReceipt=(row:RealityEvidenceRecord)=>{
      const id=row.eventId;
      if(!id||quarantine.has(id))return;
      const prior=receipts.get(id);
      if(!prior){receipts.set(id,structuredClone(row));return;}
      if(sameEventPayload(prior,row))return;
      if(sameEventPayloadExceptConfidence(prior,row)){
        if(row.confidence01<prior.confidence01)receipts.set(id,{...prior,confidence01:row.confidence01});
        return;
      }
      quarantineId(id);
      receipts.delete(id);
    };

    // Snapshot receipts are newest-first. Process oldest to newest so the
    // bounded map naturally evicts the oldest identities when over capacity.
    const rawReceipts=Array.isArray(detached.eventReceipts)?detached.eventReceipts as unknown[]:[];
    for(const value of rawReceipts.slice(0,this.receiptCapacity).reverse()){
      const row=parseRecord(value);
      if(row?.eventId)mergeReceipt(row);
    }

    const rawRows=Array.isArray(detached.recent)?detached.recent as unknown[]:[];
    // Merge the active window into the receipt index too. This migrates legacy
    // snapshots that predate eventReceipts and indexes every still-active event.
    for(const value of rawRows.slice().reverse()){
      const row=parseRecord(value);
      if(row?.eventId)mergeReceipt(row);
    }
    while(receipts.size>this.receiptCapacity){
      const oldest=receipts.keys().next().value as string|undefined;
      if(oldest===undefined)break;
      receipts.delete(oldest);
    }

    const records:RealityEvidenceRecord[]=[];
    const activeById=new Map<string,RealityEvidenceRecord>();
    for(const value of rawRows){
      let row=parseRecord(value);
      if(!row|| (row.eventId&&quarantine.has(row.eventId)))continue;
      const rowEventId=row.eventId;
      if(rowEventId){
        const receipt=receipts.get(rowEventId);
        if(receipt){
          if(sameEventPayloadExceptConfidence(receipt,row)){
            row={...row,confidence01:Math.min(receipt.confidence01,row.confidence01)};
          }else if(!sameEventPayload(receipt,row)){
            quarantineId(rowEventId);
            receipts.delete(rowEventId);
            continue;
          }
        }else{
          mergeReceipt(row);
        }
        if(quarantine.has(rowEventId))continue;
        const prior=activeById.get(rowEventId);
        if(prior){
          if(sameEventPayload(prior,row))continue;
          if(sameEventPayloadExceptConfidence(prior,row)){
            const confidence01=Math.min(prior.confidence01,row.confidence01);
            const normalized={...prior,confidence01};
            const index=records.findIndex(record=>record.eventId===rowEventId);
            if(index>=0)records[index]=normalized;
            activeById.set(rowEventId,normalized);
            const receiptNow=receipts.get(rowEventId);
            if(receiptNow&&sameEventPayloadExceptConfidence(receiptNow,normalized)&&confidence01<receiptNow.confidence01){
              receipts.set(rowEventId,{...receiptNow,confidence01});
            }
          }else{
            quarantineId(rowEventId);
            receipts.delete(rowEventId);
          }
          continue;
        }
        if(records.length>=this.capacity)continue;
        activeById.set(rowEventId,row);
        records.push(row);
      }else if(records.length<this.capacity){
        records.push(row);
      }
    }

    this.records=records.filter(row=>!row.eventId||!quarantine.has(row.eventId)).slice(0,this.capacity);
    this.eventReceipts=new Map([...receipts].filter(([id])=>!quarantine.has(id)));
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
      const existing=this.eventReceipts.get(eventId)??this.records.find(record=>record.eventId===eventId);
      if(existing){
        if(sameEventPayload(existing,row))return structuredClone(existing);
        if(sameEventPayloadExceptConfidence(existing,row)&&row.confidence01<existing.confidence01){
          // Schema-compatible projection upgrades may lower a legacy raw score
          // after source-trust calibration. A stable event ID may never elevate it.
          const recalibrated={...existing,confidence01:row.confidence01};
          const index=this.records.findIndex(record=>record.eventId===eventId);
          if(index>=0)this.records[index]=recalibrated;
          this.eventReceipts.set(eventId,recalibrated);
          return structuredClone(recalibrated);
        }
        this.quarantineEventId(eventId);
        this.records=this.records.filter(record=>record.eventId!==eventId);
        this.eventReceipts.delete(eventId);
        throw new Error('reality-evidence-event-id-conflict');
      }
    }
    this.records.unshift(row);
    if(this.records.length>this.capacity)this.records.length=this.capacity;
    if(eventId)this.rememberEvent(row);
    this.total++;
    return structuredClone(row);
  }

  /** Exact event lookup also covers evidence evicted from the active window. */
  findByEventId(eventId:string):RealityEvidenceRecord|undefined {
    if(typeof eventId!=='string'||!eventId||this.quarantinedEventIds.has(eventId))return undefined;
    const row=this.eventReceipts.get(eventId)??this.records.find(record=>record.eventId===eventId);
    return row?structuredClone(row):undefined;
  }

  recent(limit=64){const bounded=typeof limit==='number'&&Number.isFinite(limit)?Math.max(0,Math.min(256,Math.floor(limit))):64;return structuredClone(this.records.filter(row=>!row.eventId||!this.quarantinedEventIds.has(row.eventId)).slice(0,bounded));}

  claimAssessment(claim:string){
    const rows=this.records.filter(r=>r.claim===claim&&(!r.eventId||!this.quarantinedEventIds.has(r.eventId)));
    const external=rows.filter(r=>EXTERNAL.has(r.realityClass));
    const userReported=rows.filter(r=>USER_REPORTED.has(r.realityClass));
    const simulator=rows.filter(r=>r.realityClass==='simulator');
    const externalKeys=new Set(external.map(r=>r.independenceKey));
    const qualifiedExternalKeys=new Set(external.filter(r=>r.confidence01>=.75).map(r=>r.independenceKey));
    const target=explicitFieldValue(claim);
    const conflictingRows=target?this.records.filter(r=>{
      if(r.claim===claim||(r.eventId&&this.quarantinedEventIds.has(r.eventId))||!EXTERNAL.has(r.realityClass)||r.confidence01<.75)return false;
      const parsed=explicitFieldValue(r.claim);
      return parsed?.field===target.field&&parsed.value!==target.value;
    }):[];
    const independentContradictionSources=new Set(conflictingRows.map(r=>r.independenceKey)).size;
    const contradictionDetected=conflictingRows.length>0;
    const simulationKeys=new Set(simulator.map(r=>r.independenceKey));
    const externalConfidence=external.length?Math.max(...external.map(r=>r.confidence01)):0;
    const simulationConfidence=simulator.length?Math.max(...simulator.map(r=>r.confidence01)):0;
    const independentlyCorroborated=qualifiedExternalKeys.size>=2;
    return {
      claim,samples:rows.length,externalSamples:external.length,userReportedSamples:userReported.length,simulationSamples:simulator.length,
      externalConfidence01:externalConfidence,simulationConfidence01:simulationConfidence,
      independentExternalSources:externalKeys.size,independentSimulationSources:simulationKeys.size,
      qualifiedIndependentExternalSources:qualifiedExternalKeys.size,
      contradictionDetected,conflictingClaims:conflictingRows.length,independentContradictionSources,
      // Consequential promotion needs a claim shape that the contradiction scanner can actually compare.
      contradictionCoverageAvailable:target!==null,
      // Only explicit structured field/value claims can be compared for contradiction.
      // Ambiguous free-form language is deliberately not interpreted as disagreement.
      promotionAllowed:!contradictionDetected&&external.length>0&&externalKeys.size>0&&externalConfidence>=.55,
      independentPromotionAllowed:independentlyCorroborated&&!contradictionDetected,
      promotionReason:contradictionDetected?'qualified-external-contradiction-detected'
        :independentlyCorroborated?'independent-external-corroboration-satisfied'
        :externalKeys.size<2?'awaiting-second-independent-external-source'
        :'independent-sources-present-but-confidence-below-promotion-threshold',
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
      eventReceipts:[...this.eventReceipts.values()].reverse().map(row=>structuredClone(row)),
      quarantinedEventIds:[...this.quarantinedEventIds].slice(-2048),
    };
  }
}
