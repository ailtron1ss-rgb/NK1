import { sha256Stable } from '../core/StableSerialization.ts';

/**
 * BIG PASS 161 — Unified Cognitive Event Fabric.
 *
 * This is intentionally a thin causal ledger over the existing runtime evidence
 * and organism EventLog. It does not become a second source of truth for memory,
 * world or goals. It only records the causal spine of an operational cycle:
 * observation -> prediction -> action -> outcome -> learning/self update.
 */
export type CognitiveStage = 'observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'self-update'|'tool-action'|'tool-outcome'|'tool-evidence'|'external-evidence'|'tool-reconciliation';

export interface CognitiveEventNode {
  id: string;
  tick: number;
  at: number;
  stage: CognitiveStage;
  source: string;
  parentIds: string[];
  external: boolean;
  confidence01: number;
  payload: Record<string, unknown>;
}

export type OperationalCycleStageName = 'observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'self-update';
export type OperationalCycleStageIds = Partial<Record<OperationalCycleStageName, string | undefined>>;
type OperationalCyclePhaseInput = { source?:string; external?:boolean; confidence01?:number; payload?:Record<string,unknown> };

export interface OperationalCycleLineageCheck {
  tick: number | null;
  complete: boolean;
  integrity01: number;
  missingStages: string[];
  invalidStages: string[];
  missingEdges: string[];
}

export interface ExternalObservationProjectionRef { observationId:string; eventId:string; projectionHash:string; projectedAt:number; }
export interface ToolReceiptRevisionProjectionRef { revisionId:string; eventId:string; projectionHash:string; projectedAt:number; }

export interface ToolReceiptProjectionIndexEntry {
  executionId: string;
  actionEventId: string;
  outcomeEventId: string;
  evidenceEventId: string;
  projectedAt: number;
  /** Hash of the immutable receipt projection input; catches accidental key reuse. */
  projectionHash?: string;
  /** Bounded idempotency references for independent observations linked to this exact execution. */
  externalObservations?:ExternalObservationProjectionRef[];
  /** Append-only authoritative provider receipt revisions for the original execution. */
  receiptRevisions?:ToolReceiptRevisionProjectionRef[];
}

export interface CognitiveEventFabricSnapshot {
  version: 1;
  capacity: number;
  total: number;
  buffered: number;
  linkedParentEvents: number;
  danglingParentLinks: number;
  lineageIntegrity01: number;
  cycleCoverage01: number;
  causalDensity01: number;
  recentTicks: number;
  recent: CognitiveEventNode[];
  /** Bounded replay guard for external tool receipt projections. Older snapshots omit it. */
  receiptProjectionIndex?: ToolReceiptProjectionIndexEntry[];
  /** Small, sanitized causal nodes omitted from the ordinary 96-event snapshot window. */
  receiptEvents?: CognitiveEventNode[];
}

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const OMIT_PAYLOAD_VALUE=Symbol('omit-cognitive-payload-value');
const MAX_COGNITIVE_PAYLOAD_DEPTH=32;
const MAX_COGNITIVE_PAYLOAD_NODES=16384;
const MAX_COGNITIVE_PAYLOAD_ARRAY_LENGTH=16384;
const MAX_COGNITIVE_PAYLOAD_KEYS=8192;

function clonePayloadValue(
  value:unknown,
  ancestors:Set<object>,
  depth:number,
  budget:{nodes:number},
):unknown|typeof OMIT_PAYLOAD_VALUE {
  budget.nodes+=1;
  if(budget.nodes>MAX_COGNITIVE_PAYLOAD_NODES) throw new RangeError('cognitive-event-payload-node-limit');
  if(depth>MAX_COGNITIVE_PAYLOAD_DEPTH) throw new RangeError('cognitive-event-payload-depth-limit');
  if(value===null||typeof value==='boolean'||typeof value==='string') return value;
  if(typeof value==='number') return Number.isFinite(value)?value:null;
  if(value===undefined||typeof value==='function'||typeof value==='symbol') return OMIT_PAYLOAD_VALUE;
  if(typeof value==='bigint') throw new TypeError('cognitive-event-payload-bigint-not-json-serializable');
  if(typeof value!=='object') return OMIT_PAYLOAD_VALUE;

  if(value instanceof Date) {
    const timestamp=Date.prototype.getTime.call(value);
    return Number.isFinite(timestamp)?new Date(timestamp).toISOString():null;
  }
  if(ancestors.has(value)) throw new TypeError('circular-cognitive-event-payload');
  ancestors.add(value);
  try {
    if(Array.isArray(value)) {
      if(value.length>MAX_COGNITIVE_PAYLOAD_ARRAY_LENGTH) throw new RangeError('cognitive-event-payload-array-limit');
      const output:unknown[]=[];
      for(let index=0;index<value.length;index+=1) {
        const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
        if(!descriptor||!('value' in descriptor)) { output.push(null); continue; }
        const cloned=clonePayloadValue(descriptor.value,ancestors,depth+1,budget);
        output.push(cloned===OMIT_PAYLOAD_VALUE?null:cloned);
      }
      return output;
    }

    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null) {
      throw new TypeError('unsupported-cognitive-event-payload-object');
    }
    const descriptors=Object.getOwnPropertyDescriptors(value) as Record<string,PropertyDescriptor>;
    const keys=Object.keys(descriptors);
    if(keys.length>MAX_COGNITIVE_PAYLOAD_KEYS) throw new RangeError('cognitive-event-payload-key-limit');
    const output:Record<string,unknown>={};
    for(const key of keys.sort()) {
      if(key.length>512) throw new RangeError('cognitive-event-payload-key-length-limit');
      const descriptor=descriptors[key]!;
      // Never execute getters while recording untrusted evidence. Accessor properties
      // are omitted instead of being invoked during clone or fingerprinting.
      if(!descriptor.enumerable||!('value' in descriptor)) continue;
      const cloned=clonePayloadValue(descriptor.value,ancestors,depth+1,budget);
      if(cloned!==OMIT_PAYLOAD_VALUE) Object.defineProperty(output,key,{
        configurable:true,enumerable:true,writable:true,value:cloned,
      });
    }
    return output;
  } finally {
    ancestors.delete(value);
  }
}

const cleanPayload=(value:unknown):Record<string,unknown>=>{
  if(!isRecord(value)) return {};
  const cloned=clonePayloadValue(value,new Set<object>(),0,{nodes:0});
  return cloned!==OMIT_PAYLOAD_VALUE&&isRecord(cloned)?cloned:{};
};

function cognitiveEventFingerprint(event:Pick<CognitiveEventNode,'tick'|'at'|'stage'|'source'|'parentIds'|'external'|'confidence01'|'payload'>):string {
  return sha256Stable({
    tick:event.tick,
    at:event.at,
    stage:event.stage,
    source:event.source,
    parentIds:[...event.parentIds],
    external:event.external,
    confidence01:clamp01(event.confidence01),
    payload:cleanPayload(event.payload),
  });
}

function cloneCognitiveEvent(event:CognitiveEventNode):CognitiveEventNode {
  return {
    ...event,
    parentIds:[...event.parentIds],
    payload:cleanPayload(event.payload),
  };
}
const COGNITIVE_STAGES=new Set<CognitiveStage>(['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update','tool-action','tool-outcome','tool-evidence','external-evidence','tool-reconciliation']);

export class CognitiveEventFabric {
  private readonly capacity:number;
  private events:CognitiveEventNode[]=[];
  private total=0;
  private readonly receiptProjectionIndex=new Map<string,ToolReceiptProjectionIndexEntry>();

  constructor(capacity=512){
    // A non-finite config must not disable eviction by making capacity NaN.
    const requestedCapacity=Number.isFinite(capacity)?Math.floor(capacity):512;
    this.capacity=Math.max(128,Math.min(4096,requestedCapacity));
  }

  restore(raw?:Partial<CognitiveEventFabricSnapshot>|null):void{
    const recentRows=Array.isArray(raw?.recent)?raw!.recent:[];
    const receiptEvents=Array.isArray((raw as CognitiveEventFabricSnapshot | undefined)?.receiptEvents)
      ? (raw as CognitiveEventFabricSnapshot).receiptEvents! : [];
    const rows=[...recentRows,...receiptEvents];
    const seen=new Set<string>();
    const restored:CognitiveEventNode[]=[];
    for(const value of rows){
      if(!isRecord(value))continue;
      const id=typeof value.id==='string'?value.id.trim().slice(0,180):'';
      const stage=typeof value.stage==='string'?value.stage as CognitiveStage:undefined;
      // Restore strictly typed ticks; do not coerce null/strings into valid causal time.
      const tick=value.tick;
      if(!id||!COGNITIVE_STAGES.has(stage as CognitiveStage)||typeof tick!=='number'||!Number.isFinite(tick)||tick<0||seen.has(id))continue;
      const at=Number(value.at);
      const parentIds=Array.isArray(value.parentIds)?value.parentIds.filter((parent):parent is string=>typeof parent==='string'&&Boolean(parent.trim())).map(parent=>parent.trim().slice(0,180)).slice(0,12):[];
      let payload:Record<string,unknown>;
      try { payload=cleanPayload(value.payload); }
      catch { continue; } // Skip malformed persisted evidence without aborting restoration of healthy events.
      seen.add(id);
      restored.push({
        id, stage:stage as CognitiveStage, tick:Math.floor(tick),
        at:Number.isFinite(at)&&at>=0?at:0,
        source:typeof value.source==='string'?value.source.slice(0,120):'restored-unknown',
        parentIds, external:Boolean(value.external), confidence01:clamp01(Number(value.confidence01??.5)),
        payload,
      });
      if(restored.length>=this.capacity)break;
    }
    this.events=restored;
    this.receiptProjectionIndex.clear();
    const restoredById=new Map(this.events.map(event=>[event.id,event] as const));
    const receiptRows=Array.isArray((raw as CognitiveEventFabricSnapshot | undefined)?.receiptProjectionIndex)
      ? (raw as CognitiveEventFabricSnapshot).receiptProjectionIndex! : [];
    for(const entry of receiptRows) {
      if(!entry || typeof entry.executionId!=='string' || !entry.executionId.trim() || entry.executionId.length>180) continue;
      if(typeof entry.actionEventId!=='string' || typeof entry.outcomeEventId!=='string' || typeof entry.evidenceEventId!=='string') continue;
      const projectedAt=Number(entry.projectedAt);
      if(!Number.isFinite(projectedAt) || projectedAt<0) continue;
      const action=restoredById.get(entry.actionEventId), outcome=restoredById.get(entry.outcomeEventId), evidence=restoredById.get(entry.evidenceEventId);
      // Never restore a replay guard whose three referenced nodes have aged out,
      // been truncated or no longer match the execution identity/stage contract.
      if(action?.stage!=='tool-action' || outcome?.stage!=='tool-outcome' || evidence?.stage!=='tool-evidence') continue;
      if(action.payload.executionId!==entry.executionId || outcome.payload.executionId!==entry.executionId || evidence.payload.executionId!==entry.executionId) continue;
      if(!outcome.parentIds.includes(action.id) || !evidence.parentIds.includes(outcome.id)) continue;
      const externalObservations=Array.isArray(entry.externalObservations)?entry.externalObservations.slice(-32).filter((ref:any)=>{
        if(!ref||typeof ref.observationId!=='string'||!ref.observationId.trim()||ref.observationId.length>180||typeof ref.eventId!=='string'||ref.eventId.length>180||!/^[a-f0-9]{64}$/i.test(String(ref.projectionHash??''))||!Number.isFinite(Number(ref.projectedAt))||Number(ref.projectedAt)<0)return false;
        const event=restoredById.get(String(ref.eventId));
        return event?.stage==='external-evidence'&&event.payload.executionId===entry.executionId&&event.payload.observationId===ref.observationId&&event.payload.projectionHash===String(ref.projectionHash).toLowerCase();
      }).map((ref:any)=>({observationId:String(ref.observationId),eventId:String(ref.eventId),projectionHash:String(ref.projectionHash).toLowerCase(),projectedAt:Number(ref.projectedAt)})):[];
      const receiptRevisions=Array.isArray((entry as ToolReceiptProjectionIndexEntry).receiptRevisions)?(entry as ToolReceiptProjectionIndexEntry).receiptRevisions!.slice(-32).filter((ref:any)=>{
        if(!ref||typeof ref.revisionId!=='string'||!ref.revisionId.trim()||ref.revisionId.length>180||typeof ref.eventId!=='string'||ref.eventId.length>180||!/^[a-f0-9]{64}$/i.test(String(ref.projectionHash??''))||!Number.isFinite(Number(ref.projectedAt))||Number(ref.projectedAt)<0)return false;
        const event=restoredById.get(String(ref.eventId));
        return event?.stage==='tool-reconciliation'&&event.payload.executionId===entry.executionId&&event.payload.revisionId===ref.revisionId&&event.payload.projectionHash===String(ref.projectionHash).toLowerCase();
      }).map((ref:any)=>({revisionId:String(ref.revisionId),eventId:String(ref.eventId),projectionHash:String(ref.projectionHash).toLowerCase(),projectedAt:Number(ref.projectedAt)})):[];
      this.receiptProjectionIndex.set(entry.executionId,{executionId:entry.executionId,actionEventId:entry.actionEventId.slice(0,180),outcomeEventId:entry.outcomeEventId.slice(0,180),evidenceEventId:entry.evidenceEventId.slice(0,180),projectedAt,...(/^[a-f0-9]{64}$/i.test(String(entry.projectionHash??''))?{projectionHash:String(entry.projectionHash).toLowerCase()}: {}),...(externalObservations.length?{externalObservations}:{}),...(receiptRevisions.length?{receiptRevisions}:{})});
      if(this.receiptProjectionIndex.size>=256) break;
    }
    const rawTotal=Number(raw?.total??this.events.length);
    this.total=Math.max(this.events.length,Number.isFinite(rawTotal)?Math.max(0,Math.floor(rawTotal)):this.events.length);
  }

  append(input:{id?:string;tick:number;stage:CognitiveStage;source:string;parentIds?:string[];external?:boolean;confidence01?:number;payload?:Record<string,unknown>;at?:number}):CognitiveEventNode{
    const suppliedId=typeof input.id==='string'?input.id.trim():'';
    if(input.id!==undefined&&(!suppliedId||suppliedId.length>180||/[\u0000-\u001f\u007f]/.test(suppliedId))) {
      throw new Error('invalid-cognitive-event-id');
    }

    const rawTick=input.tick;
    if(!Number.isSafeInteger(rawTick)||rawTick<0) {
      throw new RangeError('invalid-cognitive-event-tick');
    }
    if(input.at!==undefined&&(!Number.isFinite(input.at)||input.at<0)) {
      throw new RangeError('invalid-cognitive-event-timestamp');
    }
    const normalizedTick=rawTick;
    if(!COGNITIVE_STAGES.has(input.stage)) throw new Error('invalid-cognitive-event-stage');

    const normalizedSource=typeof input.source==='string'&&input.source.trim()?input.source.trim().slice(0,120):'unknown';
    if(input.parentIds!==undefined&&!Array.isArray(input.parentIds)) throw new TypeError('cognitive-event-parent-ids-must-be-array');
    if(Array.isArray(input.parentIds)&&input.parentIds.some(parent=>typeof parent!=='string')) throw new TypeError('cognitive-event-parent-ids-must-be-strings');
    const normalizedParents=(input.parentIds??[]).map(parent=>parent.trim().slice(0,180)).filter(Boolean).slice(0,12);
    const normalizedExternal=Boolean(input.external);
    const normalizedConfidence=clamp01(input.confidence01??0.5);
    // Canonicalize and deeply detach untrusted payloads before looking up or mutating
    // the ledger. Circular/unsupported payloads must fail before total or events change.
    const normalizedPayload=cleanPayload(input.payload);
    const prior=suppliedId?this.events.find(event=>event.id===suppliedId):undefined;
    // An omitted/non-finite timestamp on replay means "same logical event"; preserve
    // the persisted timestamp instead of manufacturing a conflict from arrival time.
    const at=input.at!==undefined?input.at:(prior?.at??Date.now());
    const event:CognitiveEventNode={
      id:suppliedId||`cef:${at}:${normalizedTick}:${Math.random().toString(16).slice(2)}`,
      tick:normalizedTick,
      at,
      stage:input.stage,
      source:normalizedSource,
      parentIds:normalizedParents,
      external:normalizedExternal,
      confidence01:normalizedConfidence,
      payload:normalizedPayload,
    };

    if(prior) {
      if(cognitiveEventFingerprint(prior)!==cognitiveEventFingerprint(event)) {
        throw new Error('cognitive-event-id-conflict');
      }
      return cloneCognitiveEvent(prior);
    }

    this.events.unshift(event);
    if(this.events.length>this.capacity)this.events=this.events.slice(0,this.capacity);
    this.total+=1;
    this.pruneReceiptProjectionIndex();
    return cloneCognitiveEvent(event);
  }

  /** Read-only stable-ID lookup; the returned event is fully detached from ledger state. */
  getById(id:string):CognitiveEventNode|null {
    const normalized=typeof id==='string'?id.trim():'';
    if(!normalized)return null;
    const event=this.events.find(row=>row.id===normalized);
    return event?cloneCognitiveEvent(event):null;
  }
  private pruneReceiptProjectionIndex():void {
    if(!this.receiptProjectionIndex.size) return;
    const ids=new Set(this.events.map(event=>event.id));
    for(const [executionId,entry] of this.receiptProjectionIndex) {
      if(!ids.has(entry.actionEventId)||!ids.has(entry.outcomeEventId)||!ids.has(entry.evidenceEventId))
        this.receiptProjectionIndex.delete(executionId);
    }
  }

  /**
   * Project a completed ActionGateway receipt into the same causal journal used by
   * operational cycles. This is a separate, cross-tick trace: it deliberately does
   * not manufacture learning/self-update stages or inflate operational-cycle coverage.
   * The executionId is the deduplication key; a replay returns the original event IDs.
   */
  appendToolReceiptTrace(input:{
    tick:number; executionId:string; toolId:string; decisionId?:string;
    ok:boolean; verified:boolean; outcomeClass:string; confidence01:number;
    verificationBasis:string; externalObservation:boolean; observationId?:string;
    expectedPostcondition?:string; observedPostcondition?:string;
    observationIntegrated:boolean; at?:number;
  }): { replayed:boolean; executionId:string; actionEventId:string; outcomeEventId:string; evidenceEventId:string } {
    const executionId=String(input.executionId??'').trim().slice(0,180);
    if(!executionId) throw new Error('tool-receipt-execution-id-required');
    const safeTool=String(input.toolId??'unknown').slice(0,64);
    const decisionId=String(input.decisionId??'').trim().slice(0,180)||undefined;
    const normalized={
      tick:Math.max(0,Math.floor(Number.isFinite(input.tick)?input.tick:0)),executionId,toolId:safeTool,decisionId:decisionId??null,
      ok:Boolean(input.ok),verified:Boolean(input.verified),outcomeClass:String(input.outcomeClass??'unknown').slice(0,64),
      confidence01:clamp01(input.confidence01),verificationBasis:String(input.verificationBasis??'none').slice(0,48),
      externalObservation:Boolean(input.externalObservation),observationId:String(input.observationId??'').slice(0,180)||null,
      expectedPostconditionPresent:Boolean(String(input.expectedPostcondition??'').trim()),
      observedPostconditionPresent:Boolean(String(input.observedPostcondition??'').trim()),
      // Hash canonical claims into the immutable receipt fingerprint without writing raw postcondition text into CEF.
      expectedPostconditionHash:String(input.expectedPostcondition??'').trim()?sha256Stable(String(input.expectedPostcondition).normalize('NFKC').trim().toLocaleLowerCase()):null,
      observedPostconditionHash:String(input.observedPostcondition??'').trim()?sha256Stable(String(input.observedPostcondition).normalize('NFKC').trim().toLocaleLowerCase()):null,
      observationIntegrated:Boolean(input.observationIntegrated),
    };
    const projectionHash=sha256Stable(normalized);
    const allForExecution=this.events.filter(event=>event.payload.executionId===executionId&&['tool-action','tool-outcome','tool-evidence'].includes(event.stage));
    const prior=this.receiptProjectionIndex.get(executionId);
    const byId=new Map(this.events.map(event=>[event.id,event] as const));
    const priorNodes=prior?[byId.get(prior.actionEventId),byId.get(prior.outcomeEventId),byId.get(prior.evidenceEventId)]:[];
    const candidateNodes=prior?priorNodes:allForExecution;
    if(candidateNodes.length){
      const action=candidateNodes.find(event=>event?.stage==='tool-action');
      const outcome=candidateNodes.find(event=>event?.stage==='tool-outcome');
      const evidence=candidateNodes.find(event=>event?.stage==='tool-evidence');
      const complete=Boolean(action&&outcome&&evidence&&candidateNodes.length===3&&outcome.parentIds.includes(action.id)&&evidence.parentIds.includes(outcome.id));
      if(!complete){
        if(candidateNodes.some(Boolean))throw new Error('tool-receipt-trace-incomplete-reconciliation-required');
      } else {
        const storedMatches=action!.payload.tool===normalized.toolId&&
          action!.payload.decisionId===(normalized.decisionId??null)&&
          outcome!.tick===normalized.tick&&outcome!.payload.tool===normalized.toolId&&outcome!.payload.ok===normalized.ok&&
          outcome!.payload.verified===normalized.verified&&outcome!.payload.outcomeClass===normalized.outcomeClass&&
          Math.abs(clamp01(Number(outcome!.confidence01))-normalized.confidence01)<1e-9&&
          evidence!.payload.verificationBasis===normalized.verificationBasis&&evidence!.payload.externalObservation===normalized.externalObservation&&
          evidence!.payload.observationId===normalized.observationId&&evidence!.payload.observationIntegrated===normalized.observationIntegrated&&
          evidence!.payload.expectedPostconditionPresent===normalized.expectedPostconditionPresent&&evidence!.payload.observedPostconditionPresent===normalized.observedPostconditionPresent&&
          evidence!.payload.expectedPostconditionHash===normalized.expectedPostconditionHash&&
          evidence!.payload.observedPostconditionHash===normalized.observedPostconditionHash;
        if(!storedMatches||(prior?.projectionHash&&prior.projectionHash!==projectionHash))throw new Error('tool-receipt-execution-id-conflict');
        const replayEntry:ToolReceiptProjectionIndexEntry={executionId,actionEventId:action!.id,outcomeEventId:outcome!.id,evidenceEventId:evidence!.id,projectedAt:prior?.projectedAt??action!.at,projectionHash};
        this.receiptProjectionIndex.set(executionId,replayEntry);
        return {...replayEntry,replayed:true};
      }
    }
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const decision=this.events.find(event=>event.id===decisionId);
    const action=this.append({
      tick:input.tick,stage:'tool-action',source:'action-gateway',
      parentIds:decision?[decision.id]:[],external:false,confidence01:input.verified?Math.max(.5,clamp01(input.confidence01)):.5,at,
      payload:{executionId,tool:safeTool,decisionId:decision?.id??null,decisionLinked:Boolean(decision)},
    });
    const outcome=this.append({
      tick:input.tick,stage:'tool-outcome',source:'action-gateway-outcome',
      parentIds:[action.id],external:false,confidence01:clamp01(input.confidence01),at,
      payload:{executionId,tool:safeTool,ok:Boolean(input.ok),verified:Boolean(input.verified),outcomeClass:String(input.outcomeClass??'unknown').slice(0,64)},
    });
    const evidence=this.append({
      tick:input.tick,stage:'tool-evidence',source:'outcome-verification',
      parentIds:[outcome.id],external:Boolean(input.externalObservation),confidence01:clamp01(input.confidence01),at,
      payload:{executionId,tool:safeTool,verificationBasis:String(input.verificationBasis??'none').slice(0,48),externalObservation:Boolean(input.externalObservation),observationId:String(input.observationId??'').slice(0,180)||null,observationIntegrated:Boolean(input.observationIntegrated),expectedPostconditionPresent:Boolean(String(input.expectedPostcondition??'').trim()),observedPostconditionPresent:Boolean(String(input.observedPostcondition??'').trim()),expectedPostconditionHash:normalized.expectedPostconditionHash,observedPostconditionHash:normalized.observedPostconditionHash},
    });
    const entry:ToolReceiptProjectionIndexEntry={executionId,actionEventId:action.id,outcomeEventId:outcome.id,evidenceEventId:evidence.id,projectedAt:at,projectionHash};
    this.receiptProjectionIndex.set(executionId,entry);
    while(this.receiptProjectionIndex.size>256) { const oldest=this.receiptProjectionIndex.keys().next().value; if(oldest===undefined) break; this.receiptProjectionIndex.delete(oldest); }
    return {...entry,replayed:false};
  }


  hasToolReceiptTrace(executionId:string):boolean{
    const id=String(executionId??'').trim();
    if(!id)return false;
    const entry=this.receiptProjectionIndex.get(id);
    if(!entry)return false;
    const byId=new Map(this.events.map(event=>[event.id,event] as const));
    return byId.get(entry.actionEventId)?.stage==='tool-action'&&byId.get(entry.outcomeEventId)?.stage==='tool-outcome'&&byId.get(entry.evidenceEventId)?.stage==='tool-evidence';
  }

  /**
   * Append authoritative provider evidence without rewriting the immutable receipt
   * trio. All sensitive receipt identifiers are represented by hashes in CEF.
   */
  appendToolReceiptRevision(input:{
    tick:number;executionId:string;toolId:string;revisionId:string;revisionNumber:number;providerReceiptHash:string;
    revisionFingerprint:string;outcomeClass:string;ok:boolean;verified:boolean;verificationBasis:string;confidence01:number;
    observationId?:string;status:'verified'|'contradicted'|'unverified';reason?:string;at?:number;
  }):{resolved:boolean;replayed:boolean;reason?:string;eventId?:string;projectionHash?:string}{
    const executionId=String(input.executionId??'').trim().slice(0,180);
    const revisionId=String(input.revisionId??'').trim().slice(0,180);
    const toolId=String(input.toolId??'').trim().slice(0,64);
    if(!executionId)return {resolved:false,replayed:false,reason:'execution-id-required'};
    if(!revisionId)return {resolved:false,replayed:false,reason:'revision-id-required'};
    if(!toolId)return {resolved:false,replayed:false,reason:'tool-id-required'};
    if(!/^[a-f0-9]{64}$/i.test(String(input.providerReceiptHash??''))||!/^[a-f0-9]{64}$/i.test(String(input.revisionFingerprint??'')))return {resolved:false,replayed:false,reason:'revision-hash-invalid'};
    const entry=this.receiptProjectionIndex.get(executionId);
    if(!entry||!this.hasToolReceiptTrace(executionId))return {resolved:false,replayed:false,reason:'no-canonical-tool-receipt'};
    const receiptAction=this.events.find(event=>event.id===entry.actionEventId);
    const receiptOutcome=this.events.find(event=>event.id===entry.outcomeEventId);
    if(receiptAction?.payload.tool!==toolId||receiptOutcome?.payload.tool!==toolId)return {resolved:false,replayed:false,reason:'execution-tool-mismatch'};
    const normalized={executionId,toolId,revisionId,revisionNumber:Math.max(1,Math.floor(input.revisionNumber)),providerReceiptHash:String(input.providerReceiptHash).toLowerCase(),revisionFingerprint:String(input.revisionFingerprint).toLowerCase(),outcomeClass:String(input.outcomeClass??'unknown').slice(0,64),ok:Boolean(input.ok),verified:Boolean(input.verified),verificationBasis:String(input.verificationBasis??'none').slice(0,48),confidence01:clamp01(input.confidence01),observationId:String(input.observationId??'').slice(0,180)||null,status:input.status,reason:String(input.reason??'').replace(/[\r\n\t]+/g,' ').slice(0,160)};
    const projectionHash=sha256Stable(normalized);
    const refs=entry.receiptRevisions??[];
    const prior=refs.find(ref=>ref.revisionId===revisionId);
    if(prior){
      if(prior.projectionHash!==projectionHash)throw new Error('tool-receipt-revision-conflict');
      return {resolved:true,replayed:true,eventId:prior.eventId,projectionHash};
    }
    // Never drop an idempotency reference and later accept the same revision again.
    // A bounded receipt ledger fails closed when its reference budget is exhausted.
    if(refs.length>=32)return {resolved:false,replayed:false,reason:'tool-receipt-revision-ledger-full'};
    const eventId=`cef:tool-receipt-revision:${sha256Stable({executionId,revisionId}).slice(0,48)}`;
    const byId=new Map(this.events.map(event=>[event.id,event] as const));
    const existing=byId.get(eventId);
    if(existing){
      if(existing.stage!=='tool-reconciliation'||existing.payload.executionId!==executionId||existing.payload.revisionId!==revisionId||existing.payload.projectionHash!==projectionHash)throw new Error('tool-receipt-revision-conflict');
      const ref={revisionId,eventId,projectionHash,projectedAt:existing.at};
      this.receiptProjectionIndex.set(executionId,{...entry,receiptRevisions:[...refs,ref]});
      return {resolved:true,replayed:true,eventId,projectionHash};
    }
    const latestRevision=refs.at(-1);
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const parents=[entry.outcomeEventId,...(latestRevision?[latestRevision.eventId]:[])].slice(0,12);
    const event=this.append({id:eventId,tick:input.tick,stage:'tool-reconciliation',source:'authoritative-provider-receipt',parentIds:parents,external:false,confidence01:clamp01(input.confidence01),at,payload:{...normalized,projectionHash,baseOutcomeEventId:entry.outcomeEventId,previousRevisionEventId:latestRevision?.eventId??null}});
    const ref={revisionId,eventId:event.id,projectionHash,projectedAt:at};
    this.receiptProjectionIndex.set(executionId,{...entry,receiptRevisions:[...refs,ref]});
    return {resolved:true,replayed:false,eventId:event.id,projectionHash};
  }

  /**
   * Append independently sourced post-action evidence to the exact ActionGateway receipt.
   * The event uses a separate stage so late evidence cannot distort operational-cycle coverage.
   * Raw postcondition text is not copied into CEF; only canonical hashes/presence flags are retained.
   */
  appendToolExternalObservation(input:{tick:number;executionId:string;toolId:string;observationId:string;verified:boolean;confidence01:number;sourceId?:string;sourceClass?:string;channel?:string;independenceKey?:string;expectedPostcondition?:string;observedPostcondition?:string;reason?:string;at?:number}):{resolved:boolean;reason?:string;replayed?:boolean;eventId?:string;archived?:boolean}{
    const executionId=String(input.executionId??'').trim().slice(0,180);
    const observationId=String(input.observationId??'').trim().slice(0,180);
    const toolId=String(input.toolId??'').trim().slice(0,64);
    if(!executionId)return {resolved:false,reason:'execution-id-required'};
    if(!observationId)return {resolved:false,reason:'observation-id-required'};
    if(!toolId)return {resolved:false,reason:'tool-id-required'};
    const entry=this.receiptProjectionIndex.get(executionId);
    const byId=new Map(this.events.map(event=>[event.id,event] as const));
    const action=entry?byId.get(entry.actionEventId):this.events.find(event=>event.stage==='tool-action'&&event.payload.executionId===executionId);
    const outcome=entry?byId.get(entry.outcomeEventId):this.events.find(event=>event.stage==='tool-outcome'&&event.payload.executionId===executionId);
    if(!action||!outcome||action.stage!=='tool-action'||outcome.stage!=='tool-outcome'||!outcome.parentIds.includes(action.id))return {resolved:false,reason:'no-canonical-tool-receipt'};
    if(String(action.payload.tool??'')!==toolId||String(outcome.payload.tool??'')!==toolId)return {resolved:false,reason:'execution-tool-mismatch'};
    const expected=String(input.expectedPostcondition??'').normalize('NFKC').trim().toLocaleLowerCase();
    const observed=String(input.observedPostcondition??'').normalize('NFKC').trim().toLocaleLowerCase();
    const safePayload={executionId,toolId,observationId,verified:Boolean(input.verified),confidence01:clamp01(input.confidence01),sourceId:String(input.sourceId??'unknown').slice(0,80),sourceClass:String(input.sourceClass??'unknown').slice(0,32),channel:String(input.channel??'unknown').slice(0,32),independenceKey:String(input.independenceKey??'').slice(0,120),expectedPostconditionHash:expected?sha256Stable(expected):null,observedPostconditionHash:observed?sha256Stable(observed):null,expectedPostconditionPresent:Boolean(expected),observedPostconditionPresent:Boolean(observed),reason:String(input.reason??'').slice(0,160)};
    const projectionHash=sha256Stable(safePayload);
    const refs=entry?.externalObservations??[];
    const prior=refs.find(ref=>ref.observationId===observationId);
    if(prior){
      if(prior.projectionHash!==projectionHash)throw new Error('external-observation-projection-conflict');
      return {resolved:true,replayed:true,eventId:prior.eventId,archived:!byId.has(prior.eventId)};
    }
    const eventId=`cef:tool-external-observation:${sha256Stable({executionId,observationId}).slice(0,48)}`;
    const existing=byId.get(eventId);
    if(existing){
      if(existing.stage!=='external-evidence'||existing.payload.projectionHash!==projectionHash||existing.payload.executionId!==executionId||existing.payload.observationId!==observationId)throw new Error('external-observation-projection-conflict');
      const ref={observationId,eventId,projectionHash,projectedAt:existing.at};
      if(entry)this.receiptProjectionIndex.set(executionId,{...entry,externalObservations:[...refs,ref].slice(-32)});
      return {resolved:true,replayed:true,eventId};
    }
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const evidence=this.append({id:eventId,tick:input.tick,stage:'external-evidence',source:'external-observer-fabric',parentIds:[outcome.id],external:true,confidence01:clamp01(input.confidence01),at,payload:{...safePayload,projectionHash,receiptActionEventId:action.id,receiptOutcomeEventId:outcome.id,evidenceStatus:input.verified?'corroborated':expected&&observed&&expected!==observed?'contradicted':'unresolved'}});
    const ref={observationId,eventId:evidence.id,projectionHash,projectedAt:at};
    if(entry)this.receiptProjectionIndex.set(executionId,{...entry,externalObservations:[...refs,ref].slice(-32)});
    return {resolved:true,replayed:false,eventId:evidence.id};
  }

  recordOperationalCycle(input:{
    tick:number;
    observation?:OperationalCyclePhaseInput;
    prediction?:OperationalCyclePhaseInput;
    appraisal?:OperationalCyclePhaseInput;
    attention?:OperationalCyclePhaseInput;
    memory?:OperationalCyclePhaseInput;
    goal?:OperationalCyclePhaseInput;
    plan?:OperationalCyclePhaseInput;
    action?:OperationalCyclePhaseInput;
    outcome?:OperationalCyclePhaseInput;
    learning?:OperationalCyclePhaseInput;
    selfUpdate?:OperationalCyclePhaseInput;
    at?:number;
  }){
    const ids:Partial<Record<'observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'selfUpdate',string>>={};
    const parents=(...eventIds:(string|undefined)[])=>eventIds.filter((id):id is string=>Boolean(id));
    if(input.observation){const e=this.append({tick:input.tick,stage:'observation',source:input.observation.source??'runtime',external:input.observation.external,confidence01:input.observation.confidence01,payload:input.observation.payload,at:input.at});ids.observation=e.id;}
    if(input.prediction){const e=this.append({tick:input.tick,stage:'prediction',source:input.prediction.source??'prediction',parentIds:parents(ids.observation),confidence01:input.prediction.confidence01,payload:input.prediction.payload,at:input.at});ids.prediction=e.id;}
    if(input.appraisal){const e=this.append({tick:input.tick,stage:'appraisal',source:input.appraisal.source??'appraisal',parentIds:parents(ids.observation,ids.prediction),confidence01:input.appraisal.confidence01,payload:input.appraisal.payload,at:input.at});ids.appraisal=e.id;}
    if(input.attention){const e=this.append({tick:input.tick,stage:'attention',source:input.attention.source??'attention',parentIds:parents(ids.appraisal,ids.prediction),confidence01:input.attention.confidence01,payload:input.attention.payload,at:input.at});ids.attention=e.id;}
    if(input.memory){const e=this.append({tick:input.tick,stage:'memory',source:input.memory.source??'memory',parentIds:parents(ids.attention,ids.observation),confidence01:input.memory.confidence01,payload:input.memory.payload,at:input.at});ids.memory=e.id;}
    if(input.goal){const e=this.append({tick:input.tick,stage:'goal',source:input.goal.source??'goal',parentIds:parents(ids.appraisal,ids.memory,ids.prediction),confidence01:input.goal.confidence01,payload:input.goal.payload,at:input.at});ids.goal=e.id;}
    if(input.plan){const e=this.append({tick:input.tick,stage:'plan',source:input.plan.source??'plan',parentIds:parents(ids.goal,ids.prediction),confidence01:input.plan.confidence01,payload:input.plan.payload,at:input.at});ids.plan=e.id;}
    if(input.action){const e=this.append({tick:input.tick,stage:'action',source:input.action.source??'action',parentIds:parents(ids.plan,ids.prediction,ids.observation),confidence01:input.action.confidence01,payload:input.action.payload,at:input.at});ids.action=e.id;}
    if(input.outcome){const e=this.append({tick:input.tick,stage:'outcome',source:input.outcome.source??'outcome',parentIds:parents(ids.action,ids.prediction),external:input.outcome.external,confidence01:input.outcome.confidence01,payload:input.outcome.payload,at:input.at});ids.outcome=e.id;}
    if(input.learning){const e=this.append({tick:input.tick,stage:'learning',source:input.learning.source??'learning',parentIds:parents(ids.outcome,ids.action),confidence01:input.learning.confidence01,payload:input.learning.payload,at:input.at});ids.learning=e.id;}
    if(input.selfUpdate){const e=this.append({tick:input.tick,stage:'self-update',source:input.selfUpdate.source??'self-update',parentIds:parents(ids.learning,ids.outcome),confidence01:input.selfUpdate.confidence01,payload:input.selfUpdate.payload,at:input.at});ids.selfUpdate=e.id;}
    return ids;
  }

  /**
   * Verify one cycle against its own causal edges rather than the whole rolling
   * buffer. Global lineage can fall when old parents age out of the ring buffer;
   * that must not invalidate a currently complete cycle. IDs, stage names, tick
   * ownership and required causal links are all checked here.
   */
  verifyOperationalCycle(stageIds: OperationalCycleStageIds): OperationalCycleLineageCheck {
    const required = ['observation','prediction','action','outcome','learning','self-update'] as const;
    const optional = ['appraisal','attention','memory','goal','plan'] as const;
    const byId = new Map(this.events.map(event => [event.id, event] as const));
    const found = new Map<string, CognitiveEventNode>();
    const missingStages: string[] = [];
    const invalidStages: string[] = [];
    let cycleTick: number | null = null;

    const stageOrder: OperationalCycleStageName[] = [
      'observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update',
    ];
    const requiredSet = new Set<string>(required);
    const requestedOptional = new Set<OperationalCycleStageName>(
      optional.filter(stage => Boolean(stageIds[stage])),
    );

    for (const stage of stageOrder) {
      const id = stageIds[stage];
      const isRequired = requiredSet.has(stage);
      if (!id) {
        if (isRequired) missingStages.push(stage);
        continue;
      }
      const event = byId.get(id);
      if (!event) {
        if (isRequired) missingStages.push(stage);
        else invalidStages.push(`${stage}:missing-event`);
        continue;
      }
      if (event.stage !== stage) {
        invalidStages.push(`${stage}:expected-stage-${stage}-got-${event.stage}`);
        continue;
      }
      if (cycleTick === null) cycleTick = event.tick;
      if (event.tick !== cycleTick) {
        invalidStages.push(`${stage}:tick-mismatch`);
        continue;
      }
      found.set(stage, event);
    }

    const edgeRequirements: Array<[OperationalCycleStageName, OperationalCycleStageName, string]> = [
      ['prediction','observation','prediction->observation'],
      ['action','prediction','action->prediction'],
      ['action','observation','action->observation'],
      ['outcome','action','outcome->action'],
      ['learning','outcome','learning->outcome'],
      ['self-update','learning','self-update->learning'],
    ];
    const optionalEdgeRequirements: Array<[OperationalCycleStageName, OperationalCycleStageName, string]> = [
      ['appraisal','observation','appraisal->observation'],
      ['appraisal','prediction','appraisal->prediction'],
      ['attention','appraisal','attention->appraisal'],
      ['attention','prediction','attention->prediction'],
      ['memory','attention','memory->attention'],
      ['memory','observation','memory->observation'],
      ['goal','appraisal','goal->appraisal'],
      ['goal','memory','goal->memory'],
      ['plan','goal','plan->goal'],
      ['plan','prediction','plan->prediction'],
    ];
    for (const edge of optionalEdgeRequirements) {
      if (requestedOptional.has(edge[0])) edgeRequirements.push(edge);
    }
    // If a plan phase is supplied, the required action must causally descend from it.
    if (requestedOptional.has('plan')) edgeRequirements.push(['action','plan','action->plan']);

    const missingEdges: string[] = [];
    let validEdges = 0;
    for (const [childStage, parentStage, label] of edgeRequirements) {
      const child = found.get(childStage);
      const parent = found.get(parentStage);
      if (child && parent && child.parentIds.includes(parent.id)) validEdges++;
      else missingEdges.push(label);
    }
    const expectedStageCount = required.length + requestedOptional.size;
    const stageCoverage = found.size / Math.max(1, expectedStageCount);
    const edgeCoverage = validEdges / Math.max(1, edgeRequirements.length);
    const integrity01 = clamp01(stageCoverage * .6 + edgeCoverage * .4);
    const complete = missingStages.length === 0 && invalidStages.length === 0 && missingEdges.length === 0;
    return { tick: cycleTick, complete, integrity01: complete ? 1 : integrity01, missingStages, invalidStages, missingEdges };
  }

  recent(limit=64):CognitiveEventNode[]{return structuredClone(this.events.slice(0,Math.max(1,Math.min(256,Math.floor(limit)))));}

  snapshot():CognitiveEventFabricSnapshot{
    const known=new Set(this.events.map(e=>e.id));
    let linked=0,dangling=0;
    for(const e of this.events)for(const p of e.parentIds){if(known.has(p))linked++;else dangling++;}
    const byTick=new Map<number,Set<CognitiveStage>>();
    // Receipt traces are cross-tick action records, not operational cycles. They
    // must not inflate or dilute the denominator for same-tick cognitive-cycle coverage.
    const operationalStages=new Set<CognitiveStage>(['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update']);
    for(const e of this.events){
      if(!operationalStages.has(e.stage)) continue;
      const s=byTick.get(e.tick)??new Set<CognitiveStage>();s.add(e.stage);byTick.set(e.tick,s);
    }
    const complete=[...byTick.values()].filter(s=>s.has('observation')&&s.has('prediction')&&s.has('action')&&s.has('outcome')).length;
    const coverage=byTick.size?clamp01(complete/byTick.size):0;
    const totalParentRefs=linked+dangling;
    const allTicks=this.events.map(e=>e.tick);
    const recentTicks=allTicks.length?Math.max(...allTicks)-Math.min(...allTicks):0;
    const recent=this.recent(96);
    const recentIds=new Set(recent.map(event=>event.id));
    const receiptIds=new Set([...this.receiptProjectionIndex.values()].flatMap(entry=>[entry.actionEventId,entry.outcomeEventId,entry.evidenceEventId,...(entry.externalObservations??[]).map(ref=>ref.eventId),...(entry.receiptRevisions??[]).map(ref=>ref.eventId)]));
    // The public snapshot intentionally keeps only 96 ordinary events. Include the
    // sanitized receipt nodes that still have live replay guards so restart restore
    // can retain exact causal links even when a receipt falls outside that window.
    const receiptEvents=this.events.filter(event=>receiptIds.has(event.id)&&!recentIds.has(event.id)).map(event=>({...event,parentIds:[...event.parentIds],payload:{...event.payload}}));
    return{version:1,capacity:this.capacity,total:this.total,buffered:this.events.length,linkedParentEvents:linked,danglingParentLinks:dangling,lineageIntegrity01:clamp01(linked/Math.max(1,totalParentRefs)),cycleCoverage01:coverage,causalDensity01:clamp01(linked/Math.max(1,this.events.length*2)),recentTicks,recent,receiptEvents,receiptProjectionIndex:[...this.receiptProjectionIndex.values()]};
  }
}
