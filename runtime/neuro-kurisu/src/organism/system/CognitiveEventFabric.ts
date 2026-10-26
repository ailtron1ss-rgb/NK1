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
const isRecord=(value:unknown):value is Record<string,unknown>=>{
  if(value===null||typeof value!=='object')return false;
  try{return !Array.isArray(value);}catch{return false;}
};
const isPlainRecord=(value:unknown):value is Record<string,unknown>=>{
  if(!isRecord(value))return false;
  try {
    const prototype=Object.getPrototypeOf(value);
    return prototype===Object.prototype||prototype===null;
  } catch {
    // Refuse proxy objects whose prototype cannot be inspected safely.
    return false;
  }
};
type SnapshotArrayInspection={ok:boolean;dense:boolean;truncated:boolean;length:number;items:unknown[]};

function readOwnDataFields(value:unknown, fields:readonly string[]):Record<string,unknown>|null {
  if(!isPlainRecord(value))return null;
  const result:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
  for(const field of fields){
    let descriptor:PropertyDescriptor|undefined;
    try { descriptor=Object.getOwnPropertyDescriptor(value,field); }
    catch { return null; }
    if(!descriptor)continue;
    if(!Object.hasOwn(descriptor,'value'))return null;
    result[field]=descriptor.value;
  }
  return result;
}

/** Read array slots through own data descriptors; never invoke snapshot iterators or accessors. */
function inspectSnapshotArray(value:unknown,maxItems:number,fromEnd=false):SnapshotArrayInspection {
  if(value===undefined)return {ok:true,dense:true,truncated:false,length:0,items:[]};
  let isArrayValue=false;
  try { isArrayValue=Array.isArray(value); } catch { return {ok:false,dense:false,truncated:false,length:0,items:[]}; }
  if(!isArrayValue)return {ok:false,dense:false,truncated:false,length:0,items:[]};
  let lengthDescriptor:PropertyDescriptor|undefined;
  try { lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length'); }
  catch { return {ok:false,dense:false,truncated:false,length:0,items:[]}; }
  if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||
    typeof lengthDescriptor.value!=='number'||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value<0) {
    return {ok:false,dense:false,truncated:false,length:0,items:[]};
  }
  const length=lengthDescriptor.value;
  const count=Math.min(length,Math.max(0,Math.floor(maxItems)));
  const start=fromEnd?Math.max(0,length-count):0;
  const items:unknown[]=[];
  let dense=length<=count;
  for(let index=start;index<start+count;index+=1){
    let descriptor:PropertyDescriptor|undefined;
    try { descriptor=Object.getOwnPropertyDescriptor(value,String(index)); }
    catch { dense=false; items.push(undefined); continue; }
    if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value')) {
      dense=false;
      items.push(undefined);
      continue;
    }
    items.push(descriptor.value);
  }
  return {ok:true,dense,truncated:length>count,length,items};
}

const isCanonicalCognitiveIdentifier=(value:unknown,maxLength:number):value is string=>
  typeof value==='string'&&value.length>0&&value===value.trim()&&value.length<=maxLength&&!/[\x00-\x1f\x7f-\x9f]/.test(value);
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
        if(!descriptor||!descriptor.enumerable||!('value' in descriptor)) { output.push(null); continue; }
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

function eventEnvelopeFingerprint(event:Pick<CognitiveEventNode,'tick'|'at'|'stage'|'source'|'parentIds'|'external'|'confidence01'|'payload'>):string {
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
    this.capacity=Number.isFinite(capacity)
      ?Math.max(128,Math.min(4096,Math.floor(capacity)))
      :512;
  }


  private withAtomicLedgerMutation<T>(operation:()=>T):T{
    const eventsBefore=this.events.slice();
    const totalBefore=this.total;
    const receiptIndexBefore=[...this.receiptProjectionIndex.entries()];
    try{
      return operation();
    }catch(error){
      this.events=eventsBefore;
      this.total=totalBefore;
      this.receiptProjectionIndex.clear();
      for(const [executionId,entry] of receiptIndexBefore)this.receiptProjectionIndex.set(executionId,entry);
      throw error;
    }
  }

  restore(raw?:Partial<CognitiveEventFabricSnapshot>|null):void{
    // Missing/null snapshots intentionally reset the ledger. A supplied snapshot with
    // accessor-backed envelope fields is rejected without executing getters or mutating state.
    let snapshot:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
    if(raw!==undefined&&raw!==null){
      const fields=readOwnDataFields(raw,['recent','receiptEvents','receiptProjectionIndex','total']);
      if(!fields)return;
      snapshot=fields;
    }

    const recentRead=inspectSnapshotArray(snapshot.recent,8192);
    const receiptEventsRead=inspectSnapshotArray(snapshot.receiptEvents,8192);
    const rows=[
      ...(recentRead.ok?recentRead.items:[]),
      ...(receiptEventsRead.ok?receiptEventsRead.items:[]),
    ];
    const seen=new Set<string>();
    const restored:CognitiveEventNode[]=[];
    const eventFields=['id','stage','tick','at','source','parentIds','external','confidence01','payload'] as const;
    for(const rawValue of rows){
      const value=readOwnDataFields(rawValue,eventFields);
      if(!value)continue;
      const id=typeof value.id==='string'?value.id:'';
      const stage=typeof value.stage==='string'?value.stage as CognitiveStage:undefined;
      const tick=value.tick;
      if(!id||id!==id.trim()||id.length>180||/[\x00-\x1f\x7f-\x9f]/.test(id)||
        !COGNITIVE_STAGES.has(stage as CognitiveStage)||typeof tick!=='number'||!Number.isSafeInteger(tick)||tick<0||seen.has(id))continue;
      const rawAt=value.at;
      if(rawAt!==undefined&&(typeof rawAt!=='number'||!Number.isFinite(rawAt)||rawAt<0))continue;
      if(value.source!==undefined&&(typeof value.source!=='string'||!value.source.trim()||value.source!==value.source.trim()||value.source.length>120||/[\x00-\x1f\x7f-\x9f]/.test(value.source)))continue;
      if(value.external!==undefined&&typeof value.external!=='boolean')continue;
      if(value.confidence01!==undefined&&(
        typeof value.confidence01!=='number'||!Number.isFinite(value.confidence01)||value.confidence01<0||value.confidence01>1
      ))continue;

      const parentRead=inspectSnapshotArray(value.parentIds,12);
      if(value.parentIds!==undefined&&(!parentRead.ok||parentRead.truncated||!parentRead.dense))continue;
      const parentIds:string[]=[];
      let invalidParentLineage=false;
      for(const parent of parentRead.items){
        if(typeof parent!=='string'||!parent.trim()||parent!==parent.trim()||parent.length>180||/[\x00-\x1f\x7f-\x9f]/.test(parent)) {
          invalidParentLineage=true;
          break;
        }
        parentIds.push(parent);
      }
      if(invalidParentLineage||new Set(parentIds).size!==parentIds.length)continue;

      const at=rawAt===undefined?0:rawAt;
      let payload:Record<string,unknown>;
      try { payload=cleanPayload(value.payload); }
      catch { continue; }
      // Malformed rows do not reserve an ID: a later valid duplicate can still recover.
      seen.add(id);
      restored.push({
        id, stage:stage as CognitiveStage, tick, at,
        source:typeof value.source==='string'?value.source:'restored-unknown',
        parentIds, external:typeof value.external==='boolean'?value.external:false,
        confidence01:typeof value.confidence01==='number'?value.confidence01:.5,
        payload,
      });
      if(restored.length>=this.capacity)break;
    }

    // Rebuild replay guards off to the side. Bad late entries cannot partially restore the live ledger.
    const restoredById=new Map(restored.map(event=>[event.id,event] as const));
    const restoredProjectionIndex=new Map<string,ToolReceiptProjectionIndexEntry>();
    const receiptRowsRead=inspectSnapshotArray(snapshot.receiptProjectionIndex,512);
    const receiptRows=receiptRowsRead.ok?receiptRowsRead.items:[];
    const receiptEntryFields=['executionId','actionEventId','outcomeEventId','evidenceEventId','projectedAt','projectionHash','externalObservations','receiptRevisions'] as const;
    for(const rawEntry of receiptRows) {
      const entry=readOwnDataFields(rawEntry,receiptEntryFields);
      if(!entry)continue;
      const executionId=typeof entry.executionId==='string'?entry.executionId:'';
      const actionEventId=typeof entry.actionEventId==='string'?entry.actionEventId:'';
      const outcomeEventId=typeof entry.outcomeEventId==='string'?entry.outcomeEventId:'';
      const evidenceEventId=typeof entry.evidenceEventId==='string'?entry.evidenceEventId:'';
      const projectedAt=entry.projectedAt;
      const canonicalId=(value:string,max:number)=>Boolean(value)&&value===value.trim()&&value.length<=max&&!/[\x00-\x1f\x7f-\x9f]/.test(value);
      if(!canonicalId(executionId,180)||!canonicalId(actionEventId,180)||
        !canonicalId(outcomeEventId,180)||!canonicalId(evidenceEventId,180))continue;
      if(typeof projectedAt!=='number'||!Number.isFinite(projectedAt)||projectedAt<0)continue;
      if(restoredProjectionIndex.has(executionId))continue;
      const action=restoredById.get(actionEventId), outcome=restoredById.get(outcomeEventId), evidence=restoredById.get(evidenceEventId);
      if(action?.stage!=='tool-action'||outcome?.stage!=='tool-outcome'||evidence?.stage!=='tool-evidence')continue;
      if(action.payload.executionId!==executionId||outcome.payload.executionId!==executionId||evidence.payload.executionId!==executionId)continue;
      if(!outcome.parentIds.includes(action.id)||!evidence.parentIds.includes(outcome.id))continue;
      const suppliedProjectionHash=typeof entry.projectionHash==='string'?entry.projectionHash.toLowerCase():'';
      const projectionHashValid=/^[a-f0-9]{64}$/.test(suppliedProjectionHash);
      const expectedHash=evidence.payload.expectedPostconditionHash;
      const observedHash=evidence.payload.observedPostconditionHash;
      const hasExpectedHashField=Object.hasOwn(evidence.payload,'expectedPostconditionHash');
      const hasObservedHashField=Object.hasOwn(evidence.payload,'observedPostconditionHash');
      const legacyHashless=!hasExpectedHashField&&!hasObservedHashField;
      if(!projectionHashValid||hasExpectedHashField!==hasObservedHashField)continue;
      if(!legacyHashless) {
        const hashValueIsValid=(value:unknown):boolean=>value===null||
          (typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value));
        if(!hashValueIsValid(expectedHash)||!hashValueIsValid(observedHash))continue;
        if(typeof action.payload.tool!=='string'||typeof outcome.payload.ok!=='boolean'||
          typeof outcome.payload.verified!=='boolean'||typeof outcome.payload.outcomeClass!=='string'||
          typeof evidence.payload.verificationBasis!=='string'||
          typeof evidence.payload.externalObservation!=='boolean'||
          (evidence.payload.observationId!==null&&typeof evidence.payload.observationId!=='string')||
          typeof evidence.payload.expectedPostconditionPresent!=='boolean'||
          typeof evidence.payload.observedPostconditionPresent!=='boolean'||
          typeof evidence.payload.observationIntegrated!=='boolean')continue;
        const reconstructedProjection={
          tick:outcome.tick,
          executionId,
          toolId:action.payload.tool,
          decisionId:(action.payload.requestedDecisionId??action.payload.decisionId)??null,
          ok:outcome.payload.ok,
          verified:outcome.payload.verified,
          outcomeClass:outcome.payload.outcomeClass,
          confidence01:clamp01(Number(outcome.confidence01)),
          verificationBasis:evidence.payload.verificationBasis,
          externalObservation:evidence.payload.externalObservation,
          observationId:evidence.payload.observationId??null,
          expectedPostconditionPresent:evidence.payload.expectedPostconditionPresent,
          observedPostconditionPresent:evidence.payload.observedPostconditionPresent,
          expectedPostconditionHash:expectedHash,
          observedPostconditionHash:observedHash,
          observationIntegrated:evidence.payload.observationIntegrated,
        };
        if(sha256Stable(reconstructedProjection)!==suppliedProjectionHash)continue;
      }

      const externalObservationsRead=inspectSnapshotArray(entry.externalObservations,256,true);
      const externalObservations:ExternalObservationProjectionRef[]=[];
      if(externalObservationsRead.ok){
        for(const rawRef of externalObservationsRead.items.slice(-32)){
          const ref=readOwnDataFields(rawRef,['observationId','eventId','projectionHash','projectedAt']);
          if(!ref)continue;
          const observationId=typeof ref.observationId==='string'?ref.observationId:'';
          const eventId=typeof ref.eventId==='string'?ref.eventId:'';
          const projectionHash=typeof ref.projectionHash==='string'?ref.projectionHash.toLowerCase():'';
          const refAt=ref.projectedAt;
          if(!canonicalId(observationId,180)||!canonicalId(eventId,180)||! /^[a-f0-9]{64}$/.test(projectionHash)||
            typeof refAt!=='number'||!Number.isFinite(refAt)||refAt<0)continue;
          const event=restoredById.get(eventId);
          if(event?.stage==='external-evidence'&&event.payload.executionId===executionId&&
            event.payload.observationId===observationId&&event.payload.projectionHash===projectionHash){
            externalObservations.push({observationId,eventId,projectionHash,projectedAt:refAt});
          }
        }
      }

      const receiptRevisionsRead=inspectSnapshotArray(entry.receiptRevisions,256,true);
      const receiptRevisions:ToolReceiptRevisionProjectionRef[]=[];
      if(receiptRevisionsRead.ok){
        for(const rawRef of receiptRevisionsRead.items.slice(-32)){
          const ref=readOwnDataFields(rawRef,['revisionId','eventId','projectionHash','projectedAt']);
          if(!ref)continue;
          const revisionId=typeof ref.revisionId==='string'?ref.revisionId:'';
          const eventId=typeof ref.eventId==='string'?ref.eventId:'';
          const projectionHash=typeof ref.projectionHash==='string'?ref.projectionHash.toLowerCase():'';
          const refAt=ref.projectedAt;
          if(!canonicalId(revisionId,180)||!canonicalId(eventId,180)||! /^[a-f0-9]{64}$/.test(projectionHash)||
            typeof refAt!=='number'||!Number.isFinite(refAt)||refAt<0)continue;
          const event=restoredById.get(eventId);
          if(event?.stage==='tool-reconciliation'&&event.payload.executionId===executionId&&
            event.payload.revisionId===revisionId&&event.payload.projectionHash===projectionHash){
            receiptRevisions.push({revisionId,eventId,projectionHash,projectedAt:refAt});
          }
        }
      }

      restoredProjectionIndex.set(executionId,{
        executionId,actionEventId,outcomeEventId,evidenceEventId,projectedAt,
        projectionHash:suppliedProjectionHash,
        ...(externalObservations.length?{externalObservations}:{}),
        ...(receiptRevisions.length?{receiptRevisions}:{}),
      });
      if(restoredProjectionIndex.size>=256)break;
    }

    const rawTotal=snapshot.total;
    const validTotal=typeof rawTotal==='number'&&Number.isSafeInteger(rawTotal)&&rawTotal>=0
      ?rawTotal:restored.length;
    this.events=restored;
    this.receiptProjectionIndex.clear();
    for(const [executionId,entry] of restoredProjectionIndex)this.receiptProjectionIndex.set(executionId,entry);
    this.total=Math.max(restored.length,validTotal);
  }

  append(input:{id?:string;tick:number;stage:CognitiveStage;source:string;parentIds?:string[];external?:boolean;confidence01?:number;payload?:Record<string,unknown>;at?:number}):CognitiveEventNode{
    if(!isPlainRecord(input))throw new TypeError('invalid-cognitive-event-input');

    // Snapshot only own data properties. Top-level getters must not run while
    // a causal event is being validated or its replay identity is being computed.
    const inputFieldNames=['id','tick','at','stage','source','parentIds','external','confidence01','payload'] as const;
    const inputValues:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
    for(const field of inputFieldNames){
      let descriptor:PropertyDescriptor|undefined;
      try {
        descriptor=Object.getOwnPropertyDescriptor(input,field);
      } catch {
        throw new TypeError('invalid-cognitive-event-input-field:'+field);
      }
      if(!descriptor)continue;
      if(!Object.hasOwn(descriptor,'value')) {
        throw new TypeError('cognitive-event-input-field-accessor:'+field);
      }
      inputValues[field]=descriptor.value;
    }

    const idValue=inputValues.id;
    const suppliedId=typeof idValue==='string'?idValue:'';
    if(idValue!==undefined&&(
      !suppliedId||suppliedId!==suppliedId.trim()||suppliedId.length>180||/[\u0000-\u001f\u007f-\u009f]/u.test(suppliedId)
    )) {
      throw new Error('invalid-cognitive-event-id');
    }

    const tick=inputValues.tick;
    if(typeof tick!=='number'||!Number.isSafeInteger(tick)||tick<0) {
      throw new RangeError('invalid-cognitive-event-tick');
    }
    const atInput=inputValues.at;
    if(atInput!==undefined&&(typeof atInput!=='number'||!Number.isFinite(atInput)||atInput<0)) {
      throw new RangeError('invalid-cognitive-event-timestamp');
    }
    const stageInput=inputValues.stage;
    if(typeof stageInput!=='string'||!COGNITIVE_STAGES.has(stageInput as CognitiveStage)) {
      throw new TypeError('invalid-cognitive-event-stage');
    }
    const sourceInput=inputValues.source;
    if(typeof sourceInput!=='string')throw new TypeError('invalid-cognitive-event-source');
    // Identity-bearing strings must be canonical; truncation/normalization could alias events.
    if(!sourceInput.trim()||sourceInput!==sourceInput.trim()||sourceInput.length>120||/[\u0000-\u001f\u007f-\u009f]/u.test(sourceInput)) {
      throw new RangeError('invalid-cognitive-event-source');
    }

    const rawParentIds=inputValues.parentIds;
    if(rawParentIds!==undefined&&!Array.isArray(rawParentIds)) {
      throw new TypeError('invalid-cognitive-event-parents');
    }
    const parentInput=Array.isArray(rawParentIds)?rawParentIds:[];
    let parentLength=0;
    if(Array.isArray(rawParentIds)){
      let lengthDescriptor:PropertyDescriptor|undefined;
      try {
        lengthDescriptor=Object.getOwnPropertyDescriptor(rawParentIds,'length');
      } catch {
        throw new TypeError('invalid-cognitive-event-parents');
      }
      if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||
        typeof lengthDescriptor.value!=='number'||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value<0) {
        throw new TypeError('invalid-cognitive-event-parents');
      }
      parentLength=lengthDescriptor.value;
    }
    if(parentLength>12)throw new RangeError('invalid-cognitive-event-parent-count');
    const parentIds:string[]=[];
    for(let index=0;index<parentLength;index+=1){
      let descriptor:PropertyDescriptor|undefined;
      try {
        descriptor=Object.getOwnPropertyDescriptor(parentInput,String(index));
      } catch {
        throw new TypeError('invalid-cognitive-event-parent-id');
      }
      // Do not execute array getters or silently accept holes in causal lineage.
      if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value')) {
        throw new TypeError('invalid-cognitive-event-parent-id');
      }
      const parent=descriptor.value;
      if(typeof parent!=='string'||!parent.trim()||parent!==parent.trim()) {
        throw new TypeError('invalid-cognitive-event-parent-id');
      }
      if(parent.length>180||/[\u0000-\u001f\u007f-\u009f]/u.test(parent)) {
        throw new RangeError('invalid-cognitive-event-parent-id');
      }
      parentIds.push(parent);
    }
    if(new Set(parentIds).size!==parentIds.length) {
      throw new TypeError('invalid-cognitive-event-duplicate-parent-id');
    }

    const externalInput=inputValues.external;
    if(externalInput!==undefined&&typeof externalInput!=='boolean') {
      throw new TypeError('invalid-cognitive-event-external-flag');
    }
    const external=externalInput===undefined?false:externalInput;
    const confidenceInput=inputValues.confidence01;
    if(confidenceInput!==undefined&&typeof confidenceInput!=='number') {
      throw new TypeError('invalid-cognitive-event-confidence');
    }
    if(confidenceInput!==undefined&&(
      !Number.isFinite(confidenceInput)||confidenceInput<0||confidenceInput>1
    )) {
      throw new RangeError('invalid-cognitive-event-confidence');
    }
    const confidence01=confidenceInput===undefined?0.5:confidenceInput;

    // Explicit payload roots must be plain data records, not primitives that collapse to {}.
    const payloadInput=inputValues.payload;
    if(payloadInput!==undefined&&!isPlainRecord(payloadInput)) {
      throw new TypeError('invalid-cognitive-event-payload');
    }
    const payload=cleanPayload(payloadInput);
    // Canonicalize and validate everything before stable-ID lookup or any journal mutation.
    sha256Stable(payload);
    const prior=suppliedId?this.events.find(event=>event.id===suppliedId):undefined;
    const at=atInput!==undefined?atInput:(prior?.at??Date.now());
    const event:CognitiveEventNode={
      id:suppliedId||('cef:'+at+':'+tick+':'+Math.random().toString(16).slice(2)),
      tick,
      at,
      stage:stageInput as CognitiveStage,
      source:sourceInput,
      parentIds,
      external,
      confidence01,
      payload,
    };

    if(prior) {
      if(eventEnvelopeFingerprint(prior)!==eventEnvelopeFingerprint(event)) {
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
  /** Read-only lookup by stable event ID. Returned payloads are detached. */
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
    const safeInput=readOwnDataFields(input,[
      'tick','executionId','toolId','decisionId','ok','verified','outcomeClass','confidence01',
      'verificationBasis','externalObservation','observationId','expectedPostcondition',
      'observedPostcondition','observationIntegrated','at',
    ]);
    if(!safeInput)throw new TypeError('invalid-tool-receipt-input');
    input=safeInput as unknown as typeof input;

    if(typeof input.executionId!=='string')throw new TypeError('invalid-tool-receipt-execution-id');
    const executionId=input.executionId;
    if(!executionId)throw new Error('tool-receipt-execution-id-required');
    if(!isCanonicalCognitiveIdentifier(executionId,180))throw new RangeError('invalid-tool-receipt-execution-id');
    if(typeof input.toolId!=='string'||!input.toolId)throw new TypeError('invalid-tool-receipt-tool-id');
    if(!isCanonicalCognitiveIdentifier(input.toolId,64))throw new RangeError('invalid-tool-receipt-tool-id');
    if(typeof input.tick!=='number'||!Number.isSafeInteger(input.tick)||input.tick<0)throw new RangeError('invalid-cognitive-event-tick');
    if(input.at!==undefined&&(typeof input.at!=='number'||!Number.isFinite(input.at)||input.at<0))throw new RangeError('invalid-cognitive-event-timestamp');
    if(typeof input.ok!=='boolean'||typeof input.verified!=='boolean'||typeof input.externalObservation!=='boolean'||typeof input.observationIntegrated!=='boolean')throw new TypeError('invalid-tool-receipt-boolean');
    if(typeof input.confidence01!=='number'||!Number.isFinite(input.confidence01)||input.confidence01<0||input.confidence01>1)throw new TypeError('invalid-cognitive-event-confidence');
    const optionalText=(value:unknown,key:string,maxLength:number):string|undefined=>{
      if(value===undefined||value===null)return undefined;
      if(typeof value!=='string')throw new TypeError(`invalid-tool-receipt-${key}`);
      if(value.length>maxLength)throw new RangeError(`invalid-tool-receipt-${key}`);
      return value;
    };
    const decisionValue=optionalText(input.decisionId,'decision-id',180);
    if(decisionValue&&!isCanonicalCognitiveIdentifier(decisionValue,180))throw new TypeError('invalid-tool-receipt-decision-id');
    const decisionId=decisionValue||undefined;
    const outcomeClass=optionalText(input.outcomeClass,'outcome-class',64)??'unknown';
    const verificationBasis=optionalText(input.verificationBasis,'verification-basis',48)??'none';
    const observationValue=optionalText(input.observationId,'observation-id',180)??'';
    if(observationValue&&!isCanonicalCognitiveIdentifier(observationValue,180))throw new TypeError('invalid-tool-receipt-observation-id');
    const expectedPostcondition=optionalText(input.expectedPostcondition,'expected-postcondition',16384)??'';
    const observedPostcondition=optionalText(input.observedPostcondition,'observed-postcondition',16384)??'';
    const safeTool=input.toolId;
    const normalized={
      tick:input.tick,executionId,toolId:safeTool,decisionId:decisionId??null,
      ok:input.ok,verified:input.verified,outcomeClass,
      confidence01:clamp01(input.confidence01),verificationBasis,
      externalObservation:input.externalObservation,observationId:observationValue||null,
      expectedPostconditionPresent:Boolean(expectedPostcondition.trim()),
      observedPostconditionPresent:Boolean(observedPostcondition.trim()),
      // Keep canonical claims as hashes only; never copy raw postcondition text into the event ledger.
      expectedPostconditionHash:expectedPostcondition.trim()?sha256Stable(expectedPostcondition.normalize('NFKC').trim()):null,
      observedPostconditionHash:observedPostcondition.trim()?sha256Stable(observedPostcondition.normalize('NFKC').trim()):null,
      observationIntegrated:input.observationIntegrated,
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
          (action!.payload.requestedDecisionId??action!.payload.decisionId)===(normalized.decisionId??null)&&
          outcome!.tick===normalized.tick&&outcome!.payload.tool===normalized.toolId&&outcome!.payload.ok===normalized.ok&&
          outcome!.payload.verified===normalized.verified&&outcome!.payload.outcomeClass===normalized.outcomeClass&&
          Math.abs(clamp01(Number(outcome!.confidence01))-normalized.confidence01)<1e-9&&
          evidence!.payload.verificationBasis===normalized.verificationBasis&&evidence!.payload.externalObservation===normalized.externalObservation&&
          evidence!.payload.observationId===normalized.observationId&&evidence!.payload.observationIntegrated===normalized.observationIntegrated&&
          evidence!.payload.expectedPostconditionPresent===normalized.expectedPostconditionPresent&&
          evidence!.payload.observedPostconditionPresent===normalized.observedPostconditionPresent&&
          (evidence!.payload.expectedPostconditionHash===normalized.expectedPostconditionHash||
            (typeof evidence!.payload.expectedPostconditionHash!=='string'&&prior?.projectionHash===projectionHash))&&
          (evidence!.payload.observedPostconditionHash===normalized.observedPostconditionHash||
            (typeof evidence!.payload.observedPostconditionHash!=='string'&&prior?.projectionHash===projectionHash));
        if(!storedMatches||(prior?.projectionHash&&prior.projectionHash!==projectionHash))throw new Error('tool-receipt-execution-id-conflict');
        const replayEntry:ToolReceiptProjectionIndexEntry={executionId,actionEventId:action!.id,outcomeEventId:outcome!.id,evidenceEventId:evidence!.id,projectedAt:prior?.projectedAt??action!.at,projectionHash};
        this.receiptProjectionIndex.set(executionId,replayEntry);
        return {...replayEntry,replayed:true};
      }
    }
    const at=input.at===undefined?Date.now():input.at;
    const decision=this.events.find(event=>event.id===decisionId);
    return this.withAtomicLedgerMutation(()=>{
      const action=this.append({
        tick:input.tick,stage:'tool-action',source:'action-gateway',
        parentIds:decision?[decision.id]:[],external:false,confidence01:input.verified?Math.max(.5,clamp01(input.confidence01)):.5,at,
        payload:{executionId,tool:safeTool,decisionId:decision?.id??null,requestedDecisionId:normalized.decisionId??null,decisionLinked:Boolean(decision)},
      });
      const outcome=this.append({
        tick:input.tick,stage:'tool-outcome',source:'action-gateway-outcome',
        parentIds:[action.id],external:false,confidence01:clamp01(input.confidence01),at,
        payload:{executionId,tool:safeTool,ok:input.ok,verified:input.verified,outcomeClass},
      });
      const evidence=this.append({
        tick:input.tick,stage:'tool-evidence',source:'outcome-verification',
        parentIds:[outcome.id],external:input.externalObservation,confidence01:clamp01(input.confidence01),at,
        payload:{executionId,tool:safeTool,verificationBasis,externalObservation:input.externalObservation,observationId:observationValue||null,observationIntegrated:input.observationIntegrated,expectedPostconditionPresent:normalized.expectedPostconditionPresent,observedPostconditionPresent:normalized.observedPostconditionPresent,expectedPostconditionHash:normalized.expectedPostconditionHash,observedPostconditionHash:normalized.observedPostconditionHash},
      });
      const entry:ToolReceiptProjectionIndexEntry={executionId,actionEventId:action.id,outcomeEventId:outcome.id,evidenceEventId:evidence.id,projectedAt:at,projectionHash};
      this.receiptProjectionIndex.set(executionId,entry);
      while(this.receiptProjectionIndex.size>256) { const oldest=this.receiptProjectionIndex.keys().next().value; if(oldest===undefined) break; this.receiptProjectionIndex.delete(oldest); }
      return {...entry,replayed:false};
    });
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
    const expected=String(input.expectedPostcondition??'').normalize('NFKC').trim();
    const observed=String(input.observedPostcondition??'').normalize('NFKC').trim();
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
    type PhaseKey='observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'selfUpdate';
    type PreparedPhase={source:string;confidence01?:number;external?:boolean;payload:Record<string,unknown>};
    type PhaseSpec={key:PhaseKey;stage:CognitiveStage;defaultSource:string;parents:PhaseKey[];forwardsExternal?:boolean};
    const specs:PhaseSpec[]=[
      {key:'observation',stage:'observation',defaultSource:'runtime',parents:[],forwardsExternal:true},
      {key:'prediction',stage:'prediction',defaultSource:'prediction',parents:['observation']},
      {key:'appraisal',stage:'appraisal',defaultSource:'appraisal',parents:['observation','prediction']},
      {key:'attention',stage:'attention',defaultSource:'attention',parents:['appraisal','prediction']},
      {key:'memory',stage:'memory',defaultSource:'memory',parents:['attention','observation']},
      {key:'goal',stage:'goal',defaultSource:'goal',parents:['appraisal','memory','prediction']},
      {key:'plan',stage:'plan',defaultSource:'plan',parents:['goal','prediction']},
      {key:'action',stage:'action',defaultSource:'action',parents:['plan','prediction','observation']},
      {key:'outcome',stage:'outcome',defaultSource:'outcome',parents:['action','prediction'],forwardsExternal:true},
      {key:'learning',stage:'learning',defaultSource:'learning',parents:['outcome','action']},
      {key:'selfUpdate',stage:'self-update',defaultSource:'self-update',parents:['learning','outcome']},
    ];
    const readDataField=(record:Record<string,unknown>,key:string):unknown=>{
      const descriptor=Object.getOwnPropertyDescriptor(record,key);
      if(!descriptor)return undefined;
      if(!Object.hasOwn(descriptor,'value'))throw new TypeError('cognitive-cycle-accessor-not-allowed');
      return descriptor.value;
    };
    if(!isRecord(input))throw new TypeError('invalid-cognitive-cycle-input');
    const rawInput=input as unknown as Record<string,unknown>;
    const rawTick=readDataField(rawInput,'tick');
    if(typeof rawTick!=='number'||!Number.isSafeInteger(rawTick)||rawTick<0)throw new RangeError('invalid-cognitive-event-tick');
    const rawAt=readDataField(rawInput,'at');
    if(rawAt!==undefined&&(typeof rawAt!=='number'||!Number.isFinite(rawAt)||rawAt<0))throw new RangeError('invalid-cognitive-event-timestamp');

    // Normalize every supplied phase before the first event is appended. A malformed
    // late learning/self-update payload must never leave earlier observation/plan events behind.
    const prepared:Partial<Record<PhaseKey,PreparedPhase>>={};
    for(const spec of specs){
      const rawPhase=readDataField(rawInput,spec.key);
      if(!rawPhase)continue;
      if(!isRecord(rawPhase))throw new TypeError(`invalid-cognitive-cycle-phase:${spec.key}`);
      const phaseRecord=rawPhase as Record<string,unknown>;
      const rawSource=readDataField(phaseRecord,'source');
      const source=rawSource??spec.defaultSource;
      if(typeof source!=='string')throw new TypeError('invalid-cognitive-event-source');
      const confidence01=readDataField(phaseRecord,'confidence01');
      if(confidence01!==undefined&&(typeof confidence01!=='number'||!Number.isFinite(confidence01)))throw new TypeError('invalid-cognitive-event-confidence');
      let external:boolean|undefined;
      if(spec.forwardsExternal){
        const rawExternal=readDataField(phaseRecord,'external');
        if(rawExternal!==undefined&&typeof rawExternal!=='boolean')throw new TypeError('invalid-cognitive-event-external-flag');
        external=rawExternal as boolean|undefined;
      }
      const payload=cleanPayload(readDataField(phaseRecord,'payload'));
      prepared[spec.key]={source,confidence01:confidence01 as number|undefined,external,payload};
    }

    const ids:Partial<Record<PhaseKey,string>>={};
    return this.withAtomicLedgerMutation(()=>{
      for(const spec of specs){
        const phase=prepared[spec.key];
        if(!phase)continue;
        const parentIds=spec.parents.map(key=>ids[key]).filter((id):id is string=>Boolean(id));
        const event=this.append({
          tick:rawTick,
          stage:spec.stage,
          source:phase.source,
          parentIds,
          ...(spec.forwardsExternal?{external:phase.external}:{}),
          confidence01:phase.confidence01,
          payload:phase.payload,
          at:rawAt as number|undefined,
        });
        ids[spec.key]=event.id;
      }
      return ids;
    });
  }

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

  recent(limit=64):CognitiveEventNode[]{return this.events.slice(0,Math.max(1,Math.min(256,Math.floor(limit)))).map(cloneCognitiveEvent);}

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
    const receiptEvents=this.events.filter(event=>receiptIds.has(event.id)&&!recentIds.has(event.id)).map(cloneCognitiveEvent);
    return{version:1,capacity:this.capacity,total:this.total,buffered:this.events.length,linkedParentEvents:linked,danglingParentLinks:dangling,lineageIntegrity01:clamp01(linked/Math.max(1,totalParentRefs)),cycleCoverage01:coverage,causalDensity01:clamp01(linked/Math.max(1,this.events.length*2)),recentTicks,recent,receiptEvents,receiptProjectionIndex:[...this.receiptProjectionIndex.values()].map(entry=>({
      ...entry,
      ...(entry.externalObservations?{externalObservations:entry.externalObservations.map(ref=>({...ref}) )}:{}),
      ...(entry.receiptRevisions?{receiptRevisions:entry.receiptRevisions.map(ref=>({...ref}) )}:{}),
    }))};
  }
}
